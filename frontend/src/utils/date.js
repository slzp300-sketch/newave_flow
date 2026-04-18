import { format, isToday, isTomorrow, isYesterday, getISOWeek, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
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

/** TTS 주간 범위 (일요일 ~ 토요일) */
export const getTTSWeekRange = () => {
  const now = new Date()
  const day = now.getDay()
  
  // 월요일(1) 또는 화요일(2)이면 '지난 주' TTS를 제출하는 기간이므로 범위를 지난 주로 잡음
  const targetDate = (day === 1 || day === 2) ? subWeeks(now, 1) : now
  
  const sun = startOfWeek(targetDate, { weekStartsOn: 0 })
  const sat = endOfWeek(targetDate, { weekStartsOn: 0 })
  
  return {
    start: format(sun, 'M/d'),
    end:   format(sat, 'M/d'),
    weekNum: getISOWeek(sun),
  }
}

/** 현재 주의 시작(일)~종료(토) 날짜 문자열 */
export const getCurrentWeekRange = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 })
  const end   = endOfWeek(new Date(), { weekStartsOn: 0 })
  return `${format(start, 'M/d')} ~ ${format(end, 'M/d')}`
}

/** TTS 제출 가능 여부 (상시 가능) */
export const canSubmitTTS = () => {
  return true
}
