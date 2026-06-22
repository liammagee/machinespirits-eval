// tests/desktopWindowState.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { restoreBounds, serializeBounds, loadWindowState, saveWindowState } from '../desktop/windowState.js';

const defaults = { width: 1440, height: 920 };

test('restoreBounds falls back to defaults on missing/invalid input', () => {
  assert.deepEqual(restoreBounds(null, defaults), { width: 1440, height: 920 });
  assert.deepEqual(restoreBounds({ width: 'x' }, defaults), { width: 1440, height: 920 });
  assert.deepEqual(restoreBounds({ x: 10, y: 20, width: 800, height: 600 }, defaults), {
    width: 800,
    height: 600,
    x: 10,
    y: 20,
  });
});

test('serializeBounds captures bounds + maximized flag', () => {
  assert.deepEqual(serializeBounds({ x: 1, y: 2, width: 3, height: 4 }, true), {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    isMaximized: true,
  });
});

test('save/load roundtrip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-ws-'));
  const file = path.join(dir, 'window-state.json');
  saveWindowState(file, { x: 5, y: 6, width: 1000, height: 700 }, true);
  const st = loadWindowState(file, defaults);
  assert.equal(st.bounds.width, 1000);
  assert.equal(st.bounds.x, 5);
  assert.equal(st.isMaximized, true);
});

test('load of a missing file returns defaults', () => {
  const st = loadWindowState('/nonexistent/does-not-exist.json', defaults);
  assert.equal(st.bounds.width, 1440);
  assert.equal(st.isMaximized, false);
});
