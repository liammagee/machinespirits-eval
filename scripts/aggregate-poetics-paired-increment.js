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
 * Historical reproduction of the former D42/D50/D53 panel is explicit:
 *   --target-only D42,D50,D53 --historical-v4
 */

import 'dotenv/config';
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
    else if (t === '--item-gates-out') a.itemGatesOut = path.resolve(argv[++i]);
    else if (t === '--target-only') a.targetOnly = String(argv[++i]).split(',').filter(Boolean);
    else if (t === '--target-spec') a.targetSpec = path.resolve(argv[++i]);
    else if (t === '--analyzer-version') a.analyzerVersion = argv[++i];
    else if (t === '--historical-v4') a.historicalV4 = true;
    else if (t === '--min-critics') a.minCritics = parseInt(argv[++i], 10);
    else if (t === '--help' || t === '-h') {
      console.log(
        'Usage: node scripts/aggregate-poetics-paired-increment.js --run-id <id> [--run-id <id> ...] [--db F] [--out F]',
      );
      process.exit(0);
    } else throw new Error(`unknown arg: ${t}`);
  }
  if (!a.runIds.length) throw new Error('need at least one --run-id');
  if (!a.targetOnly.length) {
    throw new Error('--target-only is required; there is no implicit clean-anchor default');
  }
  if (a.historicalV4) {
    if (a.analyzerVersion && a.analyzerVersion !== LEGACY_ANALYZER_VERSION) {
      throw new Error('--historical-v4 cannot be combined with a non-v4 analyzer');
    }
    a.analyzerVersion = LEGACY_ANALYZER_VERSION;
  } else {
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
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

  const itemRows = [];
  const pairs = [];
  try {
    for (const runId of args.runIds) {
      const gate = evaluateRunGate(db, { ...gateArgs, runId });
      const byDrama = {};
      for (const it of gate.items) {
        itemRows.push({
          runId,
          dramaId: it.dramaId,
          arm: it.arm,
          tid: it.tid,
          recognitionVotes: it.consensus?.recognitionVotes ?? null,
          totalCritics: it.consensus?.totalCritics ?? null,
          claimStatus: it.consensus?.claimStatus ?? null,
          actionalVotes: it.actionalVotes ?? null,
          publicMechanism: tutorAdaptiveMechanismValue(it),
          originInducedVotes: it.originInducedVotes ?? null,
          originAmbiguous: it.originAmbiguous ?? null,
          qualityStatus: it.qualityStatus ?? null,
          pass: it.pass,
          failures: it.failures,
        });
        (byDrama[it.dramaId] ||= {})[it.arm] = it;
      }
      for (const [dramaId, arms] of Object.entries(byDrama)) {
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
  } finally {
    db.close();
  }

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
  const itemGatesOut = args.itemGatesOut || path.join(ROOT, 'exports', `item-gates-${stamp}.jsonl`);
  fs.mkdirSync(path.dirname(itemGatesOut), { recursive: true });
  fs.writeFileSync(itemGatesOut, itemRows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
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
  console.log(`  wrote ${path.relative(ROOT, outPath)} + ${path.relative(ROOT, itemGatesOut)}\n`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export { classifyPair, parseArgs, tutorAdaptiveMechanismValue, validScored, wilson };
