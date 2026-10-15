import { Link } from 'react-router-dom'
import useSafetyAttention from '../../hooks/useSafetyAttention'

export default function SafetySummary() {
  const summary = useSafetyAttention()
  if (!summary.canManage) return null
  if (summary.isPending) return <p role="status" className="text-sm text-gray-500">안전 관리 현황을 확인하고 있습니다…</p>
  if (summary.isError) return <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">안전 관리 현황을 확인하지 못했습니다. <button className="min-h-11 underline" onClick={() => summary.refetch()}>다시 시도</button></p>
  const data = summary.data
  return <section aria-label="안전 관리 현황" className="rounded-2xl border border-gray-200 bg-white p-4">
    <h2 className="font-semibold">확인할 신고와 사진</h2>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Link to="/admin/content-reports" className="rounded-xl bg-primary-50 p-3 text-sm text-primary-900">미처리 신고 <strong className="block text-xl">{data.openCount + data.reviewingCount}건</strong></Link>
      <Link to="/admin/content-photos" className="rounded-xl bg-gray-50 p-3 text-sm">사진 검토 <strong className="block text-xl">{data.pendingPhotoCount}건</strong></Link>
    </div>
    <p className={`mt-3 text-sm ${data.overdueCount || data.urgentCount ? 'font-semibold text-red-700' : 'text-gray-500'}`}>긴급 {data.urgentCount}건 · 처리 목표시간 경과 {data.overdueCount}건</p>
  </section>
}
