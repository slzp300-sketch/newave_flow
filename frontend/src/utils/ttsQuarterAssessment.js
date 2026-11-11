// A quarter total is compared with the mean of recorded quarter totals, not
// a weekly target or achievement percentage. Missing data is never zero-filled.
export const quarterScore = person => Object.keys(person.weekly || {}).length ? person.total : null
export const adminQuarterScore = person => person.weeklyScores?.length ? person.totalScore : null
const validScore = score => typeof score === 'number' && Number.isFinite(score) && score >= 0

export function assessQuarter(people, value = quarterScore) {
  const scores = people.map(value).filter(validScore)
  const sum = scores.reduce((total, score) => total + score, 0)
  const count = scores.length
  const average = count ? sum / count : null
  // Compare before rounding; equality passes. Search/pagination must follow this.
  const status = score => !validScore(score) || !count ? 'unrecorded'
    : score * count < sum ? 'below' : 'passed'
  const below = scores.filter(score => status(score) === 'below').length
  return { average, count, passed: count - below, below, unrecorded: people.length - count, status }
}

export const quarterStatusLabel = status => ({ passed: '통과', below: '미달', unrecorded: '기록 없음' })[status]
export const quarterAverageText = average => average == null ? '—' : average.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Display filtering deliberately receives the assessment of the full quarter.
export const filterQuarterStatus = (people, assessment, status = 'all', value = quarterScore) => status === 'all'
  ? people : people.filter(person => assessment.status(value(person)) === status)
