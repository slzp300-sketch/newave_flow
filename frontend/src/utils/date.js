import { 
  format, isToday, isTomorrow, isYesterday, 
  getISOWeek, getWeek, getWeekYear, getMonth, getWeekOfMonth,
  startOfWeek, endOfWeek, subWeeks, addWeeks
} from 'date-fns'
import { ko } from 'date-fns/locale'

export const formatDate = (date) =>
  format(new Date(date), 'yyyy년 M월 d일 (EEE)', { locale: ko })

export const formatShort = (date) =>
  format(new Date(date), 'M월 d일', { locale: ko })

export const toApiDate = (date = new Date()) =>
  format(date, 'yyyy-MM-dd')

export const todayLabel = () => {
  const d = new Date()
  if (isToday(d))     return '오늘'
  if (isTomorrow(d))  return '내일'
  if (isYesterday(d)) return '어제'
  return formatShort(d)
}

export const greetingByTime = () => {
  const h = new Date().getHours()
  if (h < 12) return '좋은 아침이에요'
  if (h < 18) return '안녕하세요'
  return '수고하셨어요'
}

/** 현재 날짜의 주차 (ISO 기준) */
export const getCurrentWeekNumber = () => getISOWeek(new Date())

/**
 * 주 표시용 라벨 (그 주 일요일 기준)
 * monthWeek: "10월 1주차" — 그 달의 몇 번째 주일인지
 * yearWeek:  "26년 41주차" — 서버와 같은 연간 주차 (1월 1일이 든 주가 1주차)
 */
export const weekLabels = (date) => {
  const sun = startOfWeek(date, { weekStartsOn: 0 })
  const yy  = String(getWeekYear(sun, { weekStartsOn: 0 })).slice(2)
  return {
    monthWeek: `${sun.getMonth() + 1}월 ${Math.ceil(sun.getDate() / 7)}주차`,
    yearWeek:  `${yy}년 ${getWeek(sun, { weekStartsOn: 0 })}주차`,
  }
}

/** 현재 주간 범위 (항상 이번 주, Mon/Tue 시프트 없음) */
export const getThisWeekInfo = () => {
  const now = new Date()
  const sun = startOfWeek(now, { weekStartsOn: 0 })
  const sat = endOfWeek(now, { weekStartsOn: 0 })
  return {
    start: format(sun, 'M/d'),
    end:   format(sat, 'M/d'),
    weekNum: getWeek(sun, { weekStartsOn: 0 }),
    month: getMonth(sun) + 1,
    weekOfMonth: getWeekOfMonth(sun, { weekStartsOn: 0 })
  }
}

/** TTS 주간 범위 (일요일 ~ 토요일) */
export const getTTSWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  
  // 일요일(0)~화요일(2)이면 새 주가 시작됐지만 아직 전주 TTS 제출 기간이므로 범위를 지난 주로 잡음
  const targetDate = (day === 0 || day === 1 || day === 2) ? subWeeks(now, 1) : now
  
  const sun = startOfWeek(targetDate, { weekStartsOn: 0 })
  const sat = endOfWeek(targetDate, { weekStartsOn: 0 })
  
  return {
    start: format(sun, 'M/d'),
    end:   format(sat, 'M/d'),
    weekNum: getWeek(sun, { weekStartsOn: 0 }),
    month: getMonth(sun) + 1,
    weekOfMonth: getWeekOfMonth(sun, { weekStartsOn: 0 })
  }
}

/** 현재 주의 시작(일)~종료(토) 날짜 문자열 */
export const getCurrentWeekRange = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 })
  const end   = endOfWeek(new Date(), { weekStartsOn: 0 })
  return `${format(start, 'M/d')} ~ ${format(end, 'M/d')}`
}

/** TTS 제출 가능 여부 (토요일 ~ 화요일) */
export const canSubmitTTS = () => {
  const day = new Date().getDay()
  return [6, 0, 1, 2].includes(day)
}

/** 출석 체크용 가장 최근 주일(일요일) 가져오기 */
export const getMostRecentSunday = (date = new Date()) => {
  return startOfWeek(date, { weekStartsOn: 0 })
}

/** 현재 일~화요일인지 확인 */
export const isSundayToTuesday = () => {
  const day = new Date().getDay()
  return day === 0 || day === 1 || day === 2 // 0: Sunday, 1: Monday, 2: Tuesday
}

/** 지금 기준 offset주 이동한 주의 시작일 (weekStartsOn 0=일, 1=월). offset 0 = 이번 주 */
export const getWeekStartByOffset = (offset = 0, weekStartsOn = 0) =>
  startOfWeek(addWeeks(new Date(), offset), { weekStartsOn })

/** 'yyyy-MM-ddTHH:mm:ss' → '10/9 14:05' (마지막 수정 시각 표시용) */
export const formatUpdatedAt = (value) =>
  value ? format(new Date(value), 'M/d HH:mm') : ''
