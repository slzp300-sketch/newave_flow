export const STORE_APP_ID = '6823391707'
export const STORE_BUNDLE_ID = 'app.newaveflow.mobile'
export const STORE_URL = `https://apps.apple.com/kr/app/id${STORE_APP_ID}`
export const STORE_LOOKUP_URL = `https://itunes.apple.com/lookup?id=${STORE_APP_ID}&country=kr`
export const STORE_CHECK_INTERVAL = 60 * 60 * 1000
export const STORE_RETRY_INTERVAL = 15 * 60 * 1000
export const STORE_REMIND_INTERVAL = 24 * 60 * 60 * 1000
export const STORE_CACHE_KEY = 'newave-ios-store-version-v1'
export const STORE_DISMISS_KEY = 'newave-ios-store-dismiss-v1'

export function storeLookupUrl(timestamp = Date.now()) {
  // Apple's fixed lookup URL can retain yesterday's release after a new version is live.
  // Share one cache key per check window, without sending any device or account identifiers.
  return `${STORE_LOOKUP_URL}&t=${Math.floor(timestamp / STORE_CHECK_INTERVAL)}`
}

function versionParts(value) {
  if (typeof value !== 'string' || !/^\d{1,5}(?:\.\d{1,5}){0,2}$/.test(value)) return null
  return value.split('.').map(Number)
}

// Marketing versions are numeric components, not decimals or lexicographic strings.
export function compareStoreVersions(left, right) {
  const a = versionParts(left), b = versionParts(right)
  if (!a || !b) return null
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0) ? 1 : -1
  }
  return 0
}

export function iosVersionFromUserAgent(value = '') {
  return value.match(/(?:iPhone OS|CPU OS) (\d+(?:_\d+){0,2})\b/)?.[1].replaceAll('_', '.') || null
}

function validRelease(value, now) {
  return value && versionParts(value.version) && versionParts(value.minimumOsVersion)
    && Number.isFinite(value.releasedAt) && value.releasedAt <= now
}

export function readStoreRelease(response, now = Date.now()) {
  if (response?.status !== 200) throw new Error('Store lookup unavailable')
  const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data
  if (!Array.isArray(data?.results)) throw new Error('Invalid store response')
  const app = data.results.find(item => String(item?.trackId) === STORE_APP_ID
    && item.bundleId === STORE_BUNDLE_ID && item.kind === 'software')
  if (!app) return null
  const release = { version: app.version, minimumOsVersion: app.minimumOsVersion,
    releasedAt: Date.parse(app.currentVersionReleaseDate) }
  return validRelease(release, now) ? release : null
}

export function storeUpdateOffer(info, release, osVersion) {
  if (info?.id !== STORE_BUNDLE_ID || !release || compareStoreVersions(release.version, info.version) !== 1) return null
  if (osVersion && compareStoreVersions(release.minimumOsVersion, osVersion) === 1) return null
  return { currentVersion: info.version, version: release.version, url: STORE_URL }
}

function readSaved(storage, key) {
  try { return JSON.parse(storage?.getItem(key) || 'null') } catch { return null }
}
function save(storage, key, value) {
  try { storage?.setItem(key, JSON.stringify(value)) } catch { /* An optional notice must not block the app. */ }
}

// Native services and the clock are injected to test lifecycle/network races without Apple accounts.
export function startStoreUpdateMonitor({ platform, app, http, storage, events, userAgent = '',
  isOnline = () => true, now = Date.now, onChange = () => {} }) {
  let stopped = false, active = true, checking = false, nextAttemptAt = 0, offer = null
  let cached = readSaved(storage, STORE_CACHE_KEY)
  let dismissed = readSaved(storage, STORE_DISMISS_KEY)
  const handles = []
  const osVersion = iosVersionFromUserAgent(userAgent)
  const publish = (info, release) => {
    if (stopped) return
    offer = storeUpdateOffer(info, release, osVersion)
    const deferred = offer && dismissed?.version === offer.version
      && Number.isFinite(dismissed.until) && dismissed.until > now()
      && dismissed.until <= now() + STORE_REMIND_INTERVAL
    onChange(active && !deferred ? offer : null)
  }
  const check = async () => {
    if (platform !== 'ios' || stopped || !active || checking || !isOnline()) return
    checking = true
    try {
      const info = await app.getInfo()
      if (stopped) return
      if (info?.id !== STORE_BUNDLE_ID || !versionParts(info.version)) { publish(info, null); return }
      const timestamp = now()
      const fresh = Number.isFinite(cached?.checkedAt) && cached.checkedAt <= timestamp
        && timestamp - cached.checkedAt < STORE_CHECK_INTERVAL
        && (cached.release === null || validRelease(cached.release, timestamp))
      if (fresh) { publish(info, cached.release); return }
      if (timestamp < nextAttemptAt) return
      const response = await http.get({ url: storeLookupUrl(timestamp), responseType: 'json',
        connectTimeout: 8000, readTimeout: 8000 })
      if (stopped) return
      const release = readStoreRelease(response, now())
      cached = { checkedAt: now(), release }
      save(storage, STORE_CACHE_KEY, cached)
      publish(info, release)
    } catch {
      if (!stopped) {
        nextAttemptAt = now() + STORE_RETRY_INTERVAL
        onChange(null)
      }
    } finally { checking = false }
  }
  const online = () => { void check() }
  if (platform === 'ios') {
    events?.addEventListener('online', online)
    try {
      void Promise.resolve(app.addListener('appStateChange', ({ isActive }) => {
        if (stopped) return
        active = !!isActive
        if (active) void check()
        else onChange(null)
      })).then(handle => {
        if (stopped) return handle.remove()
        handles.push(handle)
      }).catch(() => {})
    } catch { /* Startup still checks if lifecycle registration is unavailable. */ }
    void check()
  }
  return {
    check,
    dismiss() {
      if (stopped || !offer) return
      dismissed = { version: offer.version, until: now() + STORE_REMIND_INTERVAL }
      save(storage, STORE_DISMISS_KEY, dismissed)
      onChange(null)
    },
    stop() {
      stopped = true
      events?.removeEventListener('online', online)
      handles.forEach(handle => {
        try { void Promise.resolve(handle.remove()).catch(() => {}) } catch { /* Bridge already closed. */ }
      })
    },
  }
}
