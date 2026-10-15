import { useState } from 'react'
import SearchField from '../components/common/SearchField'
import { AdminIntro, AdminEmpty, FilterResults } from '../components/common/AdminTools'
import { filterMenuGroups } from '../utils/navigation'
import { Reveal } from '../components/common/Motion'
import { Link } from 'react-router-dom'
import { FileText, CheckSquare, UserCog } from 'lucide-react'
import Header from '../components/layout/Header'
import FeatureIcon from '../components/common/FeatureIcon'
import SafetySummary from '../components/common/SafetySummary'

export const MENU_GROUPS = [
  {
    title: '회원 및 조직 관리',
    icon: UserCog,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '신규가입, 권한, 반 배정, 제적 관리',
    items: [
      { to: '/admin/content-reports', title: '신고 관리', desc: '콘텐츠·사용자 신고 검토와 보호 조치' },
      { to: '/admin/content-photos', title: '사진 게시 검토', desc: '새 사진의 게시 승인·거절' },
      { to: '/admin/pending-users', title: '가입 승인·이용 정지', desc: '신규 가입 승인과 정지 계정 확인' },
      { to: '/admin/teachers', title: '교사 권한 관리', desc: '일반/임원 교사 권한 부여 및 관리' },
      { to: '/admin/class-assignment', title: '반 담임/부담임 배정', desc: '가입된 교사를 학년/반에 배정' },
      { to: '/admin/students', title: '아이 관리', desc: '전체 아이 명단 및 반 배정 관리' },
      { to: '/admin/deactivation-requests', title: '제적 승인 관리', desc: '교사가 신청한 제적 요청 검토' },
    ]
  },
  {
    title: '모임 및 회의 관리',
    icon: FileText,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '기도모임, 교사회의, 회의록, 일정',
    items: [
      { to: '/admin/prayer', title: '기도모임 관리', desc: '불참 명단 및 필사 제출 현황' },
      { to: '/admin/meeting-attendance', title: '교사회의 관리', desc: '토요일 교사회의 참석 현황' },
      { to: '/admin/minutes', title: '회의록 관리', desc: '교사 회의록 작성 및 공개 설정' },
      { to: '/admin/calendar', title: '일정 관리', desc: '월별 부서 일정 등록 및 수정' },
    ]
  },
  {
    title: '출석 및 활동 관리',
    icon: CheckSquare,
    color: 'text-primary-600',
    bg: 'bg-primary-50',
    desc: '주간 출석, 행사 출석, TTS, 전도 관리',
    items: [
      { to: '/admin/student-attendance', title: '출석 관리', desc: '주차별 학년/반/학생 출석 현황 확인' },
      { to: '/admin/event-attendance', title: '행사 출석 관리', desc: '행사별 반 학생 출석 현황 확인' },
      { to: '/admin/tts', title: 'TTS 점검 관리', desc: '주간 TTS 질문 항목 및 제출 현황' },
      { to: '/admin/evangelism', title: '전도 관리', desc: '전도 조 편성 및 일정 관리' },
    ]
  }
]

export default function AdminDashboard() {
  const [search, setSearch] = useState('')
  const groups = filterMenuGroups(MENU_GROUPS, search)
  const count = groups.reduce((sum, group) => sum + group.items.length, 0)
  return <div className="flex min-h-screen flex-col bg-gray-50/50 pb-10">
    <Header title="관리자 메뉴" showBack />
    <div className="flex flex-col gap-5 px-4 py-5">
      <AdminIntro title="관리할 업무를 찾아보세요" description="회원과 반 배정부터 출석·활동 기록까지 한곳에서 관리합니다." />
      <SafetySummary />
      <SearchField label="관리자 메뉴 검색" value={search} onChange={setSearch} placeholder="교사, 출석, TTS 등 메뉴 검색" />
      {search.trim() && <FilterResults count={count} total={MENU_GROUPS.reduce((n, group) => n + group.items.length, 0)} unit="개" filtered onReset={() => setSearch('')} />}
      {!count && <AdminEmpty />}
      {groups.map((group, idx) => <Reveal key={group.title} delay={idx * 0.04}>
        <section className="brand-card overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-50 px-4 py-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${group.bg}`}>
              <group.icon size={19} className={group.color} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-900">{group.title}</h2>
              <p className="mt-1 text-xs text-gray-500">{group.desc}</p>
            </div>
            <span className="text-xs text-gray-400">{group.items.length}</span>
          </div>
          <div className="divide-y divide-gray-50 px-2">
            {group.items.map(item => <Link key={item.to} to={item.to}
              className="brand-action motion-tap flex min-h-20 items-center gap-3 rounded-2xl px-3 py-3.5 hover:bg-gray-50">
              <span className="brand-action-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <FeatureIcon path={item.to} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.desc}</p>
              </div>
              <span aria-hidden="true" className="text-xl text-gray-300">›</span>
            </Link>)}
          </div>
        </section>
      </Reveal>)}
    </div>
  </div>
}
