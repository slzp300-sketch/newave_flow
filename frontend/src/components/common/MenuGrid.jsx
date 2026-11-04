import { Link } from 'react-router-dom'
import FeatureIcon from './FeatureIcon'
import FitLabel from './FitLabel'
import AttentionDot from './AttentionDot'
import { featureTone } from '../../utils/featureAppearance'

const STATE_LABELS = { unknown: '확인 필요', loading: '확인 중', saving: '저장 중', done: '완료', none: '' }
export default function MenuGrid({ items, states = {}, compact = false }) {
  return <div className={`home-menu-grid${compact ? ' home-management-grid' : ''}`}>
    {items.map(item => {
      const state = states[item.task] || 'none'
      const label = state === 'pending' ? item.pending : state === 'assigned' ? '이번 주 담당'
        : state === 'new' ? '새 일정' : STATE_LABELS[state]
      return <Link key={item.to} to={item.to} className="home-menu-card feature-menu-link brand-action motion-tap relative"
        data-menu-state={state} data-feature-tone={featureTone(item.to)}>
        <AttentionDot show={state === 'pending'} label="" />
        <span className="feature-menu-icon"><FeatureIcon path={item.to} size={23} /></span>
        <span className="home-menu-label"><FitLabel>{item.title}</FitLabel></span>
        {label && <span className="home-menu-status text-xs font-semibold leading-5">{label}</span>}
      </Link>
    })}
  </div>
}
