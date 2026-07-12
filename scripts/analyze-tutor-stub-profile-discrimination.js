#!/usr/bin/env node
/**
 * Compact tutor-stub traces into behavior-only turn frames, then compare
 * automated learner profiles by classifier/DAG trajectory signatures.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { learnerProfileContract } from './tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NEGATIVE_REGISTERS = new Set(['ironic', 'sarcastic', 'face_threat']);

const FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    omits_warrant: 0.15,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
    distorts_public_evidence: -0.35,
  },
  agency: {
    passive: 0,
    complying: 0.2,
    attempting: 0.5,
    steering: 0.55,
    self_correcting: 0.8,
  },
  epistemic_stance: {
    answer_seeking: 0.1,
    receptive: 0.2,
    confused: 0.25,
    exploratory: 0.5,
    reflective: 0.65,
    grounded: 0.75,
    overconfident: 0.15,
    resistant: 0.1,
  },
  discourse_move: {
    off_task: 0,
    answer_seeking: 0.1,
    question: 0.3,
    repair_request: 0.35,
    challenge: 0.35,
    claim: 0.45,
    hypothesis: 0.5,
    evidence_adoption: 0.65,
    inference: 0.75,
    metacognitive_reflection: 0.8,
  },
};

const VECTOR_FIELDS = [
  'requestType',
  'discourseMove',
  'evidenceUse',
  'epistemicStance',
  'agency',
  'affectClass',
  'reasoningSpan',
  'learningPace',
];

function parseArgs(argv) {
  const args = {
    traceRoot: '',
    compactedRoot: '',
    traces: [],
    compacted: [],
    writeCompacted: '',
    out: '',
    json: false,
    includeText: false,
    targetAverageCosine: 0.85,
    targetMaxToControl: 0.9,
    controlProfile: 'diligent',
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--json') {
      args.json = true;
      continue;
    }
    if (token === '--include-text') {
      args.includeText = true;
      continue;
    }
    if (token === '--trace-root') {
      args.traceRoot = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--compacted-root') {
      args.compactedRoot = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--trace') {
      args.traces.push(path.resolve(argv[++i] || ''));
      continue;
    }
    if (token === '--compacted') {
      args.compacted.push(path.resolve(argv[++i] || ''));
      continue;
    }
    if (token === '--write-compacted') {
      args.writeCompacted = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--out') {
      args.out = path.resolve(argv[++i] || '');
      continue;
    }
    if (token === '--target-average-cosine') {
      args.targetAverageCosine = numberArg(argv[++i], '--target-average-cosine');
      continue;
    }
    if (token === '--target-max-to-control') {
      args.targetMaxToControl = numberArg(argv[++i], '--target-max-to-control');
      continue;
    }
    if (token === '--control-profile') {
      args.controlProfile = String(argv[++i] || '').trim() || 'diligent';
      continue;
    }
    if (token.startsWith('--')) {
      throw new Error(`Unknown option: ${token}`);
    }
    args.traces.push(path.resolve(token));
  }

  return args;
}

function numberArg(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} must be a number`);
  return number;
}

function printUsage() {
  console.log(`Usage:
  node scripts/analyze-tutor-stub-profile-discrimination.js --trace-root <dir> [options]
  node scripts/analyze-tutor-stub-profile-discrimination.js --compacted-root <dir> [options]

Options:
  --trace-root <dir>             Recursively read tutor-stub .jsonl traces
  --trace <file>                 Read one trace; may be repeated
  --compacted-root <dir>         Recursively read compacted trace .json files
  --compacted <file>             Read one compacted trace; may be repeated
  --write-compacted <dir>        Write compacted traces for reuse
  --include-text                 Preserve short learner/tutor snippets in compacted traces
  --target-average-cosine <n>    Gate threshold for average pairwise cosine (default: 0.85)
  --target-max-to-control <n>    Gate threshold for max similarity to control profile (default: 0.90)
  --control-profile <id>         Control profile for max-to-control gate (default: diligent)
  --json                         Print JSON instead of Markdown
  --out <file>                   Write report to file
`);
}

function readJsonl(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/u).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function walkFiles(dir, predicate) {
  if (!dir || !fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (predicate(fullPath)) {
        out.push(fullPath);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeRubricScore(value) {
  const number = asNumber(value);
  if (number == null) return null;
  return clamp((number - 1) / 4);
}

function rankValue(mapName, value) {
  if (value == null) return null;
  return FIELD_RANKS[mapName]?.[String(value).trim()] ?? null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function explicitRecollectionFrame(text) {
  return /\b(?:(?:we|i)\s+(?:already\s+)?(?:saw|read|heard|recorded|remember(?:ed)?|recall(?:ed)?)|the\s+(?:record|trial-book|book)\s+(?:already\s+)?(?:said|showed|recorded|proved))\b/iu.test(
    String(text || ''),
  );
}

function snippet(value, max = 220) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function safeSlug(value) {
  return String(value || 'unknown')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 120) || 'unknown';
}

function canonicalAffect(value) {
  const affect = String(value || '').trim().toLowerCase();
  if (!affect) return null;
  if (/resist|frustrat|pressur|defens|guarded|strain|overload|sharp|trust-sensitive/u.test(affect)) return 'resistant';
  if (/vulnerab|anxious|ashamed|exposed|hurt/u.test(affect)) return 'vulnerable';
  if (/confident|decisive|eager|rushing|hasty|premature/u.test(affect)) return 'confident';
  if (/confus|uncertain|tentative|unsure/u.test(affect)) return 'uncertain';
  if (/calm|careful|cautious|steady|focused|measured|restrained|controlled|engaged/u.test(affect)) return 'regulated';
  return 'other';
}

function publicTutorPressure(text, register = null) {
  return (
    NEGATIVE_REGISTERS.has(register) ||
    /\b(miraculously|marvelous|wonderful|conveniently|apparently|nice trick|escape route|safe performance|hiding behind|not doing the work|lets you avoid|pressing|do not stall|don['’]t stall|fog and vibes|answer vending machine|mob|jab|jabs)\b/iu.test(
      String(text || ''),
    )
  );
}

function inferProfile(file, root, metadata = {}) {
  const profileId = metadata.autoLearner?.profileId || metadata.autoLearnerProfileId || metadata.profileId;
  if (profileId) return String(profileId);

  const profilePrompt = String(metadata.autoLearner?.profile || '');
  const promptMatch = profilePrompt.match(/simulating this automated learner profile:\s*([a-z0-9_-]+)/iu);
  if (promptMatch) return promptMatch[1].toLowerCase().replace(/-/gu, '_');

  const rel = root ? path.relative(root, file) : file;
  const parts = rel.split(path.sep);
  const tracesIndex = parts.indexOf('traces');
  if (tracesIndex > 0) return parts[tracesIndex - 1];
  return 'unknown';
}

function inferPolicy(file, firstTurn = null) {
  const policy = firstTurn?.registerSelection?.policy;
  if (policy) return String(policy);
  const parent = path.basename(path.dirname(file));
  const match = parent.match(/^(.+)-r\d+$/u);
  return match ? match[1] : parent || 'unknown';
}

function dagSnapshot(turn) {
  const model = turn.tutorLearnerDagModel || {};
  const assessment = model.assessment || {};
  const metrics = model.metrics || {};
  const learnerAdvance = turn.learnerAdvance || turn.tutorLearnerDagUpdate?.advance || model.learnerAdvance || null;
  return {
    status: assessment.status || null,
    bestPathCoverage: asNumber(assessment.bestPathCoverage),
    missingPremiseCount: asNumber(metrics.missingPremiseCount ?? assessment.missingPremiseCount),
    groundedCount: asNumber(metrics.groundedCount),
    voicedDerivedCount: asNumber(metrics.voicedDerivedCount ?? assessment.voicedDerivedCount),
    hypothesisCount: asNumber(metrics.hypothesisCount ?? assessment.hypothesisCount),
    candidateConclusionCount: asNumber(metrics.candidateConclusionCount),
    answerCandidateCount: asNumber(metrics.answerCandidateCount),
    unsupportedAssertionCount: asNumber(assessment.unsupportedAssertionCount),
    finalSecretEntailed: Boolean(assessment.finalSecretEntailed),
    assertedSecret: Boolean(assessment.assertedSecret),
    assertedMirror: Boolean(assessment.assertedMirror),
    bottleneck: assessment.bottleneck || null,
    learnerAdvance,
  };
}

function scoreTurnField(classifier) {
  const dimensions = {
    conceptual: normalizeRubricScore(classifier?.scores?.conceptual_engagement?.score),
    epistemic: normalizeRubricScore(classifier?.scores?.epistemic_readiness?.score),
    evidence: rankValue('evidence_use', classifier?.evidence_use),
    agency: rankValue('agency', classifier?.agency),
    stance: rankValue('epistemic_stance', classifier?.epistemic_stance),
    discourse: rankValue('discourse_move', classifier?.discourse_move),
  };
  return {
    score: mean(Object.values(dimensions)),
    dimensions,
  };
}

function compactTurn(turn, args, { stimulusTutor = '', stimulusRegister = null } = {}) {
  const classifier = turn.classification?.turn || {};
  const register = turn.registerSelection || {};
  const efficacy = turn.previousRegisterEfficacy || {};
  const compact = {
    turn: asNumber(turn.turn),
    classifier: {
      summary: snippet(classifier.summary, 280) || null,
      requestType: classifier.request_type || null,
      discourseMove: classifier.discourse_move || null,
      evidenceUse: classifier.evidence_use || null,
      epistemicStance: classifier.epistemic_stance || null,
      affect: classifier.affect || null,
      affectClass: canonicalAffect(classifier.affect),
      agency: classifier.agency || null,
      conceptualScore: asNumber(classifier.scores?.conceptual_engagement?.score),
      epistemicReadinessScore: asNumber(classifier.scores?.epistemic_readiness?.score),
      pedagogicalNeed: snippet(classifier.pedagogical_need, 280) || null,
      reasoningSpan: classifier.reasoning_span || null,
      learningPace: classifier.learning_pace || null,
    },
    field: scoreTurnField(classifier),
    dag: dagSnapshot(turn),
    register: {
      policy: register.policy || null,
      selected: register.selected_register || register.selected_mode || null,
      confidence: asNumber(register.confidence ?? register.selected_probability),
      entropyBits: asNumber(register.register_vector_entropy_bits),
      distribution: Array.isArray(register.distribution)
        ? register.distribution.map((item) => ({
            register: item.register,
            probability: asNumber(item.probability),
          }))
        : [],
    },
    efficacy: {
      selected: efficacy.selected_register || null,
      label: efficacy.label || null,
      fieldDelta: asNumber(efficacy.field?.delta),
      summary: snippet(efficacy.summary, 220) || null,
    },
    audit: {
      leakOk: turn.tutorLeakAudit?.ok ?? null,
      repaired: Boolean(turn.tutorResponseRepaired),
      deterministicFallback: Boolean(turn.tutorDeterministicFallback),
    },
    stimulus: {
      publicTutorPressure: publicTutorPressure(stimulusTutor, stimulusRegister),
      register: stimulusRegister,
    },
    markers: {
      explicitRecollection: explicitRecollectionFrame(turn.learner),
      learnerAcceleration: Boolean(
        turn.learnerAdvance?.accelerated || turn.tutorLearnerDagUpdate?.advance?.accelerated,
      ),
    },
  };
  if (args.includeText) {
    compact.text = {
      learner: snippet(turn.learner, 320),
      tutor: snippet(turn.tutor, 320),
    };
  }
  return compact;
}

function compactTrace(file, root, args) {
  const events = readJsonl(file);
  const start = events.find((event) => event.type === 'run_start') || null;
  const metadata = start?.metadata || {};
  const turnEvents = events.filter((event) => event.type === 'turn_complete' && event.turnRecord);
  const turns = turnEvents
    .map((event) => event.turnRecord)
    .sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  const firstTurn = turns[0] || null;
  const finalTurn = turns.at(-1) || null;
  const profile = inferProfile(file, root, metadata);
  const policy = inferPolicy(file, firstTurn);
  const opening = events.find((event) => event.type === 'tutor_opening')?.text || '';
  const compactTurns = turns.map((turn, index) =>
    compactTurn(turn, args, {
      stimulusTutor: index === 0 ? opening : turns[index - 1]?.tutor || '',
      stimulusRegister:
        index === 0
          ? null
          : turns[index - 1]?.registerSelection?.selected_register ||
            turns[index - 1]?.registerSelection?.selected_mode ||
            null,
    }),
  );
  const finalDag = compactTurns.at(-1)?.dag || {};
  const runKey = path.basename(path.dirname(file));

  return {
    schema: 'machinespirits.tutor-stub.compacted-trace.v2',
    generatedAt: new Date().toISOString(),
    sourceTrace: path.relative(ROOT, file),
    run: {
      profile,
      policy,
      runKey,
      startedAt: start?.ts || events[0]?.ts || null,
      turnCount: compactTurns.length,
      world: metadata.world?.id || metadata.worldId || null,
      modelRef: metadata.modelRef || null,
      model: finalTurn?.model || metadata.resolved?.model || metadata.modelRef || null,
      provider: finalTurn?.provider || metadata.resolved?.provider || null,
      analysisModelRef: metadata.classifier?.modelRef || null,
      analysisModel: metadata.classifier?.resolved?.model || metadata.classifier?.modelRef || null,
      learnerModelRef: metadata.autoLearner?.modelRef || null,
      learnerModel: metadata.autoLearner?.resolved?.model || metadata.autoLearner?.modelRef || null,
      memorySummary: metadata.memorySummary || null,
    },
    final: {
      bestPathCoverage: finalDag.bestPathCoverage ?? null,
      missingPremiseCount: finalDag.missingPremiseCount ?? null,
      bottleneck: finalDag.bottleneck || null,
      finalSecretEntailed: Boolean(finalDag.finalSecretEntailed),
      assertedSecret: Boolean(finalDag.assertedSecret),
      groundedClosure: Boolean(
        finalDag.bottleneck === 'grounded_asserted_secret' ||
          (finalDag.finalSecretEntailed === true && finalDag.assertedSecret === true),
      ),
    },
    turns: compactTurns,
  };
}

function observedModelCounts(traces, modelKey, refKey, providerKey = 'provider') {
  const counts = new Map();
  for (const trace of traces) {
    const model = trace.run?.[modelKey] || trace.run?.[refKey] || null;
    if (!model) continue;
    const provider = trace.run?.[providerKey] || null;
    const label = provider && !String(model).startsWith(`${provider}.`) ? `${provider}.${model}` : String(model);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function readCompacted(file) {
  const compacted = readJson(file);
  if (
    compacted.schema !== 'machinespirits.tutor-stub.compacted-trace.v1' &&
    compacted.schema !== 'machinespirits.tutor-stub.compacted-trace.v2'
  ) {
    throw new Error(`Not a compacted tutor-stub trace: ${file}`);
  }
  for (const turn of compacted.turns || []) {
    if (!turn.classifier?.affectClass) {
      turn.classifier.affectClass = canonicalAffect(turn.classifier?.affect);
    }
  }
  return compacted;
}

function writeCompactedTrace(compacted, outDir, usedNames) {
  const profile = safeSlug(compacted.run?.profile || 'unknown');
  const policy = safeSlug(compacted.run?.policy || 'unknown');
  const runKey = safeSlug(compacted.run?.runKey || path.basename(compacted.sourceTrace || 'trace'));
  const profileDir = path.join(outDir, profile);
  fs.mkdirSync(profileDir, { recursive: true });
  let basename = `${policy}-${runKey}.compact-trace.json`;
  let serial = 2;
  while (usedNames.has(path.join(profileDir, basename))) {
    basename = `${policy}-${runKey}-${serial}.compact-trace.json`;
    serial += 1;
  }
  const fullPath = path.join(profileDir, basename);
  usedNames.add(fullPath);
  fs.writeFileSync(fullPath, `${JSON.stringify(compacted, null, 2)}\n`);
  return fullPath;
}

function addVector(vector, key, amount = 1) {
  if (!key) return;
  vector.set(key, (vector.get(key) || 0) + amount);
}

function addCategorical(vector, prefix, value, amount = 1) {
  if (value == null || value === '') return;
  addVector(vector, `${prefix}:${value}`, amount);
}

function phaseForTurn(index, total) {
  if (total <= 1 || index / total < 1 / 3) return 'early';
  if (index / total < 2 / 3) return 'middle';
  return 'late';
}

function unitBand(value) {
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return 'zero';
  if (value < 0.34) return 'low';
  if (value < 0.67) return 'medium';
  return 'high';
}

function movement(value, previous, { lowerIsBetter = false } = {}) {
  if (!Number.isFinite(value) || !Number.isFinite(previous)) return null;
  const delta = (value - previous) * (lowerIsBetter ? -1 : 1);
  if (delta > 0.01) return 'improving';
  if (delta < -0.01) return 'regressing';
  return 'flat';
}

function vectorForTrace(compacted) {
  const vector = new Map();
  const turns = compacted.turns || [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    const previous = turns[index - 1] || null;
    const phase = phaseForTurn(index, turns.length);
    for (const field of VECTOR_FIELDS) {
      const value = turn.classifier?.[field];
      if (value) {
        addVector(vector, `${field}:${value}`);
        addVector(vector, `phase:${phase}:${field}:${value}`, 0.4);
      }
    }
    const conceptual = turn.classifier?.conceptualScore;
    if (Number.isFinite(conceptual)) addVector(vector, `conceptualScore:${conceptual}`, 0.5);
    const epistemic = turn.classifier?.epistemicReadinessScore;
    if (Number.isFinite(epistemic)) addVector(vector, `epistemicReadinessScore:${epistemic}`, 0.5);
    if (turn.markers?.explicitRecollection) {
      addVector(vector, 'marker:explicitRecollection');
      addVector(vector, `phase:${phase}:marker:explicitRecollection`, 0.4);
    }
    if (turn.markers?.learnerAcceleration) {
      addVector(vector, 'marker:learnerAcceleration');
      addVector(vector, `phase:${phase}:marker:learnerAcceleration`, 0.5);
    }

    addCategorical(vector, 'dag:bottleneck', turn.dag?.bottleneck, 0.35);
    addCategorical(vector, 'dag:coverage', unitBand(turn.dag?.bestPathCoverage), 0.35);
    addCategorical(
      vector,
      'dag:coverageMovement',
      movement(turn.dag?.bestPathCoverage, previous?.dag?.bestPathCoverage),
      0.35,
    );
    addCategorical(
      vector,
      'dag:missingMovement',
      movement(turn.dag?.missingPremiseCount, previous?.dag?.missingPremiseCount, {
        lowerIsBetter: true,
      }),
      0.35,
    );
    addCategorical(vector, 'field:score', unitBand(turn.field?.score), 0.25);
    addCategorical(vector, 'field:movement', movement(turn.field?.score, previous?.field?.score), 0.25);
  }
  return vector;
}

function combineVectors(vectors) {
  const combined = new Map();
  for (const vector of vectors) {
    for (const [key, value] of vector.entries()) addVector(combined, key, value);
  }
  return combined;
}

function cosine(a, b) {
  const keys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (const key of keys) {
    const av = a.get(key) || 0;
    const bv = b.get(key) || 0;
    dot += av * bv;
    aMag += av * av;
    bMag += bv * bv;
  }
  if (!aMag || !bMag) return null;
  return dot / (Math.sqrt(aMag) * Math.sqrt(bMag));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function bandCheck(field, label, value, range) {
  const [low, high] = range.map(Number);
  const pass = Number.isFinite(value) && value >= low && value <= high;
  const deviation = !Number.isFinite(value) ? null : value < low ? low - value : value > high ? value - high : 0;
  return {
    field,
    label,
    value: round(value),
    target: [low, high],
    pass,
    deviation: round(deviation),
  };
}

function summarizeSignatureAdherence(profile, turns) {
  const contract = learnerProfileContract(profile);
  const targets = contract?.traceSignatureTargets;
  if (!targets || !turns.length) return null;
  const checks = [];
  for (const field of ['requestType', 'discourseMove', 'evidenceUse', 'epistemicStance', 'agency']) {
    const fieldTargets = targets[field] || {};
    const counts = countBy(turns, (turn) => turn.classifier?.[field]);
    for (const [label, range] of Object.entries(fieldTargets)) {
      checks.push(bandCheck(field, label, Number(counts[label] || 0) / turns.length, range));
    }
  }
  const scoreTargets = targets.scoreBands || {};
  const scoreValues = {
    conceptualScore: mean(turns.map((turn) => turn.classifier?.conceptualScore)),
    epistemicReadinessScore: mean(turns.map((turn) => turn.classifier?.epistemicReadinessScore)),
  };
  for (const [label, range] of Object.entries(scoreTargets)) {
    checks.push(bandCheck('scoreBands', label, scoreValues[label], range));
  }
  const passed = checks.filter((check) => check.pass).length;
  return {
    checks: checks.length,
    passed,
    passRate: round(checks.length ? passed / checks.length : null),
    meanDeviation: round(mean(checks.map((check) => check.deviation))),
    details: checks,
  };
}

function markerGroupMatches(turn, group) {
  if (group.field === 'explicitRecollection') {
    return (group.values || []).includes(Boolean(turn.markers?.explicitRecollection));
  }
  const value = turn.classifier?.[group.field];
  return (group.values || []).includes(value);
}

function observabilityMatches(turn, observability) {
  const clauses = observability?.markerClauses || [];
  if (clauses.length) {
    return clauses.some((clause) => clause.length > 0 && clause.every((group) => markerGroupMatches(turn, group)));
  }
  const groups = observability?.markerGroups || [];
  if (!groups.length) return false;
  const results = groups.map((group) => markerGroupMatches(turn, group));
  return observability.match === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function policyIsEligible(policy, eligiblePolicies) {
  return eligiblePolicies.includes('*') || eligiblePolicies.includes(policy);
}

function turnIsObservableOpportunity(turn, observability) {
  if (observability.eligibility !== 'public_tutor_pressure') return true;
  return turn.stimulus?.publicTutorPressure ?? true;
}

function summarizeObservability(profile, traces) {
  const contract = learnerProfileContract(profile);
  const observability = contract?.observabilityContract;
  if (!observability) return null;
  const eligibleTraces = traces.filter((trace) =>
    policyIsEligible(trace.run?.policy, observability.eligiblePolicies || ['*']),
  );
  const runRows = eligibleTraces.map((trace) => {
    const turns = (trace.turns || []).filter((turn) => turnIsObservableOpportunity(turn, observability));
    const matching = turns.filter((turn) => observabilityMatches(turn, observability));
    const deadline = observability.mustShowByTurn;
    return {
      runKey: trace.run?.runKey || null,
      policy: trace.run?.policy || null,
      eligibleTurns: turns.length,
      matchingTurns: matching.length,
      observedRate: round(turns.length ? matching.length / turns.length : null),
      firstMatchTurn: matching.length ? Math.min(...matching.map((turn) => Number(turn.turn || 0))) : null,
      deadlinePass:
        deadline == null
          ? true
          : matching.some((turn) => Number(turn.turn || 0) <= deadline),
    };
  });
  const eligibleTurns = eligibleTraces.flatMap((trace) =>
    (trace.turns || []).filter((turn) => turnIsObservableOpportunity(turn, observability)),
  );
  const matchingTurns = eligibleTurns.filter((turn) => observabilityMatches(turn, observability));
  const deadline = observability.mustShowByTurn;
  const runsMeetingDeadline = deadline == null
    ? eligibleTraces.length
    : eligibleTraces.filter((trace) =>
        (trace.turns || []).filter((turn) => turnIsObservableOpportunity(turn, observability)).some(
          (turn) => Number(turn.turn || 0) <= deadline && observabilityMatches(turn, observability),
        ),
      ).length;
  const observedRate = eligibleTurns.length ? matchingTurns.length / eligibleTurns.length : null;
  const deadlinePass = eligibleTraces.length > 0 && runsMeetingDeadline === eligibleTraces.length;
  const recurrencePass = observedRate != null && observedRate >= Number(observability.minEligibleRate || 0);
  return {
    eligiblePolicies: observability.eligiblePolicies,
    eligibleTraces: eligibleTraces.length,
    eligibleTurns: eligibleTurns.length,
    matchingTurns: matchingTurns.length,
    observedRate: round(observedRate),
    targetRate: observability.minEligibleRate,
    mustShowByTurn: deadline,
    runsMeetingDeadline,
    deadlinePass,
    recurrencePass,
    pass: Boolean(deadlinePass && recurrencePass),
    runs: runRows,
  };
}

function summarizeProfile(profile, traces) {
  const turns = traces.flatMap((trace) => trace.turns || []);
  const finals = traces.map((trace) => trace.final || {});
  const signatureAdherence = summarizeSignatureAdherence(profile, turns);
  const observability = summarizeObservability(profile, traces);
  return {
    profile,
    traces: traces.length,
    turns: turns.length,
    policies: [...new Set(traces.map((trace) => trace.run?.policy).filter(Boolean))].sort(),
    meanFinalCoverage: round(mean(finals.map((final) => final.bestPathCoverage))),
    meanMissingPremises: round(mean(finals.map((final) => final.missingPremiseCount))),
    groundedClosures: finals.filter((final) => final.groundedClosure).length,
    meanConceptualScore: round(mean(turns.map((turn) => turn.classifier?.conceptualScore))),
    meanEpistemicReadinessScore: round(mean(turns.map((turn) => turn.classifier?.epistemicReadinessScore))),
    requestTypes: countBy(turns, (turn) => turn.classifier?.requestType),
    discourseMoves: countBy(turns, (turn) => turn.classifier?.discourseMove),
    evidenceUse: countBy(turns, (turn) => turn.classifier?.evidenceUse),
    epistemicStance: countBy(turns, (turn) => turn.classifier?.epistemicStance),
    agency: countBy(turns, (turn) => turn.classifier?.agency),
    affect: countBy(turns, (turn) => turn.classifier?.affect),
    affectClass: countBy(turns, (turn) => turn.classifier?.affectClass),
    signatureAdherence,
    observability,
  };
}

function buildReport(compactedTraces, args, compactedWrites) {
  const byProfile = new Map();
  for (const trace of compactedTraces) {
    const profile = trace.run?.profile || 'unknown';
    if (!byProfile.has(profile)) byProfile.set(profile, []);
    byProfile.get(profile).push(trace);
  }

  const profileVectors = new Map();
  const profileSummaries = [];
  for (const [profile, traces] of [...byProfile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    profileVectors.set(profile, combineVectors(traces.map(vectorForTrace)));
    profileSummaries.push(summarizeProfile(profile, traces));
  }

  const profiles = [...profileVectors.keys()];
  const pairwise = [];
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const a = profiles[i];
      const b = profiles[j];
      pairwise.push({
        a,
        b,
        pair: `${a} vs ${b}`,
        cosine: round(cosine(profileVectors.get(a), profileVectors.get(b))),
      });
    }
  }

  const averagePairwiseCosine = round(mean(pairwise.map((pair) => pair.cosine)));
  const maxPairwiseCosine = round(Math.max(...pairwise.map((pair) => pair.cosine).filter(Number.isFinite)));
  const controlPairs = pairwise.filter((pair) => pair.a === args.controlProfile || pair.b === args.controlProfile);
  const maxSimilarityToControl = controlPairs.length
    ? round(Math.max(...controlPairs.map((pair) => pair.cosine).filter(Number.isFinite)))
    : null;
  const closestPairs = [...pairwise].sort((a, b) => (b.cosine ?? -1) - (a.cosine ?? -1)).slice(0, 8);
  const mostSeparatedPairs = [...pairwise].sort((a, b) => (a.cosine ?? 2) - (b.cosine ?? 2)).slice(0, 8);

  const policyPairwise = [];
  const policySummaries = [];
  const policies = [...new Set(compactedTraces.map((trace) => trace.run?.policy).filter(Boolean))].sort();
  for (const policy of policies) {
    const vectors = new Map();
    for (const profile of profiles) {
      const traces = byProfile.get(profile).filter((trace) => trace.run?.policy === policy);
      if (traces.length) vectors.set(profile, combineVectors(traces.map(vectorForTrace)));
    }
    const policyProfiles = [...vectors.keys()];
    const pairs = [];
    for (let i = 0; i < policyProfiles.length; i += 1) {
      for (let j = i + 1; j < policyProfiles.length; j += 1) {
        const a = policyProfiles[i];
        const b = policyProfiles[j];
        const row = {
          policy,
          a,
          b,
          pair: `${a} vs ${b}`,
          cosine: round(cosine(vectors.get(a), vectors.get(b))),
          tracesA: byProfile.get(a).filter((trace) => trace.run?.policy === policy).length,
          tracesB: byProfile.get(b).filter((trace) => trace.run?.policy === policy).length,
        };
        pairs.push(row);
        policyPairwise.push(row);
      }
    }
    const policyControlPairs = pairs.filter((pair) => pair.a === args.controlProfile || pair.b === args.controlProfile);
    policySummaries.push({
      policy,
      profiles: policyProfiles.length,
      averagePairwiseCosine: round(mean(pairs.map((pair) => pair.cosine))),
      maxSimilarityToControl: policyControlPairs.length
        ? round(Math.max(...policyControlPairs.map((pair) => pair.cosine).filter(Number.isFinite)))
        : null,
    });
  }

  const macroAveragePolicyPairwiseCosine = round(mean(policyPairwise.map((pair) => pair.cosine)));
  const policyControlPairs = policyPairwise.filter(
    (pair) => pair.a === args.controlProfile || pair.b === args.controlProfile,
  );
  const maxPolicySimilarityToControl = policyControlPairs.length
    ? round(Math.max(...policyControlPairs.map((pair) => pair.cosine).filter(Number.isFinite)))
    : null;

  const averagePass = averagePairwiseCosine != null && averagePairwiseCosine <= args.targetAverageCosine;
  const controlPass =
    maxSimilarityToControl == null ? null : maxSimilarityToControl <= args.targetMaxToControl;
  const pooledPass = Boolean(averagePass && (controlPass === true || controlPass == null));

  const conditionedProfileGates = profileSummaries
    .filter((profile) => profile.profile !== args.controlProfile)
    .map((profile) => {
      const contract = learnerProfileContract(profile.profile);
      const observability = contract?.observabilityContract;
      if (!observability) return null;
      const eligiblePolicies = observability.eligiblePolicies || ['*'];
      const probePairs = policyPairwise.filter((pair) => {
        const matchedProfile =
          (pair.a === profile.profile && pair.b === args.controlProfile) ||
          (pair.b === profile.profile && pair.a === args.controlProfile);
        return matchedProfile && policyIsEligible(pair.policy, eligiblePolicies);
      });
      const maxProbeSimilarity = probePairs.length
        ? round(Math.max(...probePairs.map((pair) => pair.cosine).filter(Number.isFinite)))
        : null;
      const targetCosine = Number(contract.discriminationGate?.maxCosineToDiligent ?? args.targetMaxToControl);
      const minSignatureTargetPassRate = Number(contract.discriminationGate?.minSignatureTargetPassRate ?? 0);
      const cosinePass = maxProbeSimilarity != null && maxProbeSimilarity <= targetCosine;
      const signaturePass =
        profile.signatureAdherence?.passRate != null &&
        profile.signatureAdherence.passRate >= minSignatureTargetPassRate;
      const observabilityPass = profile.observability?.pass === true;
      return {
        profile: profile.profile,
        eligiblePolicies,
        observedPolicies: [...new Set(probePairs.map((pair) => pair.policy))].sort(),
        maxProbeSimilarity,
        targetMaxCosine: targetCosine,
        cosinePass,
        signatureTargetPassRate: profile.signatureAdherence?.passRate ?? null,
        minSignatureTargetPassRate,
        signaturePass,
        observabilityPass,
        pass: Boolean(cosinePass && signaturePass && observabilityPass),
      };
    })
    .filter(Boolean);
  const conditionedPass = conditionedProfileGates.length
    ? conditionedProfileGates.every((profile) => profile.pass)
    : null;
  const primaryPass = conditionedPass == null ? pooledPass : conditionedPass;

  return {
    schema: 'machinespirits.tutor-stub.profile-discrimination.v3',
    generatedAt: new Date().toISOString(),
    input: {
      traceRoot: args.traceRoot || null,
      compactedRoot: args.compactedRoot || null,
      traces: compactedTraces.map((trace) => trace.sourceTrace || null).filter(Boolean),
      compactedWrites,
      vectorFields: [
        ...VECTOR_FIELDS,
        'conceptualScore',
        'epistemicReadinessScore',
        'phase',
        'dagBottleneck',
        'dagCoverageMovement',
        'dagMissingMovement',
        'fieldScoreMovement',
      ],
    },
    summary: {
      traces: compactedTraces.length,
      profiles: profiles.length,
      turns: compactedTraces.reduce((sum, trace) => sum + (trace.turns || []).length, 0),
      observedModels: {
        tutor: observedModelCounts(compactedTraces, 'model', 'modelRef'),
        analysis: observedModelCounts(compactedTraces, 'analysisModel', 'analysisModelRef'),
        learner: observedModelCounts(compactedTraces, 'learnerModel', 'learnerModelRef'),
      },
      averagePairwiseCosine,
      maxPairwiseCosine: Number.isFinite(maxPairwiseCosine) ? maxPairwiseCosine : null,
      controlProfile: args.controlProfile,
      maxSimilarityToControl,
      macroAveragePolicyPairwiseCosine,
      maxPolicySimilarityToControl,
    },
    gate: {
      mode: conditionedPass == null ? 'pooled' : 'contract_conditioned',
      targetAverageCosine: args.targetAverageCosine,
      targetMaxToControl: args.targetMaxToControl,
      averagePass,
      controlPass,
      pass: primaryPass,
      pooled: {
        averagePass,
        controlPass,
        pass: pooledPass,
      },
      conditioned: {
        pass: conditionedPass,
        profiles: conditionedProfileGates,
      },
    },
    profiles: profileSummaries,
    pairwise,
    policySummaries,
    policyPairwise,
    closestPairs,
    mostSeparatedPairs,
  };
}

function formatObjectCounts(counts, max = 4) {
  return Object.entries(counts || {})
    .slice(0, max)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

function formatModelCounts(counts) {
  const entries = Object.entries(counts || {});
  return entries.length ? entries.map(([model, count]) => `${model} (${count})`).join(', ') : 'unknown';
}

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Tutor Stub Profile Discrimination');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Compacted traces: ${report.summary.traces}`);
  lines.push(`- Profiles: ${report.summary.profiles}`);
  lines.push(`- Turns: ${report.summary.turns}`);
  lines.push(`- Observed tutor models: ${formatModelCounts(report.summary.observedModels?.tutor)}`);
  lines.push(`- Observed analysis models: ${formatModelCounts(report.summary.observedModels?.analysis)}`);
  lines.push(`- Observed learner models: ${formatModelCounts(report.summary.observedModels?.learner)}`);
  lines.push(`- Pooled average pairwise cosine: ${report.summary.averagePairwiseCosine ?? 'n/a'}`);
  lines.push(`- Pooled max pairwise cosine: ${report.summary.maxPairwiseCosine ?? 'n/a'}`);
  lines.push(
    `- Pooled max similarity to ${report.summary.controlProfile}: ${report.summary.maxSimilarityToControl ?? 'n/a'}`,
  );
  lines.push(`- Matched-policy macro average cosine: ${report.summary.macroAveragePolicyPairwiseCosine ?? 'n/a'}`);
  lines.push(`- Matched-policy max similarity to control: ${report.summary.maxPolicySimilarityToControl ?? 'n/a'}`);
  lines.push(
    `- Primary gate: ${report.gate.pass ? 'pass' : 'fail'} (${report.gate.mode})`,
  );
  lines.push(
    `- Pooled diagnostic: ${report.gate.pooled.pass ? 'pass' : 'fail'} (average <= ${report.gate.targetAverageCosine}; max-to-control <= ${report.gate.targetMaxToControl})`,
  );
  lines.push('');

  lines.push('## Profiles');
  lines.push('');
  lines.push('| Profile | Traces | Turns | Final coverage | Missing | Conceptual | Epistemic | Signature targets | Failure rate | Failure observed by deadline | Top evidence | Top stance | Top agency |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |');
  for (const profile of report.profiles) {
    lines.push(
      `| ${profile.profile} | ${profile.traces} | ${profile.turns} | ${profile.meanFinalCoverage ?? ''} | ${profile.meanMissingPremises ?? ''} | ${profile.meanConceptualScore ?? ''} | ${profile.meanEpistemicReadinessScore ?? ''} | ${profile.signatureAdherence?.passRate ?? 'n/a'} | ${profile.observability?.observedRate ?? 'n/a'} | ${profile.observability ? `${profile.observability.runsMeetingDeadline}/${profile.observability.eligibleTraces}` : 'n/a'} | ${formatObjectCounts(profile.evidenceUse, 2)} | ${formatObjectCounts(profile.epistemicStance, 2)} | ${formatObjectCounts(profile.agency, 2)} |`,
    );
  }
  lines.push('');

  lines.push('## Contract-Conditioned Gates');
  lines.push('');
  if (report.gate.conditioned.profiles.length) {
    lines.push('| Profile | Probe policies | Max cosine to control | Target | Signature pass rate | Failure recurrence | Result |');
    lines.push('| --- | --- | ---: | ---: | ---: | --- | --- |');
    for (const profile of report.gate.conditioned.profiles) {
      const summary = report.profiles.find((row) => row.profile === profile.profile);
      const observability = summary?.observability;
      lines.push(
        `| ${profile.profile} | ${profile.observedPolicies.join(', ') || 'none'} | ${profile.maxProbeSimilarity ?? 'n/a'} | <= ${profile.targetMaxCosine} | ${profile.signatureTargetPassRate ?? 'n/a'} | ${observability ? `${observability.observedRate} (target ${observability.targetRate})` : 'n/a'} | ${profile.pass ? 'pass' : 'fail'} |`,
      );
    }
  } else {
    lines.push('No profile contracts supplied an observability gate; pooled cosine is the primary gate.');
  }
  lines.push('');

  lines.push('## Matched Policy Diagnostics');
  lines.push('');
  lines.push('| Policy | Profiles | Average cosine | Max to control |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const policy of report.policySummaries) {
    lines.push(
      `| ${policy.policy} | ${policy.profiles} | ${policy.averagePairwiseCosine ?? 'n/a'} | ${policy.maxSimilarityToControl ?? 'n/a'} |`,
    );
  }
  lines.push('');

  lines.push('## Closest Pairs');
  lines.push('');
  lines.push('| Pair | Cosine |');
  lines.push('| --- | ---: |');
  for (const pair of report.closestPairs) {
    lines.push(`| ${pair.pair} | ${pair.cosine ?? ''} |`);
  }
  lines.push('');

  lines.push('## Most Separated Pairs');
  lines.push('');
  lines.push('| Pair | Cosine |');
  lines.push('| --- | ---: |');
  for (const pair of report.mostSeparatedPairs) {
    lines.push(`| ${pair.pair} | ${pair.cosine ?? ''} |`);
  }
  lines.push('');

  if (report.input.compactedWrites?.length) {
    lines.push('## Compacted Traces');
    lines.push('');
    for (const file of report.input.compactedWrites) lines.push(`- \`${file}\``);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function collectInputs(args) {
  const traceFiles = [
    ...args.traces,
    ...walkFiles(args.traceRoot, (file) => file.endsWith('.jsonl')),
  ];
  const compactedFiles = [
    ...args.compacted,
    ...walkFiles(args.compactedRoot, (file) => file.endsWith('.json') && file.includes('compact-trace')),
  ];

  if (!traceFiles.length && !compactedFiles.length) {
    throw new Error('Provide --trace-root, --trace, --compacted-root, or --compacted');
  }

  return { traceFiles, compactedFiles };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { traceFiles, compactedFiles } = collectInputs(args);
  const compactedTraces = [
    ...traceFiles.map((file) => compactTrace(file, args.traceRoot || path.dirname(file), args)),
    ...compactedFiles.map(readCompacted),
  ];

  const compactedWrites = [];
  if (args.writeCompacted) {
    const usedNames = new Set();
    for (const compacted of compactedTraces) {
      if (!compacted.sourceTrace || compactedFiles.includes(path.resolve(compacted.sourceTrace))) continue;
      compactedWrites.push(path.relative(ROOT, writeCompactedTrace(compacted, args.writeCompacted, usedNames)));
    }
  }

  const report = buildReport(compactedTraces, args, compactedWrites);
  const output = args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report);

  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
  } else {
    process.stdout.write(output);
  }
}

try {
  main();
} catch (error) {
  console.error(`error: ${error.message}`);
  process.exit(1);
}
