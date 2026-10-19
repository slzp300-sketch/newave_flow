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
        right={
          unreadCount > 0 ? (
            <button 
              onClick={() => markAllAsRead()}
              disabled={isMarkingAll}
              className="text-xs font-bold text-gray-500 hover:text-gray-900 px-2 flex items-center gap-1"
            >
              <CheckCircle2 size={14} />
              모두 읽음
            </button>
          ) : null
        }
      />
      
      <div className="px-4 py-4 flex flex-col gap-3">
        {isError ? (
          <div className="py-12 text-center text-sm text-gray-600" role="alert">
            <p>알림을 불러오지 못했습니다.</p>
            <button onClick={() => refetch()} className="mt-3 font-bold text-primary-600">다시 시도</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Bell size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-bold">도착한 알림이 없습니다.</p>
          </div>
        ) : (
          notifications.map(noti => {
            const config = ICON_MAP[noti.type] || ICON_MAP.SYSTEM
            const Icon = config.icon

            return (
              <Card 
                key={noti.id} 
                className={`p-4 flex gap-4 transition-all cursor-pointer ${!noti.read ? 'opacity-100 bg-white' : 'opacity-60 bg-gray-50/50 hover:opacity-100'}`}
                onClick={() => {
                  if (!noti.read) markAsRead(noti.id)
                  const path = safeNotificationPath(noti.targetPath)
                  if (path) navigate(path)
                }}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${config.bg}`}>
                  <Icon size={20} className={config.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className={`text-sm font-bold truncate ${!noti.read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {noti.title}
                    </h3>
                    <span className="text-xs font-bold text-gray-400 shrink-0 whitespace-nowrap pt-0.5">
                      {formatDistanceToNow(new Date(noti.createdAt), { addSuffix: true, locale: ko })}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${!noti.read ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                    {noti.content}
                  </p>
                </div>
                {!noti.read && (
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 self-center shadow-sm"></div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
