import test from 'node:test'
import assert from 'node:assert/strict'
import { featureIdentity, featureTone } from '../src/utils/featureAppearance.js'

test('navigation identity survives view queries and fragments without matching unrelated paths', () => {
  assert.equal(featureIdentity('/officers?view=organization'), 'assignment')
  assert.equal(featureIdentity('/praise?month=2026-11#rotation'), 'praise')
  assert.equal(featureIdentity('/admin/meeting-attendance'), 'meeting')
  assert.equal(featureIdentity('/students/12'), 'roster')
  assert.equal(featureIdentity('/officers-other'), undefined)
  assert.equal(featureIdentity('/meeting/sat'), featureIdentity('/admin/meeting-attendance'))
  assert.notEqual(featureTone('/meeting/sat'), featureTone('/admin/meeting-attendance'))
  assert.equal(featureTone('/meeting/sat/detail?week=2026-11-07'), featureTone('/meeting/sat'))
})
