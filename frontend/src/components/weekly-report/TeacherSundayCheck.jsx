import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyReportsApi, reportError } from '../../api/weeklyReports'
import useAuthStore from '../../store/authStore'

export default function TeacherSundayCheck({ date }) {
  const qc = useQueryClient()
  const userId = useAuthStore(state => state.user?.id)
  const [message, setMessage] = useState('')
  const query = useQuery({ queryKey: ['weekly-worship', userId, date], queryFn: () => weeklyReportsApi.mine(date).then(r => r.data) })
  const save = useMutation({ mutationFn: status => weeklyReportsApi.saveMine(date, { status }),
    onSuccess: ({ data: row }) => { qc.setQueryData(['weekly-worship', userId, date], row); setMessage('저장됐어요.') },
    onError: async e => setMessage(await reportError(e)),
  })
  return <section className="teacher-worship" aria-label="나의 청소년부 예배 출석">
    <div className="teacher-worship-row"><div><strong>청소년부 예배 출석</strong></div>
      {query.isError ? <button type="button" onClick={() => query.refetch()}>다시 불러오기</button> : !query.data ? <p role="status">불러오는 중…</p> :
        <div className="teacher-status-buttons" role="group" aria-label="나의 청소년부 예배 출석">
          {[['PRESENT', '출석'], ['ABSENT', '불참']].map(([value, label]) => <button type="button" key={value} aria-pressed={query.data.status === value} aria-label={`나의 예배 ${label}`} disabled={save.isPending || query.isError} data-status={value} data-tone={value === 'ABSENT' ? 'absence' : undefined} onClick={() => { setMessage(''); save.mutate(value) }}>
            {query.data.status === value && <Check size={14} aria-hidden="true" />}{label}
          </button>)}
        </div>}
    </div>
    {query.data && !query.data.gender && <p className="teacher-profile-hint"><Link to="/profile">성별 등록</Link> · 출석 체크 가능</p>}
    {message && <p className="teacher-save-message" role="status">{message}</p>}
  </section>
}
