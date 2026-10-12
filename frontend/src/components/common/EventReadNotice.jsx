export default function EventReadNotice({ error, retry }) {
  if (!error) return null
  return <div role="status" className="my-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
    <p>{error}</p>
    <button type="button" onClick={retry} className="mt-1 min-h-11 rounded-lg px-2 font-semibold">연결 다시 확인</button>
  </div>
}
