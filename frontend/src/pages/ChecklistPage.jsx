import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle2, Circle, Save } from 'lucide-react'
import client from '../api/client'
import { toApiDate, formatDate } from '../utils/date'
import Header from '../components/layout/Header'
import Button from '../components/common/Button'
import Card from '../components/common/Card'
import Badge from '../components/common/Badge'

export default function ChecklistPage() {
  const today = toApiDate()
  const [checks, setChecks] = useState({})
  const [notes, setNotes]   = useState({})
  const [saved, setSaved]   = useState(false)

  const { data: items = [] } = useQuery({
    queryKey: ['checklist-items'],
    queryFn:  () => client.get('/checklist/items').then(r => r.data),
  })

  const { data: records = [] } = useQuery({
    queryKey: ['checklist-records', today],
    queryFn:  () => client.get('/checklist/records', { params: { date: today } }).then(r => r.data),
  })

  // 기존 기록 반영
  useEffect(() => {
    if (records.length > 0) {
      const checkMap = {}, noteMap = {}
      records.forEach(r => {
        checkMap[r.checklistItemId] = r.isChecked
        noteMap[r.checklistItemId]  = r.note ?? ''
      })
      setChecks(checkMap)
      setNotes(noteMap)
    }
  }, [records])

  const toggle = (id) => setChecks(c => ({ ...c, [id]: !c[id] }))

  const { mutate: saveAll, isPending } = useMutation({
    mutationFn: () => client.post('/checklist/records', {
      date: today,
      records: items.map(item => ({
        checklistItemId: item.id,
        isChecked:       !!checks[item.id],
        note:            notes[item.id] ?? '',
      })),
    }),
    onSuccess: () => setSaved(true),
  })

  const doneCount     = items.filter(i => checks[i.id]).length
  const requiredTotal = items.filter(i => i.isRequired).length
  const requiredDone  = items.filter(i => i.isRequired && checks[i.id]).length
  const allRequiredDone = requiredDone === requiredTotal

  return (
    <div>
      <Header title="체크리스트" />

      {/* 진행률 */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600 font-medium">
            {formatDate(today)} 완료 현황
          </span>
          <span className="font-black text-primary-600">{doneCount}/{items.length}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all duration-500"
            style={{ width: items.length ? `${(doneCount / items.length) * 100}%` : '0%' }}
          />
        </div>
        {!allRequiredDone && (
          <p className="text-xs text-amber-600 mt-2">
            필수 항목 {requiredDone}/{requiredTotal} 완료
          </p>
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-2">
        {items.length === 0 ? (
          <Card className="py-12 text-center text-gray-400">
            <p className="text-sm">체크리스트 항목이 없습니다</p>
          </Card>
        ) : (
          items.map(item => {
            const isChecked = !!checks[item.id]
            return (
              <Card key={item.id} className={`transition-all ${isChecked ? 'border border-emerald-200 bg-emerald-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(item.id)}
                    className="mt-0.5 flex-shrink-0 transition-colors"
                  >
                    {isChecked
                      ? <CheckCircle2 size={22} className="text-emerald-500" />
                      : <Circle      size={22} className="text-gray-300" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-sm ${isChecked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {item.title}
                      </span>
                      {item.isRequired && <Badge variant="danger">필수</Badge>}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                    )}
                    {isChecked && (
                      <input
                        type="text"
                        value={notes[item.id] ?? ''}
                        onChange={e => setNotes(n => ({ ...n, [item.id]: e.target.value }))}
                        placeholder="메모 (선택)"
                        className="mt-2 w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-400"
                      />
                    )}
                  </div>
                </div>
              </Card>
            )
          })
        )}

        {items.length > 0 && (
          <div className="pt-2">
            {saved ? (
              <Card className="py-3 text-center text-emerald-600 font-semibold text-sm">
                ✅ 저장 완료!
              </Card>
            ) : (
              <Button size="lg" onClick={() => saveAll()} loading={isPending}>
                <Save size={18} />
                체크리스트 저장
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}