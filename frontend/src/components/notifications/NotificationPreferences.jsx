import { useEffect, useSyncExternalStore } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import Card from '../common/Card'
import { getPushController } from '../../native/pushNotifications'

const unavailable = { available: false, enabled: false, permission: 'prompt', busy: false, error: '' }
const noopSubscribe = () => () => {}
const getUnavailable = () => unavailable

export default function NotificationPreferences() {
  const runtime = getPushController()
  const state = useSyncExternalStore(runtime?.subscribe || noopSubscribe, runtime?.getSnapshot || getUnavailable)
  useEffect(() => { void runtime?.refresh() }, [runtime])
  if (!runtime) return null
  const blocked = state.permission === 'denied'
  return <Card className="p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 font-semibold"><Bell size={18} /><span>휴대폰 알림</span></div>
      <button type="button" role="switch" aria-checked={state.enabled && !blocked} aria-label="휴대폰 알림 받기"
        disabled={state.busy || (!state.available && !state.enabled)}
        onClick={() => void (state.enabled && !blocked ? runtime.disable() : runtime.enable())}
        className={`min-w-16 min-h-11 rounded-xl px-3 text-sm font-semibold disabled:opacity-50 ${state.enabled && !blocked ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
        {state.busy ? <Loader2 size={18} className="animate-spin mx-auto" aria-label="알림 설정 중" /> : state.enabled && !blocked ? '켜짐' : '꺼짐'}
      </button>
    </div>
    {state.available && !state.enabled && <p className="mt-2 text-xs text-gray-500">알림 연결을 위해 기기 알림 토큰과 설치 식별자를 사용합니다. 잠금 화면에는 일반 안내만 표시하며 언제든 끌 수 있습니다.</p>}
    {!state.available && !state.error && <p className="mt-2 text-xs text-gray-500">휴대폰 알림을 준비하고 있습니다.</p>}
    {blocked && !state.error && <p className="mt-2 text-xs text-gray-500">휴대폰 설정에서 앱 알림을 허용해 주세요.</p>}
    {state.error && <div className="mt-2 text-xs text-red-700" role="alert">{state.error}
      <button type="button" className="ml-2 min-h-11 underline" disabled={state.busy} onClick={() => void runtime.refresh()}>다시 확인</button>
    </div>}
  </Card>
}
