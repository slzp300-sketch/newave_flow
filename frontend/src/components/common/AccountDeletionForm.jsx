import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Card from './Card'
import Button from './Button'
import useAuthStore from '../../store/authStore'
import { flushAuthStorage, nativePlatform } from '../../native/platform'
import { clearKakaoPending } from '../../auth/kakao'
import { beginApple, clearApplePending, isAppleCancellation } from '../../auth/apple'
import { deletionCredentials } from '../../auth/accountDeletionProof'
import { accountDeletionApi, deletionReceiptStore } from '../../api/accountDeletion'
import { deletionStatusLabel, parseDeletionReceipt } from '../../auth/deletionReceipt'

const dateLabel = value => value ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long' }).format(new Date(value)) : '확인 중'
const errorLabel = error => error?.response?.data?.message || error?.message || '잠시 후 다시 시도해 주세요.'

export default function AccountDeletionForm() {
  const { user, apiEnvironment, clearAuth, setAppleCheckPaused } = useAuthStore()
  const queryClient = useQueryClient()
  const [receipt, setReceipt] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [manualReview, setManualReview] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)
  const current = useQuery({ queryKey: ['account-deletion', apiEnvironment, user?.id],
    queryFn: accountDeletionApi.current, enabled: !!user, retry: false })
  const reauthenticationMethod = current.data?.reauthenticationMethod || (user?.passwordLoginEnabled === false ? 'APPLE' : 'PASSWORD')
  const usesApple = reauthenticationMethod === 'APPLE'
  const canReauthenticate = usesApple ? nativePlatform === 'ios' : !!password
  const status = useQuery({ queryKey: ['deletion-receipt', receipt?.apiEnvironment, receipt?.requestId, receipt?.savedAt],
    queryFn: () => accountDeletionApi.status(receipt), enabled: !!receipt, retry: false })
  useEffect(() => {
    let active = true
    deletionReceiptStore.read().then(value => { if (active) setReceipt(value) })
      .catch(() => { if (active) setWarning('이 기기의 접수증을 읽지 못했습니다. 저장한 조회 코드가 있으면 아래에서 확인해 주세요.') })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [])
  const remember = async value => {
    setReceipt(value)
    try { await deletionReceiptStore.save(value) }
    catch { setWarning('신청은 접수됐지만 이 기기에 접수증을 저장하지 못했습니다. 아래 조회 코드를 따로 보관해 주세요.') }
  }
  const submit = async event => {
    event.preventDefault()
    if (!loaded || !confirmed || !canReauthenticate || busy || current.isError || current.isPending) return
    setBusy(true); setError(''); setWarning('')
    setAppleCheckPaused(true)
    let accepted = false
    let submitted = false
    try {
      const credentials = await deletionCredentials(reauthenticationMethod, { password, beginApple })
      submitted = true
      const data = await accountDeletionApi.submit(credentials)
      accepted = true
      const saved = parseDeletionReceipt({ ...data, apiEnvironment, savedAt: Date.now() })
      if (!saved) throw new Error('접수는 완료됐지만 조회 코드를 받지 못했습니다. 아래 고객지원으로 처리 상태를 확인해 주세요.')
      await remember(saved)
    } catch (err) {
      if (!isAppleCancellation(err)) setError(!err.response && !accepted && submitted
        ? '응답을 받지 못해 접수 여부를 확인할 수 없습니다. 저장된 접수증이나 아래 고객지원으로 신청 상태를 확인해 주세요.' : errorLabel(err))
    }
    finally {
      setPassword('')
      try {
        if (accepted) {
          // The server invalidates all sessions when accepting the request. Keep receipt state independent.
          try { await queryClient.cancelQueries() }
          finally { queryClient.clear(); clearAuth(); clearApplePending() }
          await flushAuthStorage(); await clearKakaoPending()
        }
      } catch { setWarning('접수는 완료됐습니다. 기기의 로그인 정보 정리를 마치려면 앱을 다시 실행해 주세요. 조회 코드는 따로 보관할 수 있습니다.') }
      finally {
        setAppleCheckPaused(false); setBusy(false)
      }
    }
  }
  const importReceipt = async event => {
    event.preventDefault()
    if (!loaded || busy) return
    setError(''); setWarning('')
    const saved = parseDeletionReceipt({ receiptToken: manualToken.trim(), apiEnvironment: manualReview ? 'review' : 'production', savedAt: Date.now() })
    if (!saved) { setError('43자리 조회 코드를 확인해 주세요.'); return }
    setBusy(true)
    try {
      const data = await accountDeletionApi.status(saved)
      await remember({ ...saved, requestId: data.requestId })
      setManualToken('')
    } catch (err) { setError(errorLabel(err)) }
    finally { setBusy(false) }
  }
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(receipt.receiptToken); setCopied(true) }
    catch { setShowCode(true); setWarning('조회 코드를 길게 눌러 복사해 주세요.') }
  }
  const forgetReceipt = async () => {
    try { await deletionReceiptStore.clear(); setReceipt(null); setShowCode(false); setCopied(false); setWarning('') }
    catch { setWarning('기기의 접수증을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.') }
  }
  const currentRequest = current.data?.status === 'REQUESTED'
  const record = status.data
  return <>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {warning && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{warning}</p>}
    {!loaded && <Card><p role="status" className="text-sm">저장된 접수증을 확인하고 있습니다.</p></Card>}
    {receipt && <Card>
      <h3 className="font-bold text-lg">{deletionStatusLabel(record?.status)}</h3>
      {receipt.apiEnvironment === 'review' && <p className="mt-2 text-xs text-amber-800">가상 테스트 계정의 접수증입니다.</p>}
      {status.isPending && <p role="status" className="mt-3 text-sm">처리 상태를 확인하고 있습니다.</p>}
      {status.isError && <p role="alert" className="mt-3 text-sm text-red-700">{errorLabel(status.error)}</p>}
      {record && <>
        <p role="status" className="mt-3 text-sm leading-6 text-gray-700">{record.message}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div><dt className="text-gray-500">접수 번호</dt><dd className="break-all font-mono text-xs mt-1">{record.requestId}</dd></div>
          <div><dt className="text-gray-500">신청일</dt><dd>{dateLabel(record.requestedAt)}</dd></div>
          <div><dt className="text-gray-500">{record.status === 'COMPLETED' ? '처리 완료일' : '처리 목표일'}</dt><dd>{dateLabel(record.completedAt || record.targetAt)}</dd></div>
        </dl>
        {record.status === 'REQUESTED' && new Date(record.targetAt) < new Date() && <p className="mt-3 text-sm text-amber-800">목표일이 지났습니다. 아래 고객지원에서 접수 번호로 진행 상황을 문의할 수 있습니다.</p>}
      </>}
      <Button className="mt-4 w-full" variant="secondary" onClick={() => status.refetch()} loading={status.isFetching}>처리 상태 새로고침</Button>
      <details className="mt-4 text-sm"><summary className="cursor-pointer min-h-11 py-3 font-semibold">접수증 보관·조회 코드</summary>
        <p className="text-xs leading-5 text-gray-500">로그인 없이 완료 여부를 확인하는 코드입니다. 앱을 삭제하거나 기기를 바꾸기 전에 보관하고 다른 사람에게 공유하지 마세요.</p>
        <label htmlFor="deletion-receipt-code" className="sr-only">계정 삭제 조회 코드</label>
        <input id="deletion-receipt-code" className="input-field mt-3 font-mono text-xs" type={showCode ? 'text' : 'password'} value={receipt.receiptToken} readOnly />
        <div className="flex gap-2 mt-2"><button type="button" className="min-h-11 px-3 text-primary-700" onClick={() => setShowCode(v => !v)}>{showCode ? '코드 숨기기' : '코드 보기'}</button>
          <button type="button" className="min-h-11 px-3 text-primary-700" onClick={copyCode}>{copied ? '복사됨' : '조회 코드 복사'}</button></div>
        {(record?.status === 'COMPLETED' || status.error?.response?.status === 404) && <>
          <button type="button" onClick={forgetReceipt} className="mt-2 min-h-11 text-gray-500 underline">이 기기에서 접수증 지우기</button>
          <p className="text-xs leading-5 text-gray-500">기기에 저장된 조회 코드만 지웁니다. 삭제 요청의 처리 상태는 바뀌지 않습니다.</p>
        </>}
      </details>
    </Card>}
    {user ? <Card>
      <h3 className="font-bold">{currentRequest ? '신청한 삭제 요청' : '앱에서 계정 삭제 신청'}</h3>
      {current.isPending && <p role="status" className="mt-3 text-sm">현재 신청 상태를 확인하고 있습니다.</p>}
      {current.isError && <div className="mt-3"><p role="alert" className="text-sm text-red-700">{errorLabel(current.error)}</p><button type="button" onClick={() => current.refetch()} className="min-h-11 text-primary-700">다시 확인</button></div>}
      {currentRequest && <p className="mt-3 text-sm leading-6">{current.data.message}<br />처리 목표일: {dateLabel(current.data.targetAt)}</p>}
      {!current.isPending && !current.isError && <form onSubmit={submit} className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-gray-600">{currentRequest ? '조회 코드를 분실했다면 본인 확인 후 접수증을 다시 저장할 수 있습니다. 기존 조회 코드는 더 이상 사용할 수 없습니다.' : '본인 확인 후 요청이 접수됩니다. 공동 문서의 개인정보까지 확인한 뒤 삭제하며, 처리 완료를 이 화면에서 확인할 수 있습니다.'}</p>
        {usesApple ? <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6">{nativePlatform === 'ios'
          ? '아래 버튼을 누르면 Apple로 본인을 확인한 뒤 삭제 요청을 접수합니다. 별도 앱 비밀번호는 필요하지 않습니다.'
          : 'Apple로 가입한 계정입니다. iPhone 앱에서 Apple로 본인을 확인하고 삭제를 신청해 주세요. 앱을 이용할 수 없다면 아래 고객지원으로 요청할 수 있습니다.'}</p> : <>
          <label className="block text-sm font-semibold" htmlFor="deletion-password">현재 앱 비밀번호</label>
          <input id="deletion-password" type="password" autoComplete="current-password" className="input-field" maxLength={200} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        </>}
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} className="mt-1 size-5 shrink-0" />
          <span>계정·개인 자료 삭제와 공동 기록 익명화를 요청합니다. 신청 후 로그아웃되며, 연결된 Apple 로그인도 해제됩니다. 삭제가 완료되면 복구할 수 없음을 확인했습니다.</span></label>
        <Button type="submit" className="w-full" loading={busy} disabled={!loaded || !canReauthenticate || !confirmed}>{currentRequest ? '접수증 다시 저장' : usesApple ? 'Apple로 확인하고 삭제 요청' : '계정 삭제 요청 접수'}</Button>
        <p className="text-xs leading-5 text-gray-500">접수 시 바로 삭제되는 것은 아닙니다. {usesApple ? 'Apple 연결이 해제되므로 접수증으로 처리 상태를 확인해 주세요.' : '완료 전에는 이메일·비밀번호로 다시 로그인할 수 있습니다.'}</p>
      </form>}
    </Card> : !receipt && loaded && <Card><h3 className="font-bold">앱에서 삭제 요청하기</h3>
      <p className="mt-3 text-sm leading-6 text-gray-600">로그인한 뒤 이 화면에서 본인을 확인하고 계정 삭제를 신청할 수 있습니다.</p>
      <Link to="/login" className="brand-action mt-4 flex min-h-12 items-center justify-center rounded-xl font-semibold">로그인하기</Link></Card>}
    <Card><details><summary className="min-h-11 py-2 cursor-pointer text-sm font-semibold">보관한 조회 코드로 확인하기</summary>
      <form onSubmit={importReceipt} className="space-y-3 mt-3"><label htmlFor="saved-deletion-code" className="text-sm">계정 삭제 조회 코드</label>
        <input id="saved-deletion-code" autoComplete="off" spellCheck={false} className="input-field font-mono text-xs" value={manualToken} onChange={e => setManualToken(e.target.value)} maxLength={64} required />
        <label className="flex items-center gap-2 text-xs leading-5"><input type="checkbox" checked={manualReview} onChange={e => setManualReview(e.target.checked)} />가상 테스트 계정으로 신청한 접수증</label>
        <Button type="submit" variant="secondary" className="w-full" disabled={!loaded || !manualToken.trim()} loading={busy}>접수증 확인</Button>
      </form></details></Card>
  </>
}
