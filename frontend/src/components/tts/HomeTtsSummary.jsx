import { Check } from 'lucide-react'
import { AnimatedValue, ProgressFill } from '../common/Motion'

const shortTitle = (title = '') => title.replace(/\s*\([^)]*\)\s*$/, '')

// Uses the same current-week answers and score as the checklist, including pending saves.
export default function HomeTtsSummary({ score, maxScore, range, days, items, answers, onToggleDay, disabled = false }) {
  const ratio = maxScore > 0 ? Math.max(0, Math.min(score / maxScore, 1)) : 0
  const daily = items.filter(item => item.daily)
  const meetings = items.filter(item => !item.daily)
  return <section aria-label="이번 주 나의 영성 통계" className="mt-2 border-t border-primary-200 pt-2">
    <div className="flex flex-wrap items-center justify-between gap-1">
      <h3 className="brand-section-title text-sm font-semibold">이번 주 나의 기록</h3>
      <span className="text-xs text-gray-500">{range}</span>
    </div>
    <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
      <p className="text-primary-800"><strong className="ui-stat-value"><AnimatedValue value={score} /></strong><span className="ml-1 text-xs text-gray-500">/ {maxScore}점</span></p>
      <p className="text-right text-xs text-gray-500">주간 달성률 <strong className="ml-1 text-base font-semibold tabular-nums text-secondary-700">{maxScore > 0 ? `${Math.round(ratio * 100)}%` : '—'}</strong></p>
    </div>
    <div role="progressbar" aria-label="이번 주 전체 목표 대비 점수" aria-valuemin={0} aria-valuemax={maxScore || 1} aria-valuenow={score}
      aria-valuetext={maxScore > 0 ? `${maxScore}점 중 ${score}점` : '등록된 배점 없음'} className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary-100">
      <ProgressFill ratio={ratio} className="bg-secondary-600" />
    </div>
    <div className="mt-3 space-y-3">
      {daily.map(({ q, done, total }) => <div key={q.id}>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
          <p className="font-semibold break-keep">{shortTitle(q.title)}</p>
          <p className="shrink-0 text-gray-500"><strong className="text-sm text-primary-800 tabular-nums">{done}</strong> / {total}일</p>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {days.map(({ day, date, future, today, locked }) => {
            const checked = answers[q.id]?.[day] === true
            const state = future ? '예정' : locked ? '마감' : checked ? '체크됨' : '미체크'
            return <button key={day} type="button" title={`${date} ${day} · ${state}`} aria-label={`${q.title} ${date} ${day}${today ? ', 오늘' : ''}${future ? ', 예정' : locked ? ', 마감' : ''}`}
              aria-pressed={checked} disabled={disabled || future || locked || !onToggleDay} onClick={() => onToggleDay?.(q, day)}
              className={`motion-tap flex min-h-11 items-center justify-center gap-0.5 rounded-lg border text-xs disabled:opacity-50 ${checked ? 'border-primary-600 bg-primary-600 text-white' : future ? 'border-gray-200 border-dashed text-gray-400' : 'border-primary-200 bg-white text-primary-700'} ${today ? 'ring-1 ring-primary-600 ring-offset-1' : ''}`}>
              <span aria-hidden="true">{day}</span>{checked ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">{future ? '·' : '—'}</span>}
            </button>
          })}
        </div>
      </div>)}
    </div>
    {meetings.length > 0 && <ul aria-label="이번 주 예배와 모임 기록" className="mt-3 flex flex-wrap gap-1.5">
      {meetings.map(({ q, done }) => <li key={q.id} className={`rounded-lg border px-2 py-1.5 text-xs ${done ? 'border-secondary-200 bg-secondary-50 text-secondary-800' : 'border-primary-200 text-primary-800'}`}>
        {shortTitle(q.title)} <strong>{q.linkType && q.linkType !== 'NONE'
          ? done ? (q.linkType === 'PRAYER_MEETING' ? '참석 투표 반영' : '참석 체크 반영') : '참석 미반영'
          : done ? '✓ 참여 완료' : '미체크'}</strong>
      </li>)}
    </ul>}
    {!items.length && <p className="mt-2 text-xs text-gray-500">등록된 체크 항목이 없습니다.</p>}
  </section>
}
