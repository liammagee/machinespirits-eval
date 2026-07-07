// tests/navParity.test.js
//
// The nav "stays in sync" guard. The rail folds the single-source NAV table into
// three act-groups (NAV_GROUPS), mirrored on mobile (NAV_DRAWER_GROUPS) and on the
// home page as three card-acts (renderScriptoriumHome). Membership is shared by
// key, so the rail and home can never disagree on *which* surfaces exist — but
// ORDER is hand-maintained per surface, so they can silently drift in order. They
// did: the `make` group read compose,runs,tutor in the rail while the home act
// ordered it compose,tutor,runs. This test pins the three invariants that catch it:
//   1. the rail group list == the mobile drawer list (modulo label case);
//   2. every routed key exists in NAV, exactly once, and every NAV key is routed
//      (no dangling references, no orphan tabs);
//   3. for each act, the home cards and the rail group agree on the relative order
//      of the keys they share (tolerating rail-only hubs like /read and the cards
//      that umbrella several keys, like the Hall).
//
// Self-hermetic: relocates every writable store into a temp dir BEFORE importing
// the app, so importing the monolith never touches the real DB/logs (same pattern
// as desktopRouteParity.test.js). Importing does not start a server — the listen
// is behind a main-module guard.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-navparity-'));
for (const [k, v] of [
  ['EVAL_DB_PATH', path.join(tmp, 'evaluations.db')],
  ['EVAL_LOGS_DIR', path.join(tmp, 'logs')],
  ['EVAL_EXPORTS_DIR', path.join(tmp, 'exports')],
  ['AUTH_DB_PATH', path.join(tmp, 'lms.sqlite')],
  ['EVAL_WRITING_PAD_DIR', path.join(tmp, 'writing-pads')],
  ['TUTOR_CORE_LOG_DIR', path.join(tmp, 'tutor-core-logs')],
]) {
  process.env[k] = process.env[k] || v;
}
fs.mkdirSync(path.join(tmp, 'logs'), { recursive: true });

let NAV, NAV_PRIMARY, NAV_GROUPS, NAV_DRAWER_GROUPS, renderScriptoriumHome;

before(async () => {
  ({ NAV, NAV_PRIMARY, NAV_GROUPS, NAV_DRAWER_GROUPS, renderScriptoriumHome } =
    await import('../scripts/browse-poetics-scripts.js'));
});

// "read &amp; judge" (rail label) and "read & judge" (decoded) compare equal.
const norm = (s) => String(s).replace(/&amp;/g, '&').trim().toLowerCase();

// NAV rows are [key, href, label, title] — invert to href -> key.
const hrefToKey = () => new Map(NAV.map(([key, href]) => [href, key]));

// Parse the rendered home into [{ kicker, hrefs }] in document order. The act
// markup is `<section class="sc-act" ...> ... <div class="sc-actK">KICKER</div>
// ... <a class="sc-card" href="HREF"> ...`. CSS selectors (.sc-act{ … }) don't
// match these attribute patterns, so the style block is not picked up.
function homeActs() {
  const html = renderScriptoriumHome({});
  assert.equal(typeof html, 'string', 'renderScriptoriumHome should return an HTML string');
  return html
    .split('<section class="sc-act"')
    .slice(1)
    .map((seg) => ({
      kicker: norm((seg.match(/class="sc-actK">([^<]*)</) || [])[1] || ''),
      hrefs: [...seg.matchAll(/class="sc-card" href="([^"]+)"/g)].map((m) => m[1]),
    }));
}

test('rail groups and mobile drawer groups are identical (modulo label case)', () => {
  assert.equal(NAV_GROUPS.length, NAV_DRAWER_GROUPS.length, 'group count differs');
  for (let i = 0; i < NAV_GROUPS.length; i++) {
    assert.equal(norm(NAV_GROUPS[i][0]), norm(NAV_DRAWER_GROUPS[i][0]), `group ${i} label differs`);
    assert.deepEqual(NAV_GROUPS[i][1], NAV_DRAWER_GROUPS[i][1], `group ${i} ("${NAV_GROUPS[i][0]}") keys differ`);
  }
});

test('every nav key is defined in NAV and routed exactly once', () => {
  const navKeys = new Set(NAV.map(([k]) => k));
  const routed = [...NAV_PRIMARY, ...NAV_GROUPS.flatMap(([, keys]) => keys)];
  for (const k of routed) assert.ok(navKeys.has(k), `routed key "${k}" is missing from the NAV table`);
  assert.equal(routed.length, new Set(routed).size, 'a key is routed into more than one place');
  for (const k of navKeys) assert.ok(routed.includes(k), `NAV key "${k}" is defined but routed nowhere (orphan tab)`);
});

test('home cards and rail groups agree on shared-key order, per act', () => {
  const h2k = hrefToKey();
  const acts = homeActs();
  assert.ok(acts.length >= 3, `expected at least 3 home acts, parsed ${acts.length}`);
  for (const [label, railKeys] of NAV_GROUPS) {
    const act = acts.find((a) => a.kicker === norm(label));
    assert.ok(act, `no home act matches rail group "${label}"`);
    // Home card keys present in this rail group, in card order; vs the rail keys
    // that also appear as a home card, in rail order. The shared subset's order
    // must match — this is what drifted on `make`.
    const homeOrder = act.hrefs.map((href) => h2k.get(href)).filter((k) => k && railKeys.includes(k));
    const railOrder = railKeys.filter((k) => homeOrder.includes(k));
    assert.deepEqual(
      homeOrder,
      railOrder,
      `act "${label}": home card order ${JSON.stringify(homeOrder)} != rail order ${JSON.stringify(railOrder)}`,
    );
  }
});
