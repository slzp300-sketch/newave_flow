import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// We will just blindly replace '학년부장' with '학년반장' globally because it's only used for this logic.
src = src.split("'학년부장'").join("'학년반장'")
src = src.split("학년부장").join("학년반장") // Also covers display label text

writeFileSync(file, src, 'utf8')
console.log('✅ Roster keyword patch applied')
