#!/usr/bin/env node
/**
 * Dry analyzer for dramatic-derivation loop artifacts.
 *
 * This is the artifact-first counterpart to the DB-backed eval analyzers: it
 * reads exports/dramatic-derivation/loop/<label>/{diagnosis,result,transcript}
 * and never calls a model or changes verdicts.
 *
 * Usage:
 *   node scripts/analyze-derivation-loop-results.js
 *     [--loop-dir exports/dramatic-derivation/loop]
 *     [--pattern '*selector-v1-*']
 *     [--expected-file exports/dramatic-derivation/selector-v1-run-logs/manifest.tsv]
 *     [--selector-arm selective]
 *     [--selector-version v1|auto|none]
 *     [--out exports/dramatic-derivation/selector-v1-summary]
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
const DEFAULT_PATTERN = '*selector-v1-*';
const VERDICT_ORDER = [
  'grounded_anagnorisis',
  'aporia',
  'disengagement',
  'lucky_leap_only',
];
const STATIC_ARMS = ['baseline', 'hidden', 'visible'];

function usage() {
  return `Usage: node scripts/analyze-derivation-loop-results.js [options]

Options:
  --loop-dir <dir>          Loop artifact directory. Default: ${DEFAULT_LOOP_DIR}
  --pattern <glob[,glob]>   Label glob(s) to include. Default: ${DEFAULT_PATTERN}
  --expected-labels <csv>   Optional expected labels for missing-artifact checks.
  --expected-file <path>    Optional file of expected labels. TSV/CSV first column, JSON array, or one label per line.
  --selector-arm <name>     Selector arm name. Default: selective
  --selector-version <v>    v1, v0, none, auto, or all. Default: auto
  --out <dir>               Write summary.json, report.md, manifest.tsv.
  --json                    Print machine-readable summary to stdout.
  --help                    Show this help.

Examples:
  npm run derivation:analyze-loop -- --pattern '*selector-v1-*'
  node scripts/analyze-derivation-loop-results.js \\
    --pattern '*selector-v1-*,*-selector-baseline-r*,*-selector-hidden-r*,*-selector-visible-r*' \\
    --selector-version v1 \\
    --out exports/dramatic-derivation/selector-v1-summary
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

export function parseDerivationLabel(label) {
  const match = String(label).match(
    /^(?<world>.+?)-selector(?:-(?<version>v\d+))?-(?<arm>baseline|hidden|visible|selective)-r(?<run>\d+)$/,
  );
  if (!match) return null;
  return {
    label,
    world: match.groups.world,
    selectorVersion: match.groups.version || null,
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

function readExpectedFile(file) {
  if (!file) return [];
  const abs = resolveFromRoot(file);
  const raw = readFileSync(abs, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    return parsed
      .map((row) => (typeof row === 'string' ? row : row?.label))
      .filter(Boolean);
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'))
    .map((line) => line.split(/\t|,/)[0].trim())
    .filter((label) => label && label !== 'label');
}

function verdictSummary(verdicts) {
  const keys = Object.keys(verdicts).sort((a, b) => {
    const ai = VERDICT_ORDER.indexOf(a);
    const bi = VERDICT_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
  return keys.map((key) => `${key} x${verdicts[key]}`).join('; ');
}

function fmtValue(v) {
  return v === null || v === undefined ? '-' : String(v);
}

function fmtArray(values) {
  return `[${values.map(fmtValue).join(',')}]`;
}

function pct(rate) {
  return rate == null ? '-' : `${Math.round(rate * 100)}%`;
}

function pp(delta) {
  if (delta == null) return '-';
  const n = Math.round(delta * 100);
  return `${n > 0 ? '+' : ''}${n}pp`;
}

function rateText(stat) {
  if (!stat) return '-';
  return `${stat.grounded}/${stat.n} (${pct(stat.rate)})`;
}

function selectedFromDiagnosis(diagnosis) {
  const selector = diagnosis.pacingGuardSelector || null;
  if (selector?.selected) return selector.selected;
  if (diagnosis.visibleGuard) return 'visible';
  if (diagnosis.pacingGuard) return 'hidden';
  return 'none';
}

function finalD(diagnosis) {
  const curve = diagnosis.dCurve || [];
  if (curve.length) return curve[curve.length - 1];
  return null;
}

function luckCount(diagnosis) {
  const events = diagnosis.eventsByType || {};
  return (events.lucky_leap || 0) + (events.lucky_leap_only || 0);
}

function overreachCount(diagnosis) {
  return diagnosis.learnerInference?.overreachCount ?? diagnosis.learnerInference?.overreach ?? 0;
}

function unreachedPremises(diagnosis) {
  return (diagnosis.releaseAdherence?.rows || [])
    .filter((row) => row.status === 'unreached')
    .map((row) => row.premise);
}

function collectCandidateLabels(loopDir, patterns, expectedLabels) {
  const labels = new Set(expectedLabels);
  if (!existsSync(loopDir)) return [...labels].sort();
  for (const entry of readdirSync(loopDir)) {
    const dir = path.join(loopDir, entry);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (labelMatches(entry, patterns)) labels.add(entry);
  }
  return [...labels].sort();
}

function artifactStatus(loopDir, label) {
  const dir = path.join(loopDir, label);
  const diagnosisPath = path.join(dir, 'diagnosis.json');
  const resultPath = path.join(dir, 'result.json');
  const transcriptPath = path.join(dir, 'transcript.md');
  const exists = existsSync(dir);
  const diagnosis = existsSync(diagnosisPath);
  const result = existsSync(resultPath);
  const transcript = existsSync(transcriptPath);
  const complete = exists && diagnosis && result && transcript;
  return {
    label,
    dir,
    exists,
    diagnosis,
    result,
    transcript,
    complete,
    status: complete ? 'complete' : exists ? 'incomplete' : 'missing',
  };
}

function rowFromArtifact(loopDir, label) {
  const status = artifactStatus(loopDir, label);
  const parsed = parseDerivationLabel(label);
  if (!parsed) {
    return {
      label,
      parsed: false,
      artifactStatus: status,
    };
  }
  const diagnosis = status.diagnosis ? safeReadJson(path.join(status.dir, 'diagnosis.json')) : null;
  if (!diagnosis) {
    return {
      ...parsed,
      parsed: true,
      artifactStatus: status,
    };
  }
  const selector = diagnosis.pacingGuardSelector || null;
  return {
    ...parsed,
    parsed: true,
    artifactStatus: status,
    status: 'complete',
    worldId: diagnosis.worldId || null,
    worldPath: diagnosis.worldPath || null,
    verdict: diagnosis.verdict || null,
    grounded: diagnosis.verdict === 'grounded_anagnorisis',
    turns: diagnosis.turnsPlayed ?? null,
    turnCap: diagnosis.turnCap ?? null,
    finalD: finalD(diagnosis),
    firstForcedTurn: diagnosis.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis.forcedToAssertedGap ?? null,
    selected: selectedFromDiagnosis(diagnosis),
    selectorGate: selector?.gate || null,
    selectorSchema: selector?.schema || null,
    selectedFlag: selector?.selectedFlag || null,
    rejected: selector?.rejected || null,
    overreach: overreachCount(diagnosis),
    luckyLeap: luckCount(diagnosis),
    fabricatedFacts: (diagnosis.fabricatedFacts || []).length,
    unreachedPremises: unreachedPremises(diagnosis),
    calls: diagnosis.usage?.calls ?? null,
    learnerCalls: diagnosis.usage?.byRole?.learner?.calls ?? null,
    elapsedMs: diagnosis.elapsedMs ?? null,
  };
}

function chooseSelectorVersion(rows, requested) {
  if (requested === 'all') return 'all';
  if (requested === 'none') return null;
  if (requested && requested !== 'auto') return requested;
  const versions = rows
    .filter((row) => row.status === 'complete' && row.arm === 'selective')
    .map((row) => row.selectorVersion)
    .filter(Boolean);
  if (!versions.length) return null;
  return versions.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))[0];
}

function rowIncludedInSelector(row, selectorArm, selectorVersion) {
  if (row.arm !== selectorArm) return false;
  if (selectorVersion === 'all') return true;
  return row.selectorVersion === selectorVersion;
}

function armLabel(arm, selectorVersion) {
  return selectorVersion ? `${arm} ${selectorVersion}` : arm;
}

function groupKey(row) {
  return `${row.world}\t${row.arm}\t${row.selectorVersion || ''}`;
}

function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows.filter((r) => r.status === 'complete')) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return [...groups.entries()]
    .map(([key, groupRows]) => {
      const [world, arm, version] = key.split('\t');
      const verdicts = {};
      for (const row of groupRows) verdicts[row.verdict] = (verdicts[row.verdict] || 0) + 1;
      const ordered = groupRows.slice().sort((a, b) => a.run - b.run);
      const grounded = groupRows.filter((row) => row.grounded).length;
      return {
        world,
        arm,
        selectorVersion: version || null,
        armLabel: armLabel(arm, version || null),
        n: groupRows.length,
        grounded,
        rate: grounded / groupRows.length,
        verdicts,
        turns: ordered.map((row) => row.turns),
        finalD: ordered.map((row) => row.finalD),
        gaps: ordered.map((row) => row.forcedToAssertedGap),
        selectedStrategies: [...new Set(groupRows.map((row) => row.selected))],
        selectorGates: [...new Set(groupRows.map((row) => row.selectorGate).filter(Boolean))],
        overreach: groupRows.reduce((sum, row) => sum + (row.overreach || 0), 0),
        overreachRuns: ordered.map((row) => row.overreach || 0),
        luckyLeap: groupRows.reduce((sum, row) => sum + (row.luckyLeap || 0), 0),
        luckyLeapRuns: ordered.map((row) => row.luckyLeap || 0),
        runs: ordered.map((row) => row.label),
      };
    })
    .sort((a, b) => a.world.localeCompare(b.world) || a.armLabel.localeCompare(b.armLabel));
}

function findSummary(summaries, world, arm, preferredVersion = null) {
  const candidates = summaries.filter((summary) => summary.world === world && summary.arm === arm);
  if (!candidates.length) return null;
  if (preferredVersion !== 'all') {
    const exact = candidates.find((summary) => summary.selectorVersion === preferredVersion);
    if (exact) return exact;
  }
  const noVersion = candidates.find((summary) => !summary.selectorVersion);
  if (noVersion) return noVersion;
  return candidates[0];
}

function statFromSummary(summary) {
  if (!summary) return null;
  return {
    n: summary.n,
    grounded: summary.grounded,
    rate: summary.rate,
    armLabel: summary.armLabel,
  };
}

function computeRegret({ rows, summaries, selectorArm, selectorVersion }) {
  const selectorRows = rows.filter((row) => rowIncludedInSelector(row, selectorArm, selectorVersion));
  const worlds = [...new Set(selectorRows.map((row) => row.world))].sort();
  const worldRows = [];
  const totals = {
    selector: { grounded: 0, n: 0 },
    baseline: { grounded: 0, n: 0 },
    hidden: { grounded: 0, n: 0 },
    visible: { grounded: 0, n: 0 },
    oracleStatic: { grounded: 0, n: 0 },
  };

  for (const world of worlds) {
    const selectorSummary = findSummary(summaries, world, selectorArm, selectorVersion);
    const selector = statFromSummary(selectorSummary);
    const statics = Object.fromEntries(
      STATIC_ARMS.map((arm) => [arm, statFromSummary(findSummary(summaries, world, arm, selectorVersion))]),
    );
    const availableStatics = Object.entries(statics).filter(([, stat]) => stat);
    const oracle =
      availableStatics.length > 0
        ? availableStatics
            .map(([arm, stat]) => ({ arm, ...stat }))
            .sort((a, b) => b.rate - a.rate || b.grounded - a.grounded || a.arm.localeCompare(b.arm))[0]
        : null;
    if (selector) {
      totals.selector.grounded += selector.grounded;
      totals.selector.n += selector.n;
    }
    for (const arm of STATIC_ARMS) {
      if (!statics[arm]) continue;
      totals[arm].grounded += statics[arm].grounded;
      totals[arm].n += statics[arm].n;
    }
    if (oracle && selector) {
      totals.oracleStatic.grounded += oracle.grounded;
      totals.oracleStatic.n += selector.n;
    }
    worldRows.push({
      world,
      selectorRoute: selectorSummary?.selectedStrategies?.join(',') || null,
      selectorGates: selectorSummary?.selectorGates || [],
      selector,
      baseline: statics.baseline,
      hidden: statics.hidden,
      visible: statics.visible,
      oracleStatic: oracle,
      regretVsOracle: selector && oracle ? oracle.rate - selector.rate : null,
      regretVsHidden: selector && statics.hidden ? statics.hidden.rate - selector.rate : null,
      regretVsBaseline: selector && statics.baseline ? statics.baseline.rate - selector.rate : null,
      negativeTransferVsHidden: Boolean(selector && statics.hidden && selector.rate < statics.hidden.rate),
      negativeTransferVsBaseline: Boolean(selector && statics.baseline && selector.rate < statics.baseline.rate),
    });
  }

  const totalRate = (stat) => (stat.n ? stat.grounded / stat.n : null);
  return {
    selectorVersion,
    worlds,
    totals: {
      selector: { ...totals.selector, rate: totalRate(totals.selector) },
      baseline: { ...totals.baseline, rate: totalRate(totals.baseline) },
      hidden: { ...totals.hidden, rate: totalRate(totals.hidden) },
      visible: { ...totals.visible, rate: totalRate(totals.visible) },
      oracleStatic: { ...totals.oracleStatic, rate: totalRate(totals.oracleStatic) },
      regretVsOracle:
        totalRate(totals.selector) != null && totalRate(totals.oracleStatic) != null
          ? totalRate(totals.oracleStatic) - totalRate(totals.selector)
          : null,
      regretVsHidden:
        totalRate(totals.selector) != null && totalRate(totals.hidden) != null
          ? totalRate(totals.hidden) - totalRate(totals.selector)
          : null,
      regretVsBaseline:
        totalRate(totals.selector) != null && totalRate(totals.baseline) != null
          ? totalRate(totals.baseline) - totalRate(totals.selector)
          : null,
    },
    worldRows,
  };
}

function staticRateFor(summaries, world, arm, selectorVersion) {
  return findSummary(summaries, world, arm, selectorVersion)?.rate ?? null;
}

function classifyFailure(row, summaries, selectorArm, selectorVersion) {
  if (row.grounded || row.status !== 'complete') return null;
  let kind = 'guard_failure';
  const evidence = [];
  if (row.verdict) evidence.push(`verdict ${row.verdict}`);
  if (row.finalD != null) evidence.push(`final D ${row.finalD}`);
  if (row.unreachedPremises?.length) evidence.push(`unreached ${row.unreachedPremises.join(',')}`);
  if (row.overreach) evidence.push(`overreach ${row.overreach}`);
  if (row.luckyLeap) evidence.push(`lucky ${row.luckyLeap}`);

  if (row.luckyLeap > 0 || row.verdict === 'lucky_leap_only') {
    kind = 'implementation_artifact';
  } else if (row.arm === selectorArm) {
    const selectedStaticRate =
      row.selected && STATIC_ARMS.includes(row.selected)
        ? staticRateFor(summaries, row.world, row.selected, selectorVersion)
        : null;
    const rejectedRates = STATIC_ARMS.filter((arm) => arm !== row.selected)
      .map((arm) => staticRateFor(summaries, row.world, arm, selectorVersion))
      .filter((rate) => rate != null);
    const bestRejected = rejectedRates.length ? Math.max(...rejectedRates) : null;
    if (selectedStaticRate != null && bestRejected != null && bestRejected > selectedStaticRate) {
      kind = 'route_failure';
      evidence.push(`best rejected static ${pct(bestRejected)} > selected static ${pct(selectedStaticRate)}`);
    } else if (row.selected === 'visible' && row.verdict === 'aporia' && row.finalD != null && row.finalD <= 3) {
      kind = 'implementation_artifact';
      evidence.push('visible aporia at low residual D');
    } else if (row.verdict === 'disengagement') {
      kind = 'guard_failure_or_world_instability';
    }
  } else if (row.selected === 'visible' && row.verdict === 'aporia' && row.finalD != null && row.finalD <= 3) {
    kind = 'implementation_artifact';
    evidence.push('visible aporia at low residual D');
  } else if (row.verdict === 'disengagement') {
    kind = 'guard_failure_or_world_instability';
  }

  return {
    label: row.label,
    world: row.world,
    arm: armLabel(row.arm, row.selectorVersion),
    selected: row.selected,
    verdict: row.verdict,
    finalD: row.finalD,
    overreach: row.overreach,
    luckyLeap: row.luckyLeap,
    kind,
    evidence,
  };
}

function analyzeCompleteRows({ rows, selectorArm, requestedSelectorVersion }) {
  const completeRows = rows.filter((row) => row.status === 'complete');
  const selectorVersion = chooseSelectorVersion(completeRows, requestedSelectorVersion);
  const summaries = summarizeRows(completeRows);
  const regret = computeRegret({ rows: completeRows, summaries, selectorArm, selectorVersion });
  const failures = completeRows
    .map((row) => classifyFailure(row, summaries, selectorArm, selectorVersion))
    .filter(Boolean);
  return {
    selectorVersion,
    summaries,
    regret,
    failures,
  };
}

function renderGroupTable(summaries) {
  const lines = [];
  lines.push('| World | Arm | Selected | Complete | Grounded | Verdicts | Turns | Final D | Forced/asserted gap | Overreach | Lucky | Gates |');
  lines.push('| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of summaries) {
    lines.push(
      `| ${row.world} | ${row.armLabel} | ${row.selectedStrategies.join(', ') || '-'} | ${row.n} | ${row.grounded}/${row.n} | ${verdictSummary(row.verdicts)} | ${fmtArray(row.turns)} | ${fmtArray(row.finalD)} | ${fmtArray(row.gaps)} | ${row.overreach} ${fmtArray(row.overreachRuns)} | ${row.luckyLeap} ${fmtArray(row.luckyLeapRuns)} | ${row.selectorGates.join(', ') || '-'} |`,
    );
  }
  return lines;
}

function renderRegretTable(regret) {
  const lines = [];
  lines.push('| World | Selector route | Selector | No guard | Always-H | Always-V | Oracle static | Regret vs oracle | Regret vs H | Negative transfer |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- |');
  for (const row of regret.worldRows) {
    const oracle = row.oracleStatic ? `${row.oracleStatic.arm} ${rateText(row.oracleStatic)}` : '-';
    const nt = [
      row.negativeTransferVsHidden ? 'vs H' : null,
      row.negativeTransferVsBaseline ? 'vs no guard' : null,
    ]
      .filter(Boolean)
      .join('; ');
    lines.push(
      `| ${row.world} | ${row.selectorRoute || '-'}${row.selectorGates.length ? ` (${row.selectorGates.join(', ')})` : ''} | ${rateText(row.selector)} | ${rateText(row.baseline)} | ${rateText(row.hidden)} | ${rateText(row.visible)} | ${oracle} | ${pp(row.regretVsOracle)} | ${pp(row.regretVsHidden)} | ${nt || 'none'} |`,
    );
  }
  return lines;
}

function renderFailureTable(failures) {
  if (!failures.length) return ['No non-grounded complete rows matched the analysis set.'];
  const lines = [];
  lines.push('| Label | World | Arm | Selected | Verdict | Final D | Overreach | Lucky | Class | Evidence |');
  lines.push('| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const f of failures) {
    lines.push(
      `| \`${f.label}\` | ${f.world} | ${f.arm} | ${f.selected} | ${f.verdict} | ${fmtValue(f.finalD)} | ${f.overreach} | ${f.luckyLeap} | ${f.kind} | ${f.evidence.join('; ')} |`,
    );
  }
  return lines;
}

function renderManifest(rows) {
  const header = [
    'label',
    'world',
    'arm',
    'selector_version',
    'run',
    'status',
    'verdict',
    'grounded',
    'selected',
    'gate',
    'turns',
    'final_d',
  ];
  const lines = [header.join('\t')];
  for (const row of rows.slice().sort((a, b) => a.label.localeCompare(b.label))) {
    lines.push(
      [
        row.label,
        row.world || '',
        row.arm || '',
        row.selectorVersion || '',
        row.run || '',
        row.artifactStatus?.status || row.status || '',
        row.verdict || '',
        row.grounded === undefined ? '' : String(row.grounded),
        row.selected || '',
        row.selectorGate || '',
        row.turns ?? '',
        row.finalD ?? '',
      ].join('\t'),
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderReport(summary) {
  const L = [];
  const completeRows = summary.rows.filter((row) => row.status === 'complete');
  const selector = summary.regret.totals.selector;
  L.push('# Derivation Loop Analysis');
  L.push('');
  L.push(`Generated: ${summary.generatedAt}.`);
  L.push(`Loop dir: \`${summary.loopDir}\`.`);
  L.push(`Patterns: ${summary.patterns.map((p) => `\`${p}\``).join(', ')}.`);
  L.push('');
  L.push('## Executive Summary');
  L.push('');
  L.push(
    `Complete artifacts: ${completeRows.length}/${summary.rows.length}. Selector version: ${summary.selectorVersion || 'none'}. Selector success: ${selector.grounded}/${selector.n} (${pct(selector.rate)}).`,
  );
  if (summary.regret.totals.hidden.rate != null) {
    L.push(
      `Regret vs always-H: ${pp(summary.regret.totals.regretVsHidden)}. Regret vs oracle static: ${pp(summary.regret.totals.regretVsOracle)}.`,
    );
  }
  L.push('');
  L.push('## Result Tables');
  L.push('');
  L.push(...renderGroupTable(summary.summaries));
  L.push('');
  L.push('## Regret Comparison');
  L.push('');
  L.push(...renderRegretTable(summary.regret));
  L.push('');
  L.push('## Failure Classification');
  L.push('');
  L.push(...renderFailureTable(summary.failures));
  L.push('');
  L.push('## Artifacts');
  L.push('');
  L.push('- This is a dry artifact reader: no model calls, no verdict changes.');
  L.push('- Input rows come from `diagnosis.json`; missing/incomplete artifacts are listed in `manifest.tsv` when `--out` is supplied.');
  L.push('- Static policy comparisons use available `baseline`, `hidden`, and `visible` arms in the matched label set.');
  return `${L.join('\n')}\n`;
}

function printSummary(summary) {
  const complete = summary.rows.filter((row) => row.status === 'complete').length;
  const selector = summary.regret.totals.selector;
  console.log(
    `derivation-loop analysis: ${complete}/${summary.rows.length} complete, selector ${selector.grounded}/${selector.n} (${pct(selector.rate)})`,
  );
  console.log('');
  for (const row of summary.summaries) {
    console.log(
      `${row.world.padEnd(14)} ${row.armLabel.padEnd(12)} ${String(row.grounded).padStart(2)}/${String(row.n).padEnd(2)} ${verdictSummary(row.verdicts)} selected=${row.selectedStrategies.join(',') || '-'}`,
    );
  }
  if (summary.regret.worldRows.length) {
    console.log('');
    console.log(
      `regret: oracle ${pp(summary.regret.totals.regretVsOracle)} · always-H ${pp(summary.regret.totals.regretVsHidden)} · no-guard ${pp(summary.regret.totals.regretVsBaseline)}`,
    );
  }
}

export function analyzeDerivationLoopResults(options = {}) {
  const loopDir = resolveFromRoot(options.loopDir || DEFAULT_LOOP_DIR);
  const patterns = options.patterns?.length ? options.patterns : [DEFAULT_PATTERN];
  const expectedLabels = [
    ...(options.expectedLabels || []),
    ...(options.expectedFile ? readExpectedFile(options.expectedFile) : []),
  ].filter((label) => labelMatches(label, patterns) || options.includeExpectedOutsidePattern);
  const expectedSet = new Set(expectedLabels);
  const labels = collectCandidateLabels(loopDir, patterns, expectedLabels);
  const rows = labels
    .map((label) => rowFromArtifact(loopDir, label))
    .filter((row) => row.parsed || expectedSet.has(row.label));
  const analysis = analyzeCompleteRows({
    rows,
    selectorArm: options.selectorArm || 'selective',
    requestedSelectorVersion: options.selectorVersion || 'auto',
  });
  return {
    generatedAt: new Date().toISOString(),
    loopDir: path.relative(ROOT, loopDir) || '.',
    patterns,
    selectorArm: options.selectorArm || 'selective',
    requestedSelectorVersion: options.selectorVersion || 'auto',
    selectorVersion: analysis.selectorVersion,
    rows,
    summaries: analysis.summaries,
    regret: analysis.regret,
    failures: analysis.failures,
  };
}

function writeOutputs(summary, outDir) {
  const abs = resolveFromRoot(outDir);
  mkdirSync(abs, { recursive: true });
  writeFileSync(path.join(abs, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(path.join(abs, 'report.md'), renderReport(summary));
  writeFileSync(path.join(abs, 'manifest.tsv'), renderManifest(summary.rows));
  return abs;
}

async function main(argv = process.argv.slice(2)) {
  if (has(argv, 'help')) {
    console.log(usage());
    return;
  }
  const selectorVersion = arg(argv, 'selector-version', 'auto');
  const summary = analyzeDerivationLoopResults({
    loopDir: arg(argv, 'loop-dir', DEFAULT_LOOP_DIR),
    patterns: splitCsv(arg(argv, 'pattern', DEFAULT_PATTERN)),
    expectedLabels: splitCsv(arg(argv, 'expected-labels', '')),
    expectedFile: arg(argv, 'expected-file', null),
    selectorArm: arg(argv, 'selector-arm', 'selective'),
    selectorVersion,
  });
  const outDir = arg(argv, 'out', null);
  if (outDir) {
    const written = writeOutputs(summary, outDir);
    console.log(`wrote ${path.relative(ROOT, written)}/summary.json`);
    console.log(`wrote ${path.relative(ROOT, written)}/report.md`);
    console.log(`wrote ${path.relative(ROOT, written)}/manifest.tsv`);
    console.log('');
  }
  if (has(argv, 'json')) console.log(JSON.stringify(summary, null, 2));
  else printSummary(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error(err?.stack || err?.message || String(err));
    process.exit(1);
  });
}
