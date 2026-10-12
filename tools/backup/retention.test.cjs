const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { assertRestorable, pruneExpired } = require('./retention.cjs');
const now = Date.parse('2026-10-12T12:00:00.000Z');
const expired = 'newave-2026-09-12T12-00-00-000Z.dump.dpapi';
const recent = 'newave-2026-09-12T12-00-00-001Z.dump.dpapi';

test('30-day boundary removes expired pairs while preserving current and unrelated files', t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'newave-retention-')));
  t.after(() => { for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); });
  for (const name of [expired, expired+'.json', recent, 'config.json', 'server.crt', 'last-success.json']) fs.writeFileSync(path.join(dir,name),'fixture');
  assert.equal(pruneExpired(dir,{now,dryRun:true}).expiredFiles,2);
  assert.equal(fs.existsSync(path.join(dir,expired)),true);
  assert.equal(pruneExpired(dir,{now}).expiredFiles,2);
  assert.deepEqual(fs.readdirSync(dir).sort(),[recent,'config.json','server.crt','last-success.json'].sort());
  assert.equal(pruneExpired(dir,{now}).expiredFiles,0);
});
test('restore refuses expired, forged, future and traversing receipts', () => {
  assert.throws(()=>assertRestorable({file:expired,at:'2026-09-12T12:00:00.000Z'},now),/Expired/);
  assert.doesNotThrow(()=>assertRestorable({file:recent,at:'2026-09-12T12:00:00.001Z'},now));
  assert.throws(()=>assertRestorable({file:recent,at:'2026-10-12T12:00:00.000Z'},now),/Invalid/);
  assert.throws(()=>assertRestorable({file:'../'+recent,at:'2026-09-12T12:00:00.001Z'},now),/Invalid/);
  assert.throws(()=>assertRestorable({file:recent,at:'2026-09-12T12:00:00.001Z'},now-31*86400000),/Invalid/);
});
test('a directory masquerading as a dump blocks deletion before any file is removed', t => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'newave-retention-')));
  fs.writeFileSync(path.join(dir,expired),'fixture'); fs.mkdirSync(path.join(dir,expired+'.json'));
  t.after(()=>{fs.unlinkSync(path.join(dir,expired));fs.rmdirSync(path.join(dir,expired+'.json'));fs.rmdirSync(dir);});
  assert.throws(()=>pruneExpired(dir,{now}),/Unsafe/);
  assert.equal(fs.existsSync(path.join(dir,expired)),true);
});
