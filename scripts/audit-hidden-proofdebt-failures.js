#!/usr/bin/env node
/**
 * Hidden+proofDebt failure audit.
 *
 * Reads frozen dramatic-derivation artifacts and reclassifies archived
 * non-grounding verdicts under the current D-aware stall detector. This script
 * never launches a run and never rewrites archived verdicts.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import { detectStall } from '../services/dramaticDerivation/slope.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_ROOT = 'exports/dramatic-derivation';
const DEFAULT_OUT = 'exports/dramatic-derivation/hidden-proofdebt-failure-audit';
const DEFAULT_WINDOW = 6;

function usage() {
  return `Usage: node scripts/audit-hidden-proofdebt-failures.js [options]

Options:
  --root <dir>      Artifact root to scan. Default: ${DEFAULT_ROOT}
  --out <dir>       Output directory. Default: ${DEFAULT_OUT}
  --window <n>      Fallback stall window if worldPath is missing. Default: ${DEFAULT_WINDOW}
  --json            Print JSON summary to stdout.
  --help            Show this help.
`;
}

function arg(args, name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
}

function has(args, name) {
  return args.includes(`--${name}`);
}

function resolveRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function safeReadJson(file) {
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function findDiagnosisFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const full = path.join(current, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (entry === 'diagnosis.json') {
        out.push(full);
      }
    }
  }
  return out.sort();
}

export function isHiddenProofDebtDiagnosis(diagnosis) {
  return (
    diagnosis?.pacingGuard === true &&
    diagnosis?.proofDebtGuard === true &&
    diagnosis?.pacingGuardVisible !== true &&
    diagnosis?.pacingGuardSelectiveV4 !== true
  );
}

function artifactKind(file) {
  const normalized = file.split(path.sep).join('/');
  if (normalized.includes('/loop/')) return 'fresh_loop';
  if (normalized.includes('/episodes/')) return 'episode_replay';
  if (normalized.includes('/matrix/')) return 'matrix';
  if (normalized.includes('/phase')) return 'episode_replay';
  return 'artifact';
}

function trajectoryFrom(diagnosis, result) {
  if (Array.isArray(result?.trajectory)) return result.trajectory;
  if (Array.isArray(diagnosis?.dCurve)) {
    return diagnosis.dCurve.map((D, i) => ({ turn: i + 1, D, groundedCount: null, forced: D === 0 }));
  }
  return [];
}

function firstReleaseTurnFrom(result, diagnosis) {
  const ledgerTurn = result?.ledger?.[0]?.turn;
  if (Number.isFinite(ledgerTurn)) return ledgerTurn;
  const transcriptRelease = result?.transcript?.find((row) => row?.meta?.release)?.turn;
  if (Number.isFinite(transcriptRelease)) return transcriptRelease;
  const releaseDecision = diagnosis?.releaseDeviations?.decisions?.find((row) => row.played)?.turn;
  if (Number.isFinite(releaseDecision)) return releaseDecision;
  return Infinity;
}

function loadWorldForDiagnosis(diagnosis, fallbackWindow) {
  const worldPath = diagnosis?.worldPath;
  if (!worldPath) return { world: null, window: fallbackWindow, loadError: null };
  try {
    const world = loadWorld(resolveRoot(worldPath));
    return { world, window: world?.slope?.aporia_window || fallbackWindow, loadError: null };
  } catch (err) {
    return { world: null, window: fallbackWindow, loadError: err.message };
  }
}

function tailSummary(trajectory, window) {
  return trajectory
    .slice(-window)
    .map((entry) => `t${entry.turn}:D${entry.D}/g${entry.groundedCount ?? '?'}`)
    .join(' ');
}

function currentDetectorVerdict(trajectory, window, firstReleaseTurn) {
  if (!trajectory.length) return null;
  return detectStall(trajectory, window, firstReleaseTurn);
}

export function classifyHiddenProofDebtRow({ diagnosis, result = null, file = '', fallbackWindow = DEFAULT_WINDOW }) {
  const { window, loadError } = loadWorldForDiagnosis(diagnosis, fallbackWindow);
  const trajectory = trajectoryFrom(diagnosis, result);
  const firstReleaseTurn = firstReleaseTurnFrom(result, diagnosis);
  const currentStall = currentDetectorVerdict(trajectory, window, firstReleaseTurn);
  const archivedVerdict = diagnosis?.verdict || result?.verdict || 'unknown';
  const finalD =
    diagnosis?.finalD ??
    (Array.isArray(diagnosis?.dCurve) ? diagnosis.dCurve.at(-1) : null) ??
    (trajectory.length ? trajectory.at(-1).D : null);
  const nonGrounded = archivedVerdict !== 'grounded_anagnorisis';

  let currentClass = 'grounded';
  if (nonGrounded && currentStall) currentClass = 'current_detector_stall';
  else if (nonGrounded && (archivedVerdict === 'aporia' || archivedVerdict === 'disengagement')) {
    currentClass = 'stale_detector_artifact';
  } else if (nonGrounded && archivedVerdict === 'cap_reached') {
    currentClass = 'bounded_window_nonterminal';
  } else if (nonGrounded) {
    currentClass = 'other_archived_non_grounding';
  }

  const release = diagnosis?.releaseDeviations || {};
  const row = {
    label: diagnosis?.label || path.basename(path.dirname(file)),
    worldId: diagnosis?.worldId || result?.worldId || null,
    path: path.relative(ROOT, file),
    artifactKind: artifactKind(file),
    archivedVerdict,
    currentClass,
    currentStall,
    turnsPlayed: diagnosis?.turnsPlayed ?? result?.turnsPlayed ?? null,
    finalD,
    firstForcedTurn: diagnosis?.firstForcedTurn ?? result?.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis?.assertedGroundedTurn ?? result?.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis?.forcedToAssertedGap ?? null,
    conductPolicy: Boolean(diagnosis?.conductPolicy),
    conductPolicyEnforce: Boolean(diagnosis?.conductPolicyEnforce),
    replayPrefixOk: diagnosis?.episode?.prefixIntegrity?.ok ?? diagnosis?.episode?.ok ?? null,
    window,
    firstReleaseTurn: Number.isFinite(firstReleaseTurn) ? firstReleaseTurn : null,
    terminalTail: tailSummary(trajectory, window),
    releaseSummary: {
      turnsWithWindow: release.turnsWithWindow ?? null,
      played: release.played ?? null,
      onSchedule: release.onSchedule ?? null,
      early: release.early ?? null,
      held: release.held ?? null,
      invalidClaims: release.invalidClaims ?? null,
    },
    loadError,
  };
  row.cleanCurrentFailure = row.currentClass === 'current_detector_stall';
  row.replayCandidate = row.cleanCurrentFailure;
  return row;
}

export function summarizeAudit(rows) {
  const byClass = {};
  const byVerdict = {};
  const byWorld = {};
  for (const row of rows) {
    byClass[row.currentClass] = (byClass[row.currentClass] || 0) + 1;
    byVerdict[row.archivedVerdict] = (byVerdict[row.archivedVerdict] || 0) + 1;
    const world = row.worldId || 'unknown';
    byWorld[world] ||= { total: 0, grounded: 0, nonGrounded: 0, cleanCurrentFailures: 0 };
    byWorld[world].total += 1;
    if (row.archivedVerdict === 'grounded_anagnorisis') byWorld[world].grounded += 1;
    else byWorld[world].nonGrounded += 1;
    if (row.cleanCurrentFailure) byWorld[world].cleanCurrentFailures += 1;
  }
  const candidates = rows.filter((row) => row.replayCandidate);
  return {
    schema: 'dramatic-derivation.hidden-proofdebt-failure-audit.v0',
    generatedAt: new Date().toISOString(),
    rows: rows.length,
    byClass,
    byVerdict,
    byWorld,
    cleanCurrentFailures: candidates.length,
    replayCandidate: candidates[0] || null,
  };
}

function renderTable(rows) {
  const lines = [];
  lines.push('| world | label | artifact | archived verdict | current class | final D | turns | tail |');
  lines.push('|---|---|---|---|---|---:|---:|---|');
  for (const row of rows) {
    lines.push(
      `| ${row.worldId || '-'} | \`${row.label}\` | ${row.artifactKind} | ${row.archivedVerdict} | \`${row.currentClass}\` | ${row.finalD ?? '-'} | ${row.turnsPlayed ?? '-'} | \`${row.terminalTail || '-'}\` |`,
    );
  }
  return lines;
}

function renderWorldTable(summary) {
  const lines = [];
  lines.push('| world | total | grounded | archived non-grounded | clean current failures |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const [world, stats] of Object.entries(summary.byWorld).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `| ${world} | ${stats.total} | ${stats.grounded} | ${stats.nonGrounded} | ${stats.cleanCurrentFailures} |`,
    );
  }
  return lines;
}

export function renderMarkdown({ summary, rows, rootDir }) {
  const nonGrounded = rows.filter((row) => row.archivedVerdict !== 'grounded_anagnorisis');
  const stale = nonGrounded.filter((row) => row.currentClass === 'stale_detector_artifact');
  const bounded = nonGrounded.filter((row) => row.currentClass === 'bounded_window_nonterminal');
  const current = nonGrounded.filter((row) => row.currentClass === 'current_detector_stall');

  const lines = [];
  lines.push('# Hidden+ProofDebt Failure Audit');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push('- Zero-paid frozen-artifact audit.');
  lines.push('- No runs launched.');
  lines.push('- Archived verdicts are preserved; this report adds a current-detector interpretation beside them.');
  lines.push(
    '- Scope is hidden+proofDebt: `pacingGuard=true`, `proofDebtGuard=true`, visible guard off, selector-v4 off.',
  );
  lines.push(`- Artifact root scanned: \`${path.relative(ROOT, rootDir)}\`.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Hidden+proofDebt artifacts found: ${summary.rows}.`);
  lines.push(
    `- Archived verdicts: ${Object.entries(summary.byVerdict)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}.`,
  );
  lines.push(`- Current clean failures: ${summary.cleanCurrentFailures}.`);
  lines.push('');
  lines.push(...renderWorldTable(summary));
  lines.push('');
  lines.push('## Non-Grounded Artifacts');
  lines.push('');
  if (!nonGrounded.length) {
    lines.push('No archived non-grounding hidden+proofDebt artifacts found.');
  } else {
    lines.push(...renderTable(nonGrounded));
  }
  lines.push('');
  lines.push('## Current-Detector Classification');
  lines.push('');
  lines.push(`- Current detector stalls: ${current.length}.`);
  lines.push(`- Stale detector artifacts: ${stale.length}.`);
  lines.push(`- Bounded nonterminal replay windows: ${bounded.length}.`);
  lines.push('');
  if (stale.length) {
    lines.push(
      'Stale detector artifacts are archived `aporia`/`disengagement` rows whose terminal tail contains proof-distance progress under the current D-aware stall rule.',
    );
    lines.push('');
    lines.push(...renderTable(stale));
    lines.push('');
  }
  if (bounded.length) {
    lines.push(
      'Bounded nonterminal rows are replay/check windows that ended before the proof could resolve and did not trip the current stall detector.',
    );
    lines.push('');
    lines.push(...renderTable(bounded));
    lines.push('');
  }
  lines.push('## Interpretation');
  lines.push('');
  if (summary.cleanCurrentFailures === 0) {
    lines.push(
      'No clean current hidden+proofDebt failure was found. The serious archived failures reclassify as stale detector artifacts, and the remaining non-grounded rows are bounded replay windows rather than first-pass proof-controller failures.',
    );
    lines.push('');
    lines.push(
      'The implication is conservative: there is not yet a concrete action-choice case where an adaptive overlay can beat hidden+proofDebt rather than merely match it.',
    );
    lines.push('');
    lines.push('Do not launch a fresh paid validation from this audit alone.');
  } else {
    lines.push(
      `The audit found ${summary.cleanCurrentFailures} clean current failure(s). The first replay candidate is \`${summary.replayCandidate.label}\`; inspect it before designing any policy change.`,
    );
  }
  lines.push('');
  lines.push('## Recommended Next Step');
  lines.push('');
  if (summary.cleanCurrentFailures === 0) {
    lines.push(
      'Stop at the audit for now. If we need extra confidence, run at most one prefix-controlled replay as detector verification, not as adaptive-policy validation.',
    );
  } else {
    lines.push(
      'Run one prefix-controlled replay of the first clean current failure, preserving the prefix and changing only one candidate action or policy contour.',
    );
  }
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push('- `report.json`');
  lines.push('- `report.md`');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function buildAudit({ rootDir, fallbackWindow = DEFAULT_WINDOW }) {
  const diagnosisFiles = findDiagnosisFiles(rootDir);
  const rows = [];
  for (const file of diagnosisFiles) {
    const diagnosis = safeReadJson(file);
    if (!isHiddenProofDebtDiagnosis(diagnosis)) continue;
    const result = safeReadJson(path.join(path.dirname(file), 'result.json'));
    rows.push(classifyHiddenProofDebtRow({ diagnosis, result, file, fallbackWindow }));
  }
  rows.sort(
    (a, b) =>
      String(a.worldId || '').localeCompare(String(b.worldId || '')) ||
      a.currentClass.localeCompare(b.currentClass) ||
      a.label.localeCompare(b.label),
  );
  const summary = summarizeAudit(rows);
  return { summary, rows };
}

export function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    console.log(usage());
    return;
  }
  const rootDir = resolveRoot(arg(argv, 'root', DEFAULT_ROOT));
  const outDir = resolveRoot(arg(argv, 'out', DEFAULT_OUT));
  const fallbackWindow = Number(arg(argv, 'window', DEFAULT_WINDOW));
  if (!Number.isFinite(fallbackWindow) || fallbackWindow < 2) {
    throw new Error('--window must be a number >= 2');
  }
  const audit = buildAudit({ rootDir, fallbackWindow });
  mkdirSync(outDir, { recursive: true });
  const payload = { ...audit.summary, rows: audit.rows };
  writeFileSync(path.join(outDir, 'report.json'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(path.join(outDir, 'report.md'), renderMarkdown({ ...audit, rootDir }));
  if (has(argv, 'json')) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`hidden+proofDebt audit written: ${path.relative(ROOT, path.join(outDir, 'report.md'))}`);
    console.log(`rows=${audit.summary.rows} cleanCurrentFailures=${audit.summary.cleanCurrentFailures}`);
    if (audit.summary.replayCandidate) {
      console.log(`replay candidate: ${audit.summary.replayCandidate.label}`);
    } else {
      console.log('replay candidate: none');
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
