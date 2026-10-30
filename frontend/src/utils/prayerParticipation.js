export const PRAYER_STATUSES = { TUE: '화 참석', THU: '목 참석', ABSENT: '불참', UNKNOWN: '미응답' }
export const PRAYER_GRADES = ['유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

export function prayerTotals(summary) {
  const { tuesday = 0, thursday = 0, absent = 0, unanswered = 0 } = summary
  const attending = tuesday + thursday
  const responded = attending + absent
  return { attending, responded, absent, unanswered, tuesday, thursday,
    rate: responded ? Math.round(attending / responded * 1000) / 10 : null }
}

export function prayerTrendTotals(weeks) {
  return prayerTotals(weeks.reduce((sum, week) => ({
    tuesday: sum.tuesday + week.tuesday, thursday: sum.thursday + week.thursday,
    absent: sum.absent + week.absent, unanswered: sum.unanswered + week.unanswered,
  }), { tuesday: 0, thursday: 0, absent: 0, unanswered: 0 }))
}

export function matchesPrayerStatus(status, filter) {
  return filter === 'ALL' || (filter === 'ATTEND' ? status === 'TUE' || status === 'THU' : status === filter)
}

export function prayerWeekOffset(week, currentWeek) {
  return Math.round((Date.parse(week + 'T00:00:00Z') - Date.parse(currentWeek + 'T00:00:00Z')) / 604800000)
}
