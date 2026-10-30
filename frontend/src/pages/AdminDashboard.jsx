import { useState } from 'react'
import SearchField from '../components/common/SearchField'
import { AdminIntro } from '../components/common/AdminTools'
import { filterMenuGroups } from '../utils/navigation'
import { Reveal } from '../components/common/Motion'
import { Link } from 'react-router-dom'
import { MENU_GROUPS } from '../utils/menuGroups'
export { MENU_GROUPS } from '../utils/menuGroups'
import AdminOverview from './AdminOverview'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'
import FitLabel from '../components/common/FitLabel'
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
      <AdminIntro title="관리 메뉴" />
      <SearchField label="관리자 메뉴 검색" value={search} onChange={setSearch} placeholder="교사, 출석, TTS 검색" />
      {search.trim() && <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p role="status" className="text-gray-600">검색 결과 <strong className="text-gray-900">{count}개</strong></p>
        <button type="button" onClick={() => setSearch('')} className="min-h-11 rounded-xl px-3 font-semibold text-primary-700">검색 초기화</button>
      </div>}
      {!count && <div className="brand-card rounded-2xl bg-white px-5 py-8 text-center">
        <p className="text-base font-semibold text-gray-900">찾는 메뉴가 없습니다</p>

      </div>}
      {groups.map((group, idx) => <Reveal key={group.title} delay={idx * 0.04}>
        <section className="brand-card overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-50 px-4 py-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${group.bg}`}>
              <group.icon size={19} className={group.color} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-snug text-gray-900">{group.title}</h2>
            </div>
            <span className="shrink-0 text-sm text-gray-600">{group.items.length}개</span>
          </div>
          <div className="divide-y divide-gray-50 px-2">
            {group.items.map(item => <Link key={item.to} to={item.to}
              className="brand-action motion-tap flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 hover:bg-gray-50">
              <span className="brand-action-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <FeatureIcon path={item.to} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-gray-900"><FitLabel>{item.title}</FitLabel></p>
              </div>
              <span aria-hidden="true" className="shrink-0 text-xl text-gray-500">›</span>
            </Link>)}
          </div>
        </section>
      </Reveal>)}
    </div>
  </div>
}
