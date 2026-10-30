// Refresh even a fresh cache: another device may have saved since the last read.
export const ttsAdminRefreshOptions = {
  refetchOnMount: 'always',
  refetchOnWindowFocus: 'always',
  refetchOnReconnect: 'always',
}
