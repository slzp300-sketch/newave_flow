import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Calendar, MessageSquare, Phone, ChevronLeft } from 'lucide-react'
import { studentsApi } from '../api/students'
import { attendanceApi } from '../api/attendance'
import { formatDate } from '../utils/date'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

export default function StudentDetailPage() {
  const { id } = useParams()

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['student', id],
    queryFn:  () => studentsApi.getById(id).then(r => r.data),
  })

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['student-history', id],
    queryFn:  () => attendanceApi.getHistoryByStudent(id).then(r => r.data),
  })

  if (loadingStudent || loadingHistory) {
    return <div className="p-10 text-center text-gray-400">불러오는 중...</div>
  }

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="학생 상세 정보" showBack />

      <div className="px-4 py-6 flex flex-col gap-6">
        {/* 프로필 섹션 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-24 h-24 rounded-3xl premium-gradient flex items-center justify-center text-white shadow-glow">
            <User size={48} />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black text-gray-900">{student?.name}</h2>
            <p className="text-primary-600 font-bold text-sm">{student?.className} · {student?.grade}</p>
          </div>
        </motion.div>

        {/* 기본 정보 */}
        <div className="grid grid-cols-1 gap-3">
          <SectionLabel>기본 정보</SectionLabel>
          <Card className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Phone size={18} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">부모님 연락처 ({student?.parentName})</p>
              <p className="font-bold text-gray-900">{student?.parentPhone}</p>
            </div>
          </Card>
        </div>

        {/* 출석 히스토리 */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <SectionLabel>출석 이력</SectionLabel>
            <span className="text-[10px] font-bold text-gray-400 mb-1">최근 순</span>
          </div>
          
          {history.length === 0 ? (
            <Card className="py-10 text-center text-gray-400 text-sm">출석 기록이 없습니다</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((record, idx) => (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${record.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-sm font-semibold text-gray-700">{formatDate(record.attendanceDate)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {record.note && <MessageSquare size={14} className="text-gray-300" />}
                      <Badge variant={record.status === 'PRESENT' ? 'success' : 'danger'}>
                        {record.status === 'PRESENT' ? '출석' : '결석'}
                      </Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">{children}</p>
}
