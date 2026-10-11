import { useState } from 'react'

export default function AppUpdateNotice({ needRefresh, saving, onUpdate }) {
  const [confirming, setConfirming] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState(false)
  if (!needRefresh) return null

  const update = async () => {
    if (saving || updating) return
    setUpdating(true)
    setError(false)
    try {
      await onUpdate()
    } catch {
      setError(true)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <aside aria-label="앱 업데이트" className="fixed bottom-24 inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-primary-100 bg-white p-4 shadow-lg">
      <p role="status" className="text-sm font-bold text-gray-800">새 버전이 준비되었습니다.</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        {saving ? '저장이 끝나면 새 버전으로 열 수 있어요.' : '작성 중인 내용은 먼저 저장해 주세요. 다시 열면 저장하지 않은 내용은 사라집니다.'}
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">업데이트하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {confirming ? <>
          <button type="button" disabled={!!saving || updating} onClick={update} className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {updating ? '새 버전을 여는 중...' : '저장 확인, 다시 열기'}
          </button>
          <button type="button" disabled={updating} onClick={() => setConfirming(false)} className="rounded-xl px-3 py-2 text-sm text-gray-600">계속 작성</button>
        </> : <button type="button" disabled={!!saving} onClick={() => setConfirming(true)} className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">새 버전으로 다시 열기</button>}
      </div>
    </aside>
  )
}
