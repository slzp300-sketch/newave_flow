// Shared student-grade identity. Status colors (attendance/pass/fail) stay separate.
export const GRADE_PALETTE = Object.freeze({
  '중1': '#1750ec', '중2': '#f2f56f', '중3': '#f8b4cc',
  '고1': '#6fb6f5', '고2': '#6ff5dc', '고3': '#e44343',
})
export function gradeKey(value) {
  const text = String(value ?? '').normalize('NFKC').trim()
  const match = text.match(/^(중|고)(?:등학교|등|학교)?\s*([123])(?:학년)?/)
  if (!match || /^\d/.test(text.slice(match[0].length)) || /[중고]\s*[123]/.test(text.slice(match[0].length))) return null
  return match[1] + match[2]
}
export function gradeClasses(value) {
  const key = gradeKey(value)
  const tone = key ? `grade-${key[0] === '중' ? 'm' : 'h'}${key[1]}` : 'grade-neutral'
  return { key, color: GRADE_PALETTE[key] ?? '#64748b',
    bg: `grade-solid ${tone}`, light: `grade-soft ${tone}`, text: `grade-ink ${tone}`,
    border: `grade-border ${tone}`, accent: `grade-solid ${tone}`, bar: `grade-bar ${tone}`,
    progress: `grade-bar ${tone}`, back: `grade-soft grade-ink ${tone}`,
    btn: `grade-soft grade-ink ${tone}`, hover: `grade-hover ${tone}` }
}
