import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// 1. Add TAG_COLORS palette at the top
if (!src.includes('const TAG_COLORS =')) {
  src = src.replace('const ROLE_CONFIG', `const TAG_COLORS = [
  'bg-red-50 text-red-600 border-red-200',
  'bg-orange-50 text-orange-600 border-orange-200',
  'bg-amber-50 text-amber-600 border-amber-200',
  'bg-green-50 text-green-600 border-green-200',
  'bg-emerald-50 text-emerald-600 border-emerald-200',
  'bg-teal-50 text-teal-600 border-teal-200',
  'bg-cyan-50 text-cyan-600 border-cyan-200',
  'bg-sky-50 text-sky-600 border-sky-200',
  'bg-blue-50 text-blue-600 border-blue-200',
  'bg-indigo-50 text-indigo-600 border-indigo-200',
  'bg-violet-50 text-violet-600 border-violet-200',
  'bg-purple-50 text-purple-600 border-purple-200',
  'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200',
  'bg-pink-50 text-pink-600 border-pink-200',
  'bg-rose-50 text-rose-600 border-rose-200',
]

const ROLE_CONFIG`)
}

// 2. Add Reset Tags button to the top of TeacherRoster
const manageTagsBtn = `
        {/* 태그 관리 및 초기화 버튼 */}
        {canManageTags && (
          <div className="px-4 pt-3 pb-0 flex justify-end gap-2">
            <button
              onClick={async () => {
                if (window.confirm('정말 모든 태그를 삭제하고 초기화하시겠습니까?')) {
                  await tagsApi.deleteAll()
                  qc.invalidateQueries({ queryKey: ['tags'] })
                  qc.invalidateQueries({ queryKey: ['teacher-roster'] })
                }
              }}
              className="flex items-center gap-1.5 text-[12px] font-black text-red-500 bg-red-50 px-3 py-1.5 rounded-full active:scale-95 transition-all"
            >
              <Trash2 size={13} /> 태그 전체 초기화
            </button>
            <button
              onClick={() => setShowTagPool(true)}
              className="flex items-center gap-1.5 text-[12px] font-black text-primary-500 bg-primary-50 px-3 py-1.5 rounded-full active:scale-95 transition-all"
            >
              <Tag size={13} /> 태그 관리
            </button>
          </div>
        )}`

if (src.includes('{/* 태그 관리 버튼 */}')) {
  const startIdx = src.indexOf('{/* 태그 관리 버튼 */}')
  const endIdx = src.indexOf('<AnimatePresence mode="wait">')
  if (startIdx !== -1 && endIdx !== -1) {
    src = src.slice(0, startIdx) + manageTagsBtn + '\n\n        ' + src.slice(endIdx)
  }
}


// 3. Update TeacherCard to use tag.color instead of default primary
src = src.replace(
  '<span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 truncate w-full">{firstTag.name}</span>',
  '<span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full truncate w-full ${firstTag.color || "bg-primary-50 text-primary-600 border border-primary-100"}`}>{firstTag.name}</span>'
)

// 4. Update TeacherDetailSheet to use tag.color
src = src.replace(
  '<span key={t.id} className="text-[11px] font-black px-2.5 py-1 rounded-full bg-primary-50 text-primary-600">',
  '<span key={t.id} className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${t.color || "bg-primary-50 text-primary-600 border-primary-200"}`}>'
)

src = src.replace(
  `assigned ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-gray-100 bg-gray-50 text-gray-400'`,
  `assigned ? (tag.color || 'border-primary-400 bg-primary-50 text-primary-600') : 'border-gray-100 bg-gray-50 text-gray-400'`
)


// 5. Update TagPoolModal
const oldModal = src.slice(
  src.indexOf('\n// ── 태그 풀 관리 모달'),
  src.indexOf('\nfunction InfoRow(')
)

const newModal = `
// ── 태그 풀 관리 모달 (목사님 전용) ──────────────────────
function TagPoolModal({ tags, execTags, teacherTags, onClose, onChanged }) {
  const [tagTab, setTagTab] = useState('EXECUTIVE')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [selectedColor, setSelectedColor] = useState('')

  const currentTags = tagTab === 'EXECUTIVE' ? execTags : teacherTags

  const getLeastUsedColor = () => {
    const colorCounts = {}
    TAG_COLORS.forEach(c => colorCounts[c] = 0)
    tags.forEach(t => {
      if (t.color && colorCounts[t.color] !== undefined) {
        colorCounts[t.color]++
      }
    })
    let leastUsed = TAG_COLORS[0]
    let minCount = Infinity
    for (const c of TAG_COLORS) {
      if (colorCounts[c] < minCount) {
        minCount = colorCounts[c]
        leastUsed = c
      }
    }
    return leastUsed
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const colorToUse = selectedColor || getLeastUsedColor()
      return tagsApi.create(newName.trim(), tagTab, colorToUse)
    },
    onSuccess: () => { setNewName(''); setSelectedColor(''); onChanged() },
  })

  const updateMutation = useMutation({
    mutationFn: () => tagsApi.update(editingId, editName.trim(), tagTab, selectedColor || getLeastUsedColor()),
    onSuccess: () => { setEditingId(null); setSelectedColor(''); onChanged() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => tagsApi.delete(id),
    onSuccess: onChanged,
  })

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-black/40 z-[60]" />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className="w-full max-w-[360px] bg-white rounded-3xl pointer-events-auto shadow-2xl flex flex-col"
          style={{ maxHeight: '82vh' }}
        >
          <div className="flex flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="font-black text-gray-900">태그 관리</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">태그를 만들고 임원·교사에게 부여하세요</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:scale-90 transition-transform">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            {/* 임원/교사 탭 */}
            <div className="flex border-b border-gray-100 mx-5 mb-3">
              <button
                onClick={() => { setTagTab('EXECUTIVE'); setNewName(''); setEditingId(null); setSelectedColor('') }}
                className={\`flex-1 py-2 text-xs font-black border-b-2 transition-all \${
                  tagTab === 'EXECUTIVE' ? 'border-amber-400 text-amber-600' : 'border-transparent text-gray-400'
                }\`}
              >임원 태그</button>
              <button
                onClick={() => { setTagTab('TEACHER'); setNewName(''); setEditingId(null); setSelectedColor('') }}
                className={\`flex-1 py-2 text-xs font-black border-b-2 transition-all \${
                  tagTab === 'TEACHER' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
                }\`}
              >교사 태그</button>
            </div>
          </div>

          <div className="px-5 flex flex-col gap-2 overflow-y-auto flex-1 py-1 relative">
            {currentTags.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">아직 태그가 없습니다</p>
            )}
            {currentTags.map(tag => (
              <div key={tag.id} className={\`flex flex-col gap-2 px-3 py-2.5 rounded-xl border \${editingId === tag.id ? 'bg-white shadow-sm border-gray-200' : 'bg-gray-50 border-transparent'}\`}>
                <div className="flex items-center gap-2">
                  {editingId === tag.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 text-sm font-bold bg-white border border-primary-200 rounded-lg px-2 py-1 outline-none"
                      />
                      <button
                        onClick={() => updateMutation.mutate()}
                        disabled={!editName.trim() || updateMutation.isPending}
                        className="text-[11px] font-black text-primary-600 px-2 py-1 rounded-lg bg-primary-50 active:scale-95 disabled:opacity-50"
                      >저장</button>
                      <button onClick={() => { setEditingId(null); setSelectedColor('') }} className="text-[11px] font-black text-gray-400">취소</button>
                    </>
                  ) : (
                    <>
                      <span className={\`text-[11px] font-black px-2 py-0.5 rounded-full border \${tag.color || "bg-primary-50 text-primary-600"}\`}>{tag.name}</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => { setEditingId(tag.id); setEditName(tag.name); setSelectedColor(tag.color || '') }}
                        className="text-[10px] font-black text-gray-400 px-2 py-1 rounded-lg hover:bg-gray-100"
                      >수정</button>
                      <button
                        onClick={() => deleteMutation.mutate(tag.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg active:scale-90 transition-all"
                      ><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
                {/* 편집 중 색상 팔레트 */}
                {editingId === tag.id && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                    {TAG_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}\`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 mt-2 flex-shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {tagTab === 'EXECUTIVE' ? '임원' : '교사'} 태그 추가
            </p>
            {/* 색상 선택 (추가 모드) */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setSelectedColor('')}
                className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-black \${!selectedColor ? 'border-gray-800 bg-gray-100' : 'border-gray-200 bg-gray-50 text-gray-400'}\`}
              >?</button>
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}\`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newName.trim() && createMutation.mutate()}
                placeholder="태그 이름 입력"
                maxLength={30}
                className="flex-1 text-sm font-bold px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex items-center gap-1 px-3 py-2.5 bg-primary-500 text-white text-sm font-black rounded-xl active:scale-95 disabled:opacity-50 transition-all"
              ><Plus size={15} /></button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
`

if (oldModal.trim()) {
  src = src.replace(oldModal, newModal)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster colors patch applied successfully')
