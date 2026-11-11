import test from 'node:test'
import assert from 'node:assert/strict'
import { changeState, leavesScreen, formSnapshot } from '../src/utils/unsavedChanges.js'

test('multiple editors: one clean form cannot hide another unsaved or saving form', () => {
  const entries = new Map([['common', () => ({dirty:false,busy:false})], ['teacher', () => ({dirty:true,busy:true})]])
  assert.deepEqual(changeState(entries.values()), {dirty:true,busy:true})
  entries.delete('teacher')
  assert.deepEqual(changeState(entries.values()), {dirty:false,busy:false})
})

test('navigation checks include week/tab changes in the same page, but not anchors', () => {
  const current = {pathname:'/praise',search:'?page=rotation&week=1',hash:''}
  assert.equal(leavesScreen(current, {...current,search:'?page=rotation&week=2'}), true)
  assert.equal(leavesScreen(current, {...current,pathname:'/'}), true)
  assert.equal(leavesScreen(current, {...current,hash:'#notes'}), false)
})

test('snapshots detect nested names, attendance and checkbox edits without retaining mutable references', () => {
  const form={profile:{name:''},dates:[],none:false}
  const before=formSnapshot(form)
  form.profile.name='가상학생'
  assert.notEqual(formSnapshot(form),before)
  form.profile.name=''
  assert.equal(formSnapshot(form),before)
  form.dates.push('2026-11-14')
  assert.notEqual(formSnapshot(form),before)
})
