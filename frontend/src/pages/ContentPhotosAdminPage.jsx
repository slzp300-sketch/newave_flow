import { Collapse } from '../components/common/Motion'
import './SupportingReadability.css'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Header from '../components/layout/Header'
import SafetySummary from '../components/common/SafetySummary'
import useAuthStore from '../store/authStore'
import { safetyApi } from '../api/safety'
import { PHOTO_STATUS } from '../utils/communitySafety'

const field = 'mt-2 min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base'
export default function ContentPhotosAdminPage() {
  const { user, apiEnvironment } = useAuthStore()
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(0)
  const qc = useQueryClient()
  const key = ['photo-review-queue', apiEnvironment, user?.id]
  const queue = useQuery({ queryKey: [...key, status, page], queryFn: () => safetyApi.photos(page, status), refetchOnWindowFocus: 'always' })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ['safety-summary'] })
    qc.invalidateQueries({ queryKey: ['photo-review-status'] }); qc.invalidateQueries({ queryKey: ['my-profile'] })
  }
  return <div className="supporting-readable readable-content pb-8"><Header title="사진 게시 검토" showBack showNotification={false} />
    <div className="space-y-5 px-4 py-5">
      <SafetySummary />
      <p className="text-sm leading-6 text-gray-600">새 사진은 승인 전까지 게시되지 않습니다. 초상권·개인정보 침해나 부적절한 내용이 없는지 확인하고 결과를 남겨주세요.</p>
      <label className="block text-sm font-semibold">사진 상태<select aria-label="사진 상태 필터" className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}>{Object.entries(PHOTO_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {queue.isPending && <p role="status">불러오는 중…</p>}
      {queue.isError && <p role="alert" className="text-sm text-red-700">사진 목록을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => queue.refetch()}>다시 시도</button></p>}
      {queue.data?.content.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-500">이 상태의 사진이 없습니다.</p>}
      {queue.data?.content.map(photo => <PhotoCard key={`${photo.id}-${photo.revision}`} photo={photo} onSaved={refresh} scope={[apiEnvironment, user?.id]} />)}
      {queue.data?.totalPages > 1 && <div className="flex items-center justify-between text-sm"><button className="min-h-11 px-3 disabled:opacity-30" disabled={!page} onClick={() => setPage(page - 1)}>이전</button><span>{page + 1} / {queue.data.totalPages}</span><button className="min-h-11 px-3 disabled:opacity-30" disabled={queue.data.last} onClick={() => setPage(page + 1)}>다음</button></div>}
    </div></div>
}
function PhotoCard({ photo, onSaved, scope }) {
  const [opened, setOpened] = useState(false)
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [checked, setChecked] = useState(false)
  const image = useQuery({ queryKey: ['photo-review-image', ...scope, photo.id, photo.revision], queryFn: () => safetyApi.photoImage(photo.id), enabled: opened && photo.status === 'PENDING', gcTime: 0, staleTime: 0 })
  const currentImage = image.data?.revision === photo.revision ? image.data.image : null
  const save = useMutation({ mutationFn: () => safetyApi.reviewPhoto(photo.id, { decision, expectedRevision: photo.revision, note: note.trim() }), onSuccess: onSaved })
  return <article className="rounded-2xl border border-gray-200 bg-white p-4">
    <p className="text-xs font-semibold text-primary-700">{PHOTO_STATUS[photo.status]} · {photo.targetType === 'USER' ? '교사' : '학생'}</p>
    <h2 className="mt-2 break-words text-lg font-semibold">{photo.targetName}</h2><p className="mt-2 text-xs text-gray-500">신청 {photo.submittedAt?.replace('T', ' ').slice(0, 16)}</p>
    {photo.status !== 'PENDING' ? <p className="mt-3 whitespace-pre-wrap break-words text-sm">{photo.reviewNote}</p> : <>
      <button className="mt-3 min-h-12 w-full rounded-xl border border-gray-300 px-4 text-sm font-semibold" aria-expanded={opened} onClick={() => { setOpened(!opened); setChecked(false) }}>{opened ? '사진 닫기' : '검토할 사진 열기'}</button>
      <Collapse open={opened} className="mt-3">
        {image.isPending && <p role="status">사진을 불러오는 중…</p>}
        {image.isError && <p role="alert" className="text-sm text-red-700">사진을 불러오지 못했습니다. <button className="min-h-11 underline" onClick={() => image.refetch()}>다시 시도</button></p>}
        {currentImage && <img src={currentImage} alt={`${photo.targetName}의 검토 대기 사진`} className="max-h-72 w-full rounded-xl object-contain" />}
        {image.data && !currentImage && <p role="alert" className="text-sm text-red-700">사진이 변경되었습니다. <button className="min-h-11 underline" onClick={onSaved}>최신 요청 불러오기</button></p>}
      </Collapse>
      <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); save.mutate() }}>
        <label className="block text-sm font-semibold">검토 결과<select className={field} required value={decision} onChange={e => { setDecision(e.target.value); setChecked(false) }}><option value="">결과 선택</option><option value="APPROVED">게시 승인</option><option value="REJECTED">게시 거절</option></select></label>
        <label className="block text-sm font-semibold">처리 안내<textarea required maxLength={2000} rows={3} className={field} value={note} onChange={e => setNote(e.target.value)} placeholder="확인 결과를 적어주세요. 사진 신청자에게 표시됩니다." /></label>
        {decision === 'APPROVED' && <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={!opened || !currentImage || image.isError} checked={checked} onChange={e => setChecked(e.target.checked)} /><span>위 사진을 확인했으며 게시를 승인합니다.</span></label>}
        {save.isError && <p role="alert" className="text-sm text-red-700">{save.error.response?.data?.message || '처리 결과를 저장하지 못했습니다.'}{save.error.response?.status === 409 && <button type="button" className="min-h-11 underline" onClick={onSaved}>최신 요청 불러오기</button>}</p>}
        <button disabled={save.isPending || !decision || !note.trim() || (decision === 'APPROVED' && (!checked || !opened || !currentImage || image.isError))} className="min-h-12 w-full rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{save.isPending ? '저장 중…' : '검토 결과 저장'}</button>
      </form>
    </>}
  </article>
}
