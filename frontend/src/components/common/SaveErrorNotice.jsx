import { requestErrorMessage } from '../../utils/requestFeedback'
import Button from './Button'

export default function SaveErrorNotice({ error, onRetry, disabled = false, preserved = false, operation = 'save', children, className = '' }) {
  if (!error) return null
  return <div role="alert" className={`rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-2 ${className}`}>
    <p>{typeof error === 'string' ? error : requestErrorMessage(error, operation)}</p>
    {preserved && <p className="text-xs">입력한 내용은 유지됩니다.</p>}
    {onRetry && <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={onRetry}>다시 저장</Button>}
    {children}
  </div>
}
