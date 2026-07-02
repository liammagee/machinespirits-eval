#!/usr/bin/env node
/**
 * Phase-3 contrast analysis for the Strategy Ledger pilot
 * (STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md). Reads matrix run artifacts
 * (result.json per arm) and computes the pre-registered endpoints and
 * guardrails, entirely programmatically — no LLM anywhere.
 *
 *   E1 (persistence)         ledger        vs baseline
 *   E2 (register decision)   ledger-palette vs ledger
 *   E3 (learner mirror)      ledger-learner vs ledger
 *
 * Usage:
 *   node scripts/analyze-strategy-ledger-contrasts.js \
 *     --runs exports/dramatic-derivation/matrix/ledger-phase3-bitterwell \
 *     --runs exports/dramatic-derivation/matrix/ledger-phase3-ravensmark \
 *     [--out exports/dramatic-derivation/strategy-ledger]
 *
 * Frozen before the paid matrix ran (pre-registration discipline); any
 * later analytic change is post-hoc and must be labeled as such.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_SCHEMA = 'dramatic-derivation.strategy-ledger-phase3.v0';
const ARMS = ['baseline', 'ledger', 'ledger-palette', 'ledger-learner'];
const CONTRASTS = [
  { id: 'E1', name: 'persistence', treat: 'ledger', control: 'baseline' },
  { id: 'E2', name: 'register-as-decision', treat: 'ledger-palette', control: 'ledger' },
  { id: 'E3', name: 'learner-mirror', treat: 'ledger-learner', control: 'ledger' },
];

function parseArgs(argv) {
  const opts = { runs: [], out: path.join(ROOT, 'exports/dramatic-derivation/strategy-ledger') };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--runs') opts.runs.push(path.resolve(ROOT, argv[++i]));
    else if (argv[i] === '--out') opts.out = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!opts.help && !opts.runs.length) throw new Error('at least one --runs <matrix dir> is required');
  return opts;
}

function armOf(label) {
  const m = label.match(/^(baseline|ledger-palette|ledger-learner|ledger)-r(\d+)$/);
  return m ? { arm: m[1], repeat: Number(m[2]) } : null;
}

// --- per-run endpoint extraction -------------------------------------------

function modeFlapRate(result) {
  const rows = result.didacticMode || [];
  if (rows.length < 2) return rows.length ? 0 : null;
  let flips = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].recommendedMode !== rows[i - 1].recommendedMode) flips += 1;
  }
  return flips / (rows.length - 1);
}

function extractRun(world, label, dir) {
  const resultPath = path.join(dir, 'result.json');
  if (!fs.existsSync(resultPath)) return null;
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const cap = result.trajectory.length ? Math.max(...result.trajectory.map((t) => t.turn)) : 0;
  const turnCap = result.turnsPlayed >= cap ? result.turnsPlayed : cap;
  const events = result.events || [];
  const count = (type) => events.filter((e) => e.type === type).length;
  const sceneOpenings = count('scene_open');
  const rows = result.strategyLedger?.rows || [];
  const tutorSceneRows = rows.filter((r) => r.agent === 'tutor' && r.scope === 'scene');
  const learnerSceneRows = rows.filter((r) => r.agent === 'learner' && r.scope === 'scene');
  const registerClauses = tutorSceneRows
    .filter((r) => r.audit)
    .flatMap((r) => r.audit.clauses.filter((c) => c.clause.startsWith('register ')));
  return {
    world,
    label,
    ...armOf(label),
    verdict: result.verdict,
    grounded: result.verdict === 'grounded_anagnorisis' ? 1 : 0,
    timeToRecognition: result.assertedGroundedTurn ?? result.turnsPlayed + 1,
    turnsPlayed: result.turnsPlayed,
    turnCapSeen: turnCap,
    modeFlapRate: modeFlapRate(result),
    dAuc: result.trajectory.length ? result.trajectory.reduce((s, t) => s + t.D, 0) / result.trajectory.length : null,
    voicedCount: result.inference?.voiced?.length ?? 0,
    overreachCount: result.inference?.overreaches?.length ?? 0,
    hypothesisCount: (result.transcript || []).filter((l) => l.role === 'learner' && l.meta?.hypothesis).length,
    leaks: count('leak'),
    aporiaLike: ['aporia', 'disengagement'].includes(result.verdict) ? 1 : 0,
    releasesOnRecord: result.ledger.length,
    sceneOpenings,
    strategyCommits: count('strategy_commit'),
    strategyAudits: count('strategy_audit'),
    learnerIntents: count('learner_intent'),
    learnerCarries: count('learner_carry'),
    commitCoverage: sceneOpenings ? count('strategy_commit') / sceneOpenings : null,
    intentCoverage: sceneOpenings ? count('learner_intent') / sceneOpenings : null,
    registerSwitches: (result.publicRegisters || []).filter((r) => r.scope === 'scene' && r.register !== 'modern')
      .length,
    registerDriftClauses: registerClauses.filter((c) => c.verdict === 'drift').length,
    blockRows: result.strategyLedger?.blocks?.length ?? null,
    blocksCleared: result.strategyLedger?.blocks?.filter((b) => b.status === 'cleared').length ?? null,
    auditKept: tutorSceneRows
      .filter((r) => r.audit)
      .reduce((s, r) => s + r.audit.clauses.filter((c) => c.verdict === 'kept').length, 0),
    auditDrift: tutorSceneRows
      .filter((r) => r.audit)
      .reduce((s, r) => s + r.audit.clauses.filter((c) => c.verdict === 'drift').length, 0),
    learnerIntentRows: learnerSceneRows.length,
  };
}

// --- small stats -------------------------------------------------------------

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));

function mannWhitneyU(a, b) {
  if (!a.length || !b.length) return null;
  let u = 0;
  for (const x of a) for (const y of b) u += x > y ? 1 : x === y ? 0.5 : 0;
  return { u, uMax: a.length * b.length };
}

function pooledSd(a, b) {
  const all = [...a, ...b];
  return sd(all);
}

function contrastEndpoint(runs, contrast, key, { direction }) {
  const treat = runs
    .filter((r) => r.arm === contrast.treat)
    .map((r) => r[key])
    .filter((v) => v !== null);
  const control = runs
    .filter((r) => r.arm === contrast.control)
    .map((r) => r[key])
    .filter((v) => v !== null);
  const delta = treat.length && control.length ? mean(treat) - mean(control) : null;
  const sdPool = pooledSd(treat, control);
  const perWorldDirections = [];
  for (const world of [...new Set(runs.map((r) => r.world))]) {
    const t = runs
      .filter((r) => r.world === world && r.arm === contrast.treat)
      .map((r) => r[key])
      .filter((v) => v !== null);
    const c = runs
      .filter((r) => r.world === world && r.arm === contrast.control)
      .map((r) => r[key])
      .filter((v) => v !== null);
    if (t.length && c.length) perWorldDirections.push(Math.sign(mean(t) - mean(c)));
  }
  const consistent =
    perWorldDirections.length >= 2 && perWorldDirections.every((d) => d === perWorldDirections[0] && d !== 0);
  const bigEnough = delta !== null && sdPool ? Math.abs(delta) >= 0.5 * sdPool : false;
  // "better" respects the pre-registered direction (lower or higher is better)
  const improves = delta === null ? null : direction === 'lower' ? delta < 0 : delta > 0;
  return {
    endpoint: key,
    direction,
    treatMean: mean(treat),
    controlMean: mean(control),
    treatSd: sd(treat),
    controlSd: sd(control),
    delta,
    pooledSd: sdPool,
    mannWhitney: mannWhitneyU(treat, control),
    perWorldDirections,
    signal: Boolean(consistent && bigEnough),
    improves,
    n: { treat: treat.length, control: control.length },
  };
}

// --- main --------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('see file header for usage');
    return;
  }
  const runs = [];
  for (const matrixDir of opts.runs) {
    const world = path.basename(matrixDir).replace(/^ledger-phase3-/, '');
    for (const entry of fs.readdirSync(matrixDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'logs') continue;
      const parsed = armOf(entry.name);
      if (!parsed) continue;
      const run = extractRun(world, entry.name, path.join(matrixDir, entry.name));
      if (run) runs.push(run);
    }
  }
  if (!runs.length) throw new Error('no runs found under the given --runs directories');

  const worlds = [...new Set(runs.map((r) => r.world))];
  const armCounts = Object.fromEntries(ARMS.map((a) => [a, runs.filter((r) => r.arm === a).length]));

  // guardrails
  const guardrails = [];
  const g = (id, ok, detail) => guardrails.push({ id, ok: Boolean(ok), detail });
  g(
    'leaks',
    runs.every((r) => r.leaks === 0),
    `${runs.filter((r) => r.leaks > 0).length} run(s) with leak events`,
  );
  for (const world of worlds) {
    const base = runs.filter((r) => r.world === world && r.arm === 'baseline');
    const baseAporia = base.reduce((s, r) => s + r.aporiaLike, 0);
    for (const arm of ['ledger', 'ledger-palette', 'ledger-learner']) {
      const armRuns = runs.filter((r) => r.world === world && r.arm === arm);
      const armAporia = armRuns.reduce((s, r) => s + r.aporiaLike, 0);
      g(
        `aporia-${world}-${arm}`,
        armAporia <= baseAporia + 1,
        `${world}/${arm}: aporia-like verdicts ${armAporia} vs baseline ${baseAporia}`,
      );
      const baseRel = mean(base.map((r) => r.releasesOnRecord));
      const armRel = mean(armRuns.map((r) => r.releasesOnRecord));
      g(
        `releases-${world}-${arm}`,
        armRel !== null && baseRel !== null && armRel >= baseRel - 0.5,
        `${world}/${arm}: mean releases ${fmt(armRel)} vs baseline ${fmt(baseRel)}`,
      );
    }
  }
  const ledgerArms = runs.filter((r) => r.arm !== 'baseline');
  const coverage = ledgerArms.map((r) => r.commitCoverage).filter((v) => v !== null);
  g(
    'commit-coverage',
    coverage.length && mean(coverage) >= 0.8,
    `mean commitment coverage ${fmt(mean(coverage))} across ledger arms`,
  );
  const intentCov = runs
    .filter((r) => r.arm === 'ledger-learner')
    .map((r) => r.intentCoverage)
    .filter((v) => v !== null);
  g(
    'intent-coverage',
    intentCov.length && mean(intentCov) >= 0.8,
    `mean learner intent coverage ${fmt(mean(intentCov))} in ledger-learner`,
  );

  // contrasts
  const ENDPOINTS = {
    E1: [
      ['modeFlapRate', 'lower'],
      ['timeToRecognition', 'lower'],
      ['grounded', 'higher'],
    ],
    E2: [
      ['modeFlapRate', 'lower'],
      ['timeToRecognition', 'lower'],
      ['grounded', 'higher'],
    ],
    E3: [
      ['timeToRecognition', 'lower'],
      ['voicedCount', 'higher'],
      ['overreachCount', 'lower'],
      ['hypothesisCount', 'higher'],
    ],
  };
  const contrasts = CONTRASTS.map((c) => ({
    ...c,
    endpoints: ENDPOINTS[c.id].map(([key, direction]) => contrastEndpoint(runs, c, key, { direction })),
  }));

  // descriptives
  const descriptives = {
    registerSwitchesByArm: Object.fromEntries(
      ARMS.map((a) => [a, mean(runs.filter((r) => r.arm === a).map((r) => r.registerSwitches))]),
    ),
    dAucByArm: Object.fromEntries(ARMS.map((a) => [a, mean(runs.filter((r) => r.arm === a).map((r) => r.dAuc))])),
    auditKeptDrift: Object.fromEntries(
      ARMS.filter((a) => a !== 'baseline').map((a) => [
        a,
        {
          kept: runs.filter((r) => r.arm === a).reduce((s, r) => s + r.auditKept, 0),
          drift: runs.filter((r) => r.arm === a).reduce((s, r) => s + r.auditDrift, 0),
        },
      ]),
    ),
    blocks: Object.fromEntries(
      ARMS.filter((a) => a !== 'baseline').map((a) => [
        a,
        {
          rows: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.blockRows || 0), 0),
          cleared: runs.filter((r) => r.arm === a).reduce((s, r) => s + (r.blocksCleared || 0), 0),
        },
      ]),
    ),
  };

  const report = {
    schema: REPORT_SCHEMA,
    preRegistration: 'STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md',
    worlds,
    armCounts,
    runs,
    guardrails,
    contrasts,
    descriptives,
  };

  const lines = [
    '# Strategy Ledger Phase 3 — pre-registered pilot contrasts',
    '',
    `Worlds: ${worlds.join(', ')}. Arm counts: ${ARMS.map((a) => `${a}=${armCounts[a]}`).join(', ')}.`,
    'All endpoints programmatic (no LLM judge). Pilot tier: signals are directional, not significance claims.',
    '',
    '## Guardrails',
    '',
    '| guardrail | ok | detail |',
    '|---|---|---|',
    ...guardrails.map((x) => `| ${x.id} | ${x.ok ? 'PASS' : 'FAIL'} | ${x.detail} |`),
    '',
    '## Contrasts',
    '',
  ];
  for (const c of contrasts) {
    lines.push(`### ${c.id} — ${c.name} (${c.treat} vs ${c.control})`, '');
    lines.push(
      '| endpoint | better | treat mean±sd | control mean±sd | Δ | pooled sd | U/Umax | per-world dir | signal |',
    );
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const e of c.endpoints) {
      lines.push(
        `| ${e.endpoint} | ${e.direction} | ${fmt(e.treatMean)}±${fmt(e.treatSd)} (n=${e.n.treat}) | ${fmt(e.controlMean)}±${fmt(e.controlSd)} (n=${e.n.control}) | ${fmt(e.delta)} | ${fmt(e.pooledSd)} | ${e.mannWhitney ? `${e.mannWhitney.u}/${e.mannWhitney.uMax}` : '—'} | ${e.perWorldDirections.join(',') || '—'} | ${e.signal ? (e.improves ? 'YES (improves)' : 'YES (worsens)') : 'no'} |`,
      );
    }
    lines.push('');
  }
  lines.push(
    '## Descriptives',
    '',
    `Register switches/run by arm: ${JSON.stringify(descriptives.registerSwitchesByArm)}`,
    `D-AUC by arm: ${Object.entries(descriptives.dAucByArm)
      .map(([a, v]) => `${a}=${fmt(v)}`)
      .join(', ')}`,
    `Audit kept/drift: ${JSON.stringify(descriptives.auditKeptDrift)}`,
    `Blocks (rows/cleared): ${JSON.stringify(descriptives.blocks)}`,
    '',
  );
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'phase3-contrasts-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(opts.out, 'phase3-contrasts-report.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  console.log(`\nreport at ${path.relative(ROOT, opts.out)}/phase3-contrasts-report.{json,md}`);
}

main();
