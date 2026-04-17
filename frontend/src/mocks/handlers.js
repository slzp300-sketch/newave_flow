import { http, HttpResponse, delay } from 'msw'
import { format } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')

// ──────────── 목 데이터 ────────────
const USERS = {
  'teacher1@church.com': { id: 3, name: '박교사', email: 'teacher1@church.com', role: 'TEACHER', password: 'password123' },
  'teacher2@church.com': { id: 4, name: '최교사', email: 'teacher2@church.com', role: 'TEACHER', password: 'password123' },
  'pastor@church.com':   { id: 1, name: '김목사', email: 'pastor@church.com',   role: 'PASTOR',    password: 'password123' },
  'exec@church.com':     { id: 2, name: '이임원', email: 'exec@church.com',     role: 'EXECUTIVE', password: 'password123' },
}

const CLASSES = [
  { id: 1, name: '유치부',     ageGroup: '유치', description: '5~7세' },
  { id: 2, name: '초등부 1반', ageGroup: '초등', description: '초등 1~2학년' },
  { id: 3, name: '초등부 2반', ageGroup: '초등', description: '초등 3~4학년' },
  { id: 4, name: '중등부',     ageGroup: '중등', description: '중학생' },
]

const TEACHER_CLASSES = { 3: [1], 4: [2] }

const STUDENTS = {
  1: [
    { id: 1, name: '김민준', grade: '7세', parentName: '김철수', parentPhone: '010-1111-1111' },
    { id: 2, name: '이서연', grade: '6세', parentName: '이영희', parentPhone: '010-2222-2222' },
    { id: 3, name: '박지호', grade: '5세', parentName: '박준혁', parentPhone: '010-3333-3333' },
    { id: 4, name: '최유나', grade: '7세', parentName: '최미라', parentPhone: '010-4444-4444' },
    { id: 5, name: '정태양', grade: '6세', parentName: '정석준', parentPhone: '010-5555-5555' },
    { id: 6, name: '한소연', grade: '5세', parentName: '한지민', parentPhone: '010-6666-6666' },
    { id: 7, name: '오성민', grade: '7세', parentName: '오태식', parentPhone: '010-7777-7777' },
  ],
  2: [
    { id: 8,  name: '강하늘', grade: '초2', parentName: '강민호', parentPhone: '010-8888-8888' },
    { id: 9,  name: '윤지수', grade: '초1', parentName: '윤세진', parentPhone: '010-9999-9999' },
    { id: 10, name: '임현준', grade: '초2', parentName: '임태호', parentPhone: '010-1010-1010' },
    { id: 11, name: '신아영', grade: '초1', parentName: '신민준', parentPhone: '010-1111-2222' },
  ],
}

const CHECKLIST_ITEMS = [
  { id: 1, title: '결석 학생 개인 연락',   description: '결석 학생에게 개인 연락을 해주세요', category: '연락', isRequired: true,  orderIndex: 1 },
  { id: 2, title: '부모님 연락 (필요 시)', description: '특이사항이 있는 학생의 부모님께 연락',  category: '연락', isRequired: false, orderIndex: 2 },
  { id: 3, title: '주간 교안 준비',        description: '다음 주 교안을 미리 준비해주세요',      category: '준비', isRequired: true,  orderIndex: 3 },
  { id: 4, title: '교실 정리정돈',         description: '예배 후 교실을 깨끗이 정리해주세요',    category: '환경', isRequired: false, orderIndex: 4 },
  { id: 5, title: '특이사항 보고',         description: '이번 주 특이사항을 임원에게 보고하세요', category: '보고', isRequired: true,  orderIndex: 5 },
]

const EVENTS = [
  { id: 1, title: '여름 성경학교',   description: '전 부서 연합 행사',      eventDate: '2025-07-26', eventType: 'SPECIAL'  },
  { id: 2, title: '교사 회의',       description: '월례 교사 회의',          eventDate: today,        eventType: 'MEETING'  },
  { id: 3, title: '월례 예배',       description: '7월 월례 예배',           eventDate: '2025-07-20', eventType: 'REGULAR'  },
  { id: 4, title: '새 학기 준비 모임', description: '2학기 교육 계획 수립',  eventDate: '2025-08-10', eventType: 'SPECIAL'  },
]

// 세션 중 변하는 목 상태
const state = {
  attendanceByDate: {
    [today]: {
      1: { studentId: 1, studentName: '김민준', status: 'PRESENT', note: '' },
      2: { studentId: 2, studentName: '이서연', status: 'ABSENT',  note: '감기' },
      3: { studentId: 3, studentName: '박지호', status: 'PRESENT', note: '' },
      4: { studentId: 4, studentName: '최유나', status: 'LATE',    note: '지각' },
      5: { studentId: 5, studentName: '정태양', status: 'ABSENT',  note: '' },
      6: { studentId: 6, studentName: '한소연', status: 'PRESENT', note: '' },
      7: { studentId: 7, studentName: '오성민', status: 'ABSENT',  note: '' },
    }
  },
  reports: {},
  reportIdSeq: 100,
  checklistRecords: {},
  meetingAttendance: {},
  eventAttendance: {},
  currentUser: null,
}

const NOT_SUBMITTED = [
  { teacherId: 4,  teacherName: '최교사', className: '초등부 1반' },
  { teacherId: 5,  teacherName: '김교사', className: '초등부 2반' },
  { teacherId: 6,  teacherName: '이교사', className: '중등부' },
  { teacherId: 7,  teacherName: '정교사', className: '고등부' },
]

const fakeToken = (userId) => `mock-token-${userId}-${Date.now()}`

// ──────────── 핸들러 ────────────
export const handlers = [

  // ── 인증 ──
  http.post('/api/auth/login', async ({ request }) => {
    await delay(400)
    const { email, password } = await request.json()
    const user = USERS[email]
    if (!user || user.password !== password) {
      return HttpResponse.json({ status: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }
    state.currentUser = user
    return HttpResponse.json({
      accessToken:  fakeToken(user.id),
      refreshToken: fakeToken(user.id) + '-refresh',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  }),

  http.post('/api/auth/refresh', async () => {
    await delay(200)
    const u = state.currentUser
    if (!u) return HttpResponse.json({ status: 401 }, { status: 401 })
    return HttpResponse.json({ accessToken: fakeToken(u.id), refreshToken: fakeToken(u.id) + '-refresh', user: u })
  }),

  http.post('/api/auth/logout', () => HttpResponse.json(null, { status: 204 })),

  http.get('/api/users/me', () => {
    if (!state.currentUser) return HttpResponse.json({}, { status: 401 })
    return HttpResponse.json(state.currentUser)
  }),

  // ── 반(클래스) ──
  http.get('/api/classes', () => {
    const teacherId = state.currentUser?.id
    const classIds  = TEACHER_CLASSES[teacherId] ?? [1, 2, 3, 4]
    return HttpResponse.json(CLASSES.filter(c => classIds.includes(c.id)))
  }),

  http.get('/api/classes/:id/students', ({ params }) => {
    const students = STUDENTS[Number(params.id)] ?? []
    return HttpResponse.json(students)
  }),

  // ── 출석 ──
  http.get('/api/attendance', async ({ request }) => {
    await delay(300)
    const url     = new URL(request.url)
    const classId = Number(url.searchParams.get('classId'))
    const date    = url.searchParams.get('date') ?? today

    const dayMap = state.attendanceByDate[date] ?? {}
    const students = STUDENTS[classId] ?? []

    const result = students.map(s => ({
      studentId:      s.id,
      studentName:    s.name,
      attendanceDate: date,
      status: dayMap[s.id]?.status ?? 'ABSENT',
      note:   dayMap[s.id]?.note   ?? '',
    }))
    return HttpResponse.json(result)
  }),

  http.post('/api/attendance/batch', async ({ request }) => {
    await delay(400)
    const body = await request.json()
    const date = body.attendanceDate ?? today
    if (!state.attendanceByDate[date]) state.attendanceByDate[date] = {}

    body.records.forEach(r => {
      const student = Object.values(STUDENTS).flat().find(s => s.id === r.studentId)
      state.attendanceByDate[date][r.studentId] = {
        studentId: r.studentId, studentName: student?.name ?? '',
        status: r.status, note: r.note ?? '',
      }
    })
    return HttpResponse.json({ saved: body.records.length, date })
  }),

  http.get('/api/attendance/summary', ({ request }) => {
    const url  = new URL(request.url)
    const date = url.searchParams.get('date') ?? today
    const dayMap = state.attendanceByDate[date] ?? {}
    const vals   = Object.values(dayMap)
    return HttpResponse.json({
      date, classId: 1,
      total:   vals.length,
      present: vals.filter(v => v.status === 'PRESENT').length,
      absent:  vals.filter(v => v.status === 'ABSENT').length,
      late:    vals.filter(v => v.status === 'LATE').length,
    })
  }),

  // ── 보고서 ──
  http.post('/api/reports', async ({ request }) => {
    await delay(400)
    const body   = await request.json()
    const key    = `${state.currentUser?.id}-${body.classGroupId}-${body.reportDate}`
    const existing = Object.values(state.reports).find(r => r._key === key)

    if (existing) {
      existing.specialNotes = body.specialNotes
      return HttpResponse.json(existing)
    }
    const id = ++state.reportIdSeq
    const report = { id, _key: key, teacherId: state.currentUser?.id,
      classGroupId: body.classGroupId, reportDate: body.reportDate,
      status: 'DRAFT', specialNotes: body.specialNotes,
      totalStudents: 7, presentCount: 3, absentCount: 3, lateCount: 1 }
    state.reports[id] = report
    return HttpResponse.json(report)
  }),

  http.put('/api/reports/:id/submit', async ({ params }) => {
    await delay(300)
    const report = state.reports[Number(params.id)]
    if (!report) return HttpResponse.json({ status: 404 }, { status: 404 })
    if (report.status === 'SUBMITTED')
      return HttpResponse.json({ status: 409, message: '이미 제출된 보고서입니다.' }, { status: 409 })
    report.status = 'SUBMITTED'
    report.submittedAt = new Date().toISOString()
    return HttpResponse.json(report)
  }),

  http.get('/api/reports/summary', ({ request }) => {
    const url  = new URL(request.url)
    const date = url.searchParams.get('date') ?? today
    const submitted = Object.values(state.reports).filter(r => r.reportDate === date && r.status === 'SUBMITTED').length
    const baseSubmitted = 8
    return HttpResponse.json({
      date, totalTeachers: 12,
      submitted: baseSubmitted + submitted,
      notSubmittedCount: NOT_SUBMITTED.length - submitted,
      notSubmitted: NOT_SUBMITTED.slice(submitted),
    })
  }),

  // ── 체크리스트 ──
  http.get('/api/checklist/items', () => HttpResponse.json(CHECKLIST_ITEMS)),

  http.get('/api/checklist/records', ({ request }) => {
    const url  = new URL(request.url)
    const date = url.searchParams.get('date') ?? today
    const key  = `${state.currentUser?.id}-${date}`
    return HttpResponse.json(state.checklistRecords[key] ?? [])
  }),

  http.post('/api/checklist/records', async ({ request }) => {
    await delay(300)
    const body = await request.json()
    const key  = `${state.currentUser?.id}-${body.date}`
    state.checklistRecords[key] = body.records.map((r, i) => ({
      id: i + 1, teacherId: state.currentUser?.id,
      checklistItemId: r.checklistItemId,
      recordDate: body.date, isChecked: r.isChecked, note: r.note,
    }))
    return HttpResponse.json({ saved: body.records.length })
  }),

  // ── 행사 ──
  http.get('/api/events', ({ request }) => {
    const url  = new URL(request.url)
    const from = url.searchParams.get('from')
    const to   = url.searchParams.get('to')
    const filtered = EVENTS.filter(e => {
      if (from && e.eventDate < from) return false
      if (to   && e.eventDate > to)   return false
      return true
    })
    return HttpResponse.json(filtered)
  }),

  http.get('/api/events/:id', ({ params }) => {
    const event = EVENTS.find(e => e.id === Number(params.id))
    if (!event) return HttpResponse.json({ status: 404 }, { status: 404 })
    return HttpResponse.json(event)
  }),

  http.post('/api/events/:id/attendance', async ({ params, request }) => {
    await delay(300)
    const body = await request.json()
    const key  = `${params.id}-${state.currentUser?.id}`
    state.eventAttendance[key] = { eventId: Number(params.id), teacherId: state.currentUser?.id, status: body.status }
    return HttpResponse.json({ saved: true })
  }),

  // ── 교사 회의 ──
  http.get('/api/meetings/attendance', ({ request }) => {
    const url  = new URL(request.url)
    const date = url.searchParams.get('date') ?? today
    const key  = `${state.currentUser?.id}-${date}`
    return HttpResponse.json(state.meetingAttendance[key] ?? { status: null })
  }),

  http.post('/api/meetings/attendance', async ({ request }) => {
    await delay(300)
    const body = await request.json()
    const key  = `${state.currentUser?.id}-${body.meetingDate}`
    state.meetingAttendance[key] = { teacherId: state.currentUser?.id, meetingDate: body.meetingDate, status: body.status }
    return HttpResponse.json(state.meetingAttendance[key])
  }),
]