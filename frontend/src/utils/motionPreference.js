// Read changes again on app return; iOS settings can change while WKWebView is suspended.
export const FEEDBACK_SECONDS = 0.16
export function createMotionPreferenceStore(view) {
  const query = view?.matchMedia?.('(prefers-reduced-motion: reduce)')
  const getSnapshot = () => query?.matches ?? false
  const subscribers = new Set()
  const notify = () => subscribers.forEach(listener => listener())
  const listen = method => {
    query[method]('change', notify)
    view[method]('focus', notify)
    view[method]('pageshow', notify)
    view.document[method]('visibilitychange', notify)
  }
  const subscribe = listener => {
    if (!query) return () => {}
    if (!subscribers.size) listen('addEventListener')
    subscribers.add(listener)
    return () => {
      subscribers.delete(listener)
      if (!subscribers.size) listen('removeEventListener')
    }
  }
  return { getSnapshot, subscribe }
}
export const motionPreferenceStore = createMotionPreferenceStore(typeof window === 'undefined' ? undefined : window)
