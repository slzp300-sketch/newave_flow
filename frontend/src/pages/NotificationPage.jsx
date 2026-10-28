import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Calendar, FileText, Settings, ClipboardList, CheckCircle2 } from 'lucide-react'
import { notificationApi } from '../api/notifications'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import Header from '../components/layout/Header'
import Card from '../components/common/Card'
import { useNavigate } from 'react-router-dom'
import { safeNotificationPath } from '../native/pushController'

const ICON_MAP = {
  EVENT: { icon: Calendar, color: 'text-primary-500', bg: 'bg-primary-50' },
  MINUTE: { icon: FileText, color: 'text-primary-500', bg: 'bg-primary-50' },
  SYSTEM: { icon: Settings, color: 'text-gray-500', bg: 'bg-gray-100' },
  ATTENDANCE: { icon: ClipboardList, color: 'text-secondary-700', bg: 'bg-secondary-50' },
  EVENT_DEADLINE: { icon: Calendar, color: 'text-primary-500', bg: 'bg-primary-50' },
  TTS: { icon: CheckCircle2, color: 'text-secondary-700', bg: 'bg-secondary-50' },
  MEETING_VOTE: { icon: ClipboardList, color: 'text-primary-500', bg: 'bg-primary-50' },
  EVANGELISM: { icon: Calendar, color: 'text-secondary-700', bg: 'bg-secondary-50' },
}

export default function NotificationPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getAll().then(r => r.data)
  })

  const { mutate: markAsRead } = useMutation({
    mutationFn: (id) => notificationApi.markAsRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-notifications'] })
    }
  })

  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['unread-notifications'] })
    }
  })

  if (isLoading) return <div className="p-10 text-center text-gray-500">알림을 불러오는 중...</div>

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header 
        title="알림" 
        showBack 
        showNotification={false}

      />
      
      <div className="px-4 py-4 flex flex-col gap-4">
        {!isError && notifications.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-700" role="status">
            {unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : '모든 알림을 읽었어요'}
          </p>
          {unreadCount > 0 && <button type="button" onClick={() => markAllAsRead()} disabled={isMarkingAll}
            className="min-h-11 inline-flex items-center gap-2 rounded-xl px-3 text-sm font-bold text-primary-700 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary-300">
            <CheckCircle2 size={16} aria-hidden="true" />
            {isMarkingAll ? '읽음 처리 중…' : '모두 읽음'}
          </button>}
        </div>}
        {isError ? (
          <div className="py-12 text-center text-base text-gray-700" role="alert">
            <p>알림을 불러오지 못했습니다.</p>
            <button onClick={() => refetch()} className="mt-3 min-h-11 rounded-xl px-4 font-bold text-primary-700">다시 시도</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell size={24} className="text-gray-500" />
            </div>
            <p className="text-base text-gray-700 font-semibold">도착한 알림이 없습니다.</p>
          </div>
        ) : (
          notifications.map(noti => {
            const config = ICON_MAP[noti.type] || ICON_MAP.SYSTEM
            const Icon = config.icon

            return (
              <Card 
                key={noti.id} 
                className={`p-4 flex gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${!noti.read ? 'border-primary-200 bg-white' : 'border-gray-200 bg-gray-50/50'}`}
                onClick={() => {
                  if (!noti.read) markAsRead(noti.id)
                  const path = safeNotificationPath(noti.targetPath)
                  if (path) navigate(path)
                }}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.bg}`}>
                  <Icon size={18} aria-hidden="true" className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  {!noti.read && <span className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-red-600" />읽지 않음
                  </span>}
                  <h3 className="text-base font-bold leading-snug text-gray-900 break-words [overflow-wrap:anywhere]">
                    {noti.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700 break-words [overflow-wrap:anywhere]">
                    {noti.content}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {formatDistanceToNow(new Date(noti.createdAt), { addSuffix: true, locale: ko })}
                  </p>
                </div>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
