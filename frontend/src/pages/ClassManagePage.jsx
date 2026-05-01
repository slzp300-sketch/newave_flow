import { useState } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, X, Loader2, PenLine, UserX, UserCheck, Save, Clock, StickyNote, Camera, Image as ImageIcon } from 'lucide-react'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Button from '../components/common/Button'
import { studentsApi } from '../api/students'
import { classesApi } from '../api/classes'
import useAuthStore from '../store/authStore'

export default function ClassManagePage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = usePersistedState('tab', 'list')
  const [editingStudent, setEditingStudent] = useState(null)
  const [deactivatingStudent, setDeactivatingStudent] = useState(null)
  const [memoStudent, setMemoStudent] = useState(null)

  const { user } = useAuthStore()

  const { data: classes = [], isLoading: classLoading } = useQuery({
    queryKey: ['my-classes', user?.id],
    queryFn: () => classesApi.getMyClasses().then(r => r.data),
  })

  const { data: students = [], isLoading: studentLoading } = useQuery({
    queryKey: ['my-class-students'],
    queryFn: () => studentsApi.getMyClass().then(r => r.data),
    enabled: classes.length > 0
  })

  const isLoading = classLoading || studentLoading

  const activateMutation = useMutation({
    mutationFn: (id) => studentsApi.activate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class-students'] }),
  })

  const activeStudents   = students.filter(s => s.isActive && !s.hasPendingRequest)
  const pendingStudents  = students.filter(s => s.isActive && s.hasPendingRequest)
  const inactiveStudents = students.filter(s => !s.isActive)

  return (
    <div className="flex flex-col min-h-screen pb-24">
      <Header title="반 관리" showBack />

      {/* 탭 스위처 */}
      <div className="mx-4 mt-3 mb-1 flex gap-1 bg-gray-100 p-1 rounded-2xl">
        {[
          { id: 'list', label: '학생 목록' },
          { id: 'memo', label: '메모' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${
              tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
            }`}>{t.label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center mt-20">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4 mt-20">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-4xl">📋</div>
          <div>
            <p className="font-black text-gray-900 text-lg">배정된 반이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">관리자에게 반 배정을 요청해 주세요.</p>
          </div>
        </div>
      ) : tab === 'memo' ? (
        <MemoTab students={students} onEditMemo={setMemoStudent} />
      ) : (
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* 통계 */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="text-center py-3">
              <p className="text-xl font-black text-gray-900">{students.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">전체</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-emerald-500">{activeStudents.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">재적</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-amber-500">{pendingStudents.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">대기</p>
            </Card>
            <Card className="text-center py-3">
              <p className="text-xl font-black text-red-400">{inactiveStudents.length}</p>
              <p className="text-[10px] font-black text-gray-400 mt-0.5">제적</p>
            </Card>
          </div>

          {/* 재적 학생 */}
          {activeStudents.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 mb-2">재적 학생</p>
              <div className="flex flex-col gap-2">
                {activeStudents.map((student, idx) => (
                  <ManageStudentCard
                    key={student.id}
                    student={student}
                    idx={idx}
                    onEdit={() => setEditingStudent(student)}
                    onDeactivate={() => setDeactivatingStudent(student)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 승인 대기 학생 */}
          {pendingStudents.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest px-1 mb-2">승인 대기</p>
              <div className="flex flex-col gap-2">
                {pendingStudents.map((student, idx) => (
                  <ManageStudentCard
                    key={student.id}
                    student={student}
                    idx={idx}
                    isPendingApproval
                    onEdit={() => setEditingStudent(student)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 제적 학생 */}
          {inactiveStudents.length > 0 && (
            <div>
              <p className="text-[11px] font-black text-red-400 uppercase tracking-widest px-1 mb-2">제적 학생</p>
              <div className="flex flex-col gap-2">
                {inactiveStudents.map((student, idx) => (
                  <ManageStudentCard
                    key={student.id}
                    student={student}
                    idx={idx}
                    isInactive
                    onEdit={() => setEditingStudent(student)}
                    onActivate={() => activateMutation.mutate(student.id)}
                    isPending={activateMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {students.length === 0 && (
            <Card className="py-14 flex flex-col items-center gap-2">
              <Users size={32} className="text-gray-200" />
              <p className="text-sm font-black text-gray-400">배정된 학생이 없습니다</p>
            </Card>
          )}

          <AnimatePresence>
            {editingStudent && (
              <EditStudentSheet
                student={editingStudent}
                onClose={() => setEditingStudent(null)}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['my-class-students'] })
                  setEditingStudent(null)
                }}
              />
            )}
            {deactivatingStudent && (
              <DeactivationReasonModal
                student={deactivatingStudent}
                onClose={() => setDeactivatingStudent(null)}
                onSubmitted={() => {
                  queryClient.invalidateQueries({ queryKey: ['my-class-students'] })
                  setDeactivatingStudent(null)
                }}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {memoStudent && (
          <MemoSheet
            student={memoStudent}
            onClose={() => setMemoStudent(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['my-class-students'] })
              setMemoStudent(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function ManageStudentCard({ student, idx, isInactive, isPendingApproval, onEdit, onDeactivate, onActivate, isPending }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Card className={`flex items-center gap-3 p-4 ${isInactive ? 'opacity-60' : ''}`}>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
          student.gender === '여' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
        }`}>
          {student.profileImage ? (
            <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-black text-sm">{student.name[0]}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-black text-gray-900 text-sm">{student.name}</p>
            {student.baptism && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-black">세례</span>
            )}
            {isPendingApproval && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 font-black flex items-center gap-0.5">
                <Clock size={8} />승인 대기
              </span>
            )}
            {isInactive && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-500 font-black">제적</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {[student.grade, student.school].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 rounded-xl bg-gray-100 text-gray-500 active:scale-90 transition-all"
          >
            <PenLine size={14} />
          </button>
          {isInactive ? (
            <button
              onClick={onActivate}
              disabled={isPending}
              className="p-2 rounded-xl bg-emerald-100 text-emerald-600 active:scale-90 transition-all"
              title="복적"
            >
              <UserCheck size={14} />
            </button>
          ) : !isPendingApproval ? (
            <button
              onClick={onDeactivate}
              className="p-2 rounded-xl bg-red-100 text-red-500 active:scale-90 transition-all"
              title="제적 신청"
            >
              <UserX size={14} />
            </button>
          ) : null}
        </div>
      </Card>
    </motion.div>
  )
}

// ── 메모 탭 ────────────────────────────────
function MemoTab({ students, onEditMemo }) {
  const activeStudents = students.filter(s => s.isActive)

  if (activeStudents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center mt-20 gap-2">
        <StickyNote size={32} className="text-gray-200" />
        <p className="text-sm font-black text-gray-400">배정된 학생이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-2">
      {activeStudents.map((student, idx) => {
        const hasContent = student.prayerRequest || student.sketch
        return (
          <motion.div key={student.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
            <Card onClick={() => onEditMemo(student)} className="flex items-start gap-3 p-4 group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden ${
                student.gender === '여' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {student.profileImage ? (
                  <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-sm">{student.name[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 text-sm">{student.name}</p>
                <div className="flex flex-col gap-1 mt-1.5">
                  {student.prayerRequest ? (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-1 rounded flex-shrink-0 mt-0.5">기도</span>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-1">{student.prayerRequest}</p>
                    </div>
                  ) : null}
                  {student.sketch ? (
                    <div className="flex items-start gap-1.5">
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1 rounded flex-shrink-0 mt-0.5">스케치</span>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-1">{student.sketch}</p>
                    </div>
                  ) : null}
                  {!hasContent && (
                    <p className="text-xs text-gray-300">메모 없음 · 탭하여 작성</p>
                  )}
                </div>
              </div>
              <StickyNote size={14} className={`flex-shrink-0 mt-0.5 transition-colors ${hasContent ? 'text-amber-400' : 'text-gray-200 group-active:text-amber-300'}`} />
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// ── 메모 편집 모달 ──────────────────────────
function MemoSheet({ student, onClose, onSaved }) {
  const [prayerRequest, setPrayerRequest] = useState(student.prayerRequest || '')
  const [sketch, setSketch] = useState(student.sketch || '')

  const mutation = useMutation({
    mutationFn: () => studentsApi.saveMemo(student.id, { prayerRequest, sketch }),
    onSuccess: onSaved,
  })

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      >
        <div className="w-full max-w-[430px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-amber-400" />
              <p className="font-black text-gray-900 text-lg">{student.name} 메모</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 px-5 py-5 overflow-y-auto flex flex-col gap-6">
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">기도제목</p>
              </div>
              <textarea
                value={prayerRequest}
                onChange={e => setPrayerRequest(e.target.value)}
                placeholder="기도제목을 입력해 주세요"
                className="w-full min-h-[120px] p-4 bg-gray-50 rounded-2xl text-sm text-gray-800 placeholder:text-gray-300 outline-none resize-none leading-relaxed focus:bg-emerald-50/50 focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </section>

            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">스케치 (인계 사항)</p>
              </div>
              <textarea
                value={sketch}
                onChange={e => setSketch(e.target.value)}
                placeholder="다음 해 담당 교사가 참고할 내용을 입력해 주세요"
                className="w-full min-h-[120px] p-4 bg-gray-50 rounded-2xl text-sm text-gray-800 placeholder:text-gray-300 outline-none resize-none leading-relaxed focus:bg-blue-50/50 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </section>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3 bg-gray-50/50">
            <Button variant="ghost" onClick={onClose} className="flex-1">취소</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
              <Save size={16} />
              {mutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function DeactivationReasonModal({ student, onClose, onSubmitted }) {
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => studentsApi.requestDeactivation(student.id, reason),
    onSuccess: onSubmitted,
  })

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        className="fixed inset-0 z-[70] flex items-center justify-center px-6"
      >
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-black text-gray-900 text-base">{student.name} 제적 신청</p>
              <p className="text-xs text-gray-400 mt-0.5">관리자 승인 후 제적 처리됩니다</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
              <X size={14} className="text-gray-500" />
            </button>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">제적 사유</p>
            <textarea
              rows={4}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="제적 사유를 입력해 주세요"
              className="field-input resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="flex-1">취소</Button>
            <Button
              variant="danger"
              onClick={() => mutation.mutate()}
              disabled={!reason.trim() || mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending ? '신청 중...' : '제적 신청'}
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

function EditStudentSheet({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        student.name        || '',
    gender:      student.gender      || '',
    birthDate:   student.birthDate   || '',
    school:      student.school      || '',
    phone:       student.phone       || '',
    baptism:     student.baptism != null ? String(student.baptism) : '',
    fatherName:  student.fatherName  || '',
    fatherPhone: student.fatherPhone || '',
    motherName:  student.motherName  || '',
    motherPhone: student.motherPhone || '',
    address:     student.address     || '',
    profileImage: student.profileImage || '',
  })

  const updateMutation = useMutation({
    mutationFn: (data) => studentsApi.update(student.id, data),
    onSuccess: onSaved,
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = () => {
    updateMutation.mutate({
      ...form,
      baptism: form.baptism === 'true' ? true : form.baptism === 'false' ? false : null,
    })
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      >
        <div className="w-full max-w-[430px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <p className="font-black text-gray-900 text-lg">{student.name} 정보 수정</p>
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
            {/* 사진 업로드 */}
            <div className="flex flex-col items-center gap-3 mb-2">
              <div className="relative">
                <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-lg ${
                  form.gender === '여' ? 'bg-pink-50 text-pink-200' : 'bg-blue-50 text-blue-200'
                }`}>
                  {form.profileImage ? (
                    <img src={form.profileImage} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={32} />
                  )}
                </div>
                <label className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-all">
                  <ImageIcon size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onloadend = () => set('profileImage', reader.result)
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </label>
                {form.profileImage && (
                  <button
                    onClick={() => set('profileImage', '')}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <p className="text-[10px] font-black text-gray-300">학생 사진 (JPG, PNG)</p>
            </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="이름">
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="field-input" placeholder="이름" />
            </FormField>
            <FormField label="성별">
              <div className="flex gap-2">
                {['남', '여'].map(g => (
                  <button key={g} onClick={() => set('gender', g)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition-all ${
                      form.gender === g ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-100 bg-gray-50 text-gray-400'
                    }`}>{g}</button>
                ))}
              </div>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="생년월일">
              <input type="date" value={form.birthDate} onChange={e => set('birthDate', e.target.value)}
                className="field-input" />
            </FormField>
            <FormField label="세례 여부">
              <select value={form.baptism} onChange={e => set('baptism', e.target.value)} className="field-input">
                <option value="">미확인</option>
                <option value="true">세례</option>
                <option value="false">미세례</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="학교">
              <input value={form.school} onChange={e => set('school', e.target.value)}
                className="field-input" placeholder="학교명" />
            </FormField>
            <FormField label="학생 연락처">
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                className="field-input" placeholder="010-0000-0000" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="아버지 이름">
              <input value={form.fatherName} onChange={e => set('fatherName', e.target.value)}
                className="field-input" placeholder="이름" />
            </FormField>
            <FormField label="아버지 연락처">
              <input type="tel" value={form.fatherPhone} onChange={e => set('fatherPhone', e.target.value)}
                className="field-input" placeholder="010-0000-0000" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="어머니 이름">
              <input value={form.motherName} onChange={e => set('motherName', e.target.value)}
                className="field-input" placeholder="이름" />
            </FormField>
            <FormField label="어머니 연락처">
              <input type="tel" value={form.motherPhone} onChange={e => set('motherPhone', e.target.value)}
                className="field-input" placeholder="010-0000-0000" />
            </FormField>
          </div>

          <FormField label="주소">
            <textarea rows={2} value={form.address} onChange={e => set('address', e.target.value)}
              className="field-input resize-none" placeholder="주소를 입력해 주세요" />
          </FormField>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 flex gap-3 bg-gray-50/50">
          <Button variant="ghost" onClick={onClose} className="flex-1">취소</Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="flex-1">
            <Save size={16} />
            {updateMutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </motion.div>
  </>
)
}

function FormField({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  )
}
