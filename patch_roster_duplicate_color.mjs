import { readFileSync, writeFileSync } from 'fs'

const file = 'frontend/src/pages/RosterPage.jsx'
let src = readFileSync(file, 'utf8')

const oldModalTop = `  const currentTags = tagTab === 'EXECUTIVE' ? execTags : teacherTags`

const newModalTop = `  const currentTags = tagTab === 'EXECUTIVE' ? execTags : teacherTags

  const usedColors = new Set(tags.map(t => t.color).filter(Boolean))`

if (src.includes(oldModalTop)) {
  src = src.replace(oldModalTop, newModalTop)
}

// 1. Edit mode picker
const oldEditPicker = `{TAG_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedColor(c)}
                        className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}\`}
                      />
                    ))}`

const newEditPicker = `{TAG_COLORS.map(c => {
                      const isUsed = usedColors.has(c)
                      const isCurrent = tags.find(t => t.id === editingId)?.color === c
                      const isDisabled = isUsed && !isCurrent
                      return (
                        <button
                          key={c}
                          disabled={isDisabled}
                          onClick={() => setSelectedColor(c)}
                          className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${
                            isDisabled ? 'opacity-20 cursor-not-allowed' :
                            selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                          }\`}
                        />
                      )
                    })}`

if (src.includes(oldEditPicker)) {
  src = src.replace(oldEditPicker, newEditPicker)
}

// 2. Add mode picker
const oldAddPicker = `{TAG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}\`}
                />
              ))}`

const newAddPicker = `{TAG_COLORS.map(c => {
                const isDisabled = usedColors.has(c)
                return (
                  <button
                    key={c}
                    disabled={isDisabled}
                    onClick={() => setSelectedColor(c)}
                    className={\`w-5 h-5 rounded-full border-2 \${c.split(' ')[0]} \${
                      isDisabled ? 'opacity-20 cursor-not-allowed' :
                      selectedColor === c ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                    }\`}
                  />
                )
              })}`

if (src.includes(oldAddPicker)) {
  src = src.replace(oldAddPicker, newAddPicker)
}

writeFileSync(file, src, 'utf8')
console.log('✅ Roster duplicate color patch applied')
