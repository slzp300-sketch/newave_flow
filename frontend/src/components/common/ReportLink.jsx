import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'

export default function ReportLink({ targetType = 'CONTENT', contentType = 'OTHER', targetId, label = '이 콘텐츠 신고', subject = '' }) {
  const params = new URLSearchParams({ targetType })
  if (targetType === 'CONTENT') params.set('contentType', contentType)
  if (targetId) params.set('targetId', String(targetId))
  return <Link to={`/safety/report?${params}`} state={{ subject }}
    className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-gray-600 hover:bg-gray-100">
    <Flag size={16} aria-hidden="true" />{label}
  </Link>
}
