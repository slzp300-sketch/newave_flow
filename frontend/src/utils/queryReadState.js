// Only a completed, successful read may be treated as empty or editable.
export function queryReadState(queries) {
  if (queries.some(q => q.isError)) return 'error'
  if (queries.some(q => !q.isSuccess || q.isFetching || q.isPlaceholderData || q.fetchStatus === 'paused')) return 'loading'
  return 'ready'
}

// Display cached reads while revalidating, including a successful empty/null result.
// Keep queryReadState as the stricter guard for editing and submitting.
export function hasQueryData(queries) {
  return queries.every(q => q.data !== undefined && !q.isPlaceholderData)
}
