// A background refresh must not unmount the checklist or move keyboard focus.
// Keep the stricter shared queryReadState policy for other editing screens.
export function ttsReadState(queries) {
  const hasData = queries.every(q => q.data != null && !q.isPlaceholderData)
  const error = queries.some(q => q.isError)
  const paused = queries.some(q => q.fetchStatus === 'paused')
  return { hasData, editable: hasData && !error && !paused, error, paused,
    refreshing: queries.some(q => q.isFetching) }
}

const journals = new WeakMap()
const keyOf = week => ['tts-week', week]

function applyIntent(week, intent) {
  const previous = week.answers?.find(a => a.questionId === intent.questionId)
  let answerData = String(intent.checked)
  if (intent.day) {
    let days = {}
    try { days = JSON.parse(previous?.answerData || '{}') } catch { /* Empty malformed legacy value. */ }
    answerData = JSON.stringify({ ...days, [intent.day]: intent.checked })
  }
  return { ...week, answers: [...(week.answers || []).filter(a => a.questionId !== intent.questionId),
    { ...previous, questionId: intent.questionId, answerData }] }
}

// Confirmed server state + queued field intents. A failed save cannot undo another
// field or sneak into the next request for a different day of the same question.
export function ttsAnswerOptions(client, save) {
  if (!journals.has(client)) journals.set(client, new Map())
  const weeks = journals.get(client)
  const publish = (week, journal) => client.setQueryData(keyOf(week),
    journal.pending.reduce(applyIntent, journal.confirmed))
  const finish = (intent, response) => {
    const journal = weeks.get(intent.weekStart)
    if (!journal) return
    if (response) journal.confirmed = response
    journal.pending = journal.pending.filter(p => p !== intent)
    publish(intent.weekStart, journal)
    if (!journal.pending.length) weeks.delete(intent.weekStart)
  }
  return {
    mutationKey: ['tts-answer'], scope: { id: 'tts-answer' }, retry: false,
    onMutate: intent => {
      // cancelQueries cancels/reverts the current fetch synchronously before the
      // optimistic write; do not yield between reading and updating the cache.
      void client.cancelQueries({ queryKey: keyOf(intent.weekStart), exact: true })
      let journal = weeks.get(intent.weekStart)
      if (!journal) {
        journal = { confirmed: client.getQueryData(keyOf(intent.weekStart)), pending: [] }
        weeks.set(intent.weekStart, journal)
      }
      journal.pending.push(intent)
      publish(intent.weekStart, journal)
    },
    mutationFn: intent => {
      const week = applyIntent(weeks.get(intent.weekStart).confirmed, intent)
      return save({ weekStart: intent.weekStart, questionId: intent.questionId,
        answerData: week.answers.find(a => a.questionId === intent.questionId).answerData })
    },
    onSuccess: (response, intent) => finish(intent, response),
    onError: (_error, intent) => finish(intent),
    onSettled: (_data, error, intent) => {
      if (client.isMutating({ mutationKey: ['tts-answer'] }) === 1) {
        // Successful PUT already returns the complete week: no extra GET or
        // loading screen. On an uncertain failure, reconcile in the background.
        if (error) void client.invalidateQueries({ queryKey: keyOf(intent.weekStart), exact: true })
        void client.invalidateQueries({ queryKey: ['tts-stats'] })
        void client.invalidateQueries({ queryKey: ['tts-week-stats'] })
      }
    },
  }
}
