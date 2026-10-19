import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import Card from '../common/Card'
import Button from '../common/Button'
import { ttsApi } from '../../api/tts'
import { Disclosure } from '../common/Motion'

export default function LegacyImportCard() {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState('40-41')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [fromWeek, end] = scope.split('-').map(Number)
  const payload = { year: 2026, fromWeek, toWeek: end ?? fromWeek, text }
  const reset = () => { setPreview(null); setResult(null); setError(''); setConfirming(false) }
  const previewMutation = useMutation({
    mutationFn: () => ttsApi.previewLegacy(payload).then(r => r.data),
    onSuccess: data => { setPreview(data); setError(''); setConfirming(false) },
    onError: err => { setPreview(null); setError(err.response?.data?.message || '미리보기를 불러오지 못했습니다.') },
  })
  const applyMutation = useMutation({
    mutationFn: () => ttsApi.importLegacy({ ...payload, previewToken: preview?.previewToken }).then(r => r.data),
    onSuccess: data => {
      setResult(data); setPreview(null); setText(''); setError(''); setConfirming(false)
      for (const key of ['tts-stats', 'tts-quarterly-scores', 'tts-admin-summary', 'tts-week']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    },
    onError: err => { setPreview(null); setConfirming(false); setError(err.response?.data?.message || '반영하지 못했습니다. 다시 미리보기해 주세요.') },
  })
  const busy = previewMutation.isPending || applyMutation.isPending
  return (
    <Card className="flex flex-col gap-3 mt-6">
      <p className="font-bold text-gray-900 text-sm">2026년 4분기 시트 점수 가져오기</p>
      <p className="text-xs text-gray-500 leading-relaxed">
        이름과 40·41주차 제목을 포함한 표를 붙여넣으세요. 선택한 주차는 시트의 확정값을 사용하고, 42주차부터 앱으로 기록합니다.
      </p>
      <select aria-label="가져올 주차" value={scope} disabled={busy}
        onChange={e => { setScope(e.target.value); reset() }}
        className="self-start text-xs font-bold bg-gray-100 px-3 py-2 rounded-xl">
        <option value="40-41">40~41주차</option><option value="40">40주차만</option><option value="41">41주차만</option>
      </select>
      <textarea aria-label="시트 점수 표" rows={5} value={text} disabled={busy}
        onChange={e => { setText(e.target.value); reset() }} placeholder="이름과 주차 제목을 포함해 붙여넣기"
        className="w-full px-3 py-2 rounded-xl border border-gray-100 text-xs font-mono resize-none bg-gray-50" />
      <Button onClick={() => { setResult(null); previewMutation.mutate() }} loading={previewMutation.isPending} disabled={busy || !text.trim()}>
        미리보기
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      {preview && (
        <div className="flex flex-col gap-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          <p className="font-bold">{preview.names}명 · {preview.rows}건 · 합계 {preview.total.toLocaleString()}점</p>
          <p>0점 기록 {preview.zeroRows}건 · 빈칸 {preview.blankCells}칸 · 범위 밖 주차 열 {preview.excludedColumns}개 제외</p>
          <p>선택한 주차의 기존 시트 기록 {preview.replacedRows}건을 위 내용으로 교체합니다. 빈칸은 기록 없음으로 유지합니다.</p>
          <p>앱과 다른 점수 {preview.conflicts.length}건은 시트 값으로 집계합니다.</p>
          {preview.conflicts.length > 0 && <Disclosure title="점수 차이 확인">
            {preview.conflicts.map((c,i) => <p key={i} className="mt-1">{c.name} · {c.weekNum}주차: 앱 {c.appScore} → 시트 {c.sheetScore}점</p>)}
          </Disclosure>}
          {preview.appOnly.length > 0 && <Disclosure title={`시트에 없는 앱 점수 ${preview.appOnly.length}건 확인`}>
            <p className="mt-1">이 주차는 시트가 기준이므로 아래 점수는 집계에서 제외합니다. 원래 앱 기록은 보존합니다.</p>
            {preview.appOnly.map((c,i) => <p key={i} className="mt-1">{c.name} · {c.weekNum}주차 · {c.appScore}점</p>)}
          </Disclosure>}
          {(preview.unmatchedNames.length > 0 || preview.ambiguousNames.length > 0) && <Disclosure title="계정 연결 확인">
            <p className="mt-1">미가입 {preview.unmatchedNames.length}명과 동명이인 {preview.ambiguousNames.length}명은 시트 이름으로 따로 보존하며, 계정을 자동 생성하거나 임의 연결하지 않습니다.</p>
            <p className="mt-1 break-words">{[...preview.unmatchedNames, ...preview.ambiguousNames].join(', ')}</p>
          </Disclosure>}
          {confirming ? (
            <div role="group" aria-label="시트 점수 최종 확인" className="flex flex-col gap-2 border-t border-gray-200 pt-3">
              <p>2026년 {preview.fromWeek}~{preview.toWeek}주차 {preview.rows}건, {preview.total.toLocaleString()}점을 반영할까요?</p>
              <p>선택한 주차의 점수는 위 시트 내용으로 확정됩니다.</p>
              <Button disabled={busy} loading={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
                <Upload size={16} /> 최종 반영
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>취소</Button>
            </div>
          ) : <Button disabled={busy} onClick={() => setConfirming(true)}>확인한 점수 반영</Button>}
        </div>
      )}
      {result && <p role="status" className="text-xs font-bold text-primary-600">
        {result.fromWeek}~{result.toWeek}주차 · {result.names}명 · {result.rows}건 · {result.total.toLocaleString()}점 반영 완료
      </p>}
    </Card>
  )
}
