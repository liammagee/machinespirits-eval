import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  listReplayBundles,
  readReplayBundle,
  readReplayItem,
  lineDiff,
  diffStats,
  GATE_BUCKETS,
} from '../services/poetics/replayBundles.js';

// The replay model is a read-only projection of exports/discursive-replays/<bundle>/.
// exports/ is gitignored, so these tests build a self-contained tmp fixture that
// mirrors the real manifest shape: records[] inlining item/gate/check/paths, plus a
// local_gate.summary that sorts each item into a bucket. The fixture deliberately
// exercises both check payload shapes (flat inline vs {parsed} on disk) and both
// score shapes (per-criterion rec.gate.scores vs flat check.scores), plus a dry-run
// bundle with no materialised .txt — the degrade-gracefully path.

let root;
const ORIG = 'A\nB\nC\nD\n';
const REVISED = 'A\nB-changed\nC\nE\nD\n';

function writeBundle(name, manifest, items = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  for (const [itemId, files] of Object.entries(items)) {
    const itemDir = path.join(dir, itemId.replace(/[^A-Za-z0-9._-]+/gu, '-'));
    fs.mkdirSync(itemDir, { recursive: true });
    for (const [fname, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(itemDir, fname), typeof content === 'string' ? content : JSON.stringify(content));
    }
  }
  return dir;
}

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-bundles-'));

  // Bundle 1 (older): one materialised survivor with a FLAT inline check + per-criterion gate scores.
  const survivorDir = path.join(root, 'mock-survivor', 'item-alpha');
  fs.mkdirSync(survivorDir, { recursive: true });
  fs.writeFileSync(path.join(survivorDir, 'original-public.txt'), ORIG);
  fs.writeFileSync(path.join(survivorDir, 'revised-public.txt'), REVISED);
  writeBundle('mock-survivor', {
    kind: 'discursive_replay_bundle',
    created_at: '2026-06-01T00:00:00.000Z',
    generator: 'mock',
    checker: 'mock',
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
    count: 1,
    local_gate: {
      enabled: true,
      thresholds: { non_leakage: 0.95 },
      next_stage_rule: 'survivors -> online scoring',
      summary: {
        survivors: [{ item_id: 'item-alpha', status: 'pass', failures: [], warnings: ['minor'] }],
      },
    },
    records: [
      {
        item: { id: 'item-alpha', run_id: 'run-1', source: 'phase2' },
        gate: {
          status: 'pass',
          escalate: false,
          scores: {
            non_leakage: { raw: 5, value: 1, scale: 5, threshold: 0.95, passes: true },
            public_evidence: { raw: 4, value: 0.8, scale: 5, threshold: 0.7, passes: true },
          },
        },
        // FLAT inline check (no .parsed wrapper).
        check: {
          passes: true,
          claim_boundary_ok: true,
          findings: [{ severity: 'info', note: 'clean' }],
          scores: { non_leakage: 5 },
        },
        generator: { backend: 'mock', model: 'mock-1', latencyMs: 10 },
        checker: { backend: 'mock', model: 'mock-1', latencyMs: 5 },
        paths: {
          originalPublic: path.join(survivorDir, 'original-public.txt'),
          revisedPublic: path.join(survivorDir, 'revised-public.txt'),
        },
      },
    ],
  });

  // Bundle 2 (newer): a needs_revision item whose check lives ON DISK as {parsed:{…}},
  // and whose scores come only from the flat check (no rec.gate.scores). Carries a
  // rich revision.json (move_ledger + hidden_state_use_ledger).
  writeBundle(
    'codex-newer',
    {
      kind: 'discursive_replay_bundle',
      created_at: '2026-06-03T00:00:00.000Z',
      generator: 'codex',
      checker: 'claude',
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
      count: 1,
      local_gate: {
        enabled: true,
        summary: {
          needs_revision: [
            { item_id: 'item-beta', status: 'revise_again', failures: ['dyadic_revision'], warnings: [] },
          ],
        },
      },
      records: [
        {
          item: { id: 'item-beta', run_id: 'run-2', source: 'phase2' },
          gate: { status: 'revise_again', escalate: true },
          // No inline check → falls back to reading paths.checkJson.
          generator: { backend: 'codex', model: 'codex-x', latencyMs: 2000 },
          checker: { backend: 'claude', model: 'claude-y', latencyMs: 1500 },
          paths: {
            originalPublic: path.join(root, 'codex-newer', 'item-beta', 'original-public.txt'),
            revisedPublic: path.join(root, 'codex-newer', 'item-beta', 'revised-public.txt'),
            checkJson: path.join(root, 'codex-newer', 'item-beta', 'check.json'),
            revisionJson: path.join(root, 'codex-newer', 'item-beta', 'revision.json'),
          },
        },
      ],
    },
    {
      'item-beta': {
        'original-public.txt': ORIG,
        'revised-public.txt': REVISED,
        // WRAPPED check shape: the real per-item check.json nests under .parsed.
        'check.json': {
          parsed: {
            passes: false,
            claim_boundary_ok: true,
            findings: [
              { severity: 'major', note: 'revision too small' },
              { severity: 'minor', note: 'phrasing' },
            ],
            scores: { dyadic_revision: 3, non_leakage: 5 },
          },
        },
        'revision.json': {
          revised_public_transcript: REVISED,
          move_ledger: [
            {
              turn: 'tutor 1',
              tactic: 'summarize_and_check',
              evidence_quote: 'the learner asked why',
              ontology_terms: ['ResponsiveMove', 'DyadicRevision'],
            },
          ],
          hidden_state_use_ledger: [
            {
              private_fact: 'branch pressure',
              used_for: 'tactic_selection',
              public_license_quote: 'q',
              leakage_risk: 'low',
            },
          ],
          non_leakage_check: { passes: true, notes: ['clean a', 'clean b'] },
          claim_boundary: 'counterfactual_revision_not_online_adaptation',
        },
      },
    },
  );

  // Bundle 3: dry-run — records present but NOT materialised (no .txt on disk).
  writeBundle('dry-run-bundle', {
    kind: 'discursive_replay_bundle',
    created_at: '2026-06-02T00:00:00.000Z',
    generator: 'codex',
    checker: 'claude',
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
    count: 1,
    local_gate: {
      enabled: false,
      summary: { dry_run: [{ item_id: 'item-gamma', status: 'dry_run' }] },
    },
    records: [
      {
        item: { id: 'item-gamma', run_id: 'run-3', source: 'phase2' },
        gate: { status: 'dry_run', escalate: false },
        paths: {
          originalPublic: path.join(root, 'dry-run-bundle', 'item-gamma', 'original-public.txt'),
          revisedPublic: path.join(root, 'dry-run-bundle', 'item-gamma', 'revised-public.txt'),
        },
      },
    ],
  });

  // A non-bundle directory (no manifest) and a stray file — must be ignored.
  fs.mkdirSync(path.join(root, 'not-a-bundle'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.txt'), 'ignore me');
});

after(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('listReplayBundles', () => {
  it('discovers only manifest-bearing dirs, newest createdAt first', () => {
    const bundles = listReplayBundles({ dir: root });
    assert.deepEqual(
      bundles.map((b) => b.name),
      ['codex-newer', 'dry-run-bundle', 'mock-survivor'],
      'sorted by created_at desc; non-bundle dirs and stray files excluded',
    );
  });

  it('surfaces bucket counts and provenance per bundle', () => {
    const bundles = listReplayBundles({ dir: root });
    const survivor = bundles.find((b) => b.name === 'mock-survivor');
    assert.equal(survivor.generator, 'mock');
    assert.equal(survivor.buckets.survivors, 1);
    assert.equal(survivor.buckets.needs_revision, 0);
    assert.equal(survivor.claimBoundary, 'counterfactual_revision_not_online_adaptation');
    assert.equal(survivor.gateEnabled, true);
    const dry = bundles.find((b) => b.name === 'dry-run-bundle');
    assert.equal(dry.buckets.dry_run, 1);
    assert.equal(dry.gateEnabled, false);
  });

  it('returns [] for a missing directory rather than throwing', () => {
    assert.deepEqual(listReplayBundles({ dir: path.join(root, 'does-not-exist') }), []);
  });
});

describe('readReplayBundle', () => {
  it('joins gate buckets onto items and reads the FLAT inline check', () => {
    const bundle = readReplayBundle('mock-survivor', { dir: root });
    assert.equal(bundle.items.length, 1);
    const it0 = bundle.items[0];
    assert.equal(it0.itemId, 'item-alpha');
    assert.equal(it0.bucket, 'survivors');
    assert.equal(it0.status, 'pass');
    assert.equal(it0.passes, true, 'flat inline check.passes is read without a .parsed wrapper');
    assert.equal(it0.findingsCount, 1);
    assert.equal(it0.hasOriginal, true);
    assert.equal(it0.hasRevised, true);
    assert.deepEqual(it0.warnings, ['minor']);
    // per-criterion gate scores preferred
    assert.equal(it0.scores.length, 2);
    const nl = it0.scores.find((s) => s.criterion === 'non_leakage');
    assert.equal(nl.threshold, 0.95);
    assert.equal(nl.passes, true);
  });

  it('reads the WRAPPED {parsed} check from disk and the flat-score fallback', () => {
    const bundle = readReplayBundle('codex-newer', { dir: root });
    const it0 = bundle.items[0];
    assert.equal(it0.bucket, 'needs_revision');
    assert.equal(it0.escalate, true);
    assert.equal(it0.passes, false, '{parsed}.passes is unwrapped from the on-disk check.json');
    assert.equal(it0.findingsCount, 2);
    // no rec.gate.scores → flat check.scores mapped to {criterion, raw}
    assert.equal(it0.scores.length, 2);
    const dr = it0.scores.find((s) => s.criterion === 'dyadic_revision');
    assert.equal(dr.raw, 3);
    assert.equal(dr.threshold, null, 'flat scores carry no threshold');
  });

  it('returns null for an unknown bundle name', () => {
    assert.equal(readReplayBundle('nope', { dir: root }), null);
  });
});

describe('readReplayItem', () => {
  it('computes the original↔revised diff and normalised scores', () => {
    const item = readReplayItem('mock-survivor', 'item-alpha', { dir: root });
    assert.equal(item.materialized.original, true);
    assert.equal(item.materialized.revised, true);
    assert.equal(item.passes, true);
    assert.equal(item.claimBoundaryOk, true);
    assert.equal(item.findings.length, 1);
    // ORIG → REVISED: B→B-changed (del+add), insert E (add); A,C,D stay.
    assert.deepEqual(item.diffStats, { added: 2, deleted: 1, unchanged: 4, changed: 3 });
  });

  it('surfaces the rich revision ledgers (move + hidden-state + non-leakage)', () => {
    const item = readReplayItem('codex-newer', 'item-beta', { dir: root });
    assert.equal(item.passes, false);
    assert.equal(item.revision.moveLedger.length, 1);
    assert.equal(item.revision.moveLedger[0].tactic, 'summarize_and_check');
    assert.deepEqual(item.revision.moveLedger[0].ontologyTerms, ['ResponsiveMove', 'DyadicRevision']);
    assert.equal(item.revision.hiddenStateLedger.length, 1);
    assert.equal(item.revision.hiddenStateLedger[0].leakageRisk, 'low');
    assert.equal(item.revision.hiddenStateLedger[0].usedFor, 'tactic_selection');
    assert.equal(item.revision.nonLeakageCheck.passes, true);
    assert.equal(item.revision.nonLeakageCheck.notes.length, 2);
    assert.equal(item.revision.claimBoundary, 'counterfactual_revision_not_online_adaptation');
  });

  it('degrades gracefully on a dry-run item with no materialised transcripts', () => {
    const item = readReplayItem('dry-run-bundle', 'item-gamma', { dir: root });
    assert.equal(item.materialized.original, false);
    assert.equal(item.materialized.revised, false);
    assert.equal(item.original, '');
    assert.equal(item.revised, '');
    assert.equal(item.diffStats.changed, 0, 'empty↔empty yields no changes');
    assert.equal(item.passes, null, 'no check → null, not a throw');
    assert.equal(item.revision, null, 'no revision.json → null');
  });

  it('returns null for an unknown item id', () => {
    assert.equal(readReplayItem('mock-survivor', 'no-such-item', { dir: root }), null);
  });
});

describe('lineDiff + diffStats (pure)', () => {
  it('produces an LCS-aligned edit script', () => {
    const diff = lineDiff('a\nb\nc', 'a\nB\nc\nd');
    assert.deepEqual(
      diff.map((d) => d.type),
      ['eq', 'del', 'add', 'eq', 'add'],
      'a stays; b→B is del+add; c stays; d is appended',
    );
    // line numbers are 1-based and null on the absent side
    const del = diff.find((d) => d.type === 'del');
    assert.equal(del.aLine, 2);
    assert.equal(del.bLine, null);
  });

  it('counts an all-equal diff as zero changes', () => {
    const diff = lineDiff('x\ny', 'x\ny');
    assert.deepEqual(diffStats(diff), { added: 0, deleted: 0, unchanged: 2, changed: 0 });
  });

  it('handles empty inputs without throwing', () => {
    assert.deepEqual(lineDiff('', ''), [{ type: 'eq', text: '', aLine: 1, bLine: 1 }]);
    assert.deepEqual(diffStats(lineDiff('', '')), { added: 0, deleted: 0, unchanged: 1, changed: 0 });
  });
});

describe('GATE_BUCKETS', () => {
  it('is a frozen, ordered enumeration', () => {
    assert.ok(Object.isFrozen(GATE_BUCKETS));
    assert.equal(GATE_BUCKETS[0], 'survivors');
    assert.ok(GATE_BUCKETS.includes('needs_revision'));
    assert.ok(GATE_BUCKETS.includes('dry_run'));
  });
});
