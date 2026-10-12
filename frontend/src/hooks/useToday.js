import { useEffect, useState } from 'react'
import { toApiDate } from '../utils/date'

export default function useToday(dateOf = toApiDate) {
  const [today, setToday] = useState(dateOf)
  useEffect(() => {
    const update = () => setToday(dateOf())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [dateOf])
  return today
}
