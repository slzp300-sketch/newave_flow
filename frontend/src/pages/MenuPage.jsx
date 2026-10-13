import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Reveal } from '../components/common/Motion'
import FeatureIcon from '../components/common/FeatureIcon'
import { ChevronRight, SearchX } from 'lucide-react'
import Header from '../components/layout/Header'
import useAuthStore from '../store/authStore'
import { MENU_GROUPS } from './AdminDashboard'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { filterMenuGroups } from '../utils/navigation'
import useWeeklyTasks from '../hooks/useWeeklyTasks'
import useWeeklyEvents from '../hooks/useWeeklyEvents'
import useTtsAttention from '../hooks/useTtsAttention'
import AttentionDot from '../components/common/AttentionDot'

const COMMON_GROUPS = [
  {
    title: '주간 체크',
    items: [
      { to: '/checklist',      title: '주간 체크 현황' },
      { to: '/attendance',     title: '출석' },
      { to: '/tts',            title: 'TTS' },
      { to: '/meeting/prayer', title: '기도모임 투표' },
      { to: '/meeting/sat',    title: '교사회의 체크' },
    ],
  },
  {
    title: '모임 및 일정',
    items: [
      { to: '/events',        title: '행사일정' },
      { to: '/minutes',       title: '회의록 및 영상' },
      { to: '/evangelism',    title: '전도 로테이션' },
      { to: '/notifications', title: '알림' },
    ],
  },
  {
    title: '학생 및 반 관리',
    items: [
      { to: '/roster',           title: '교적부' },
      { to: '/class-manage',     title: '반관리' },
      { to: '/event-attendance', title: '행사 출석 체크' },
    ],
  },
]

const ADMIN_ROLES = ['ADMIN', 'PASTOR', 'EXECUTIVE']

const DESCRIPTIONS = {
  '/checklist': '이번 주 제출할 항목을 한눈에',
  '/attendance': '우리 반 주일 출석과 결석 사유',
  '/tts': '매일 영성 체크 · 주간 및 분기 통계',
  '/meeting/prayer': '온라인 기도모임 참석 여부',
  '/meeting/sat': '토요일 교사회의 참석 기록',
  '/events': '달력과 목록으로 보는 교회 일정',
  '/minutes': '회의 내용과 영상 확인',
  '/evangelism': '이번 주 전도 담당과 순서',
  '/notifications': '새 소식과 확인할 알림',
  '/roster': '학년·반별 학생 명단과 정보',
  '/class-manage': '우리 반 학생과 담당 교사',
  '/event-attendance': '내 출석과 우리 반 행사 참석 기록',
}

export default function MenuPage() {
  const { user } = useAuthStore()
  const tasks = useWeeklyTasks()
  const schedule = useWeeklyEvents()
  const tts = useTtsAttention()
  const attention = path => path === '/tts' ? tts.pending : path === '/events' ? schedule.hasNew
    : path === '/checklist' ? tasks.tasks.some(t => t.state === 'pending') : tasks.needsAction(path)
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('personal')
  const canManage = ADMIN_ROLES.includes(user?.role)
  const common = COMMON_GROUPS.map(g => ({ ...g, items: g.items.map(i => ({ ...i, desc: DESCRIPTIONS[i.to] })) }))
  const groups = canManage ? [...common, ...MENU_GROUPS.map(g => ({ ...g, title: `관리 · ${g.title}`, admin: true }))] : common
  const visibleGroups = filterMenuGroups(groups, search, canManage ? scope : 'all')
  const count = visibleGroups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="전체 메뉴" />
      <div className="sticky top-14 z-20 border-b border-gray-200 bg-white px-4 pb-4 pt-3 space-y-3">
        <SearchField label="메뉴 검색" value={search} onChange={setSearch} placeholder="어떤 기능을 찾으세요?" />
        {canManage && <SegmentedControl label="메뉴 범위" value={scope} onChange={setScope}
          options={[{ value: 'personal', label: '나의 활동' }, { value: 'admin', label: '관리' }]} />}
      </div>
      <div className="px-4 py-5 space-y-6">
        {search && <p role="status" className="text-sm text-gray-500">검색 결과 <strong className="text-gray-900">{count}개</strong></p>}
        {visibleGroups.map((group, gi) => (
          <Reveal key={group.title} delay={Math.min(gi * 0.04, 0.12)}>
            <h2 className="ui-section-title mb-3 px-1">{group.title}</h2>
            <div className="ui-list">
              {group.items.map(item => (
                <Link key={item.to} to={item.to} className="brand-action ui-list-row motion-tap relative">
                  <AttentionDot show={attention(item.to)} label={item.to === '/events' ? '이번 주 새 일정이 있어요' : '해야 할 일이 있어요'} />
                  <span className="brand-action-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"><FeatureIcon path={item.to} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-900">{item.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">{item.desc}</span></span>
                  <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-gray-400" />
                </Link>
              ))}
            </div>
          </Reveal>
        ))}
        {!count && <div className="brand-card rounded-2xl border border-gray-200 bg-white px-5 py-10 text-center">
          <SearchX size={28} className="mx-auto mb-3 text-gray-400" />
          <p className="font-semibold">검색 결과가 없어요</p>
          <p className="mt-2 text-sm text-gray-500">{canManage ? '다른 단어나 메뉴 범위로 다시 찾아보세요.' : '다른 단어로 다시 찾아보세요.'}</p>
          <button type="button" className="mt-4 min-h-11 rounded-full bg-primary-50 px-5 text-sm font-semibold text-primary-700"
            onClick={() => setSearch('')}>검색 초기화</button>
        </div>}
      </div>
    </div>
  )
}
