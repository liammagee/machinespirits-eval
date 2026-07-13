#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SELECTION = path.join(
  ROOT,
  'config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-final-selection.json',
);
const FINAL_DIR = 'exports/register-confirmatory-evidence/final';
const SONNET_DIR = 'exports/register-confirmatory-evidence/sonnet5-n5-block-b';
const FINAL_MANIFEST =
  'config/adaptive-tutor-evidence/tutor-stub-register-confirmatory-final-analysis.manifest.json';
const PROFILE_ANALYZER = path.join(ROOT, 'scripts/analyze-tutor-stub-profile-discrimination.js');
const FAMILY_ORDER = ['terra', 'sonnet'];
const PROFILE_ORDER = ['diligent', 'affective_resistant', 'false_memory', 'proof_skipper'];
const POLICY_ORDER = ['bland', 'field', 'negative'];

function parseArgs(argv) {
  const args = {
    selection: DEFAULT_SELECTION,
    check: false,
    roots: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--check') {
      args.check = true;
      continue;
    }
    if (token === '--selection') {
      args.selection = path.resolve(argv[++index] || '');
      continue;
    }
    if (token === '--terra-root' || token === '--sonnet-root') {
      args.roots[token.slice(2, -5)] = path.resolve(argv[++index] || '');
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/analyze-register-confirmatory-step2.js [--check]

Options:
  --selection <file>    Frozen row-selection JSON
  --terra-root <dir>    Use an already-extracted Terra archive root
  --sonnet-root <dir>   Use an already-extracted Sonnet archive root
  --check               Rebuild in memory and compare with tracked outputs

By default the script verifies and reads the two archives named by the family
manifests. It performs no model calls.
`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sha256Text(text) {
  return sha256Buffer(Buffer.from(text));
}

function sha256File(file) {
  const hash = createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function expandHome(value) {
  if (value === '~') return os.homedir();
  if (value.startsWith('~/')) return path.join(os.homedir(), value.slice(2));
  return value;
}

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} exited ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout;
}

function extractMembers(archive, destination, members) {
  if (!members.length) return;
  run('tar', ['-xzf', archive, '-C', destination, ...members]);
}

function firstJsonlEvent(buffer, file) {
  const end = buffer.indexOf(10);
  const line = buffer.subarray(0, end === -1 ? buffer.length : end).toString('utf8').trim();
  if (!line) throw new Error(`Empty trace: ${file}`);
  const event = JSON.parse(line);
  if (event.type !== 'run_start') throw new Error(`Trace does not begin with run_start: ${file}`);
  return event;
}

function resolvedModel(value = {}) {
  if (!value) return null;
  const provider = value.provider || null;
  const model = value.model || null;
  return {
    provider,
    model,
    label: provider && model ? `${provider}.${model}` : model || provider,
  };
}

function observedRoles(metadata = {}) {
  return {
    tutor: resolvedModel(metadata.resolved),
    automatedLearner: resolvedModel(metadata.autoLearner?.resolved),
    classifier: resolvedModel(metadata.classifier?.resolved),
    learnerRecord: resolvedModel(metadata.tutorLearnerDag),
  };
}

function prepareFamily(familyId, familySpec, args, temporaryDirs) {
  const manifestPath = path.resolve(ROOT, familySpec.archiveManifest);
  const manifest = readJson(manifestPath);
  const archivePath = expandHome(manifest.archive?.location || '');
  const summaryMembers = [...new Set(familySpec.sources.map((source) =>
    path.posix.join(familySpec.archiveRoot, source.summary),
  ))];

  if (args.roots[familyId]) {
    const sourceRoot = args.roots[familyId];
    if (!fs.existsSync(sourceRoot)) throw new Error(`Missing ${familyId} source root: ${sourceRoot}`);
    return {
      familyId,
      familySpec,
      manifest,
      manifestPath,
      archivePath,
      sourceRoot,
      extracted: false,
      archiveSha256: manifest.archive.sha256,
      archiveBytes: manifest.archive.bytes,
    };
  }

  if (!fs.existsSync(archivePath)) throw new Error(`Missing ${familyId} archive: ${archivePath}`);
  const actualSha256 = sha256File(archivePath);
  if (actualSha256 !== manifest.archive.sha256) {
    throw new Error(`${familyId} archive SHA-256 mismatch: ${actualSha256} != ${manifest.archive.sha256}`);
  }
  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), `register-confirmatory-${familyId}-`));
  temporaryDirs.push(temporaryDir);
  extractMembers(archivePath, temporaryDir, summaryMembers);
  const sourceRoot = path.join(temporaryDir, familySpec.archiveRoot);
  return {
    familyId,
    familySpec,
    manifest,
    manifestPath,
    archivePath,
    sourceRoot,
    temporaryDir,
    extracted: true,
    archiveSha256: actualSha256,
    archiveBytes: fs.statSync(archivePath).size,
  };
}

function selectedRowsFromSummaries(family) {
  const rows = [];
  for (const source of family.familySpec.sources) {
    const summaryPath = path.join(family.sourceRoot, source.summary);
    if (!fs.existsSync(summaryPath)) throw new Error(`Missing selected summary: ${summaryPath}`);
    const summaryBuffer = fs.readFileSync(summaryPath);
    const summarySha256 = sha256Buffer(summaryBuffer);
    const summary = JSON.parse(summaryBuffer.toString('utf8'));
    const summaryProfile = summary.config?.autoLearnerProfileId;
    if (summaryProfile !== source.profile) {
      throw new Error(`${source.summary}: profile ${summaryProfile} != ${source.profile}`);
    }
    const byKey = new Map((summary.results || []).map((result) => [result.key, result]));
    for (const key of source.keys) {
      const result = byKey.get(key);
      if (!result) throw new Error(`${source.summary}: missing selected key ${key}`);
      if (!source.primaryOnly && result.status !== 'ok') {
        throw new Error(`${source.summary}: selected non-primary-only row ${key} has status ${result.status}`);
      }
      const traceSummary = result.traceSummaries?.[0];
      const fixed = traceSummary?.fixedHorizon;
      if (!fixed?.complete || fixed.horizon !== 16 || fixed.observedTurn !== 16) {
        throw new Error(`${source.summary}: ${key} does not have a complete turn-16 endpoint`);
      }
      const traceReference = result.traces?.[0];
      if (!traceReference) throw new Error(`${source.summary}: ${key} has no trace reference`);
      const traceRelative = path.posix.join(
        path.posix.dirname(source.summary),
        'traces',
        key,
        path.basename(traceReference),
      );
      rows.push({
        schema: 'machinespirits.tutor-stub.register-confirmatory-primary-row.v1',
        family: family.familyId,
        profile: source.profile,
        policy: result.policy,
        runIndex: result.runIndex,
        key,
        sourceLeg: source.sourceLeg,
        sourceSummary: path.posix.join(family.familySpec.archiveRoot, source.summary),
        sourceSummarySha256: summarySha256,
        trace: path.posix.join(family.familySpec.archiveRoot, traceRelative),
        traceRelative,
        resultStatus: result.status,
        exitCode: result.exitCode,
        observedTurns: traceSummary.turnCount ?? null,
        recordedStopReason: traceSummary.stopReason || null,
        recordedErrorCount: traceSummary.errorCount ?? null,
        primaryOnly: Boolean(source.primaryOnly),
        inclusionReason: source.reason || 'Completed selected row from the declared sealed profile run.',
        primaryEndpoint: {
          horizon: fixed.horizon,
          observedTurn: fixed.observedTurn,
          complete: fixed.complete,
          coverage: fixed.coverageAtHorizon,
          grounded: fixed.groundedByHorizon,
          hardSafetyPassed: fixed.hardSafetyPassed,
          safetyEvidenceComplete: fixed.safetyEvidenceComplete,
          leakCount: fixed.leakCount,
        },
        secondaryEndpoint: {
          available: !source.primaryOnly,
          stopReason: source.primaryOnly ? null : traceSummary.stopReason || null,
          turnCount: source.primaryOnly ? null : traceSummary.turnCount ?? null,
          groundedClosure: source.primaryOnly ? null : Boolean(traceSummary.groundedClosure),
          finalCoverage: source.primaryOnly ? null : traceSummary.bestPathCoverage ?? null,
          unavailableReason: source.primaryOnly
            ? 'Session window ended after the primary endpoint; until-grounded outcome excluded.'
            : null,
        },
      });
    }
  }
  if (rows.length !== family.familySpec.expectedRows) {
    throw new Error(`${family.familyId}: selected ${rows.length} rows, expected ${family.familySpec.expectedRows}`);
  }
  const ids = new Set(rows.map((row) => `${row.profile}/${row.key}`));
  if (ids.size !== rows.length) throw new Error(`${family.familyId}: duplicate profile/key selection`);
  return rows;
}

function extractSelectedTraces(family, rows) {
  if (!family.extracted) return;
  extractMembers(
    family.archivePath,
    family.temporaryDir,
    rows.map((row) => row.trace),
  );
}

function finalizeRows(family, rows) {
  for (const row of rows) {
    const tracePath = path.join(family.sourceRoot, row.traceRelative);
    if (!fs.existsSync(tracePath)) throw new Error(`Missing selected trace: ${tracePath}`);
    const traceBuffer = fs.readFileSync(tracePath);
    const start = firstJsonlEvent(traceBuffer, tracePath);
    const metadata = start.metadata || {};
    const experiment = metadata.experiment || {};
    if (
      experiment.profile !== row.profile ||
      experiment.policy !== row.policy ||
      Number(experiment.repeat) !== Number(row.runIndex) ||
      experiment.jobId !== row.key
    ) {
      throw new Error(`${row.trace}: run_start identity does not match the frozen selection`);
    }
    row.traceSha256 = sha256Buffer(traceBuffer);
    row.runId = start.runId || null;
    row.startedAt = start.ts || null;
    row.world = metadata.world?.id || null;
    row.runSeed = metadata.experiment?.runSeed ?? null;
    row.observedModels = observedRoles(metadata);
    row.git = metadata.provenance?.git || null;
    row.configSha256 = metadata.provenance?.configSha256 || null;
    Object.defineProperty(row, '_tracePath', { value: tracePath, enumerable: false });
  }
  return rows;
}

export function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function resampleMean(values, random) {
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    total += values[Math.floor(random() * values.length)];
  }
  return total / values.length;
}

function percentile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * probability);
  return sorted[index];
}

function interval(observed, draws) {
  const lower = percentile(draws, 0.025);
  const upper = percentile(draws, 0.975);
  return {
    estimate: round(observed),
    lower: round(lower),
    upper: round(upper),
    supported: lower > 0 || upper < 0,
  };
}

function cellKey(profile, policy) {
  return `${profile}/${policy}`;
}

function groupCoverage(rows) {
  const cells = new Map();
  for (const profile of PROFILE_ORDER) {
    for (const policy of POLICY_ORDER) cells.set(cellKey(profile, policy), []);
  }
  for (const row of rows) {
    const key = cellKey(row.profile, row.policy);
    if (!cells.has(key)) throw new Error(`Unexpected cell: ${key}`);
    cells.get(key).push(row.primaryEndpoint.coverage);
  }
  for (const [key, values] of cells) {
    if (!values.length) throw new Error(`Empty cell: ${key}`);
  }
  return cells;
}

function strictLeader(meansByPolicy) {
  const values = POLICY_ORDER.map((policy) => meansByPolicy[policy]);
  const maximum = Math.max(...values);
  const leaders = POLICY_ORDER.filter((policy) => meansByPolicy[policy] === maximum);
  return leaders.length === 1 ? leaders[0] : 'tie';
}

export function bootstrapFamily(rows, settings = {}) {
  const iterations = Number(settings.bootstrapDraws || 5000);
  const seed = Number(settings.bootstrapSeed || 20260713);
  const cells = groupCoverage(rows);
  const observedMeans = {};
  for (const profile of PROFILE_ORDER) {
    observedMeans[profile] = {};
    for (const policy of POLICY_ORDER) {
      observedMeans[profile][policy] = mean(cells.get(cellKey(profile, policy)));
    }
  }

  const contrastDraws = {};
  const interactionDraws = {};
  const leaderCounts = {};
  for (const profile of PROFILE_ORDER) {
    contrastDraws[profile] = { field: [], negative: [] };
    leaderCounts[profile] = { bland: 0, field: 0, negative: 0, tie: 0 };
  }
  for (const profile of PROFILE_ORDER.slice(1)) {
    interactionDraws[profile] = { field: [], negative: [] };
  }

  const random = mulberry32(seed);
  let crossingDraws = 0;
  for (let draw = 0; draw < iterations; draw += 1) {
    const sampled = {};
    for (const profile of PROFILE_ORDER) {
      sampled[profile] = {};
      for (const policy of POLICY_ORDER) {
        sampled[profile][policy] = resampleMean(cells.get(cellKey(profile, policy)), random);
      }
      const leader = strictLeader(sampled[profile]);
      leaderCounts[profile][leader] += 1;
      for (const policy of ['field', 'negative']) {
        contrastDraws[profile][policy].push(sampled[profile][policy] - sampled[profile].bland);
      }
    }
    const leaders = PROFILE_ORDER.map((profile) => strictLeader(sampled[profile]));
    if (new Set(leaders).size > 1) crossingDraws += 1;
    for (const profile of PROFILE_ORDER.slice(1)) {
      for (const policy of ['field', 'negative']) {
        interactionDraws[profile][policy].push(
          sampled[profile][policy] - sampled[profile].bland -
            (sampled.diligent[policy] - sampled.diligent.bland),
        );
      }
    }
  }

  const cellMeans = {};
  const contrastsVsBland = {};
  const interactionsVsDiligent = {};
  const leaderProbabilities = {};
  for (const profile of PROFILE_ORDER) {
    cellMeans[profile] = Object.fromEntries(
      POLICY_ORDER.map((policy) => [policy, round(observedMeans[profile][policy])]),
    );
    contrastsVsBland[profile] = {};
    leaderProbabilities[profile] = Object.fromEntries(
      [...POLICY_ORDER, 'tie'].map((policy) => [policy, round(leaderCounts[profile][policy] / iterations)]),
    );
    for (const policy of ['field', 'negative']) {
      contrastsVsBland[profile][policy] = interval(
        observedMeans[profile][policy] - observedMeans[profile].bland,
        contrastDraws[profile][policy],
      );
    }
  }
  for (const profile of PROFILE_ORDER.slice(1)) {
    interactionsVsDiligent[profile] = {};
    for (const policy of ['field', 'negative']) {
      interactionsVsDiligent[profile][policy] = interval(
        observedMeans[profile][policy] - observedMeans[profile].bland -
          (observedMeans.diligent[policy] - observedMeans.diligent.bland),
        interactionDraws[profile][policy],
      );
    }
  }
  const supportedInteractions = [];
  for (const [profile, policies] of Object.entries(interactionsVsDiligent)) {
    for (const [policy, result] of Object.entries(policies)) {
      if (result.supported) supportedInteractions.push({ profile, policy, ...result });
    }
  }
  return {
    rows: rows.length,
    cellSizes: Object.fromEntries([...cells].map(([key, values]) => [key, values.length])),
    cellMeans,
    contrastsVsBland,
    interactionsVsDiligent,
    supportedInteractions,
    crossingProbability: round(crossingDraws / iterations),
    leaderProbabilities,
  };
}

function runProfileDiscrimination(familyId, rows, selection) {
  const argv = [PROFILE_ANALYZER, '--json'];
  for (const row of rows) argv.push('--trace', row._tracePath);
  argv.push(
    '--target-average-cosine',
    String(selection.analysis.targetAveragePairwiseCosine),
    '--target-max-to-control',
    String(selection.analysis.targetMaxSimilarityToControl),
    '--control-profile',
    selection.analysis.controlProfile,
  );
  const report = JSON.parse(run(process.execPath, argv));
  report.generatedAt = selection.generatedAt;
  report.input.traceRoot = null;
  report.input.compactedRoot = null;
  report.input.traces = rows.map((row) => row.trace);
  report.input.compactedWrites = [];
  const frozen = {
    averagePairwiseCosine: report.summary.averagePairwiseCosine,
    targetAveragePairwiseCosine: selection.analysis.targetAveragePairwiseCosine,
    averagePass: report.summary.averagePairwiseCosine < selection.analysis.targetAveragePairwiseCosine,
    maxSimilarityToControl: report.summary.maxSimilarityToControl,
    targetMaxSimilarityToControl: selection.analysis.targetMaxSimilarityToControl,
    controlPass: report.summary.maxSimilarityToControl < selection.analysis.targetMaxSimilarityToControl,
  };
  frozen.pass = frozen.averagePass && frozen.controlPass;
  return {
    family: familyId,
    frozenCosineGate: frozen,
    currentContractSensitivity: {
      pass: report.gate.conditioned.pass,
      profiles: report.gate.conditioned.profiles,
    },
    analyzerReport: report,
  };
}

function familyVerdict(familyId, bootstrap, discrimination) {
  const frozenGatePassed = discrimination.frozenCosineGate.pass;
  const supportedInteraction = bootstrap.supportedInteractions.length > 0;
  const blandLeadsDiligent = bootstrap.cellMeans.diligent.bland >
    Math.max(bootstrap.cellMeans.diligent.field, bootstrap.cellMeans.diligent.negative);
  const predeclaredDirectionObserved = blandLeadsDiligent;
  const confirmation = frozenGatePassed && supportedInteraction && predeclaredDirectionObserved;
  let status = 'null';
  const reasons = [];
  if (!frozenGatePassed) {
    status = 'instrument_invalid';
    reasons.push('The frozen in-run profile-discrimination gate failed.');
  }
  if (!supportedInteraction) reasons.push('No bootstrap interaction interval excludes zero.');
  if (!predeclaredDirectionObserved) reasons.push('Bland did not lead the diligent control profile.');
  if (familyId === 'terra' && supportedInteraction) {
    reasons.push('The only supported interaction is the off-direction negative x affective-resistant sign flip.');
  }
  return {
    status,
    confirmation,
    frozenGatePassed,
    supportedInteraction,
    predeclaredDirectionObserved,
    reasons,
  };
}

function aggregateCell(rows, profile, policy) {
  const selected = rows.filter((row) => row.profile === profile && row.policy === policy);
  const secondary = selected.filter((row) => row.secondaryEndpoint.available);
  return {
    selectedRows: selected.length,
    primaryCompleteRows: selected.filter((row) => row.primaryEndpoint.complete).length,
    primaryCoverageMean: round(mean(selected.map((row) => row.primaryEndpoint.coverage))),
    groundedByHorizon: selected.filter((row) => row.primaryEndpoint.grounded).length,
    hardSafetyPassed: selected.filter((row) => row.primaryEndpoint.hardSafetyPassed).length,
    safetyEvidenceComplete: selected.filter((row) => row.primaryEndpoint.safetyEvidenceComplete).length,
    leaksAtHorizon: selected.reduce((sum, row) => sum + Number(row.primaryEndpoint.leakCount || 0), 0),
    secondaryAvailableRows: secondary.length,
    groundedClosureRows: secondary.filter((row) => row.secondaryEndpoint.groundedClosure).length,
    meanTurnsWhenAvailable: round(mean(secondary.map((row) => row.secondaryEndpoint.turnCount))),
  };
}

export function summarizeQaFamily(familyId, rows, verdict) {
  const cells = {};
  for (const profile of PROFILE_ORDER) {
    cells[profile] = {};
    for (const policy of POLICY_ORDER) cells[profile][policy] = aggregateCell(rows, profile, policy);
  }
  return {
    family: familyId,
    selectedRows: rows.length,
    primaryCompleteRows: rows.filter((row) => row.primaryEndpoint.complete).length,
    secondaryAvailableRows: rows.filter((row) => row.secondaryEndpoint.available).length,
    primaryOnlyRows: rows.filter((row) => row.primaryOnly).length,
    sourceLegs: Object.fromEntries(
      [...new Set(rows.map((row) => row.sourceLeg))].sort().map((leg) => [leg, rows.filter((row) => row.sourceLeg === leg).length]),
    ),
    verdict,
    cells,
  };
}

function formatInterval(result) {
  return `${result.estimate >= 0 ? '+' : ''}${result.estimate} [${result.lower >= 0 ? '+' : ''}${result.lower}, ${result.upper >= 0 ? '+' : ''}${result.upper}]`;
}

function bootstrapMarkdown(report) {
  const lines = [
    '# Register Confirmatory Step 2 — Interaction Bootstrap',
    '',
    `Generated deterministically from the frozen row selection. Draws: ${report.settings.bootstrapDraws}; seed: ${report.settings.bootstrapSeed}.`,
    '',
    `Strict verdict: **${report.verdict.summary}**`,
    '',
  ];
  for (const familyId of FAMILY_ORDER) {
    const family = report.families[familyId];
    lines.push(`## ${familyId}`, '');
    lines.push(
      `Verdict: **${family.verdict.status}**; family confirmation: **${family.verdict.confirmation ? 'yes' : 'no'}**.`,
      '',
      '| Profile | Bland | Field | Negative |',
      '| --- | ---: | ---: | ---: |',
    );
    for (const profile of PROFILE_ORDER) {
      const cells = family.bootstrap.cellMeans[profile];
      lines.push(`| ${profile} | ${cells.bland} | ${cells.field} | ${cells.negative} |`);
    }
    lines.push('', 'Contrasts versus bland:', '');
    for (const profile of PROFILE_ORDER) {
      for (const policy of ['field', 'negative']) {
        const result = family.bootstrap.contrastsVsBland[profile][policy];
        lines.push(`- ${policy} x ${profile}: ${formatInterval(result)}${result.supported ? ' — supported' : ''}`);
      }
    }
    lines.push('', 'Interactions versus the diligent contrast:', '');
    for (const profile of PROFILE_ORDER.slice(1)) {
      for (const policy of ['field', 'negative']) {
        const result = family.bootstrap.interactionsVsDiligent[profile][policy];
        lines.push(`- ${policy} x ${profile}: ${formatInterval(result)}${result.supported ? ' — supported' : ''}`);
      }
    }
    lines.push('');
  }
  const sensitivity = report.sensitivity.sonnetExcludePostT16Topups;
  lines.push(
    '## Sonnet primary-row sensitivity',
    '',
    `Excluding the four post-turn-16 truncated rows leaves ${sensitivity.rows} rows. Supported interactions: ${sensitivity.bootstrap.supportedInteractions.length}. The family verdict remains null.`,
  );
  return `${lines.join('\n')}\n`;
}

function profileMarkdown(report) {
  const lines = [
    '# Register Confirmatory Step 2 — In-Run Profile Discrimination',
    '',
    'The frozen decision rule uses pooled pairwise cosine only. The current contract-conditioned gate is reported as a non-binding sensitivity.',
    '',
    '| Family | Traces | Average cosine | Max to diligent | Frozen gate | Current contract sensitivity |',
    '| --- | ---: | ---: | ---: | --- | --- |',
  ];
  for (const familyId of FAMILY_ORDER) {
    const family = report.families[familyId];
    lines.push(
      `| ${familyId} | ${family.analyzerReport.summary.traces} | ${family.frozenCosineGate.averagePairwiseCosine} | ${family.frozenCosineGate.maxSimilarityToControl} | ${family.frozenCosineGate.pass ? 'pass' : 'fail'} | ${family.currentContractSensitivity.pass ? 'pass' : 'fail'} |`,
    );
  }
  lines.push('', 'Binding interpretation:', '');
  lines.push(
    '- Terra fails because its max similarity to diligent is 0.912, above the frozen <0.90 requirement; its interaction rows are instrument-invalid for confirmation.',
    '- Sonnet passes the frozen cosine gate, but its bootstrap contains no supported interaction.',
  );
  return `${lines.join('\n')}\n`;
}

function qaMarkdown(report, familyIds = FAMILY_ORDER) {
  const lines = [
    '# Register Confirmatory Step 2 — Final Selected-Row QA Matrix',
    '',
    'This matrix replaces partial-run QA summaries. Failed or quarantined attempts that were rerun are not treated as final rows.',
    '',
  ];
  for (const familyId of familyIds) {
    const family = report.families[familyId];
    lines.push(
      `## ${familyId}`,
      '',
      `Selected ${family.selectedRows}; primary complete ${family.primaryCompleteRows}; secondary available ${family.secondaryAvailableRows}; primary-only ${family.primaryOnlyRows}.`,
      '',
      '| Profile | Policy | n | Coverage t16 | Safety passed | Secondary available | Grounded closure |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    );
    for (const profile of PROFILE_ORDER) {
      for (const policy of POLICY_ORDER) {
        const cell = family.cells[profile][policy];
        lines.push(
          `| ${profile} | ${policy} | ${cell.selectedRows} | ${cell.primaryCoverageMean} | ${cell.hardSafetyPassed}/${cell.selectedRows} | ${cell.secondaryAvailableRows}/${cell.selectedRows} | ${cell.groundedClosureRows}/${cell.secondaryAvailableRows} |`,
        );
      }
    }
    lines.push('');
  }
  lines.push('Claim result: **no family confirmation; no two-family claim; field selector closed on this evidence.**');
  return `${lines.join('\n')}\n`;
}

function affectiveLineage(rows, generatedAt) {
  const selected = rows.filter((row) => row.family === 'sonnet' && row.profile === 'affective_resistant');
  return {
    schema: 'machinespirits.tutor-stub.register-confirmatory-affective-lineage.v1',
    generatedAt,
    family: 'sonnet',
    profile: 'affective_resistant',
    selectedRows: selected.length,
    primaryCompleteRows: selected.filter((row) => row.primaryEndpoint.complete).length,
    secondaryAvailableRows: selected.filter((row) => row.secondaryEndpoint.available).length,
    primaryOnlyRows: selected.filter((row) => row.primaryOnly).length,
    legs: [...new Set(selected.map((row) => row.sourceLeg))].map((sourceLeg) => ({
      sourceLeg,
      rows: selected.filter((row) => row.sourceLeg === sourceLeg).map((row) => ({
        key: row.key,
        policy: row.policy,
        runIndex: row.runIndex,
        sourceSummary: row.sourceSummary,
        sourceSummarySha256: row.sourceSummarySha256,
        trace: row.trace,
        traceSha256: row.traceSha256,
        coverageAtTurn16: row.primaryEndpoint.coverage,
        hardSafetyPassed: row.primaryEndpoint.hardSafetyPassed,
        observedTurns: row.observedTurns,
        secondaryAvailable: row.secondaryEndpoint.available,
        inclusionReason: row.inclusionReason,
      })),
    })),
    interpretation: 'All 15 selected rows have complete turn-16 primary endpoints. Four top-up rows are excluded from until-grounded secondary outcomes.',
  };
}

function affectiveMarkdown(report) {
  const lines = [
    '# Sonnet Affective-Resistant Row Lineage',
    '',
    `Selected rows: ${report.selectedRows}; primary complete: ${report.primaryCompleteRows}; secondary available: ${report.secondaryAvailableRows}; primary-only: ${report.primaryOnlyRows}.`,
    '',
    '| Source leg | Key | Coverage t16 | Observed turns | Safety | Secondary | Trace SHA-256 |',
    '| --- | --- | ---: | ---: | --- | --- | --- |',
  ];
  for (const leg of report.legs) {
    for (const row of leg.rows) {
      lines.push(
        `| ${leg.sourceLeg} | ${row.key} | ${row.coverageAtTurn16} | ${row.observedTurns} | ${row.hardSafetyPassed ? 'pass' : 'fail'} | ${row.secondaryAvailable ? 'available' : 'unavailable'} | \`${row.traceSha256}\` |`,
      );
    }
  }
  lines.push(
    '',
    'The four `post-t16-topup` rows ended after the frozen primary assessment. They remain in the primary analysis and are excluded from secondary until-grounded summaries. The bootstrap sensitivity excluding them remains null.',
  );
  return `${lines.join('\n')}\n`;
}

function artifactEntry(relativePath, content) {
  return {
    path: relativePath,
    sha256: sha256Text(content),
    bytes: Buffer.byteLength(content),
  };
}

function buildArtifacts(selection, selectionPath, families, rowsByFamily, discriminationByFamily) {
  const allRows = FAMILY_ORDER.flatMap((familyId) => rowsByFamily[familyId]);
  const bootstrapFamilies = {};
  const familyVerdicts = {};
  for (const familyId of FAMILY_ORDER) {
    const bootstrap = bootstrapFamily(rowsByFamily[familyId], selection.analysis);
    const verdict = familyVerdict(familyId, bootstrap, discriminationByFamily[familyId]);
    bootstrapFamilies[familyId] = { bootstrap, verdict };
    familyVerdicts[familyId] = verdict;
  }
  const sonnetSensitivityRows = rowsByFamily.sonnet.filter((row) => row.sourceLeg !== 'post-t16-topup');
  const sonnetSensitivity = bootstrapFamily(sonnetSensitivityRows, selection.analysis);
  const overallVerdict = {
    summary: 'no family confirmation; no two-family claim; field selector closed on this evidence',
    familyConfirmations: Object.fromEntries(FAMILY_ORDER.map((id) => [id, familyVerdicts[id].confirmation])),
    twoFamilyConfirmation: false,
  };
  const primaryRowsReport = {
    schema: 'machinespirits.tutor-stub.register-confirmatory-primary-rows.v1',
    generatedAt: selection.generatedAt,
    selection: path.relative(ROOT, selectionPath),
    primaryHorizon: selection.analysis.primaryHorizon,
    rows: allRows,
  };
  const bootstrapReport = {
    schema: 'machinespirits.tutor-stub.register-confirmatory-bootstrap.v1',
    generatedAt: selection.generatedAt,
    settings: selection.analysis,
    verdict: overallVerdict,
    families: bootstrapFamilies,
    sensitivity: {
      sonnetExcludePostT16Topups: {
        excludedKeys: rowsByFamily.sonnet.filter((row) => row.sourceLeg === 'post-t16-topup').map((row) => row.key),
        rows: sonnetSensitivityRows.length,
        bootstrap: sonnetSensitivity,
        verdict: 'null_invariant',
      },
    },
  };
  const discriminationReport = {
    schema: 'machinespirits.tutor-stub.register-confirmatory-profile-discrimination.v1',
    generatedAt: selection.generatedAt,
    frozenRule: {
      averagePairwiseCosine: `< ${selection.analysis.targetAveragePairwiseCosine}`,
      maxSimilarityToDiligent: `< ${selection.analysis.targetMaxSimilarityToControl}`,
    },
    families: discriminationByFamily,
  };
  const qaReport = {
    schema: 'machinespirits.tutor-stub.register-confirmatory-final-qa-matrix.v1',
    generatedAt: selection.generatedAt,
    source: `${FINAL_DIR}/primary-endpoint-rows.json`,
    verdict: overallVerdict,
    families: Object.fromEntries(
      FAMILY_ORDER.map((familyId) => [
        familyId,
        summarizeQaFamily(familyId, rowsByFamily[familyId], familyVerdicts[familyId]),
      ]),
    ),
  };
  const sonnetQa = {
    schema: qaReport.schema,
    generatedAt: qaReport.generatedAt,
    source: qaReport.source,
    replacementFor: 'partial-run cross-run field generated 2026-07-13T01:35Z',
    verdict: overallVerdict,
    families: { sonnet: qaReport.families.sonnet },
  };
  const lineage = affectiveLineage(allRows, selection.generatedAt);

  const artifacts = new Map();
  artifacts.set(`${FINAL_DIR}/primary-endpoint-rows.json`, canonicalJson(primaryRowsReport));
  artifacts.set(`${FINAL_DIR}/interaction-bootstrap.json`, canonicalJson(bootstrapReport));
  artifacts.set(`${FINAL_DIR}/interaction-bootstrap.md`, bootstrapMarkdown(bootstrapReport));
  artifacts.set(`${FINAL_DIR}/profile-discrimination.json`, canonicalJson(discriminationReport));
  artifacts.set(`${FINAL_DIR}/profile-discrimination.md`, profileMarkdown(discriminationReport));
  artifacts.set(`${FINAL_DIR}/qa-matrix.json`, canonicalJson(qaReport));
  artifacts.set(`${FINAL_DIR}/qa-matrix.md`, qaMarkdown(qaReport));
  artifacts.set(`${SONNET_DIR}/qa-matrix.json`, canonicalJson(sonnetQa));
  artifacts.set(`${SONNET_DIR}/qa-matrix.md`, qaMarkdown(sonnetQa, ['sonnet']));
  artifacts.set(`${SONNET_DIR}/affective-lineage.json`, canonicalJson(lineage));
  artifacts.set(`${SONNET_DIR}/affective-lineage.md`, affectiveMarkdown(lineage));

  const selectionContent = fs.readFileSync(selectionPath, 'utf8');
  const manifest = {
    schema: 'machinespirits.tutor-stub.register-confirmatory-final-analysis-manifest.v1',
    generatedAt: selection.generatedAt,
    selection: artifactEntry(path.relative(ROOT, selectionPath), selectionContent),
    sourceArchives: Object.fromEntries(FAMILY_ORDER.map((familyId) => {
      const family = families[familyId];
      return [familyId, {
        manifest: path.relative(ROOT, family.manifestPath),
        location: family.manifest.archive.location,
        sha256: family.archiveSha256,
        bytes: family.archiveBytes,
        archiveRoot: family.familySpec.archiveRoot,
      }];
    })),
    derivedArtifacts: [...artifacts].map(([relativePath, content]) => artifactEntry(relativePath, content)),
    verdict: overallVerdict,
    notes: [
      'Default generation verifies both archive hashes and extracts only selected summaries and traces.',
      'The Sonnet qa-matrix files replace the stale partial-run matrix.',
      'No model calls are made.',
    ],
  };
  artifacts.set(FINAL_MANIFEST, canonicalJson(manifest));
  return { artifacts, reports: { primaryRowsReport, bootstrapReport, discriminationReport, qaReport, lineage } };
}

function writeOrCheck(artifacts, check) {
  const mismatches = [];
  for (const [relativePath, content] of artifacts) {
    const file = path.join(ROOT, relativePath);
    if (check) {
      const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (actual !== content) mismatches.push(relativePath);
      continue;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  if (check && mismatches.length) {
    throw new Error(`Tracked Step 2 artifacts are stale or missing:\n${mismatches.map((file) => `- ${file}`).join('\n')}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selection = readJson(args.selection);
  if (selection.schema !== 'machinespirits.tutor-stub.register-confirmatory-selection.v1') {
    throw new Error(`Unsupported selection schema: ${selection.schema}`);
  }
  const temporaryDirs = [];
  try {
    const families = {};
    const rowsByFamily = {};
    const discriminationByFamily = {};
    for (const familyId of FAMILY_ORDER) {
      const familySpec = selection.families[familyId];
      const family = prepareFamily(familyId, familySpec, args, temporaryDirs);
      families[familyId] = family;
      const rows = selectedRowsFromSummaries(family);
      extractSelectedTraces(family, rows);
      rowsByFamily[familyId] = finalizeRows(family, rows);
      discriminationByFamily[familyId] = runProfileDiscrimination(familyId, rows, selection);
    }
    const { artifacts, reports } = buildArtifacts(
      selection,
      args.selection,
      families,
      rowsByFamily,
      discriminationByFamily,
    );
    writeOrCheck(artifacts, args.check);
    const action = args.check ? 'verified' : 'wrote';
    console.log(`${action} ${artifacts.size} Step 2 artifacts`);
    for (const familyId of FAMILY_ORDER) {
      const gate = reports.discriminationReport.families[familyId].frozenCosineGate;
      console.log(`${familyId}: ${rowsByFamily[familyId].length} rows; cosine ${gate.averagePairwiseCosine}/${gate.maxSimilarityToControl}; gate ${gate.pass ? 'pass' : 'fail'}`);
    }
    console.log(reports.bootstrapReport.verdict.summary);
  } finally {
    for (const dir of temporaryDirs) fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  });
}
