// Keep a failed field visible until that same field is retried. A later save of
// another question/day must not announce that every change has been saved.
export function ttsSaveFeedback(mutations, weekStart, questionId) {
  const index = ttsFeedbackIndex(mutations, weekStart)
  return questionId == null ? index.overall : index.questions.get(questionId) || summarize([])
}

// One pass per history change, shared by the summary and every question row.
export function ttsFeedbackIndex(mutations, weekStart) {
  const fields = new Map()
  for (const mutation of mutations) {
    const v = mutation.variables
    if (!v || v.weekStart !== weekStart) continue
    const key = `${v.questionId}:${v.day || 'weekly'}`
    if (!fields.has(key) || fields.get(key).id < mutation.id) fields.set(key, mutation)
  }
  const questions = new Map()
  for (const m of fields.values()) {
    const id = m.variables.questionId
    if (!questions.has(id)) questions.set(id, [])
    questions.get(id).push(m.status)
  }
  return { overall: summarize([...fields.values()].map(m => m.status)),
    questions: new Map([...questions].map(([id, statuses]) => [id, summarize(statuses)])) }
}

function summarize(statuses) {
  if (statuses.includes('pending')) return { kind: 'pending', text: '저장 중…' }
  if (statuses.includes('error')) return { kind: 'error', text: '저장 실패 · 다시 체크해 주세요' }
  if (statuses.includes('success')) return { kind: 'success', text: '저장 완료' }
  return { kind: 'idle', text: '탭하면 자동 저장' }
}

export function ttsCompletionMessage({ items, todayLabel, remainingToday, saving, failed }) {
  if (saving || failed) return null
  if (items.length && items.every(item => item.done === item.total)) {
    return { done: true, text: '이번 주 전체 체크 완료' }
  }
  if (!todayLabel) return null
  const weeklyRemaining = items.filter(item => !item.daily && item.done < item.total).length
  if (remainingToday.length) return { done: false, text: `오늘(${todayLabel}) 일별 체크 ${remainingToday.length}개 남음` }
  if (!items.some(item => item.daily)) return null
  return { done: true, text: `오늘(${todayLabel}) 일별 체크 완료${weeklyRemaining ? ` · 예배·모임 ${weeklyRemaining}개 미체크` : ''}` }
}
