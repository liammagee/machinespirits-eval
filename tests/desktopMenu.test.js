// tests/desktopMenu.test.js — pure, runs under plain `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMenuTemplate, parseNavHtml } from '../desktop/menu.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

test('parseNavHtml extracts rail destinations (incl. home + multi-segment), drops /api', () => {
  const html = `
    <nav class="rail">
      <a class="rail__link" href="/" title="Dashboard">home</a>
      <a class="rail__link" href="/browse" title="x">scripts</a>
      <a class="rail__link" href="/admin/compose/live" title="x">compose a scene</a>
      <a class="rail__link" href="/board" title="x">board</a>
      <a class="rail__link" href="/board" title="dup">board again</a>
      <a href="/api/workplan">API</a>
      <a href="/_nav.html">nav</a>
    </nav>`;
  const items = parseNavHtml(html);
  const routes = items.map((i) => i.route);
  assert.deepEqual(routes, ['/', '/browse', '/admin/compose/live', '/board']); // deduped, /api + /_ dropped, order preserved
  assert.equal(items.find((i) => i.route === '/board').label, 'board');
  assert.equal(items.find((i) => i.route === '/admin/compose/live').label, 'compose a scene');
});

test('shared rail source exposes board in a visible nav group', () => {
  const source = fs.readFileSync(path.join(REPO, 'scripts', 'browse-poetics-scripts.js'), 'utf8');
  // The three-act rail regroup (make / read & judge / keep) moved board into the
  // "keep" group; the invariant is only that board stays visible in a rail group.
  assert.match(
    source,
    /\[\s*'keep',\s*\[[\s\S]*?'board'[\s\S]*?\]\s*\]/,
    'desktop/web rail groups must keep board visible (now under Keep)',
  );
});

test('navItems produce a Go menu (title-cased, Cmd+1 on the first) only with a navigate action', () => {
  const nav = [
    { route: '/', label: 'home' },
    { route: '/board', label: 'board' },
    { route: '/admin/compose/live', label: 'compose a scene' },
  ];
  // no navigate action → no Go menu
  assert.ok(!labels(buildMenuTemplate({ platform: 'darwin', navItems: nav, actions: {} })).includes('Go'));

  const t = buildMenuTemplate({ platform: 'darwin', navItems: nav, actions: { navigate: () => {} } });
  const go = t.find((m) => m.label === 'Go');
  assert.ok(go, 'expected a Go menu');
  assert.deepEqual(
    go.submenu.map((i) => i.label),
    ['Home', 'Board', 'Compose A Scene'],
  );
  assert.equal(go.submenu[0].accelerator, 'CmdOrCtrl+1');
  assert.equal(
    go.submenu.find((i) => i.label === 'Board').accelerator,
    'CmdOrCtrl+B',
    'Board should get the dedicated ⌘B shortcut',
  );
});
