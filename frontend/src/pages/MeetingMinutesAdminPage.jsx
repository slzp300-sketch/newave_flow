import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, FileText, CheckCircle2, XCircle, Play, 
  Calendar, Users, Eye, PenLine, Trash2, ArrowLeft,
  ChevronDown, ChevronUp, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { formatDate, toApiDate } from '../utils/date'
import client from '../api/client'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function MeetingMinutesAdminPage() {
  const [minutes, setMinutes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(null)
  
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
    try {
      const res = await client.get('/minutes')
      setMinutes(res.data)
    } catch (err) {
      console.error(err)
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const fetchStatus = async (id) => {
    if (selectedStatus?.id === id) {
      setSelectedStatus(null)
      return
    }
    try {
      const res = await client.get(`/minutes/${id}/status`)
      setSelectedStatus({ id, data: res.data })
    } catch (err) {
      console.error(err)
    }
  }

  // 월별 그룹화 로직
  const groupedMinutes = minutes.reduce((acc, m) => {
    const month = format(new Date(m.meetingDate), 'yyyy년 M월', { locale: ko })
    if (!acc[month]) acc[month] = []
    acc[month].push(m)
    return acc
  }, {})

  if (loading) return <div className="p-10 text-center text-gray-400">로딩 중...</div>

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-gray-50/50">
      <Header title="회의록 관리" showBack />

      <div className="px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-gray-900">
            {editingId ? '회의록 수정' : '회의록 및 영상 등록'}
          </h2>
          <Button size="sm" variant={showForm ? 'secondary' : 'primary'} onClick={() => showForm ? handleCloseForm() : setShowForm(true)}>
            {showForm ? '닫기' : <><Plus size={16} /> 등록하기</>}
          </Button>
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <Card className="p-6 border-2 border-primary-100 shadow-xl shadow-primary-50">
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">회의 제목</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="예: 4월 3주차 정기 교사 회의"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold focus:ring-2 focus:ring-primary-400 outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">회의 날짜</label>
                    <input 
                      type="date" 
                      value={formData.meetingDate}
                      onChange={e => setFormData({...formData, meetingDate: e.target.value})}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">영상 링크 (선택)</label>
                    <input 
                      type="url" 
                      value={formData.videoLink}
                      onChange={e => setFormData({...formData, videoLink: e.target.value})}
                      placeholder="YouTube 링크 등"
                      className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm font-black text-gray-900">교사 공개 여부</p>
                    <p className="text-[11px] text-gray-400 font-medium">활성화 시 일반 교사들이 이 회의록을 볼 수 있습니다.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                    className={`transition-colors ${formData.isActive ? 'text-primary-600' : 'text-gray-300'}`}
                  >
                    {formData.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">회의 내용</label>
                  <textarea 
                    rows={6}
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    placeholder="회의 주요 내용을 입력해주세요"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm font-medium resize-none outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button type="submit" size="lg" loading={submitting}>
                    {editingId ? '수정 완료' : '등록 완료'}
                  </Button>
                  {editingId && (
                    <Button variant="ghost" onClick={handleCloseForm}>취소</Button>
                  )}
                </div>
              </form>
            </Card>
          </motion.div>
        )}

        <div className="flex flex-col gap-8">
          {Object.keys(groupedMinutes).length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-bold">등록된 회의록이 없습니다.</p>
            </div>
          ) : (
            Object.entries(groupedMinutes).map(([month, items]) => (
              <div key={month} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1 h-4 bg-primary-500 rounded-full" />
                  <h3 className="text-sm font-black text-gray-900">{month}</h3>
                  <span className="text-[10px] font-bold text-gray-400 ml-1">{items.length}건</span>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {items.map(m => (
                    <Card key={m.id} className={`p-4 flex flex-col gap-4 overflow-hidden group transition-all ${!m.isActive ? 'opacity-60 bg-gray-50' : 'hover:border-primary-200'}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1" onClick={() => fetchStatus(m.id)}>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] font-black text-violet-500 uppercase tracking-widest">{formatDate(m.meetingDate)}</p>
                            {!m.isActive && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gray-200 text-gray-500">비공개</span>}
                          </div>
                          <h3 className="font-black text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">{m.title}</h3>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleToggleActive(m)} 
                            title={m.isActive ? "비공개로 전환" : "공개로 전환"}
                            className={`p-2 rounded-lg transition-colors ${m.isActive ? 'text-primary-500 hover:bg-primary-50' : 'text-gray-400 hover:bg-gray-200'}`}
                          >
                            {m.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                          </button>
                          <button onClick={() => handleEdit(m)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                            <PenLine size={16} />
                          </button>
                          <button onClick={() => handleDelete(m.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => fetchStatus(m.id)}
                          className={`text-[11px] font-black flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                            selectedStatus?.id === m.id 
                            ? 'bg-primary-600 text-white shadow-md shadow-primary-100' 
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Users size={12} /> {selectedStatus?.id === m.id ? '상세 닫기' : '참석 및 확인 현황'}
                          {selectedStatus?.id === m.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {m.videoLink && (
                          <span className="text-[10px] font-black text-red-500 flex items-center gap-1">
                            <Play size={10} fill="currentColor" /> 영상 있음
                          </span>
                        )}
                      </div>

                      <AnimatePresence>
                        {selectedStatus?.id === m.id && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-4 border-t border-gray-100 overflow-hidden"
                          >
                            <div className="overflow-hidden rounded-2xl border border-gray-100">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50 text-gray-400 font-black">
                                  <tr>
                                    <th className="px-4 py-3 text-left">이름</th>
                                    <th className="px-4 py-3 text-center">출석</th>
                                    <th className="px-4 py-3 text-center">확인</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 bg-white">
                                  {selectedStatus.data.map(s => (
                                    <tr key={s.teacherId}>
                                      <td className="px-4 py-3 font-bold text-gray-700">{s.teacherName}</td>
                                      <td className="px-4 py-3 text-center">
                                        {s.attendanceStatus === 'ATTEND' ? (
                                          <span className="text-emerald-500 font-black">참석</span>
                                        ) : s.attendanceStatus === 'ABSENT' ? (
                                          <span className="text-red-400 font-black">불참</span>
                                        ) : (
                                          <span className="text-gray-300 font-black">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {s.confirmed || s.attendanceStatus === 'ATTEND' ? (
                                          <CheckCircle2 size={16} className="mx-auto text-emerald-500" />
                                        ) : (
                                          s.attendanceStatus === 'ABSENT' ? (
                                            <XCircle size={16} className="mx-auto text-red-300" />
                                          ) : <span className="text-gray-200">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
