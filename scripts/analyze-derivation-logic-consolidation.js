#!/usr/bin/env node
/**
 * Artifact-only consolidated logic analysis for dramatic-derivation runs.
 *
 * Existing selector artifacts before 2026-06-14 do not carry result.logicSnapshots.
 * This script replays saved transcript metadata plus the corruption ledger to
 * reconstruct the same board-closure projection without rerunning any role.
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildWorldIR,
  loadWorld,
  logicProjectionReport,
  projectWorldIRLogic,
} from '../services/dramaticDerivation/index.js';
import { factKey } from '../services/dramaticDerivation/chainer.js';
import { derivationDistance } from '../services/dramaticDerivation/slope.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DEFAULT_LOOP_DIR = 'exports/dramatic-derivation/loop';
const DEFAULT_OUT = 'exports/dramatic-derivation/logic-consolidation-existing-artifacts';
const DEFAULT_WORLDS = ['withercombe', 'fengate', 'hethel'];
const DEFAULT_PATTERNS = [
  '*-selector-baseline-r*',
  '*-selector-hidden-r*',
  '*-selector-visible-r*',
  '*-selector-selective-r*',
  '*-selector-v1-baseline-r*',
  '*-selector-v1-hidden-r*',
  '*-selector-v1-visible-r*',
  '*-selector-v1-selective-r*',
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback;
}

function has(name) {
  return process.argv.includes(`--${name}`);
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

function escapeRegExp(s) {
  return s.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob) {
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

function matchesAny(label, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(label));
}

function parseLabel(label) {
  const match = String(label).match(
    /^(?<world>.+?)-selector(?:-(?<version>v\d+))?-(?<arm>baseline|hidden|visible|selective)-r(?<run>\d+)$/,
  );
  if (!match) return null;
  return {
    world: match.groups.world,
    version: match.groups.version || 'v0',
    arm: match.groups.arm,
    run: Number(match.groups.run),
  };
}

function collectLabels(loopDir, worlds, patterns) {
  const labels = [];
  for (const entry of fs.readdirSync(loopDir)) {
    const parsed = parseLabel(entry);
    if (!parsed || !worlds.includes(parsed.world)) continue;
    if (!matchesAny(entry, patterns)) continue;
    const dir = path.join(loopDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!fs.existsSync(path.join(dir, 'result.json'))) continue;
    if (!fs.existsSync(path.join(dir, 'diagnosis.json'))) continue;
    labels.push(entry);
  }
  return labels.sort((a, b) => {
    const pa = parseLabel(a);
    const pb = parseLabel(b);
    return (
      pa.world.localeCompare(pb.world) ||
      pa.version.localeCompare(pb.version) ||
      pa.arm.localeCompare(pb.arm) ||
      pa.run - pb.run
    );
  });
}

function groupByTurn(rows = []) {
  const byTurn = new Map();
  for (const row of rows) {
    if (!byTurn.has(row.turn)) byTurn.set(row.turn, []);
    byTurn.get(row.turn).push(row);
  }
  return byTurn;
}

function mapWorldFacts(world) {
  const premiseById = new Map((world.premises || []).map((premise) => [premise.id, premise]));
  const idByFactKey = new Map((world.premises || []).map((premise) => [factKey(premise.fact), premise.id]));
  return { premiseById, idByFactKey };
}

function validGroundedFacts(grounded) {
  return [...grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);
}

function decayedPremiseIds(grounded, idByFactKey) {
  return [...grounded.entries()]
    .filter(([, entry]) => entry.decayed)
    .map(([key]) => idByFactKey.get(key))
    .filter(Boolean)
    .sort();
}

function groundedPremiseIds(grounded, idByFactKey) {
  return validGroundedFacts(grounded)
    .map((fact) => idByFactKey.get(factKey(fact)))
    .filter(Boolean)
    .sort();
}

function reconstructLogicSnapshots(result, world) {
  if (Array.isArray(result.logicSnapshots) && result.logicSnapshots.length) return result.logicSnapshots;
  const worldIR = buildWorldIR(world);
  const { premiseById, idByFactKey } = mapWorldFacts(world);
  const backgroundKeys = new Set((world.background || []).map(factKey));
  const grounded = new Map((world.background || []).map((fact) => [factKey(fact), { fact, valid: true, decayed: false }]));
  const releasedKeys = new Set();
  const releasedPremiseIds = [];
  const voicedLedger = [];
  const voicedKeys = new Set();
  const learnerByTurn = groupByTurn((result.transcript || []).filter((line) => line.role === 'learner'));
  const releasesByTurn = groupByTurn(result.ledger || []);
  const corruptionByTurn = groupByTurn(result.corruption?.ledger || []);
  const trajectoryByTurn = new Map((result.trajectory || []).map((point) => [point.turn, point]));
  const snapshots = [];

  for (let turn = 1; turn <= (result.turnsPlayed || 0); turn += 1) {
    for (const release of releasesByTurn.get(turn) || []) {
      const premise = premiseById.get(release.premiseId);
      if (!premise) continue;
      releasedKeys.add(factKey(premise.fact));
      releasedPremiseIds.push(release.premiseId);
    }

    for (const row of corruptionByTurn.get(turn) || []) {
      if (row.type !== 'repair') continue;
      const premise = premiseById.get(row.premiseId);
      if (!premise) continue;
      const key = factKey(premise.fact);
      const entry = grounded.get(key) || { fact: premise.fact, valid: true };
      entry.decayed = false;
      grounded.set(key, entry);
    }

    for (const line of learnerByTurn.get(turn) || []) {
      const meta = line.meta || {};
      for (const fact of meta.retract || []) grounded.delete(factKey(fact));
      for (const fact of meta.adopt || []) {
        const key = factKey(fact);
        const existing = grounded.get(key);
        if (existing) {
          existing.decayed = false;
          continue;
        }
        grounded.set(key, { fact, valid: releasedKeys.has(key) || backgroundKeys.has(key), decayed: false });
      }
      for (const outcome of meta.deriveOutcomes || []) {
        if (outcome.status !== 'voiced' || !Array.isArray(outcome.fact)) continue;
        const key = factKey(outcome.fact);
        if (voicedKeys.has(key)) continue;
        voicedKeys.add(key);
        voicedLedger.push({ fact: outcome.fact, turn });
      }
    }

    for (const row of corruptionByTurn.get(turn) || []) {
      if (row.type === 'retract_false' && Array.isArray(row.falseForm)) {
        grounded.delete(factKey(row.falseForm));
        continue;
      }
      if (row.type !== 'decay') continue;
      const premise = premiseById.get(row.premiseId);
      if (!premise) continue;
      const key = factKey(premise.fact);
      const entry = grounded.get(key) || { fact: premise.fact, valid: true };
      entry.decayed = true;
      grounded.set(key, entry);
      if (Array.isArray(row.falseForm)) {
        grounded.set(factKey(row.falseForm), {
          fact: row.falseForm,
          valid: false,
          decayed: false,
          mutatedFalse: true,
        });
      }
    }

    const valid = validGroundedFacts(grounded);
    const trajectory = trajectoryByTurn.get(turn) || {};
    const projection = projectWorldIRLogic(worldIR, {
      groundedFacts: valid,
      voicedFacts: voicedLedger.map((entry) => entry.fact),
      releasedPremiseIds,
      decayedPremiseIds: decayedPremiseIds(grounded, idByFactKey),
    });
    snapshots.push({
      turn,
      trajectoryD: trajectory.D ?? derivationDistance(world, valid),
      boardD: derivationDistance(world, valid),
      forced: Boolean(trajectory.forced),
      groundedPremiseIds: groundedPremiseIds(grounded, idByFactKey),
      releasedPremiseIds: [...releasedPremiseIds],
      decayedPremiseIds: decayedPremiseIds(grounded, idByFactKey),
      projection,
      reconstructed: true,
    });
  }

  return snapshots;
}

function first(values) {
  return values?.length ? values[0] : null;
}

function last(values) {
  return values?.length ? values[values.length - 1] : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function classifyRun({ diagnosis, projection }) {
  if (diagnosis.verdict === 'grounded_anagnorisis') return 'grounded';
  const final = last(projection.turns);
  const secretTurns = projection.summary.secretDerivedTurns || [];
  const finalMissing = final?.secret?.missingSourcePremiseIds || [];
  const finalDecayed = final?.secret?.decayedSourcePremiseIds || [];
  const lucky = (diagnosis.eventsByType?.lucky_leap || 0) + (diagnosis.eventsByType?.lucky_leap_only || 0);
  if (lucky) return 'assertion_artifact';
  if (secretTurns.length || diagnosis.firstForcedTurn !== null) return 'closed_graph_but_no_grounded_assertion';
  if (finalDecayed.length) return 'decayed_proof_graph_gap';
  if (finalMissing.length) return 'unclosed_proof_graph_gap';
  return 'dialogue_or_detector_failure';
}

function summarizeRun({ label, loopDir }) {
  const parsed = parseLabel(label);
  const dir = path.join(loopDir, label);
  const diagnosis = readJson(path.join(dir, 'diagnosis.json'));
  const result = readJson(path.join(dir, 'result.json'));
  const worldPath = diagnosis.worldPath || result.worldPath;
  const world = loadWorld(resolveFromRoot(worldPath));
  const logicSnapshots = reconstructLogicSnapshots(result, world);
  const projection = logicProjectionReport({ ...result, logicSnapshots }, world);
  const final = last(projection.turns);
  const secretTurns = projection.summary.secretDerivedTurns || [];
  const mirrorTurns = projection.summary.mirrorDerivedTurns || [];
  const decayedCritical = projection.summary.decayedProofCriticalTurns || [];
  const failureClass = classifyRun({ diagnosis, projection });
  return {
    label,
    ...parsed,
    verdict: diagnosis.verdict,
    grounded: diagnosis.verdict === 'grounded_anagnorisis',
    selected: diagnosis.pacingGuardSelector?.selected || (diagnosis.visibleGuard ? 'visible' : diagnosis.pacingGuard ? 'hidden' : 'none'),
    gate: diagnosis.pacingGuardSelector?.gate || null,
    turns: diagnosis.turnsPlayed,
    finalD: final?.trajectoryD ?? null,
    finalBoardD: final?.boardD ?? null,
    firstForcedTurn: diagnosis.firstForcedTurn ?? null,
    assertedGroundedTurn: diagnosis.assertedGroundedTurn ?? null,
    forcedToAssertedGap: diagnosis.forcedToAssertedGap ?? null,
    overreach: diagnosis.learnerInference?.overreachCount ?? 0,
    lucky:
      (diagnosis.eventsByType?.lucky_leap || 0) + (diagnosis.eventsByType?.lucky_leap_only || 0),
    logic: {
      reconstructed: !Array.isArray(result.logicSnapshots),
      turns: projection.summary.turns,
      firstSecretDerivedTurn: first(secretTurns),
      firstMirrorDerivedTurn: first(mirrorTurns),
      derivedUnvoicedPeak: projection.summary.derivedUnvoicedPeak,
      firedHyperedgesPeak: projection.summary.firedHyperedgesPeak,
      decayedCriticalTurns: decayedCritical,
      finalSecretMissing: final?.secret?.missingSourcePremiseIds || [],
      finalSecretDecayed: final?.secret?.decayedSourcePremiseIds || [],
      finalMirrorDerived: Boolean(final?.mirror?.derived),
      finalDerivedUnvoiced: (final?.derivedUnvoiced || []).map((node) => node.factKey),
      finalFiredRules: (final?.firedHyperedges || []).map((edge) => edge.ruleId),
    },
    failureClass,
  };
}

function groupRows(rows, keys) {
  const map = new Map();
  for (const row of rows) {
    const key = keys.map((k) => row[k]).join('\t');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function renderTable(rows) {
  const lines = [
    '| World | Version | Arm | Complete | Grounded | Failure classes | Final missing | Decayed critical | Secret derived | Mirror derived |',
    '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
  ];
  const groups = groupRows(rows, ['world', 'version', 'arm']);
  for (const [key, group] of [...groups.entries()].sort()) {
    const [world, version, arm] = key.split('\t');
    const grounded = group.filter((row) => row.grounded).length;
    const classes = {};
    for (const row of group.filter((r) => !r.grounded)) classes[row.failureClass] = (classes[row.failureClass] || 0) + 1;
    const finalMissing = unique(group.flatMap((row) => row.logic.finalSecretMissing));
    const decayed = unique(group.flatMap((row) => row.logic.decayedCriticalTurns.flatMap((t) => t.premises)));
    const secretDerived = group.filter((row) => row.logic.firstSecretDerivedTurn !== null).length;
    const mirrorDerived = group.filter((row) => row.logic.firstMirrorDerivedTurn !== null).length;
    lines.push(
      `| ${world} | ${version} | ${arm} | ${group.length} | ${grounded}/${group.length} | ${
        Object.keys(classes).length ? Object.entries(classes).map(([k, v]) => `${k} x${v}`).join('; ') : '-'
      } | ${finalMissing.join(', ') || '-'} | ${decayed.join(', ') || '-'} | ${secretDerived}/${group.length} | ${mirrorDerived}/${group.length} |`,
    );
  }
  return lines;
}

function renderFailureTable(rows) {
  const failures = rows.filter((row) => !row.grounded);
  const lines = [
    '| Label | Verdict | Selected | Final D | Final board D | Missing secret sources | Decayed secret sources | Secret derived | Mirror derived | Class |',
    '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
  ];
  for (const row of failures) {
    lines.push(
      `| \`${row.label}\` | ${row.verdict} | ${row.selected}${row.gate ? ` (${row.gate})` : ''} | ${row.finalD ?? '-'} | ${
        row.finalBoardD ?? '-'
      } | ${row.logic.finalSecretMissing.join(', ') || '-'} | ${row.logic.finalSecretDecayed.join(', ') || '-'} | ${
        row.logic.firstSecretDerivedTurn ?? '-'
      } | ${row.logic.firstMirrorDerivedTurn ?? '-'} | ${row.failureClass} |`,
    );
  }
  return lines;
}

function interpretation(rows) {
  const failures = rows.filter((row) => !row.grounded);
  const graphGap = failures.filter((row) => row.failureClass.includes('proof_graph_gap')).length;
  const closed = failures.filter((row) => row.failureClass === 'closed_graph_but_no_grounded_assertion').length;
  const artifact = failures.filter((row) => row.failureClass === 'assertion_artifact').length;
  const lines = [];
  lines.push(
    `Across ${rows.length} existing artifacts, ${failures.length} are non-grounded. The reconstructed consolidated board/proof graph explains ${graphGap}/${failures.length} failures as an unclosed or decay-opened proof gap at the learner board, without needing separate hidden/visible stories.`,
  );
  if (closed) {
    lines.push(
      `${closed} failure(s) have the secret derivable/forced but no grounded assertion, so those are better read as recognition/prose/detector failures than as representation-route failures.`,
    );
  }
  if (artifact) {
    lines.push(`${artifact} failure(s) are contaminated by lucky-leap assertion artifacts.`);
  }
  const byWorld = groupRows(failures, ['world']);
  for (const [world, group] of [...byWorld.entries()].sort()) {
    const missing = unique(group.flatMap((row) => row.logic.finalSecretMissing));
    const decayed = unique(group.flatMap((row) => row.logic.finalSecretDecayed));
    lines.push(
      `- ${world}: ${group.length} failure(s); final missing sources ${missing.join(', ') || 'none'}${
        decayed.length ? `; decayed secret sources ${decayed.join(', ')}` : ''
      }.`,
    );
  }
  return lines;
}

function renderReport({ rows, loopDir, outDir }) {
  const now = new Date().toISOString();
  return [
    '# Consolidated Logic Analysis — Existing Derivation Artifacts',
    '',
    `Generated: ${now}.`,
    '',
    'Question: can Withercombe/Fengate/Hethel failures be explained from one consolidated learner-board/proof graph instead of separate hidden/visible stories?',
    '',
    'Method: read saved `result.json`/`diagnosis.json`; replay transcript metadata, release ledger, and corruption ledger; project each reconstructed board through `WorldIR.logic`; no learner/tutor/critic calls.',
    '',
    `Source loop dir: \`${path.relative(ROOT, loopDir)}\`. Output dir: \`${path.relative(ROOT, outDir)}\`.`,
    '',
    '## Summary By World/Arm',
    '',
    ...renderTable(rows),
    '',
    '## Failure Rows',
    '',
    ...renderFailureTable(rows),
    '',
    '## Interpretation',
    '',
    ...interpretation(rows),
    '',
    '## Caveats',
    '',
    '- This is a replay over saved public harness metadata; it does not re-run any model and does not change verdicts.',
    '- Existing artifacts did not contain `logicSnapshots`, so all included rows are reconstructed from transcript metadata and corruption ledgers.',
    '- A consolidated graph can explain board closure and missing/decayed proof sources; it cannot by itself explain style/prose uptake or model-induced changes in future Codex-learner reruns.',
    '',
  ].join('\n');
}

async function main() {
  if (has('help')) {
    console.log(`Usage: node scripts/analyze-derivation-logic-consolidation.js [--worlds a,b,c] [--patterns glob,glob] [--loop-dir dir] [--out dir] [--json]`);
    return;
  }
  const loopDir = resolveFromRoot(arg('loop-dir', DEFAULT_LOOP_DIR));
  const outDir = resolveFromRoot(arg('out', DEFAULT_OUT));
  const worlds = splitCsv(arg('worlds', DEFAULT_WORLDS.join(',')));
  const patterns = splitCsv(arg('patterns', DEFAULT_PATTERNS.join(',')));
  const labels = collectLabels(loopDir, worlds, patterns);
  const rows = labels.map((label) => summarizeRun({ label, loopDir }));
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    schema: 'dramatic-derivation.logic-consolidation-analysis.v0',
    generatedAt: new Date().toISOString(),
    loopDir: path.relative(ROOT, loopDir),
    worlds,
    patterns,
    rows,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'report.md'), renderReport({ rows, loopDir, outDir }));
  if (has('json')) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  else console.log(`wrote ${path.relative(ROOT, path.join(outDir, 'report.md'))} (${rows.length} rows)`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export { reconstructLogicSnapshots, summarizeRun };
