import { format, addDays } from 'date-fns'
import { calendarWeekStart, weekReference, quartersForYear, ttsToday } from './ttsPeriod.js'

const dayIndex = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 }
const dateAt = (sunday, offset) => format(addDays(new Date(sunday + 'T12:00:00'), offset), 'yyyy-MM-dd')

// Use the quarter's server-split weeks, including zero scores and year-end storage keys.
export function rankingRecordWeeks(person, year, quarter, today = ttsToday()) {
  const range = quartersForYear(year).find(period => period.q === quarter)
  if (!range) return []
  return Object.keys(person.weekly || {}).filter(key => /^\d+$/.test(key)).map(Number)
    .map(number => {
      const start = format(calendarWeekStart(year, number), 'yyyy-MM-dd')
      return { start, end: dateAt(start, 6), ...weekReference(year, number) }
    }).filter(week => week.start <= today && week.start <= range.end && week.end >= range.start)
    .sort((a, b) => b.start.localeCompare(a.start))
}

export function rankingDateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return ''
  const date = new Date(value + 'T12:00:00Z')
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))} (${'일월화수목금토'[date.getUTCDay()]})`
}

// A weekly last-modified time is not a timestamp for each checkbox tap.
export function rankingSavedLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return ''
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + '+09:00')
  if (!Number.isFinite(date.getTime())) return ''
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul',
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]))
  return `${Number(parts.month)}/${Number(parts.day)} ${parts.hour}:${parts.minute}`
}

// Resolve by stable person key, never name. Clip daily checks at the calendar-quarter boundary.
export function rankingWeekDetail(data, personKey, weekStart, range) {
  if (data?.weekStart !== weekStart) throw new Error('선택한 주차와 조회된 기록이 다릅니다. 다시 조회해 주세요.')
  const person = data.people?.find(item => item.key === personKey)
  if (!person) return null
  if (data.importedPeriod || person.source === 'SHEET') return { imported: true, dates: [], weeklyItems: [], saved: '' }
  const dates = new Map(), weeklyItems = new Set()
  for (const item of person.items || []) {
    if (item.type === 'DAYS' && !item.linked) {
      for (const day of item.days || []) {
        if (!Object.hasOwn(dayIndex, day)) continue
        const date = dateAt(weekStart, dayIndex[day])
        if (date < range.start || date > range.end) continue
        if (!dates.has(date)) dates.set(date, new Set())
        dates.get(date).add(item.title)
      }
    } else if (item.checked) weeklyItems.add(item.title)
  }
  return { imported: false, saved: rankingSavedLabel(person.updatedAt), weeklyItems: [...weeklyItems],
    dates: [...dates].sort(([a], [b]) => b.localeCompare(a)).map(([date, titles]) => ({ date, titles: [...titles] })) }
}

// Adapt administrator projection without recalculating totals, linking by name or mutating it.
export function adminRankingPerson(row) {
  return { ...row, key: row.key ?? (row.teacherId != null ? `u${row.teacherId}` : null),
    name: row.teacherName, total: row.totalScore,
    weekly: Object.fromEntries((row.weeklyScores || []).map(week => [week.weekNum, week.score])) }
}
