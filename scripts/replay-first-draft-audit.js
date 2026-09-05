/**
 * Zero-call replay of the live first-draft clue check on recorded hold traces.
 *
 * Reads the JSONL traces of the world-037 hold runs, finds every first draft
 * and plain recovery draft that the live source-action alignment audit
 * rejected on the clue turns (2 to 5 by default), and runs the current
 * matcher again on the same draft text and the same host-rendered SOURCE
 * text. It makes no model call. It prints counts per turn and per run and
 * writes a JSON summary.
 *
 * Usage:
 *   node scripts/replay-first-draft-audit.js [--exports-root <dir>] [--traces <fileOrDir>...]
 *                                            [--turns 2-5] [--out <summary.json>]
 *
 * Defaults: traces are every *.jsonl under <exports-root>/step7*-hold-* ;
 * exports-root is exports/tutor-stub-outcome under the current directory;
 * the summary goes to exports/first-draft-audit-replay/<date>/summary.json.
 *
 * A draft can be replayed only when the trace holds the draft text, the
 * turn's first-draft contract, and the sha256 of the audited text agrees with
 * the draft text. Every other draft is counted under `cannotReplay` with a
 * reason.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { auditTutorStubLiveSourceActionAlignmentV1 } from '../services/tutorStubLiveFirstDraftAudit.js';

const CLUE_CHECK = { guard: 'live_source_action_alignment_v1', type: 'due_source_exact_occurrence_count' };
const REPLAYED_KINDS = new Set(['original_candidate', 'plain_recovery_candidate']);

function parseArgs(argv) {
  const args = { exportsRoot: path.resolve('exports/tutor-stub-outcome'), traces: [], turns: [2, 3, 4, 5], out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--exports-root') args.exportsRoot = path.resolve(argv[(index += 1)]);
    else if (arg === '--out') args.out = path.resolve(argv[(index += 1)]);
    else if (arg === '--turns') {
      const [low, high] = argv[(index += 1)].split('-').map(Number);
      args.turns = [];
      for (let turn = low; turn <= (Number.isFinite(high) ? high : low); turn += 1) args.turns.push(turn);
    } else if (arg === '--traces') {
      while (index + 1 < argv.length && !argv[index + 1].startsWith('--'))
        args.traces.push(path.resolve(argv[(index += 1)]));
    } else if (arg === '--help' || arg === '-h') {
      console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function findTraces(roots) {
  const out = [];
  const stack = [...roots];
  while (stack.length) {
    const entry = stack.pop();
    let stat;
    try {
      stat = fs.statSync(entry);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      if (entry.endsWith('.jsonl') && !entry.includes('summary')) out.push(entry);
      continue;
    }
    for (const child of fs.readdirSync(entry)) stack.push(path.join(entry, child));
  }
  return out.sort();
}

function defaultTraceRoots(exportsRoot) {
  if (!fs.existsSync(exportsRoot)) return [];
  return fs
    .readdirSync(exportsRoot)
    .filter((name) => /^step7[a-z]?-hold-/u.test(name))
    .map((name) => path.join(exportsRoot, name));
}

function readEvents(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runLabel(tracePath, exportsRoot) {
  const relative = path.relative(exportsRoot, tracePath);
  const parts = relative.split(path.sep);
  // step7-hold-live/traces/world-037/with-d0/<stamp>.jsonl -> step7-hold-live/with-d0
  if (parts.length >= 5 && parts[1] === 'traces') return `${parts[0]}/${parts[parts.length - 2]}`;
  return relative.replace(/\.jsonl$/u, '');
}

function sha256OfAuditedText(text) {
  return createHash('sha256')
    .update(
      String(text || '')
        .replace(/\s+/gu, ' ')
        .trim(),
    )
    .digest('hex');
}

function issueKey(issue) {
  return `${issue?.guard || ''}:${issue?.type || ''}`;
}

/** Why a draft still fails: the clue is missing, present twice, or present once with only letter case changed. */
function nearMissClass(draftText, expectedText, observedCount) {
  if (observedCount > 1) return 'clue_more_than_once';
  const lowerDraft = String(draftText).toLowerCase();
  const lowerExpected = String(expectedText).toLowerCase();
  let count = 0;
  let from = 0;
  while (lowerExpected && (from = lowerDraft.indexOf(lowerExpected, from)) !== -1) {
    count += 1;
    from += lowerExpected.length;
  }
  return count === 1 ? 'letter_case_only' : 'reworded_or_missing';
}

function replayAttempt({ attempt, contract }) {
  const draftText = attempt?.candidate?.text;
  const recordedHard = (attempt?.audits?.deliveryDecision?.hardIssues || []).map(issueKey);
  const rejectedByClueCheck = recordedHard.includes(issueKey(CLUE_CHECK));
  const row = {
    kind: attempt.kind,
    attempt: attempt.attempt ?? null,
    model: attempt.model || null,
    recordedHardIssues: recordedHard,
    rejectedByClueCheck,
  };
  if (!rejectedByClueCheck) return { ...row, replay: null };
  if (typeof draftText !== 'string' || !draftText) return { ...row, replay: null, cannotReplay: 'missing_draft_text' };
  if (!contract) return { ...row, replay: null, cannotReplay: 'missing_first_draft_contract' };
  const recordedSha = attempt?.audits?.auditedText?.sha256 || null;
  if (recordedSha && recordedSha !== sha256OfAuditedText(draftText)) {
    return { ...row, replay: null, cannotReplay: 'audited_text_digest_mismatch' };
  }
  const audit = auditTutorStubLiveSourceActionAlignmentV1({ text: draftText, firstDraftContract: contract });
  const occurrence = audit.source_occurrences[0] || null;
  const clueCheckPasses = !audit.issues.some((issue) => issue.type === CLUE_CHECK.type);
  const otherRecordedHard = recordedHard.filter((key) => key !== issueKey(CLUE_CHECK));
  return {
    ...row,
    replay: {
      clueCheckPasses,
      alignmentAuditOk: audit.ok,
      match: occurrence?.match || null,
      observedCount: occurrence?.observed_count ?? null,
      otherAlignmentIssues: audit.issues.filter((issue) => issue.type !== CLUE_CHECK.type).map((issue) => issue.type),
      otherRecordedHardIssues: otherRecordedHard,
      wouldNowDeliver: clueCheckPasses && audit.ok && otherRecordedHard.length === 0,
      nearMiss: clueCheckPasses
        ? null
        : nearMissClass(draftText, occurrence?.expected_text || '', occurrence?.observed_count ?? 0),
    },
  };
}

function replayTrace(tracePath, { exportsRoot, turns }) {
  const events = readEvents(tracePath);
  const runStart = events.find((event) => event.type === 'run_start') || {};
  const run = {
    label: runLabel(tracePath, exportsRoot),
    trace: tracePath,
    runId: runStart.runId || null,
    world: runStart.metadata?.scenarioPicker?.selectedScenarioId || null,
    profile: runStart.metadata?.experiment?.profile || null,
    turns: [],
  };
  for (const turn of turns) {
    const contractEvent = events.find(
      (event) => event.type === 'tutor_first_draft_contract' && Number(event.turn) === turn,
    );
    const accountingEvent = events.find(
      (event) => event.type === 'tutor_response_guard_accounting' && Number(event.turn) === turn,
    );
    const contract = contractEvent?.contract || null;
    const attempts = accountingEvent?.accounting?.attempts || [];
    const turnRow = {
      turn,
      hostSourceText: contract?.evidence?.sources?.map((source) => source.text) || [],
      outcome: accountingEvent?.accounting?.outcome || null,
      finalDeliverySource: accountingEvent?.accounting?.finalDelivery?.source || null,
      cannotReplay: accountingEvent ? null : 'missing_guard_accounting',
      attempts: [],
      fallbackAttempts: attempts.filter((attempt) => !REPLAYED_KINDS.has(attempt.kind)).length,
    };
    for (const attempt of attempts) {
      if (!REPLAYED_KINDS.has(attempt.kind)) continue;
      const replayed = replayAttempt({ attempt, contract });
      if (replayed.rejectedByClueCheck && replayed.replay) replayed.draftText = attempt.candidate.text;
      turnRow.attempts.push(replayed);
    }
    run.turns.push(turnRow);
  }
  return run;
}

function emptyTally() {
  return {
    attempts: 0,
    passedAsRecorded: 0,
    rejectedByOtherChecksOnly: 0,
    rejectedByClueCheck: 0,
    replayed: 0,
    nowPassClueCheck: 0,
    wouldNowDeliver: 0,
    stillFail: 0,
    cannotReplay: 0,
    byMatch: {},
    byNearMiss: {},
    otherRecordedHardIssues: {},
    otherChecksOnly: {},
    cannotReplayReasons: {},
  };
}

function bump(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function addToTally(tally, row) {
  tally.attempts += 1;
  if (!row.rejectedByClueCheck) {
    if (row.recordedHardIssues.length) {
      tally.rejectedByOtherChecksOnly += 1;
      for (const key of row.recordedHardIssues) bump(tally.otherChecksOnly, key);
    } else tally.passedAsRecorded += 1;
    return;
  }
  tally.rejectedByClueCheck += 1;
  if (row.cannotReplay) {
    tally.cannotReplay += 1;
    bump(tally.cannotReplayReasons, row.cannotReplay);
    return;
  }
  tally.replayed += 1;
  if (row.replay.clueCheckPasses) {
    tally.nowPassClueCheck += 1;
    bump(tally.byMatch, row.replay.match);
    if (row.replay.wouldNowDeliver) tally.wouldNowDeliver += 1;
  } else {
    tally.stillFail += 1;
    bump(tally.byNearMiss, row.replay.nearMiss);
  }
  for (const key of row.replay.otherRecordedHardIssues) bump(tally.otherRecordedHardIssues, key);
}

export function replayFirstDraftAudit({ traces, exportsRoot, turns }) {
  const runs = traces.map((tracePath) => replayTrace(tracePath, { exportsRoot, turns }));
  const perTurn = {};
  const perRun = {};
  const total = emptyTally();
  const missingTurns = [];
  for (const run of runs) {
    perRun[run.label] = emptyTally();
    for (const turnRow of run.turns) {
      if (turnRow.cannotReplay) missingTurns.push({ run: run.label, turn: turnRow.turn, reason: turnRow.cannotReplay });
      for (const row of turnRow.attempts) {
        const key = `t${turnRow.turn}:${row.kind === 'original_candidate' ? 'original' : 'recovery'}`;
        perTurn[key] = perTurn[key] || emptyTally();
        addToTally(perTurn[key], row);
        addToTally(perRun[run.label], row);
        addToTally(total, row);
      }
    }
  }
  return {
    schema: 'machinespirits.tutor-stub.first-draft-audit-replay.v1',
    generatedAt: new Date().toISOString(),
    modelCalls: 0,
    turns,
    replayedKinds: [...REPLAYED_KINDS],
    clueCheck: CLUE_CHECK,
    traceCount: traces.length,
    total,
    perTurn,
    perRun,
    missingTurns,
    runs,
  };
}

function printTally(name, tally) {
  const match = Object.entries(tally.byMatch)
    .map(([key, count]) => `${key}=${count}`)
    .join(' ');
  const near = Object.entries(tally.byNearMiss)
    .map(([key, count]) => `${key}=${count}`)
    .join(' ');
  const other = Object.entries(tally.otherRecordedHardIssues)
    .map(([key, count]) => `${key}=${count}`)
    .join(' ');
  const otherOnly = Object.entries(tally.otherChecksOnly)
    .map(([key, count]) => `${key}=${count}`)
    .join(' ');
  console.log(
    `${name.padEnd(36)} drafts=${tally.attempts} ok=${tally.passedAsRecorded} otherOnly=${tally.rejectedByOtherChecksOnly} clueRejected=${tally.rejectedByClueCheck} replayed=${tally.replayed} nowPass=${tally.nowPassClueCheck} wouldDeliver=${tally.wouldNowDeliver} stillFail=${tally.stillFail} cannotReplay=${tally.cannotReplay}` +
      (match ? ` | match: ${match}` : '') +
      (near ? ` | still: ${near}` : '') +
      (other ? ` | also hard: ${other}` : '') +
      (otherOnly ? ` | otherOnly: ${otherOnly}` : ''),
  );
}

function localDate() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const traces = findTraces(args.traces.length ? args.traces : defaultTraceRoots(args.exportsRoot));
  if (!traces.length) {
    console.log(`no traces found under ${args.exportsRoot} (pass --exports-root or --traces)`);
    return;
  }
  const summary = replayFirstDraftAudit({ traces, exportsRoot: args.exportsRoot, turns: args.turns });
  console.log(`traces: ${traces.length}; turns: ${args.turns.join(',')}; model calls: 0`);
  console.log('per turn (original = first draft, recovery = plain recovery draft):');
  for (const key of Object.keys(summary.perTurn).sort()) printTally(`  ${key}`, summary.perTurn[key]);
  console.log('per run:');
  for (const key of Object.keys(summary.perRun).sort()) printTally(`  ${key}`, summary.perRun[key]);
  printTally('total', summary.total);
  if (summary.missingTurns.length) {
    console.log(`turns that could not be replayed: ${summary.missingTurns.length}`);
    for (const row of summary.missingTurns) console.log(`  ${row.run} t${row.turn}: ${row.reason}`);
  } else console.log('turns that could not be replayed: 0');
  const out = args.out || path.resolve('exports/first-draft-audit-replay', localDate(), 'summary.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`summary written: ${out}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) main();
