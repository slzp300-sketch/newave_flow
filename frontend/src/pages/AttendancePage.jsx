import AppSelect from '../components/common/AppSelect'
import GradeLabel from '../components/common/GradeLabel'
import { useState, useMemo, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AnimatedValue } from '../components/common/Motion'
import {
  Check, Send, CheckCircle2, MessageSquare
} from 'lucide-react'
import { attendanceApi } from '../api/attendance'
import { classesApi } from '../api/classes'
import { reportsApi } from '../api/reports'
import { toApiDate, getWeekStartByOffset, formatDate, formatShort, formatUpdatedAt, weekLabels } from '../utils/date'
import useAuthStore from '../store/authStore'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import StatSummary from '../components/common/StatSummary'
import SearchField from '../components/common/SearchField'
import WeekNavigator from '../components/common/WeekNavigator'
import QueryNotice from '../components/common/QueryNotice'
import { queryReadState, hasQueryData } from '../utils/queryReadState'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { confirmAttendance } from '../utils/attendanceDraft'
import { weeklyReportsApi } from '../api/weeklyReports'
import { reportWeekLabel, supplementFromEditor } from '../utils/weeklyReport'
import TeacherSundayCheck from '../components/weekly-report/TeacherSundayCheck'
import TeacherReportExtras from '../components/weekly-report/TeacherReportExtras'
import './AttendancePage.css'

export default function AttendancePage() {
  const qc    = useQueryClient()
  const { user } = useAuthStore()
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  // 선택한 주의 주일(일요일). 지난 주일 출석도 언제든 수정할 수 있다
  const today = toApiDate(getWeekStartByOffset(offset, 0))
  const labels = weekLabels(getWeekStartByOffset(offset, 0))
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedClassId, setSelectedClassId] = useState(null)
  const [supplementDraft, setSupplementDraft] = useState(null)
  const [submitError, setSubmitError] = useState('')

  // 1. 담당 반 목록
  const classesQuery = useQuery({
    queryKey: ['my-classes', user?.id],
    queryFn:  () => classesApi.getMyClasses().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const classes = classesQuery.data || []
  const classId = classes.find(c => c.id === selectedClassId)?.id || classes[0]?.id
  const formKey = `${classId}:${today}`
  const supplementQuery = useQuery({
    queryKey: ['weekly-class-editor', classId, today],
    queryFn: () => weeklyReportsApi.editor(classId, today).then(r => r.data), enabled: !!classId,
  })
  const supplement = supplementDraft?.key === formKey ? supplementDraft.value : supplementQuery.data ? supplementFromEditor(supplementQuery.data) : null

  // 2. 해당 반 학생 목록
  const studentsQuery = useQuery({
    queryKey: ['students', classId, today],
    queryFn:  () => classesApi.getStudents(classId, today).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  // 3. 선택한 주일 출석 기록
  const recordsQuery = useQuery({
    queryKey: ['attendance', classId, today],
    queryFn:  () => attendanceApi.getByClass(classId, today).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  // 4. 제출 상태 확인
  const reportQuery = useQuery({
    queryKey: ['report-status', classId, today],
    queryFn:  () => reportsApi.getByClassAndDate(classId, today).then(r => r.data),
    enabled:  !!classId,
    staleTime: 5 * 60 * 1000,
  })

  const students = studentsQuery.data || []
  const records = recordsQuery.data
  const reportStatus = reportQuery.data
  const reads = classId ? [classesQuery, studentsQuery, recordsQuery, reportQuery, supplementQuery] : [classesQuery]
  const ready = queryReadState(reads) === 'ready'
  const isSubmitted = reportStatus?.status === 'SUBMITTED' && !reportStatus?.draftChanged && editingKey !== formKey && draft?.key !== formKey
  const savedForm = useMemo(() => {
    const initial = {}
    ;(records || []).forEach(r => {
      initial[r.studentId] = {
        status: r.status,
        absentReason: r.absentReason || '',
        note: r.note || ''
      }
    })
    return initial
  }, [records])
  // A draft belongs to one class/date and survives background refetches.
  const formData = draft?.key === formKey ? draft.values : savedForm

  const updateStudent = (id, fields) => {
    if (!ready || isSubmitted || isSubmitting) return
    setDraft(prev => {
      const values = prev?.key === formKey ? prev.values : savedForm
      return { key: formKey, values: { ...values,
        [id]: { ...(values[id] || { status: 'PRESENT', absentReason: '', note: '' }), ...fields },
      } }
    })
  }

  const getStudentData = (id) => formData[id] || { status: 'PRESENT', absentReason: '', note: '' }

  // 5. 제출 Mutation (저장 후 제출 순서로 처리)
  const { mutate: submitReport, isPending: isSubmitting } = useMutation({
    mutationFn: async () => {
      if (!ready || !classId || !supplement) throw new Error('출석 기록을 모두 불러온 뒤 다시 시도해 주세요.')
      const batchRecords = students.map(s => {
        const data = getStudentData(s.id)
        return {
          studentId: s.id,
          status: data.status,
          absentReason: data.status === 'ABSENT' ? data.absentReason : '',
          note: data.note
        }
      })
      await attendanceApi.saveBatch(classId, today, batchRecords)
      await weeklyReportsApi.supplement(classId, today, { ...supplement, members: supplement.members.map(({ studentId, category, graduated, introducer }) => ({ studentId, category, graduated, introducer })) })
      await attendanceApi.submit(classId, today)
      return { classId, today, batchRecords, formKey }
    },
    onSuccess: async ({ classId, today, batchRecords, formKey: savedKey }) => {
      await Promise.all([
        confirmAttendance(qc, ['attendance', classId, today], batchRecords),
        // The submit endpoint has no body. Do not reuse an older submission time.
        confirmAttendance(qc, ['report-status', classId, today], { status: 'SUBMITTED', updatedAt: null, submittedAt: null }),
      ])
      setEditingKey(previous => previous === savedKey ? null : previous)
      setDraft(previous => previous?.key === savedKey ? null : previous)
      setSupplementDraft(previous => previous?.key === savedKey ? null : previous)
      setSubmitError('')
      void qc.invalidateQueries({ queryKey: ['weekly-status'] })
    },
    onError: (err) => setSubmitError(err.response?.data?.message || err.message || '저장 중 오류가 발생했습니다.'),
  })

  const weekNav = (
    <>
    <WeekNavigator
      offset={offset}
      onChange={value => { setDraft(null); setSupplementDraft(null); setEditingKey(null); setSearch(''); setSubmitError(''); setOffset(value) }}
      disabled={isSubmitting}
      title={`${labels.monthWeek} 출석`}
      sub={reportWeekLabel(today)}
      range={`${formatShort(today)} 주일`}
    />
    {['TEACHER', 'EXECUTIVE', 'ADMIN'].includes(user?.role) && <TeacherSundayCheck key={`${user?.id}:${today}`} date={today} />}
    {classes.length > 1 && <label className="teacher-class-picker">담당 반 전환<AppSelect aria-label="출석 입력할 반" aria-describedby="assigned-class-help" value={classId} disabled={isSubmitting} onChange={e => { setSelectedClassId(Number(e.target.value)); setDraft(null); setSupplementDraft(null); setEditingKey(null); setSearch(''); setSubmitError('') }}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</AppSelect><span id="assigned-class-help">담당 반 {classes.length}개</span></label>}
    </>
  )
  const lastUpdated = reportStatus?.updatedAt || reportStatus?.submittedAt

  if (!hasQueryData(reads)) return <div className="teacher-attendance pb-24">
    <Header title="출석 체크" showBack />
    <div className="px-4 py-3">{weekNav}</div>
    <div className="px-4"><QueryNotice queries={reads} label="출석 기록" /></div>
  </div>

  if (classes.length === 0) {
    return (
      <div className="teacher-attendance flex flex-col min-h-screen">
        <Header title="출석 체크" showBack />
        <div className="px-4 py-3">{weekNav}</div>
        <div className="px-4"><QueryRefreshNotice queries={reads} label="담당 반" /></div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-4xl">📋</div>
          <div>
            <p className="font-bold text-gray-900 text-lg">배정된 반이 없습니다</p>
            <p className="text-gray-600 text-sm mt-2 leading-relaxed">관리자에게 반 배정을 요청해 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  if (isSubmitted) {
    return (
      <SubmittedAttendanceView
        classGroup={classes.find(c => c.id === classId)}
        date={today}
        students={students}
        formData={formData}
        firstVisits={supplementQuery.data?.supplement?.visitors || []}
        onEdit={() => setEditingKey(formKey)}
        weekNav={weekNav}
        lastUpdated={lastUpdated}
        reads={reads}
        canEdit={ready && !isSubmitting}
      />
    )
  }

  return (
    <div className="teacher-attendance pb-44">
      <Header title="출석 체크" showBack />

      {/* 상단 정보 */}
      <div className="teacher-attendance-top">
        {weekNav}
        <div className="flex justify-between items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h2 className="ui-section-title">{classes.find(c => c.id === classId)?.name}</h2>
              <span className="text-sm font-semibold text-gray-600">총 {students.length}명</span>
            </div>
          </div>
        </div>

      </div>

      <div className="px-3">
        <QueryRefreshNotice queries={reads} label="출석 기록" />
        <dl className="teacher-counts ui-metrics" aria-label="출석 인원 요약">
          {[
            ['배정', students.length, 'text-gray-900'],
            ['출석', students.filter(s => getStudentData(s.id).status === 'PRESENT').length, 'teacher-present'],
            ['불참', students.filter(s => getStudentData(s.id).status === 'ABSENT').length, 'teacher-absent'],
          ].map(([label, count, color]) => <div key={label}>
            <dt>{label}</dt><dd className={color}><AnimatedValue value={count} /><small>명</small></dd>
          </div>)}
        </dl>
      </div>
      {/* 학생 목록 */}
      <div className="px-3 pt-3">
        <SearchField label="출석 학생 검색" value={search} onChange={setSearch} placeholder="학생 이름으로 찾기" />
        {search.trim() && <p className="mt-2 text-sm text-gray-600" role="status">제출 대상: 우리 반 전체 {students.length}명</p>}
      </div>
      <fieldset disabled={!ready || isSubmitting} className="teacher-student-list">
        {students.filter(student => student.name.includes(search.trim())).map((student, idx) => (
          <StudentAttendanceCard
            key={student.id}
            student={student}
            data={getStudentData(student.id)}
            onChange={(fields) => updateStudent(student.id, fields)}
            idx={idx}
          />
        ))}
        {!students.some(student => student.name.includes(search.trim())) && <p className="rounded-2xl bg-white p-5 text-center text-sm text-gray-600">{students.length ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}</p>}
      </fieldset>

      {supplement && <div className="px-3 pb-3"><TeacherReportExtras key={formKey} editor={supplementQuery.data} value={supplement} onChange={value => setSupplementDraft({ key: formKey, value })} disabled={!ready || isSubmitting} /></div>}
      {submitError && <p className="mx-3 text-sm text-red-700" role="alert">{submitError}</p>}

      {/* 하단 플로팅 버튼 */}
      <div className="attendance-submit">
        <Button
          className="w-full"
          onClick={() => { setSubmitError(''); submitReport() }}
          loading={isSubmitting}
          disabled={!ready}
        >
          <Send size={18} />
          출석·주간자료 제출
        </Button>
        <p className="text-center text-sm text-gray-600 mt-2 font-medium">
          담임·부담임 중 한 분만 제출
        </p>
      </div>
    </div>
  )
}

function StudentAttendanceCard({ student, data, onChange }) {
  const [isNoteOpen, setNoteOpen] = useState(false)
  const fieldId = useId()
  return <article className="teacher-student-card">
    <div className="teacher-student-row">
      <div className="teacher-student-info"><strong>{student.name}</strong><p><GradeLabel value={student.grade} />{student.school && ` · ${student.school}`}</p></div>
      <div className="teacher-student-controls">
        <div className="teacher-status-buttons" role="group" aria-label={`${student.name} 출석 상태`}>
          {[['PRESENT', '출석'], ['ABSENT', '불참']].map(([status, label]) => <button key={status} type="button" data-status={status} data-tone={status === 'ABSENT' ? 'absence' : undefined} aria-label={`${student.name} ${label}`} aria-pressed={data.status === status} onClick={() => onChange({ status })}>{data.status === status && <Check size={13} aria-hidden="true" />}{label}</button>)}
        </div>
        <button className="teacher-note-toggle" type="button" aria-label={`${student.name} 메모${data.note ? ' (입력됨)' : ''}`} title="학생 메모" aria-expanded={isNoteOpen} aria-controls={`${fieldId}-note`} onClick={() => setNoteOpen(!isNoteOpen)}><MessageSquare size={17} aria-hidden="true" />{data.note && <span aria-hidden="true" className="teacher-note-dot" />}</button>
      </div>
    </div>
    {data.status === 'ABSENT' && <label className="teacher-absence">불참 사유 <span>선택</span><input aria-label={`${student.name} 불참 사유`} placeholder="사유 (선택)" value={data.absentReason} onChange={e => onChange({ absentReason: e.target.value })} /></label>}
    {isNoteOpen && <label id={`${fieldId}-note`} className="teacher-student-note">학생 메모<textarea rows={2} aria-label={`${student.name} 특이사항`} placeholder="전달할 내용 (선택)" value={data.note} onChange={e => onChange({ note: e.target.value })} /></label>}
  </article>
}

function SubmittedAttendanceView({ classGroup, date, students, formData, firstVisits, onEdit, weekNav, lastUpdated, reads, canEdit }) {
  const counts = students.reduce((acc, s) => {
    const status = formData[s.id]?.status || 'ABSENT'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, { PRESENT: 0, ABSENT: 0 })

  return (
    <div className="teacher-attendance flex flex-col min-h-screen pb-24">
      <Header title="출석 완료" showBack />
      <div className="px-4 py-3 glass-effect border-b border-gray-100">{weekNav}</div>
      <div className="px-4"><QueryRefreshNotice queries={reads} label="출석 기록" /></div>

      <div className="teacher-submitted">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="teacher-submitted-check"
        >
          <CheckCircle2 size={28} className="text-white" />
        </motion.div>

        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">{classGroup?.name}</h2>
          <p className="text-secondary-700 font-bold mt-1">출석과 주간자료를 제출했어요</p>
          <p className="text-gray-600 text-sm mt-3">{formatDate(date)}</p>
          {lastUpdated && <p className="text-gray-600 text-sm mt-1">마지막 수정 {formatUpdatedAt(lastUpdated)}</p>}
          {firstVisits.length > 0 && <p className="teacher-help mt-2">첫 방문 참고 기록 {firstVisits.length}명 · {firstVisits.filter(v => v.teamConfirmed === false).length}명 새가족팀 확인 대기</p>}
        </div>

        <StatSummary className="w-full" label="제출한 출석 인원" items={[
          { label: '출석', value: counts.PRESENT, color: 'text-secondary-700' },
          { label: '불참', value: counts.ABSENT, color: 'text-red-700' },
        ]} />

        <div className="w-full flex flex-col gap-2">
          <p className="ui-section-title">배정 학생 출석 현황</p>
          {students.map(s => (
            <div key={s.id} className="flex items-start justify-between gap-3 px-3 py-3 bg-white border border-gray-200 rounded-2xl">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-gray-900 break-words">{s.name}</p>
                {formData[s.id]?.status === 'ABSENT' && formData[s.id]?.absentReason && (
                  <p className="mt-1 text-sm leading-relaxed text-gray-600 break-words [overflow-wrap:anywhere]">{formData[s.id].absentReason}</p>
                )}
              </div>
              <span className={`shrink-0 text-sm font-semibold ${formData[s.id]?.status === 'PRESENT' ? 'text-secondary-700' : 'text-red-700'}`}>
                {formData[s.id]?.status === 'PRESENT' ? '출석' : '불참'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-col items-center gap-2">
          <button
              onClick={onEdit}
              disabled={!canEdit}
              className="min-h-11 px-4 rounded-full text-primary-700 font-semibold text-sm"
            >
              수정하기
            </button>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}
