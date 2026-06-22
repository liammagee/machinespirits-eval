#!/usr/bin/env node
/**
 * Cross-arm consolidation diagnostic for selector/pacing-guard artifacts.
 *
 * This is deliberately not another selector taxonomy. It answers one narrow
 * question for visible-route candidates: did visible/selective-visible create
 * unique progress, or was this a false positive because hidden/no-guard also
 * grounded the same board?
 *
 * It reads completed loop/episode artifacts only. No model calls, no rerolls.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const DEFAULT_LOOP_DIR = 'exports/dramatic-derivation/loop';
const DEFAULT_PATTERN = '*selector*';
const SUCCESS_VERDICT = 'grounded_anagnorisis';

function usage() {
  return `Usage: node scripts/analyze-derivation-selector-consolidation.js [options]

Options:
  --loop-dir <dir>          Artifact directory. Default: ${DEFAULT_LOOP_DIR}
  --pattern <glob[,glob]>   Label glob(s) to include. Default: ${DEFAULT_PATTERN}
  --labels <csv>            Explicit labels to include.
  --out <path>              Write Markdown report to this path.
  --json                    Print machine-readable summary to stdout.
  --episode-window <n>      Window used in emitted replay commands. Default: 6
  --episode-real            Include --real in emitted replay commands.
  --help                    Show this help.

Example:
  node scripts/analyze-derivation-selector-consolidation.js \\
    --pattern '*ravensmark-selector-vpositive-t15w12*' \\
    --out exports/dramatic-derivation/selector-vpositive-t15w12-consolidation.md
`;
}

function arg(args, name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
}

function has(args, name) {
  return args.includes(`--${name}`);
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveFromRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

function escapeRegExp(s) {
  return s.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob) {
  const parts = String(glob)
    .split('*')
    .map((part) =>
      part
        .split('?')
        .map(escapeRegExp)
        .join('.'),
    );
  return new RegExp(`^${parts.join('.*')}$`);
}

function labelMatches(label, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(label));
}

export function parseSelectorLabel(label) {
  const match = String(label).match(
    /^(?<root>.+)-(?<arm>baseline|hidden|visible|selective(?:-v\d+)?)\-r(?<run>\d+)$/,
  );
  if (!match) return null;
  return {
    label,
    root: match.groups.root,
    arm: match.groups.arm,
    run: Number(match.groups.run),
  };
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

function artifactDir(loopDir, label) {
  return path.join(loopDir, label);
}

function artifactComplete(loopDir, label) {
  const dir = artifactDir(loopDir, label);
  return ['diagnosis.json', 'result.json', 'transcript.md'].every((name) => existsSync(path.join(dir, name)));
}

function candidateLabels(loopDir, patterns, explicitLabels = []) {
  const labels = new Set(explicitLabels);
  if (existsSync(loopDir)) {
    for (const entry of readdirSync(loopDir)) {
      const dir = path.join(loopDir, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      if (labelMatches(entry, patterns)) labels.add(entry);
    }
  }
  return [...labels].sort();
}

function finalD(diagnosis) {
  const curve = diagnosis?.dCurve || [];
  return curve.length ? curve[curve.length - 1] : null;
}

function selectedStrategy(diagnosis) {
  if (diagnosis?.pacingGuardSelector?.selected) return diagnosis.pacingGuardSelector.selected;
  if (diagnosis?.visibleGuard) return 'visible';
  if (diagnosis?.pacingGuard) return 'hidden';
  return 'none';
}

function selectorGate(diagnosis) {
  return diagnosis?.pacingGuardSelector?.gate || null;
}

function overreachCount(diagnosis) {
  return diagnosis?.learnerInference?.overreachCount ?? 0;
}

function luckyLeapCount(diagnosis) {
  const e = diagnosis?.eventsByType || {};
  return (e.lucky_leap || 0) + (e.lucky_leap_only || 0);
}

function releaseTurnMap(diagnosis) {
  return new Map((diagnosis?.releaseAdherence?.rows || []).map((row) => [row.premise, row.actualTurn ?? null]));
}

function releaseByTurn(diagnosis) {
  const rows = [];
  for (const decision of diagnosis?.releaseDeviations?.decisions || []) {
    if (decision.played) rows.push({ turn: decision.turn, premise: decision.played });
  }
  return rows;
}

function guardInterventions(diagnosis) {
  const out = [];
  for (const decision of diagnosis?.releaseDeviations?.decisions || []) {
    const v = decision.visibleGuard || null;
    const h = decision.pacingGuard || null;
    if (v?.blocked || v?.forcedSafe) {
      out.push({
        turn: decision.turn,
        guard: 'visible',
        kind: v.blocked ? 'block' : 'push',
        premise: v.candidate || decision.played || null,
        reason: v.reason || decision.reason || null,
      });
    }
    if (h?.blocked || h?.forcedSafe) {
      out.push({
        turn: decision.turn,
        guard: 'hidden',
        kind: h.blocked ? 'block' : 'push',
        premise: h.candidate || h.alternative || decision.played || null,
        reason: h.reason || decision.reason || null,
      });
    }
  }
  return out;
}

function proofCriticalSources(diagnosis) {
  const turns = diagnosis?.logicProjection?.turns || [];
  const last = turns[turns.length - 1] || null;
  return new Set(last?.secret?.sourcePremiseIds || []);
}

function nonProofReleases(diagnosis) {
  const critical = proofCriticalSources(diagnosis);
  return (diagnosis?.releaseAdherence?.rows || [])
    .filter((row) => row.actualTurn != null && !critical.has(row.premise))
    .map((row) => ({
      premise: row.premise,
      actualTurn: row.actualTurn,
      plannedTurn: row.plannedTurn,
      status: row.status,
    }));
}

function firstSecretDerivedTurn(diagnosis) {
  return (diagnosis?.logicProjection?.turns || []).find((row) => row.secret?.derived)?.turn ?? null;
}

function firstDeadPredicateCandidate(diagnosis) {
  return diagnosis?.pacingGuardSelector?.input?.mirrorDeadPredicateDecoy?.candidates?.[0] || null;
}

function firstFiredPredicateTurn(diagnosis, predicate) {
  if (!predicate) return null;
  for (const turn of diagnosis?.logicProjection?.turns || []) {
    if ((turn.firedHyperedges || []).some((edge) => edge.outputPredicate === predicate)) return turn.turn;
  }
  return null;
}

function firstVoicedPredicateTurn(diagnosis, predicate) {
  if (!predicate) return null;
  const node = (diagnosis?.learnerInference?.nodes || []).find((row) => Array.isArray(row.fact) && row.fact[0] === predicate);
  return node?.firstVoiced ?? null;
}

function summarizeRun(label, diagnosis, parsed, loopDir) {
  const dead = firstDeadPredicateCandidate(diagnosis);
  const deadPredicate = dead?.predicate || null;
  return {
    label,
    dir: path.relative(ROOT, artifactDir(loopDir, label)),
    group: diagnosis.group || parsed.root,
    root: parsed.root,
    arm: parsed.arm,
    run: parsed.run,
    worldId: diagnosis.worldId || null,
    verdict: diagnosis.verdict || null,
    grounded: diagnosis.verdict === SUCCESS_VERDICT,
    turns: diagnosis.turnsPlayed ?? null,
    finalD: finalD(diagnosis),
    selected: selectedStrategy(diagnosis),
    gate: selectorGate(diagnosis),
    overreach: overreachCount(diagnosis),
    luckyLeap: luckyLeapCount(diagnosis),
    firstForcedTurn: diagnosis.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis.forcedToAssertedGap ?? null,
    firstSecretDerivedTurn: firstSecretDerivedTurn(diagnosis),
    deadPredicate,
    firstDeadPredicateDerivedTurn: firstFiredPredicateTurn(diagnosis, deadPredicate),
    firstDeadPredicateVoicedTurn: firstVoicedPredicateTurn(diagnosis, deadPredicate),
    guardInterventions: guardInterventions(diagnosis),
    nonProofReleases: nonProofReleases(diagnosis),
    releaseTurns: Object.fromEntries(releaseTurnMap(diagnosis)),
    releaseByTurn: releaseByTurn(diagnosis),
    dCurve: diagnosis.dCurve || [],
    diagnosis,
  };
}

function comparisonKey(row) {
  return `${row.group}\tr${row.run}`;
}

function chooseSelector(rows) {
  const selectors = rows
    .filter((row) => row.arm.startsWith('selective'))
    .sort((a, b) => {
      const av = Number(a.arm.match(/v(\d+)/)?.[1] || 0);
      const bv = Number(b.arm.match(/v(\d+)/)?.[1] || 0);
      return bv - av;
    });
  return selectors[0] || null;
}

function firstDivergence(a, b) {
  if (!a || !b) return null;
  const turns = Math.max(a.dCurve.length, b.dCurve.length);
  for (let i = 0; i < turns; i += 1) {
    if (a.dCurve[i] !== b.dCurve[i]) return { turn: i + 1, kind: 'D', a: a.dCurve[i] ?? null, b: b.dCurve[i] ?? null };
  }
  const premises = new Set([...Object.keys(a.releaseTurns || {}), ...Object.keys(b.releaseTurns || {})]);
  let first = null;
  for (const premise of premises) {
    const at = a.releaseTurns[premise] ?? null;
    const bt = b.releaseTurns[premise] ?? null;
    if (at === bt) continue;
    const turn = Math.min(at ?? Infinity, bt ?? Infinity);
    if (Number.isFinite(turn) && (!first || turn < first.turn)) {
      first = { turn, kind: 'release', premise, a: at, b: bt };
    }
  }
  return first;
}

function firstGuardIntervention(row) {
  return row?.guardInterventions?.[0] || null;
}

function replayCommand({ source, turn, labelSuffix, window = 6, real = false, to = 'hidden' }) {
  if (!source || !turn) return null;
  const flags =
    to === 'hidden'
      ? ['--pacing-guard', 'on', '--pacing-guard-visible', 'off']
      : ['--pacing-guard', 'off', '--pacing-guard-visible', 'on'];
  const selectorOff = [
    '--pacing-guard-selective',
    'off',
    '--pacing-guard-selective-v1',
    'off',
    '--pacing-guard-selective-v2',
    'off',
    '--pacing-guard-selective-v3',
    'off',
    '--pacing-guard-selective-v4',
    'off',
  ];
  const parts = [
    'node',
    'scripts/run-derivation-episode.js',
    '--from',
    source.dir,
    '--turn',
    String(turn),
    '--window',
    String(window),
    ...(real ? ['--real'] : []),
    ...selectorOff,
    ...flags,
    '--label',
    `${source.label}-${labelSuffix}-from-t${turn}`,
  ];
  return parts.map((part) => (/[\s{}"']/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

export function classifyComparison(rows, { episodeWindow = 6, episodeReal = false } = {}) {
  const byArm = new Map(rows.map((row) => [row.arm, row]));
  const selector = chooseSelector(rows);
  const visible = byArm.get('visible') || null;
  const hidden = byArm.get('hidden') || null;
  const baseline = byArm.get('baseline') || null;
  const selected = selector || visible || null;
  const selectedVisible = selected?.selected === 'visible' || selected?.arm === 'visible';
  const selectedSuccess = Boolean(selected?.grounded);
  const visibleSuccess = Boolean((visible || selected)?.grounded);
  const hiddenSuccess = Boolean(hidden?.grounded);
  const baselineSuccess = Boolean(baseline?.grounded);

  let classification = 'inconclusive';
  const reasons = [];
  if (!selectedVisible) {
    classification = 'not_visible_route';
    reasons.push('selector/arm is not a visible route');
  } else if (selectedSuccess && visibleSuccess && !hiddenSuccess && !baselineSuccess) {
    classification = 'strict_v_positive';
    reasons.push('visible/selective-visible grounded while hidden and baseline did not');
  } else if (selectedSuccess && (hiddenSuccess || baselineSuccess)) {
    classification = 'false_positive';
    reasons.push('visible/selective-visible grounded, but hidden or baseline also grounded');
  } else if (!selectedSuccess && hiddenSuccess) {
    classification = 'visible_route_failure';
    reasons.push('visible/selective-visible failed while hidden grounded');
  } else if (!selectedSuccess && baselineSuccess) {
    classification = 'visible_guard_failure_or_negative_transfer';
    reasons.push('visible/selective-visible failed while baseline grounded');
  } else {
    reasons.push('available arms do not separate the policies');
  }

  const comparator = hidden || baseline || null;
  const divergence = firstDivergence(selected, comparator);
  const guard = firstGuardIntervention(selected);
  const replayTurn = Math.max(1, Math.min(guard?.turn ?? Infinity, divergence?.turn ?? Infinity));
  const episodeCommands = [];
  if (selectedVisible && selected && Number.isFinite(replayTurn)) {
    episodeCommands.push(
      replayCommand({
        source: selected,
        turn: replayTurn,
        labelSuffix: 'as-hidden',
        window: episodeWindow,
        real: episodeReal,
        to: 'hidden',
      }),
    );
  }
  if (hidden && hidden.selected === 'hidden') {
    const hGuard = firstGuardIntervention(hidden);
    const hTurn = hGuard?.turn || divergence?.turn || null;
    if (hTurn) {
      episodeCommands.push(
        replayCommand({
          source: hidden,
          turn: hTurn,
          labelSuffix: 'as-visible',
          window: episodeWindow,
          real: episodeReal,
          to: 'visible',
        }),
      );
    }
  }

  return {
    key: comparisonKey(rows[0]),
    group: rows[0]?.group || null,
    run: rows[0]?.run || null,
    worldId: rows[0]?.worldId || null,
    classification,
    reasons,
    selected: selected
      ? {
          label: selected.label,
          arm: selected.arm,
          selected: selected.selected,
          gate: selected.gate,
          grounded: selected.grounded,
          turns: selected.turns,
          finalD: selected.finalD,
        }
      : null,
    arms: Object.fromEntries(
      [...byArm.entries()].map(([arm, row]) => [
        arm,
        {
          label: row.label,
          verdict: row.verdict,
          grounded: row.grounded,
          turns: row.turns,
          finalD: row.finalD,
          selected: row.selected,
          gate: row.gate,
          overreach: row.overreach,
          luckyLeap: row.luckyLeap,
          firstSecretDerivedTurn: row.firstSecretDerivedTurn,
          deadPredicate: row.deadPredicate,
          firstDeadPredicateDerivedTurn: row.firstDeadPredicateDerivedTurn,
          firstDeadPredicateVoicedTurn: row.firstDeadPredicateVoicedTurn,
          guardInterventions: row.guardInterventions,
          nonProofReleases: row.nonProofReleases,
        },
      ]),
    ),
    divergence,
    firstSelectedGuardIntervention: guard,
    episodeCommands: episodeCommands.filter(Boolean),
  };
}

export function analyzeRuns(rows, options = {}) {
  const groups = new Map();
  for (const row of rows) {
    const key = comparisonKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const comparisons = [...groups.values()]
    .map((groupRows) => classifyComparison(groupRows, options))
    .sort((a, b) => (a.group || '').localeCompare(b.group || '') || (a.run || 0) - (b.run || 0));
  const counts = {};
  for (const row of comparisons) counts[row.classification] = (counts[row.classification] || 0) + 1;
  return {
    schema: 'dramatic-derivation.selector-consolidation-diagnostic.v0',
    generatedAt: new Date().toISOString(),
    counts,
    comparisons,
  };
}

function tableLine(values) {
  return `| ${values.map((v) => String(v ?? '').replace(/\n/g, '<br>')).join(' | ')} |`;
}

function fmtBool(v) {
  return v ? 'yes' : 'no';
}

function fmtInterventions(items = []) {
  if (!items.length) return '-';
  return items
    .slice(0, 3)
    .map((i) => `t${i.turn} ${i.guard}/${i.kind}${i.premise ? ` ${i.premise}` : ''}`)
    .join('; ');
}

function fmtNonProof(items = []) {
  if (!items.length) return '-';
  return items.map((i) => `${i.premise}@t${i.actualTurn}`).join(', ');
}

export function renderMarkdown(summary) {
  const lines = [];
  lines.push('# Selector Consolidation Diagnostic', '');
  lines.push(`Generated: ${summary.generatedAt}`, '');
  lines.push('## Classification Counts', '');
  for (const [key, value] of Object.entries(summary.counts).sort()) {
    lines.push(`- ${key}: ${value}`);
  }
  if (!Object.keys(summary.counts).length) lines.push('- no completed comparisons found');
  lines.push('', '## Comparisons', '');
  lines.push(
    tableLine([
      'group',
      'run',
      'world',
      'classification',
      'selected',
      'baseline',
      'hidden',
      'visible',
      'selective',
    ]),
  );
  lines.push(tableLine(['---', '---:', '---', '---', '---', '---', '---', '---', '---']));
  for (const c of summary.comparisons) {
    const arm = (name) => c.arms[name];
    const compact = (row) => (row ? `${row.verdict} t${row.turns} D${row.finalD}` : '-');
    const sel = c.selected ? `${c.selected.arm}/${c.selected.selected}${c.selected.gate ? ` (${c.selected.gate})` : ''}` : '-';
    const selective =
      arm('selective-v4') || arm('selective-v3') || arm('selective-v2') || arm('selective-v1') || arm('selective');
    lines.push(
      tableLine([
        c.group,
        c.run,
        c.worldId,
        c.classification,
        sel,
        compact(arm('baseline')),
        compact(arm('hidden')),
        compact(arm('visible')),
        compact(selective),
      ]),
    );
  }
  lines.push('', '## Mechanistic Notes', '');
  for (const c of summary.comparisons) {
    lines.push(`### ${c.group} r${c.run}`, '');
    lines.push(`Classification: **${c.classification}**.`);
    for (const reason of c.reasons || []) lines.push(`- ${reason}`);
    if (c.divergence) {
      lines.push(
        `- Earliest selected/comparator divergence: t${c.divergence.turn} ${c.divergence.kind}${
          c.divergence.premise ? ` ${c.divergence.premise}` : ''
        } (${c.divergence.a} vs ${c.divergence.b}).`,
      );
    }
    if (c.firstSelectedGuardIntervention) {
      lines.push(
        `- First selected guard intervention: t${c.firstSelectedGuardIntervention.turn} ${c.firstSelectedGuardIntervention.guard}/${c.firstSelectedGuardIntervention.kind}${
          c.firstSelectedGuardIntervention.premise ? ` ${c.firstSelectedGuardIntervention.premise}` : ''
        }.`,
      );
    }
    for (const [arm, row] of Object.entries(c.arms)) {
      lines.push(
        `- ${arm}: success ${fmtBool(row.grounded)}; secret t${row.firstSecretDerivedTurn ?? '-'}; dead predicate ${
          row.deadPredicate || '-'
        } derived t${row.firstDeadPredicateDerivedTurn ?? '-'} voiced t${row.firstDeadPredicateVoicedTurn ?? '-'}; guard ${fmtInterventions(
          row.guardInterventions,
        )}; non-proof releases ${fmtNonProof(row.nonProofReleases)}.`,
      );
    }
    if (c.episodeCommands.length) {
      lines.push('', 'Replay commands for prefix-controlled debugging:');
      lines.push('```bash');
      for (const command of c.episodeCommands) lines.push(command);
      lines.push('```');
    }
    lines.push('');
  }
  lines.push(
    'Caveat: episode commands are debugging replays, not independent selector evidence. Promote any repaired episode to a fresh first-pass loop before making a selector claim.',
    '',
  );
  return lines.join('\n');
}

function loadRows({ loopDir, patterns, labels }) {
  const rows = [];
  const missing = [];
  for (const label of candidateLabels(loopDir, patterns, labels)) {
    const parsed = parseSelectorLabel(label);
    if (!parsed) continue;
    if (!artifactComplete(loopDir, label)) {
      missing.push(label);
      continue;
    }
    const diagnosis = safeReadJson(path.join(artifactDir(loopDir, label), 'diagnosis.json'));
    if (!diagnosis) {
      missing.push(label);
      continue;
    }
    rows.push(summarizeRun(label, diagnosis, parsed, loopDir));
  }
  return { rows, missing };
}

async function main() {
  const args = process.argv.slice(2);
  if (has(args, 'help')) {
    console.log(usage());
    return;
  }
  const loopDir = resolveFromRoot(arg(args, 'loop-dir', DEFAULT_LOOP_DIR));
  const patterns = splitCsv(arg(args, 'pattern', DEFAULT_PATTERN));
  const labels = splitCsv(arg(args, 'labels', ''));
  const episodeWindow = Number(arg(args, 'episode-window', '6'));
  if (!Number.isInteger(episodeWindow) || episodeWindow < 1) {
    console.error('--episode-window must be an integer >= 1');
    process.exit(1);
  }
  const { rows, missing } = loadRows({ loopDir, patterns, labels });
  const summary = analyzeRuns(rows, {
    episodeWindow,
    episodeReal: has(args, 'episode-real'),
  });
  summary.source = {
    loopDir: path.relative(ROOT, loopDir),
    patterns,
    labels,
    loaded: rows.length,
    missing,
  };

  const out = arg(args, 'out', null);
  if (out) {
    const outPath = resolveFromRoot(out);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, renderMarkdown(summary));
    const jsonPath = outPath.replace(/\.md$/i, '.json');
    writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outPath)}`);
    console.log(`wrote ${path.relative(ROOT, jsonPath)}`);
  }
  if (has(args, 'json')) {
    console.log(JSON.stringify(summary, null, 2));
  } else if (!out) {
    console.log(renderMarkdown(summary));
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
