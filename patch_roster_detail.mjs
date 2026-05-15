import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// 1. Pass context to TeacherDetailSheet
const oldInvoke = `<TeacherDetailSheet
            teacher={selectedTeacher}
            allTags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            canManageTags={canManageTags}
            onClose={() => setSelectedTeacher(null)}
            onTagChanged={() => qc.invalidateQueries({ queryKey: ['teacher-roster'] })}
          />`

const newInvoke = `<TeacherDetailSheet
            teacher={selectedTeacher}
            allTags={allTags}
            execTags={execTags}
            teacherTags={teacherTags}
            canManageTags={canManageTags}
            onClose={() => setSelectedTeacher(null)}
            onTagChanged={() => qc.invalidateQueries({ queryKey: ['teacher-roster'] })}
            context={activeTab}
          />`

if (src.includes(oldInvoke)) {
  src = src.replace(oldInvoke, newInvoke)
}

// 2. Modify TeacherDetailSheet definition
const oldDef = `function TeacherDetailSheet({ teacher, allTags, execTags, teacherTags, canManageTags, onClose, onTagChanged }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const age = calcAge(teacher.birthDate)`

const newDef = `function TeacherDetailSheet({ teacher, allTags, execTags, teacherTags, canManageTags, onClose, onTagChanged, context }) {
  const roleCfg = ROLE_CONFIG[teacher.role] ?? ROLE_CONFIG.TEACHER
  const age = calcAge(teacher.birthDate)
  
  const isGradeHead = teacher.churchPosition?.includes('학년부장')
  let displayLabel = roleCfg.label
  let displayBg = roleCfg.bg
  
  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }`

if (src.includes(oldDef)) {
  src = src.replace(oldDef, newDef)
}

// 3. Modify TeacherDetailSheet Role Display
const oldRoleDisplay = `<span className={\`inline-block mt-1 text-xs font-bold px-3 py-1 rounded-full \${roleCfg.bg}\`}>
                {roleCfg.label}
              </span>`

const newRoleDisplay = `<span className={\`inline-block mt-1 text-xs font-bold px-3 py-1 rounded-full \${displayBg}\`}>
                {displayLabel}
              </span>`

if (src.includes(oldRoleDisplay)) {
  src = src.replace(oldRoleDisplay, newRoleDisplay)
}

// 4. Modify InfoRow for Age
const oldAgeInfo = `{teacher.birthDate && (
              <InfoRow label="생년월일"
                value={\`\${formatBirth(teacher.birthDate)}\${age ? \` (만 \${age}세)\` : ''}\`}
                icon="🎂" />
            )}`

const newAgeInfo = `{teacher.birthDate && (
              <InfoRow label="나이"
                value={\`\${age ? \`만 \${age}세\` : ''} (\${formatBirth(teacher.birthDate)})\`}
                icon="🎂" />
            )}`

if (src.includes(oldAgeInfo)) {
  src = src.replace(oldAgeInfo, newAgeInfo)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster detail sheet patch applied')
