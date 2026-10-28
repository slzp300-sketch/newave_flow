import FitLabel from '../components/common/FitLabel'
import './MeetingMinutesAdminPage.css'
import { Collapse, CollapsePanel } from '../components/common/Motion'
import SearchField from '../components/common/SearchField'
import SegmentedControl from '../components/common/SegmentedControl'
import { FilterResults } from '../components/common/AdminTools'
import { matchesAdminSearch } from '../utils/adminSearch'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, CheckCircle2, XCircle, Play, Users, PenLine, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ViewModeToggle, { useViewMode } from '../components/common/ViewModeToggle'
import RecordViews from '../components/common/RecordViews'
import Button from '../components/common/Button'
import { formatDate, toApiDate } from '../utils/date'
import client from '../api/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function MeetingMinutesAdminPage() {
  const [viewMode, setViewMode] = useViewMode('admin-minutes', 'large')
  const [statusView, setStatusView] = useViewMode('admin-minute-status', 'large')
  const [search, setSearch] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [loadError, setLoadError] = useState(false)
  const [minutes, setMinutes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const statusRequest = useRef(0)
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    videoLink: '',
    meetingDate: toApiDate(new Date()),
    isActive: true
  })

  useEffect(() => {
    fetchMinutes()
  }, [])

  const fetchMinutes = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await client.get('/minutes')
      setMinutes(res.data)
    } catch (err) {
      console.error('회의록 조회 실패:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title || !formData.content) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    try {
      setSubmitting(true)
      if (editingId) {
        await client.put(`/minutes/${editingId}`, formData)
        alert('회의록이 수정되었습니다.')
      } else {
        await client.post('/minutes', formData)
        alert('회의록이 등록되었습니다.')
      }
      handleCloseForm()
      await fetchMinutes()
    } catch (err) {
      console.error('등록/수정 실패:', err)
      alert('오류가 발생했습니다: ' + (err.response?.data?.message || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (m) => {
    try {
      await client.put(`/minutes/${m.id}`, {
        ...m,
        isActive: !m.isActive
      })
      fetchMinutes()
    } catch (err) {
      console.error(err)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  const handleEdit = (m) => {
    setEditingId(m.id)
    setFormData({
      title: m.title,
      content: m.content,
      videoLink: m.videoLink || '',
      meetingDate: m.meetingDate,
      isActive: m.isActive
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 회의록을 삭제하시겠습니까? 관련 확인 데이터도 모두 삭제됩니다.')) return
    
    try {
      await client.delete(`/minutes/${id}`)
      alert('삭제되었습니다.')
      fetchMinutes()
    } catch (err) {
      console.error(err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData({ title: '', content: '', videoLink: '', meetingDate: toApiDate(new Date()), isActive: true })
  }

  const fetchStatus = async (id, retry = false) => {
    const request = ++statusRequest.current
    if (!retry && selectedStatus?.id === id) {
      setSelectedStatus(null)
      return
    }
    setSelectedStatus({ id, data: [], state: 'loading' })
    try {
      const res = await client.get(`/minutes/${id}/status`)
      if (request === statusRequest.current) setSelectedStatus({ id, data: res.data, state: 'ready' })
    } catch (err) {
      if (request === statusRequest.current) setSelectedStatus({ id, data: [], state: 'error' })
    }
  }

  // 월별 그룹화 로직
  const filteredMinutes = minutes.filter(m => matchesAdminSearch(search, m.title, m.meetingDate) && (visibility === 'all' || (visibility === 'public' ? m.isActive : !m.isActive)))
  const groupedMinutes = filteredMinutes.reduce((acc, m) => {
    const month = format(new Date(m.meetingDate), 'yyyy년 M월', { locale: ko })
    if (!acc[month]) acc[month] = []
    acc[month].push(m)
    return acc
  }, {})



  const renderActions = m => <div className="minutes-actions flex min-w-0 flex-wrap gap-2">
    <button type="button" disabled={submitting} onClick={() => handleEdit(m)} aria-label={`${m.title} 수정`} className="minutes-action bg-primary-50 text-primary-800"><PenLine size={16} aria-hidden="true" /><FitLabel>수정</FitLabel></button>
    <button type="button" disabled={submitting} onClick={() => handleDelete(m.id)} aria-label={`${m.title} 삭제`} className="minutes-action bg-red-50 text-red-700"><Trash2 size={16} aria-hidden="true" /><FitLabel>삭제</FitLabel></button>
    <button type="button" disabled={submitting} onClick={() => handleToggleActive(m)} aria-label={`${m.title} ${m.isActive ? '비공개로 전환' : '공개로 전환'}`} className="minutes-action minutes-visibility bg-gray-100 text-gray-700">
      {m.isActive ? <ToggleRight size={20} aria-hidden="true" /> : <ToggleLeft size={20} aria-hidden="true" />}<FitLabel>{m.isActive ? '비공개로 전환' : '공개로 전환'}</FitLabel>
    </button>
  </div>
  const renderStatus = () => <div className="min-w-0 space-y-4">
    {selectedStatus?.state === 'loading' ? <p role="status" className="text-sm text-gray-600">참석 및 확인 현황을 불러오는 중입니다.</p>
      : selectedStatus?.state === 'error' ? <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
        <p>참석 및 확인 현황을 불러오지 못했습니다.</p><Button variant="secondary" onClick={() => fetchStatus(selectedStatus.id, true)}>다시 불러오기</Button>
      </div> : <>
        <ViewModeToggle mode={statusView} onChange={setStatusView} label="회의록 참석 명단 보기 방식" />
        <MinuteStatusViews mode={statusView} rows={selectedStatus?.data || []} />
      </>}
  </div>

  return (
    <div className="admin-minutes-page flex min-h-screen flex-col bg-gray-50/50 pb-10">
      <Header title="회의록 관리" showBack />
      <div className="flex min-w-0 flex-col gap-6 px-4 py-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">{showForm ? editingId ? '회의록 수정' : '회의록 등록' : '회의록 목록'}</h2>
            <Button aria-expanded={showForm} disabled={submitting} variant={showForm ? 'secondary' : 'primary'} onClick={() => showForm ? handleCloseForm() : setShowForm(true)}>
              {!showForm && <Plus size={18} aria-hidden="true" />}<FitLabel>{showForm ? '닫기' : '등록하기'}</FitLabel>
            </Button>
          </div>
          <SearchField label="관리할 회의록 검색" value={search} onChange={setSearch} placeholder="회의 제목 또는 날짜 검색" />
          <SegmentedControl label="회의록 공개 상태" value={visibility} onChange={setVisibility} selectedClassName="text-primary-600"
            options={[{value:'all',label:'전체'},{value:'public',label:'공개'},{value:'private',label:'비공개'}]} />
          {!loading && !loadError && <FilterResults count={filteredMinutes.length} total={minutes.length} unit="건" filtered={!!search.trim() || visibility !== 'all'} onReset={() => { setSearch(''); setVisibility('all') }} />}
        </div>

        <Collapse open={showForm}>
          <Card className="min-w-0 border-2 border-primary-100 p-4">
            <form onSubmit={handleSubmit} aria-label={editingId ? '회의록 수정' : '회의록 등록'}>
              <fieldset disabled={submitting} className="flex min-w-0 flex-col gap-5">
                <div>
                  <label htmlFor="admin-minute-title" className="minutes-field-label">회의 제목</label>
                  <input id="admin-minute-title" type="text" value={formData.title} onChange={e => setFormData({...formData,title:e.target.value})} placeholder="예: 정기 교사회의" required className="minutes-input" />
                </div>
                <div>
                  <label htmlFor="admin-minute-date" className="minutes-field-label">회의 날짜</label>
                  <input id="admin-minute-date" type="date" value={formData.meetingDate} onChange={e => setFormData({...formData,meetingDate:e.target.value})} required className="minutes-input" />
                </div>
                <div>
                  <label htmlFor="admin-minute-video" className="minutes-field-label">영상 링크 · 선택</label>
                  <input id="admin-minute-video" type="url" value={formData.videoLink} onChange={e => setFormData({...formData,videoLink:e.target.value})} placeholder="YouTube 링크 등" className="minutes-input" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-base font-bold text-gray-900">교사에게 공개</p>
                  <button type="button" role="switch" aria-label="교사에게 공개" aria-checked={formData.isActive} onClick={() => setFormData({...formData,isActive:!formData.isActive})} className={`minutes-action ${formData.isActive ? 'text-primary-700' : 'text-gray-600'}`}>
                    {formData.isActive ? <ToggleRight size={28} aria-hidden="true" /> : <ToggleLeft size={28} aria-hidden="true" />}<FitLabel>{formData.isActive ? '공개' : '비공개'}</FitLabel>
                  </button>
                </div>
                <div>
                  <label htmlFor="admin-minute-content" className="minutes-field-label">회의 내용</label>
                  <textarea id="admin-minute-content" rows={8} value={formData.content} onChange={e => setFormData({...formData,content:e.target.value})} placeholder="회의 주요 내용을 입력해주세요" required className="minutes-input resize-y leading-relaxed" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" size="lg" loading={submitting}>{submitting ? '저장 중' : editingId ? '수정 완료' : '등록 완료'}</Button>
                  <Button type="button" variant="ghost" onClick={handleCloseForm}>취소</Button>
                </div>
              </fieldset>
            </form>
          </Card>
        </Collapse>

        <ViewModeToggle mode={viewMode} onChange={setViewMode} label="회의록 목록 보기 방식" />
        <div className="min-w-0">
          {loading ? <p role="status" className="py-10 text-center text-sm text-gray-600">회의록을 불러오는 중…</p> : loadError ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">회의록을 불러오지 못했습니다.<Button variant="secondary" className="mt-3" onClick={fetchMinutes}>다시 불러오기</Button></div> : !filteredMinutes.length ? <div className="py-12 text-center text-gray-600"><FileText size={36} aria-hidden="true" className="mx-auto mb-3" /><p className="text-base font-semibold">{search.trim() || visibility !== 'all' ? '조건에 맞는 회의록이 없습니다.' : '등록된 회의록이 없습니다.'}</p></div> :
            <div className="admin-minutes-records"><RecordViews mode={viewMode} rows={filteredMinutes} onRowClick={m => fetchStatus(m.id)} columns={[
              {label:'회의록',render:m=>m.title},
              {label:'회의 일자',render:m=>m.meetingDate},
              {label:'공개',render:m=><VisibilityBadge active={m.isActive} />},
              {label:'내용',render:m=><span className="whitespace-pre-wrap">{m.content}</span>},
              {label:'영상',render:m=>m.videoLink ? <a href={m.videoLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary-700 underline">영상 열기</a> : '없음'},
              {label:'관리',action:true,render:renderActions},
            ]}>
              <div className="flex flex-col gap-7">
                {Object.entries(groupedMinutes).map(([month,items]) => <section key={month} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold text-gray-900">{month}</h3><span className="text-sm text-gray-600">{items.length}건</span></div>
                  {items.map(m => <Card key={m.id} className="flex min-w-0 flex-col gap-4 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600"><span>{formatDate(m.meetingDate)}</span><VisibilityBadge active={m.isActive} /></div>
                    <button type="button" aria-label={`${m.title} 참석 및 확인 현황`} aria-expanded={selectedStatus?.id===m.id} onClick={()=>fetchStatus(m.id)} className="min-h-11 min-w-0 text-left text-base font-bold leading-relaxed text-gray-900">{m.title}</button>
                    {renderActions(m)}
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" aria-expanded={selectedStatus?.id===m.id} onClick={()=>fetchStatus(m.id)} className={`minutes-action w-full ${selectedStatus?.id===m.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        <Users size={18} aria-hidden="true" /><FitLabel>{selectedStatus?.id===m.id ? '상세 닫기' : '참석 및 확인 현황'}</FitLabel>{selectedStatus?.id===m.id ? <ChevronUp size={16} aria-hidden="true"/> : <ChevronDown size={16} aria-hidden="true"/>}
                      </button>
                      {m.videoLink && <span className="flex items-center gap-2 text-sm text-gray-600"><Play size={16} aria-hidden="true"/>영상 있음</span>}
                    </div>
                    <AnimatePresence>{selectedStatus?.id===m.id && <CollapsePanel className="min-w-0 border-t border-gray-200 pt-4">{renderStatus()}</CollapsePanel>}</AnimatePresence>
                  </Card>)}
                </section>)}
              </div>
            </RecordViews></div>}
        </div>
        <Collapse open={viewMode !== 'large' && !!selectedStatus} aria-label="회의록 참석 및 확인 현황" className="min-w-0 space-y-3">
          <h2 className="text-lg font-bold text-gray-900">{minutes.find(m=>m.id===selectedStatus?.id)?.title} · 참석 및 확인 현황</h2>
          <Button variant="secondary" onClick={()=>{statusRequest.current++;setSelectedStatus(null)}}>상세 닫기</Button>
          {renderStatus()}
        </Collapse>
      </div>
    </div>
  )
}

function VisibilityBadge({ active }) {
  return <span className={`inline-flex max-w-full rounded-lg border px-2 py-1 text-sm font-semibold ${active ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-gray-200 bg-gray-100 text-gray-700'}`}>{active ? '공개' : '비공개'}</span>
}
function AttendanceBadge({ status }) {
  return <span className={`inline-flex max-w-full rounded-lg border px-2 py-1 text-sm font-bold ${status==='ATTEND' ? 'border-secondary-200 bg-secondary-50 text-secondary-800' : status==='ABSENT' ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}>{status==='ATTEND' ? '참석' : status==='ABSENT' ? '불참' : '미제출'}</span>
}
function ConfirmationStatus({ row }) {
  const confirmed = row.confirmed || row.attendanceStatus === 'ATTEND'
  return <span className={`flex min-w-0 items-start gap-2 text-sm font-semibold ${confirmed ? 'text-secondary-800' : 'text-amber-800'}`}>
    {confirmed ? <CheckCircle2 size={18} aria-hidden="true"/> : <XCircle size={18} aria-hidden="true"/>}
    <span>{row.attendanceStatus==='ATTEND' ? '참석자 · 확인 면제' : row.confirmed ? '회의록 확인 완료' : '회의록 미확인'}</span>
  </span>
}
function MinuteStatusViews({ mode, rows }) {
  if (!rows.length) return <p className="text-sm text-gray-600">확인할 교사 명단이 없습니다.</p>
  const gradeOrder=['유치','초1','초2','초3','초4','초5','초6','중1','중2','중3','고1','고2','고3','미분류']
  const grouped={}
  rows.forEach(row=>{const grade=row.teacherGrade || '미분류';(grouped[grade] ||= []).push(row)})
  const grades=Object.keys(grouped).sort((a,b)=>{const ai=gradeOrder.indexOf(a),bi=gradeOrder.indexOf(b);return ai<0&&bi<0 ? a.localeCompare(b) : ai<0 ? 1 : bi<0 ? -1 : ai-bi})
  return <div className="admin-minute-status-records"><RecordViews mode={mode} rows={rows} rowKey={row=>row.teacherId} columns={[
    {label:'교사',render:row=>row.teacherName},
    {label:'학년',render:row=>row.teacherGrade || '미분류'},
    {label:'참석',render:row=><AttendanceBadge status={row.attendanceStatus}/>},
    {label:'불참 사유',render:row=><span className="whitespace-pre-wrap">{row.attendanceReason}</span>},
    {label:'회의록 확인',render:row=><ConfirmationStatus row={row}/>},
  ]}>
    <div className="space-y-5">{grades.map(grade=><section key={grade} className="space-y-3">
      <h4 className="text-base font-bold text-gray-900">{grade}</h4>
      {grouped[grade].map(row=><div key={row.teacherId} className="min-w-0 space-y-3 rounded-xl border border-gray-200 bg-white p-3">
        <p className="text-base font-bold leading-relaxed text-gray-900">{row.teacherName}</p>
        <AttendanceBadge status={row.attendanceStatus}/>
        {row.attendanceStatus==='ABSENT' && row.attendanceReason && <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">불참 사유 · {row.attendanceReason}</p>}
        <ConfirmationStatus row={row}/>
      </div>)}
    </section>)}</div>
  </RecordViews></div>
}
