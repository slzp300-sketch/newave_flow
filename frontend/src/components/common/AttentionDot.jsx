export default function AttentionDot({ show, label = '할 일이 있어요' }) {
  if (!show) return null
  return <span className="pointer-events-none absolute right-2 top-2 z-10 flex h-3 w-3" data-attention-dot="true">
    <span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </span>
}
