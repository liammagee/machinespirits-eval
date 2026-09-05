#!/usr/bin/env node
/**
 * Scoreboard replay over the sealed archives (workplan card:
 * scoreboard-reader-replay-and-crossed-run, Step 1).
 *
 * Zero model calls. Reads the private archive repo read-only and writes one
 * board file per dialogue plus a summary under exports/scoreboard-replay/.
 *
 * Endpoint 1 (shapes separate): for every dialogue with a cast shape, the
 * board's shape rules must name the cast shape and no other. Bars: pooled
 * agreement >= 0.8, no pair of shapes under 0.7.
 *
 * Endpoint 2 (delivered moves show): a move the instruments say was
 * delivered must appear on the board row of that turn. Bar: pooled >= 0.8,
 * reported per section.
 *
 * Secondary, no bar: at every forced quiet card in the 6.24 exports, the
 * tutor row shows no release and no new tutor commitment.
 *
 * Usage:
 *   node scripts/replay-scoreboard.js [--archive-dir <dir>] [--eval-exports-dir <dir>]
 *        [--out <dir>] [--sections 6.25,6.26,...] [--limit N] [--quiet]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  SCOREBOARD_FIELDS,
  buildScoreboard,
  deliveredFamily,
  loadScoreboardWorld,
  readTutorStubTraceEvents,
  renderScoreboardTable,
  traceDialogueIdentity,
} from '../services/tutorStubScoreboard.js';
import { SHAPES, castShapeForProfile, pairwiseAgreement, readShape } from '../services/tutorStubScoreboardShapes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AUTO = 'artifacts/tutor-stub-live/.tutor-stub-auto-eval';

/** The sealed archives, one entry per run. Paths are relative to the archive repo. */
export const ARCHIVES = Object.freeze([
  {
    section: '6.25',
    run: 'adaptive-warrant-outcome-main-block-live-2026-08-13',
    kind: 'dialogue-folders',
    rel: `${AUTO}/adaptive-warrant-outcome-main-block-live-2026-08-13/dialogues`,
    endpoint2: 'challenge-family',
  },
  {
    section: '6.25',
    run: 'adaptive-warrant-steering-decomposition-live-2026-08-14',
    kind: 'dialogue-folders',
    rel: `${AUTO}/adaptive-warrant-steering-decomposition-live-2026-08-14/dialogues`,
    endpoint2: 'challenge-family',
  },
  {
    section: '6.26',
    run: 'guarded-learner-main-block-2026-08-15',
    kind: 'dialogue-folders',
    rel: `${AUTO}/guarded-learner-main-block-2026-08-15/dialogues`,
    endpoint2: 'challenge-family',
  },
  {
    section: '6.27',
    run: 'boredom-proof-dag-v5-live',
    kind: 'boredom-batches',
    rel: 'artifacts/boredom-proof-dag-v5-live',
  },
  {
    section: '6.27',
    run: 'boredom-proof-dag-v7-live',
    kind: 'boredom-batches',
    rel: 'artifacts/boredom-proof-dag-v7-live',
  },
  {
    section: '6.27',
    run: 'boredom-proof-dag-v8-live',
    kind: 'boredom-batches',
    rel: 'artifacts/boredom-proof-dag-v8-live',
  },
  {
    section: '6.28',
    run: 'resistant-learner-merged-powered-v5-2026-08-26b',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/resistant-learner-merged-powered-v5-2026-08-26b',
    endpoint2: 'delivered-move',
  },
  {
    section: '6.28',
    run: 'frame-refuser-depth-gate1-2026-08-27',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-2026-08-27',
    endpoint2: 'delivered-move-depth',
  },
  {
    section: '6.28',
    run: 'frame-refuser-depth-gate1-v2-2026-08-27',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v2-2026-08-27',
    endpoint2: 'delivered-move-depth',
  },
  {
    section: '6.28',
    run: 'frame-refuser-depth-gate1-v3-2026-08-27',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v3-2026-08-27',
    endpoint2: 'delivered-move-depth',
  },
  {
    section: '6.28',
    run: 'frame-refuser-depth-gate1-v4-2026-08-27',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v4-2026-08-27',
    endpoint2: 'delivered-move-depth',
  },
  {
    section: '6.28',
    run: 'frame-refuser-depth-gate1-v5-2026-08-30',
    kind: 'report-rows',
    rel: 'artifacts/tutor-stub-live/frame-refuser-depth-gate1-v5-2026-08-30',
    endpoint2: 'delivered-move-depth',
  },
  {
    section: '6.29',
    run: 'qa-matrix-2026-08-28T23-01-11-203Z',
    kind: 'qa-matrix',
    rel: `${AUTO}/qa-matrix-2026-08-28T23-01-11-203Z`,
  },
  {
    section: '6.29',
    run: 'qa-matrix-2026-08-29T00-13-58-641Z',
    kind: 'qa-matrix',
    rel: `${AUTO}/qa-matrix-2026-08-29T00-13-58-641Z`,
  },
  {
    section: '6.29',
    run: 'qa-matrix-2026-08-29T12-21-26-240Z',
    kind: 'qa-matrix',
    rel: `${AUTO}/qa-matrix-2026-08-29T12-21-26-240Z`,
  },
  {
    section: '6.30',
    run: 'defiant-warrant-gate1-2026-08-29-r3',
    kind: 'report-rows',
    rel: `${AUTO}/defiant-warrant-gate1-2026-08-29-r3`,
    reportRel: '.tutor-stub-auto-eval/defiant-warrant-gate1-2026-08-29-r3/report.json',
    conductRel: '.tutor-stub-auto-eval/defiant-warrant-gate1-2026-08-29-r3/conduct-reader-calls.jsonl',
    endpoint2: 'conduct-slots',
  },
]);

/** 6.24 survivors in the eval repo exports; used only for the quiet-card check. */
export const QUIET_CARD_EXPORT_DIRS = Object.freeze([
  'tutor-stub-outcome/step6-form-v3-live',
  'tutor-stub-outcome/step7-hold-live',
  'tutor-stub-outcome/step7b-hold-rework',
  'tutor-stub-outcome/step7c-hold-overconfident',
  'tutor-stub-outcome/step7d-hold-memory-limited',
  'tutor-stub-outcome/step7e-hold-opus-tutor',
  'form-state-detector/step6a-traces',
]);

export const BARS = Object.freeze({ pooledAgreement: 0.8, pairwiseAgreement: 0.7, deliveredMoves: 0.8 });

// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = { sections: null, limit: null, quiet: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--archive-dir') out.archiveDir = next();
    else if (a === '--eval-exports-dir') out.evalExportsDir = next();
    else if (a === '--out') out.out = next();
    else if (a === '--sections')
      out.sections = next()
        .split(',')
        .map((s) => s.trim());
    else if (a === '--limit') out.limit = Number(next());
    else if (a === '--scratch') out.scratch = next();
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  out.archiveDir = path.resolve(
    out.archiveDir || process.env.EVAL_ARCHIVE_DIR || path.join(ROOT, '..', 'machinespirits-eval-private'),
  );
  out.evalExportsDir = path.resolve(out.evalExportsDir || path.join(ROOT, 'exports'));
  out.out = path.resolve(out.out || path.join(ROOT, 'exports', 'scoreboard-replay'));
  out.scratch = path.resolve(out.scratch || path.join(os.tmpdir(), 'scoreboard-replay-tgz'));
  return out;
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const exists = (p) => {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
};
const listDirs = (p) =>
  exists(p)
    ? fs
        .readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];
const listFiles = (p, test) => (exists(p) ? fs.readdirSync(p).filter(test).sort() : []);
const isTrace = (f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz');

function walkFiles(dir, out = []) {
  if (!exists(dir)) return out;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walkFiles(p, out);
    else out.push(p);
  }
  return out;
}

function turnCompleteCount(events) {
  return events.filter((e) => e?.type === 'turn_complete').length;
}

// ---------------------------------------------------------------------------
// Walkers: each returns [{ id, tracePath, arm, meta }].
// ---------------------------------------------------------------------------
function walkDialogueFolders(base) {
  const out = [];
  for (const folder of listDirs(base)) {
    const files = listFiles(path.join(base, folder), (f) => f.endsWith('.jsonl.gz'));
    if (!files.length) continue;
    const m = folder.match(/-s\d+-([a-z_]+)$/);
    out.push({
      id: folder,
      tracePath: path.join(base, folder, files[files.length - 1]),
      arm: m ? m[1] : null,
      meta: { folder },
    });
  }
  return out;
}

function walkBoredomBatches(base, scratch, run) {
  // Each batch folder carries a result file that names the retained trace per job. Jobs that
  // needed a bounded technical recovery point under recoveries/recovery-NNN/. The traces are
  // packed per job as traces.tgz; the result file tells which packed trace the study kept.
  const out = [];
  const skipped = [];
  for (const batch of listDirs(base)) {
    const resultPath = ['batch-final-result.json', 'batch-result.json']
      .map((f) => path.join(base, batch, f))
      .find(exists);
    if (!resultPath) continue;
    const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    const plan = exists(path.join(base, batch, 'batch-plan.json'))
      ? JSON.parse(fs.readFileSync(path.join(base, batch, 'batch-plan.json'), 'utf8'))
      : null;
    const planById = new Map((plan?.jobs || []).map((j) => [j.id, j]));
    for (const row of result.results || []) {
      const id = `${batch}/${row.job_id}`;
      if (!row.trace) {
        skipped.push({ id, reason: 'no trace path', status: row.status || null });
        continue;
      }
      // ".tutor-stub-auto-eval/<batch-dir>/(jobs|recoveries/recovery-NNN/jobs)/<job>/traces/<file>.jsonl"
      const parts = row.trace.split('/');
      const jobsIdx = parts.lastIndexOf('jobs');
      if (jobsIdx < 0) {
        skipped.push({ id, reason: 'trace path has no jobs segment', trace: row.trace });
        continue;
      }
      const relJobDir = parts.slice(jobsIdx - (parts[jobsIdx - 2] === 'recoveries' ? 2 : 0), jobsIdx + 2).join('/');
      const traceFile = parts[parts.length - 1];
      const tgz = path.join(base, batch, relJobDir, 'traces.tgz');
      if (!exists(tgz)) {
        skipped.push({ id, reason: 'traces.tgz missing', trace: row.trace });
        continue;
      }
      const dest = path.join(scratch, run, batch, relJobDir.replaceAll('/', '__'));
      if (!exists(path.join(dest, 'traces'))) {
        fs.mkdirSync(dest, { recursive: true });
        execFileSync('tar', ['-xzf', tgz, '-C', dest]);
      }
      const tracePath = path.join(dest, 'traces', traceFile);
      if (!exists(tracePath)) {
        skipped.push({ id, reason: 'named trace not in traces.tgz', trace: row.trace });
        continue;
      }
      const planned = planById.get(row.job_id) || null;
      out.push({
        id,
        tracePath,
        arm: planned?.realization || null,
        meta: {
          batch,
          job: row.job_id,
          status: row.status || null,
          origin: row.origin || null,
          world: planned?.world || null,
        },
      });
    }
  }
  return { items: out, skipped };
}

function resolveTrace(archiveDir, base, rel) {
  const candidates = [
    path.join(base, rel),
    `${path.join(base, rel)}.gz`,
    path.join(archiveDir, rel),
    `${path.join(archiveDir, rel)}.gz`,
    path.join(archiveDir, 'artifacts', 'tutor-stub-live', rel),
    `${path.join(archiveDir, 'artifacts', 'tutor-stub-live', rel)}.gz`,
  ];
  return candidates.find(exists) || null;
}

function walkReportRows(archiveDir, entry) {
  const base = path.join(archiveDir, entry.rel);
  const reportPath = entry.reportRel ? path.join(archiveDir, entry.reportRel) : path.join(base, 'report.json');
  const report = readJson(reportPath);
  const out = [];
  const skipped = [];
  for (const row of report.rows || []) {
    const id = row.job?.id || row.case_id || row.id;
    if (!row.trace) {
      skipped.push({ id, reason: 'no trace path', status: row.status || null });
      continue;
    }
    const tracePath = resolveTrace(archiveDir, base, row.trace);
    if (!tracePath) {
      skipped.push({ id, reason: 'trace missing', trace: row.trace });
      continue;
    }
    out.push({ id, tracePath, arm: row.job?.arm_id || row.assigned_arm || null, meta: { row } });
  }
  return { items: out, skipped, report };
}

function walkQaMatrix(base) {
  const seen = new Map();
  for (const p of walkFiles(base).filter(isTrace)) {
    const events = readTutorStubTraceEvents(p);
    const identity = traceDialogueIdentity(events);
    const key = `${identity.profile}|${identity.policy}|${identity.repeat}`;
    const rec = {
      id: `${identity.profile}-${identity.policy}-r${identity.repeat}`,
      tracePath: p,
      arm: identity.policy,
      meta: { eventCount: events.length, key },
    };
    const prev = seen.get(key);
    if (!prev || rec.meta.eventCount > prev.meta.eventCount) seen.set(key, rec);
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Board helpers.
// ---------------------------------------------------------------------------
const tutorRow = (board, turn) => board.rows.find((r) => r.turn === turn && r.speaker === 'tutor') || null;
const has = (value, token) => typeof value === 'string' && value.split('+').includes(token);
const named = (value) => typeof value === 'string' && value !== 'none' && value !== 'unread';

const worldCache = new Map();
function worldFor(worldId) {
  if (!worldId) return null;
  if (worldCache.has(worldId)) return worldCache.get(worldId);
  let world = null;
  try {
    world = loadScoreboardWorld(worldId, { rootDir: ROOT });
  } catch {
    world = null;
  }
  worldCache.set(worldId, world);
  return world;
}

function safeName(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, '_');
}

function normalizeQuote(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[“”"'‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Endpoint 2 checks.
// ---------------------------------------------------------------------------
function checkChallengeFamily(board, events) {
  const checks = [];
  for (const e of events) {
    if (e?.type !== 'turn_complete') continue;
    const record = e.turnRecord || {};
    const family = deliveredFamily(record);
    if (family !== 'challenge_resistance') continue;
    const turn = record.turn ?? e.turn;
    const row = tutorRow(board, turn);
    const issued = row ? has(row.fields.challenge, 'issued') : false;
    const textMark = row
      ? row.marks.some(
          (m) => m.field === 'challenge' && m.value === 'issued' && (m.source === 'text' || m.source === 'family+text'),
        )
      : false;
    checks.push({
      kind: 'challenge-family',
      turn,
      expected: 'challenge issued',
      joined: issued,
      textOnly: textMark,
      got: row ? row.fields.challenge : 'no row',
      text: row?.text || null,
      marks: row?.marks?.filter((m) => m.field === 'challenge') || [],
    });
  }
  return checks;
}

function checkDeliveredMove(board, events, row) {
  const face = row?.job?.face_id || null;
  const checks = [];
  for (const e of events) {
    if (e?.type !== 'tutor_delivery_enforcement' || e.delivered !== true) continue;
    const r = tutorRow(board, e.turn);
    const testOffered = r ? has(r.fields.test, 'offered') : false;
    const conditionNamed = r ? named(r.fields.condition_named) : false;
    const expected = face === 'faceA' ? 'test offered' : 'condition named';
    const hit = face === 'faceA' ? testOffered : conditionNamed;
    checks.push({
      kind: 'delivered-move',
      face,
      move: row?.job?.pedagogical_move || null,
      turn: e.turn,
      expected,
      joined: hit,
      textOnly: hit,
      testOffered,
      conditionNamed,
      quote: e.quote,
      got: r ? { test: r.fields.test, condition_named: r.fields.condition_named } : 'no row',
      text: r?.text || null,
      marks: r?.marks?.filter((m) => ['test', 'condition_named'].includes(m.field)) || [],
    });
  }
  return checks;
}

function checkDeliveredMoveDepth(board, row) {
  const checks = [];
  for (const d of row?.delivery || []) {
    if (d.delivered !== true) continue;
    const r = tutorRow(board, d.turn);
    const testOffered = r ? has(r.fields.test, 'offered') : false;
    const conditionNamed = r ? named(r.fields.condition_named) : false;
    checks.push({
      kind: 'delivered-move-depth',
      arm: row.job?.arm_id || null,
      move: row.job?.pedagogical_move || row.job?.action || null,
      turn: d.turn,
      expected: 'condition named',
      joined: conditionNamed,
      textOnly: conditionNamed,
      testOffered,
      conditionNamed,
      got: r ? { test: r.fields.test, condition_named: r.fields.condition_named } : 'no row',
      text: r?.text || null,
      marks: r?.marks?.filter((m) => ['test', 'condition_named'].includes(m.field)) || [],
    });
  }
  return checks;
}

function checkConductSlots(board, conductRows) {
  const checks = [];
  for (const c of conductRows) {
    const r = tutorRow(board, c.turn);
    const text = normalizeQuote(r?.text);
    if (c.scope_statement === 'yes') {
      const strict = r ? has(r.fields.challenge, 'answered') : false;
      const loose = strict || Boolean(r?.marks?.some((m) => m.field === 'scope_statement'));
      const q = normalizeQuote(c.quotes?.scope_statement);
      checks.push({
        kind: 'conduct-scope',
        turn: c.turn,
        expected: 'challenge answered',
        joined: strict,
        textOnly: strict,
        loose,
        quoteLocated: q ? text.includes(q.slice(0, 40)) : null,
        quote: c.quotes?.scope_statement || null,
        got: r ? r.fields.challenge : 'no row',
        text: r?.text || null,
        marks: r?.marks?.filter((m) => ['challenge', 'scope_statement'].includes(m.field)) || [],
      });
    }
    if (c.conditional_frame_offer === 'yes') {
      const hit = r ? has(r.fields.test, 'offered') : false;
      const q = normalizeQuote(c.quotes?.conditional_frame_offer);
      checks.push({
        kind: 'conduct-frame-offer',
        turn: c.turn,
        expected: 'test offered',
        joined: hit,
        textOnly: hit,
        quoteLocated: q ? text.includes(q.slice(0, 40)) : null,
        quote: c.quotes?.conditional_frame_offer || null,
        got: r ? r.fields.test : 'no row',
        text: r?.text || null,
        marks: r?.marks?.filter((m) => m.field === 'test') || [],
      });
    }
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Quiet-card check over the 6.24 exports.
// ---------------------------------------------------------------------------
function quietCardCheck(evalExportsDir, outDir, log) {
  const perForced = {};
  const violations = [];
  let files = 0;
  let events = 0;
  for (const rel of QUIET_CARD_EXPORT_DIRS) {
    const dir = path.join(evalExportsDir, rel);
    for (const p of walkFiles(dir).filter(isTrace)) {
      const evs = readTutorStubTraceEvents(p);
      const forces = evs.filter((e) => e?.type === 'tutor_card_force' && e.forced && e.withheld === false);
      if (!forces.length) continue;
      files += 1;
      const identity = traceDialogueIdentity(evs);
      const board = buildScoreboard({ events: evs, world: worldFor(identity.worldId), identity });
      const boardName = `${safeName(rel)}__${safeName(path.basename(p).replace(/\.jsonl(\.gz)?$/, ''))}`;
      fs.mkdirSync(path.join(outDir, '6.24-quiet-cards'), { recursive: true });
      fs.writeFileSync(
        path.join(outDir, '6.24-quiet-cards', `${boardName}.board.json`),
        JSON.stringify(board, null, 2),
      );
      fs.writeFileSync(path.join(outDir, '6.24-quiet-cards', `${boardName}.board.txt`), renderScoreboardTable(board));
      for (const f of forces) {
        events += 1;
        const row = tutorRow(board, f.turn);
        const tally = (perForced[f.forced] ||= {
          n: 0,
          clean: 0,
          releaseShown: 0,
          ledgerInForce: 0,
          commitmentShown: 0,
          unread: 0,
          noRow: 0,
        });
        tally.n += 1;
        if (!row) {
          tally.noRow += 1;
          continue;
        }
        const releaseValue = row.fields.release;
        const commitValue = row.fields.commitment_undertaken;
        if (releaseValue === 'unread' || commitValue === 'unread') tally.unread += 1;
        // The release field is the ledger in force. The check asks for a new
        // release on this turn, so it reads sinceTurn, not ledger size.
        const releaseShown = Array.isArray(releaseValue) && releaseValue.some((r) => r.sinceTurn === f.turn);
        if (Array.isArray(releaseValue) && releaseValue.length > 0) tally.ledgerInForce += 1;
        const commitmentShown = named(commitValue);
        if (releaseShown) tally.releaseShown += 1;
        if (commitmentShown) tally.commitmentShown += 1;
        if (!releaseShown && !commitmentShown) tally.clean += 1;
        else
          violations.push({
            file: path.relative(evalExportsDir, p),
            turn: f.turn,
            forced: f.forced,
            release: releaseValue,
            commitment_undertaken: commitValue,
            text: row.text,
            marks: row.marks.filter((m) => ['release', 'commitment_undertaken'].includes(m.field)),
          });
      }
    }
  }
  log(`6.24 quiet cards: ${files} traces, ${events} forced cards`);
  return { files, events, perForced, violations };
}

// ---------------------------------------------------------------------------
function rate(hits, n) {
  return n ? Number((hits / n).toFixed(4)) : null;
}

export function summarizeEndpoint1(results) {
  const pool = results.filter((r) => r.cast);
  const hits = pool.filter((r) => r.read === r.cast).length;
  const perShape = {};
  for (const r of pool) {
    const s = (perShape[r.cast] ||= { n: 0, hits: 0, readAs: {} });
    s.n += 1;
    if (r.read === r.cast) s.hits += 1;
    s.readAs[r.read] = (s.readAs[r.read] || 0) + 1;
  }
  for (const s of Object.values(perShape)) s.rate = rate(s.hits, s.n);
  const shapesPresent = Object.keys(perShape).sort();
  const pairs = [];
  for (let i = 0; i < shapesPresent.length; i += 1)
    for (let j = i + 1; j < shapesPresent.length; j += 1)
      pairs.push(pairwiseAgreement(pool, shapesPresent[i], shapesPresent[j]));
  const fiveOnly = pool.filter((r) => SHAPES.includes(r.cast));
  const fiveHits = fiveOnly.filter((r) => r.read === r.cast).length;
  const worstPair = pairs.reduce((w, p) => (p.rate !== null && (w === null || p.rate < w.rate) ? p : w), null);
  return {
    n: pool.length,
    hits,
    rate: rate(hits, pool.length),
    fiveShapesOnly: { n: fiveOnly.length, hits: fiveHits, rate: rate(fiveHits, fiveOnly.length) },
    perShape,
    pairs,
    worstPair,
    pass:
      pool.length > 0 &&
      hits / pool.length >= BARS.pooledAgreement &&
      pairs.every((p) => p.rate === null || p.rate >= BARS.pairwiseAgreement),
  };
}

export function summarizeEndpoint2(checks) {
  const bySection = {};
  for (const c of checks) {
    const s = (bySection[c.section] ||= { n: 0, joined: 0, textOnly: 0, byKind: {} });
    s.n += 1;
    if (c.joined) s.joined += 1;
    if (c.textOnly) s.textOnly += 1;
    const k = (s.byKind[c.kind] ||= { n: 0, joined: 0, textOnly: 0, loose: 0, quoteLocated: 0, quoteChecked: 0 });
    k.n += 1;
    if (c.joined) k.joined += 1;
    if (c.textOnly) k.textOnly += 1;
    if (c.loose) k.loose += 1;
    if (c.quoteLocated !== null && c.quoteLocated !== undefined) {
      k.quoteChecked += 1;
      if (c.quoteLocated) k.quoteLocated += 1;
    }
  }
  for (const s of Object.values(bySection)) {
    s.rate = rate(s.joined, s.n);
    s.textOnlyRate = rate(s.textOnly, s.n);
    for (const k of Object.values(s.byKind)) {
      k.rate = rate(k.joined, k.n);
      k.textOnlyRate = rate(k.textOnly, k.n);
    }
  }
  const n = checks.length;
  const joined = checks.filter((c) => c.joined).length;
  const textOnly = checks.filter((c) => c.textOnly).length;
  return {
    n,
    joined,
    textOnly,
    rate: rate(joined, n),
    textOnlyRate: rate(textOnly, n),
    bySection,
    pass: n > 0 && joined / n >= BARS.deliveredMoves,
  };
}

// ---------------------------------------------------------------------------
export function runReplay(opts, log = () => {}) {
  const sections = opts.sections;
  fs.mkdirSync(opts.out, { recursive: true });
  const results = [];
  const endpoint2 = [];
  const unread = Object.fromEntries(SCOREBOARD_FIELDS.map((f) => [f, 0]));
  const unreadBySection = {};
  const archiveSummaries = [];
  let rows = 0;

  for (const entry of ARCHIVES) {
    if (sections && !sections.includes(entry.section)) continue;
    const base = path.join(opts.archiveDir, entry.rel);
    if (!exists(base)) {
      archiveSummaries.push({ ...entry, missing: true });
      log(`${entry.section} ${entry.run}: archive missing at ${base}`);
      continue;
    }
    let items = [];
    let skipped = [];
    let conductByCase = null;
    if (entry.kind === 'dialogue-folders') items = walkDialogueFolders(base);
    else if (entry.kind === 'boredom-batches') {
      const walked = walkBoredomBatches(base, opts.scratch, entry.run);
      items = walked.items;
      skipped = walked.skipped;
    } else if (entry.kind === 'qa-matrix') items = walkQaMatrix(base);
    else if (entry.kind === 'report-rows') {
      const walked = walkReportRows(opts.archiveDir, entry);
      items = walked.items;
      skipped = walked.skipped;
    }
    if (entry.conductRel) {
      conductByCase = new Map();
      const lines = fs.readFileSync(path.join(opts.archiveDir, entry.conductRel), 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        const c = JSON.parse(line);
        if (!conductByCase.has(c.case_id)) conductByCase.set(c.case_id, []);
        conductByCase.get(c.case_id).push(c);
      }
    }
    if (opts.limit) items = items.slice(0, opts.limit);
    const outDir = path.join(opts.out, entry.run);
    fs.mkdirSync(outDir, { recursive: true });
    const profiles = {};
    const armCounts = {};
    let emptyTraces = 0;
    for (const [itemIndex, item] of items.entries()) {
      const half = itemIndex % 2 === 0 ? 'dev' : 'held';
      const events = readTutorStubTraceEvents(item.tracePath);
      if (!turnCompleteCount(events)) {
        emptyTraces += 1;
        skipped.push({ id: item.id, reason: 'dialogue stopped before its first turn completed' });
        continue;
      }
      const identity = traceDialogueIdentity(events);
      const world = worldFor(identity.worldId);
      const board = buildScoreboard({ events, world, arm: item.arm, identity });
      board.dialogue.archive = {
        section: entry.section,
        run: entry.run,
        id: item.id,
        trace: path.relative(opts.archiveDir, item.tracePath),
      };
      const cast = castShapeForProfile(identity.profile);
      const read = readShape(board);
      const predicates = Object.fromEntries(SHAPES.map((k) => [k, read.truthy.includes(k)]));
      predicates.cooperative = read.truthy.length === 0;
      const boardName = safeName(item.id);
      fs.writeFileSync(path.join(outDir, `${boardName}.board.json`), JSON.stringify(board, null, 2));
      fs.writeFileSync(path.join(outDir, `${boardName}.board.txt`), renderScoreboardTable(board));
      rows += board.rows.length;
      for (const f of SCOREBOARD_FIELDS) {
        unread[f] += board.unread[f] || 0;
        const u = (unreadBySection[entry.section] ||= Object.fromEntries(SCOREBOARD_FIELDS.map((k) => [k, 0])));
        u[f] += board.unread[f] || 0;
      }
      profiles[identity.profile] = (profiles[identity.profile] || 0) + 1;
      if (item.arm) armCounts[item.arm] = (armCounts[item.arm] || 0) + 1;
      results.push({
        section: entry.section,
        run: entry.run,
        id: item.id,
        board: path.relative(opts.out, path.join(outDir, `${boardName}.board.json`)),
        world: identity.worldId,
        worldLoaded: Boolean(world),
        profile: identity.profile,
        arm: item.arm,
        half,
        turns: board.dialogue.turns,
        cast,
        read: read.shape,
        truthy: read.truthy,
        predicates,
        summary: read.summary,
        unread: board.unread,
      });
      let checks = [];
      if (entry.endpoint2 === 'challenge-family') checks = checkChallengeFamily(board, events);
      else if (entry.endpoint2 === 'delivered-move') checks = checkDeliveredMove(board, events, item.meta.row);
      else if (entry.endpoint2 === 'delivered-move-depth') checks = checkDeliveredMoveDepth(board, item.meta.row);
      else if (entry.endpoint2 === 'conduct-slots')
        checks = checkConductSlots(board, conductByCase?.get(item.id) || []);
      for (const c of checks)
        endpoint2.push({
          section: entry.section,
          run: entry.run,
          id: item.id,
          half,
          board: path.relative(opts.out, path.join(outDir, `${boardName}.board.json`)),
          ...c,
        });
    }
    archiveSummaries.push({
      section: entry.section,
      run: entry.run,
      kind: entry.kind,
      dialogues: items.length - emptyTraces,
      emptyTraces,
      skipped,
      profiles,
      arms: armCounts,
      endpoint2Checks: endpoint2.filter((c) => c.run === entry.run).length,
    });
    log(
      `${entry.section} ${entry.run}: ${items.length - emptyTraces} dialogues (${Object.entries(profiles)
        .map(([k, v]) => `${k}=${v}`)
        .join(
          ', ',
        )}), ${endpoint2.filter((c) => c.run === entry.run).length} endpoint-2 checks, ${skipped.length} skipped`,
    );
  }

  const e1 = summarizeEndpoint1(results);
  const e2 = summarizeEndpoint2(endpoint2);
  const heldOut = {
    endpoint1: summarizeEndpoint1(results.filter((r) => r.half === 'held')),
    endpoint2: summarizeEndpoint2(endpoint2.filter((c) => c.half === 'held')),
  };
  const disagreements = {
    endpoint1: results
      .filter((r) => r.cast && r.read !== r.cast)
      .map((r) => ({
        section: r.section,
        run: r.run,
        id: r.id,
        board: r.board,
        cast: r.cast,
        read: r.read,
        truthy: r.truthy,
        summary: r.summary,
      })),
    endpoint2: endpoint2.filter((c) => !c.joined),
  };
  const quietCards = !sections || sections.includes('6.24') ? quietCardCheck(opts.evalExportsDir, opts.out, log) : null;
  const verdict = e1.pass && e2.pass ? 'PASS' : 'FAIL';
  const summary = {
    schema: 'machinespirits.tutor-stub.scoreboard-replay-summary.v1',
    generatedAt: new Date().toISOString(),
    archiveDir: opts.archiveDir,
    bars: BARS,
    verdict,
    dialogues: results.length,
    rows,
    unread,
    unreadBySection,
    endpoint1: e1,
    endpoint2: e2,
    heldOut,
    archives: archiveSummaries,
    disagreements,
    quietCards,
    results,
  };
  fs.writeFileSync(path.join(opts.out, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(opts.out, 'summary.md'), renderSummaryMarkdown(summary));
  return summary;
}

function pct(x) {
  return x === null || x === undefined ? 'n/a' : `${(x * 100).toFixed(1)}%`;
}

export function renderSummaryMarkdown(s) {
  const lines = [];
  lines.push(
    `# Scoreboard replay summary`,
    '',
    `Verdict: **${s.verdict}** (bars: pooled agreement ${s.bars.pooledAgreement}, pairwise ${s.bars.pairwiseAgreement}, delivered moves ${s.bars.deliveredMoves})`,
    '',
  );
  lines.push(`Dialogues: ${s.dialogues}. Board rows: ${s.rows}. Generated ${s.generatedAt}.`, '');
  lines.push(
    '## Archives',
    '',
    '| section | run | dialogues | profiles | endpoint-2 checks | skipped |',
    '|---|---|---|---|---|---|',
  );
  for (const a of s.archives) {
    if (a.missing) {
      lines.push(`| ${a.section} | ${a.run} | missing | | | |`);
      continue;
    }
    lines.push(
      `| ${a.section} | ${a.run} | ${a.dialogues} | ${Object.entries(a.profiles)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')} | ${a.endpoint2Checks} | ${a.skipped.length} |`,
    );
  }
  lines.push(
    '',
    '## Endpoint 1: shapes separate',
    '',
    `Pooled: ${s.endpoint1.hits}/${s.endpoint1.n} = ${pct(s.endpoint1.rate)} (five shapes only: ${s.endpoint1.fiveShapesOnly.hits}/${s.endpoint1.fiveShapesOnly.n} = ${pct(s.endpoint1.fiveShapesOnly.rate)}). Pass: ${s.endpoint1.pass}.`,
    '',
  );
  if (s.heldOut)
    lines.push(
      `Held-out half (every second dialogue in walk order): ${s.heldOut.endpoint1.hits}/${s.heldOut.endpoint1.n} = ${pct(s.heldOut.endpoint1.rate)}; worst pair ${s.heldOut.endpoint1.worstPair ? `${s.heldOut.endpoint1.worstPair.x}/${s.heldOut.endpoint1.worstPair.y} ${pct(s.heldOut.endpoint1.worstPair.rate)}` : 'n/a'}.`,
      '',
    );
  lines.push('| cast shape | n | hits | rate | read as |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(s.endpoint1.perShape))
    lines.push(
      `| ${k} | ${v.n} | ${v.hits} | ${pct(v.rate)} | ${Object.entries(v.readAs)
        .map(([a, b]) => `${a}=${b}`)
        .join(', ')} |`,
    );
  lines.push('', '| pair | n | hits | rate |', '|---|---|---|---|');
  for (const p of s.endpoint1.pairs) lines.push(`| ${p.x} / ${p.y} | ${p.n} | ${p.hits} | ${pct(p.rate)} |`);
  lines.push(
    '',
    '## Endpoint 2: delivered moves show',
    '',
    `Pooled: ${s.endpoint2.joined}/${s.endpoint2.n} = ${pct(s.endpoint2.rate)} (text-only reading: ${s.endpoint2.textOnly}/${s.endpoint2.n} = ${pct(s.endpoint2.textOnlyRate)}). Pass: ${s.endpoint2.pass}.`,
    '',
  );
  if (s.heldOut)
    lines.push(
      `Held-out half: ${s.heldOut.endpoint2.joined}/${s.heldOut.endpoint2.n} = ${pct(s.heldOut.endpoint2.rate)} joined; text-only ${s.heldOut.endpoint2.textOnly}/${s.heldOut.endpoint2.n} = ${pct(s.heldOut.endpoint2.textOnlyRate)}.`,
      '',
    );
  lines.push('| section | kind | n | joined | text-only | loose | quote located |', '|---|---|---|---|---|---|---|');
  for (const [sec, v] of Object.entries(s.endpoint2.bySection))
    for (const [kind, k] of Object.entries(v.byKind))
      lines.push(
        `| ${sec} | ${kind} | ${k.n} | ${k.joined} (${pct(k.rate)}) | ${k.textOnly} (${pct(k.textOnlyRate)}) | ${k.loose} | ${k.quoteChecked ? `${k.quoteLocated}/${k.quoteChecked}` : 'n/a'} |`,
      );
  lines.push(
    '',
    '## Unread counts per field',
    '',
    '| field | all | ' + Object.keys(s.unreadBySection).join(' | ') + ' |',
    '|---|---|' +
      Object.keys(s.unreadBySection)
        .map(() => '---')
        .join('|') +
      '|',
  );
  for (const f of Object.keys(s.unread))
    lines.push(
      `| ${f} | ${s.unread[f]} | ${Object.values(s.unreadBySection)
        .map((u) => u[f])
        .join(' | ')} |`,
    );
  if (s.quietCards) {
    lines.push(
      '',
      '## 6.24 quiet cards (secondary, no bar)',
      '',
      `${s.quietCards.files} traces, ${s.quietCards.events} forced cards.`,
      '',
      '| forced | n | clean | new release this turn | ledger in force | commitment shown | unread | no row |',
      '|---|---|---|---|---|---|---|---|',
    );
    for (const [k, v] of Object.entries(s.quietCards.perForced))
      lines.push(
        `| ${k} | ${v.n} | ${v.clean} | ${v.releaseShown} | ${v.ledgerInForce} | ${v.commitmentShown} | ${v.unread} | ${v.noRow} |`,
      );
  }
  lines.push(
    '',
    `Endpoint-1 disagreements: ${s.disagreements.endpoint1.length}. Endpoint-2 misses: ${s.disagreements.endpoint2.length}. See summary.json.`,
    '',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  const log = opts.quiet ? () => {} : (m) => console.error(m);
  const summary = runReplay(opts, log);
  console.log(renderSummaryMarkdown(summary));
  console.log(`boards and summary written under ${opts.out}`);
}
