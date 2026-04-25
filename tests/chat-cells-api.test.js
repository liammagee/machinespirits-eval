/**
 * Contract tests for /api/chat/cells.
 *
 * The chat UI's orientation surface (lineage block, compare panel, cell-row
 * effect chips, family-grouped picker) reads cells[].orientation.* and the
 * top-level orientations map. If the route stops returning any of those
 * fields, the UI breaks silently — the existing
 * tests/pedagogical-orientation-coverage.test.js validates the YAML side,
 * but does NOT assert what the HTTP endpoint actually emits. This test
 * fills that gap by booting Express in-process and snapshotting the
 * response shape.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';

function get(baseUrl, p) {
  return new Promise((resolve, reject) => {
    http
      .get(`${baseUrl}${p}`, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let body;
          try { body = JSON.parse(data); } catch { body = data; }
          resolve({ status: res.statusCode, body });
        });
      })
      .on('error', reject);
  });
}

describe('GET /api/chat/cells', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
  });

  it('returns 200 with count + cells[] + orientations', async () => {
    const { status, body } = await get(baseUrl, '/api/chat/cells');
    assert.equal(status, 200);
    assert.equal(typeof body.count, 'number');
    assert.ok(Array.isArray(body.cells));
    assert.equal(body.cells.length, body.count);
    assert.equal(typeof body.orientations, 'object');
    assert.ok(body.orientations !== null);
  });

  it('orientations map covers the canonical prompt_types', async () => {
    const { body } = await get(baseUrl, '/api/chat/cells');
    for (const pt of ['base', 'placebo', 'recognition', 'matched_pedagogical', 'matched_behaviorist']) {
      assert.ok(body.orientations[pt], `missing orientations["${pt}"] in response`);
    }
  });

  it('compareDefault target cells exist with orientation', async () => {
    // The chat UI's compareDefault helper hard-codes these four cell IDs as
    // "natural opposite" anchors. If any of them disappears or loses its
    // orientation, the compare panel silently falls back to cell_5 instead
    // of the intended pairing.
    const { body } = await get(baseUrl, '/api/chat/cells');
    const byName = new Map(body.cells.map((c) => [c.name, c]));
    for (const name of [
      'cell_1_base_single_unified',
      'cell_5_recog_single_unified',
      'cell_95_base_matched_single_unified',
      'cell_96_base_behaviorist_single_unified',
    ]) {
      const cell = byName.get(name);
      assert.ok(cell, `compareDefault target cell missing: ${name}`);
      assert.ok(cell.orientation, `compareDefault target cell has no orientation: ${name}`);
      assert.equal(typeof cell.orientation.effectiveFamily, 'string');
      assert.equal(typeof cell.orientation.shortLabel, 'string');
    }
  });

  it('per-cell orientation carries every field the chat UI reads', async () => {
    const { body } = await get(baseUrl, '/api/chat/cells');
    const cell5 = body.cells.find((c) => c.name === 'cell_5_recog_single_unified');
    assert.ok(cell5?.orientation, 'cell_5 must have orientation');
    // Fields read by the chat HTML's lineage/compare/cell-row blocks:
    const required = [
      'promptType',
      'family',
      'effectiveFamily',
      'shortLabel',
      'lineage',
      'viewOfLearner',
      'roleOfTutor',
      'keyMechanism',
      'vocabulary',
    ];
    for (const f of required) {
      assert.ok(f in cell5.orientation, `cell_5.orientation missing field: ${f}`);
    }
    assert.ok(Array.isArray(cell5.orientation.vocabulary), 'vocabulary must be an array');
  });

  it('every cell with a registered prompt_type has orientation populated', async () => {
    const { body } = await get(baseUrl, '/api/chat/cells');
    const known = new Set(Object.keys(body.orientations));
    const offenders = body.cells.filter((c) => known.has(c.promptType) && !c.orientation);
    assert.equal(offenders.length, 0,
      `cells with known prompt_type but null orientation: ${offenders.map((c) => c.name).join(', ')}`);
  });

  it('effective family is intersubjective for recognition_mode cells, transmission otherwise', async () => {
    // The chat picker's natural-opposite logic depends on this collapse.
    // dialectical_*/divergent_* cells are architectural variants whose
    // effective family follows their paired ego.
    const { body } = await get(baseUrl, '/api/chat/cells');
    for (const c of body.cells) {
      const o = c.orientation;
      if (!o || o.family !== 'architectural_variant') continue;
      const fam = o.effectiveFamily;
      assert.ok(
        fam === 'intersubjective' || fam === 'transmission',
        `${c.name}: architectural variant should resolve to intersubjective or transmission, got ${fam}`,
      );
    }
  });

  it('effectVsBase is numeric or null on every orientation', async () => {
    // The cell-row chip depends on this — string values would break the
    // formatEffectSize logic and the magnitude binner.
    const { body } = await get(baseUrl, '/api/chat/cells');
    for (const c of body.cells) {
      const o = c.orientation;
      if (!o) continue;
      const v = o.effectVsBase;
      assert.ok(v === null || v === undefined || typeof v === 'number',
        `${c.name}: effectVsBase must be number or nullish, got ${typeof v} (${v})`);
    }
  });
});
