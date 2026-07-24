#!/usr/bin/env node
// Post-hoc, zero-call mediation analysis for the Program 2 committee floor
// ablation. This script never changes the preregistered W1-W3 estimands or
// their reading grammar. It treats sealed-dialogue component rates as
// conditional on sealing and inventories attrition/interruption separately.
//
// Usage:
//   node scripts/analyze-program2-floor-ablation-mediation.mjs <run-root> \
//     --json <run-root>/mediation-analysis.json \
//     --markdown <run-root>/mediation-analysis.md

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

export const MEDIATION_SPEC = Object.freeze({
  schema: 'machinespirits.program2.floor-ablation-mediation.v1',
  role: 'post_hoc_exploratory',
  frozenCue: 'evidence|item|test|record|fact|rule',
  trigger: 'warrant_skip',
  bootstrapDraws: 5000,
  bootstrapSeed: 20260724,
  profiles: Object.freeze(['proof_skipper', 'affective_resistant']),
  extremeRawChars: 10000,
  extremeQuestionMarks: 10,
});

const CUE_RE = /\b(?:evidence|item|test|record|fact|rule)\b/iu;
const SURFACES = Object.freeze([
  'rawMini',
  'frozenV1Span',
  'rawComposition',
  'fallbackEnvelope',
  'committeeApproved',
  'finalDelivery',
  'counterfactualV2Span',
]);
const WATERFALL = Object.freeze([
  ['rawMini', 'frozenV1Span'],
  ['frozenV1Span', 'rawComposition'],
  ['rawComposition', 'committeeApproved'],
  ['committeeApproved', 'finalDelivery'],
]);

function normalize(text) {
  return String(text ?? '').replace(/\s+/gu, ' ').trim();
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

export function questionSentences(text) {
  return (String(text ?? '').match(/[^.!?\n]+\?/gu) || [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);
}

export function statementSentences(text) {
  return (String(text ?? '').match(/[^.!?\n]+[.!]/gu) || [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8);
}

// Byte-equivalent to the documented offline span-v2 rule: choose one
// question, prefer a cue-bearing question, and otherwise carry an existing
// cue-bearing statement ahead of the first question. It never generates or
// paraphrases text.
export function extractCuePreservingSpanV2(text) {
  const questions = questionSentences(text);
  if (!questions.length) return { status: 'no_span', span: null, carriedStatement: false };
  const cueQuestion = questions.find((question) => CUE_RE.test(question));
  if (cueQuestion) return { status: 'ok', span: cueQuestion, carriedStatement: false };
  const chosen = questions[0];
  const cueStatement = statementSentences(text).find((statement) => CUE_RE.test(statement));
  if (cueStatement) {
    return { status: 'ok', span: `${cueStatement} ${chosen}`, carriedStatement: true };
  }
  return { status: 'ok', span: chosen, carriedStatement: false };
}

export function componentVector(text) {
  if (text === null || text === undefined || !normalize(text)) {
    return {
      available: false,
      chars: 0,
      words: 0,
      sha256: null,
      cue: false,
      questionMarks: 0,
      exactlyOneQuestion: false,
      cueAndExactlyOneQuestion: false,
    };
  }
  const value = String(text);
  const questionMarks = (value.match(/\?/gu) || []).length;
  const cue = CUE_RE.test(value);
  const exactlyOneQuestion = questionMarks === 1;
  return {
    available: true,
    chars: value.length,
    words: normalize(value).split(' ').filter(Boolean).length,
    sha256: sha256(value),
    cue,
    questionMarks,
    exactlyOneQuestion,
    cueAndExactlyOneQuestion: cue && exactlyOneQuestion,
  };
}

export function transitionVector(previousText, currentText) {
  const previous = componentVector(previousText);
  const current = componentVector(currentText);
  if (!previous.available && !current.available) {
    return {
      comparable: false,
      missingPrevious: true,
      missingCurrent: true,
      equal: false,
      previousContainedInCurrent: false,
      currentContainedInPrevious: false,
      overwrite: false,
      cueLoss: false,
      cueRestoration: false,
      questionRepair: false,
      questionRegression: false,
    };
  }
  if (previous.available && !current.available) {
    return {
      comparable: true,
      missingPrevious: false,
      missingCurrent: true,
      equal: false,
      previousContainedInCurrent: false,
      currentContainedInPrevious: false,
      overwrite: false,
      cueLoss: previous.cue,
      cueRestoration: false,
      questionRepair: false,
      questionRegression: previous.exactlyOneQuestion,
    };
  }
  if (!previous.available && current.available) {
    return {
      comparable: true,
      missingPrevious: true,
      missingCurrent: false,
      equal: false,
      previousContainedInCurrent: false,
      currentContainedInPrevious: false,
      overwrite: false,
      cueLoss: false,
      cueRestoration: current.cue,
      questionRepair: current.exactlyOneQuestion,
      questionRegression: false,
    };
  }
  const left = normalize(previousText);
  const right = normalize(currentText);
  const equal = left === right;
  const previousContainedInCurrent = right.includes(left);
  const currentContainedInPrevious = left.includes(right);
  return {
    comparable: true,
    missingPrevious: false,
    missingCurrent: false,
    equal,
    previousContainedInCurrent,
    currentContainedInPrevious,
    overwrite: !equal && !previousContainedInCurrent && !currentContainedInPrevious,
    cueLoss: previous.cue && !current.cue,
    cueRestoration: !previous.cue && current.cue,
    questionRepair: !previous.exactlyOneQuestion && current.exactlyOneQuestion,
    questionRegression: previous.exactlyOneQuestion && !current.exactlyOneQuestion,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readTrace(file) {
  const events = [];
  for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  }
  return events;
}

function traceDescriptor(root, file, countedFailureFiles) {
  const events = readTrace(file);
  const relative = path.relative(root, file);
  const basename = path.basename(file);
  const runEnd = events.findLast((event) => event.type === 'run_end') || null;
  const modelCallError = events.findLast((event) => event.type === 'model_call_error') || null;
  let classification = 'interrupted';
  if (runEnd) classification = 'sealed';
  else if (countedFailureFiles.has(basename) || countedFailureFiles.has(relative)) classification = 'counted_failure';
  return {
    file,
    relative,
    events,
    classification,
    eventCount: events.length,
    lastSequence: events.at(-1)?.seq ?? null,
    lastType: events.at(-1)?.type ?? null,
    modelCallError: modelCallError
      ? {
          turn: modelCallError.turn ?? null,
          kind: modelCallError.kind ?? modelCallError.failureKind ?? null,
          message: modelCallError.error ?? modelCallError.message ?? modelCallError.detail ?? null,
        }
      : null,
  };
}

export function selectAuthoritativeTraces(root) {
  const planDocument = readJson(path.join(root, 'launch-plan.json'));
  const plan = planDocument.plan || planDocument;
  const launchState = readJson(path.join(root, 'launch-state.json'));
  const jobs = [];
  for (const job of plan.jobs) {
    const state = launchState.jobs?.[job.id] || {};
    const countedFailureFiles = new Set(
      (state.failures || []).flatMap((failure) => {
        const traceFile = failure.traceFile || '';
        return [traceFile, path.basename(traceFile), path.relative(root, path.resolve(REPO_ROOT, traceFile))];
      }),
    );
    const traceDir = path.join(root, 'traces', job.id);
    const traces = fs.existsSync(traceDir)
      ? fs
          .readdirSync(traceDir)
          .filter((file) => file.endsWith('.jsonl'))
          .sort()
          .map((file) => traceDescriptor(root, path.join(traceDir, file), countedFailureFiles))
      : [];
    const sealed = traces.filter((trace) => trace.classification === 'sealed');
    if (state.status === 'sealed' && sealed.length !== 1) {
      throw new Error(`${job.id}: expected exactly one sealed trace, found ${sealed.length}`);
    }
    if (state.status !== 'sealed' && sealed.length > 0) {
      throw new Error(`${job.id}: launch state is ${state.status || 'missing'} but a sealed trace exists`);
    }
    jobs.push({ job, state, traces, authoritative: sealed[0] || null });
  }
  return { plan, launchState, jobs };
}

function textsForMoment(moment, turnRecord) {
  const fallbackEnvelope = moment.fallback
    ? moment.deliveredFallbackText || moment.miniText || null
    : null;
  const committeeApproved = moment.source === 'composed' ? moment.composedText || null : fallbackEnvelope;
  const counterfactual = extractCuePreservingSpanV2(moment.miniText);
  return {
    rawMini: moment.miniText || null,
    frozenV1Span: moment.span || null,
    rawComposition: moment.composedText || null,
    fallbackEnvelope,
    committeeApproved,
    finalDelivery: turnRecord?.tutor || null,
    counterfactualV2Span: counterfactual.span,
    counterfactual,
  };
}

function auditVector(compliance) {
  if (!compliance) return null;
  return {
    detectorVersion: compliance.detector_version || null,
    trigger: compliance.trigger || null,
    compliant: compliance.compliant === true,
    questionCount: compliance.question_count ?? null,
    components: compliance.components || {},
  };
}

function momentsFromTrace(job, trace) {
  const turns = new Map();
  const compliance = new Map();
  for (const event of trace.events) {
    if (event.type === 'turn_complete' && event.turnRecord) turns.set(Number(event.turn), event.turnRecord);
    if (
      event.type === 'point_of_action_compliance' &&
      event.compliance?.trigger === MEDIATION_SPEC.trigger
    ) {
      compliance.set(Number(event.turn), event.compliance);
    }
  }
  const records = [];
  for (const event of trace.events) {
    if (
      event.type !== 'program2_committee_moment' ||
      !event.moment ||
      event.moment.trigger !== MEDIATION_SPEC.trigger
    ) {
      continue;
    }
    const turn = Number(event.turn ?? event.moment.turn);
    const turnRecord = turns.get(turn) || null;
    const pointOfActionCompliance = compliance.get(turn) || turnRecord?.pointOfAction?.compliance || null;
    const texts = textsForMoment(event.moment, turnRecord);
    const surfaces = Object.fromEntries(SURFACES.map((surface) => [surface, componentVector(texts[surface])]));
    const transitions = Object.fromEntries(
      WATERFALL.map(([left, right]) => [`${left}->${right}`, transitionVector(texts[left], texts[right])]),
    );
    const extreme =
      surfaces.rawMini.chars >= MEDIATION_SPEC.extremeRawChars ||
      surfaces.rawMini.questionMarks >= MEDIATION_SPEC.extremeQuestionMarks;
    records.push({
      jobId: job.id,
      condition: job.condition,
      arm: job.arm,
      profile: job.profile,
      pairKey: job.pairKey || null,
      repeat: job.repeat,
      trace: trace.relative,
      runId: event.runId || null,
      turn,
      turnId: event.turnId || `${event.runId || job.id}:t${String(turn).padStart(3, '0')}`,
      miniModel: event.moment.miniModel || null,
      source: event.moment.source || null,
      fallback: event.moment.fallback
        ? {
            policy: event.moment.fallback.policy || null,
            resolution: event.moment.fallback.resolution || null,
            resamples: event.moment.fallback.resamples ?? null,
          }
        : null,
      composerBattery: event.moment.battery || null,
      counterfactualV2: texts.counterfactual,
      surfaces,
      transitions,
      finalAudit: auditVector(pointOfActionCompliance),
      finalGuard: turnRecord
        ? {
            responseRepaired: turnRecord.tutorResponseRepaired === true,
            deterministicFallback: turnRecord.tutorDeterministicFallback === true,
            guardOutcome: turnRecord.tutorGuardAccounting?.outcome || null,
          }
        : null,
      joinedToCompletedTurn: Boolean(turnRecord),
      extreme,
    });
  }
  return records;
}

function increment(tally, key, amount = 1) {
  const normalized = String(key ?? 'null');
  tally[normalized] = (tally[normalized] || 0) + amount;
}

function ratio(numerator, denominator) {
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

function percentile(values, probability) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.round(probability * (sorted.length - 1))];
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function derivedSeed(base, label) {
  return (base ^ Number.parseInt(sha256(label).slice(0, 8), 16)) >>> 0;
}

function eligibleForSurface(records, surface) {
  return surface === 'fallbackEnvelope' ? records.filter((record) => record.fallback) : records;
}

function clusteredRate(records, surface, metric, { draws, seed }) {
  // A missing span/composition is a failed transmission at that surface, not
  // a reason to shrink the denominator. The fallback envelope is the one
  // deliberately conditional surface: it exists only for fallback moments.
  const eligible = eligibleForSurface(records, surface);
  const numerator = eligible.filter((record) => record.surfaces[surface]?.[metric] === true).length;
  const estimate = ratio(numerator, eligible.length);
  const strata = MEDIATION_SPEC.profiles
    .map((profile) => {
      const byDialogue = new Map();
      for (const record of eligible.filter((item) => item.profile === profile)) {
        const rows = byDialogue.get(record.jobId) || [];
        rows.push(record);
        byDialogue.set(record.jobId, rows);
      }
      return [...byDialogue.values()];
    })
    .filter((stratum) => stratum.length);
  if (!eligible.length || !strata.length || draws <= 0) return { ...estimate, ci95: null, clusters: 0 };
  const random = mulberry32(derivedSeed(seed, `${surface}:${metric}`));
  const sampledRates = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const picked = [];
    for (const dialogues of strata) {
      for (let index = 0; index < dialogues.length; index += 1) {
        picked.push(...dialogues[Math.floor(random() * dialogues.length)]);
      }
    }
    if (picked.length) sampledRates.push(picked.filter((record) => record.surfaces[surface][metric]).length / picked.length);
  }
  return {
    ...estimate,
    ci95: sampledRates.length ? [percentile(sampledRates, 0.025), percentile(sampledRates, 0.975)] : null,
    clusters: new Set(eligible.map((record) => record.jobId)).size,
  };
}

function pairedClusterContrast(records, surface, metric, { draws, seed }) {
  const pairs = new Map();
  for (const record of records.filter((item) => item.pairKey)) {
    const pair = pairs.get(record.pairKey) || {
      pairKey: record.pairKey,
      profile: record.profile,
      trained: [],
      untuned: [],
    };
    if (record.condition === 'trained_committee') pair.trained.push(record);
    if (record.condition === 'untuned_committee') pair.untuned.push(record);
    pairs.set(record.pairKey, pair);
  }
  const complete = [...pairs.values()].filter((pair) => pair.trained.length && pair.untuned.length);
  const strata = MEDIATION_SPEC.profiles.map((profile) => complete.filter((pair) => pair.profile === profile));
  const rate = (rows) => {
    const eligible = eligibleForSurface(rows, surface);
    return ratio(eligible.filter((record) => record.surfaces[surface]?.[metric] === true).length, eligible.length);
  };
  const trained = rate(complete.flatMap((pair) => pair.trained));
  const untuned = rate(complete.flatMap((pair) => pair.untuned));
  const estimate =
    trained.rate === null || untuned.rate === null ? null : trained.rate - untuned.rate;
  if (!complete.length || strata.some((stratum) => stratum.length === 0) || draws <= 0) {
    return {
      pairedBlocks: complete.length,
      pairedBlocksByProfile: Object.fromEntries(
        MEDIATION_SPEC.profiles.map((profile, index) => [profile, strata[index].length]),
      ),
      trained,
      untuned,
      estimate,
      ci95: null,
    };
  }
  const random = mulberry32(derivedSeed(seed, `paired:${surface}:${metric}`));
  const differences = [];
  for (let draw = 0; draw < draws; draw += 1) {
    const sampled = [];
    for (const stratum of strata) {
      for (let index = 0; index < stratum.length; index += 1) {
        sampled.push(stratum[Math.floor(random() * stratum.length)]);
      }
    }
    const trainedDraw = rate(sampled.flatMap((pair) => pair.trained)).rate;
    const untunedDraw = rate(sampled.flatMap((pair) => pair.untuned)).rate;
    if (trainedDraw !== null && untunedDraw !== null) differences.push(trainedDraw - untunedDraw);
  }
  return {
    pairedBlocks: complete.length,
    pairedBlocksByProfile: Object.fromEntries(
      MEDIATION_SPEC.profiles.map((profile, index) => [profile, strata[index].length]),
    ),
    trained,
    untuned,
    estimate,
    ci95: differences.length ? [percentile(differences, 0.025), percentile(differences, 0.975)] : null,
  };
}

function pairedContrastSummary(records, bootstrapOptions) {
  return Object.fromEntries(
    SURFACES.map((surface) => [
      surface,
      Object.fromEntries(
        ['cue', 'exactlyOneQuestion', 'cueAndExactlyOneQuestion'].map((metric) => [
          metric,
          pairedClusterContrast(records, surface, metric, bootstrapOptions),
        ]),
      ),
    ]),
  );
}

function componentSummary(records, { draws, seed }) {
  return Object.fromEntries(
    SURFACES.map((surface) => [
      surface,
      {
        cue: clusteredRate(records, surface, 'cue', { draws, seed }),
        exactlyOneQuestion: clusteredRate(records, surface, 'exactlyOneQuestion', { draws, seed }),
        cueAndExactlyOneQuestion: clusteredRate(records, surface, 'cueAndExactlyOneQuestion', { draws, seed }),
        questionMarks: records.reduce((sum, record) => sum + Number(record.surfaces[surface]?.questionMarks || 0), 0),
      },
    ]),
  );
}

function transitionSummary(records) {
  return Object.fromEntries(
    WATERFALL.map(([left, right]) => {
      const key = `${left}->${right}`;
      const comparable = records.filter((record) => record.transitions[key]?.comparable);
      const count = (field) => comparable.filter((record) => record.transitions[key][field] === true).length;
      return [
        key,
        {
          comparable: comparable.length,
          missingPrevious: ratio(count('missingPrevious'), comparable.length),
          missingCurrent: ratio(count('missingCurrent'), comparable.length),
          equal: ratio(count('equal'), comparable.length),
          previousContainedInCurrent: ratio(count('previousContainedInCurrent'), comparable.length),
          currentContainedInPrevious: ratio(count('currentContainedInPrevious'), comparable.length),
          overwrite: ratio(count('overwrite'), comparable.length),
          cueLoss: ratio(count('cueLoss'), comparable.length),
          cueRestoration: ratio(count('cueRestoration'), comparable.length),
          questionRepair: ratio(count('questionRepair'), comparable.length),
          questionRegression: ratio(count('questionRegression'), comparable.length),
        },
      ];
    }),
  );
}

function operationalSummary(records, bootstrapOptions) {
  const sourceTally = {};
  const fallbackResolutionTally = {};
  const finalCompliance = {};
  let joined = 0;
  let finalAudits = 0;
  let compliant = 0;
  for (const record of records) {
    increment(sourceTally, record.source);
    if (record.fallback) increment(fallbackResolutionTally, record.fallback.resolution);
    if (record.joinedToCompletedTurn) joined += 1;
    if (record.finalAudit) {
      finalAudits += 1;
      if (record.finalAudit.compliant) compliant += 1;
      for (const [component, passed] of Object.entries(record.finalAudit.components || {})) {
        const value = finalCompliance[component] || { seen: 0, passed: 0, rate: null };
        value.seen += 1;
        if (passed === true) value.passed += 1;
        value.rate = value.passed / value.seen;
        finalCompliance[component] = value;
      }
    }
  }
  return {
    moments: records.length,
    dialogues: new Set(records.map((record) => record.jobId)).size,
    joinedToCompletedTurn: ratio(joined, records.length),
    sourceTally,
    fallbackResolutionTally,
    components: componentSummary(records, bootstrapOptions),
    waterfall: transitionSummary(records),
    finalAudit: { ...ratio(compliant, finalAudits), components: finalCompliance },
  };
}

function compactGroup(records) {
  const summary = { moments: records.length };
  for (const surface of SURFACES) {
    const available = records.filter((record) => record.surfaces[surface].available);
    summary[surface] = {
      available: available.length,
      cue: available.filter((record) => record.surfaces[surface].cue).length,
      exactlyOneQuestion: available.filter((record) => record.surfaces[surface].exactlyOneQuestion).length,
      cueAndExactlyOneQuestion: available.filter(
        (record) => record.surfaces[surface].cueAndExactlyOneQuestion,
      ).length,
    };
  }
  return summary;
}

function groupRecords(records, field) {
  const groups = new Map();
  for (const record of records) {
    const key = record[field] ?? 'null';
    const rows = groups.get(key) || [];
    rows.push(record);
    groups.set(key, rows);
  }
  return Object.fromEntries([...groups.entries()].map(([key, rows]) => [key, compactGroup(rows)]));
}

function pairKeySummary(records) {
  const groups = new Map();
  for (const record of records.filter((item) => item.pairKey)) {
    const rows = groups.get(record.pairKey) || [];
    rows.push(record);
    groups.set(record.pairKey, rows);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([pairKey, rows]) => [
      pairKey,
      Object.fromEntries(
        ['trained_committee', 'untuned_committee'].map((condition) => [
          condition,
          compactGroup(rows.filter((record) => record.condition === condition)),
        ]),
      ),
    ]),
  );
}

function inventorySummary(selection) {
  const expected = {};
  const sealed = {};
  const finalizedAttrition = {};
  const countedFailures = {};
  const interrupted = {};
  const jobs = [];
  for (const selected of selection.jobs) {
    const condition = selected.job.condition;
    increment(expected, condition);
    if (selected.authoritative) increment(sealed, condition);
    if (selected.state.attrition === true) increment(finalizedAttrition, condition);
    const counted = selected.traces.filter((trace) => trace.classification === 'counted_failure');
    const incomplete = selected.traces.filter((trace) => trace.classification === 'interrupted');
    increment(countedFailures, condition, counted.length);
    increment(interrupted, condition, incomplete.length);
    jobs.push({
      jobId: selected.job.id,
      condition,
      profile: selected.job.profile,
      pairKey: selected.job.pairKey || null,
      state: selected.state.status || null,
      attrition: selected.state.attrition === true,
      authoritativeTrace: selected.authoritative?.relative || null,
      traces: selected.traces.map((trace) => ({
        trace: trace.relative,
        classification: trace.classification,
        eventCount: trace.eventCount,
        lastSequence: trace.lastSequence,
        lastType: trace.lastType,
        modelCallError: trace.modelCallError,
      })),
    });
  }
  return { expected, sealed, finalizedAttrition, countedFailures, interrupted, jobs };
}

function interimReconciliation(byCondition) {
  const interim = {
    trained_committee: { moments: 55, rawCue: 45, rawExactlyOne: 38, rawConjunction: 28, spanCue: 23, rawCueLostAtSpan: 22, v2Conjunction: 42 },
    untuned_committee: { moments: 71, rawCue: 36, rawExactlyOne: 64, rawConjunction: 33, spanCue: 24, rawCueLostAtSpan: 12, v2Conjunction: 36 },
  };
  const actual = {};
  for (const condition of Object.keys(interim)) {
    const records = byCondition[condition] || [];
    actual[condition] = {
      moments: records.length,
      rawCue: records.filter((record) => record.surfaces.rawMini.cue).length,
      rawExactlyOne: records.filter((record) => record.surfaces.rawMini.exactlyOneQuestion).length,
      rawConjunction: records.filter((record) => record.surfaces.rawMini.cueAndExactlyOneQuestion).length,
      spanCue: records.filter((record) => record.surfaces.frozenV1Span.cue).length,
      rawCueLostAtSpan: records.filter((record) => record.transitions['rawMini->frozenV1Span'].cueLoss).length,
      v2Conjunction: records.filter((record) => record.surfaces.counterfactualV2Span.cueAndExactlyOneQuestion).length,
    };
  }
  return {
    note: 'Interim note counts used the then-sealed checkpoint; final counts below use authoritative final sealed traces.',
    interim,
    final: actual,
    delta: Object.fromEntries(
      Object.keys(interim).map((condition) => [
        condition,
        Object.fromEntries(Object.keys(interim[condition]).map((field) => [field, actual[condition][field] - interim[condition][field]])),
      ]),
    ),
  };
}

export function analyzeMediation(root, { draws = MEDIATION_SPEC.bootstrapDraws, seed = MEDIATION_SPEC.bootstrapSeed } = {}) {
  const selection = selectAuthoritativeTraces(root);
  const sealedRecords = [];
  const countedFailureRecords = [];
  const interruptedRecords = [];
  for (const selected of selection.jobs) {
    if (selected.authoritative) sealedRecords.push(...momentsFromTrace(selected.job, selected.authoritative));
    for (const trace of selected.traces) {
      if (trace.classification === 'counted_failure') countedFailureRecords.push(...momentsFromTrace(selected.job, trace));
      if (trace.classification === 'interrupted') interruptedRecords.push(...momentsFromTrace(selected.job, trace));
    }
  }
  const committeeRecords = sealedRecords.filter((record) => record.condition !== 'silent_control');
  const byCondition = Object.fromEntries(
    ['trained_committee', 'untuned_committee'].map((condition) => [
      condition,
      committeeRecords.filter((record) => record.condition === condition),
    ]),
  );
  const operationalByCondition = Object.fromEntries(
    Object.entries(byCondition).map(([condition, records]) => [condition, operationalSummary(records, { draws, seed })]),
  );
  const sensitivityByCondition = Object.fromEntries(
    Object.entries(byCondition).map(([condition, records]) => [
      condition,
      operationalSummary(records.filter((record) => !record.extreme), { draws, seed }),
    ]),
  );
  const extremeCases = committeeRecords
    .filter((record) => record.extreme)
    .map((record) => ({
      jobId: record.jobId,
      condition: record.condition,
      profile: record.profile,
      trace: record.trace,
      turn: record.turn,
      turnId: record.turnId,
      rawMini: record.surfaces.rawMini,
    }));
  return {
    schema: MEDIATION_SPEC.schema,
    generatedAt: new Date().toISOString(),
    role: MEDIATION_SPEC.role,
    confirmatoryEstimandsChanged: false,
    officialAnalysis: path.relative(root, path.join(root, 'analysis.json')),
    interpretationBoundary:
      'All committee component and waterfall rates are post-hoc and conditional on sealing. Failed and interrupted attempts are inventoried separately and never pooled into W1-W3 or sealed mediation rates.',
    counterfactualBoundary:
      'The deterministic v2 span measures interface signal preservation only; it is not a counterfactual final tutor response or compliance estimate.',
    spec: {
      frozenCue: MEDIATION_SPEC.frozenCue,
      trigger: MEDIATION_SPEC.trigger,
      bootstrap: { draws, seed, unit: 'dialogue', profileStratified: true },
      extreme: { rawCharsAtLeast: MEDIATION_SPEC.extremeRawChars, questionMarksAtLeast: MEDIATION_SPEC.extremeQuestionMarks },
    },
    inventory: inventorySummary(selection),
    sealedConditionalAnalysis: {
      byCondition: operationalByCondition,
      descriptivePairedContrasts: {
        label: 'post_hoc_exploratory_trained_minus_untuned',
        bySurface: pairedContrastSummary(committeeRecords, { draws, seed }),
      },
      byProfile: groupRecords(committeeRecords, 'profile'),
      byDialogue: groupRecords(committeeRecords, 'jobId'),
      byPairKey: pairKeySummary(committeeRecords),
    },
    sensitivityExcludingExtremeMoments: {
      exclusionRule: `raw chars >= ${MEDIATION_SPEC.extremeRawChars} or question marks >= ${MEDIATION_SPEC.extremeQuestionMarks}`,
      excluded: extremeCases,
      byCondition: sensitivityByCondition,
    },
    nonsealedAttemptDiagnostics: {
      policy: 'Separate descriptive inventory only; not pooled with sealed dialogues.',
      countedFailures: {
        moments: countedFailureRecords.length,
        byCondition: groupRecords(countedFailureRecords, 'condition'),
      },
      interrupted: {
        moments: interruptedRecords.length,
        byCondition: groupRecords(interruptedRecords, 'condition'),
      },
    },
    interimReconciliation: interimReconciliation(byCondition),
    momentRecords: committeeRecords,
  };
}

function fmtRate(value) {
  if (!value || value.denominator === 0) return 'n/a';
  const ci = value.ci95 ? `; 95% CI ${value.ci95.map((item) => item.toFixed(3)).join(' to ')}` : '';
  return `${value.numerator}/${value.denominator} = ${value.rate.toFixed(3)}${ci}`;
}

function markdownComponentRow(label, left, right) {
  return `| ${label} | ${fmtRate(left)} | ${fmtRate(right)} |`;
}

function fmtPairedContrast(value) {
  if (!value || value.estimate === null) return 'n/a';
  const ci = value.ci95 ? value.ci95.map((item) => item.toFixed(3)).join(' to ') : 'n/a';
  return `${value.estimate.toFixed(3)}; 95% CI ${ci}; ${value.pairedBlocks} paired blocks`;
}

export function renderMediationMarkdown(artifact) {
  const trained = artifact.sealedConditionalAnalysis.byCondition.trained_committee;
  const untuned = artifact.sealedConditionalAnalysis.byCondition.untuned_committee;
  const trainedSensitivity = artifact.sensitivityExcludingExtremeMoments.byCondition.trained_committee;
  const untunedSensitivity = artifact.sensitivityExcludingExtremeMoments.byCondition.untuned_committee;
  const contrasts = artifact.sealedConditionalAnalysis.descriptivePairedContrasts.bySurface;
  const inventory = artifact.inventory;
  const lines = [
    '# Program 2 floor-ablation mediation analysis',
    '',
    `Generated: ${artifact.generatedAt}`,
    '',
    '**Status: post-hoc exploratory. This report does not alter W1-W3 or the frozen reading grammar.**',
    '',
    artifact.interpretationBoundary,
    '',
    '## Cohort and attrition',
    '',
    '| Condition | Planned | Sealed | Finalized attrition | Counted failed attempts | Interrupted traces |',
    '|---|---:|---:|---:|---:|---:|',
    ...['trained_committee', 'untuned_committee', 'silent_control'].map(
      (condition) =>
        `| ${condition} | ${inventory.expected[condition] || 0} | ${inventory.sealed[condition] || 0} | ${inventory.finalizedAttrition[condition] || 0} | ${inventory.countedFailures[condition] || 0} | ${inventory.interrupted[condition] || 0} |`,
    ),
    '',
    'The component rates below are therefore conditional on sealing. Differential attrition is not adjusted away.',
    '',
    '## First-draft and interface components',
    '',
    '| Surface / component | Trained committee | Untuned committee |',
    '|---|---:|---:|',
    markdownComponentRow('Raw mini: frozen cue', trained.components.rawMini.cue, untuned.components.rawMini.cue),
    markdownComponentRow(
      'Raw mini: exactly one question',
      trained.components.rawMini.exactlyOneQuestion,
      untuned.components.rawMini.exactlyOneQuestion,
    ),
    markdownComponentRow(
      'Raw mini: cue + exactly one question',
      trained.components.rawMini.cueAndExactlyOneQuestion,
      untuned.components.rawMini.cueAndExactlyOneQuestion,
    ),
    markdownComponentRow('Frozen v1 span: frozen cue', trained.components.frozenV1Span.cue, untuned.components.frozenV1Span.cue),
    markdownComponentRow(
      'Deterministic v2 span: cue + exactly one question',
      trained.components.counterfactualV2Span.cueAndExactlyOneQuestion,
      untuned.components.counterfactualV2Span.cueAndExactlyOneQuestion,
    ),
    markdownComponentRow('Final delivery: frozen cue', trained.components.finalDelivery.cue, untuned.components.finalDelivery.cue),
    markdownComponentRow(
      'Final audit: full warrant compliance',
      trained.finalAudit,
      untuned.finalAudit,
    ),
    '',
    'The deterministic v2 row is an interface-fidelity diagnostic only: no composer, tutor, learner, judge, or provider call was made.',
    '',
    '## Paired descriptive contrasts',
    '',
    '| Post-hoc trained minus untuned contrast | Estimate |',
    '|---|---:|',
    `| Raw mini: frozen cue | ${fmtPairedContrast(contrasts.rawMini.cue)} |`,
    `| Raw mini: exactly one question | ${fmtPairedContrast(contrasts.rawMini.exactlyOneQuestion)} |`,
    `| Raw mini: cue + exactly one question | ${fmtPairedContrast(contrasts.rawMini.cueAndExactlyOneQuestion)} |`,
    `| Frozen v1 span: frozen cue | ${fmtPairedContrast(contrasts.frozenV1Span.cue)} |`,
    `| Deterministic v2 span: cue + exactly one question | ${fmtPairedContrast(contrasts.counterfactualV2Span.cueAndExactlyOneQuestion)} |`,
    '',
    `These profile-stratified dialogue-cluster intervals are exploratory and use the ${contrasts.rawMini.cue.pairedBlocks} matched blocks with at least one committee moment in both arms. The frozen W1 analysis separately retains its eight sealed dialogue pairs.`,
    '',
    '## Waterfall',
    '',
    '| Transition | Arm | Comparable | Missing prior | Missing next | Cue loss | Cue restoration | Question repair | Question regression | Overwrite |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const transition of Object.keys(trained.waterfall)) {
    for (const [label, summary] of [
      ['trained', trained.waterfall[transition]],
      ['untuned', untuned.waterfall[transition]],
    ]) {
      lines.push(
        `| ${transition} | ${label} | ${summary.comparable} | ${fmtRate(summary.missingPrevious)} | ${fmtRate(summary.missingCurrent)} | ${fmtRate(summary.cueLoss)} | ${fmtRate(summary.cueRestoration)} | ${fmtRate(summary.questionRepair)} | ${fmtRate(summary.questionRegression)} | ${fmtRate(summary.overwrite)} |`,
      );
    }
  }
  lines.push(
    '',
    '## Extreme-output sensitivity',
    '',
    `Excluded by the predeclared diagnostic rule: ${artifact.sensitivityExcludingExtremeMoments.excluded.length} moment(s).`,
    '',
    '| Surface / component | Trained without extremes | Untuned without extremes |',
    '|---|---:|---:|',
    markdownComponentRow(
      'Raw mini: frozen cue',
      trainedSensitivity.components.rawMini.cue,
      untunedSensitivity.components.rawMini.cue,
    ),
    markdownComponentRow(
      'Raw mini: exactly one question',
      trainedSensitivity.components.rawMini.exactlyOneQuestion,
      untunedSensitivity.components.rawMini.exactlyOneQuestion,
    ),
    markdownComponentRow(
      'Raw mini: cue + exactly one question',
      trainedSensitivity.components.rawMini.cueAndExactlyOneQuestion,
      untunedSensitivity.components.rawMini.cueAndExactlyOneQuestion,
    ),
    markdownComponentRow(
      'Deterministic v2 span: cue + exactly one question',
      trainedSensitivity.components.counterfactualV2Span.cueAndExactlyOneQuestion,
      untunedSensitivity.components.counterfactualV2Span.cueAndExactlyOneQuestion,
    ),
    '',
    '## Interim-count reconciliation',
    '',
    artifact.interimReconciliation.note,
    '',
    '| Condition | Interim moments | Final moments | Delta |',
    '|---|---:|---:|---:|',
    ...['trained_committee', 'untuned_committee'].map(
      (condition) =>
        `| ${condition} | ${artifact.interimReconciliation.interim[condition].moments} | ${artifact.interimReconciliation.final[condition].moments} | ${artifact.interimReconciliation.delta[condition].moments} |`,
    ),
    '',
    '## Interpretation boundary',
    '',
    artifact.counterfactualBoundary,
    '',
    `Machine-readable source: \`mediation-analysis.json\` (${artifact.schema}).`,
    '',
  );
  return lines.join('\n');
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'string' },
      markdown: { type: 'string' },
      draws: { type: 'string' },
      seed: { type: 'string' },
    },
  });
  const root = path.resolve(
    positionals[0] || path.join(REPO_ROOT, 'exports/program2-committee-floor-ablation-amendment-4'),
  );
  const artifact = analyzeMediation(root, {
    draws: values.draws ? Number(values.draws) : MEDIATION_SPEC.bootstrapDraws,
    seed: values.seed ? Number(values.seed) : MEDIATION_SPEC.bootstrapSeed,
  });
  if (values.json) fs.writeFileSync(path.resolve(values.json), `${JSON.stringify(artifact, null, 2)}\n`);
  if (values.markdown) fs.writeFileSync(path.resolve(values.markdown), `${renderMediationMarkdown(artifact)}\n`);
  const trained = artifact.sealedConditionalAnalysis.byCondition.trained_committee;
  const untuned = artifact.sealedConditionalAnalysis.byCondition.untuned_committee;
  console.log(
    `[floor-mediation] terminal=${Object.values(artifact.inventory.sealed).reduce((sum, value) => sum + value, 0) + Object.values(artifact.inventory.finalizedAttrition).reduce((sum, value) => sum + value, 0)}/30 ` +
      `sealed=${Object.values(artifact.inventory.sealed).reduce((sum, value) => sum + value, 0)} ` +
      `attrition=${Object.values(artifact.inventory.finalizedAttrition).reduce((sum, value) => sum + value, 0)}`,
  );
  console.log(
    `[floor-mediation] raw cue trained=${fmtRate(trained.components.rawMini.cue)} ` +
      `untuned=${fmtRate(untuned.components.rawMini.cue)}`,
  );
  console.log(
    `[floor-mediation] v2 conjunction trained=${fmtRate(trained.components.counterfactualV2Span.cueAndExactlyOneQuestion)} ` +
      `untuned=${fmtRate(untuned.components.counterfactualV2Span.cueAndExactlyOneQuestion)}`,
  );
  if (values.json) console.log(`[floor-mediation] wrote ${values.json}`);
  if (values.markdown) console.log(`[floor-mediation] wrote ${values.markdown}`);
}

if (path.resolve(process.argv[1] || '') === SCRIPT_PATH) {
  try {
    await main();
  } catch (error) {
    console.error(`[floor-mediation] ${error.stack || error.message}`);
    process.exit(1);
  }
}
