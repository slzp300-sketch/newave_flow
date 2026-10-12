import { useCallback, useSyncExternalStore } from 'react'
import useAuthStore from '../store/authStore'
import { eventSeenKey, parseSeenEvents, mergeSeenEvents, isUnseenEvent } from '../utils/attention'

const memory = new Map()
const changed = 'newave:event-seen-changed'
const read = key => {
  if (memory.has(key)) return memory.get(key)
  try { return localStorage.getItem(key) || '{}' } catch { return '{}' }
}

export default function useEventSeen(today) {
  const userId = useAuthStore(s => s.user?.id)
  const key = eventSeenKey(userId)
  const subscribe = useCallback(listener => {
    const onChange = event => {
      if (event.key && event.key !== key) return
      if (event.type === 'storage') memory.delete(key)
      listener()
    }
    window.addEventListener('storage', onChange)
    window.addEventListener(changed, onChange)
    return () => { window.removeEventListener('storage', onChange); window.removeEventListener(changed, onChange) }
  }, [key])
  const raw = useSyncExternalStore(subscribe, () => read(key))
  const seen = parseSeenEvents(raw)
  const markSeen = useCallback(events => {
    if (!userId) return
    const rawNext = JSON.stringify(mergeSeenEvents(parseSeenEvents(read(key)), events))
    try { localStorage.setItem(key, rawNext); memory.delete(key) }
    catch { memory.set(key, rawNext) } // Keep this session usable if storage is unavailable.
    window.dispatchEvent(new Event(changed))
  }, [key, userId])
  return { isNew: event => !!userId && isUnseenEvent(event, seen, today), markSeen }
}
