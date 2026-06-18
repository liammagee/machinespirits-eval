#!/usr/bin/env node
/**
 * Read-only Path 3 trigger audit for learner-object ownership replay.
 *
 * Scans completed dramatic-derivation artifacts for first-pass runs where the
 * proof has closed but learner-object ownership remains incomplete in exactly
 * one declared family. It never launches a replay; it emits the narrow replay
 * command only when adding the ownership transfer gate would be an actionable
 * local check.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = path.join(ROOT, 'exports/dramatic-derivation');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/ownership-replay-candidate-audit');

function usage() {
  return `Usage:
  node scripts/audit-derivation-ownership-replay-candidates.js \\
    [--root exports/dramatic-derivation] \\
    [--out exports/dramatic-derivation/ownership-replay-candidate-audit] \\
    [--json]
`;
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

export function parseArgs(argv = []) {
  const opts = {
    root: DEFAULT_ROOT,
    out: DEFAULT_OUT,
    json: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (arg === '--root') {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for --root\n${usage()}`);
      opts.root = resolvePath(value);
      continue;
    }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for --out\n${usage()}`);
      opts.out = resolvePath(value);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeReadJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function rel(file) {
  return path.relative(ROOT, file);
}

function findResultFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stack = [root];
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current)) {
      const full = path.join(current, entry);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) stack.push(full);
      else if (entry === 'result.json') files.push(full);
    }
  }
  return files.sort();
}

function finalRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[rows.length - 1] : null;
}

function finiteTurn(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function finalD(result = {}) {
  const trajectory = Array.isArray(result.trajectory) ? result.trajectory : [];
  for (let i = trajectory.length - 1; i >= 0; i -= 1) {
    const value = Number(trajectory[i]?.D);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function pathKind(file, diagnosis = {}) {
  const normalized = rel(file).split(path.sep).join('/');
  if (diagnosis?.episode || normalized.includes('/episodes/')) return 'episode_replay';
  if (normalized.includes('/fresh-runs/') || normalized.includes('/runs/') || normalized.includes('/loop/')) {
    return 'first_pass';
  }
  return 'artifact';
}

function isMockArtifact({ file, label }) {
  return /(^|[-_/])mock([-_/]|$)/iu.test(`${rel(file)} ${label || ''}`);
}

function leakAuditOk(finalPost) {
  if (!finalPost) return null;
  const values = [finalPost.inputAuditOk, finalPost.nonLeakAuditOk].filter((value) => value !== undefined && value !== null);
  if (!values.length) return null;
  return values.every((value) => value === true);
}

function proofOrAssertionAvailable(result = {}, finalPost = null) {
  return (
    result.verdict === 'grounded_anagnorisis' ||
    finalPost?.finalAssertionAvailable === true ||
    finiteTurn(result.assertedGroundedTurn) !== null
  );
}

function recommendedReplayTurn(result = {}, finalPost = null) {
  return finiteTurn(result.firstForcedTurn) ?? finiteTurn(result.assertedGroundedTurn) ?? finiteTurn(finalPost?.turn) ?? 1;
}

function replayLabel(label, turn) {
  return `${label}-ownership-replay-from-t${turn}`;
}

function replayCommand({ dir, label, turn }) {
  return [
    'node scripts/run-derivation-episode.js',
    `  --from ${rel(dir)}`,
    `  --turn ${turn}`,
    '  --window 4',
    '  --ownership-proof on',
    '  --ownership-transfer-gate on',
    `  --label ${replayLabel(label, turn)}`,
    '  --out exports/dramatic-derivation/ownership-replay-gates',
  ].join(' \\\n');
}

export function analyzeArtifact(resultFile, { root = ROOT } = {}) {
  const dir = path.dirname(resultFile);
  const diagnosisFile = path.join(dir, 'diagnosis.json');
  const result = safeReadJson(resultFile);
  const diagnosis = safeReadJson(diagnosisFile);
  const label = diagnosis?.label || path.basename(dir);
  const finalPost = finalRow(result?.learnerTransformationPost);
  const missingFamilies = Array.isArray(finalPost?.missingFamilies) ? finalPost.missingFamilies : [];
  const kind = pathKind(resultFile, diagnosis || {});
  const isMock = isMockArtifact({ file: resultFile, label });
  const firstPass = kind === 'first_pass' && !diagnosis?.episode && !isMock;
  const hasDiagnosis = Boolean(diagnosis);
  const hasResult = Boolean(result);
  const ownershipInstrumented = Boolean(finalPost);
  const proofAvailable = proofOrAssertionAvailable(result, finalPost);
  const ownershipIncomplete = ownershipInstrumented && finalPost.complete !== true;
  const exactlyOneMissing = missingFamilies.length === 1;
  const missingNearTransfer = missingFamilies[0] === 'near_transfer';
  const ownershipTransferGate = diagnosis?.ownershipTransferGate === true;
  const triggerEligible =
    hasResult && hasDiagnosis && firstPass && proofAvailable && ownershipIncomplete && exactlyOneMissing;
  const actionableGateReplay = triggerEligible && missingNearTransfer && !ownershipTransferGate;
  const alreadyGatedFailure = triggerEligible && ownershipTransferGate;
  const turn = recommendedReplayTurn(result, finalPost);

  return {
    label,
    worldId: diagnosis?.worldId || result?.worldId || null,
    dir: rel(dir),
    resultFile: rel(resultFile),
    diagnosisFile: hasDiagnosis ? rel(diagnosisFile) : null,
    kind,
    firstPass,
    mock: isMock,
    hasResult,
    hasDiagnosis,
    verdict: result?.verdict || diagnosis?.verdict || null,
    turnsPlayed: finiteTurn(result?.turnsPlayed ?? diagnosis?.turnsPlayed),
    finalD: finalD(result),
    firstForcedTurn: finiteTurn(result?.firstForcedTurn ?? diagnosis?.firstForcedTurn),
    assertedGroundedTurn: finiteTurn(result?.assertedGroundedTurn ?? diagnosis?.assertedGroundedTurn),
    ownershipTransferGate,
    ownershipProof: diagnosis?.ownershipProof === true,
    ownershipInstrumented,
    finalOwnershipStatus: finalPost?.status || null,
    finalOwnershipComplete: finalPost?.complete === true,
    finalAssertionAvailable: finalPost?.finalAssertionAvailable === true,
    missingFamilies,
    leakAuditOk: leakAuditOk(finalPost),
    proofOrAssertionAvailable: proofAvailable,
    triggerEligible,
    actionableGateReplay,
    alreadyGatedFailure,
    recommendedReplayTurn: turn,
    replayCommand: actionableGateReplay ? replayCommand({ dir, label, turn }) : null,
    episodeSourceLabel: diagnosis?.episode?.source?.label || null,
    episodeSourceDir: diagnosis?.episode?.source?.dir || null,
    episodeOverrides: diagnosis?.episode?.overrides || [],
    episodePrefixOk: diagnosis?.episode?.prefixIntegrity?.ok ?? null,
  };
}

function normalizeDir(value) {
  return String(value || '').replace(/\/+$/u, '');
}

function attachExistingReplays(rows) {
  const episodeRows = rows.filter((row) => row.kind === 'episode_replay' && row.ownershipTransferGate);
  return rows.map((row) => {
    if (!row.actionableGateReplay && !row.alreadyGatedFailure) return row;
    const existingGateReplays = episodeRows
      .filter(
        (episode) =>
          episode.episodeSourceLabel === row.label || normalizeDir(episode.episodeSourceDir) === normalizeDir(row.dir),
      )
      .map((episode) => ({
        label: episode.label,
        dir: episode.dir,
        verdict: episode.verdict,
        finalOwnershipStatus: episode.finalOwnershipStatus,
        finalOwnershipComplete: episode.finalOwnershipComplete,
        missingFamilies: episode.missingFamilies,
        prefixOk: episode.episodePrefixOk,
      }));
    return { ...row, existingGateReplays };
  });
}

function count(rows, predicate) {
  return rows.filter(predicate).length;
}

export function buildAudit({ root = DEFAULT_ROOT } = {}) {
  const resultFiles = findResultFiles(root);
  const rows = attachExistingReplays(resultFiles.map((file) => analyzeArtifact(file, { root })));
  const triggerCandidates = rows.filter((row) => row.triggerEligible);
  const actionableGateCandidates = rows.filter((row) => row.actionableGateReplay);
  const alreadyGatedFailures = rows.filter((row) => row.alreadyGatedFailure);
  return {
    schema: 'dramatic-derivation.ownership-replay-candidate-audit.v0',
    generatedAt: new Date().toISOString(),
    root: rel(root),
    summary: {
      artifactsScanned: rows.length,
      withDiagnosis: count(rows, (row) => row.hasDiagnosis),
      firstPassOwnershipInstrumented: count(rows, (row) => row.firstPass && row.ownershipInstrumented),
      triggerCandidates: triggerCandidates.length,
      actionableGateCandidates: actionableGateCandidates.length,
      alreadyGatedFailures: alreadyGatedFailures.length,
    },
    triggerCandidates,
    actionableGateCandidates,
    alreadyGatedFailures,
    rows,
  };
}

function renderCandidateTable(rows) {
  const lines = [
    '| label | kind | gate | verdict | turns | forced | asserted | missing | existing gate replay |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |',
  ];
  for (const row of rows) {
    const replays = row.existingGateReplays?.length
      ? row.existingGateReplays
          .map(
            (replay) =>
              `${replay.label} (${replay.verdict}; ${replay.finalOwnershipStatus}; missing ${replay.missingFamilies.join(', ') || 'none'}; prefix ${replay.prefixOk === true ? 'ok' : 'n/a'})`,
          )
          .join('<br>')
      : 'none';
    lines.push(
      `| \`${row.label}\` | ${row.kind} | ${row.ownershipTransferGate ? 'on' : 'off'} | ${row.verdict || 'n/a'} | ${row.turnsPlayed ?? 'n/a'} | ${row.firstForcedTurn ?? 'n/a'} | ${row.assertedGroundedTurn ?? 'n/a'} | ${row.missingFamilies.join(', ') || 'none'} | ${replays} |`,
    );
  }
  return lines;
}

export function renderMarkdown(audit) {
  const lines = [];
  lines.push('# Ownership Replay Candidate Audit');
  lines.push('');
  lines.push(`Generated: ${audit.generatedAt}`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push('- Read-only scan of completed artifacts.');
  lines.push('- No replay or paid run launched by this script.');
  lines.push('- Path 3 trigger requires first-pass, non-mock, complete `result.json` plus `diagnosis.json`, proof grounded or final assertion available, incomplete ownership, and exactly one missing ownership family.');
  lines.push('- `actionableGateCandidates` further require the sole missing family to be `near_transfer` and the source run not already to have `--ownership-transfer-gate` enabled.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Artifacts scanned: ${audit.summary.artifactsScanned}.`);
  lines.push(`- Artifacts with diagnosis: ${audit.summary.withDiagnosis}.`);
  lines.push(`- First-pass ownership-instrumented artifacts: ${audit.summary.firstPassOwnershipInstrumented}.`);
  lines.push(`- Trigger candidates: ${audit.summary.triggerCandidates}.`);
  lines.push(`- Actionable gate candidates: ${audit.summary.actionableGateCandidates}.`);
  lines.push(`- Already-gated failures: ${audit.summary.alreadyGatedFailures}.`);
  lines.push('');
  lines.push('## Trigger Candidates');
  lines.push('');
  if (audit.triggerCandidates.length) lines.push(...renderCandidateTable(audit.triggerCandidates));
  else lines.push('No Path 3 trigger candidates found.');
  lines.push('');
  lines.push('## Actionable Gate Candidates');
  lines.push('');
  if (audit.actionableGateCandidates.length) {
    lines.push(...renderCandidateTable(audit.actionableGateCandidates));
    lines.push('');
    lines.push('### Replay Commands');
    lines.push('');
    for (const candidate of audit.actionableGateCandidates) {
      lines.push(`\`${candidate.label}\`:`);
      lines.push('');
      lines.push('```bash');
      lines.push(candidate.replayCommand);
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('No actionable gate candidates found.');
  }
  lines.push('## Interpretation');
  lines.push('');
  if (audit.actionableGateCandidates.length) {
    const alreadyChecked = audit.actionableGateCandidates.filter((row) => row.existingGateReplays?.length);
    if (alreadyChecked.length === audit.actionableGateCandidates.length) {
      lines.push(
        'Every actionable source already has at least one recorded ownership-transfer-gate replay. Do not launch a duplicate replay unless the existing replay is invalid or deliberately superseded.',
      );
    } else {
      lines.push('At least one actionable source lacks a recorded ownership-transfer-gate replay. Run only the first command above, then compare proof verdict, ownership, forced/asserted gap, prefix integrity, and leak audit.');
    }
  } else {
    lines.push('No source currently justifies Path 3 replay.');
  }
  if (audit.alreadyGatedFailures.length) {
    lines.push('');
    lines.push(
      'The audit also found already-gated failures. These are useful negative evidence for the gate, but they are not actionable tests of adding the gate because the gate was already enabled.',
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function writeReports(audit, outDir = DEFAULT_OUT) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonFile = path.join(outDir, 'report.json');
  const mdFile = path.join(outDir, 'report.md');
  fs.writeFileSync(jsonFile, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(mdFile, renderMarkdown(audit));
  return { jsonFile, mdFile };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  const audit = buildAudit({ root: opts.root });
  const files = writeReports(audit, opts.out);
  if (opts.json) {
    console.log(JSON.stringify(audit, null, 2));
    return;
  }
  console.log(`ownership replay candidate audit wrote ${rel(files.mdFile)}`);
  console.log(
    `triggerCandidates=${audit.summary.triggerCandidates} actionableGateCandidates=${audit.summary.actionableGateCandidates} alreadyGatedFailures=${audit.summary.alreadyGatedFailures}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  });
}
