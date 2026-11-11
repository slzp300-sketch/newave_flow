const titles = { save: '저장하지 못했습니다.', load: '자료를 불러오지 못했습니다.', download: '파일을 받지 못했습니다.', delete: '삭제하지 못했습니다.' }

export function requestErrorMessage(error, operation = 'save') {
  const status = error?.response?.status
  let detail
  if (status === 401) detail = '다시 로그인한 뒤 시도해 주세요.'
  else if (status === 403) detail = '이 작업을 할 권한이 없습니다.'
  else if (status === 404) detail = '대상 자료를 찾을 수 없습니다. 최신 자료를 확인해 주세요.'
  else if (status === 409) detail = '다른 변경이 반영됐습니다. 최신 자료를 확인해 주세요.'
  else if (status === 413) detail = '파일 크기를 줄인 뒤 다시 시도해 주세요.'
  else if (status === 429) detail = '잠시 후 다시 시도해 주세요.'
  else if (status >= 500) detail = '잠시 후 다시 시도해 주세요.'
  else if (status >= 400 && typeof error?.response?.data?.message === 'string') detail = error.response.data.message.slice(0, 300)
  else if (typeof error?.userMessage === 'string') detail = error.userMessage
  else detail = '연결 상태를 확인한 뒤 다시 시도해 주세요.'
  return `${titles[operation] || titles.save} ${detail}`
}

export function queryFeedback(queries, label = '기록') {
  const denied = queries.some(q => [401, 403].includes(q.error?.response?.status))
  const cached = !denied && queries.every(q => q.data !== undefined && !q.isPlaceholderData)
  const offline = queries.some(q => q.fetchStatus === 'paused')
  const failed = queries.some(q => q.isError)
  const checking = queries.some(q => !q.isSuccess || q.isFetching || q.isPlaceholderData)
  if (!offline && !failed && !checking) return null
  return {
    failed: failed || offline,
    cached,
    retrying: queries.some(q => q.isFetching),
    title: denied ? '자료를 확인할 권한이 없습니다.' : offline ? '연결이 끊겼습니다.' :
      failed ? `${label} 조회에 실패했습니다.` : `${label} 확인 중…`,
    detail: denied ? '계정과 권한을 확인해 주세요.' : cached ? '이전에 불러온 자료를 표시합니다.' :
      offline ? '연결 상태를 확인한 뒤 다시 시도해 주세요.' : failed ? '다시 불러와 주세요.' : '',
  }
}
