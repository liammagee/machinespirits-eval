// Board presentation tests. These exercise the /board renderer against a
// throwaway generated board.json so the real workplan is never touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderWorkplanBoardHtml } from '../scripts/browse-poetics-scripts.js';

function withBoard(fn) {
  const prev = process.env.WORKPLAN_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-board-focus-'));
  const board = {
    generated: '2026-07-01T00:00:00.000Z',
    counts: {
      total: 2,
      byStatus: { active: 1, done: 1 },
      byType: { maintenance: 2 },
    },
    items: [
      {
        id: 'open-cleanup',
        title: 'Open cleanup item',
        status: 'active',
        type: 'maintenance',
        priority: 'P2',
        owner: 'codex',
        source: 'manual',
        created: '2026-07-01',
        updated: '2026-07-01',
        verification: 'the open item is visible',
      },
      {
        id: 'done-history',
        title: 'Completed historical item',
        status: 'done',
        type: 'maintenance',
        priority: 'P2',
        owner: 'codex',
        source: 'manual',
        created: '2026-07-01',
        updated: '2026-07-01',
        verification: 'the completed item remains reachable',
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'board.json'), JSON.stringify(board, null, 2));
  process.env.WORKPLAN_DIR = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.WORKPLAN_DIR;
    else process.env.WORKPLAN_DIR = prev;
  }
}

test('board defaults to open-work focus and hides settled history cards', () =>
  withBoard(() => {
    const html = renderWorkplanBoardHtml();
    assert.match(html, /data-focus="open"/);
    assert.match(html, /Open cleanup item/);
    assert.doesNotMatch(html, /<article class="card"[^>]+data-id="done-history"/);
    assert.match(html, /1 open item shown; 1 settled hidden/);
  }));

test('board focus=all and item deep links keep settled cards reachable', () =>
  withBoard(() => {
    const all = renderWorkplanBoardHtml({ focus: 'all' });
    assert.match(all, /Completed historical item/);
    assert.match(all, /2 items shown/);

    const target = renderWorkplanBoardHtml({ item: 'done-history' });
    assert.match(target, /Completed historical item/);
    assert.match(target, /data-focus="all"/);
  }));

test('board focus=settled shows history without open-work cards', () =>
  withBoard(() => {
    const html = renderWorkplanBoardHtml({ focus: 'settled' });
    assert.match(html, /Completed historical item/);
    assert.doesNotMatch(html, /<article class="card"[^>]+data-id="open-cleanup"/);
    assert.match(html, /1 settled item shown; 1 open hidden/);
  }));
