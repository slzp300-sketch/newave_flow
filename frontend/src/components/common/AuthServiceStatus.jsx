export default function AuthServiceStatus({ provider, environment, query, onRetry }) {
  if (environment === 'review') return <p role="status" className="mt-2 text-sm leading-6 text-amber-900">
    가상 계정은 이메일 로그인 전용 · {provider}는 일반 계정에서 이용
  </p>
  if (query.isError) return <div role="alert" className="mt-2 text-sm leading-6 text-red-700">
    <p>{provider} 연결 확인 실패 · 다시 시도하세요.</p>
    <button type="button" className="min-h-11 underline font-semibold" onClick={onRetry}>연결 상태 다시 확인</button>
  </div>
  if (query.isPending) return <p role="status" className="mt-2 text-sm leading-6 text-gray-600">{provider} 연결 상태를 확인하고 있습니다.</p>
  return <div role="status" className="mt-2 text-sm leading-6 text-gray-600">
    <p>현재 {provider} 연결 불가 · 이메일 로그인 또는 고객지원 이용</p>
    <button type="button" className="min-h-11 underline font-semibold" onClick={onRetry}>연결 상태 다시 확인</button>
  </div>
}
