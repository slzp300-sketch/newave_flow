import test from 'node:test'
import assert from 'node:assert/strict'
import { GRADE_PALETTE, gradeKey, gradeClasses } from '../src/utils/gradeColors.js'
import { resolveViewMode, STUDENT_ROSTER_MODES } from '../src/utils/viewModes.js'
import { readFileSync } from 'node:fs'

test('grade aliases use one exact palette without misidentifying unknown or combined grades',()=>{
 assert.deepEqual(Object.values(GRADE_PALETTE),['#0223f7','#f2f56f','#f8b4cc','#6fb6f5','#6ff5dc','#f70202'])
 for(const [raw,expected] of [['중 1','중1'],['중학교 2학년','중2'],['중등3부','중3'],['고1-1','고1'],['고등학교 2학년','고2'],['고3','고3']]){
  assert.equal(gradeKey(raw),expected);assert.equal(gradeClasses(raw).color,GRADE_PALETTE[expected])
 }
 for(const raw of [null,'전체','미분류','초1','중12','고4','중1 · 고1'])assert.equal(gradeKey(raw),null)
 assert.equal(gradeClasses('전체').bg,'grade-solid grade-neutral')
})
test('student roster retires saved small/detail layouts without changing other screens',()=>{
 for(const saved of ['small','detail','garbage',null])assert.equal(resolveViewMode(saved,'large',STUDENT_ROSTER_MODES),'large')
 assert.equal(resolveViewMode('list','large',STUDENT_ROSTER_MODES),'list')
 assert.equal(resolveViewMode('detail','large'),'detail')
 assert.equal(resolveViewMode('small','large'),'small')
})
test('exact solid grade colors retain readable text contrast',()=>{
 const css=readFileSync(new URL('../src/styles/grade-colors.css',import.meta.url),'utf8')
 const luminance=hex=>{const rgb=hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
 for(const [grade,hex] of Object.entries(GRADE_PALETTE)){
  const token=gradeClasses(grade).bg.split(' ')[1]
  const rule=css.match(new RegExp('\\.'+token+' \\{[^}]+\\}'))?.[0]
  assert.ok(rule);assert.ok(rule.includes(hex))
  const ink=rule.match(/--grade-on-color: (#[a-f0-9]+)/)[1]
  const a=luminance(hex),b=luminance(ink);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,grade)
 }
})
