import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

// Sort existing assigned tags displayed under Teacher Name
const oldStr = `{allTags.filter(t => localTagIds.has(t.id)).map(t => (`
const newStr = `{allTags.filter(t => localTagIds.has(t.id)).sort((a, b) => a.name.localeCompare(b.name)).map(t => (`

if (src.includes(oldStr)) {
  src = src.replace(oldStr, newStr)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster existing tags sort patch applied')
