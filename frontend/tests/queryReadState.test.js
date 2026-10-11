import test from 'node:test'
import assert from 'node:assert/strict'
import { queryReadState } from '../src/utils/queryReadState.js'

const success = { isSuccess: true, fetchStatus: 'idle' }
test('partial read failures cannot be treated as an editable or empty result', () => {
  assert.equal(queryReadState([success, { isError: true, data: [] }]), 'error')
  assert.equal(queryReadState([success, { ...success, isError: true, data: { answers: [] } }]), 'error')
})
test('initial load, background reload and paused offline reads stay blocked', () => {
  for (const pending of [{ isPending: true }, { ...success, isFetching: true },
    { ...success, fetchStatus: 'paused' }, { ...success, isPlaceholderData: true }]) {
    assert.equal(queryReadState([success, pending]), 'loading')
  }
})
test('successful empty and missing optional records are legitimate results after retry', () => {
  assert.equal(queryReadState([{ ...success, data: [] }, { ...success, data: null }]), 'ready')
})
