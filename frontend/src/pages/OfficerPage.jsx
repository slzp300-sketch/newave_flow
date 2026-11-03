import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import SegmentedControl from '../components/common/SegmentedControl'
import FeatureIcon from '../components/common/FeatureIcon'
import StatSummary from '../components/common/StatSummary'
import OfficerOrganization from '../components/officers/OfficerOrganization'
import useOfficerAccess from '../hooks/useOfficerAccess'
import useManagementMenuGroups from '../hooks/useManagementMenuGroups'
import { officerDuties } from '../utils/officers'
import { weeklyReportsApi } from '../api/weeklyReports'
import { getWeekStartByOffset, toApiDate } from '../utils/date'
import './OfficerPage.css'

export default function OfficerPage() {
  const access = useOfficerAccess(), groups = useManagementMenuGroups()
  const [params, setParams] = useSearchParams()
  const view = ['organization', 'management'].includes(params.get('view')) ? params.get('view') : 'mine'
  return <div className="officer-page"><Header title="임원 업무" showBack /><main className="officer-body">
    {access.isError ? <div className="officer-notice" role="alert">권한을 확인하지 못했습니다.<Button size="sm" onClick={() => access.refetch()}>다시 확인</Button></div> : !access.data ? <p role="status">불러오는 중…</p> : !access.data.canManage ? <p role="alert">임원만 이용할 수 있습니다.</p> : <>
      <div className="officer-identity"><strong>{access.data.offices.map(o => o.label).join(' · ') || '임원 공통 업무'}</strong><span>{access.data.activeYear}년</span></div>
      <SegmentedControl label="임원 업무 화면" value={view} onChange={next => setParams(next === 'mine' ? {} : { view: next })} options={[{ value: 'mine', label: '내 업무' }, { value: 'management', label: '공통 관리' }, { value: 'organization', label: '조직도' }]} />
      {view === 'organization' ? <OfficerOrganization access={access.data} /> : view === 'management' ? <>{groups.filter(g => g.title !== '담당 업무').map(group => <section key={group.title}><h2 className="ui-section-title">{group.title}</h2><OfficerLinks items={group.items.filter(i => !i.to.startsWith('/officers'))} /></section>)}</> : <OfficerDuties access={access.data} />}
    </>}
  </main></div>
}
export function OfficerLinks({ items }) {
  return <div className="officer-grid">{items.map(item => <Link className="officer-link brand-action motion-tap" to={item.to} key={item.to}><FeatureIcon path={item.to.split('?')[0]} size={19} /><span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span><span aria-hidden="true">›</span></Link>)}</div>
}
function OfficerDuties({ access }) {
  const date = toApiDate(getWeekStartByOffset(0, 0))
  const summary = useQuery({ queryKey: ['officer-attendance', date], queryFn: () => weeklyReportsApi.attendance(date).then(r => r.data) })
  const duties = officerDuties(access)
  const pending = summary.data?.classes.filter(c => !c.submitted || c.changed).length
  return <>
    <section><div className="officer-row"><h2 className="ui-section-title">이번 주</h2><Link className="officer-text-link" to="/admin/attendance">출석 현황 ›</Link></div>
      {summary.isError ? <div className="officer-notice" role="alert">출석 현황을 불러오지 못했습니다.<Button size="sm" variant="secondary" onClick={() => summary.refetch()}>다시 확인</Button></div> : <StatSummary label="이번 주 제출 현황" items={[{ label: '반·팀 미제출', value: pending ?? '—', unit: '건' }, { label: '교사 미확인', value: summary.data?.teachers.filter(t => t.status === 'UNKNOWN').length ?? '—' }]} />}
    </section>
    <section><h2 className="ui-section-title">내 담당 업무</h2>{duties.length ? <OfficerLinks items={duties} /> : <p className="officer-meta">공통 관리에서 업무를 확인하세요.</p>}</section>
    <OfficerLinks items={[{ to: '/officers?view=management', title: '공통 관리' }, { to: '/officers?view=organization', title: '임원 조직도' }]} />
  </>
}
