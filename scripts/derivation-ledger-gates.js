#!/usr/bin/env node
/**
 * Strategy-ledger gates (LAYERED-DECISION-LOOPS-PLAN.md acceptance gates).
 * Zero-paid, fully deterministic: mock roles / mock LLM client only.
 *
 *   L0  block mechanics (pure): clearance, supersession, budget failure
 *   L0b engine block wiring (inline scripted roles): open/close/fail rows,
 *       live opportunity counters
 *   L1  commitment wiring (llmRoles + mock client): commits at every scene
 *       opening, palette-bound register applied and held by the harness
 *   L2  audits bind: every sealed scene's commitment carries an audit row
 *       with contract verdicts (the final scene's lapse is expected)
 *   L3  proof-control fingerprint: ledger-on vs ledger-off runs are
 *       byte-identical on {release ledger, trajectory, verdict} — for both
 *       the inline mock cast and the llmRoles mock-client cast
 *   L4  learner mirror: learner scene intents + act carries recorded,
 *       row schema field-identical to the tutor's (the symmetry rule)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkBlockClearance,
  loadWorld,
  makeLlmClient,
  makeLlmDirector,
  makeLlmLearner,
  makeLlmTutor,
  makeMockDirector,
  makeMockLearner,
  makeMockTutor,
  normalizeStrategyLedgerConfig,
  openBlock,
  runDrama,
  updateBlockLedger,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/strategy-ledger');
const REPORT_SCHEMA = 'dramatic-derivation.strategy-ledger-gates.v0';
const WORLD_PATH = path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml');
const SCRIPT_PATH = path.join(ROOT, 'config/drama-derivation/tutor-scripts/nocturne-v001.md');

function usage() {
  return `Usage:
  node scripts/derivation-ledger-gates.js [--out exports/dramatic-derivation/strategy-ledger]

Runs the zero-paid strategy-ledger acceptance gates (blocks, commitments,
audits, proof fingerprint, learner mirror).
`;
}

export function parseArgs(argv = []) {
  const opts = { out: DEFAULT_OUT, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function check(rows, id, ok, detail) {
  rows.push({ id, ok: Boolean(ok), detail });
  return Boolean(ok);
}

// --- L0: pure block mechanics ---------------------------------------------
function gateBlockMechanics(rows) {
  // clearance by reasoning resumption
  let block = openBlock({ index: 1, turn: 3, type: 'confusion' });
  let step = updateBlockLedger(block, {
    turn: 4,
    learnerText: 'Still unclear, I do not get it.',
    exchangeType: 'confusion',
    maxBlockTurns: 3,
  });
  check(rows, 'L0-pending', step.closed === null && step.block.turns === 1, 'confusion persists -> block stays open');
  step = updateBlockLedger(step.block, {
    turn: 5,
    learnerText: 'So that means the child line gives a grandchild, because the rule joins them.',
    exchangeType: 'substantive',
    maxBlockTurns: 3,
  });
  check(
    rows,
    'L0-cleared',
    step.closed?.status === 'cleared',
    `confusion clears on settled reasoning (${step.closed?.closeReason})`,
  );

  // supersession by a different pressing episode
  block = openBlock({ index: 2, turn: 6, type: 'confusion' });
  step = updateBlockLedger(block, {
    turn: 7,
    learnerText: 'But surely that cannot be right.',
    exchangeType: 'resistance',
    maxBlockTurns: 3,
  });
  check(
    rows,
    'L0-superseded',
    step.closed?.status === 'superseded',
    'a resistance episode displaces a confusion block',
  );

  // budget failure
  block = openBlock({ index: 3, turn: 8, type: 'resistance' });
  for (const turn of [9, 10]) {
    step = updateBlockLedger(block, {
      turn,
      learnerText: 'Surely that cannot follow.',
      exchangeType: 'resistance',
      maxBlockTurns: 3,
    });
    block = step.block;
  }
  step = updateBlockLedger(block, {
    turn: 11,
    learnerText: 'It surely cannot be so.',
    exchangeType: 'resistance',
    maxBlockTurns: 3,
  });
  check(
    rows,
    'L0-failed',
    step.closed?.status === 'failed',
    `budget exhaustion fails the block (${step.closed?.closeReason})`,
  );

  // mode-specific clearance: teach_back needs own words + reasoning
  const pending = checkBlockClearance({
    mode: 'teach_back',
    learnerText: 'Yes, I see.',
    exchangeType: 'phatic_ack',
  });
  const cleared = checkBlockClearance({
    mode: 'teach_back',
    learnerText: 'I would say the mark and the line together settle it, because the rule joins them.',
    exchangeType: 'substantive',
  });
  check(rows, 'L0-teachback', !pending.cleared && cleared.cleared, 'teach_back clears only on an own-words account');
}

// --- L0b: engine block wiring with a scripted learner ----------------------
async function gateEngineBlocks(rows, world) {
  const lines = {
    1: 'I do not get it, that is unclear to me.',
    2: 'Still unclear, I do not get it.',
    3: 'So that means the child line gives a grandchild, because the rule joins them.',
    4: 'But surely that cannot be right.',
    5: 'Surely that still cannot follow.',
    6: 'It surely cannot be so.',
    7: 'Surely not.',
    8: 'Surely it cannot stand.',
  };
  const roles = {
    director: async () => ({ direction: '[The question holds the stage.]', release: null }),
    tutor: async () => ({
      dialogue: 'Hold what you have against the rules.',
      move: { figure: 'erotema', targetPremise: null, intent: 'orient' },
    }),
    learner: async (view) => ({
      dialogue: lines[view.turn] || 'I am listening.',
      adopt: [],
      hypothesis: null,
      asserts: null,
    }),
  };
  const result = await runDrama({
    world,
    roles,
    options: {
      sceneMode: true,
      strategyLedger: normalizeStrategyLedgerConfig(true),
      maxTurns: 8,
      stopOnStall: false,
    },
  });
  const blocks = result.strategyLedger?.blocks || [];
  const statuses = blocks.map((b) => `${b.type}:${b.status}`);
  check(rows, 'L0b-rows', blocks.length >= 2, `engine sealed ${blocks.length} block(s): ${statuses.join(', ')}`);
  check(
    rows,
    'L0b-cleared',
    blocks.some((b) => b.status === 'cleared'),
    'a block cleared through the live exit-condition check',
  );
  check(
    rows,
    'L0b-terminal',
    blocks.some((b) => b.status === 'failed' || b.status === 'run_end'),
    'an uncleared episode reached its budget or the run end',
  );
  const events = result.events.filter((e) => e.type === 'block_open' || e.type === 'block_close');
  check(rows, 'L0b-events', events.length >= 3, `${events.length} block events on the record`);
  // Counters reset on scene exit (the documented on_scene_exit policy), so
  // the FINAL count reflects only the last open scene — alive and >= 1 is
  // the wiring assertion, not a run total.
  const budget = result.strategyLedger?.budgetFinal;
  check(
    rows,
    'L0b-counters',
    budget && Number.isInteger(budget.currentProofNeutralTutorTurns) && budget.currentProofNeutralTutorTurns >= 1,
    `opportunity counters ran live with scene-exit resets (tutor proof-neutral count ${budget?.currentProofNeutralTutorTurns})`,
  );
}

// --- L1/L2/L3b/L4: llmRoles mock-client runs -------------------------------
function llmCast(world, script, client, { strategyLedger = false, learnerLedger = false, actsMode = false } = {}) {
  return {
    director: makeLlmDirector(world, client, { actsMode }),
    tutor: makeLlmTutor(world, client, {
      script,
      didacticMode: true,
      strategyLedger,
      publicRegister: 'modern',
      ...(actsMode ? { actsMode, decayVisibility: 'conduct' } : {}),
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: world.learnerVoice || 'plain, careful, first person',
      client,
      publicRegister: 'modern',
      learnerLedger,
    }),
  };
}

async function gateCommitments(rows, world, script) {
  const client = makeLlmClient({ mode: 'mock' });
  const result = await runDrama({
    world,
    roles: llmCast(world, script, client, { strategyLedger: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const sceneOpenings = result.events.filter((e) => e.type === 'scene_open').length;
  const commits = result.events.filter((e) => e.type === 'strategy_commit').length;
  const tutorRows = (result.strategyLedger?.rows || []).filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  check(
    rows,
    'L1-commits',
    commits === sceneOpenings && commits > 1,
    `${commits}/${sceneOpenings} scene openings committed`,
  );
  check(
    rows,
    'L1-palette',
    tutorRows.every((r) => !r.commitment.register || ['modern', 'period'].includes(r.commitment.register)),
    'every committed register stays inside the offered palette',
  );
  const switched = (result.publicRegisters || []).filter((r) => r.scope === 'scene');
  check(
    rows,
    'L1-register-applied',
    switched.length > 0,
    `${switched.length} scene register switch(es) applied by the engine`,
  );
  // the harness holds the committed register: every learner line inside a
  // committed scene span (after the commit turn) carries it
  const held = switched.every((row) => {
    const revert = (result.publicRegisters || []).find((r) => r.scope === 'scene_end' && r.scene === row.scene);
    const endTurn = revert ? revert.turn : result.turnsPlayed;
    return result.transcript
      .filter((l) => l.role === 'learner' && l.turn > row.turn && l.turn <= endTurn)
      .every((l) => l.meta.publicRegister === row.register);
  });
  check(rows, 'L1-register-held', held, 'committed register held for the scene and reverted at its close');

  const audits = result.events.filter((e) => e.type === 'strategy_audit').length;
  const audited = tutorRows.filter((r) => r.audit);
  check(
    rows,
    'L2-audits',
    audits >= Math.max(0, commits - 1) && audited.length >= Math.max(0, commits - 1),
    `${audited.length}/${tutorRows.length} commitments audited (final scene's lapse expected)`,
  );
  const verdictOk = audited.every((r) =>
    r.audit.clauses.every((c) => ['kept', 'drift', 'unscored'].includes(c.verdict)),
  );
  check(rows, 'L2-verdicts', audited.length === 0 || verdictOk, 'audit verdicts stay inside the contract');
  return result;
}

const fingerprint = (result) =>
  JSON.stringify({ ledger: result.ledger, trajectory: result.trajectory, verdict: result.verdict });

async function gateFingerprint(rows, world, script) {
  // inline mock cast (no prompts at all)
  const mockCast = () => ({
    director: makeMockDirector(world),
    tutor: makeMockTutor(world),
    learner: makeMockLearner({}),
  });
  const base = await runDrama({ world, roles: mockCast(), options: { sceneMode: true, maxTurns: 10 } });
  const withLedger = await runDrama({
    world,
    roles: mockCast(),
    options: {
      sceneMode: true,
      maxTurns: 10,
      strategyLedger: normalizeStrategyLedgerConfig(true),
      learnerLedger: true,
    },
  });
  check(
    rows,
    'L3-mock-cast',
    fingerprint(base) === fingerprint(withLedger),
    'inline cast: ledger on/off proof fingerprints byte-identical',
  );

  // llmRoles mock-client cast (prompts differ; proof conduct must not)
  const clientA = makeLlmClient({ mode: 'mock' });
  const clientB = makeLlmClient({ mode: 'mock' });
  const off = await runDrama({
    world,
    roles: llmCast(world, script, clientA, {}),
    options: { sceneMode: true, publicRegister: 'modern', maxTurns: 10, stopOnStall: false },
  });
  const on = await runDrama({
    world,
    roles: llmCast(world, script, clientB, { strategyLedger: true, learnerLedger: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      maxTurns: 10,
      stopOnStall: false,
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      learnerLedger: true,
    },
  });
  check(
    rows,
    'L3-llm-cast',
    fingerprint(off) === fingerprint(on),
    'llmRoles cast: ledger on/off proof fingerprints byte-identical',
  );
}

async function gateLearnerMirror(rows, world, script) {
  const client = makeLlmClient({ mode: 'mock' });
  const result = await runDrama({
    world,
    roles: llmCast(world, script, client, { strategyLedger: true, learnerLedger: true, actsMode: true }),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ registerPalette: ['modern', 'period'] }),
      learnerLedger: true,
      acts: { minActTurns: 2, maxActTurns: 4 },
      maxTurns: 12,
      stopOnStall: false,
    },
  });
  const all = result.strategyLedger?.rows || [];
  const learnerScene = all.filter((r) => r.agent === 'learner' && r.scope === 'scene');
  const learnerAct = all.filter((r) => r.agent === 'learner' && r.scope === 'act');
  const tutorScene = all.filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  const sceneOpenings = result.events.filter((e) => e.type === 'scene_open').length;
  check(
    rows,
    'L4-intents',
    learnerScene.length === sceneOpenings && learnerScene.length > 1,
    `${learnerScene.length}/${sceneOpenings} scene openings carry a learner intent`,
  );
  check(rows, 'L4-carries', learnerAct.length >= 1, `${learnerAct.length} act carry-forward row(s) recorded`);
  const keysOf = (row) => JSON.stringify(Object.keys(row).sort());
  check(
    rows,
    'L4-symmetry',
    tutorScene.length > 0 && learnerScene.length > 0 && keysOf(tutorScene[0]) === keysOf(learnerScene[0]),
    'tutor and learner ledger rows share the identical field set',
  );
  // Learner intent audits are ACT-BOUNDED by design: a scene sealed before
  // the current act's start stays out of the learner's view (like everything
  // else across the boundary), so its intent goes unaudited — the lapse is
  // the boundary discipline, not a wiring failure. At least one same-act
  // boundary must audit.
  const auditedIntents = learnerScene.filter((r) => r.audit);
  check(
    rows,
    'L4-intent-audits',
    auditedIntents.length >= 1,
    `${auditedIntents.length}/${learnerScene.length} learner intents audited (act-bounded + final-scene lapses expected)`,
  );
}

// --- L7: plan mode (dialogic stock-take; course-changing, not course-holding) ---
export async function gatePlanMode(rows, world, script) {
  const mkCast = (planOn) => {
    const c = makeLlmClient({ mode: 'mock' });
    return {
      director: makeLlmDirector(world, c, {}),
      tutor: makeLlmTutor(world, c, {
        script,
        didacticMode: true,
        ...(planOn ? { strategyLedger: true, strategyLedgerPlanMode: true } : {}),
        publicRegister: 'modern',
      }),
      learner: makeLlmLearner({
        setting: world.setting,
        voice: 'plain, careful, first person',
        client: c,
        publicRegister: 'modern',
      }),
    };
  };
  const result = await runDrama({
    world,
    roles: mkCast(true),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ planMode: true }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const openings = result.events.filter((e) => e.type === 'scene_open').length;
  const stocktakes = result.strategyLedger?.stocktakes || [];
  check(
    rows,
    'L7-stocktakes',
    stocktakes.length >= 1 && stocktakes.length <= openings,
    `${stocktakes.length} stock-take(s) across ${openings} scene openings`,
  );
  check(
    rows,
    'L7-no-commitments',
    !result.events.some((e) => e.type === 'strategy_commit' || e.type === 'strategy_audit'),
    'commitment machinery fully suppressed under plan mode',
  );
  const corrections = stocktakes.filter((st) => st.correction);
  check(
    rows,
    'L7-reorientation',
    corrections.every((st) => st.reorientation && st.orientationAfter),
    `${corrections.length} correction(s) demanded; every one answered with a reorientation`,
  );
  const off = await runDrama({
    world,
    roles: mkCast(false),
    options: { sceneMode: true, publicRegister: 'modern', maxTurns: 10, stopOnStall: false },
  });
  check(
    rows,
    'L7-fingerprint',
    fingerprint(off) === fingerprint(result),
    'plan mode on/off proof fingerprints byte-identical',
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  const world = loadWorld(WORLD_PATH);
  const script = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const rows = [];
  gateBlockMechanics(rows);
  await gateEngineBlocks(rows, world);
  await gateCommitments(rows, world, script);
  await gateFingerprint(rows, world, script);
  await gateLearnerMirror(rows, world, script);
  await gateTriallingV2(rows, world, script);
  await gatePlanMode(rows, world, script);

  const passed = rows.filter((r) => r.ok).length;
  const ok = passed === rows.length;
  const report = {
    schema: REPORT_SCHEMA,
    world: path.relative(ROOT, WORLD_PATH),
    checks: rows,
    passed,
    total: rows.length,
    ok,
  };
  const md = [
    '# Strategy-ledger gates (zero-paid)',
    '',
    `World: \`${report.world}\` — mock roles / mock LLM client only.`,
    '',
    '| gate | ok | detail |',
    '|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail} |`),
    '',
    `**${passed}/${rows.length} checks passed.**`,
    '',
    'Scope: wiring gates only — no empirical claim. Proof control and the',
    'release calendar are asserted untouched (L3); everything else is conduct.',
    '',
  ].join('\n');
  atomicWrite(path.join(opts.out, 'ledger-gates-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'ledger-gates-report.md'), md);
  for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.detail}`);
  console.log(`\n${passed}/${rows.length} checks passed — report at ${path.relative(ROOT, opts.out)}/`);
  if (!ok) process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}

// --- L5: v2 mechanism trialling (stance two-gate, history, review, intent) ---
export async function gateTriallingV2(rows, world, script) {
  const client = makeLlmClient({ mode: 'mock' });
  const cast = {
    director: makeLlmDirector(world, client, {}),
    tutor: makeLlmTutor(world, client, {
      script,
      didacticMode: true,
      strategyLedger: true,
      strategyLedgerV2: true,
      publicRegister: 'modern',
    }),
    learner: makeLlmLearner({
      setting: world.setting,
      voice: 'plain, careful, first person',
      client,
      publicRegister: 'modern',
    }),
  };
  const result = await runDrama({
    world,
    roles: cast,
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({
        trialling: true,
        stancePalette: ['charismatic_challenge', 'ironic_challenge'],
      }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const history = result.strategyLedger?.history || [];
  const openings = result.events.filter((e) => e.type === 'scene_open').length;
  check(rows, 'L5-history', history.length >= openings - 1, `${history.length} history entries for ${openings} scenes`);
  const stanceCommits = result.events.filter((e) => e.type === 'strategy_commit' && e.detail.includes('stance')).length;
  check(
    rows,
    'L5-stance-committed',
    stanceCommits === openings,
    `${stanceCommits}/${openings} commitments carry a stance`,
  );
  const fidelityLabels = history.map((h) => h.fidelity?.label).filter(Boolean);
  const validLabels = [
    'faithful',
    'weak_or_warm_in_costume',
    'not_instantiated',
    'invalid_person_attack',
    'not_applicable',
  ];
  check(
    rows,
    'L5-fidelity-gate',
    fidelityLabels.length === history.length && fidelityLabels.every((l) => validLabels.includes(l)),
    `fidelity labels: ${[...new Set(fidelityLabels)].join(', ') || 'none'} (mock lines carry no cues — non-faithful expected)`,
  );
  const reviews = result.events.filter((e) => e.type === 'strategy_review').length;
  const reviewed = history.filter((h) => h.review).length;
  check(
    rows,
    'L5-review-loop',
    reviews >= 1 && reviewed >= 1,
    `${reviews} review event(s); ${reviewed} history entr(ies) answered`,
  );
  const stanceClauses = (result.strategyLedger?.rows || [])
    .filter((r) => r.agent === 'tutor' && r.audit)
    .flatMap((r) => r.audit.clauses.filter((c) => c.clause.startsWith('stance ')));
  check(
    rows,
    'L5-stance-audited',
    stanceClauses.length >= 1 && stanceClauses.every((c) => ['kept', 'drift', 'unscored'].includes(c.verdict)),
    `${stanceClauses.length} stance clause(s) adjudicated`,
  );

  // release intent under authority: intents recorded + audited, guards
  // untouched (fingerprint vs the same authority cast without the ledger).
  const mkAuthorityCast = (ledgerOn) => {
    const c = makeLlmClient({ mode: 'mock' });
    return {
      director: makeLlmDirector(world, c, {}),
      tutor: makeLlmTutor(world, c, {
        script,
        didacticMode: true,
        releaseAuthority: true,
        ...(ledgerOn ? { strategyLedger: true, strategyLedgerV2: true } : {}),
        publicRegister: 'modern',
      }),
      learner: makeLlmLearner({
        setting: world.setting,
        voice: 'plain, careful, first person',
        client: c,
        publicRegister: 'modern',
      }),
    };
  };
  const intentRun = await runDrama({
    world,
    roles: mkAuthorityCast(true),
    options: {
      sceneMode: true,
      publicRegister: 'modern',
      strategyLedger: normalizeStrategyLedgerConfig({ trialling: true, releaseIntent: true }),
      maxTurns: 10,
      stopOnStall: false,
    },
  });
  const intentRows = (intentRun.strategyLedger?.rows || []).filter(
    (r) => r.agent === 'tutor' && r.commitment.releaseIntent,
  );
  check(
    rows,
    'L5-intent-recorded',
    intentRows.length >= 1,
    `${intentRows.length} commitment(s) carry a release intent`,
  );
  const intentClauses = (intentRun.strategyLedger?.rows || [])
    .filter((r) => r.agent === 'tutor' && r.audit)
    .flatMap((r) => r.audit.clauses.filter((c) => c.clause === 'release intent'));
  check(
    rows,
    'L5-intent-audited',
    intentClauses.length >= 1,
    `${intentClauses.length} release-intent clause(s) adjudicated`,
  );
  const plainAuthority = await runDrama({
    world,
    roles: mkAuthorityCast(false),
    options: { sceneMode: true, publicRegister: 'modern', maxTurns: 10, stopOnStall: false },
  });
  check(
    rows,
    'L5-guards-untouched',
    fingerprint(plainAuthority) === fingerprint(intentRun),
    'release-authority cast: intent on/off proof fingerprints byte-identical',
  );
}
