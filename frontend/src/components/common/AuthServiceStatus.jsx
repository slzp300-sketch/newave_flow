export default function AuthServiceStatus({ provider, environment, query, onRetry }) {
  if (environment === 'review') return <p role="status" className="mt-2 text-sm leading-6 text-amber-900">
    가상 자료 계정에는 외부 인증을 연결하지 않습니다. {provider} 인증은 일반 계정에서 이용할 수 있습니다. 가상 계정의 업무·관리 기능은 이메일 로그인으로 확인해 주세요.
  </p>
  if (query.isError) return <div role="alert" className="mt-2 text-sm leading-6 text-red-700">
    <p>{provider} 연결 상태를 확인하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
    <button type="button" className="min-h-11 underline font-semibold" onClick={onRetry}>연결 상태 다시 확인</button>
  </div>
  if (query.isPending) return <p role="status" className="mt-2 text-sm leading-6 text-gray-600">{provider} 연결 상태를 확인하고 있습니다.</p>
  return <div role="status" className="mt-2 text-sm leading-6 text-gray-600">
    <p>현재 {provider} 연결을 이용할 수 없습니다. 이메일 로그인 또는 고객지원을 이용해 주세요.</p>
    <button type="button" className="min-h-11 underline font-semibold" onClick={onRetry}>연결 상태 다시 확인</button>
  </div>
}
