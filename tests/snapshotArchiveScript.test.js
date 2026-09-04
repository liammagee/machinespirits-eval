import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const SCRIPT = path.resolve(import.meta.dirname, '..', 'scripts', 'snapshot-archive.sh');
const hasSqlite = spawnSync('sqlite3', ['-version'], { encoding: 'utf8' }).status === 0;
const skip = hasSqlite ? false : 'sqlite3 not installed';
const DAY_MS = 86_400_000;

function isoDay(offsetDays = 0) {
  return new Date(Date.now() - offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function makeDataHome(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const seed = spawnSync(
    'sqlite3',
    [path.join(home, 'evaluations.db'), 'create table t(x); insert into t values (1);'],
    { encoding: 'utf8' },
  );
  assert.equal(seed.status, 0, seed.stderr);
  return home;
}

function runSnapshot(home, env = {}) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, MS_DATA_HOME: home, ...env },
  });
}

test('snapshot writes a rolling copy and one dated compressed copy per day', { skip }, (t) => {
  const home = makeDataHome(t);
  const datedDir = path.join(home, 'snapshots', 'dated');

  const first = runSnapshot(home, { MS_SNAPSHOT_KEEP_DAYS: '7' });
  assert.equal(first.status, 0, first.stderr);
  assert.ok(fs.statSync(path.join(home, 'snapshots', 'evaluations.db')).size > 0, 'rolling copy exists');
  const dated = fs.readdirSync(datedDir);
  assert.equal(dated.length, 1, `one dated copy, got ${dated.join(', ')}`);
  assert.match(dated[0], new RegExp(`^evaluations\\.db\\.${isoDay()}\\.(zst|gz)$`, 'u'));
  assert.ok(fs.statSync(path.join(datedDir, dated[0])).size > 0, 'dated copy is not empty');
  assert.match(first.stdout, /dated copies: 1 kept, 0 pruned/u);

  const before = fs.statSync(path.join(datedDir, dated[0])).mtimeMs;
  const second = runSnapshot(home, { MS_SNAPSHOT_KEEP_DAYS: '7' });
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(fs.readdirSync(datedDir), dated, 'a second run the same day adds nothing');
  assert.equal(fs.statSync(path.join(datedDir, dated[0])).mtimeMs, before, 'and rewrites nothing');
});

test('snapshot prunes dated copies older than the keep window by the date in the name', { skip }, (t) => {
  const home = makeDataHome(t);
  const datedDir = path.join(home, 'snapshots', 'dated');
  fs.mkdirSync(datedDir, { recursive: true });
  const old = `evaluations.db.${isoDay(40)}.zst`;
  const recent = `evaluations.db.${isoDay(3)}.zst`;
  for (const name of [old, recent, 'unrelated.txt']) fs.writeFileSync(path.join(datedDir, name), 'x');

  const result = runSnapshot(home, { MS_SNAPSHOT_KEEP_DAYS: '28' });
  assert.equal(result.status, 0, result.stderr);
  const names = fs.readdirSync(datedDir);
  assert.ok(!names.includes(old), 'the 40-day-old copy is pruned');
  assert.ok(names.includes(recent), 'the 3-day-old copy stays');
  assert.ok(names.includes('unrelated.txt'), 'files without a date in the name are left alone');
  assert.match(result.stdout, /1 pruned/u);
});

test('snapshot falls back to a 28-day window when the keep setting is not a number', { skip }, (t) => {
  const home = makeDataHome(t);
  const result = runSnapshot(home, { MS_SNAPSHOT_KEEP_DAYS: 'soon' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /not a whole number; using 28/u);
  assert.match(result.stdout, /window 28d/u);
});
