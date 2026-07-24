import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSaveQueue, immutableSaveSnapshot } from '../public/human-coding-admin/save-queue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('queued save payloads are immutable snapshots of dataset, coder, item, and coding state', async () => {
  const seen = [];
  const queue = createSaveQueue({ persist: async (payload) => seen.push(payload) });
  const operation = {
    datasetId: 'dataset-a',
    coderId: 'coder-a',
    itemId: 'item-a',
    coding: { notes: 'original', labels: ['one'] },
  };

  queue.schedule(operation);
  operation.datasetId = 'dataset-b';
  operation.coding.notes = 'changed';
  operation.coding.labels.push('two');
  await queue.flush();

  assert.deepEqual(seen[0], {
    datasetId: 'dataset-a',
    coderId: 'coder-a',
    itemId: 'item-a',
    coding: { notes: 'original', labels: ['one'] },
  });
  assert.equal(Object.isFrozen(seen[0]), true);
  assert.equal(Object.isFrozen(seen[0].coding.labels), true);
});

test('unsent edits coalesce to the newest complete snapshot', async () => {
  const seen = [];
  const queue = createSaveQueue({ persist: async (payload) => seen.push(payload) });

  queue.schedule({ itemId: 'item-a', coding: { notes: 'first' } });
  queue.schedule({ itemId: 'item-a', coding: { notes: 'second' } });
  await queue.flush();

  assert.deepEqual(
    seen.map((entry) => entry.coding.notes),
    ['second'],
  );
});

test('in-flight saves serialize and a stale response cannot outrank a newer edit', async () => {
  const first = deferred();
  const starts = [];
  const latestAtCompletion = [];
  let active = 0;
  let maxActive = 0;
  const queue = createSaveQueue({
    persist: async (payload, { isLatest }) => {
      starts.push(payload.coding.notes);
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (payload.coding.notes === 'first') await first.promise;
      latestAtCompletion.push([payload.coding.notes, isLatest()]);
      active -= 1;
    },
  });

  queue.schedule({ itemId: 'item-a', coding: { notes: 'first' } });
  const flushing = queue.flush();
  await new Promise((resolve) => setImmediate(resolve));
  queue.schedule({ itemId: 'item-a', coding: { notes: 'second' } });
  first.resolve();
  await flushing;

  assert.deepEqual(starts, ['first', 'second']);
  assert.deepEqual(latestAtCompletion, [
    ['first', false],
    ['second', true],
  ]);
  assert.equal(maxActive, 1);
  assert.equal(queue.hasWork(), false);
});

test('a failed stale save yields to the newer snapshot while a latest failure blocks flush', async () => {
  const first = deferred();
  const errors = [];
  const queue = createSaveQueue({
    persist: async (payload) => {
      if (payload.coding.notes === 'first') await first.promise;
      if (payload.coding.notes === 'latest-failure') throw new Error('save failed');
    },
    onError: (error) => errors.push(error.message),
  });

  queue.schedule({ itemId: 'item-a', coding: { notes: 'first' } });
  const flushing = queue.flush();
  await new Promise((resolve) => setImmediate(resolve));
  queue.schedule({ itemId: 'item-a', coding: { notes: 'second' } });
  first.reject(new Error('stale failure'));
  await flushing;
  assert.deepEqual(errors, []);

  queue.schedule({ itemId: 'item-a', coding: { notes: 'latest-failure' } });
  await assert.rejects(queue.flush(), /save failed/u);
  assert.deepEqual(errors, ['save failed']);
});

test('standalone snapshots do not retain mutable caller references', () => {
  const input = { nested: { value: 1 } };
  const snapshot = immutableSaveSnapshot(input);
  input.nested.value = 2;
  assert.equal(snapshot.nested.value, 1);
  assert.throws(() => {
    snapshot.nested.value = 3;
  }, TypeError);
});

test('the browser surface flushes queued saves across every identity or selection transition', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'human-coding-admin', 'index.html'), 'utf8');
  assert.match(html, /<script type="module">\s*import \{ createSaveQueue \}/u);
  assert.match(html, /async function selectItem[\s\S]*await flushPendingSave\(\)/u);
  assert.match(html, /async function loadCoder[\s\S]*await flushPendingSave\(\)/u);
  assert.match(html, /async function loadComparison[\s\S]*await flushPendingSave\(\)/u);
  assert.match(html, /async function switchDataset[\s\S]*await flushPendingSave\(\)/u);
  assert.match(html, /beforeunload[\s\S]*saveQueue\.hasWork\(\)/u);
});
