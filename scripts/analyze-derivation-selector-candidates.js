#!/usr/bin/env node
/**
 * Candidate selector analysis over existing dramatic-derivation artifacts.
 *
 * This is an offline policy-search tool, not a new runtime selector. It asks:
 * which shallow H/V decision rules would have reduced regret on completed
 * first-pass arms, and which critical cases remain unexplained?
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  buildWorldIR,
  selectGuardRepresentation,
  selectGuardRepresentationV1,
  selectGuardRepresentationV2,
  selectGuardRepresentationV3,
  selectGuardRepresentationV4,
} from '../services/dramaticDerivation/index.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

const DEFAULT_SUMMARY = 'exports/dramatic-derivation/selector-consolidation-all.json';
const DEFAULT_OUT = 'exports/dramatic-derivation/selector-candidate-analysis.md';
const DEFAULT_CRITICAL = [
  'hethel-selector-v1-selective-r2',
  'hethel-selector-codexlearner-selective-v1-r4',
  'withercombe-selector-selective-r1',
  'withercombe-selector-selective-r4',
];

function usage() {
  return `Usage: node scripts/analyze-derivation-selector-candidates.js [options]

Options:
  --summary <json>       Consolidation summary JSON. Default: ${DEFAULT_SUMMARY}
  --out <md>             Markdown report path. Default: ${DEFAULT_OUT}
  --critical <csv>       Selected labels to detail. Default: ${DEFAULT_CRITICAL.join(',')}
  --json                 Print JSON summary to stdout.
  --help                 Show this help.

This tool makes no model calls. It scores completed artifacts only.
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function worldFiles() {
  const dir = path.resolve(ROOT, 'config/drama-derivation');
  return fs
    .readdirSync(dir)
    .filter((name) => /^world-.+\.ya?ml$/u.test(name))
    .map((name) => path.join(dir, name));
}

function loadWorldIndex() {
  const entries = [];
  for (const file of worldFiles()) {
    const world = loadWorld(file);
    const ir = buildWorldIR(world, { source: path.relative(ROOT, file) });
    const v0 = selectGuardRepresentation(ir);
    const v1Decay = selectGuardRepresentationV1(ir, { decayEnabled: true });
    const v2Decay = selectGuardRepresentationV2(ir, { decayEnabled: true });
    const v3Decay = selectGuardRepresentationV3(ir, { decayEnabled: true });
    const v4Decay = selectGuardRepresentationV4(ir, { decayEnabled: true });
    const pressure = v2Decay.input.consolidatedProofPressure;
    const dead = v2Decay.input.mirrorDeadPredicateDecoy;
    entries.push([
      world.id,
      {
        file: path.relative(ROOT, file),
        world,
        ir,
        features: {
          independentTopLevelJoin: ir.proofGraph.secretProof.independentTopLevelJoin,
          topBranchCount: ir.proofGraph.secretProof.topBranches.length,
          branchOverlapCount: ir.proofGraph.secretProof.branchOverlap.length,
          deadPredicatePresent: dead.present,
          deadPredicateCandidates: dead.candidates.map((row) => row.predicate),
          proofCriticalSourcePremiseCount: pressure.proofCriticalSourcePremiseCount,
          sharedCriticalSourcePremiseCount: pressure.sharedCriticalSourcePremiseCount,
          sharedCriticalSourcePremiseIds: pressure.sharedCriticalSourcePremiseIds,
          tutorCriticalSourcePremiseCount: pressure.tutorCriticalSourcePremiseCount,
          directorCriticalSourcePremiseCount: pressure.directorCriticalSourcePremiseCount,
        },
        selectors: {
          v0,
          v1Decay,
          v2Decay,
          v3Decay,
          v4Decay,
        },
      },
    ]);
  }
  return new Map(entries);
}

function armChoice(comparison, choice) {
  const arms = comparison.arms || {};
  if (choice === 'hidden') return arms.hidden || null;
  if (choice === 'visible') return arms.visible || arms['selective-v2'] || arms['selective-v1'] || arms.selective || null;
  return null;
}

function currentSelectedArm(comparison) {
  if (!comparison.selected) return null;
  const arms = comparison.arms || {};
  return arms[comparison.selected.arm] || null;
}

function isGrounded(row) {
  return Boolean(row?.grounded);
}

function comparable(comparison) {
  return Boolean(comparison?.arms?.hidden && comparison?.arms?.visible);
}

function oracleChoice(comparison) {
  const h = armChoice(comparison, 'hidden');
  const v = armChoice(comparison, 'visible');
  if (!h || !v) return null;
  if (v.grounded && !h.grounded) return 'visible';
  return 'hidden';
}

function parseEcho(reason) {
  const match = String(reason || '').match(/echo ([0-9.]+)/u);
  return match ? Number(match[1]) : null;
}

function firstVisibleIntervention(comparison) {
  const guard = comparison.firstSelectedGuardIntervention || null;
  if (!guard || guard.guard !== 'visible') return null;
  return {
    ...guard,
    echo: parseEcho(guard.reason),
  };
}

function visibleProbeChoice(comparison, { includePush = false, echoThreshold = 0.3 } = {}) {
  const guard = firstVisibleIntervention(comparison);
  if (!guard) return 'hidden';
  if (includePush && guard.kind === 'push') return 'visible';
  if (guard.kind === 'block' && guard.echo !== null && guard.echo >= echoThreshold) return 'visible';
  return 'hidden';
}

function worldChoice(comparison, worlds, selectorName) {
  const world = worlds.get(comparison.worldId);
  if (!world) return 'hidden';
  if (selectorName === 'static_v0') return world.selectors.v0.selected;
  if (selectorName === 'static_v1_decay') return world.selectors.v1Decay.selected;
  if (selectorName === 'static_v2_decay') return world.selectors.v2Decay.selected;
  return 'hidden';
}

function candidateDefinitions(worlds) {
  const candidates = [
    {
      name: 'always_hidden',
      kind: 'static',
      description: 'Always route to hidden.',
      choose: () => 'hidden',
    },
    {
      name: 'always_visible',
      kind: 'static',
      description: 'Always route to visible.',
      choose: () => 'visible',
    },
    {
      name: 'static_v0_geometry',
      kind: 'static',
      description: 'Current v0 geometry selector: hidden for independent top-level joins, visible otherwise.',
      choose: (comparison) => worldChoice(comparison, worlds, 'static_v0'),
    },
    {
      name: 'static_v1_decay',
      kind: 'static',
      description: 'v1 selector under decay: independent joins hidden; mirror dead-predicate worlds visible; otherwise fail closed.',
      choose: (comparison) => worldChoice(comparison, worlds, 'static_v1_decay'),
    },
    {
      name: 'static_v2_decay',
      kind: 'static',
      description: 'v2 selector under decay: hidden for independent joins or shared critical source pressure.',
      choose: (comparison) => worldChoice(comparison, worlds, 'static_v2_decay'),
    },
    {
      name: 'runtime_probe_visible_push_only',
      kind: 'runtime_probe',
      description: 'Visible only when the selected visible trace first intervenes by pushing a premise for visible stall; otherwise hidden.',
      choose: (comparison) => {
        const guard = firstVisibleIntervention(comparison);
        return guard?.kind === 'push' ? 'visible' : 'hidden';
      },
    },
  ];

  for (const includePush of [false, true]) {
    for (const threshold of [0.1, 0.15, 0.18, 0.2, 0.23, 0.25, 0.27, 0.29, 0.3, 0.32]) {
      const name = `runtime_probe_${includePush ? 'push_or_' : ''}block_echo_gte_${threshold.toFixed(2)}`;
      candidates.push({
        name,
        kind: 'runtime_probe',
        description: `Visible only when the selected visible trace has ${includePush ? 'a visible push or ' : ''}a first visible block with echo >= ${threshold.toFixed(2)}; otherwise hidden.`,
        choose: (comparison) => visibleProbeChoice(comparison, { includePush, echoThreshold: threshold }),
      });
    }
  }
  return candidates;
}

function scoreCandidate(candidate, comparisons) {
  const rows = [];
  const totals = {
    n: 0,
    success: 0,
    oracleSuccess: 0,
    regret: 0,
    matchesOracleChoice: 0,
    choseVisible: 0,
    visibleBeatsHidden: 0,
    hiddenBeatsVisible: 0,
    unnecessaryVisible: 0,
    negativeTransferVsHidden: 0,
    skipped: 0,
  };

  for (const comparison of comparisons) {
    if (!comparable(comparison)) {
      totals.skipped += 1;
      continue;
    }
    const choice = candidate.choose(comparison);
    const selected = armChoice(comparison, choice);
    const hidden = armChoice(comparison, 'hidden');
    const visible = armChoice(comparison, 'visible');
    const oracle = oracleChoice(comparison);
    if (!selected || !hidden || !visible || !oracle) {
      totals.skipped += 1;
      continue;
    }
    const selectedSuccess = isGrounded(selected) ? 1 : 0;
    const oracleSuccess = isGrounded(armChoice(comparison, oracle)) ? 1 : 0;
    totals.n += 1;
    totals.success += selectedSuccess;
    totals.oracleSuccess += oracleSuccess;
    totals.regret += oracleSuccess - selectedSuccess;
    if (choice === oracle) totals.matchesOracleChoice += 1;
    if (choice === 'visible') totals.choseVisible += 1;
    if (visible.grounded && !hidden.grounded) totals.visibleBeatsHidden += 1;
    if (hidden.grounded && !visible.grounded) totals.hiddenBeatsVisible += 1;
    if (choice === 'visible' && visible.grounded && hidden.grounded) totals.unnecessaryVisible += 1;
    if (choice === 'visible' && hidden.grounded && !visible.grounded) totals.negativeTransferVsHidden += 1;
    rows.push({
      key: comparison.key,
      group: comparison.group,
      run: comparison.run,
      worldId: comparison.worldId,
      classification: comparison.classification,
      choice,
      oracle,
      selectedSuccess: Boolean(selectedSuccess),
      hiddenSuccess: Boolean(hidden.grounded),
      visibleSuccess: Boolean(visible.grounded),
      regret: oracleSuccess - selectedSuccess,
    });
  }

  return {
    name: candidate.name,
    kind: candidate.kind,
    description: candidate.description,
    totals,
    rows,
  };
}

function selectorRecordedScore(comparisons) {
  const totals = {
    n: 0,
    success: 0,
    hiddenSuccess: 0,
    regretVsHidden: 0,
    negativeTransferVsHidden: 0,
    choseVisible: 0,
    skipped: 0,
  };
  const rows = [];
  for (const comparison of comparisons) {
    const selected = currentSelectedArm(comparison);
    const hidden = armChoice(comparison, 'hidden');
    if (!selected || !hidden) {
      totals.skipped += 1;
      continue;
    }
    const selectedSuccess = isGrounded(selected);
    const hiddenSuccess = isGrounded(hidden);
    totals.n += 1;
    if (selectedSuccess) totals.success += 1;
    if (hiddenSuccess) totals.hiddenSuccess += 1;
    if (comparison.selected?.selected === 'visible') totals.choseVisible += 1;
    const regret = (hiddenSuccess ? 1 : 0) - (selectedSuccess ? 1 : 0);
    totals.regretVsHidden += regret;
    if (regret > 0) totals.negativeTransferVsHidden += 1;
    rows.push({
      key: comparison.key,
      group: comparison.group,
      run: comparison.run,
      worldId: comparison.worldId,
      classification: comparison.classification,
      selected: comparison.selected?.selected || null,
      selectedSuccess,
      hiddenSuccess,
      regretVsHidden: regret,
    });
  }
  return {
    name: 'recorded_selector',
    kind: 'observed',
    description: 'Observed selective arm result compared with the hidden arm when both exist.',
    totals,
    rows,
  };
}

function criticalCase(comparison, worlds) {
  const world = worlds.get(comparison.worldId);
  const guard = firstVisibleIntervention(comparison);
  return {
    key: comparison.key,
    group: comparison.group,
    run: comparison.run,
    worldId: comparison.worldId,
    classification: comparison.classification,
    selected: comparison.selected,
    arms: {
      baseline: comparison.arms?.baseline || null,
      hidden: comparison.arms?.hidden || null,
      visible: comparison.arms?.visible || null,
      selective:
        comparison.arms?.['selective-v4'] ||
        comparison.arms?.['selective-v3'] ||
        comparison.arms?.['selective-v2'] ||
        comparison.arms?.['selective-v1'] ||
        comparison.arms?.selective ||
        null,
    },
    worldFeatures: world?.features || null,
    staticSelectors: world
      ? {
          v0: pickSelector(world.selectors.v0),
          v1Decay: pickSelector(world.selectors.v1Decay),
          v2Decay: pickSelector(world.selectors.v2Decay),
          v3Decay: pickSelector(world.selectors.v3Decay),
          v4Decay: pickSelector(world.selectors.v4Decay),
        }
      : null,
    firstVisibleIntervention: guard,
  };
}

function pickSelector(selector) {
  return {
    selected: selector.selected,
    gate: selector.gate || selector.geometryFamily || null,
    reason: selector.reason,
  };
}

function bestCandidates(scores) {
  return [...scores].sort(
    (a, b) =>
      a.totals.regret - b.totals.regret ||
      b.totals.success - a.totals.success ||
      a.totals.negativeTransferVsHidden - b.totals.negativeTransferVsHidden ||
      a.totals.choseVisible - b.totals.choseVisible ||
      a.name.localeCompare(b.name),
  );
}

export function analyzeSelectorCandidates(summary, { criticalLabels = DEFAULT_CRITICAL } = {}) {
  const worlds = loadWorldIndex();
  const comparisons = summary.comparisons || [];
  const candidateScores = candidateDefinitions(worlds).map((candidate) => scoreCandidate(candidate, comparisons));
  const ranked = bestCandidates(candidateScores);
  const critical = [];
  const criticalSet = new Set(criticalLabels);
  for (const comparison of comparisons) {
    if (comparison.selected?.label && criticalSet.has(comparison.selected.label)) {
      critical.push(criticalCase(comparison, worlds));
    }
  }
  return {
    schema: 'dramatic-derivation.selector-candidate-analysis.v0',
    generatedAt: new Date().toISOString(),
    source: {
      summarySchema: summary.schema,
      comparisons: comparisons.length,
      criticalLabels,
    },
    recordedSelector: selectorRecordedScore(comparisons),
    candidates: candidateScores,
    rankedCandidates: ranked.slice(0, 10).map((row) => ({
      name: row.name,
      kind: row.kind,
      totals: row.totals,
      description: row.description,
    })),
    criticalCases: critical,
  };
}

function pct(num, den) {
  if (!den) return 'n/a';
  return `${Math.round((num / den) * 100)}%`;
}

function armCell(row) {
  if (!row) return '-';
  return `${row.verdict} t${row.turns} D${row.finalD}`;
}

function renderTable(rows) {
  return rows.join('\n');
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Selector Candidate Analysis', '');
  lines.push(`Generated: ${report.generatedAt}`, '');
  lines.push('## Recorded Selector', '');
  const rs = report.recordedSelector.totals;
  lines.push(
    `Observed selective arms: ${rs.success}/${rs.n} success (${pct(rs.success, rs.n)}), hidden comparator ${rs.hiddenSuccess}/${rs.n}, regret vs hidden ${rs.regretVsHidden}, negative transfers ${rs.negativeTransferVsHidden}.`,
    '',
  );
  lines.push('## Candidate Ranking', '');
  lines.push('| candidate | kind | success | regret vs H/V oracle | negative transfer vs hidden | chose visible | note |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const row of report.rankedCandidates) {
    lines.push(
      `| ${row.name} | ${row.kind} | ${row.totals.success}/${row.totals.n} | ${row.totals.regret} | ${row.totals.negativeTransferVsHidden} | ${row.totals.choseVisible} | ${row.description} |`,
    );
  }
  lines.push('', '## Critical Cases', '');
  for (const c of report.criticalCases) {
    const f = c.worldFeatures || {};
    lines.push(`### ${c.selected?.label || c.key}`, '');
    lines.push(`Classification: **${c.classification}**. World: ${c.worldId}.`);
    lines.push('');
    lines.push('| arm | result |');
    lines.push('| --- | --- |');
    lines.push(`| baseline | ${armCell(c.arms.baseline)} |`);
    lines.push(`| hidden | ${armCell(c.arms.hidden)} |`);
    lines.push(`| visible | ${armCell(c.arms.visible)} |`);
    lines.push(`| selective | ${armCell(c.arms.selective)} |`);
    lines.push('');
    lines.push(
      `WorldIR: independentJoin=${Boolean(f.independentTopLevelJoin)}, deadPredicate=${Boolean(
        f.deadPredicatePresent,
      )}, sharedCritical=${f.sharedCriticalSourcePremiseCount ?? 'n/a'} [${(f.sharedCriticalSourcePremiseIds || []).join(', ')}], proofCriticalSources=${
        f.proofCriticalSourcePremiseCount ?? 'n/a'
      }.`,
    );
    if (c.staticSelectors) {
      lines.push(
        `Static selectors: v0=${c.staticSelectors.v0.selected}/${c.staticSelectors.v0.gate}; v1=${c.staticSelectors.v1Decay.selected}/${c.staticSelectors.v1Decay.gate}; v2=${c.staticSelectors.v2Decay.selected}/${c.staticSelectors.v2Decay.gate}.`,
      );
    }
    if (c.firstVisibleIntervention) {
      const g = c.firstVisibleIntervention;
      lines.push(
        `First visible intervention: t${g.turn} ${g.kind} ${g.premise || ''}${g.echo !== null ? `, echo=${g.echo}` : ''}. ${g.reason || ''}`,
      );
    } else {
      lines.push('First visible intervention: none before the recorded divergence/failure.');
    }
    lines.push('');
  }
  lines.push('## Interpretation', '');
  lines.push(
    'Static world-level selectors still cannot discriminate the decisive Hethel split: Hethel r2 and the Hethel Codex-learner failure share the same authored WorldIR. A better selector therefore needs either a runtime probe signal or a more specific learner-board consolidation signal, not only authored proof geometry.',
    '',
  );
  const best = report.rankedCandidates[0];
  lines.push(
    `Best offline candidate in this pass: ${best.name}. It is a ${best.kind} rule with regret ${best.totals.regret} on ${best.totals.n} comparable H/V groups. Treat this as a replay hypothesis only; it must be promoted through prefix-controlled real replay and then fresh first-pass loops before changing the main selector.`,
    '',
  );
  return renderTable(lines);
}

async function main() {
  const args = process.argv.slice(2);
  if (has(args, 'help')) {
    console.log(usage());
    return;
  }
  const summaryPath = resolveFromRoot(arg(args, 'summary', DEFAULT_SUMMARY));
  const outPath = resolveFromRoot(arg(args, 'out', DEFAULT_OUT));
  const criticalLabels = splitCsv(arg(args, 'critical', DEFAULT_CRITICAL.join(',')));
  const report = analyzeSelectorCandidates(readJson(summaryPath), { criticalLabels });

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderMarkdown(report));
  const jsonPath = outPath.replace(/\.md$/iu, '.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, outPath)}`);
  console.log(`wrote ${path.relative(ROOT, jsonPath)}`);

  if (has(args, 'json')) console.log(JSON.stringify(report, null, 2));
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
