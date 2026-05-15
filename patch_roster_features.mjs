import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// 1 & 2: Update teacherTabList grouping and sorting
const oldGrouping = `  // 교사 탭 – 학년별 그룹화
  const teachersByGrade = teacherTabList.reduce((acc, t) => {
    const grade = t.className ? t.className.split(' ')[0] : '미배정'
    if (!acc[grade]) acc[grade] = []
    acc[grade].push(t)
    return acc
  }, {})`

const newGrouping = `  // 교사 탭 – 학년별 그룹화
  const teachersByGrade = teacherTabList.reduce((acc, t) => {
    const grade = t.className && t.className.trim() !== '' ? t.className.split(' ')[0] : '미배정'
    if (!acc[grade]) acc[grade] = []
    acc[grade].push(t)
    return acc
  }, {})

  // 학년부장을 맨 앞으로 정렬
  Object.values(teachersByGrade).forEach(list => {
    list.sort((a, b) => {
      const aHead = a.churchPosition?.includes('학년부장')
      const bHead = b.churchPosition?.includes('학년부장')
      if (aHead && !bHead) return -1
      if (!aHead && bHead) return 1
      return a.name.localeCompare(b.name)
    })
  })`

if (src.includes(oldGrouping)) {
  src = src.replace(oldGrouping, newGrouping)
}

// 3: Update TeacherCard passing context in TeacherRoster
src = src.replace(
  `{pastors.length > 0 && (
                <RosterSection title="목사님" dotColor="bg-blue-500"
                  count={pastors.length} teachers={pastors} onSelect={setSelectedTeacher} />
              )}
              {executives.length > 0 && (
                <RosterSection title="임원" dotColor="bg-amber-500"
                  count={executives.length} teachers={executives} onSelect={setSelectedTeacher} />
              )}`,
  `{pastors.length > 0 && (
                <RosterSection title="목사님" dotColor="bg-blue-500"
                  count={pastors.length} teachers={pastors} onSelect={setSelectedTeacher} context="executive" />
              )}
              {executives.length > 0 && (
                <RosterSection title="임원" dotColor="bg-amber-500"
                  count={executives.length} teachers={executives} onSelect={setSelectedTeacher} context="executive" />
              )}`
)

src = src.replace(
  `<TeacherCard key={t.id} teacher={t} idx={idx} onSelect={setSelectedTeacher} />`,
  `<TeacherCard key={t.id} teacher={t} idx={idx} onSelect={setSelectedTeacher} context="teacher" />`
)

// Update RosterSection to pass context
src = src.replace(
  `function RosterSection({ title, dotColor, count, teachers, onSelect }) {`,
  `function RosterSection({ title, dotColor, count, teachers, onSelect, context }) {`
)
src = src.replace(
  `<TeacherCard key={t.id} teacher={t} idx={idx} onSelect={onSelect} />`,
  `<TeacherCard key={t.id} teacher={t} idx={idx} onSelect={onSelect} context={context} />`
)

// Update TeacherCard itself
const oldCard = src.slice(
  src.indexOf('function TeacherCard('),
  src.indexOf('function TeacherDetailSheet(')
)

const newCard = `function TeacherCard({ teacher, idx, onSelect, context = 'default' }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const isGradeHead = teacher.churchPosition?.includes('학년부장')
  
  let displayLabel = roleCfg.label
  let displayBg = roleCfg.bg
  
  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else {
      displayLabel = '교사'
      displayBg = 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      onClick={() => onSelect(teacher)}
      className="flex flex-col items-center gap-1 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-[0.95] transition-all text-center"
    >
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {teacher.profileImage
          ? <img src={teacher.profileImage} alt={teacher.name} className="w-full h-full object-cover" />
          : <span className="font-black text-gray-600 text-base">{teacher.name?.[0]}</span>
        }
      </div>
      <p className="font-black text-gray-900 text-[11px] leading-tight w-full truncate mt-0.5">{teacher.name}</p>
      
      <span className={\`text-[9px] font-black px-1.5 py-0.5 rounded-full \${displayBg}\`}>
        {displayLabel}
      </span>
      
      {teacher.tags?.length > 0 && (
        <div className="flex flex-wrap justify-center gap-0.5 mt-0.5 w-full max-h-[30px] overflow-hidden">
          {teacher.tags.map(t => (
            <span key={t.id} className={\`text-[8px] font-black px-1 py-0.5 rounded-sm truncate \${t.color || "bg-primary-50 text-primary-600"}\`} style={{ maxWidth: '100%' }}>
              {t.name}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  )
}
`

if (oldCard.trim()) {
  src = src.replace(oldCard, newCard)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster features patch applied')
