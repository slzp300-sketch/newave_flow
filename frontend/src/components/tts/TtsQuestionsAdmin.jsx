import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { ttsApi } from '../../api/tts'
import client from '../../api/client'
import useAuthStore from '../../store/authStore'
import AdminReadGuard from '../common/AdminReadGuard'
import DisclosureSummary from '../common/DisclosureSummary'
import SegmentedControl from '../common/SegmentedControl'
import Button from '../common/Button'
import LegacyImportCard from './LegacyImportCard'
import TtsIconPicker from './TtsIconPicker'
import { ttsQuestionError, ttsQuestionPayload } from '../../utils/ttsAdminCompact'

let localKey = 0
const draftRows = rows => rows.map(row => ({ ...row, points: row.points ?? (row.type === 'DAYS' ? 5 : 10), _key: row.id != null ? `question-${row.id}` : `new-${++localKey}` }))
const links = [{ value: 'NONE', label: '직접 체크' }, { value: 'SAT_MEETING', label: '교사회의' }, { value: 'PRAYER_MEETING', label: '기도모임' }]

export default function TtsQuestionsAdmin({ active }) {
  const { user, apiEnvironment } = useAuthStore()
  const qc = useQueryClient(), busy = useRef(false), errorNode = useRef(null)
  const key = ['tts-questions', 'all', apiEnvironment, user?.id]
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => client.get('/admin/tts/questions', { signal }).then(r => r.data) })
  const [rows, setRows] = useState([])
  const [dirty, setDirty] = useState(false)
  const [openKey, setOpenKey] = useState(null)
  const [removeKey, setRemoveKey] = useState(null)
  const [discarding, setDiscarding] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { if (query.data && !dirty) setRows(draftRows(query.data)) }, [query.data, dirty])
  useEffect(() => {
    if (!dirty) return
    const prevent = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', prevent)
    return () => window.removeEventListener('beforeunload', prevent)
  }, [dirty])
  useEffect(() => { if (active && error) errorNode.current?.focus() }, [error, active])
  const mutation = useMutation({ mutationFn: data => ttsApi.updateQuestions(data), onSuccess: response => {
    qc.setQueryData(key, response.data); setRows(draftRows(response.data)); setDirty(false); setOpenKey(null); setRemoveKey(null)
    setMessage('저장 완료 · 다음 주일부터 적용'); void qc.invalidateQueries({ queryKey: ['tts-questions'] })
  } })
  const update = (rowKey, patch) => {
    setRows(previous => previous.map(row => row._key === rowKey ? { ...row, ...patch } : row))
    setDirty(true); setError(''); setMessage('')
  }
  const add = () => {
    const row = { _key: `new-${++localKey}`, title: '새로운 항목', type: 'DAYS', emoji: '✨', points: 5, linkType: 'NONE', displayOrder: Math.max(0, ...rows.map(row => row.displayOrder || 0)) + 1, active: true }
    setRows(previous => [...previous, row]); setOpenKey(row._key); setDirty(true); setMessage(''); setError('')
  }
  const remove = rowKey => { setRows(previous => previous.filter(row => row._key !== rowKey)); setRemoveKey(null); setOpenKey(null); setDirty(true); setMessage(''); setError('') }
  const discard = () => { setRows(draftRows(query.data || [])); setDirty(false); setOpenKey(null); setRemoveKey(null); setDiscarding(false); setError(''); setMessage('변경 취소 완료') }
  const submit = async event => {
    event.preventDefault()
    if (busy.current || !dirty) return
    const invalid = rows.find(row => ttsQuestionError(row))
    if (invalid) { setOpenKey(invalid._key); setError(ttsQuestionError(invalid)); return }
    busy.current = true; setError(''); setMessage(''); setDiscarding(false); setRemoveKey(null)
    try { await mutation.mutateAsync(ttsQuestionPayload(rows)) }
    catch (e) { setError(e.response?.data?.message || '저장하지 못했습니다. 다시 시도해 주세요.') }
    finally { busy.current = false }
  }
  return <section className="tts-admin-body" aria-label="TTS 항목 관리">
    <AdminReadGuard queries={[query]} label="TTS 항목" reserveStatusSpace={false}>
      <div className="tts-admin-heading"><h2 className="ui-section-title">체크 항목</h2><Button type="button" size="sm" disabled={mutation.isPending} onClick={add}><Plus size={16} aria-hidden="true" />항목 추가</Button></div>
      <p className="tts-admin-note">변경은 다음 주일부터 · 이전 기록·배점 유지</p>
      {message && <p role="status" className="tts-admin-success">{message}</p>}
      <form onSubmit={submit} noValidate>
        <fieldset disabled={mutation.isPending} className="tts-admin-question-list">
          {!rows.length && <p className="tts-admin-empty">등록된 항목이 없습니다.</p>}
          {rows.map((row, index) => <details key={row._key} open={openKey === row._key} className="tts-admin-question">
            <DisclosureSummary aria-label={`${row.title || `항목 ${index + 1}`} 수정`} onClick={event => { event.preventDefault(); setOpenKey(openKey === row._key ? null : row._key); setRemoveKey(null) }}>
              <span className="tts-admin-question-heading"><span className="tts-admin-question-name">{row.emoji} {row.title || '이름 없음'}</span><span className="tts-admin-card-meta">{row.type === 'DAYS' ? '하루' : '참석'} {row.points === '' ? '—' : row.points ?? 0}점 · {row.active ? '사용 중' : '사용 안 함'}</span></span>
            </DisclosureSummary>
            <div className="tts-admin-question-editor">
              <label className="tts-admin-field">항목 이름<input aria-label={`항목 ${index + 1} 이름`} value={row.title} maxLength={200} onChange={e => update(row._key, { title: e.target.value })} /></label>
              <div className="tts-admin-field-pair">
                <TtsIconPicker label={`항목 ${index + 1} 아이콘`} value={row.emoji || ''} disabled={mutation.isPending} onChange={emoji => update(row._key, { emoji })} />
                <label className="tts-admin-field">{row.type === 'DAYS' ? '하루 배점' : '참석 배점'}<input aria-label={`항목 ${index + 1} 배점`} type="number" min="0" max="10000" step="1" value={row.points ?? ''} onChange={e => update(row._key, { points: e.target.value })} /></label>
              </div>
              <div className="tts-admin-field"><span>체크 방식</span><SegmentedControl label={`항목 ${index + 1} 체크 방식`} value={row.type} onChange={type => update(row._key, { type, ...(type === 'DAYS' ? { linkType: 'NONE' } : {}) })} options={[{ value: 'DAYS', label: '요일별' }, { value: 'ATTEND', label: '참석 여부' }]} /></div>
              {row.type === 'ATTEND' && <div className="tts-admin-field"><span>기록 연결</span><SegmentedControl label={`항목 ${index + 1} 기록 연결`} value={row.linkType || 'NONE'} onChange={linkType => update(row._key, { linkType })} options={links} /></div>}
              <label className="tts-admin-active"><input type="checkbox" aria-label={`항목 ${index + 1} 사용`} checked={!!row.active} onChange={e => update(row._key, { active: e.target.checked })} />{row.active ? '사용 중' : '사용 안 함'}</label>
              {removeKey === row._key ? <div className="tts-admin-confirm" role="alertdialog" aria-label="항목 삭제 확인"><p>다음 주부터 사용하지 않을까요? 이전 기록은 유지됩니다.</p><div className="tts-admin-actions"><Button type="button" size="sm" onClick={() => remove(row._key)}>삭제 확인</Button><Button type="button" size="sm" variant="secondary" onClick={() => setRemoveKey(null)}>취소</Button></div></div>
                : <button type="button" className="tts-admin-delete" onClick={() => setRemoveKey(row._key)}><Trash2 size={16} aria-hidden="true" />항목 삭제</button>}
            </div>
          </details>)}
        </fieldset>
        {dirty && <div className="tts-admin-save">
          {error && <p ref={errorNode} tabIndex={-1} role="alert" className="tts-admin-error">{error}</p>}
          {discarding ? <div className="tts-admin-confirm" role="alertdialog" aria-label="변경 취소 확인"><p>저장하지 않은 변경을 취소할까요?</p><div className="tts-admin-actions"><Button type="button" size="sm" disabled={mutation.isPending} onClick={discard}>변경 취소</Button><Button type="button" size="sm" variant="secondary" onClick={() => setDiscarding(false)}>계속 수정</Button></div></div>
            : <><p role="status" className="tts-admin-note">{mutation.isPending ? '저장 중…' : '저장하지 않은 변경사항'}</p><div className="tts-admin-actions"><Button type="submit" size="sm" loading={mutation.isPending}><Save size={16} aria-hidden="true" />변경 저장</Button><Button type="button" size="sm" variant="secondary" disabled={mutation.isPending} onClick={() => setDiscarding(true)}>변경 취소</Button></div></>}
        </div>}
      </form>
    </AdminReadGuard>
    <details className="tts-admin-import"><DisclosureSummary>시트 점수 가져오기</DisclosureSummary><LegacyImportCard /></details>
  </section>
}
