import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// 1. Modify TeacherCard
const oldCardIf = `  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }`

const newCardIf = `  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else if (teacher.role === 'TEACHER') {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }`

if (src.includes(oldCardIf)) {
  src = src.replace(oldCardIf, newCardIf)
}

// 2. Modify TeacherDetailSheet
const oldSheetIf = `  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }`

const newSheetIf = `  if (context === 'teacher') {
    if (isGradeHead) {
      displayLabel = '학년부장'
      displayBg = 'bg-emerald-100 text-emerald-700'
    } else if (teacher.role === 'TEACHER') {
      displayLabel = '교사'
      displayBg = 'bg-emerald-50 text-emerald-600'
    }
  }`

if (src.includes(oldSheetIf)) {
  // It might replace the second occurrence if I use replace instead of replaceAll
  // but since both blocks are identical text-wise, I'll do replaceAll to be safe.
  src = src.split(oldSheetIf).join(newSheetIf)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster role revert patch applied')
