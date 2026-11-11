import { addDays, addMonths, addWeeks, differenceInCalendarWeeks, format, getWeek, getWeekYear, startOfWeek } from 'date-fns'

const WEEK_OPTIONS = { weekStartsOn: 0, firstWeekContainsDate: 1 }
export const TTS_START_YEAR = 2026
export const TTS_START_DATE = '2026-09-27'
const firstSunday = year => startOfWeek(new Date(year, 0, 1), WEEK_OPTIONS)

export const ttsToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now)
const calendarDate = now => new Date(ttsToday(now) + 'T12:00:00')
export const ttsYear = (now = new Date()) => calendarDate(now).getFullYear()
export const weeksInYear = year => differenceInCalendarWeeks(firstSunday(year + 1), firstSunday(year), WEEK_OPTIONS)
export const ttsYears = (now = new Date()) => Array.from(
  { length: Math.max(0, ttsYear(now) + 2 - TTS_START_YEAR) }, (_, i) => ttsYear(now) + 1 - i,
)
export const quartersForYear = year => (year < TTS_START_YEAR ? [] : [1, 2, 3, 4])
  .filter(q => year > TTS_START_YEAR || q === 4)
  .map(q => {
    const start = new Date(year, (q - 1) * 3, 1)
    const end = addDays(addMonths(start, 3), -1)
    return { q, start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd'),
      from: differenceInCalendarWeeks(start, firstSunday(year), WEEK_OPTIONS) + 1,
      to: differenceInCalendarWeeks(end, firstSunday(year), WEEK_OPTIONS) + 1 }
  })

export const defaultQuarter = (year, now = new Date()) => {
  if (year === TTS_START_YEAR) return 4
  if (year < ttsYear(now)) return 4
  if (year > ttsYear(now)) return 1
  return Math.floor(calendarDate(now).getMonth() / 3) + 1
}

export const quarterDateLabel = (year, quarter) => {
  const range = quartersForYear(year).find(x => x.q === quarter)
  if (!range) return ''
  return `${format(new Date(range.start + 'T12:00:00'), 'yyyy/M/d')} ~ ${format(new Date(range.end + 'T12:00:00'), 'yyyy/M/d')}`
}

export const quarterPeople = (people, year, quarter) => {
  const range = quartersForYear(year).find(x => x.q === quarter)
  if (!range) return []
  return people.map(p => {
    // Full weekly totals cannot be split at a month boundary in the browser.
    // Only the server's date-level projection is authoritative for a calendar quarter.
    const calendar = p.calendarQuarters?.[quarter]
    const weekly = Object.fromEntries(Object.entries(calendar?.weekly || {})
      .map(([sunday, score]) => [differenceInCalendarWeeks(new Date(sunday + 'T12:00:00'), firstSunday(year), WEEK_OPTIONS) + 1, score]))
    const scores = Object.values(weekly).filter(s => s > 0)
    return { ...p, weekly, total: scores.reduce((a, b) => a + b, 0), weeks: scores.length,
      calendarDataReady: !!calendar }
  })
}

export const firstTtsOffset = (now = new Date()) => differenceInCalendarWeeks(new Date(2026, 8, 27), calendarDate(now), WEEK_OPTIONS)

export const calendarWeekStart = (year, displayWeek) => addWeeks(firstSunday(year), displayWeek - 1)

// Calendar-year views include the last partial week, whose stored key may be next year's week 1.
export const weekReference = (year, displayWeek) => {
  const sunday = calendarWeekStart(year, displayWeek)
  return { year: getWeekYear(sunday, WEEK_OPTIONS), weekNum: getWeek(sunday, WEEK_OPTIONS) }
}
