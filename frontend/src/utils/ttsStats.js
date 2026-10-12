import { ttsYear } from './ttsPeriod.js'

export function elapsedWeeks(year, range, currentWeek, now = new Date()) {
  const currentYear = ttsYear(now)
  const last = year > currentYear ? 0 : year < currentYear ? range.to : Math.min(range.to, currentWeek || 0)
  return Array.from({ length: Math.max(0, last - range.from + 1) }, (_, i) => last - i)
}

export function scoreSummary(people, value = p => p.score) {
  const scores = people.map(value).filter(s => s != null)
  return { recorded: scores.length, participating: scores.filter(s => s > 0).length,
    average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    highest: scores.length ? Math.max(...scores) : null }
}

export function rankedPeople(people, value = p => p.score) {
  const sorted = [...people].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1) || a.name.localeCompare(b.name, 'ko'))
  let previous, rank = 0
  return sorted.map((person, index) => {
    const score = value(person)
    if (score !== previous) { rank = index + 1; previous = score }
    return { ...person, rank: score == null ? null : rank }
  })
}

export function filterPeople(people, { grade = '', search = '', sort = 'score' } = {}) {
  const filtered = people.filter(p => (!grade || p.grade === grade) && p.name.includes(search.trim()))
  return sort === 'name' ? filtered.sort((a, b) => a.name.localeCompare(b.name, 'ko')) : filtered
}
