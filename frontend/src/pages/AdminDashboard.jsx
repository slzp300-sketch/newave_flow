import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { reportsApi } from '../api/reports'
import { toApiDate, formatDate } from '../utils/date'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

// 가상 데이터 (추후 API 연동 가능)
const MOCK_WEEKLY_DATA = [
  { day: '월', rate: 85 },
  { day: '화', rate: 88 },
  { day: '수', rate: 92 },
  { day: '목', rate: 90 },
  { day: '금', rate: 95 },
  { day: '토', rate: 100 },
  { day: '일', rate: 70 },
]

export default function AdminDashboard() {
  const [date, setDate] = useState(toApiDate())

  const { data, isLoading } = useQuery({
    queryKey: ['report-summary', date],
    queryFn:  () => reportsApi.getSummary(date).then(r => r.data),
  })

  const submitRate = data
    ? Math.round((data.submitted / data.totalTeachers) * 100) || 0
    : 0

  return (
    <div className="flex flex-col min-h-screen pb-10">
      <Header title="현황 대시보드" />

      <div className="px-4 py-5 flex flex-col gap-6">
        {/* 날짜 선택 섹션 */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <SectionLabel>조회 일자</SectionLabel>
          <div className="mt-2 relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl glass-effect text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </div>
        </motion.div>

        {/* 통계 그리드 */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={data?.totalTeachers ?? '-'} label="전체 교사"  color="text-gray-900" delay={0.1} />
          <StatCard value={data?.submitted       ?? '-'} label="제출 완료" color="text-emerald-500" delay={0.2} />
          <StatCard value={data?.notSubmittedCount ?? '-'} label="미제출"  color="text-red-400" delay={0.3} />
        </div>

        {/* 시각화 차트 섹션 */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
          <SectionLabel>주간 보고서 제출 추이</SectionLabel>
          <Card className="mt-2 h-64 p-2 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_WEEKLY_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fontWeight: 700, fill: '#94a3b8' }} 
                  dy={10}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800 }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={24}>
                  {MOCK_WEEKLY_DATA.map((entry, index) => (
                    <Cell key={index} fill={entry.day === '일' ? '#f87171' : '#4f46e5'} opacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* 제출률 섹션 */}
        {data && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Card className="relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-full -mr-16 -mt-16 opacity-50" />
               <div className="relative">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase">Submission Rate</p>
                    <p className="text-2xl font-black text-gray-900">{submitRate}%</p>
                  </div>
                  <Badge variant={submitRate > 80 ? 'success' : 'warning'}>
                    {submitRate > 80 ? '우수' : '확인 필요'}
                  </Badge>
                </div>
                <div className="h-3 bg-gray-100/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${submitRate}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full"
                  />
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* 미제출 목록 */}
        {data?.notSubmitted?.length > 0 && (
          <div className="flex flex-col gap-3">
            <SectionLabel>미제출 교사 명단</SectionLabel>
            {data.notSubmitted.map((t, idx) => (
              <motion.div
                key={t.teacherId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + (idx * 0.05) }}
              >
                <Card className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl premium-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-black text-sm">{t.teacherName[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{t.teacherName}</p>
                    <p className="text-gray-400 text-[11px] font-medium">{t.className}</p>
                  </div>
                  <Badge variant="danger">미제출</Badge>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && data?.notSubmitted?.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}>
            <Card className="py-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-3xl mb-4">✨</div>
              <p className="font-black text-gray-900 text-lg">완벽한 하루입니다!</p>
              <p className="text-gray-400 text-sm mt-1">{formatDate(date)} 모든 보고서가 수집되었습니다.</p>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="text-center py-5">
        <p className={`text-3xl font-black ${color} tracking-tighter`}>{value}</p>
        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">{label}</p>
      </Card>
    </motion.div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">{children}</p>
}
