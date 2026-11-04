import { useState } from 'react'
import SearchField from './SearchField'
import MenuGrid from './MenuGrid'
import { Reveal } from './Motion'
import { filterMenuGroups } from '../../utils/navigation'

export default function ManagementMenu({ groups, action }) {
  const [search, setSearch] = useState('')
  const visible = filterMenuGroups(groups, search)
  const count = visible.reduce((sum, group) => sum + group.items.length, 0)
  return <div className="management-menu space-y-5">
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1"><SearchField label="관리 메뉴 검색" value={search} onChange={setSearch} placeholder="출석, 교사, 찬양팀 검색" /></div>
      {action}
    </div>
    {search.trim() && <div className="flex items-center justify-between gap-2 text-sm">
      <p role="status">검색 결과 <strong>{count}개</strong></p>
      <button type="button" className="min-h-11 rounded-xl px-3 font-semibold" onClick={() => setSearch('')}>검색 초기화</button>
    </div>}
    {visible.map((group, index) => <Reveal key={group.title} delay={index * .025}>
      <section className="home-management-section" data-feature-tone={group.tone} aria-label={`관리 · ${group.title}`}>
        <h2 className="home-group-title">{group.title}</h2>
        <MenuGrid items={group.items} compact />
      </section>
    </Reveal>)}
    {!count && <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">찾는 메뉴가 없습니다.</p>}
  </div>
}
