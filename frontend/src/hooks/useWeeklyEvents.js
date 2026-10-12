import { useQuery } from '@tanstack/react-query'
import { startOfWeek, endOfWeek } from 'date-fns'
import useToday from './useToday'
import useEventSeen from './useEventSeen'
import { toApiDate } from '../utils/date'
import { eventApi } from '../api/event'
import { eventRangeKey } from '../api/queryPolicy'
import { knownRead } from '../utils/attention'

export default function useWeeklyEvents() {
  const today = useToday()
  const date = new Date(today + 'T12:00:00')
  const from = toApiDate(startOfWeek(date, { weekStartsOn: 0 }))
  const to = toApiDate(endOfWeek(date, { weekStartsOn: 0 }))
  const query = useQuery({ queryKey: eventRangeKey(from, to),
    queryFn: () => eventApi.getEvents({ from, to }).then(r => r.data),
    staleTime: 60_000, refetchInterval: 60_000 })
  const events = [...(query.data || [])].sort((a, b) =>
    a.eventDate.localeCompare(b.eventDate) || (a.startTime || '').localeCompare(b.startTime || '') || a.id - b.id)
  const seen = useEventSeen(today)
  return { query, events, from, to, today, ...seen,
    hasNew: knownRead(query) && events.some(seen.isNew) }
}
