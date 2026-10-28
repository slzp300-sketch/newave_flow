import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { safetyApi } from '../../api/safety'
import { PHOTO_STATUS } from '../../utils/communitySafety'
import useAuthStore from '../../store/authStore'

export default function PhotoReviewStatus({ targetType, targetId, onRemoved, textClassName = 'text-xs leading-5' }) {
  const { user, apiEnvironment } = useAuthStore()
  const [confirm, setConfirm] = useState(false)
  const qc = useQueryClient()
  const status = useQuery({
    queryKey: ['photo-review-status', apiEnvironment, user?.id, targetType, targetId],
    queryFn: () => safetyApi.photoStatus(targetType, targetId), enabled: !!targetId,
    refetchOnWindowFocus: 'always',
  })
  const remove = useMutation({ mutationFn: () => safetyApi.removePhoto(targetType, targetId), onSuccess: () => {
    setConfirm(false); qc.invalidateQueries({ queryKey: ['photo-review-status'] }); qc.invalidateQueries({ queryKey: ['safety-summary'] })
    qc.invalidateQueries(); onRemoved?.()
  } })
  return <div className={`w-full rounded-xl bg-gray-50 p-3 text-left ${textClassName}`}>
    <p>새 사진은 저장 후 관리자 검토를 거쳐 게시됩니다. 승인 전에는 기존 사진이 표시됩니다. JPG·PNG, 2MB 이하, 가로·세로 4,096px 이하로 올려주세요.</p>
    {status.isError && <p role="alert" className="mt-2 text-red-700">사진 검토 상태를 불러오지 못했습니다. <button type="button" className="min-h-11 underline" onClick={() => status.refetch()}>다시 시도</button></p>}
    {status.data && <p className="mt-2 font-semibold">사진 상태: {PHOTO_STATUS[status.data.status]}{status.data.reviewNote && <span className="mt-1 block break-words font-normal">{status.data.reviewNote}</span>}</p>}
    {status.data?.status === 'PENDING' && <div className="mt-2">
      {!confirm ? <button type="button" className="min-h-11 text-red-700 underline" onClick={() => setConfirm(true)}>사진 및 검토 요청 삭제</button> : <div>
        <p>현재 사진과 검토 중인 사진을 모두 삭제할까요?</p>
        <div className="flex gap-4"><button type="button" disabled={remove.isPending} onClick={() => remove.mutate()} className="min-h-11 font-semibold text-red-700">{remove.isPending ? '삭제 중…' : '모두 삭제'}</button><button type="button" disabled={remove.isPending} onClick={() => setConfirm(false)} className="min-h-11">취소</button></div>
      </div>}
    </div>}
    {remove.isError && <p role="alert" className="text-red-700">{remove.error.response?.data?.message || '삭제하지 못했습니다.'}</p>}
  </div>
}
