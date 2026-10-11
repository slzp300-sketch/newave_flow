import { addDays, addWeeks, differenceInCalendarWeeks, format, getWeek, getWeekYear, startOfWeek } from 'date-fns'

const WEEK_OPTIONS = { weekStartsOn: 0, firstWeekContainsDate: 1 }
export const TTS_START_YEAR = 2026
export const TTS_START_DATE = '2026-09-27'
const firstSunday = year => startOfWeek(new Date(year, 0, 1), WEEK_OPTIONS)

export const ttsYear = (now = new Date()) => getWeekYear(now, WEEK_OPTIONS)
export const weeksInYear = year => differenceInCalendarWeeks(firstSunday(year + 1), firstSunday(year), WEEK_OPTIONS)
export const ttsYears = (now = new Date()) => Array.from(
  { length: Math.max(0, ttsYear(now) + 2 - TTS_START_YEAR) }, (_, i) => ttsYear(now) + 1 - i,
)
export const quartersForYear = year => (year < TTS_START_YEAR ? [] : [1, 2, 3, 4])
  .filter(q => year > TTS_START_YEAR || q === 4)
  .map(q => ({ q, from: (q - 1) * 13 + 1, to: q === 4 ? weeksInYear(year) : q * 13 }))

export const defaultQuarter = (year, now = new Date()) => {
  if (year === TTS_START_YEAR) return 4
  if (year < ttsYear(now)) return 4
  if (year > ttsYear(now)) return 1
  return Math.min(Math.ceil(getWeek(now, WEEK_OPTIONS) / 13), 4)
}

export const quarterDateLabel = (year, quarter) => {
  const range = quartersForYear(year).find(x => x.q === quarter)
  if (!range) return ''
  const from = addWeeks(firstSunday(year), range.from - 1)
  const to = addDays(addWeeks(firstSunday(year), range.to - 1), 6)
  return `${format(from, 'yyyy/M/d')} ~ ${format(to, 'yyyy/M/d')} · ${range.from}~${range.to}주차`
}

export const quarterPeople = (people, year, quarter) => {
  const range = quartersForYear(year).find(x => x.q === quarter)
  if (!range) return []
  return people.map(p => {
    const weekly = Object.fromEntries(Object.entries(p.weekly || {})
      .filter(([w]) => Number(w) >= range.from && Number(w) <= range.to))
    const scores = Object.values(weekly).filter(s => s > 0)
    return { ...p, weekly, total: scores.reduce((a, b) => a + b, 0), weeks: scores.length }
  })
}

export const firstTtsOffset = (now = new Date()) => differenceInCalendarWeeks(new Date(2026, 8, 27), now, WEEK_OPTIONS)
