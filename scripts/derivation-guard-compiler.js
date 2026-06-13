#!/usr/bin/env node
/**
 * P1 guard-compiler slice: compile static WorldIR + GuardSpec artifacts and
 * replay archived arms against the existing detector/safety readers.
 *
 * This is intentionally not a live runtime compiler and makes no model calls.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
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

const DEFAULT_OUT_DIR = 'exports/dramatic-derivation/guard-compiler';
const DEFAULT_LOOP_DIR = 'exports/dramatic-derivation/loop';

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

const PROOF_DEBT_ARMS_BY_WORLD = {
  world_002_lantern: ['lantern-e3-real-r1', 'lantern-e5-proof-debt-real-r1'],
};

const FAILURE_MODE_ORDER = ['grounded', 'early_pull_death', 'decay_seating_death', 'aporia', 'unresolved'];
const GUARD_STATE_ORDER = ['unguarded', 'pacing', 'visible', 'proof_debt'];
const ARITH_KEYS = ['dNow', 'dIfRestored', 'deltaD', 'closesProof'];

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const OUT_DIR = path.resolve(ROOT, flag('out', DEFAULT_OUT_DIR));
const LOOP_DIR = path.resolve(ROOT, flag('loop-dir', DEFAULT_LOOP_DIR));
const WORLD_PATHS = (flag('worlds', DEFAULT_WORLDS.join(',')) || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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

function visibleHiddenAgreement(world, result, diagnosis) {
  const rows = [];
  for (const decision of diagnosis?.releaseDeviations?.decisions || []) {
    if (!decision.visibleGuard) continue;

    const claim = decision.claimed || null;
    const visiblePushed = Boolean(!claim && decision.visibleGuard.forcedSafe && decision.played);
    if (!claim && !visiblePushed) continue;

    const premise = claim || decision.played;
    const solvency = releaseSolvency(world, priorLedger(result, decision.turn), { premise, turn: decision.turn });
    const hiddenAllows = Boolean(solvency?.safe);
    const visibleAllows = claim
      ? Boolean(decision.played === claim && !decision.visibleGuard.blocked)
      : Boolean(visiblePushed);
    const visibleDecision = visibleAllows ? 'release' : 'hold';
    const hiddenDecision = hiddenAllows ? 'release' : 'hold';

    rows.push({
      turn: decision.turn,
      premise,
      kind: claim ? 'claimed_release' : 'visible_push',
      visibleDecision,
      hiddenDecision,
      agreement: visibleDecision === hiddenDecision,
      hiddenVerdict: solvency?.verdict || null,
      falseRelease: visibleDecision === 'release' && hiddenDecision === 'hold',
      falseHold: visibleDecision === 'hold' && hiddenDecision === 'release',
      catastrophicFalseRelease: visibleDecision === 'release' && hiddenDecision === 'hold',
    });
  }

  if (!rows.length) return null;
  const agreements = rows.filter((row) => row.agreement).length;
  return {
    decisionPoints: rows.length,
    agreements,
    agreementRate: Number((agreements / rows.length).toFixed(3)),
    falseReleases: rows.filter((row) => row.falseRelease).length,
    falseHolds: rows.filter((row) => row.falseHold).length,
    catastrophicFalseReleases: rows.filter((row) => row.catastrophicFalseRelease).length,
    rows,
  };
}

function classifyArm(world, arm, loopDir) {
  const dir = path.join(loopDir, arm);
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
    visibleAgreement: visibleHiddenAgreement(world, result, diagnosis),
  };
}

function proofDebtTutorViewNarrow(result) {
  const leaks = [];
  for (const row of result?.transcript || []) {
    if (row.role !== 'tutor' || !row.meta?.proofDebt) continue;
    const leakedKeys = ARITH_KEYS.filter((key) => key in row.meta.proofDebt);
    if (leakedKeys.length) leaks.push({ turn: row.turn, leakedKeys });
  }
  return { pass: leaks.length === 0, leaks };
}

function proofDebtLedgerCarriesArithmetic(result) {
  return Boolean(
    (result?.proofDebt || []).some((row) => (row.debts || []).some((debt) => ARITH_KEYS.some((key) => key in debt))),
  );
}

function proofDebtReplayRows(world, arms, loopDir) {
  return arms.map((arm) => {
    const dir = path.join(loopDir, arm);
    const resultPath = path.join(dir, 'result.json');
    const diagnosisPath = path.join(dir, 'diagnosis.json');
    if (!existsSync(resultPath) || !existsSync(diagnosisPath)) {
      return { arm, missing: true, reason: `missing result or diagnosis in ${path.relative(ROOT, dir)}` };
    }
    const result = readJson(resultPath);
    const diagnosis = readJson(diagnosisPath);
    const classified = classifyBoundaryFailure(world, result, diagnosis);
    const proofDebt = diagnosis.proofDebt || null;
    const tutorView = proofDebtTutorViewNarrow(result);
    const ledgerCarriesArithmetic = proofDebtLedgerCarriesArithmetic(result);
    const isProofDebtArm = classified.guardState === 'proof_debt';
    const pass = isProofDebtArm
      ? Boolean(
          proofDebt?.debtsDetected > 0 &&
            proofDebt?.restoredMoves > 0 &&
            proofDebt?.repairedTargets > 0 &&
            tutorView.pass &&
            ledgerCarriesArithmetic,
        )
      : null;

    return {
      arm,
      missing: false,
      verdict: classified.verdict,
      endTurn: classified.endTurn,
      guardState: classified.guardState,
      failureMode: classified.failureMode,
      detectedTurns: proofDebt?.detectedTurns || 0,
      debtsDetected: proofDebt?.debtsDetected || 0,
      actionTurns: proofDebt?.actionTurns || 0,
      restoredMoves: proofDebt?.restoredMoves || 0,
      repairedTargets: proofDebt?.repairedTargets || 0,
      targets: proofDebt?.targets || [],
      tutorViewNarrow: tutorView.pass,
      tutorViewLeaks: tutorView.leaks,
      ledgerCarriesArithmetic,
      pass,
    };
  });
}

function proofDebtSummary(rows) {
  const present = rows.filter((row) => !row.missing);
  const proofDebtRows = present.filter((row) => row.guardState === 'proof_debt');
  return {
    arms: present.length,
    proofDebtArms: proofDebtRows.length,
    validatedProofDebtArms: proofDebtRows.filter((row) => row.pass).length,
    debtsDetected: present.reduce((sum, row) => sum + row.debtsDetected, 0),
    restoredMoves: present.reduce((sum, row) => sum + row.restoredMoves, 0),
    repairedTargets: [...new Set(present.flatMap((row) => row.targets || []))],
    tutorViewLeaks: present.flatMap((row) => row.tutorViewLeaks || []),
    ledgerArithmeticPositiveControls: proofDebtRows.filter((row) => row.ledgerCarriesArithmetic).length,
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

function visibleAgreementSummary(rows) {
  const visibleRows = rows.filter((row) => row.visibleAgreement);
  const totals = visibleRows.reduce(
    (acc, row) => {
      acc.arms += 1;
      acc.decisionPoints += row.visibleAgreement.decisionPoints;
      acc.agreements += row.visibleAgreement.agreements;
      acc.falseReleases += row.visibleAgreement.falseReleases;
      acc.falseHolds += row.visibleAgreement.falseHolds;
      acc.catastrophicFalseReleases += row.visibleAgreement.catastrophicFalseReleases;
      return acc;
    },
    {
      arms: 0,
      decisionPoints: 0,
      agreements: 0,
      falseReleases: 0,
      falseHolds: 0,
      catastrophicFalseReleases: 0,
    },
  );
  return {
    ...totals,
    agreementRate: totals.decisionPoints ? Number((totals.agreements / totals.decisionPoints).toFixed(3)) : null,
  };
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

function renderVisibleAgreementTable(rows) {
  const visibleRows = rows.filter((row) => row.visibleAgreement);
  const lines = [];
  lines.push('| arm | decision points | agreement | false releases | false holds | catastrophic false releases |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of visibleRows) {
    const agreement = row.visibleAgreement.agreementRate == null ? 'n/a' : row.visibleAgreement.agreementRate.toFixed(3);
    lines.push(
      `| \`${row.arm}\` | ${row.visibleAgreement.decisionPoints} | ${agreement} | ${row.visibleAgreement.falseReleases} | ${row.visibleAgreement.falseHolds} | ${row.visibleAgreement.catastrophicFalseReleases} |`,
    );
  }
  if (!visibleRows.length) lines.push('| _none_ | 0 | n/a | 0 | 0 | 0 |');
  return lines;
}

function renderProofDebtTable(rows) {
  const lines = [];
  lines.push('| arm | guard | verdict | failure mode | detected | restored | targets | tutor view | ledger ctrl | pass |');
  lines.push('|---|---|---|---|---:|---:|---|---|---|---|');
  for (const row of rows) {
    if (row.missing) {
      lines.push(`| \`${row.arm}\` | missing | missing | missing | 0 | 0 |  | missing | missing | missing |`);
      continue;
    }
    const pass = row.pass == null ? 'n/a' : row.pass ? 'PASS' : '**FAIL**';
    lines.push(
      `| \`${row.arm}\` | \`${row.guardState}\` | ${row.verdict} t${row.endTurn} | \`${row.failureMode}\` | ${row.debtsDetected} | ${row.restoredMoves} | ${(row.targets || []).map((target) => `\`${target}\``).join(', ') || 'none'} | ${row.tutorViewNarrow ? 'narrow' : '**leak**'} | ${row.ledgerCarriesArithmetic ? 'present' : 'absent'} | ${pass} |`,
    );
  }
  return lines;
}

function renderWorldReport({ world, worldIR, guardSpec, rows, proofDebtRows }) {
  const specSummary = summarizeGuardSpec(guardSpec);
  const secretJoin = worldIR.proofGraph.secretProof;
  const lines = [];
  lines.push(`# Guard compiler replay report: ${world.title}`);
  lines.push('');
  lines.push('Static P1 slice only: WorldIR + GuardSpec compilation and dry replay over archived arms. No live runtime behavior, model calls, database writes, or new k-fans.');
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
  lines.push('## Visible-vs-hidden agreement replay');
  lines.push('');
  lines.push(...renderVisibleAgreementTable(rows));
  lines.push('');
  if (proofDebtRows.length) {
    lines.push('## Proof-debt replay');
    lines.push('');
    lines.push(...renderProofDebtTable(proofDebtRows));
    lines.push('');
  }
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

function renderIndexMd(index) {
  return [
    '# Guard compiler P1 index',
    '',
    'Static replay-first slice. This materializes WorldIR and GuardSpec artifacts for existing worlds and replays archived arms through existing detector/safety readers.',
    '',
    '| world | visible projection | visible agreement | proof-debt replay | report | missing arms |',
    '|---|---|---:|---:|---|---:|',
    ...index.worlds.map(
      (world) =>
        `| \`${world.worldId}\` | \`${world.guardSpecSummary.visibleProjectionStatus}\` | ${world.visibleAgreement.agreementRate ?? 'n/a'} | ${world.proofDebt?.validatedProofDebtArms ?? 0}/${world.proofDebt?.proofDebtArms ?? 0} | [${world.report}](${world.report}) | ${world.missingArms.length} |`,
    ),
    '',
  ].join('\n');
}

function generateArtifacts(outDir, { loopDir = LOOP_DIR, worldPaths = WORLD_PATHS } = {}) {
  mkdirSync(outDir, { recursive: true });
  const index = {
    schema: 'dramatic-derivation.guard-compiler-run.v1',
    mode: 'static_replay_first',
    worlds: [],
  };

  for (const worldPath of worldPaths) {
    const absoluteWorldPath = path.resolve(ROOT, worldPath);
    const world = loadWorld(absoluteWorldPath);
    const slug = worldSlug(world);
    const worldIR = buildWorldIR(world, { source: path.relative(ROOT, absoluteWorldPath) });
    const guardSpec = compileGuardSpec(world, worldIR);
    const arms = DEFAULT_ARMS_BY_WORLD[world.id] || [];
    const rows = arms.map((arm) => classifyArm(world, arm, loopDir));
    const proofDebtRows = proofDebtReplayRows(world, PROOF_DEBT_ARMS_BY_WORLD[world.id] || [], loopDir);
    const summary = {
      worldId: world.id,
      worldTitle: world.title,
      worldIR: `world-ir-${slug}.json`,
      guardSpec: `guard-spec-${slug}.json`,
      report: `guard-compiler-report-${slug}.md`,
      guardSpecSummary: summarizeGuardSpec(guardSpec),
      contingency: contingency(rows),
      safety: safetySummary(rows),
      visibleAgreement: visibleAgreementSummary(rows),
      proofDebt: proofDebtRows.length ? proofDebtSummary(proofDebtRows) : null,
      missingArms: [
        ...rows.filter((row) => row.missing).map((row) => row.arm),
        ...proofDebtRows.filter((row) => row.missing).map((row) => row.arm),
      ],
    };

    writeJson(path.join(outDir, summary.worldIR), worldIR);
    writeJson(path.join(outDir, summary.guardSpec), guardSpec);
    writeFileSync(path.join(outDir, summary.report), renderWorldReport({ world, worldIR, guardSpec, rows, proofDebtRows }));
    index.worlds.push(summary);
  }

  writeJson(path.join(outDir, 'guard-compiler-index.json'), index);
  writeFileSync(path.join(outDir, 'guard-compiler-index.md'), renderIndexMd(index));
  return index;
}

function listFiles(dir, prefix = '') {
  const entries = readdirSync(dir).sort();
  const out = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const relative = path.join(prefix, entry);
    if (statSync(absolute).isDirectory()) out.push(...listFiles(absolute, relative));
    else out.push(relative);
  }
  return out;
}

function checkArtifacts() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'derivation-guard-compiler-'));
  try {
    generateArtifacts(tmp);
    if (!existsSync(OUT_DIR)) {
      console.error(`guard compiler check failed: output directory missing: ${path.relative(ROOT, OUT_DIR)}`);
      process.exitCode = 1;
      return;
    }
    const generated = listFiles(tmp);
    const committed = listFiles(OUT_DIR);
    const all = [...new Set([...generated, ...committed])].sort();
    const diffs = [];
    for (const file of all) {
      if (!generated.includes(file)) diffs.push(`${file}: extra committed file`);
      else if (!committed.includes(file)) diffs.push(`${file}: missing committed file`);
      else if (readFileSync(path.join(tmp, file), 'utf8') !== readFileSync(path.join(OUT_DIR, file), 'utf8')) {
        diffs.push(`${file}: content differs`);
      }
    }
    if (diffs.length) {
      console.error('guard compiler check failed: committed artifacts are stale');
      for (const diff of diffs) console.error(`- ${diff}`);
      process.exitCode = 1;
      return;
    }
    console.log(`guard compiler check passed: ${committed.length} artifact(s) match ${path.relative(ROOT, OUT_DIR)}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (has('check')) {
  checkArtifacts();
} else {
  const index = generateArtifacts(OUT_DIR);
  console.log(`guard compiler artifacts written: ${path.relative(ROOT, OUT_DIR)}`);
  for (const world of index.worlds) {
    console.log(`${world.worldId}: ${world.report} · visible=${world.guardSpecSummary.visibleProjectionStatus}`);
  }
}
