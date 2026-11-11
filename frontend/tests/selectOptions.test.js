import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h, Fragment } from 'react'
import { selectOptions } from '../src/utils/selectOptions.js'

test('select options retain empty, numeric and boolean-string values', () => {
  assert.deepEqual(selectOptions([
    h('option', { value: '' }, '선택'), h('option', { value: 42 }, '중1 1반'),
    h('option', { value: 'false' }, '부담임'), h('option', null, '남'),
  ]).map(({ value, label }) => [value, label]), [['', '선택'], ['42', '중1 1반'], ['false', '부담임'], ['남', '남']])
})

test('conditional arrays and fragments preserve option order and disabled state', () => {
  const children = [false, null, [h('option', { value: 1 }, '첫째')], h(Fragment, null,
    h('option', { value: 2, disabled: true }, '둘째'), h('option', { value: 3 }, '셋째'))]
  assert.deepEqual(selectOptions(children), [
    { value: '1', label: '첫째', disabled: false }, { value: '2', label: '둘째', disabled: true }, { value: '3', label: '셋째', disabled: false },
  ])
})

test('formatted dates and dynamic labels match their native option text', () => {
  assert.equal(selectOptions(h('option', { value: '2026-10-25' }, '  2026년 ', 10, '월 25일\n 주일  '))[0].label, '2026년 10월 25일 주일')
  assert.equal(selectOptions(h('option', { value: 'a', label: '짧은 이름' }, '다른 표시'))[0].label, '짧은 이름')
  assert.deepEqual(selectOptions(undefined), [])
})
