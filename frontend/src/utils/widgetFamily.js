export const WIDGET_TYPES = [
  { id: 'daily', title: '영성 체크', description: '말씀·기도를 바로 체크', sizes: ['medium', 'large'] },
  { id: 'weekly', title: '이번 주 체크', description: '남은 체크를 한눈에', sizes: ['medium', 'large'] },
  { id: 'combined', title: '일정·체크', description: '가까운 일정과 나의 체크', sizes: ['medium', 'large'] },
  { id: 'calendar', title: '교회 달력', description: '한 달의 교회 일정', sizes: ['large'] },
]
export const widgetType = id => WIDGET_TYPES.find(type => type.id === id) || WIDGET_TYPES[2]
export const pendingWidgetTasks = snapshot => (snapshot?.tasks || []).filter(task => task.state === 'pending')

// Snapshot dates are Seoul calendar dates. UTC arithmetic here only lays out
// date-only values; the viewer's timezone must never shift the month or day.
export function widgetMonth(snapshot) {
  const date = snapshot?.date || ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [year, month, day] = date.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (month < 1 || month > 12 || day < 1 || day > count) return null
  const markers = new Set(snapshot.calendarDates || [])
  const offset = first.getUTCDay()
  const cells = Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
    const number = index - offset + 1
    if (number < 1 || number > count) return null
    const key = `${date.slice(0, 7)}-${String(number).padStart(2, '0')}`
    return { day: number, date: key, today: key === date, event: markers.has(key) }
  })
  return { year, month, cells, available: Array.isArray(snapshot.calendarDates) }
}
