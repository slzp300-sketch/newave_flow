// Axios already retries a disconnected read once. Avoid another pair of
// timeouts in Query; never retry rejected permissions or caller cancellation.
export function retryQuery(failureCount, error) {
  if (failureCount >= 1 || error?.code === 'ERR_CANCELED') return false
  const status = error?.response?.status
  if (status) return status >= 500 && status <= 599
  return !error?.config?._networkRetry
}
