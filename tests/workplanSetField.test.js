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

let setItemField, updateItem, addItem, deleteItem, validateDependencies, LIFECYCLE;
before(async () => {
  ({ setItemField, updateItem, addItem, deleteItem, validateDependencies, LIFECYCLE } =
    await import('../scripts/workplan.js'));
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

test('addItem creates an item (slug id + defaults) and adds it to board.json', () => {
  const fm = addItem({ title: 'A Brand New Task', type: 'infra', priority: 'P1', status: 'active' });
  assert.match(fm.id, /^[a-z0-9-]+$/);
  assert.equal(fm.status, 'active');
  assert.equal(fm.type, 'infra');
  assert.ok(fs.existsSync(path.join(dir, 'items', fm.id + '.md')));
  const board = JSON.parse(fs.readFileSync(path.join(dir, 'board.json'), 'utf8'));
  assert.ok(board.items.some((i) => i.id === fm.id && i.status === 'active'));
});

test('addItem dedups the id on a title collision, and requires a title', () => {
  const a = addItem({ title: 'Dup Title Xyz' });
  const b = addItem({ title: 'Dup Title Xyz' });
  assert.equal(b.id, a.id + '-2');
  assert.throws(() => addItem({ title: '' }), /title is required/);
});

test('updateItem sets several fields and clears an emptied optional field', () => {
  const ed = addItem({ title: 'Editable Item', status: 'blocked' });
  updateItem(ed.id, { title: 'Edited title', priority: 'P0', blocked_by: 'something' });
  let onDisk = fs.readFileSync(path.join(dir, 'items', ed.id + '.md'), 'utf8');
  assert.match(onDisk, /title: Edited title/);
  assert.match(onDisk, /priority: P0/);
  assert.match(onDisk, /blocked_by: something/);
  updateItem(ed.id, { blocked_by: '' }); // empty clears the optional field
  onDisk = fs.readFileSync(path.join(dir, 'items', ed.id + '.md'), 'utf8');
  assert.doesNotMatch(onDisk, /blocked_by:/);
});

test('deleteItem removes the file + drops it from board.json; throws if missing', () => {
  const td = addItem({ title: 'To Delete Soon' });
  assert.ok(fs.existsSync(path.join(dir, 'items', td.id + '.md')));
  deleteItem(td.id);
  assert.ok(!fs.existsSync(path.join(dir, 'items', td.id + '.md')));
  const board = JSON.parse(fs.readFileSync(path.join(dir, 'board.json'), 'utf8'));
  assert.ok(!board.items.some((i) => i.id === td.id));
  assert.throws(() => deleteItem(td.id), /no item/);
});

test('validateDependencies flags missing, self, and cycles; allows valid', () => {
  const byId = { a: { id: 'a', depends_on: ['b'] }, b: { id: 'b' }, c: { id: 'c' } };
  assert.equal(validateDependencies(byId, 'c', ['a', 'b']), null);
  assert.equal(validateDependencies(byId, 'c', []), null);
  assert.equal(validateDependencies(byId, 'c', null), null);
  assert.match(validateDependencies(byId, 'c', ['nope']), /unknown dependency/);
  assert.match(validateDependencies(byId, 'a', ['a']), /itself/);
  assert.match(validateDependencies(byId, 'b', ['a']), /cycle/); // a→b already, so b→a cycles
});

test('addItem + updateItem persist depends_on; empty array clears it', () => {
  const dep = addItem({ title: 'Dep Target Item' });
  const main = addItem({ title: 'Main Dependent Task', depends_on: [dep.id] });
  assert.deepEqual(main.depends_on, [dep.id]);
  assert.match(fs.readFileSync(path.join(dir, 'items', main.id + '.md'), 'utf8'), /depends_on/);
  updateItem(main.id, { depends_on: [] });
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'items', main.id + '.md'), 'utf8'), /depends_on/);
});
