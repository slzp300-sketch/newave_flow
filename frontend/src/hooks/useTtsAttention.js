import { useIsMutating, useQuery } from '@tanstack/react-query'
import { startOfWeek } from 'date-fns'
import useToday from './useToday'
import { toApiDate } from '../utils/date'
import { ttsApi } from '../api/tts'
import { knownRead, weeklyTtsChecks } from '../utils/attention'
import { ttsToday } from '../utils/ttsPeriod'

export default function useTtsAttention() {
  const today = useToday(ttsToday)
  const weekStart = toApiDate(startOfWeek(new Date(today + 'T12:00:00'), { weekStartsOn: 0 }))
  const saving = useIsMutating({ mutationKey: ['tts-answer'] }) > 0
  const questions = useQuery({ queryKey: ['tts-questions', weekStart],
    queryFn: () => ttsApi.getQuestions(weekStart).then(r => r.data), staleTime: 60_000,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchInterval: 60_000 })
  const week = useQuery({ queryKey: ['tts-week', weekStart], enabled: !saving,
    queryFn: () => ttsApi.getWeek(weekStart).then(r => r.data), staleTime: 60_000,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchInterval: 60_000 })
  const known = knownRead(questions) && knownRead(week)
  const checks = weeklyTtsChecks(questions.data || [], week.data, today)
  const state = saving ? 'saving' : !known ? 'unknown' : checks.some(c => !c.checked) ? 'pending' : checks.length ? 'done' : 'none'
  return { pending: state === 'pending', known, state, reads: [questions, week] }
}
