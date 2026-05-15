import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

const oldSort = `  // 학년부장을 맨 앞으로 정렬
  Object.values(teachersByGrade).forEach(list => {
    list.sort((a, b) => {
      const aHead = a.churchPosition?.includes('학년부장')
      const bHead = b.churchPosition?.includes('학년부장')
      if (aHead && !bHead) return -1
      if (!aHead && bHead) return 1
      return a.name.localeCompare(b.name)
    })
  })`

const newSort = `  // 학년부장을 맨 앞으로, 그 다음은 반 번호 오름차순, 그 다음 이름순으로 정렬
  const getClassNum = (className) => {
    if (!className) return 999
    const match = className.match(/(\\d+)반/)
    return match ? parseInt(match[1], 10) : 999
  }

  Object.values(teachersByGrade).forEach(list => {
    list.sort((a, b) => {
      const aHead = a.churchPosition?.includes('학년부장')
      const bHead = b.churchPosition?.includes('학년부장')
      if (aHead && !bHead) return -1
      if (!aHead && bHead) return 1
      
      const aClass = getClassNum(a.className)
      const bClass = getClassNum(b.className)
      if (aClass !== bClass) return aClass - bClass
      
      return a.name.localeCompare(b.name)
    })
  })`

if (src.includes(oldSort)) {
  src = src.replace(oldSort, newSort)
} else {
  console.log('Error: Could not find oldSort string in file')
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster class sort patch applied')
