#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const DEFAULT_ROOT = '.tutor-stub-auto-eval/character-adaptation-loop';

export const CHARACTER_ADAPTATION_LOOP_SPEC = Object.freeze({
  schema: 'machinespirits.tutor-stub.character-adaptation-loop.v2',
  targets: Object.freeze({
    primary: Object.freeze({
      world: 'world_005_marrick',
      learnerProfile: 'affective_resistant',
      workingSeed: 20260714,
      acceptanceSeed: 20260715,
      purpose: 'working_and_primary_held_out_verification',
    }),
    transfer: Object.freeze({
      world: 'world_023_greyfen_lab',
      learnerProfile: 'false_memory',
      acceptanceSeed: 20260729,
      retiredAcceptanceSeeds: Object.freeze([
        Object.freeze({
          seed: 20260716,
          reason: 'consumed before camel-case public answer names were normalized',
        }),
        Object.freeze({
          seed: 20260717,
          reason: 'consumed before direct record corrections counted as skeptical learner uptake',
        }),
        Object.freeze({
          seed: 20260718,
          reason: 'consumed before lab exhibits and cross-domain character actions were audited generically',
        }),
        Object.freeze({
          seed: 20260719,
          reason: 'consumed before proof-complete objections and falsifiable advocacy counted as character work',
        }),
        Object.freeze({
          seed: 20260720,
          reason: 'consumed before explicit boundary stops, corrections, and lab-notebook acts counted as character work',
        }),
        Object.freeze({
          seed: 20260721,
          reason: 'three deterministic fallbacks exceeded the strict maximum of one',
        }),
        Object.freeze({
          seed: 20260722,
          reason: 'two deterministic fallbacks exceeded the strict maximum of one',
        }),
        Object.freeze({
          seed: 20260723,
          reason: 'three deterministic fallbacks and a recovered analysis timeout failed strict gates',
        }),
        Object.freeze({
          seed: 20260724,
          reason: 'consumed before cross-domain source-versus-custody boundaries received specific learner uptake',
        }),
        Object.freeze({
          seed: 20260725,
          reason: 'two safe fallbacks exceeded the strict maximum before cross-domain skeptic and advocate acts were recognized',
        }),
        Object.freeze({
          seed: 20260726,
          reason: 'three safe fallbacks exceeded the strict maximum before cross-domain comparison and supported-finding acts were recognized',
        }),
        Object.freeze({
          seed: 20260727,
          reason: 'three safe fallbacks exceeded the strict maximum before placement likelihood, explicit evidence boundaries, and supported advocacy were recognized',
        }),
        Object.freeze({
          seed: 20260728,
          reason: 'two safe fallbacks and undercounted corrective-answer realization failed the held-out transfer gates',
        }),
      ]),
      purpose: 'held_out_scenario_and_profile_transfer_check',
    }),
  }),
  policy: 'continuous_dynamical_system',
  tutorModel: 'codex.gpt-5.6-terra',
  analysisModel: 'codex.gpt-5.6-sol',
  learnerModel: 'codex.gpt-5.6-terra',
  turns: 10,
  dagMode: 'defeasible_human_scaffold',
  registerTemperature: 0.15,
  releaseSpeed: 1,
  primaryHorizon: 10,
  gates: Object.freeze({
    finalDeliveryAuditFailures: 0,
    maximumDeterministicFallbackTurns: 1,
    errorCount: 0,
    metaPerformanceTurns: 0,
    roleStageDirectionTurns: 0,
    sourceReplacementTurns: 0,
    duplicateClueDeliveryTurns: 0,
    minimumHostVisibilityRate: 1,
    minimumMeanConfigurationRealization: 0.9,
    minimumDistinctHostParts: 2,
  }),
});

const { values: args } = parseArgs({
  options: {
    mode: { type: 'string', default: 'strict' },
    phase: { type: 'string', default: 'working' },
    target: { type: 'string', default: 'primary' },
    iteration: { type: 'string', default: '1' },
    'trace-dir': { type: 'string', default: '' },
    'from-report': { type: 'string', default: '' },
    'run-seed': { type: 'string', default: '' },
    turns: { type: 'string', default: String(CHARACTER_ADAPTATION_LOOP_SPEC.turns) },
    model: { type: 'string', default: CHARACTER_ADAPTATION_LOOP_SPEC.tutorModel },
    'analysis-model': { type: 'string', default: CHARACTER_ADAPTATION_LOOP_SPEC.analysisModel },
    'auto-learner-model': { type: 'string', default: CHARACTER_ADAPTATION_LOOP_SPEC.learnerModel },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function usage() {
  console.log(`Usage:
  npm run tutor:stub:character-loop -- --dry-run
  npm run tutor:stub:character-loop -- --mode diagnostic --phase working --iteration 1
  npm run tutor:stub:character-loop -- --mode strict --phase working --iteration 1
  npm run tutor:stub:character-loop -- --mode strict --phase acceptance --target primary --iteration 1
  npm run tutor:stub:character-loop -- --mode strict --phase acceptance --target transfer --iteration 1
  npm run tutor:stub:character-loop -- --mode diagnostic --from-report <auto-eval.json>

Diagnostic mode always collects ten turns, quarantining recoverable exhausted
turns without releasing their clue. Strict mode retains fail-fast behavior and
all acceptance gates. Acceptance must run in a fresh directory after strict
working verification passes.`);
}

function loopMode() {
  const value = String(args.mode || '').trim().toLowerCase();
  if (!['diagnostic', 'strict'].includes(value)) throw new Error('--mode must be diagnostic or strict');
  return value;
}

function loopPhase() {
  const value = String(args.phase || '').trim().toLowerCase();
  if (!['working', 'acceptance'].includes(value)) throw new Error('--phase must be working or acceptance');
  if (loopMode() === 'diagnostic' && value === 'acceptance') {
    throw new Error('Diagnostic collection is working evidence, not acceptance; use --phase working');
  }
  return value;
}

function targetSpec() {
  const target = String(args.target || '').trim().toLowerCase();
  const spec = CHARACTER_ADAPTATION_LOOP_SPEC.targets[target];
  if (!spec) throw new Error('--target must be primary or transfer');
  if (target === 'transfer' && loopPhase() !== 'acceptance') {
    throw new Error('The transfer target is reserved for the held-out acceptance check');
  }
  return { id: target, ...spec };
}

function positiveInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function loopTraceDir() {
  if (args['trace-dir']) return resolvePath(args['trace-dir']);
  return path.join(
    ROOT,
    DEFAULT_ROOT,
    `${loopMode()}-${loopPhase()}-${targetSpec().id}-i${positiveInt(args.iteration, '--iteration')}-${safeTimestamp()}`,
  );
}

function runSeed() {
  if (args['run-seed']) return positiveInt(args['run-seed'], '--run-seed');
  const target = targetSpec();
  return loopPhase() === 'acceptance' ? target.acceptanceSeed : target.workingSeed;
}

function autoEvalCommand(traceDir) {
  return [
    process.execPath,
    'scripts/run-tutor-stub-auto-eval.js',
    '--runs',
    '1',
    '--run-seed',
    String(runSeed()),
    '--policies',
    CHARACTER_ADAPTATION_LOOP_SPEC.policy,
    '--parallelism',
    '1',
    '--turns',
    String(positiveInt(args.turns, '--turns')),
    '--primary-horizon',
    String(Math.min(positiveInt(args.turns, '--turns'), CHARACTER_ADAPTATION_LOOP_SPEC.primaryHorizon)),
    '--model',
    args.model,
    '--analysis-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile-id',
    targetSpec().learnerProfile,
    '--world',
    targetSpec().world,
    '--dag-mode',
    CHARACTER_ADAPTATION_LOOP_SPEC.dagMode,
    '--register-temperature',
    String(CHARACTER_ADAPTATION_LOOP_SPEC.registerTemperature),
    '--release-speed',
    String(CHARACTER_ADAPTATION_LOOP_SPEC.releaseSpeed),
    '--cli-effort',
    'low',
    '--max-tokens',
    '4096',
    '--history-turns',
    '4',
    '--trace-dir',
    traceDir,
    '--keep-going',
    '--no-ledger',
    '--loop-mode',
    loopMode(),
  ]
    .concat(loopMode() === 'diagnostic' ? ['--no-stop-on-grounded'] : [])
    .concat(args['dry-run'] ? ['--dry-run'] : []);
}

function newestAutoEvalReport(root) {
  const candidates = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (/^auto-eval-.*\.json$/u.test(entry.name)) candidates.push(filePath);
    }
  }
  walk(root);
  return candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs).at(0) || null;
}

function sum(rows, reader) {
  return rows.reduce((total, row) => total + Number(reader(row) || 0), 0);
}

export function assessCharacterAdaptationReport(summary, { mode = summary.config?.loopMode || 'strict' } = {}) {
  const normalizedMode = String(mode || 'strict').trim().toLowerCase();
  if (!['diagnostic', 'strict'].includes(normalizedMode)) throw new Error('report mode must be diagnostic or strict');
  const rows = (summary.rows || []).filter((row) => row.status === 'ok');
  const dryRun = summary.config?.dryRun === true || (summary.rows || []).every((row) => row.status === 'dry_run');
  const turns = sum(rows, (row) => row.turnCount);
  const clueReleaseTurns = sum(rows, (row) => row.characterAdaptation?.clueReleaseTurns);
  const hostVisibleTurns = sum(rows, (row) => row.characterAdaptation?.hostVisibleTurns);
  const hostParts = new Set(
    rows.flatMap((row) => Object.keys(row.characterAdaptation?.hostPartCounts || row.actorialPartCounts || {})),
  );
  const realizationWeighted = rows.reduce(
    (total, row) =>
      total + Number(row.responseConfigurationVisibility?.mean_realization_rate || 0) * Number(row.turnCount || 0),
    0,
  );
  const observed = {
    rows: rows.length,
    turns,
    clueReleaseTurns,
    finalDeliveryAuditFailures: sum(rows, (row) => row.guardAccounting?.finalDeliveryAuditFailures),
    originalCandidateAcceptedTurns: sum(rows, (row) => row.guardAccounting?.originalCandidateAcceptedTurns),
    originalCandidateAcceptanceRate: turns
      ? Number(
          (
            sum(rows, (row) => row.guardAccounting?.originalCandidateAcceptedTurns) / turns
          ).toFixed(3),
        )
      : null,
    mechanicalRepairTurns: sum(rows, (row) => row.guardAccounting?.mechanicalRepairTurns),
    modelRepairTurns: sum(rows, (row) => row.guardAccounting?.modelRepairTurns),
    deterministicFallbackTurns: sum(rows, (row) => row.guardAccounting?.deterministicFallbackTurns),
    totalTutorGenerationLatencyMs: sum(rows, (row) => row.guardAccounting?.totalTutorGenerationLatencyMs),
    meanTutorGenerationLatencyMs: turns
      ? Number(
          (
            sum(rows, (row) => row.guardAccounting?.totalTutorGenerationLatencyMs) / turns
          ).toFixed(1),
        )
      : null,
    meanOriginalCandidateLatencyMs: turns
      ? Number(
          (
            sum(rows, (row) => row.guardAccounting?.totalOriginalCandidateLatencyMs) / turns
          ).toFixed(1),
        )
      : null,
    errorCount: Number(summary.aggregates?.errorCount || 0) + sum(rows, (row) => row.errorCount),
    metaPerformanceTurns: sum(rows, (row) => row.characterAdaptation?.metaPerformanceTurns),
    roleStageDirectionTurns: sum(rows, (row) => row.characterAdaptation?.roleStageDirectionTurns),
    sourceReplacementTurns: sum(rows, (row) => row.characterAdaptation?.sourceReplacementTurns),
    duplicateClueDeliveryTurns: sum(rows, (row) => row.characterAdaptation?.duplicateClueDeliveryTurns),
    hostVisibilityRate: turns ? Number((hostVisibleTurns / turns).toFixed(3)) : null,
    meanConfigurationRealization: turns ? Number((realizationWeighted / turns).toFixed(3)) : null,
    distinctHostParts: hostParts.size,
    hostParts: [...hostParts].sort(),
    quarantineCount: sum(rows, (row) => row.diagnosticCollection?.quarantineCount),
    firstQuarantinedTurn:
      rows.map((row) => row.diagnosticCollection?.firstQuarantinedTurn).filter(Number.isFinite).sort((a, b) => a - b)[0] ??
      null,
  };
  const diagnosticCollection = rows.length === 1
    ? rows[0].diagnosticCollection || null
    : {
        schema: 'machinespirits.tutor-stub.diagnostic-collection-batch.v1',
        rows: rows.map((row) => row.diagnosticCollection).filter(Boolean),
      };
  const threshold = CHARACTER_ADAPTATION_LOOP_SPEC.gates;
  const gates = dryRun || normalizedMode === 'diagnostic'
    ? []
    : [
        ['technical delivery', observed.finalDeliveryAuditFailures === threshold.finalDeliveryAuditFailures && observed.errorCount === threshold.errorCount],
        [
          'bounded safe repair',
          observed.deterministicFallbackTurns <= threshold.maximumDeterministicFallbackTurns,
        ],
        ['no meta-performance', observed.metaPerformanceTurns === threshold.metaPerformanceTurns && observed.roleStageDirectionTurns === threshold.roleStageDirectionTurns],
        ['host/source separation', observed.sourceReplacementTurns === threshold.sourceReplacementTurns],
        ['single clue delivery', observed.duplicateClueDeliveryTurns === threshold.duplicateClueDeliveryTurns],
        ['host visible', observed.hostVisibilityRate >= threshold.minimumHostVisibilityRate],
        ['configuration realized', observed.meanConfigurationRealization >= threshold.minimumMeanConfigurationRealization],
        [
          'host variation',
          turns < 4 || observed.distinctHostParts >= threshold.minimumDistinctHostParts,
        ],
      ].map(([name, pass]) => ({ name, pass }));
  return {
    schema: CHARACTER_ADAPTATION_LOOP_SPEC.schema,
    mode: normalizedMode,
    status: dryRun
      ? 'planned'
      : normalizedMode === 'diagnostic'
        ? rows.length === 1 && turns === CHARACTER_ADAPTATION_LOOP_SPEC.turns
          ? 'diagnostic_complete'
          : 'diagnostic_incomplete'
        : gates.every((gate) => gate.pass)
          ? 'pass'
          : 'fail',
    spec: CHARACTER_ADAPTATION_LOOP_SPEC,
    observed,
    gates,
    diagnosticCollection: normalizedMode === 'diagnostic' ? diagnosticCollection : null,
  };
}

function markdown(result, reportPath) {
  const target = targetSpec();
  const diagnostic = result.diagnosticCollection;
  const diagnosticRows = diagnostic
    ? [
        '## Diagnostic boundary',
        '',
        `- First quarantined turn: ${diagnostic.firstQuarantinedTurn ?? 'none'}`,
        `- Quarantined turns: ${(diagnostic.quarantinedTurns || []).join(', ') || 'none'}`,
        `- Ten-turn collection complete: ${diagnostic.completedTenTurnBatch === true ? 'yes' : 'no'}`,
        '',
        '```json',
        JSON.stringify(diagnostic.evidenceSegments || {}, null, 2),
        '```',
        '',
        '## Root-cause clusters',
        '',
        ...((diagnostic.failureClusters || []).length
          ? diagnostic.failureClusters.map(
              (cluster) =>
                `- ${cluster.rootCause} / ${cluster.guard}:${cluster.issueType} — ${cluster.occurrences} occurrence(s), turns ${cluster.turns.join(', ')}, stages ${cluster.stages.join(', ')}`,
            )
          : ['- No audited candidate failures.']),
        '',
        '## Retained candidates',
        '',
        ...((diagnostic.candidates || []).length
          ? diagnostic.candidates.flatMap((candidate) => [
              `### Turn ${candidate.turn} · ${candidate.stage}`,
              '',
              `- Audit: ${candidate.auditOk ? 'pass' : 'fail'}`,
              `- Failures: ${(candidate.issues || []).map((issue) => `${issue.guard}:${issue.type}`).join(', ') || 'none'}`,
              '',
              '```text',
              String(candidate.text || '').replace(/```/gu, '``\\`'),
              '```',
              '',
            ])
          : ['- No guarded candidates were retained.']),
      ]
    : [];
  return [
    '# Tutor-stub character adaptation loop',
    '',
    `- Status: **${result.status}**`,
    `- Mode: ${result.mode}`,
    `- Phase: ${loopPhase()}`,
    `- Target: ${target.id} — ${target.purpose}`,
    `- Scenario: ${target.world}`,
    `- Learner: ${target.learnerProfile}`,
    `- Seed: ${runSeed()}`,
    `- Policy: ${CHARACTER_ADAPTATION_LOOP_SPEC.policy}`,
    `- Source report: ${path.relative(ROOT, reportPath)}`,
    '',
    '## Gates',
    '',
    ...(result.gates.length
      ? result.gates.map((gate) => `- ${gate.pass ? 'PASS' : 'FAIL'} — ${gate.name}`)
      : [result.mode === 'diagnostic' ? '- Not applicable — diagnostic evidence cannot certify acceptance' : '- Pending — dry-run only']),
    '',
    '## Observed',
    '',
    '```json',
    JSON.stringify(result.observed, null, 2),
    '```',
    '',
    ...diagnosticRows,
  ].join('\n');
}

function ledgerRows() {
  const ledgerPath = path.join(ROOT, DEFAULT_ROOT, 'loop-ledger.jsonl');
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function assertAcceptanceSeedAvailable() {
  if (loopMode() !== 'strict' || loopPhase() !== 'acceptance') return;
  const target = targetSpec();
  const seed = runSeed();
  const failedUse = ledgerRows().find(
    (row) =>
      row.mode === 'strict' &&
      row.phase === 'acceptance' &&
      row.target === target.id &&
      Number(row.runSeed) === seed &&
      row.status === 'fail',
  );
  if (failedUse) {
    throw new Error(
      `Acceptance seed ${seed} already failed for ${target.id} and is retired. Predeclare a new untouched seed with --run-seed <n>.`,
    );
  }
}

function appendLedger(result, reportPath) {
  const ledgerPath = path.join(ROOT, DEFAULT_ROOT, 'loop-ledger.jsonl');
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const row = {
    recordedAt: new Date().toISOString(),
    mode: loopMode(),
    phase: loopPhase(),
    target: targetSpec().id,
    world: targetSpec().world,
    learnerProfile: targetSpec().learnerProfile,
    iteration: positiveInt(args.iteration, '--iteration'),
    runSeed: runSeed(),
    acceptanceSeedDisposition:
      loopPhase() !== 'acceptance'
        ? null
        : result.status === 'pass'
          ? 'accepted_untouched_seed'
          : 'retired_after_failed_acceptance',
    report: path.relative(ROOT, reportPath),
    status: result.status,
    failingGates: result.gates.filter((gate) => !gate.pass).map((gate) => gate.name),
  };
  fs.appendFileSync(ledgerPath, `${JSON.stringify(row)}\n`, 'utf8');
  return ledgerPath;
}

async function runChild(command) {
  await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`auto-eval exited ${code}`))));
  });
}

async function main() {
  if (args.help) {
    usage();
    return;
  }
  let reportPath;
  if (args['from-report']) {
    reportPath = resolvePath(args['from-report']);
  } else {
    assertAcceptanceSeedAvailable();
    const traceDir = loopTraceDir();
    const command = autoEvalCommand(traceDir);
    console.log(`character loop ${loopMode()} ${loopPhase()} ${targetSpec().id} iteration ${args.iteration}`);
    console.log(command.map((part) => JSON.stringify(part)).join(' '));
    await runChild(command);
    reportPath = newestAutoEvalReport(traceDir);
    if (!reportPath) throw new Error(`No auto-eval report found under ${traceDir}`);
  }

  const summary = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const result = assessCharacterAdaptationReport(summary, { mode: loopMode() });
  const outputDir = path.dirname(reportPath);
  const jsonPath = path.join(outputDir, 'character-loop-result.json');
  const markdownPath = path.join(outputDir, 'character-loop-result.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, markdown(result, reportPath), 'utf8');
  const ledgerPath = appendLedger(result, reportPath);
  console.log(`character loop: ${result.status}`);
  for (const gate of result.gates) console.log(`${gate.pass ? 'PASS' : 'FAIL'} ${gate.name}`);
  console.log(`result: ${path.relative(ROOT, markdownPath)}`);
  console.log(`ledger: ${path.relative(ROOT, ledgerPath)}`);
  if (result.status === 'fail' || result.status === 'diagnostic_incomplete') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
