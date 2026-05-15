import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// ── 1. TeacherRoster 함수 전체 교체 (line 262~435) ────────────────────────────
const oldTeacherRoster = src.slice(
  src.indexOf('// ── 교사 교적부 ─'),
  src.indexOf('\nfunction RosterSection(')
)

const newTeacherRoster = `// ── 교사 교적부 ─────────────────────────────────────────
function TeacherRoster() {
  const { user: me } = useAuthStore()
  const canManageTags = me?.role === 'PASTOR' || me?.role === 'ADMIN'
  const qc = useQueryClient()

  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [activeTab, setActiveTab] = useState('executive')
  const [activeGrade, setActiveGrade] = useState('전체')
  const [showTagPool, setShowTagPool] = useState(false)

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teacher-roster'],
    queryFn: () => usersApi.getTeacherRoster().then(r => r.data),
    staleTime: 2 * 60 * 1000,
  })

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center mt-20"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
  }

  const pastors    = teachers.filter(t => t.role === 'PASTOR')
  const executives = teachers.filter(t => t.role === 'EXECUTIVE')
  const pureTeachers = teachers.filter(t => t.role === 'TEACHER')
  // 반 배정된 임원도 교사 탭에 포함 (중복 제거)
  const assignedExecs = executives.filter(t => !!t.className)
  const teacherTabList = [...pureTeachers, ...assignedExecs]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  // 교사 탭 – 학년별 그룹화
  const teachersByGrade = teacherTabList.reduce((acc, t) => {
    const grade = t.className ? t.className.split(' ')[0] : '미배정'
    if (!acc[grade]) acc[grade] = []
    acc[grade].push(t)
    return acc
  }, {})

  const gradeKeys = [...GRADE_ORDER.filter(g => teachersByGrade[g]), ...(teachersByGrade['미배정'] ? ['미배정'] : [])]
  const availableGrades = ['전체', ...gradeKeys]
  const filteredGrades = activeGrade === '전체' ? gradeKeys : [activeGrade].filter(g => teachersByGrade[g])

  const execTags    = allTags.filter(t => t.category === 'EXECUTIVE')
  const teacherTags = allTags.filter(t => t.category === 'TEACHER')

  return (
    <>
      <div className="flex flex-col gap-0 pb-4">
        {/* 상단 탭 */}
        <div className="sticky top-14 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center px-4 pt-3 pb-0">
            <button
              onClick={() => setActiveTab('executive')}
              className={\`flex-1 py-2.5 text-sm font-black border-b-2 transition-all \${
                activeTab === 'executive' ? 'border-amber-400 text-amber-600' : 'border-transparent text-gray-400'
              }\`}
            >목사님 · 임원</button>
            <button
              onClick={() => { setActiveTab('teacher'); setActiveGrade('전체') }}
              className={\`flex-1 py-2.5 text-sm font-black border-b-2 transition-all \${
                activeTab === 'teacher' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
              }\`}
            >교사</button>
          </div>
        </div>

        {/* 태그 관리 버튼 */}
        {canManageTags && (
          <div className="px-4 pt-3 pb-0 flex justify-end">
            <button
              onClick={() => setShowTagPool(true)}
              className="flex items-center gap-1.5 text-[12px] font-black text-primary-500 bg-primary-50 px-3 py-1.5 rounded-full active:scale-95 transition-all"
            >
              <Tag size={13} /> 태그 관리
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'executive' && (
            <motion.div key="exec-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-6 px-4 pt-4">
              {pastors.length > 0 && (
                <RosterSection title="목사님" dotColor="bg-blue-500"
                  count={pastors.length} teachers={pastors} onSelect={setSelectedTeacher} />
              )}
              {executives.length > 0 && (
                <RosterSection title="임원" dotColor="bg-amber-500"
                  count={executives.length} teachers={executives} onSelect={setSelectedTeacher} />
              )}
              {pastors.length === 0 && executives.length === 0 && (
                <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                  <Users size={40} />
                  <p className="text-sm font-black">임원 정보가 없습니다</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'teacher' && (
            <motion.div key="teacher-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4 pt-3">
              {availableGrades.length > 2 && (
                <div className="flex overflow-x-auto gap-2 px-4 pb-1" style={{ scrollbarWidth: 'none' }}>
                  {availableGrades.map(grade => {
                    const gc = GRADE_COLORS[grade] || GRADE_COLORS['전체']
                    const isActive = activeGrade === grade
                    return (
                      <button key={grade}
                        onClick={() => setActiveGrade(grade)}
                        className={\`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all active:scale-95 \${
                          isActive ? \`\${gc.bg} text-white shadow-sm\` : 'bg-gray-100 text-gray-500'
                        }\`}
                      >{grade}</button>
                    )
                  })}
                </div>
              )}
              <div className="px-4 flex flex-col gap-6">
                {filteredGrades.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-3 text-gray-300">
                    <Users size={40} />
                    <p className="text-sm font-black">교사 정보가 없습니다</p>
                  </div>
                ) : filteredGrades.map(grade => {
                  const gc = GRADE_COLORS[grade] || GRADE_COLORS['전체']
                  const list = teachersByGrade[grade] || []
                  return (
                    <div key={grade}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={\`text-[11px] font-black px-2.5 py-1 rounded-full \${gc.bg} text-white\`}>{grade}</span>
                        <span className="text-xs text-gray-400 font-medium">{list.length}명</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {list.map((t, idx) => (
                          <TeacherCard key={t.id} teacher={t} idx={idx} onSelect={setSelectedTeacher} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedTeacher && (
          <TeacherDetailSheet
            teacher={selectedTeacher}
            allTags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            canManageTags={canManageTags}
            onClose={() => setSelectedTeacher(null)}
            onTagChanged={() => qc.invalidateQueries({ queryKey: ['teacher-roster'] })}
          />
        )}
        {showTagPool && (
          <TagPoolModal
            tags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            onClose={() => setShowTagPool(false)}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ['tags'] })
              qc.invalidateQueries({ queryKey: ['teacher-roster'] })
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
`

src = src.replace(oldTeacherRoster, newTeacherRoster)

// ── 2. TeacherDetailSheet 교체 (낙관적 업데이트 + 역할별 태그) ──────────────
const oldDetail = src.slice(
  src.indexOf('\nfunction TeacherDetailSheet('),
  src.indexOf('\n// ── 태그 풀 관리 모달')
)

const newDetail = `
function TeacherDetailSheet({ teacher, allTags, execTags, teacherTags, canManageTags, onClose, onTagChanged }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const age = calcAge(teacher.birthDate)
  const qc = useQueryClient()

  // 낙관적 업데이트를 위한 로컬 태그 상태
  const [localTagIds, setLocalTagIds] = useState(new Set((teacher.tags || []).map(t => t.id)))
  const [pendingIds, setPendingIds] = useState(new Set())

  // 이 교사에게 보여줄 태그 풀 (역할별)
  const relevantTags = teacher.role === 'EXECUTIVE' ? execTags : teacherTags

  const toggleTag = async (tagId) => {
    if (pendingIds.has(tagId)) return
    const isAssigned = localTagIds.has(tagId)
    // 낙관적 업데이트
    setLocalTagIds(prev => {
      const next = new Set(prev)
      isAssigned ? next.delete(tagId) : next.add(tagId)
      return next
    })
    setPendingIds(prev => new Set(prev).add(tagId))
    try {
      if (isAssigned) {
        await tagsApi.remove(tagId, teacher.id)
      } else {
        await tagsApi.assign(tagId, teacher.id)
      }
      onTagChanged()
    } catch {
      // 실패 시 롤백
      setLocalTagIds(prev => {
        const next = new Set(prev)
        isAssigned ? next.add(tagId) : next.delete(tagId)
        return next
      })
    } finally {
      setPendingIds(prev => { const n = new Set(prev); n.delete(tagId); return n })
    }
  }

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
          className="w-full max-w-[360px] bg-white rounded-3xl pointer-events-auto shadow-2xl overflow-y-auto"
          style={{ maxHeight: '85vh' }}
        >
          <div className="flex justify-end px-4 pt-4 pb-0">
            <button onClick={onClose} className="p-2 rounded-full bg-gray-100 active:scale-90 transition-transform">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-4">
            <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {teacher.profileImage
                ? <img src={teacher.profileImage} alt={teacher.name} className="w-full h-full object-cover" />
                : <span className="font-black text-gray-500 text-4xl">{teacher.name?.[0]}</span>
              }
            </div>
            <div className="text-center">
              <p className="font-black text-gray-900 text-xl">{teacher.name}</p>
              <span className={\`inline-block mt-1 text-xs font-bold px-3 py-1 rounded-full \${roleCfg.bg}\`}>
                {roleCfg.label}
              </span>
              {teacher.churchPosition && (
                <p className="text-[11px] text-gray-400 font-medium mt-1">{teacher.churchPosition}</p>
              )}
            </div>
            {localTagIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {allTags.filter(t => localTagIds.has(t.id)).map(t => (
                  <span key={t.id} className="text-[11px] font-black px-2.5 py-1 rounded-full bg-primary-50 text-primary-600">
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 flex flex-col gap-2">
            {teacher.className && <InfoRow label="담당 반" value={teacher.className} icon="📚" />}
            {teacher.birthDate && (
              <InfoRow label="생년월일"
                value={\`\${formatBirth(teacher.birthDate)}\${age ? \` (만 \${age}세)\` : ''}\`}
                icon="🎂" />
            )}
            {teacher.phone && <InfoRow label="전화번호" value={teacher.phone} icon="📱" isPhone />}
          </div>

          {canManageTags && relevantTags.length > 0 && (
            <div className="px-4 py-4 mt-3 border-t border-gray-50">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">태그 배정</p>
              <div className="flex flex-wrap gap-1.5">
                {relevantTags.map(tag => {
                  const assigned = localTagIds.has(tag.id)
                  const pending  = pendingIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      disabled={pending}
                      className={\`flex items-center gap-1 text-[11px] font-black px-2.5 py-1.5 rounded-full border-2 transition-all active:scale-95 \${
                        pending ? 'opacity-60' :
                        assigned ? 'border-primary-400 bg-primary-50 text-primary-600' : 'border-gray-100 bg-gray-50 text-gray-400'
                      }\`}
                    >
                      {assigned && <Check size={10} />}
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="h-4" />
        </motion.div>
      </div>
    </>
  )
}
`

src = src.replace(oldDetail, newDetail)

// ── 3. TagPoolModal 교체 (임원/교사 탭 분리) ─────────────────────────────────
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

  const currentTags = tagTab === 'EXECUTIVE' ? execTags : teacherTags

  const createMutation = useMutation({
    mutationFn: () => tagsApi.create(newName.trim(), tagTab),
    onSuccess: () => { setNewName(''); onChanged() },
  })

  const updateMutation = useMutation({
    mutationFn: () => tagsApi.update(editingId, editName.trim()),
    onSuccess: () => { setEditingId(null); onChanged() },
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
          className="w-full max-w-[360px] bg-white rounded-3xl pointer-events-auto shadow-2xl overflow-hidden"
          style={{ maxHeight: '82vh' }}
        >
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
              onClick={() => { setTagTab('EXECUTIVE'); setNewName(''); setEditingId(null) }}
              className={\`flex-1 py-2 text-xs font-black border-b-2 transition-all \${
                tagTab === 'EXECUTIVE' ? 'border-amber-400 text-amber-600' : 'border-transparent text-gray-400'
              }\`}
            >임원 태그</button>
            <button
              onClick={() => { setTagTab('TEACHER'); setNewName(''); setEditingId(null) }}
              className={\`flex-1 py-2 text-xs font-black border-b-2 transition-all \${
                tagTab === 'TEACHER' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400'
              }\`}
            >교사 태그</button>
          </div>

          <div className="px-5 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '38vh' }}>
            {currentTags.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">아직 태그가 없습니다</p>
            )}
            {currentTags.map(tag => (
              <div key={tag.id} className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl">
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
                    <button onClick={() => setEditingId(null)} className="text-[11px] font-black text-gray-400">취소</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-bold text-gray-800">{tag.name}</span>
                    <button
                      onClick={() => { setEditingId(tag.id); setEditName(tag.name) }}
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
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 mt-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              {tagTab === 'EXECUTIVE' ? '임원' : '교사'} 태그 추가
            </p>
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

src = src.replace(oldModal, newModal)

writeFileSync(file, src, 'utf8')
console.log('✅ Patch applied successfully')
