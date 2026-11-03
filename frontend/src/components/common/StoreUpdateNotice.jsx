import { Download } from 'lucide-react'
import Button from './Button'

export default function StoreUpdateNotice({ offer, saving = false, onLater }) {
  if (!offer) return null
  return (
    <aside aria-label="새 버전 안내" className="fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-primary-100 bg-white p-4 shadow-lg"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-center gap-2">
        <Download size={18} aria-hidden="true" className="shrink-0 text-primary-600" />
        <p role="status" className="text-sm font-bold text-gray-800">새 버전이 있어요</p>
        <span className="ml-auto text-xs text-gray-500">{offer.currentVersion} → {offer.version}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">
        {saving ? '저장이 끝나면 업데이트할 수 있어요.' : '작성 중인 내용은 먼저 저장해 주세요.'}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onLater}>나중에</Button>
        <a href={offer.url} target="_blank" rel="noopener noreferrer" aria-disabled={saving || undefined}
          tabIndex={saving ? -1 : 0} onClick={event => { if (saving) event.preventDefault() }}
          className={`brand-action motion-button inline-flex min-h-11 items-center justify-center rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white ${saving ? 'cursor-not-allowed opacity-50' : ''}`}>
          업데이트
        </a>
      </div>
    </aside>
  )
}
