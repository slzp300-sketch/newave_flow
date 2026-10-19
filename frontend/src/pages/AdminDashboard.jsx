import { useState } from 'react'
import SearchField from '../components/common/SearchField'
import { AdminIntro, AdminEmpty, FilterResults } from '../components/common/AdminTools'
import { filterMenuGroups } from '../utils/navigation'
import { Reveal } from '../components/common/Motion'
import { Link } from 'react-router-dom'
import { MENU_GROUPS } from '../utils/menuGroups'
export { MENU_GROUPS } from '../utils/menuGroups'
import AdminOverview from './AdminOverview'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'
import FeatureIcon from '../components/common/FeatureIcon'

export default function AdminDashboard() {
  const user = useAuthStore(s => s.user)
  const [search, setSearch] = useState('')
  const groups = filterMenuGroups(MENU_GROUPS, search)
  const count = groups.reduce((sum, group) => sum + group.items.length, 0)
  return <div className="flex min-h-screen flex-col bg-gray-50/50 pb-10">
    <Header title="관리자 메뉴" showBack />
    <div className="flex flex-col gap-5 px-4 py-5">
      {!search && ['ADMIN', 'PASTOR'].includes(user?.role) && <AdminOverview />}
      <AdminIntro title="관리할 업무를 찾아보세요" description="회원과 반 배정부터 출석·활동 기록까지 한곳에서 관리합니다." />
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
