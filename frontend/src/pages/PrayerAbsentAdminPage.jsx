import GradeLabel from '../components/common/GradeLabel'
import FitLabel from '../components/common/FitLabel'
import './PrayerAbsentAdminPage.css'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import AdminReadGuard from '../components/common/AdminReadGuard'
import { queryReadState } from '../utils/queryReadState'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, Clock, Users, Loader2 } from 'lucide-react'
import Header from '../components/layout/Header'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Card from '../components/common/Card'
import { prayerVoteApi } from '../api/prayerVote'
import { formatUpdatedAt } from '../utils/date'
import { format, addDays } from 'date-fns'

function getThisWeekMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

function getPastMondays(count = 8) {
  const mondays = []
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(now)
  thisMonday.setDate(now.getDate() + diff)
  for (let i = 0; i < count; i++) {
    const d = new Date(thisMonday)
    d.setDate(thisMonday.getDate() - i * 7)
    mondays.push(format(d, 'yyyy-MM-dd'))
  }
  return mondays
}

function ScriptureControl({ vote, pending, disabled, onToggle }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <span className={`flex items-start gap-2 text-sm font-bold ${vote.scriptureCopySubmitted ? 'text-secondary-800' : 'text-amber-800'}`}>
      {vote.scriptureCopySubmitted ? <CheckCircle2 size={18} aria-hidden="true" /> : <Clock size={18} aria-hidden="true" />}
      <span>{vote.scriptureCopySubmitted ? '필사 제출 완료' : '필사 미제출'}</span>
    </span>
    <button type="button" aria-pressed={!!vote.scriptureCopySubmitted} aria-busy={pending}
      aria-label={`${vote.teacherName} 필사 제출 확인`} disabled={disabled} onClick={onToggle}
      className="flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-primary-200 bg-white px-3 py-3 text-base font-semibold text-primary-800 disabled:opacity-60">
      {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
      <FitLabel>{pending ? '저장 중' : vote.scriptureCopySubmitted ? '확인 취소하기' : '제출 확인하기'}</FitLabel>
    </button>
  </div>
}

export default function PrayerAbsentAdminPage() {
  const [viewMode, setViewMode] = useViewMode('admin-prayer-absent', 'large')
  const [search, setSearch] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(getThisWeekMonday())
  const [activeGrade, setActiveGrade] = useState('전체')
  const [statusFilter, setStatusFilter] = useState('전체') // '전체' | '미제출' | '제출완료'
  const queryClient = useQueryClient()
  const weeks = getPastMondays()

  const absentQuery = useQuery({
    queryKey: ['prayer-absent', selectedWeek],
    queryFn: () => prayerVoteApi.getAbsentList(selectedWeek).then(r => r.data),
    refetchOnWindowFocus: 'always', // 교사가 투표를 고치면 바로 반영
  })
  const { data: absentList = [], isLoading } = absentQuery

  const toggleMutation = useMutation({
    mutationFn: ({ id, submitted }) => prayerVoteApi.toggleScripture(id, submitted).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayer-absent', selectedWeek] }),
    onError: err => alert(err.response?.data?.message || '필사 제출 상태를 변경하지 못했습니다. 다시 시도해 주세요.'),
  })

  const renderScriptureControl = vote => <ScriptureControl vote={vote}
    pending={toggleMutation.isPending && toggleMutation.variables?.id === vote.id}
    disabled={toggleMutation.isPending || queryReadState([absentQuery]) !== 'ready'}
    onToggle={() => toggleMutation.mutate({ id: vote.id, submitted: !vote.scriptureCopySubmitted })} />

  const GRADE_ORDER = ['전체', '유치', '초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3', '미분류']

  const filteredList = absentList.filter(v => {
    const gradeMatch = activeGrade === '전체' || (v.teacherGrade || '미분류') === activeGrade
    const statusMatch = statusFilter === '전체' || 
      (statusFilter === '미제출' && !v.scriptureCopySubmitted) ||
      (statusFilter === '제출완료' && v.scriptureCopySubmitted)
    return gradeMatch && statusMatch && matchesAdminSearch(search, v.teacherName, v.teacherGrade)
  })

  const grouped = {}
  filteredList.forEach(v => {
    const g = v.teacherGrade || '미분류'
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(v)
  })

  const sortedGrades = Object.keys(grouped).sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a); const bi = GRADE_ORDER.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="admin-prayer-page flex flex-col min-h-screen pb-10">
      <Header title="기도모임 불참 관리" showBack />

      <div className="px-4 py-5 flex flex-col gap-6">

        <h2 className="text-lg font-bold text-gray-900">불참 명단 · 필사 제출</h2>
        {/* 주차 선택 */}
        <section>
          <p className="text-sm font-bold text-gray-600 px-1 mb-2">조회 주차</p>
          <select aria-label="기도모임 조회 주차"
            disabled={toggleMutation.isPending}
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-base font-bold text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-primary-200"
          >
            {weeks.map(w => (
              <option key={w} value={w}>{format(new Date(w + 'T00:00:00'), 'yyyy. M. d.')} ~ {format(addDays(new Date(w + 'T00:00:00'), 6), 'M. d.')}</option>
            ))}
          </select>
        </section>

        <AdminReadGuard queries={[absentQuery]} label="기도모임 불참 명단">
        {/* 필터 섹션 */}
        <section className="flex flex-col gap-3">
          {/* 학년 필터 */}
          <div className="flex flex-wrap gap-2 py-1">
            {GRADE_ORDER.filter(g => g === '전체' || absentList.some(v => (v.teacherGrade || '미분류') === g)).map(g => (
              <button
                key={g}
                aria-pressed={activeGrade === g}
                onClick={() => setActiveGrade(g)}
                className={`min-w-0 max-w-full min-h-11 px-4 py-2 rounded-xl text-base font-bold transition-all ${
                  activeGrade === g
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}
              >
                <FitLabel><GradeLabel value={g} /></FitLabel>
              </button>
            ))}
          </div>

          <SegmentedControl label="필사 제출 상태" value={statusFilter} onChange={setStatusFilter} selectedClassName="text-primary-600"
            options={['전체', '미제출', '제출완료'].map(value => ({ value, label: value === '제출완료' ? '제출 완료' : value }))} />
          <SearchField label="기도모임 불참 교사 검색" value={search} onChange={setSearch} placeholder="교사 이름 또는 학년 검색" />
          <FilterResults count={filteredList.length} total={absentList.length} filtered={!!search.trim() || activeGrade !== '전체' || statusFilter !== '전체'} onReset={() => { setSearch(''); setActiveGrade('전체'); setStatusFilter('전체') }} />
        </section>

        {/* 통계 */}
        <section aria-label="기도모임 불참 요약" className="grid grid-cols-2 gap-3">
          <Card className="text-center py-4 border-red-50 bg-red-50/30">
            <p className="text-2xl font-bold text-red-700">{absentList.length}</p>
            <div className="text-sm font-semibold text-gray-600 mt-1"><FitLabel>총 불참 인원</FitLabel></div>
          </Card>
          <Card className="text-center py-4 border-amber-50 bg-amber-50/30">
            <p className="text-2xl font-bold text-amber-800">
              {absentList.filter(v => !v.scriptureCopySubmitted).length}
            </p>
            <div className="text-sm font-semibold text-gray-600 mt-1"><FitLabel>필사 미제출</FitLabel></div>
          </Card>
        </section>

        {/* 불참 목록 */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-3">
            <p className="text-sm font-bold text-gray-600">불참 교사 명단</p>
            <p className="text-sm font-bold text-primary-700">{filteredList.length}명</p>
            <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-primary-300" /></div>
          ) : filteredList.length === 0 ? (
            <Card className="py-16 text-center flex flex-col items-center gap-3">
              <Users size={32} className="text-gray-100" />
              <p className="text-base font-semibold text-gray-600">{absentList.length ? '조건에 맞는 결과가 없습니다' : '이 주의 불참자가 없습니다'}</p>
            </Card>
          ) : (
            <div className="admin-prayer-records"><RecordViews mode={viewMode} rows={filteredList} columns={[
              { label: '교사', render: vote => vote.teacherName },
              { label: '학년', render: vote => vote.teacherGrade || '미분류' },
              { label: '불참 사유', render: vote => vote.reason },
              { label: '마지막 수정', render: vote => formatUpdatedAt(vote.updatedAt) },
              { label: '필사 확인 일시', render: vote => formatUpdatedAt(vote.scriptureCopySubmittedAt) },
              { label: '필사 제출', action: true, render: renderScriptureControl },
            ]}>
            <div className="flex flex-col gap-6">
              {sortedGrades.map(grade => (
                <div key={grade} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 px-1">
                    <span className="w-1 h-3 bg-primary-400 rounded-full" />
                    <p className="text-lg font-bold text-gray-900"><GradeLabel value={grade} /></p>
                    <span className="text-sm text-gray-600 font-semibold">{grouped[grade].length}명</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {grouped[grade].map((vote, idx) => (
                      <motion.div
                        key={vote.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Card className={`flex flex-col gap-3 transition-all ${
                          !vote.scriptureCopySubmitted ? 'border-amber-200 ring-2 ring-amber-50' : 'border-gray-100'
                        }`}>
                          <div className="flex min-w-0 items-start gap-3">
                            <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-base font-bold text-gray-700">{vote.teacherName?.[0]}</div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base font-bold text-gray-900 leading-relaxed">{vote.teacherName}</p>
                              <p className="mt-0.5 text-sm text-gray-600 leading-relaxed">{vote.teacherGrade || '미분류'}</p>
                            </div>
                          </div>
                          <div><span className="inline-flex max-w-full rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-bold text-red-700">불참</span></div>
                          {vote.reason && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"><span className="font-bold">불참 사유</span> · {vote.reason}</p>}
                          {vote.updatedAt && <p className="text-sm text-gray-600 leading-relaxed">마지막 수정 · {formatUpdatedAt(vote.updatedAt)}</p>}
                          <div className="border-t border-gray-200 pt-3">{renderScriptureControl(vote)}</div>
                          {vote.scriptureCopySubmittedAt && <p className="text-sm text-gray-600 leading-relaxed">필사 확인 · {formatUpdatedAt(vote.scriptureCopySubmittedAt)}</p>}
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </RecordViews></div>
          )}
        </div>

        </AdminReadGuard>
      </div>
    </div>
  )
}
