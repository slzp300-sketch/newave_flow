const fs = require('node:fs');
const path = require('node:path');

const RETENTION_DAYS = 30;
const NAME = /^newave-(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.dump\.dpapi$/;

function backupTime(name) {
  const m = NAME.exec(name);
  if (!m) throw Error('Invalid backup filename');
  const iso = `${m[1]}:${m[2]}:${m[3]}.${m[4]}Z`;
  const at = Date.parse(iso);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== iso) throw Error('Invalid backup date');
  return at;
}

function assertRestorable(receipt, now = Date.now()) {
  const at = backupTime(receipt.file);
  if (Date.parse(receipt.at) !== at || at > now) throw Error('Invalid backup receipt date');
  if (now - at >= RETENTION_DAYS * 86400000) throw Error('Expired backup cannot be restored');
}

// Only exact backup names in this directory are eligible. Never follow links or recurse.
function pruneExpired(folder, { now = Date.now(), dryRun = false } = {}) {
  const directory = path.resolve(folder);
  if (!Number.isFinite(now)) throw Error('Invalid retention clock');
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) throw Error('Unsafe backup directory');
  const files = [];
  for (const name of fs.readdirSync(directory)) {
    if (!NAME.test(name) || now - backupTime(name) < RETENTION_DAYS * 86400000) continue;
    for (const candidate of [name, name + '.json']) {
      const file = path.join(directory, candidate);
      if (!fs.existsSync(file)) continue;
      const entry = fs.lstatSync(file);
      if (!entry.isFile() || entry.isSymbolicLink()) throw Error('Unsafe backup entry');
      files.push(file);
    }
  }
  // Validate the complete deletion set before the first unlink.
  if (!dryRun) for (const file of files) fs.unlinkSync(file);
  return { retentionDays: RETENTION_DAYS, dryRun, expiredFiles: files.length };
}

module.exports = { RETENTION_DAYS, backupTime, assertRestorable, pruneExpired };
