#!/usr/bin/env node
/**
 * P1a guard-compiler slice: compile static WorldIR + GuardSpec artifacts and
 * replay archived arms against the existing detector/safety readers.
 *
 * This is intentionally not a live runtime compiler and makes no model calls.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { classifyBoundaryFailure } from '../services/dramaticDerivation/boundaryClassifier.js';
import { buildWorldIR, compileGuardSpec, summarizeGuardSpec } from '../services/dramaticDerivation/guardCompiler.js';
import { releaseSolvency } from '../services/dramaticDerivation/pacing.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_WORLDS = [
  'config/drama-derivation/world-002-lantern.yaml',
  'config/drama-derivation/world-005-marrick.yaml',
];

const DEFAULT_ARMS_BY_WORLD = {
  world_002_lantern: [
    ...Array.from({ length: 10 }, (_, i) => `lantern-e2-real-r${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `lantern-e2-guard-r${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `lantern-e2-visible-r${i + 1}`),
  ],
  world_005_marrick: [
    ...Array.from({ length: 5 }, (_, i) => `marrick-real-r${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `marrick-guard-r${i + 1}`),
    ...Array.from({ length: 5 }, (_, i) => `marrick-visible-r${i + 1}`),
  ],
};

const FAILURE_MODE_ORDER = ['grounded', 'early_pull_death', 'decay_seating_death', 'aporia', 'unresolved'];
const GUARD_STATE_ORDER = ['unguarded', 'pacing', 'visible', 'proof_debt'];

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const OUT_DIR = path.resolve(ROOT, flag('out', 'exports/dramatic-derivation/guard-compiler'));
const LOOP_DIR = path.resolve(ROOT, flag('loop-dir', 'exports/dramatic-derivation/loop'));
const WORLD_PATHS = (flag('worlds', DEFAULT_WORLDS.join(',')) || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function worldSlug(world) {
  return world.id.replaceAll('_', '-');
}

function priorLedger(result, turn) {
  return (result?.ledger || []).filter((entry) => entry.turn < turn);
}

function playedReleaseSafety(world, result, diagnosis) {
  const decisions = diagnosis?.releaseDeviations?.decisions || [];
  return decisions
    .filter((decision) => decision.played && typeof decision.turn === 'number')
    .map((decision) => {
      const solvency = releaseSolvency(world, priorLedger(result, decision.turn), {
        premise: decision.played,
        turn: decision.turn,
      });
      return {
        turn: decision.turn,
        premise: decision.played,
        safe: Boolean(solvency?.safe),
        verdict: solvency?.verdict || null,
        guardIntervention: Boolean(
          decision.pacingGuard?.blocked ||
            decision.pacingGuard?.forcedSafe ||
            decision.visibleGuard?.blocked ||
            decision.visibleGuard?.forcedSafe,
        ),
      };
    });
}

function classifyArm(world, arm) {
  const dir = path.join(LOOP_DIR, arm);
  const resultPath = path.join(dir, 'result.json');
  const diagnosisPath = path.join(dir, 'diagnosis.json');
  if (!existsSync(resultPath) || !existsSync(diagnosisPath)) {
    return { arm, missing: true, reason: `missing result or diagnosis in ${path.relative(ROOT, dir)}` };
  }
  const result = readJson(resultPath);
  const diagnosis = readJson(diagnosisPath);
  const row = classifyBoundaryFailure(world, result, diagnosis);
  const safety = playedReleaseSafety(world, result, diagnosis);
  return {
    ...row,
    arm,
    missing: false,
    playedReleaseSafety: {
      played: safety.length,
      unsafe: safety.filter((entry) => !entry.safe).length,
      unsafeRows: safety.filter((entry) => !entry.safe),
      guardInterventions: safety.filter((entry) => entry.guardIntervention).length,
    },
  };
}

function contingency(rows) {
  const classified = rows.filter((row) => !row.missing);
  const out = {};
  for (const guardState of GUARD_STATE_ORDER) {
    const guardRows = classified.filter((row) => row.guardState === guardState);
    if (!guardRows.length) continue;
    out[guardState] = {};
    for (const mode of FAILURE_MODE_ORDER) {
      const n = guardRows.filter((row) => row.failureMode === mode).length;
      if (n) out[guardState][mode] = n;
    }
    out[guardState].n = guardRows.length;
  }
  return out;
}

function safetySummary(rows) {
  const classified = rows.filter((row) => !row.missing);
  const out = {};
  for (const guardState of GUARD_STATE_ORDER) {
    const guardRows = classified.filter((row) => row.guardState === guardState);
    if (!guardRows.length) continue;
    const played = guardRows.reduce((n, row) => n + row.playedReleaseSafety.played, 0);
    const unsafe = guardRows.reduce((n, row) => n + row.playedReleaseSafety.unsafe, 0);
    const interventions = guardRows.reduce((n, row) => n + row.playedReleaseSafety.guardInterventions, 0);
    out[guardState] = { arms: guardRows.length, played, unsafe, interventions };
  }
  return out;
}

function renderContingencyTable(rows) {
  const classified = rows.filter((row) => !row.missing);
  const guardStates = GUARD_STATE_ORDER.filter((guard) => classified.some((row) => row.guardState === guard));
  const modes = FAILURE_MODE_ORDER.filter((mode) => classified.some((row) => row.failureMode === mode));
  const lines = [];
  lines.push(`| guard state | ${modes.join(' | ')} | n |`);
  lines.push(`|---|${modes.map(() => '---:').join('|')}|---:|`);
  for (const guard of guardStates) {
    const counts = modes.map((mode) => classified.filter((row) => row.guardState === guard && row.failureMode === mode).length);
    lines.push(`| \`${guard}\` | ${counts.join(' | ')} | ${counts.reduce((a, b) => a + b, 0)} |`);
  }
  return lines;
}

function renderSafetyTable(summary) {
  const lines = [];
  lines.push('| guard state | arms | played releases | unsafe played releases | guard interventions |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const guard of GUARD_STATE_ORDER) {
    if (!summary[guard]) continue;
    const row = summary[guard];
    lines.push(`| \`${guard}\` | ${row.arms} | ${row.played} | ${row.unsafe} | ${row.interventions} |`);
  }
  return lines;
}

function renderWorldReport({ world, worldIR, guardSpec, rows }) {
  const specSummary = summarizeGuardSpec(guardSpec);
  const secretJoin = worldIR.proofGraph.secretProof;
  const lines = [];
  lines.push(`# Guard compiler replay report: ${world.title}`);
  lines.push('');
  lines.push('Static P1a slice only: WorldIR + GuardSpec compilation and dry replay over archived arms. No live runtime behavior, model calls, database writes, or new k-fans.');
  lines.push('');
  lines.push('## WorldIR summary');
  lines.push('');
  lines.push(`- World: \`${world.id}\``);
  lines.push(`- Premises: ${worldIR.premises.length}`);
  lines.push(`- Release entries: ${worldIR.releaseCalendar.length}`);
  lines.push(`- Proof paths: ${worldIR.proofGraph.proofPaths.length}`);
  lines.push(`- Secret proof root rule: \`${secretJoin.rootRule || 'base'}\``);
  lines.push(`- Secret top-level branches: ${secretJoin.topBranches.length}`);
  lines.push(`- Independent top-level join: ${secretJoin.independentTopLevelJoin ? 'yes' : 'no'}`);
  lines.push('');
  if (secretJoin.topBranches.length) {
    lines.push('| branch | root predicate | base premises |');
    lines.push('|---|---|---|');
    for (const branch of secretJoin.topBranches) {
      lines.push(
        `| \`${branch.id}\` | \`${branch.rootPredicate || '?'}\` | ${branch.basePremiseIds.map((id) => `\`${id}\``).join(', ')} |`,
      );
    }
    lines.push('');
  }
  lines.push('## GuardSpec summary');
  lines.push('');
  lines.push(`- Hidden pacing premises: ${specSummary.hiddenPacingPremises}`);
  lines.push(`- Visible projection status: \`${specSummary.visibleProjectionStatus}\``);
  lines.push(`- Proof-debt tutor view: ${specSummary.proofDebtTutorView.map((field) => `\`${field}\``).join(', ')}`);
  lines.push('');
  lines.push('| premise | scheduled | safe turns | unsafe turns |');
  lines.push('|---|---:|---|---|');
  for (const row of guardSpec.guards.hidden_pacing.releaseCorridors) {
    const unsafe = row.unsafeTurns.map((entry) => `t${entry.turn}:${entry.verdict}`).join(', ') || 'none';
    lines.push(`| \`${row.premise}\` | t${row.scheduledTurn} | ${row.safeTurns.map((turn) => `t${turn}`).join(', ') || 'none'} | ${unsafe} |`);
  }
  lines.push('');
  lines.push('## Archived replay');
  lines.push('');
  lines.push(...renderContingencyTable(rows));
  lines.push('');
  lines.push('## Played-release safety replay');
  lines.push('');
  lines.push(...renderSafetyTable(safetySummary(rows)));
  lines.push('');
  lines.push('## Arm details');
  lines.push('');
  lines.push('| arm | verdict | guard | failure mode | unsafe releases | key evidence |');
  lines.push('|---|---|---|---|---:|---|');
  for (const row of rows) {
    if (row.missing) {
      lines.push(`| \`${row.arm}\` | missing | missing | missing | 0 | ${row.reason} |`);
      continue;
    }
    lines.push(
      `| \`${row.arm}\` | ${row.verdict} t${row.endTurn} | \`${row.guardState}\` | \`${row.failureMode}\` | ${row.playedReleaseSafety.unsafe} | ${row.reasons.join('; ')} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(OUT_DIR, { recursive: true });

const index = {
  schema: 'dramatic-derivation.guard-compiler-run.v0',
  mode: 'static_replay_first',
  worlds: [],
};

for (const worldPath of WORLD_PATHS) {
  const absoluteWorldPath = path.resolve(ROOT, worldPath);
  const world = loadWorld(absoluteWorldPath);
  const slug = worldSlug(world);
  const worldIR = buildWorldIR(world, { source: path.relative(ROOT, absoluteWorldPath) });
  const guardSpec = compileGuardSpec(world, worldIR);
  const arms = DEFAULT_ARMS_BY_WORLD[world.id] || [];
  const rows = arms.map((arm) => classifyArm(world, arm));
  const summary = {
    worldId: world.id,
    worldTitle: world.title,
    worldIR: `world-ir-${slug}.json`,
    guardSpec: `guard-spec-${slug}.json`,
    report: `guard-compiler-report-${slug}.md`,
    guardSpecSummary: summarizeGuardSpec(guardSpec),
    contingency: contingency(rows),
    safety: safetySummary(rows),
    missingArms: rows.filter((row) => row.missing).map((row) => row.arm),
  };

  writeJson(path.join(OUT_DIR, summary.worldIR), worldIR);
  writeJson(path.join(OUT_DIR, summary.guardSpec), guardSpec);
  writeFileSync(path.join(OUT_DIR, summary.report), renderWorldReport({ world, worldIR, guardSpec, rows }));
  index.worlds.push(summary);
}

writeJson(path.join(OUT_DIR, 'guard-compiler-index.json'), index);
const indexMd = [
  '# Guard compiler P1a index',
  '',
  'Static replay-first slice. This materializes WorldIR and GuardSpec artifacts for existing worlds and replays archived arms through existing detector/safety readers.',
  '',
  '| world | visible projection | report | missing arms |',
  '|---|---|---|---:|',
  ...index.worlds.map(
    (world) =>
      `| \`${world.worldId}\` | \`${world.guardSpecSummary.visibleProjectionStatus}\` | [${world.report}](${world.report}) | ${world.missingArms.length} |`,
  ),
  '',
].join('\n');
writeFileSync(path.join(OUT_DIR, 'guard-compiler-index.md'), indexMd);

console.log(`guard compiler artifacts written: ${path.relative(ROOT, OUT_DIR)}`);
for (const world of index.worlds) {
  console.log(`${world.worldId}: ${world.report} · visible=${world.guardSpecSummary.visibleProjectionStatus}`);
}
