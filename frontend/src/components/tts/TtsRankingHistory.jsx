import { useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'
import { ttsApi } from '../../api/tts'
import { useMotionPreference } from '../common/Motion'
import { useAdminStatsReadState } from './AdminStatsNotice'
import { ttsAdminRefreshOptions } from '../../utils/ttsAdminRefresh'
import { rankingRecordWeeks, rankingWeekDetail, rankingDateLabel } from '../../utils/ttsRankingDetails'
import { quartersForYear } from '../../utils/ttsPeriod'

export default function TtsRankingHistory({ person, year, quarter, scope, onClose }) {
  const dialog = useRef(null)
  const [closing, setClosing] = useState(false)
  const reduced = useMotionPreference()
  const titleId = useId()
  const weeks = rankingRecordWeeks(person, year, quarter)
  const [chosen, setChosen] = useState(weeks[0]?.start ?? '')
  const selectedWeek = chosen === null ? null : weeks.find(week => week.start === chosen) ?? weeks[0]
  useEffect(() => {
    const previous = document.activeElement
    const position = { left: window.scrollX, top: window.scrollY, behavior: 'instant' }
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current.showModal()
    window.scrollTo(position)
    return () => {
      dialog.current?.close()
      document.body.style.overflow = priorOverflow
      window.scrollTo(position)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  const close = () => setClosing(true)
  return createPortal(<motion.dialog ref={dialog} className="tts-ranking-sheet" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => {
      const box = dialog.current.getBoundingClientRect()
      if (event.target === dialog.current && (event.clientY < box.top || event.clientX < box.left || event.clientX > box.right)) close()
    }}
    initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: closing ? 0 : 1, y: closing && !reduced ? 16 : 0 }}
    transition={{ duration: reduced ? .16 : .2, ease: 'easeOut' }} onAnimationComplete={() => { if (closing) onClose() }}>
    <div className="tts-ranking-sheet-handle" aria-hidden="true" />
    <header className="tts-ranking-sheet-heading">
      <div><h2 id={titleId}>{person.name}</h2><p>{year}년 {quarter}분기{person.rank != null && ` · ${person.rank}위 · ${person.total}점`}</p></div>
      <button type="button" className="tts-ranking-close" aria-label="체크 기록 닫기" onClick={close}><X size={22} /></button>
    </header>
    <div className="tts-ranking-sheet-body">
      {weeks.length ? <>

        {weeks.map(week => {
          const open = week.start === selectedWeek?.start
          const id = `${titleId}-${week.start}`
          return <section key={week.start} className="tts-ranking-week">
            <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setChosen(open ? null : week.start)}>
              <span>{rankingDateLabel(week.start).split(' (')[0]} ~ {rankingDateLabel(week.end).split(' (')[0]}</span>
              <ChevronDown size={17} className={open ? 'rotate-180' : ''} />
            </button>
            <AnimatePresence initial={false}>
              {open && <HistoryPanel key={id} id={id} reduced={reduced}><WeekRecord week={week} personKey={person.key} year={year} quarter={quarter} scope={scope} /></HistoryPanel>}
            </AnimatePresence>
          </section>
        })}

      </> : <p className="tts-ranking-empty">이 분기에 체크한 기록이 없습니다.</p>}
    </div>
  </motion.dialog>, document.body)
}

// A dialog scrolls independently: never use the page-level disclosure scroll coordinator here.
function HistoryPanel({ children, reduced, id }) {
  const present = useIsPresent()
  return <motion.div id={id} inert={present ? undefined : ''} aria-hidden={present ? undefined : true} className="overflow-hidden"
    initial={{ height: reduced ? 'auto' : 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
    exit={{ height: reduced ? 'auto' : 0, opacity: 0 }} transition={{ duration: reduced ? .16 : .28, ease: 'easeOut' }}>
    {children}
  </motion.div>
}

function WeekRecord({ week, personKey, year, quarter, scope }) {
  const range = quartersForYear(year).find(period => period.q === quarter)
  const query = useQuery({ queryKey: ['tts-week-stats', scope, year, quarter, personKey, week.start],
    ...ttsAdminRefreshOptions,
    queryFn: async ({ signal }) => rankingWeekDetail((await ttsApi.getWeekStats(week.year, week.weekNum, year, quarter, { signal })).data, personKey, week.start, range),
  })
  const state = useAdminStatsReadState(query)
  if (state !== 'ready') return <div className="tts-ranking-detail-notice" role={state === 'error' ? 'alert' : 'status'}>
    <p>{state === 'offline' ? '연결 대기 · 복구 후 자동 조회' : state === 'error' ? '체크 기록을 불러오지 못했습니다.' : '체크 기록을 확인하고 있습니다…'}</p>
    {state === 'error' && <button type="button" onClick={() => query.refetch()} disabled={query.isFetching}>다시 시도</button>}
  </div>
  const detail = query.data
  if (!detail) return <p className="tts-ranking-detail-notice">해당 주에 조회할 수 있는 기록이 없습니다.</p>
  if (detail.imported) return <p className="tts-ranking-detail-notice">시트 점수 · 날짜별 체크 기록 없음</p>
  const boundary = week.start < range.start || week.end > range.end
  return <>
    {boundary && <p className="tts-ranking-detail-notice">날짜별: 선택 분기 · 주간 항목: 해당 주 전체</p>}
    {detail.dates.map(row => <div className="tts-ranking-check-date" key={row.date}>
      <time dateTime={row.date}>{rankingDateLabel(row.date)}</time><span>{row.titles.join(' · ')}</span>
    </div>)}
    {detail.weeklyItems.length > 0 && <div className="tts-ranking-check-date"><span className="tts-ranking-weekly-label">{boundary ? '주간 전체' : '주간 체크'}</span><span>{detail.weeklyItems.join(' · ')}</span></div>}
    {!detail.dates.length && !detail.weeklyItems.length && <p className="tts-ranking-detail-notice">이 분기에 해당하는 체크 항목이 없습니다.</p>}
    {detail.saved && <p className="tts-ranking-saved">최근 저장 · {detail.saved}</p>}
  </>
}
