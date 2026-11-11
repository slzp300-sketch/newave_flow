import Button from '../common/Button'
import DisclosureSummary from '../common/DisclosureSummary'
import { reportIssueTarget } from '../../utils/reportIssues'

const groups = { class:'반·새가족팀', teacher:'교사 출석', common:'공통 항목', roster:'명단·배정', 'new-family':'새가족팀' }
export default function ReportIssues({ issues, date, busy, canNewFamily, onSelect }) {
  if (!issues.length) return <p role="status" className="wr-success">누락 항목이 없습니다.</p>
  const sections = { ...groups, ...Object.fromEntries(issues.filter(i => !groups[i.area]).map(i => [i.area, '기타 항목'])) }
  return <details className="wr-issues"><DisclosureSummary>누락·수정 {issues.length}건</DisclosureSummary>
    <div className="wr-issue-groups">{Object.entries(sections).map(([area,label]) => {
      const rows = issues.filter(issue => issue.area === area)
      return rows.length > 0 && <section key={area} aria-label={label+' 보완'}><h3>{label} <span>{rows.length}</span></h3>
        <ul>{rows.map((issue,index) => {
          const target = reportIssueTarget(issue,date)
          const restricted = target?.kind === 'new-family' && !canNewFamily
          return <li key={`${issue.targetId}:${index}`}><span>{issue.message}</span>{target && (restricted ? <small>새가족팀 확인 필요</small> :
            <Button size="sm" variant="secondary" disabled={busy} aria-label={`보완하기: ${issue.message}`} onClick={() => onSelect(target)}>보완하기</Button>)}</li>
        })}</ul>
      </section>
    })}</div>
  </details>
}
