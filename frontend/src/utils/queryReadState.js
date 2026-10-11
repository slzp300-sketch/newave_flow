// Only a completed, successful read may be treated as empty or editable.
export function queryReadState(queries) {
  if (queries.some(q => q.isError)) return 'error'
  if (queries.some(q => !q.isSuccess || q.isFetching || q.isPlaceholderData || q.fetchStatus === 'paused')) return 'loading'
  return 'ready'
}
