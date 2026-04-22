import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Send, FileText } from 'lucide-react'
import { reportsApi } from '../api/reports'
import { classesApi } from '../api/classes'
import useAuthStore from '../store/authStore'
import { toApiDate, formatDate } from '../utils/date'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'

export default function ReportPage() {
  const { user } = useAuthStore()
  const today = toApiDate()
  const [notes, setNotes]         = useState('')
  const [reportId, setReportId]   = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const { data: classes = [], isLoading: classLoading } = useQuery({
    queryKey: ['my-classes', user?.id],
    queryFn:  () => classesApi.getMyClasses().then(r => r.data),
  })

  const classId = classes[0]?.id

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => reportsApi.save({ classGroupId: classId, reportDate: today, specialNotes: notes }),
    onSuccess:  ({ data }) => setReportId(data.id),
  })

  const { mutate: submit, isPending: submitting } = useMutation({
    mutationFn: () => reportsApi.submit(reportId),
    onSuccess:  () => setSubmitted(true),
  })

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-xl font-black text-gray-900">보고서 제출 완료!</h2>
        <p className="text-gray-400 text-sm">{formatDate(today)} 보고서가 제출되었습니다.</p>
      </div>
    )
  }

  if (classLoading) return <div className="py-20 text-center text-gray-400">불러오는 중...</div>

  if (classes.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="일일 보고서" showBack />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-4xl">📋</div>
          <div>
            <p className="font-black text-gray-900 text-lg">배정된 반이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">관리자에게 반 배정을 요청해 주세요.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="일일 보고서" showBack />

      <div className="px-4 py-4 flex flex-col gap-4">
        <Card className="flex items-center gap-3 bg-primary-50 border border-primary-100">
          <FileText size={20} className="text-primary-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-primary-900 text-sm">{formatDate(today)}</p>
            <p className="text-primary-600 text-xs mt-0.5">출석 데이터가 자동으로 집계됩니다</p>
          </div>
        </Card>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            특이사항 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="오늘 특이사항이나 전달사항을 입력해주세요..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none transition"
          />
        </div>

        {!reportId ? (
          <Button size="lg" onClick={() => save()} loading={saving}>
            보고서 저장
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="secondary" onClick={() => save()} loading={saving}>
              수정 저장
            </Button>
            <Button size="lg" onClick={() => submit()} loading={submitting}>
              <Send size={18} />
              최종 제출하기
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          제출 후에는 수정이 불가합니다
        </p>
      </div>
    </div>
  )
}
