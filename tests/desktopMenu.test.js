// tests/desktopMenu.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMenuTemplate } from '../desktop/menu.js';

const labels = (t) => t.map((m) => m.label).filter(Boolean);

test('mac build has the app menu + standard sections', () => {
  const t = buildMenuTemplate({
    platform: 'darwin',
    appName: 'Machine Spirits',
    actions: { openDataFolder: () => {}, goHome: () => {} },
  });
  const ls = labels(t);
  assert.ok(ls.includes('Machine Spirits'));
  for (const section of ['File', 'Edit', 'View', 'Window']) assert.ok(ls.includes(section), `missing ${section}`);
  const view = t.find((m) => m.label === 'View');
  assert.ok(view.submenu.some((i) => i.label === 'Home'));
});

test('custom items appear only when their action is supplied', () => {
  const without = buildMenuTemplate({ platform: 'linux', actions: {} });
  assert.ok(!without.find((m) => m.label === 'File').submenu.some((i) => i.label === 'Open Data Folder'));

  const withAction = buildMenuTemplate({ platform: 'linux', actions: { openDataFolder: () => {} } });
  assert.ok(withAction.find((m) => m.label === 'File').submenu.some((i) => i.label === 'Open Data Folder'));
});

test('non-mac build has no app-name menu', () => {
  const t = buildMenuTemplate({ platform: 'linux', appName: 'X', actions: {} });
  assert.ok(!labels(t).includes('X'));
});
