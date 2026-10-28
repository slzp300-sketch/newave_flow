import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient, useMutation, useIsMutating } from '@tanstack/react-query'
import useAuthStore from '../store/authStore'
import { eventApi } from '../api/event'
import { eventSeenKey, parseSeenEvents, legacyReadMatches, isUnseenEvent, knownRead } from '../utils/attention'

const readLegacy = key => {
  try { return parseSeenEvents(localStorage.getItem(key)) } catch { return {} }
}

export default function useEventSeen(today, events = []) {
  const userId = useAuthStore(s => s.user?.id)
  const qc = useQueryClient()
  const queryKey = ['event-reads', userId]
  const mutationKey = ['acknowledge-event', userId]
  const attempted = useRef(new Set())
  const query = useQuery({ queryKey,
    queryFn: () => eventApi.getReads().then(r => r.data), enabled: !!userId,
    staleTime: 15_000, refetchInterval: 15_000,
    refetchOnWindowFocus: 'always', refetchOnMount: 'always' })
  const isSaving = useIsMutating({ mutationKey }) > 0
  const mutation = useMutation({ mutationKey,
    mutationFn: event => eventApi.acknowledge(event.id, event.readVersion).then(r => r.data),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey })
      return { queryKey, userId }
    },
    onSuccess: async (saved, event, context) => {
      if (useAuthStore.getState().user?.id !== context.userId) return
      // A GET started before this write must not restore an older unread state.
      await qc.cancelQueries({ queryKey: context.queryKey })
      qc.setQueryData(context.queryKey, previous => ({ ...previous, ...saved }))
      const key = eventSeenKey(context.userId)
      const legacy = readLegacy(key)
      if (legacyReadMatches(event, legacy)) {
        delete legacy[event.id]
        try { localStorage.setItem(key, JSON.stringify(legacy)) } catch { /* Server is authoritative. */ }
      }
    },
    onError: error => {
      if ([404, 409].includes(error.response?.status)) {
        qc.invalidateQueries({ queryKey: ['events'] })
        qc.invalidateQueries({ queryKey: ['events-all'] })
      }
    },
  })
  const markSeen = eventsToRead => {
    if (!userId || isSaving) return
    eventsToRead.filter(event => event.readVersion).forEach(event => mutation.mutate(event))
  }
  // Carry over matching browser-only acknowledgements once; changed content stays unread.
  useEffect(() => {
    if (!userId || !knownRead(query) || isSaving) return
    const legacy = readLegacy(eventSeenKey(userId))
    const candidate = events.find(event => {
      const token = `${userId}:${event.id}:${event.readVersion}`
      return !attempted.current.has(token) && query.data[event.id] !== event.readVersion && legacyReadMatches(event, legacy)
    })
    if (candidate) {
      attempted.current.add(`${userId}:${candidate.id}:${candidate.readVersion}`)
      mutation.mutate(candidate)
    }
  }, [userId, events, query.data, query.isSuccess, query.isError, query.fetchStatus, isSaving, mutation.mutate])

  const readError = mutation.isError
    ? (mutation.error.response?.status === 409 ? '일정이 변경되었어요. 최신 내용을 다시 확인해 주세요.' : '확인 상태를 저장하지 못했어요. 일정을 다시 눌러 주세요.')
    : query.isError ? '일정 확인 상태를 불러오지 못했어요.' : null
  return {
    readsKnown: knownRead(query),
    readQuery: query,
    isNew: event => !!userId && knownRead(query) && isUnseenEvent(event, query.data, today),
    markSeen, isSaving, readError,
    retryReads: () => { mutation.reset(); query.refetch() },
  }
}
