import test from 'node:test'
import assert from 'node:assert/strict'
import { widgetMonth, pendingWidgetTasks, widgetType, WIDGET_TYPES } from '../src/utils/widgetFamily.js'

test('four independently selectable types keep the installed combined fallback', () => {
  assert.equal(new Set(WIDGET_TYPES.map(t => t.id)).size, 4)
  assert.equal(widgetType('old-widget').id, 'combined')
  assert.deepEqual(widgetType('calendar').sizes, ['large'])
})
test('weekly widget shows only unfinished applicable tasks in server order', () => {
  const tasks = [{id:'done',state:'done'}, {id:'p',state:'pending'}, {id:'none',state:'none'}, {id:'q',state:'pending'}]
  assert.deepEqual(pendingWidgetTasks({ tasks }).map(t => t.id), ['p','q'])
  assert.equal(tasks.length,4)
  assert.deepEqual(pendingWidgetTasks({ tasks: tasks.filter(t=>t.state!=='pending') }), [])
})
test('calendar handles Sunday starts, six rows, leap day and explicit event markers', () => {
  const november = widgetMonth({date:'2026-11-11',calendarDates:['2026-11-01','2026-11-11','2026-12-01']})
  assert.equal(november.cells[0].day,1)
  assert.equal(november.cells.filter(Boolean).length,30)
  assert.deepEqual(november.cells.filter(c=>c?.event).map(c=>c.day),[1,11])
  assert.equal(november.cells.find(c=>c?.today).day,11)
  assert.equal(widgetMonth({date:'2026-08-31',calendarDates:[]}).cells.length,42)
  assert.equal(widgetMonth({date:'2028-02-29',calendarDates:[]}).cells.filter(Boolean).length,29)
  assert.equal(widgetMonth({date:'2026-12-31'}).year,2026)
  assert.equal(widgetMonth({date:'2027-01-01'}).month,1)
  assert.equal(widgetMonth({date:'2026-02-29'}),null)
})
test('old snapshots do not fabricate month markers from the next three events', () => {
  const calendar = widgetMonth({date:'2026-11-11',events:[{date:'2026-11-12'}]})
  assert.equal(calendar.available,false)
  assert.equal(calendar.cells.some(c=>c?.event),false)
  assert.equal(widgetMonth({date:'2026-11-11',calendarDates:[]}).available,true)
})
