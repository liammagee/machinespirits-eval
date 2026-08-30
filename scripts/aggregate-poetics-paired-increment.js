#!/usr/bin/env node
/**
 * EDRA FIX 5 — paired-increment aggregator for the adaptation-recognition arc.
 *
 * The corrected positive-claim method (notes/poetics/2026-05-28-edra-m3-surgery-spec.md
 * D3 / "paired_increment_gate"): rather than rely on the critic-unreachable origin
 * vote, measure a CONTROL-DIFFERENCED increment. Each drama in an iteration is a
 * matched set forked from ONE shared prefix (generatePairedContinuations): one
 * peripeteia-only arm + the routine/none controls. Pairing by (runId, dramaId) is
 * therefore equivalent to pairing by shared_prefix_hash, and organic recognition that
 * appears in both arms differences out.
 *
 * Per matched drama:
 *   - VALID pair requires the peripeteia arm AND >= 1 control to be validly scored
 *     (>= minCritics critics, no quality_warning) — else invalid_coverage.
 *   - If any validly-scored control LEAKS recognition, the scenario is INVALIDATED
 *     (invalid_control_leak): a leaking control is not a clean baseline, so the
 *     contrast is uninterpretable (spec control_leakage_rate hard gate).
 *   - Otherwise lift = closure(peripeteia) in {0, +1}, where closure = the peripeteia
 *     arm passing the demoted gate (recognition 3/4 + actional + public mechanism +
 *     branch valid + quality/coverage ok; origin is a reported diagnostic, NOT gated).
 *
 * recognitive_closure_lift = mean lift over VALID pairs (a proportion), with a Wilson
 * interval. origin_ambiguity_rate is REPORTED alongside, never gates. This is pure
 * re-aggregation from the gate rows — no new scoring, no new generation.
 *
 * Usage:
 *   node scripts/aggregate-poetics-paired-increment.js --run-id <id> [--run-id <id> ...]
 *     [--db data/evaluations.db] [--out exports/paired-increment-<stamp>.json]
 *     --target-only D50,D53,<qualified-third> --analyzer-version tutor-adaptation-v5-semantic-change
 *     [--min-critics 4]
 *
 * Historical reproduction of the former D42/D50/D53 panel is explicit and
 * fail-closed. It may read either a database with complete v4 adaptation
 * measurements or the original emitted gate rows when those have been preserved:
 *   --target-only D42,D50,D53 --historical-v4 [--item-gates-in item_gates.jsonl]
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { openPoeticsStore } from '../services/poeticsStore.js';
import { evaluateRunGate } from './run-poetics-adaptation-loop.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PERI_ARM = 'peripeteia-only';
const CONTROL_ARMS = ['routine', 'none'];
const DEFAULT_TARGET_SPEC = path.join(ROOT, 'config', 'poetics-calibration', 'phase2-classic-drama-adaptation-v1.yaml');
const LEGACY_ANALYZER_VERSION = 'tutor-adaptation-v4';
const SEMANTIC_ANALYZER_VERSION = 'tutor-adaptation-v5-semantic-change';

function parseArgs(argv) {
  const a = {
    runIds: [],
    dbPath: null,
    out: null,
    itemGatesIn: null,
    itemGatesOut: null,
    targetOnly: [],
    targetSpec: DEFAULT_TARGET_SPEC,
    analyzerVersion: null,
    historicalV4: false,
    targetArms: ['routine', 'none', 'peripeteia-only'],
    minCritics: 4,
    recognitionVoteCut: 3,
    originVoteCut: 3,
    actionVoteCut: 3,
    controlMaxRecognitionVotes: 1,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--run-id') a.runIds.push(argv[++i]);
    else if (t === '--db') a.dbPath = path.resolve(argv[++i]);
    else if (t === '--out') a.out = path.resolve(argv[++i]);
    else if (t === '--item-gates-in') a.itemGatesIn = path.resolve(argv[++i]);
    else if (t === '--item-gates-out') a.itemGatesOut = path.resolve(argv[++i]);
    else if (t === '--target-only') a.targetOnly = String(argv[++i]).split(',').filter(Boolean);
    else if (t === '--target-spec') a.targetSpec = path.resolve(argv[++i]);
    else if (t === '--analyzer-version') a.analyzerVersion = argv[++i];
    else if (t === '--historical-v4') a.historicalV4 = true;
    else if (t === '--min-critics') a.minCritics = parseInt(argv[++i], 10);
    else if (t === '--help' || t === '-h') {
      console.log(
        'Usage: node scripts/aggregate-poetics-paired-increment.js --run-id <id> [--run-id <id> ...] [--db F] [--out F] [--historical-v4 --item-gates-in F]',
      );
      process.exit(0);
    } else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.runIds.length) throw new Error('need at least one --run-id');
  if (new Set(a.runIds).size !== a.runIds.length) throw new Error('--run-id values must be unique');
  if (!a.targetOnly.length) {
    throw new Error('--target-only is required; there is no implicit clean-anchor default');
  }
  if (new Set(a.targetOnly).size !== a.targetOnly.length) throw new Error('--target-only values must be unique');
  if (!Number.isInteger(a.minCritics) || a.minCritics < 1) throw new Error('--min-critics must be a positive integer');
  if (a.historicalV4) {
    if (a.analyzerVersion && a.analyzerVersion !== LEGACY_ANALYZER_VERSION) {
      throw new Error('--historical-v4 cannot be combined with a non-v4 analyzer');
    }
    a.analyzerVersion = LEGACY_ANALYZER_VERSION;
    if (a.itemGatesIn && a.dbPath) {
      throw new Error('--item-gates-in and --db are mutually exclusive historical evidence sources');
    }
  } else {
    if (a.itemGatesIn) {
      throw new Error('--item-gates-in is historical-reproduction-only; combine it with --historical-v4');
    }
    if (a.targetOnly.includes('D42')) {
      throw new Error('D42 is calibration-only; use --historical-v4 for explicit historical reproduction');
    }
    if (a.analyzerVersion !== SEMANTIC_ANALYZER_VERSION) {
      throw new Error(`new paired-increment claims require --analyzer-version ${SEMANTIC_ANALYZER_VERSION}`);
    }
    if (!fs.existsSync(a.targetSpec)) throw new Error(`--target-spec not found: ${a.targetSpec}`);
    const spec = yaml.parse(fs.readFileSync(a.targetSpec, 'utf8')) || {};
    const anchors = spec?.meta?.clean_anchor_set || {};
    if (!anchors.claim_gate_ready || anchors.status !== 'complete' || !anchors.qualified_third_anchor) {
      throw new Error('registered clean-anchor set is incomplete; paired-increment claims remain blocked');
    }
    const registeredTargets = [...(anchors.required_core || []), anchors.qualified_third_anchor];
    const requestedTargets = [...new Set(a.targetOnly)].sort();
    const canonicalTargets = [...new Set(registeredTargets)].sort();
    if (
      a.targetOnly.length !== requestedTargets.length ||
      requestedTargets.length !== canonicalTargets.length ||
      requestedTargets.some((target, index) => target !== canonicalTargets[index])
    ) {
      throw new Error(`--target-only must match the registered clean anchor set: ${registeredTargets.join(',')}`);
    }
  }
  return a;
}

// Wilson score interval for a binomial proportion k/n (z=1.96 → 95%).
function wilson(k, n, z = 1.96) {
  if (!n) return { low: 0, high: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (centre - spread) / denom), high: Math.min(1, (centre + spread) / denom) };
}

// A validly-scored item: enough critics after retries, no blocking quality warning.
function validScored(item, minCritics) {
  return Boolean(
    item &&
    (item.consensus?.totalCritics ?? 0) >= minCritics &&
    !item.failures.includes('quality_warning') &&
    !item.failures.includes('quality_status') &&
    !item.failures.includes('scorer_error'),
  );
}

function classifyPair({ peri, controls, minCritics }) {
  const periValid = validScored(peri, minCritics);
  const validControls = controls.filter((c) => validScored(c, minCritics));
  if (!periValid || validControls.length === 0) {
    return {
      status: 'invalid_coverage',
      lift: null,
      reason: !periValid ? 'peripeteia arm not validly scored' : 'no validly-scored control',
    };
  }
  const indeterminateFailures = ['mechanism_measurement_indeterminate', 'learner_measurement_indeterminate'].filter(
    (failure) => peri.failures.includes(failure),
  );
  if (indeterminateFailures.length) {
    return {
      status: 'measurement_indeterminate',
      lift: null,
      reason: `peripeteia measurement indeterminate: ${indeterminateFailures.join(', ')}`,
    };
  }
  const leaking = validControls.filter((c) => c.failures.includes('control_leak'));
  if (leaking.length) {
    return {
      status: 'invalid_control_leak',
      lift: null,
      reason: `control leak: ${leaking.map((c) => c.arm).join(', ')}`,
    };
  }
  const lift = peri.pass ? 1 : 0;
  return {
    status: peri.pass ? 'positive' : 'null',
    lift,
    reason: peri.pass ? 'peripeteia passes; controls clean' : `peripeteia fails: ${peri.failures.join(', ')}`,
  };
}

function tutorAdaptiveMechanismValue(item) {
  return item?.adaptationGate?.tutorAdaptiveMechanism ?? item?.adaptationGate?.publicMechanism ?? null;
}

function itemGateRowFromSummary(runId, item) {
  return {
    runId,
    dramaId: item.dramaId,
    arm: item.arm,
    tid: item.tid,
    recognitionVotes: item.consensus?.recognitionVotes ?? null,
    totalCritics: item.consensus?.totalCritics ?? null,
    claimStatus: item.consensus?.claimStatus ?? null,
    actionalVotes: item.actionalVotes ?? null,
    publicMechanism: tutorAdaptiveMechanismValue(item),
    adaptationMeasurementAvailable: item.adaptationGate?.measurementAvailable === true,
    originInducedVotes: item.originInducedVotes ?? null,
    originAmbiguous: item.originAmbiguous ?? null,
    qualityStatus: item.qualityStatus ?? null,
    pass: item.pass,
    failures: item.failures,
  };
}

function expectedItemGateKeys(args) {
  const expected = [];
  for (const runId of args.runIds) {
    for (const dramaId of args.targetOnly) {
      for (const arm of args.targetArms) expected.push(`${runId}\u0000${dramaId}\u0000${arm}`);
    }
  }
  return expected;
}

function itemGateKey(row) {
  return `${row.runId}\u0000${row.dramaId}\u0000${row.arm}`;
}

function assertCompleteItemGateRows(itemRows, args, { requireAdaptationMeasurements = false } = {}) {
  const expected = new Set(expectedItemGateKeys(args));
  const counts = new Map();
  const malformed = [];
  for (const [index, row] of itemRows.entries()) {
    if (!row || typeof row !== 'object') {
      malformed.push(`row ${index + 1}: not an object`);
      continue;
    }
    const key = itemGateKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!expected.has(key)) malformed.push(`row ${index + 1}: unexpected ${row.runId}/${row.dramaId}/${row.arm}`);
    if (!Number.isInteger(row.totalCritics) || row.totalCritics < 0) {
      malformed.push(`row ${index + 1}: totalCritics must be a non-negative integer`);
    }
    if (typeof row.pass !== 'boolean') malformed.push(`row ${index + 1}: pass must be boolean`);
    if (!Array.isArray(row.failures)) malformed.push(`row ${index + 1}: failures must be an array`);
  }
  const missing = [...expected].filter((key) => !counts.has(key));
  const duplicate = [...counts].filter(([, count]) => count !== 1).map(([key, count]) => `${key} (${count})`);
  if (malformed.length || missing.length || duplicate.length || itemRows.length !== expected.size) {
    const details = [
      malformed.length ? `malformed: ${malformed.join('; ')}` : null,
      missing.length ? `missing: ${missing.length}` : null,
      duplicate.length ? `duplicate: ${duplicate.length}` : null,
      `expected ${expected.size} rows, found ${itemRows.length}`,
    ]
      .filter(Boolean)
      .join(' · ');
    throw new Error(`paired-increment item-gate evidence is incomplete: ${details}`);
  }
  if (requireAdaptationMeasurements) {
    const unavailable = itemRows.filter((row) => row.adaptationMeasurementAvailable !== true);
    if (unavailable.length) {
      throw new Error(
        `historical v4 reproduction unavailable: missing ${LEGACY_ANALYZER_VERSION} measurement for ` +
          `${unavailable.length}/${expected.size} selected items; no aggregate or item-gate output was written. ` +
          'Do not interpret absent measurements as null outcomes.',
      );
    }
  }
}

function readItemGateRows(inputPath, args) {
  if (!fs.existsSync(inputPath)) throw new Error(`--item-gates-in not found: ${inputPath}`);
  const rows = fs
    .readFileSync(inputPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSON in --item-gates-in line ${index + 1}: ${error.message}`);
      }
    });
  assertCompleteItemGateRows(rows, args);
  return rows;
}

function gateItemFromRow(row) {
  return {
    arm: row.arm,
    tid: row.tid ?? null,
    consensus: {
      totalCritics: row.totalCritics,
      recognitionVotes: row.recognitionVotes ?? null,
      claimStatus: row.claimStatus ?? null,
    },
    actionalVotes: row.actionalVotes ?? null,
    adaptationGate: {
      tutorAdaptiveMechanism: row.publicMechanism ?? null,
      measurementAvailable: true,
    },
    originAmbiguous: row.originAmbiguous ?? null,
    pass: row.pass,
    failures: row.failures,
  };
}

function buildPairs(itemRows, args) {
  const pairs = [];
  for (const runId of args.runIds) {
    const byDrama = {};
    for (const row of itemRows.filter((candidate) => candidate.runId === runId)) {
      (byDrama[row.dramaId] ||= {})[row.arm] = gateItemFromRow(row);
    }
    for (const dramaId of args.targetOnly) {
      const arms = byDrama[dramaId] || {};
      const peri = arms[PERI_ARM];
      const controls = CONTROL_ARMS.map((arm) => arms[arm]).filter(Boolean);
      const cls = classifyPair({ peri, controls, minCritics: args.minCritics });
      pairs.push({
        runId,
        dramaId,
        ...cls,
        peripeteia: peri
          ? {
              pass: peri.pass,
              recognitionVotes: peri.consensus?.recognitionVotes ?? null,
              totalCritics: peri.consensus?.totalCritics ?? null,
              actionalVotes: peri.actionalVotes ?? null,
              publicMechanism: tutorAdaptiveMechanismValue(peri),
              originAmbiguous: peri.originAmbiguous ?? null,
              failures: peri.failures,
            }
          : null,
      });
    }
  }
  return pairs;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const gateArgs = {
    targetOnly: args.targetOnly,
    targetArms: args.targetArms,
    minCritics: args.minCritics,
    recognitionVoteCut: args.recognitionVoteCut,
    originVoteCut: args.originVoteCut,
    actionVoteCut: args.actionVoteCut,
    controlMaxRecognitionVotes: args.controlMaxRecognitionVotes,
    analyzerVersion: args.analyzerVersion,
  };

  let itemRows = [];
  let evidenceSource;
  if (args.itemGatesIn) {
    itemRows = readItemGateRows(args.itemGatesIn, args);
    evidenceSource = {
      mode: 'historical_v4_item_gate_reaggregation',
      path: path.relative(ROOT, args.itemGatesIn),
      sha256: crypto.createHash('sha256').update(fs.readFileSync(args.itemGatesIn)).digest('hex'),
      claimUse: 'historical_reproduction_only',
    };
  } else {
    const db = openPoeticsStore(args.dbPath || undefined);
    try {
      for (const runId of args.runIds) {
        const gate = evaluateRunGate(db, { ...gateArgs, runId });
        itemRows.push(...gate.items.map((item) => itemGateRowFromSummary(runId, item)));
      }
    } finally {
      db.close();
    }
    assertCompleteItemGateRows(itemRows, args, { requireAdaptationMeasurements: args.historicalV4 });
    evidenceSource = {
      mode: args.historicalV4 ? 'historical_v4_database_reaggregation' : 'prospective_semantic_v5_database',
      analyzerVersion: args.analyzerVersion,
      claimUse: args.historicalV4 ? 'historical_reproduction_only' : 'prospective_claim_path',
    };
  }
  const pairs = buildPairs(itemRows, args);

  const valid = pairs.filter((p) => p.lift !== null);
  const nValid = valid.length;
  const nPositive = valid.filter((p) => p.lift === 1).length;
  const nNull = valid.filter((p) => p.lift === 0).length;
  const nCoverage = pairs.filter((p) => p.status === 'invalid_coverage').length;
  const nControlLeak = pairs.filter((p) => p.status === 'invalid_control_leak').length;
  const nMeasurementIndeterminate = pairs.filter((p) => p.status === 'measurement_indeterminate').length;
  const meanLift = nValid ? nPositive / nValid : null;
  const ci = wilson(nPositive, nValid);
  const positiveDramas = [...new Set(valid.filter((p) => p.lift === 1).map((p) => p.dramaId))];
  // origin_ambiguity_rate over the peripeteia arms (reported, not gated).
  const periItems = itemRows.filter((r) => r.arm === PERI_ARM && r.totalCritics >= args.minCritics);
  const originAmbiguityRate = periItems.length
    ? periItems.filter((r) => r.originAmbiguous).length / periItems.length
    : null;

  let verdict;
  if (nValid === 0) {
    verdict = 'no_interpretable_evidence';
  } else if (nPositive === 0) {
    verdict = 'null';
  } else if (ci.low > 0 && positiveDramas.length >= 2) {
    verdict = 'positive_small_n';
  } else {
    verdict = 'weak_positive_or_maybe';
  }

  const summary = {
    runIds: args.runIds,
    config: gateArgs,
    evidenceSource,
    pairs,
    aggregate: {
      pairsTotal: pairs.length,
      validPairs: nValid,
      positive: nPositive,
      null: nNull,
      invalidCoverage: nCoverage,
      invalidControlLeak: nControlLeak,
      measurementIndeterminate: nMeasurementIndeterminate,
      recognitiveClosureLift: meanLift,
      wilson95: ci,
      positiveDramas,
      originAmbiguityRate,
    },
    verdict,
  };

  const stamp = args.runIds[0].replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60);
  const itemGatesOut =
    args.itemGatesOut || (!args.itemGatesIn && path.join(ROOT, 'exports', `item-gates-${stamp}.jsonl`));
  if (itemGatesOut) {
    fs.mkdirSync(path.dirname(itemGatesOut), { recursive: true });
    fs.writeFileSync(itemGatesOut, itemRows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  }
  const outPath = args.out || path.join(ROOT, 'exports', `paired-increment-${stamp}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`\n══ Paired-increment aggregate over ${args.runIds.length} iteration(s) ══`);
  for (const p of pairs) {
    const peri = p.peripeteia || {};
    console.log(
      `  ${p.runId.slice(-3)} ${p.dramaId.padEnd(4)} ${String(p.status).padEnd(20)} ` +
        `lift=${p.lift ?? '-'} · peri recog=${peri.recognitionVotes ?? '-'}/${peri.totalCritics ?? '-'} ` +
        `act=${peri.actionalVotes ?? '-'} mech=${peri.publicMechanism ?? '-'}${p.reason ? ` · ${p.reason}` : ''}`,
    );
  }
  console.log(
    `\n  valid pairs: ${nValid} (positive ${nPositive}, null ${nNull}) · ` +
      `invalidated: coverage ${nCoverage}, control-leak ${nControlLeak}, ` +
      `measurement-indeterminate ${nMeasurementIndeterminate}`,
  );
  console.log(
    `  recognitive_closure_lift = ${meanLift === null ? 'n/a' : meanLift.toFixed(3)} ` +
      `(Wilson95 [${ci.low.toFixed(3)}, ${ci.high.toFixed(3)}]) · positive dramas: ${positiveDramas.join(', ') || 'none'}`,
  );
  console.log(
    `  origin_ambiguity_rate (reported, not gated) = ${originAmbiguityRate === null ? 'n/a' : originAmbiguityRate.toFixed(3)}`,
  );
  console.log(`\n  VERDICT: ${verdict}`);
  const written = [path.relative(ROOT, outPath), itemGatesOut ? path.relative(ROOT, itemGatesOut) : null].filter(
    Boolean,
  );
  console.log(`  wrote ${written.join(' + ')}\n`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export {
  assertCompleteItemGateRows,
  buildPairs,
  classifyPair,
  parseArgs,
  readItemGateRows,
  tutorAdaptiveMechanismValue,
  validScored,
  wilson,
};
