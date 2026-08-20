// Board presentation tests. These exercise both the source-derived browser
// projection and the deliberate board.json-only fixture fallback without ever
// touching the real workplan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readWorkplanBoard,
  refreshWorkplanBoard,
  renderScriptoriumHome,
  renderWorkplanBoardHtml,
} from '../scripts/browse-poetics-scripts.js';

function sourceItem({ title = 'Source board item', status = 'active' } = {}) {
  return `---
id: scriptorium-source-board
title: ${title}
status: ${status}
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-07-01
updated: 2026-07-01
verification: source projection is visible
tags:
  - scriptorium
  - ux
milestone: source-milestone
---

Source-owned body.
`;
}

function withSourceBoard(fn, { staleView = false } = {}) {
  const prev = process.env.WORKPLAN_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-board-source-'));
  fs.mkdirSync(path.join(dir, 'items'));
  fs.writeFileSync(path.join(dir, 'items', 'scriptorium-source-board.md'), sourceItem());
  fs.writeFileSync(
    path.join(dir, 'milestones.yaml'),
    'milestones:\n  - id: source-milestone\n    title: Source milestone\n    status: active\n',
  );
  if (staleView) {
    fs.writeFileSync(
      path.join(dir, 'board.json'),
      JSON.stringify({
        generated: '2000-01-01T00:00:00.000Z',
        counts: { total: 1, byStatus: { done: 1 }, byType: { maintenance: 1 } },
        items: [{ id: 'stale-view', title: 'Stale generated item', status: 'done', type: 'maintenance' }],
      }),
    );
  }
  process.env.WORKPLAN_DIR = dir;
  try {
    return fn({ dir });
  } finally {
    if (prev === undefined) delete process.env.WORKPLAN_DIR;
    else process.env.WORKPLAN_DIR = prev;
  }
}

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

test('source items outrank a stale board.json across the board, roadmap, and command palette', () =>
  withSourceBoard(
    () => {
      const board = readWorkplanBoard();
      assert.equal(board.counts.total, 1);
      assert.equal(board.items[0].id, 'scriptorium-source-board');
      assert.doesNotMatch(JSON.stringify(board), /Stale generated item/u);

      const boardHtml = renderWorkplanBoardHtml({ focus: 'all' });
      assert.match(boardHtml, /Source board item/u);
      assert.doesNotMatch(boardHtml, /Stale generated item/u);

      const homeHtml = renderScriptoriumHome();
      assert.match(homeHtml, /Source board item/u);
      assert.match(homeHtml, /board\?item=scriptorium-source-board/u);
      assert.doesNotMatch(homeHtml, /Stale generated item/u);
    },
    { staleView: true },
  ));

test('source projection is cached per workplan and explicit refresh rebuilds without generated views', () =>
  withSourceBoard(({ dir }) => {
    assert.equal(readWorkplanBoard().items[0].title, 'Source board item');
    fs.writeFileSync(
      path.join(dir, 'items', 'scriptorium-source-board.md'),
      sourceItem({ title: 'Refreshed source item', status: 'review' }),
    );

    assert.equal(readWorkplanBoard().items[0].title, 'Source board item', 'ordinary reads reuse the process cache');
    const refreshed = refreshWorkplanBoard();
    assert.equal(refreshed.items[0].title, 'Refreshed source item');
    assert.equal(refreshed.items[0].status, 'review');
    assert.equal(fs.existsSync(path.join(dir, 'BOARD.md')), false);
    assert.equal(fs.existsSync(path.join(dir, 'board.json')), false);
  }));

test('board.json remains a compatibility fallback only when items is absent', () =>
  withBoard(() => {
    const board = readWorkplanBoard();
    assert.equal(board.counts.total, 2);
    assert.deepEqual(
      board.items.map((item) => item.id),
      ['open-cleanup', 'done-history'],
    );
  }));
