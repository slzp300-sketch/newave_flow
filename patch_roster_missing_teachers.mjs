import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// Fix 1: Add missing grades to gradeKeys
const oldGradeKeys = `const gradeKeys = [...GRADE_ORDER.filter(g => teachersByGrade[g]), ...(teachersByGrade['미배정'] ? ['미배정'] : [])]`

const newGradeKeys = `const otherGrades = Object.keys(teachersByGrade).filter(g => !GRADE_ORDER.includes(g) && g !== '미배정')
  const gradeKeys = [
    ...GRADE_ORDER.filter(g => teachersByGrade[g]),
    ...otherGrades.sort((a, b) => a.localeCompare(b)),
    ...(teachersByGrade['미배정'] ? ['미배정'] : [])
  ]`

if (src.includes(oldGradeKeys)) {
  src = src.replace(oldGradeKeys, newGradeKeys)
} else {
  console.log("Could not find oldGradeKeys")
}

// Fix 2: Display total number of teachers
const oldBlockFull = `{/* 태그 관리 및 초기화 버튼 */}
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
        
const newBlockFull = `{/* 총 인원 및 태그 관리 */}
        <div className="px-4 pt-3 pb-0 flex justify-between items-center">
          <span className="text-xs font-bold text-gray-500">
            {activeTab === 'executive' 
              ? \`총 \${pastors.length + executives.length}명\` 
              : activeGrade === '전체' 
                ? \`총 \${teacherTabList.length}명\` 
                : \`총 \${teachersByGrade[activeGrade]?.length || 0}명\`
            }
          </span>
          {canManageTags && (
            <div className="flex gap-2">
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
          )}
        </div>`

if (src.includes(oldBlockFull)) {
  src = src.replace(oldBlockFull, newBlockFull)
} else {
  console.log("Could not find oldBlockFull")
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster missing teachers and total count patch applied')
