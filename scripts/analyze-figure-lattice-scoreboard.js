#!/usr/bin/env node
/**
 * Figure lattice with board attributes (workplan card:
 * scoreboard-reader-replay-and-crossed-run, Step 1 secondary check).
 *
 * The 7.14 lattice (scripts/analyze-figure-lattice.js) read its frozen 122
 * carded turns and separated 0 of 7 figures in run B. This script re-runs
 * that lattice over the same 122 objects and adds the board fields of each
 * object's turn as attributes. The lattice rules do not change: the objects,
 * the attribute builder and the analysis come from the lattice script as
 * exported, and run B must reproduce its recorded numbers before any board
 * attribute is added.
 *
 * Pure computation. No model calls. Reads exports/crossed-effects/ and
 * exports/tutor-stub-outcome/ through the lattice script; writes one report
 * under exports/scoreboard-replay/lattice/.
 *
 * Usage:
 *   node scripts/analyze-figure-lattice-scoreboard.js [--out <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { analyze, buildContext, buildObjects } from './analyze-figure-lattice.js';
import {
  buildScoreboard,
  loadScoreboardWorld,
  readTutorStubTraceEvents,
  traceDialogueIdentity,
} from '../services/tutorStubScoreboard.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACES = path.join(ROOT, 'exports', 'tutor-stub-outcome');

/** Recorded run B of the frozen lattice: objects, attributes, concepts, separated. */
export const RECORDED_RUN_B = Object.freeze([122, 29, 372, 0]);

/** Map a lattice object id back to its trace directory and turn. */
export function traceLocationOf(objectId) {
  const parts = String(objectId).split(':');
  const turn = Number(parts[parts.length - 1].replace(/^t/, ''));
  if (parts[0] === 'conduct') {
    return { dir: path.join(TRACES, 'crossed-k3', 'traces', parts[1], `${parts[2]}-d${parts[3].slice(1)}`), turn };
  }
  if (parts[0] === 'repertoire') {
    return { dir: path.join(TRACES, 'repertoire-k3', 'traces', parts[1], `${parts[2]}-d${parts[3].slice(1)}`), turn };
  }
  if (parts[0] === 'lostretest') {
    return { dir: path.join(TRACES, 'lostretest-k3', 'traces', parts[1], parts[2]), turn };
  }
  if (parts[0] === 'flatpromo') {
    return { dir: path.join(TRACES, 'flatpromo-k3', 'traces', 'world_033_alder_row_redoubt', parts[1]), turn };
  }
  throw new Error(`unknown lattice object id ${objectId}`);
}

const collapseNode = (v) => (v === 'none' || v === 'unread' || v === 'other' ? v : 'node');
const collapseList = (v) => (Array.isArray(v) ? (v.length ? 'some' : 'none') : v);
const collapseLicence = (v) => (typeof v === 'string' && v.startsWith('granted') ? 'granted' : v);

/**
 * The board attributes of one carded turn: the learner row and the tutor
 * row of that turn, with node ids collapsed to `node` so that a shared
 * intent can form across worlds.
 */
export function boardAttributesAt(board, turn) {
  const tutor = board.rows.find((r) => r.turn === turn && r.speaker === 'tutor');
  const learner = board.rows.find((r) => r.turn === turn && r.speaker === 'learner');
  const out = [];
  if (tutor) {
    const f = tutor.fields;
    out.push(`board:tutor_challenge:${f.challenge}`);
    out.push(`board:tutor_test:${f.test}`);
    out.push(`board:tutor_condition:${collapseNode(f.condition_named)}`);
    out.push(`board:tutor_commitment:${collapseNode(f.commitment_undertaken)}`);
    out.push(`board:dispute:${f.standing_dispute}`);
    out.push(`board:licence:${collapseLicence(f.licence_in_force)}`);
    out.push(`board:release:${collapseList(f.release)}`);
    out.push(`board:debt:${collapseList(f.debt)}`);
    out.push(`board:forced_entry:${collapseNode(f.forced_entry)}`);
  }
  if (learner) {
    const f = learner.fields;
    out.push(`board:learner_challenge:${f.challenge}`);
    out.push(`board:learner_test:${f.test}`);
    out.push(`board:learner_condition:${collapseNode(f.condition_named)}`);
    out.push(`board:learner_commitment:${collapseNode(f.commitment_undertaken)}`);
    out.push(`board:learner_entitlement:${f.entitlement_status}`);
  }
  return { attrs: out, hasTutorRow: Boolean(tutor), hasLearnerRow: Boolean(learner) };
}

/** A copy of a lattice context with extra attributes joined onto each row. */
export function joinAttributes(ctx, extraById, { replace = false } = {}) {
  const attrSet = new Set();
  const rows = ctx.rows.map((r) => {
    const base = replace ? [] : [...r.attrs];
    const extra = extraById.get(r.id) || [];
    const attrs = new Set([...base, ...extra]);
    attrs.forEach((a) => attrSet.add(a));
    return { id: r.id, figure: r.figure, attrs };
  });
  return { rows, attributes: [...attrSet].sort() };
}

function parseArgs(argv) {
  const out = { out: path.join(ROOT, 'exports', 'scoreboard-replay', 'lattice') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out') out.out = path.resolve(argv[++i]);
  }
  return out;
}

export function runLatticeWithBoards(log = () => {}) {
  const { objects, checks } = buildObjects();
  if (checks.mismatches.length) throw new Error(`lattice consistency mismatches: ${checks.mismatches.join('; ')}`);

  const runB = analyze(
    buildContext(objects, { withCard: false, withRuled: false }),
    'B: frozen lattice, no card identity',
  );
  const gotB = [runB.objects, runB.attributes, runB.conceptCount, runB.separatedCount];
  if (String(gotB) !== String(RECORDED_RUN_B)) {
    throw new Error(`run B does not reproduce the recorded result (${gotB} vs ${RECORDED_RUN_B}); stopping`);
  }

  const boards = new Map();
  const worlds = new Map();
  const unread = {};
  const extraById = new Map();
  const realization = {};
  let missingRows = 0;
  for (const o of objects) {
    const { dir, turn } = traceLocationOf(o.id);
    if (!boards.has(dir)) {
      const file = fs.readdirSync(dir).find((f) => f.endsWith('.jsonl'));
      const events = readTutorStubTraceEvents(path.join(dir, file));
      const identity = traceDialogueIdentity(events);
      if (!worlds.has(identity.worldId))
        worlds.set(identity.worldId, loadScoreboardWorld(identity.worldId, { rootDir: ROOT }));
      const board = buildScoreboard({ events, world: worlds.get(identity.worldId), identity });
      for (const [field, n] of Object.entries(board.unread)) unread[field] = (unread[field] || 0) + n;
      boards.set(dir, board);
    }
    const { attrs, hasTutorRow, hasLearnerRow } = boardAttributesAt(boards.get(dir), turn);
    if (!hasTutorRow || !hasLearnerRow) missingRows += 1;
    attrs.forEach((a) => (realization[a] = (realization[a] || 0) + 1));
    extraById.set(o.id, attrs);
  }

  const baseCtx = buildContext(objects, { withCard: false, withRuled: false });
  const runBoard = analyze(joinAttributes(baseCtx, extraById), 'B+board: frozen lattice plus board fields of the turn');
  const runBoardOnly = analyze(joinAttributes(baseCtx, extraById, { replace: true }), 'board only: board fields alone');

  const report = {
    generated: 'analyze-figure-lattice-scoreboard (card scoreboard-reader-replay-and-crossed-run)',
    objects: objects.length,
    boards: boards.size,
    objectsMissingARow: missingRows,
    unreadByField: unread,
    boardAttributeRealization: realization,
    runs: { B: runB, Bboard: runBoard, boardOnly: runBoardOnly },
  };
  log(report);
  return report;
}

function describe(run) {
  const lines = [`=== ${run.label} ===`];
  lines.push(
    `objects ${run.objects}, attributes ${run.attributes}, concepts ${run.conceptCount}, separated ${run.separatedCount}/${Object.keys(run.figures).length}`,
  );
  for (const [f, r] of Object.entries(run.figures)) {
    const conf = Object.entries(r.confusion)
      .map(([g, n]) => `${g}:${n}`)
      .join(' ');
    lines.push(`  ${f} (${r.turns} turns): ${r.separated ? 'SEPARATED' : 'MERGES with ' + conf}`);
    if (r.separated && r.minimalDistinguishers?.sets?.length) {
      lines.push(
        `    minimal distinguishers (size ${r.minimalDistinguishers.size}): ${r.minimalDistinguishers.sets.map((s) => '{' + s.join(', ') + '}').join(' | ')}`,
      );
    }
  }
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = runLatticeWithBoards();
  fs.mkdirSync(args.out, { recursive: true });
  const outPath = path.join(args.out, 'figure-lattice-scoreboard.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 1) + '\n');
  console.log(`objects ${report.objects}, boards ${report.boards}, objects missing a row ${report.objectsMissingARow}`);
  console.log(`unread by field: ${JSON.stringify(report.unreadByField)}`);
  for (const run of Object.values(report.runs)) console.log('\n' + describe(run));
  console.log(`\nwrote ${path.relative(ROOT, outPath)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
