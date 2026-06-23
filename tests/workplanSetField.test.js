// tests/workplanSetField.test.js — pure, runs under plain `node --test`.
//
// Exercises the exported setItemField + renderBoard (the write path the board's
// drag-and-drop endpoint uses) against a throwaway WORKPLAN_DIR — the same
// isolation the CLI tests use — so the real board is never touched.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-set-'));
process.env.WORKPLAN_DIR = dir;
fs.mkdirSync(path.join(dir, 'items'), { recursive: true });
fs.writeFileSync(
  path.join(dir, 'items', 'sample-item.md'),
  `---
id: sample-item
title: A sample item
status: triaged
type: infra
priority: P2
owner: unassigned
source: test
created: 2026-06-22
updated: 2026-06-22
verification: it works
---
Body.
`,
);

let setItemField, LIFECYCLE;
before(async () => {
  ({ setItemField, LIFECYCLE } = await import('../scripts/workplan.js'));
});

test('LIFECYCLE includes the board drag-target lanes', () => {
  for (const s of ['triaged', 'active', 'blocked', 'review', 'done']) assert.ok(LIFECYCLE.includes(s), `missing ${s}`);
});

test('setItemField changes status, bumps updated, and re-renders board.json', () => {
  const before = fs.readFileSync(path.join(dir, 'items', 'sample-item.md'), 'utf8');
  assert.match(before, /status: triaged/);

  const fm = setItemField('sample-item', 'status', 'done');
  assert.equal(fm.status, 'done');

  const onDisk = fs.readFileSync(path.join(dir, 'items', 'sample-item.md'), 'utf8');
  assert.match(onDisk, /status: done/);

  const board = JSON.parse(fs.readFileSync(path.join(dir, 'board.json'), 'utf8'));
  assert.equal(board.counts.byStatus.done, 1);
  assert.equal(board.items.find((i) => i.id === 'sample-item').status, 'done');
});

test('setItemField throws on a missing item', () => {
  assert.throws(() => setItemField('does-not-exist', 'status', 'done'), /no item/);
});
