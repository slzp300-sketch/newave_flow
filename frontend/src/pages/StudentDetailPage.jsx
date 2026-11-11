import StudentAttendanceHistory from '../components/StudentAttendanceHistory'
import GradeLabel from '../components/common/GradeLabel'
import QueryNotice from '../components/common/QueryNotice'
import QueryRefreshNotice from '../components/common/QueryRefreshNotice'
import { hasQueryData } from '../utils/queryReadState'
import {useState} from 'react'
import useAuthStore from '../store/authStore'
import {gradeCareApi} from '../api/gradeCare'
import StudentCareDialog from '../components/grade-care/StudentCareDialog'
import Button from '../components/common/Button'
import {AnimatePresence} from 'framer-motion'
import './PeopleReadability.css'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Calendar, MessageSquare, Phone, ChevronLeft } from 'lucide-react'
import { studentsApi } from '../api/students'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import ReportLink from '../components/common/ReportLink'
import { newFamilyApi } from '../api/newFamily'

export default function StudentDetailPage() {
  const { id } = useParams()
  const user=useAuthStore(s=>s.user),[careOpen,setCareOpen]=useState(false)
  const careAccess=useQuery({queryKey:['grade-care-student-access',user?.id,id],queryFn:()=>gradeCareApi.studentAccess(id),staleTime:0,refetchInterval:30000,refetchOnWindowFocus:'always'})
  const handoff = useQuery({queryKey:['new-family-handoff',id],queryFn:()=>newFamilyApi.handoff(id)})

  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn:  () => studentsApi.getById(id).then(r => r.data),
  })


  const student=studentQuery.data
  if (!hasQueryData([studentQuery])) {
    return <div><Header title="학생 상세 정보" showBack/><div className="p-4"><QueryNotice queries={[studentQuery]} label="학생 정보"/></div></div>
  }
  if (!student) return <div><Header title="학생 상세 정보" showBack/><p className="p-4 text-sm">등록된 학생 정보가 없습니다.</p></div>

  return (
    <div className="people-readable readable-content flex flex-col min-h-screen pb-10">
      <Header title="학생 상세 정보" showBack />

      <div className="px-4 py-6 flex flex-col gap-6">
        <QueryRefreshNotice queries={[studentQuery]} label="학생 정보"/>
        {/* 프로필 섹션 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-24 h-24 rounded-3xl premium-gradient flex items-center justify-center text-white shadow-glow overflow-hidden">
            {student?.profileImage ? (
              <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <User size={48} />
            )}
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">{student?.name}</h2>
            <p className="text-primary-600 font-bold text-sm"><GradeLabel value={student?.grade} />{student?.school && ` · ${student.school}`}</p>
          </div>
          {student?.profileImage && <ReportLink contentType="STUDENT_PHOTO" targetId={student.id} label="학생 사진 신고" />}
        </motion.div>

        {/* 기본 정보 */}
        {(careAccess.isError||careAccess.fetchStatus==='paused')&&<QueryNotice queries={[careAccess]} label="돌봄 기록 권한"/>}
        {!careAccess.isError&&careAccess.data?.canCare&&<Button variant="secondary" onClick={()=>setCareOpen(true)}>학생 기록 보기</Button>}
        <div className="grid grid-cols-1 gap-3">
          <SectionLabel>기본 정보</SectionLabel>
          {[
            { label: '부', name: student?.fatherName, phone: student?.fatherPhone },
            { label: '모', name: student?.motherName, phone: student?.motherPhone },
          ].filter(p => p.name || p.phone).map(p => (
            <Card key={p.label} className="flex items-center gap-4">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600">
                <Phone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">{p.label} {p.name ?? ''}</p>
                <p className="font-bold text-gray-900">{p.phone ?? '연락처 없음'}</p>
              </div>
            </Card>
          ))}
        </div>

        {handoff.data && <Card><SectionLabel>새가족팀 인계</SectionLabel><p className="text-sm">첫 방문 {handoff.data.firstVisit} · 등록 {handoff.data.enrolledOn}<br />등반 {handoff.data.graduatedOn} · 반 적용 {handoff.data.effectiveDate}</p>{handoff.data.memo && <p className="mt-2 text-sm whitespace-pre-wrap">{handoff.data.memo}</p>}</Card>}
        <StudentAttendanceHistory key={id} studentId={id}/>
      </div>
      <AnimatePresence>{careOpen&&!careAccess.isError&&careAccess.data?.canCare&&<StudentCareDialog studentId={Number(id)} onClose={()=>setCareOpen(false)}/>}</AnimatePresence>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">{children}</p>
}
