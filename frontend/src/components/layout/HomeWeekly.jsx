import { Link } from 'react-router-dom'
import useWeeklyTasks from '../../hooks/useWeeklyTasks'
import AttentionDot from '../common/AttentionDot'
import FeatureIcon from '../common/FeatureIcon'
import QueryNotice from '../common/QueryNotice'

const LABELS = { done: '완료', pending: '미완료', unknown: '확인 필요', none: '대상 없음' }

export default function HomeWeekly() {
  const { tasks, reads } = useWeeklyTasks()
  const failed = reads.filter(q => q.isError || q.fetchStatus === 'paused')
  return <section aria-label="이번 주 할 일">
    <div className="flex items-center justify-between mb-2">
      <h2 className="brand-section-title text-base font-semibold">이번 주 할 일</h2>
      <Link to="/checklist" className="brand-action flex min-h-11 items-center rounded-lg px-3 text-sm">전체 보기</Link>
    </div>
    {!!failed.length && <QueryNotice queries={failed} label="할 일 현황" />}

    <div className="grid grid-cols-2 gap-2.5">
      {tasks.map(task => <Link key={task.id} to={task.path}
        className="brand-action motion-tap relative flex flex-col items-start gap-2 rounded-2xl border border-primary-200 p-4">
        <AttentionDot show={task.state === 'pending'} label="아직 제출하지 않았어요" />
        <FeatureIcon path={task.path} />
        <span className="text-sm font-semibold break-keep">{task.title}</span>
        <span className="text-xs text-gray-500 break-keep">{task.desc}</span>
        <span className="mt-auto text-xs font-medium">{LABELS[task.state]}</span>
      </Link>)}
    </div>
  </section>
}
