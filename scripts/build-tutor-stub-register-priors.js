#!/usr/bin/env node
/**
 * Build empirical register priors from saved tutor-stub traces.
 *
 * The output is intentionally a calibration artifact, not a new hardcoded
 * policy: tutor-stub can load it to add cross-run logit corrections on top of
 * the theory-grounded dynamical-system mapping.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = '.tutor-stub-auto-eval/register-empirical-priors.json';

const FIELD_RANKS = {
  evidence_use: {
    none: 0,
    repeats_setup: 0.1,
    cites_public_evidence: 0.4,
    revises_from_evidence: 0.5,
    links_evidence_to_rule: 0.7,
    overleaps_evidence: -0.2,
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

const { values: args } = parseArgs({
  options: {
    root: {
      type: 'string',
      multiple: true,
      default: ['.tutor-stub-auto-eval', '.tutor-stub-traces'],
    },
    'exports-root': { type: 'string', default: 'exports' },
    out: { type: 'string', default: DEFAULT_OUT },
    'min-n': { type: 'string', default: '3' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  node scripts/build-tutor-stub-register-priors.js [options]

Options:
  --root <dir>          trace root to scan; may be repeated
                        (default: .tutor-stub-auto-eval and .tutor-stub-traces)
  --exports-root <dir>  also scan tutor-stub ABM trace exports under this root (default: exports)
  --out <path>          output JSON path (default: ${DEFAULT_OUT})
  --min-n <n>           shrinkage denominator and reporting threshold (default: 3)
  --json                print the full JSON artifact to stdout
`);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function walkFiles(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, acc);
    } else if (entry.isFile() && predicate(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function discoverTraceFiles() {
  const roots = args.root.map(resolvePath);
  const exportRoot = resolvePath(args['exports-root']);
  const files = [];
  for (const root of roots) {
    walkFiles(root, (file) => file.endsWith('.jsonl'), files);
  }
  walkFiles(exportRoot, (file) => file.endsWith('.jsonl') && file.includes(`${path.sep}traces${path.sep}`), files);
  return [...new Set(files)].sort();
}

function readJsonl(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  }
  return rows;
}

function asNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function clampSigned(value) {
  return Math.max(-1, Math.min(1, value));
}

function round(value, decimals = 3) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(decimals)) : null;
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  return score;
}

function normalizedRubric(score) {
  const numeric = asNumber(scoreValue(score));
  return numeric === null ? null : clamp((numeric - 1) / 4);
}

function rankValue(axis, value) {
  if (value === undefined || value === null) return null;
  return FIELD_RANKS[axis]?.[String(value).trim()] ?? null;
}

function axisValue(value, fallback = 0.5) {
  const numeric = asNumber(value);
  return numeric === null ? fallback : clamp(numeric);
}

function signalMatches(pattern, values) {
  return pattern.test(values.filter(Boolean).join(' '));
}

function canonicalRegister(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return resolveEngagementRegister(raw, { fallback: raw })?.register || raw;
}

function turnClassification(turn) {
  return turn?.classification?.turn || {};
}

function turnDag(turn) {
  return turn?.tutorLearnerDagModel || {};
}

function buildStateVector(turn) {
  const classification = turnClassification(turn);
  const scores = classification.scores || {};
  const dag = turnDag(turn);
  const metrics = dag.metrics || {};
  const assessment = dag.assessment || {};
  const conceptual = axisValue(normalizedRubric(scores.conceptual_engagement));
  const epistemic = axisValue(normalizedRubric(scores.epistemic_readiness));
  const evidence = axisValue(rankValue('evidence_use', classification.evidence_use));
  const agency = axisValue(rankValue('agency', classification.agency));
  const bestPathCoverage = axisValue(assessment.bestPathCoverage, 0);
  const missingNeed = clamp(Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0) / 6);
  const unsupportedNeed = clamp(Number(assessment.unsupportedAssertionCount || 0) / 3);
  const signalValues = [
    classification.request_type,
    classification.discourse_move,
    classification.evidence_use,
    classification.epistemic_stance,
    classification.agency,
    classification.affect,
    assessment.bottleneck,
  ];
  const explicitAffective = signalMatches(
    /vulnerability_or_moral_exposure|affective_signal|vulnerable|shame|anxious|risk/iu,
    signalValues,
  );
  const answerSeeking = signalMatches(/answer_seeking|overconfident|passive|complying/iu, signalValues);
  const resistance = signalMatches(/resistance_or_low_agency|resistant|challenge|authority_refusal/iu, signalValues);
  const plainNeed = signalMatches(
    /plain_language_request|plain_simplification_followup|transfer_demand_or_named_material/iu,
    signalValues,
  );
  const overreach = signalMatches(/overleaps_evidence|unsupported|premature_assertion/iu, signalValues);
  const learnerIntegrationGap = assessment.bottleneck === 'learner_integration_gap';
  const assertionGap = assessment.bottleneck === 'assertion_gap';
  const releaseGap = /release_or_pacing_gap|inference_gap/iu.test(assessment.bottleneck || '');
  const surface = mean([conceptual, epistemic, evidence, agency]) ?? 0.5;
  const lowSurface = clamp(1 - surface);
  const affectiveRisk = clamp((explicitAffective ? 0.55 : 0) + (1 - epistemic) * 0.15);
  const coercionRisk = clamp((answerSeeking ? 0.2 : 0) + affectiveRisk * 0.25);
  const agencyDeficit = clamp(1 - agency + (answerSeeking ? 0.25 : 0) + (resistance ? 0.15 : 0));
  const evidenceGap = clamp(
    (1 - bestPathCoverage) * 0.45 + missingNeed * 0.35 + (1 - evidence) * 0.15 + (releaseGap ? 0.15 : 0),
  );
  const warrantGap = clamp(
    unsupportedNeed * 0.35 +
      (overreach ? 0.3 : 0) +
      (assessment.assertedSecret && !assessment.finalSecretEntailed ? 0.3 : 0) +
      (assertionGap ? 0.25 : 0) +
      (1 - epistemic) * 0.1,
  );
  const recognitionPressure = clamp(
    agencyDeficit * 0.35 +
      (resistance ? 0.25 : 0) +
      (answerSeeking ? 0.25 : 0) +
      coercionRisk * 0.25 +
      affectiveRisk * 0.15,
  );
  const integrationNeed = clamp(lowSurface * 0.35 + (learnerIntegrationGap ? 0.25 : 0) + (plainNeed ? 0.2 : 0));
  const compressionNeed = clamp(
    (plainNeed ? 0.5 : 0) + lowSurface * 0.35 + (assessment.finalSecretEntailed ? 0.15 : 0),
  );
  const closurePressure = clamp(
    (assessment.finalSecretEntailed ? 0.35 : 0) + bestPathCoverage * 0.45 + (assertionGap ? 0.2 : 0),
  );
  const stagnation = clamp((answerSeeking ? 0.25 : 0) + lowSurface * 0.2 + (releaseGap ? 0.1 : 0));
  const disruptionNeed = clamp(
    stagnation * 0.5 + (resistance ? 0.25 : 0) + agencyDeficit * 0.2 - affectiveRisk * 0.35 - coercionRisk * 0.35,
  );
  const momentum = clamp(
    bestPathCoverage * 0.25 +
      evidence * 0.25 +
      agency * 0.2 +
      (classification.request_type === 'stepwise_support_request' ? 0.2 : 0),
  );
  const tempoAffordance = clamp(momentum * (1 - affectiveRisk) * (1 - coercionRisk));
  return {
    evidence_gap: round(evidenceGap),
    warrant_gap: round(warrantGap),
    agency_deficit: round(agencyDeficit),
    affective_risk: round(affectiveRisk),
    recognition_pressure: round(recognitionPressure),
    coercion_risk: round(coercionRisk),
    integration_need: round(integrationNeed),
    compression_need: round(compressionNeed),
    momentum: round(momentum),
    stagnation: round(stagnation),
    disruption_need: round(disruptionNeed),
    tempo_affordance: round(tempoAffordance),
    closure_pressure: round(closurePressure),
  };
}

function outcomeFromEfficacy(efficacy, sourceTurn) {
  const progressScore = asNumber(efficacy.progressScore) ?? 0;
  const fieldDelta = asNumber(efficacy.field?.delta) ?? 0;
  const progress = clampSigned(progressScore / 4);
  const field = clampSigned(fieldDelta * 4);
  const labelAdjustment =
    efficacy.label === 'positive_progress' ? 0.25 : efficacy.label === 'regression_or_overreach' ? -0.35 : -0.08;
  const dagAdjustment = efficacy.dagProgress ? 0.12 : 0;
  const leakPenalty = sourceTurn?.tutorLeakAudit?.ok === false ? -0.3 : 0;
  return round(clampSigned(0.55 * progress + 0.25 * field + labelAdjustment + dagAdjustment + leakPenalty));
}

function feedbackRating(feedback) {
  const rating = String(feedback?.rating || '')
    .trim()
    .toLowerCase();
  return feedback?.supplied && (rating === 'up' || rating === 'down') ? rating : null;
}

function responseConfiguration(turn) {
  return turn?.responseConfiguration || turn?.registerSelection?.response_configuration || null;
}

function configurationSnapshot(turn) {
  const configuration = responseConfiguration(turn);
  if (!configuration) return null;
  return {
    engagement_stance: configuration.engagement_stance || configuration.selected_register || null,
    action_family: configuration.action_family || null,
    audience_register: configuration.audience_register || null,
    lexical_accessibility: configuration.lexical_accessibility || null,
    scene_immersion: configuration.scene_immersion || null,
    actorial_part: configuration.actorial_part || null,
  };
}

function contextKeys(sourceTurn, selection) {
  const classification = turnClassification(sourceTurn);
  const dag = turnDag(sourceTurn);
  return [
    classification.request_type ? `request_type:${classification.request_type}` : null,
    classification.discourse_move ? `discourse_move:${classification.discourse_move}` : null,
    classification.evidence_use ? `evidence_use:${classification.evidence_use}` : null,
    classification.epistemic_stance ? `epistemic_stance:${classification.epistemic_stance}` : null,
    classification.agency ? `agency:${classification.agency}` : null,
    dag.assessment?.bottleneck ? `bottleneck:${dag.assessment.bottleneck}` : null,
    selection?.action_family ? `action_family:${selection.action_family}` : null,
    selection?.policy ? `source_policy:${selection.policy}` : null,
  ].filter(Boolean);
}

function addObservation(bucket, register, outcome, extra = {}) {
  if (!bucket[register]) {
    bucket[register] = {
      register,
      n: 0,
      positive: 0,
      negative: 0,
      sumOutcome: 0,
      outcomes: [],
      ...extra,
    };
  }
  bucket[register].n += 1;
  bucket[register].sumOutcome += outcome;
  bucket[register].outcomes.push(outcome);
  if (outcome > 0.05) bucket[register].positive += 1;
  if (outcome < -0.05) bucket[register].negative += 1;
}

function finalizeBucket(bucket, { minN, weight }) {
  return Object.fromEntries(
    Object.entries(bucket)
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
      .map(([register, row]) => {
        const meanOutcome = row.n ? row.sumOutcome / row.n : 0;
        const shrinkage = row.n / (row.n + minN);
        return [
          register,
          {
            register,
            n: row.n,
            positive: row.positive,
            negative: row.negative,
            meanOutcome: round(meanOutcome),
            positiveRate: round(row.positive / row.n),
            negativeRate: round(row.negative / row.n),
            shrinkage: round(shrinkage),
            logitAdjustment: round(meanOutcome * shrinkage * weight),
          },
        ];
      }),
  );
}

function analyzeTrace(file) {
  const events = readJsonl(file);
  const runMetadata = events.find((event) => event.type === 'run_start')?.metadata || {};
  const turnMap = new Map();
  for (const event of events) {
    if (event.type !== 'turn_complete' || !event.turnRecord) continue;
    const key = event.turnRecord.turnId || `turn:${event.turnRecord.turn}`;
    turnMap.set(key, event.turnRecord);
  }
  const turns = [...turnMap.values()];
  const byTurn = new Map(turns.map((turn) => [Number(turn.turn), turn]));
  const byTurnId = new Map(turns.map((turn) => [String(turn.turnId || ''), turn]));
  const observations = [];
  for (const turn of turns) {
    const efficacy = turn.previousRegisterEfficacy;
    const recordedFeedback = turn.feedbackObservation || null;
    const legacyFeedback = turn.learnerInput?.tutorFeedback || null;
    const humanRating = recordedFeedback?.feedback?.rating || feedbackRating(legacyFeedback);
    const feedbackTargetTurn = recordedFeedback?.ratedResponse?.turnId
      ? byTurnId.get(String(recordedFeedback.ratedResponse.turnId)) || null
      : legacyFeedback?.targetTutorTurnId
        ? byTurnId.get(String(legacyFeedback.targetTutorTurnId)) || null
        : byTurn.get(Number(legacyFeedback?.targetTutorTurn)) || null;
    const sourceTurn =
      feedbackTargetTurn || byTurn.get(Number(efficacy?.registerTurn)) || byTurn.get(Number(turn.turn) - 1) || null;
    const recordedConfiguration = recordedFeedback?.ratedResponse?.responseConfiguration || null;
    const register = canonicalRegister(
      recordedConfiguration?.engagement_stance ||
        efficacy?.selected_register ||
        responseConfiguration(sourceTurn)?.engagement_stance ||
        sourceTurn?.registerSelection?.selected_register,
    );
    if (!register) continue;
    const selection = sourceTurn?.registerSelection || { selected_register: register };
    const objectiveOutcome = efficacy ? outcomeFromEfficacy(efficacy, sourceTurn) : null;
    const humanOutcome = humanRating === 'up' ? 1 : humanRating === 'down' ? -1 : null;
    if (objectiveOutcome === null && humanOutcome === null) continue;
    observations.push({
      trace: path.relative(ROOT, file),
      runId: recordedFeedback?.provenance?.runId || events.find((event) => event.runId)?.runId || null,
      evaluatedAtTurn: efficacy?.evaluatedAtTurn ?? turn.turn ?? null,
      registerTurn:
        recordedFeedback?.ratedResponse?.turn ??
        efficacy?.registerTurn ??
        sourceTurn?.turn ??
        legacyFeedback?.targetTutorTurn ??
        null,
      register,
      outcome: objectiveOutcome,
      objectiveOutcome,
      humanRating,
      humanOutcome,
      label: efficacy?.label || null,
      progressScore: efficacy?.progressScore ?? null,
      fieldDelta: efficacy?.field?.delta ?? null,
      sourcePolicy: selection.policy || null,
      requestType: turnClassification(sourceTurn).request_type || null,
      bottleneck: turnDag(sourceTurn).assessment?.bottleneck || null,
      stateVector: sourceTurn ? buildStateVector(sourceTurn) : {},
      contextKeys: sourceTurn ? contextKeys(sourceTurn, selection) : [],
      responseConfiguration: recordedConfiguration || configurationSnapshot(sourceTurn),
      responseConfigurationVisible:
        recordedFeedback?.ratedResponse?.responseConfigurationAudit?.transcript_visible ??
        sourceTurn?.responseConfigurationAudit?.transcript_visible ??
        null,
      targetSafetyPassed:
        recordedFeedback?.ratedResponse?.safety?.passed ??
        (sourceTurn
          ? [
              sourceTurn.tutorLeakAudit,
              sourceTurn.tutorHumanScaffoldAudit,
              sourceTurn.tutorQuestionSupportAudit,
              sourceTurn.tutorDramaticReleaseAudit,
              sourceTurn.tutorRepetitionAudit,
              sourceTurn.tutorDialogueClosureAudit,
            ]
              .filter(Boolean)
              .every((audit) => audit.ok !== false)
          : null),
      nextResponseAdaptationPassed:
        recordedFeedback?.outcomes?.nextResponseAdaptation?.passed ?? turn.feedbackAdaptationAudit?.passed ?? null,
      selectionProbability: recordedFeedback?.ratedResponse?.selectionProbability ?? null,
      feedbackRecord:
        recordedFeedback?.schema || (humanRating ? 'legacy_learner_input_feedback_join' : 'not_available'),
      modelKey: [
        recordedFeedback?.ratedResponse?.provider || sourceTurn?.provider || runMetadata.resolved?.provider,
        recordedFeedback?.ratedResponse?.model || sourceTurn?.model || runMetadata.resolved?.model,
      ]
        .filter(Boolean)
        .join('/'),
      worldId: recordedFeedback?.provenance?.worldId || runMetadata.world?.id || null,
      learnerProfileId:
        recordedFeedback?.provenance?.learnerProfileId ||
        runMetadata.mixedLearner?.profileId ||
        runMetadata.autoLearner?.profileId ||
        runMetadata.experiment?.profile ||
        null,
      configSha256: runMetadata.provenance?.configSha256 || null,
    });
  }
  for (const event of events) {
    if (event.type !== 'tutor_feedback_rating_recorded' || !event.record) continue;
    const record = event.record;
    const humanRating = record.feedback?.rating;
    const humanOutcome = humanRating === 'up' ? 1 : humanRating === 'down' ? -1 : null;
    const register = canonicalRegister(record.ratedResponse?.responseConfiguration?.engagement_stance);
    if (!register || humanOutcome === null) continue;
    const sourceTurn =
      byTurnId.get(String(record.ratedResponse?.turnId || '')) ||
      byTurn.get(Number(record.ratedResponse?.turn)) ||
      null;
    const selection = sourceTurn?.registerSelection || { selected_register: register };
    observations.push({
      trace: path.relative(ROOT, file),
      runId: record.provenance?.runId || event.runId || null,
      evaluatedAtTurn: null,
      registerTurn: record.ratedResponse?.turn ?? sourceTurn?.turn ?? null,
      register,
      outcome: null,
      objectiveOutcome: null,
      humanRating,
      humanOutcome,
      label: null,
      progressScore: null,
      fieldDelta: null,
      sourcePolicy: record.ratedResponse?.selectionPolicy || selection.policy || null,
      requestType: turnClassification(sourceTurn).request_type || null,
      bottleneck: turnDag(sourceTurn).assessment?.bottleneck || null,
      stateVector: sourceTurn ? buildStateVector(sourceTurn) : {},
      contextKeys: sourceTurn ? contextKeys(sourceTurn, selection) : [],
      responseConfiguration: record.ratedResponse?.responseConfiguration || configurationSnapshot(sourceTurn),
      responseConfigurationVisible:
        record.ratedResponse?.responseConfigurationAudit?.transcript_visible ??
        sourceTurn?.responseConfigurationAudit?.transcript_visible ??
        null,
      targetSafetyPassed: record.ratedResponse?.safety?.passed ?? null,
      nextResponseAdaptationPassed: null,
      selectionProbability: record.ratedResponse?.selectionProbability ?? null,
      feedbackRecord: record.schema,
      modelKey: [record.ratedResponse?.provider, record.ratedResponse?.model].filter(Boolean).join('/'),
      worldId: record.provenance?.worldId || runMetadata.world?.id || null,
      learnerProfileId:
        record.provenance?.learnerProfileId ||
        runMetadata.mixedLearner?.profileId ||
        runMetadata.autoLearner?.profileId ||
        runMetadata.experiment?.profile ||
        null,
      configSha256: runMetadata.provenance?.configSha256 || null,
    });
  }
  return observations;
}

function observationKey(observation) {
  return [observation.runId || observation.trace, observation.registerTurn, observation.register].join(':');
}

function observationRichness(observation) {
  return [
    observation.humanRating,
    observation.objectiveOutcome,
    observation.responseConfiguration,
    observation.responseConfigurationVisible,
    observation.selectionProbability,
    observation.feedbackRecord?.includes('feedback-observation') ? 1 : null,
  ].filter((value) => value !== null && value !== undefined).length;
}

function deduplicateObservations(observations) {
  const unique = new Map();
  for (const observation of observations) {
    const key = observationKey(observation);
    const current = unique.get(key);
    if (!current || observationRichness(observation) > observationRichness(current)) {
      unique.set(key, observation);
    }
  }
  return {
    observations: [...unique.values()],
    duplicateCount: observations.length - unique.size,
  };
}

function meanSquaredError(actual, predicted) {
  if (!actual.length || actual.length !== predicted.length) return null;
  return mean(actual.map((value, index) => (value - predicted[index]) ** 2));
}

function heldOutRegisterValidation(observations, { minN }) {
  const usable = observations
    .filter((observation) => Number.isFinite(observation.objectiveOutcome))
    .sort(
      (a, b) =>
        String(a.runId || a.trace).localeCompare(String(b.runId || b.trace)) ||
        Number(a.evaluatedAtTurn || 0) - Number(b.evaluatedAtTurn || 0),
    );
  const runs = [...new Set(usable.map((observation) => observation.runId || observation.trace))];
  if (runs.length < 5 || usable.length < Math.max(20, minN * 4)) {
    return {
      status: 'insufficient_independent_runs',
      eligible: false,
      runCount: runs.length,
      observationCount: usable.length,
      requiredRunCount: 5,
      requiredObservationCount: Math.max(20, minN * 4),
    };
  }
  const holdoutRunCount = Math.max(1, Math.ceil(runs.length * 0.2));
  const holdoutRuns = new Set(runs.slice(-holdoutRunCount));
  const train = usable.filter((observation) => !holdoutRuns.has(observation.runId || observation.trace));
  const holdout = usable.filter((observation) => holdoutRuns.has(observation.runId || observation.trace));
  const globalMean = mean(train.map((observation) => observation.objectiveOutcome)) ?? 0;
  const registerRows = {};
  for (const observation of train) {
    if (!registerRows[observation.register]) registerRows[observation.register] = [];
    registerRows[observation.register].push(observation.objectiveOutcome);
  }
  const baselinePredictions = holdout.map(() => globalMean);
  const priorPredictions = holdout.map((observation) => {
    const values = registerRows[observation.register] || [];
    if (!values.length) return globalMean;
    const shrinkage = values.length / (values.length + minN);
    return globalMean + ((mean(values) ?? globalMean) - globalMean) * shrinkage;
  });
  const actual = holdout.map((observation) => observation.objectiveOutcome);
  const baselineMse = meanSquaredError(actual, baselinePredictions);
  const priorMse = meanSquaredError(actual, priorPredictions);
  const improvement = baselineMse === null || priorMse === null ? null : baselineMse - priorMse;
  const relativeImprovement = baselineMse ? Number(improvement) / baselineMse : null;
  const minimumAbsoluteImprovement = 0.002;
  const minimumRelativeImprovement = 0.02;
  const eligible =
    Number(improvement) >= minimumAbsoluteImprovement && Number(relativeImprovement) >= minimumRelativeImprovement;
  return {
    status: eligible ? 'passed' : 'failed_no_material_holdout_advantage',
    eligible,
    runCount: runs.length,
    trainRunCount: runs.length - holdoutRunCount,
    holdoutRunCount,
    trainObservationCount: train.length,
    holdoutObservationCount: holdout.length,
    baselineMse: round(baselineMse, 5),
    priorMse: round(priorMse, 5),
    mseImprovement: round(improvement, 5),
    relativeMseImprovement: round(relativeImprovement, 5),
    minimumAbsoluteImprovement,
    minimumRelativeImprovement,
    split: 'chronological_by_run_80_20',
  };
}

function buildModelPriors(observations, { minN }) {
  const grouped = new Map();
  for (const observation of observations) {
    if (!observation.modelKey || !Number.isFinite(observation.objectiveOutcome)) continue;
    if (!grouped.has(observation.modelKey)) grouped.set(observation.modelKey, []);
    grouped.get(observation.modelKey).push(observation);
  }
  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modelKey, rows]) => {
        const bucket = {};
        for (const row of rows) addObservation(bucket, row.register, row.objectiveOutcome);
        return [
          modelKey,
          {
            modelKey,
            observationCount: rows.length,
            runCount: new Set(rows.map((row) => row.runId || row.trace)).size,
            validation: heldOutRegisterValidation(rows, { minN }),
            registerPriors: finalizeBucket(bucket, { minN, weight: 0.9 }),
          },
        ];
      }),
  );
}

function buildPrior(observations, { files, minN }) {
  const registerBucket = {};
  const axisBuckets = {};
  const contextBuckets = {};

  const feedbackRegisterBucket = {};
  const feedbackConfigurationBuckets = {};

  for (const observation of observations) {
    if (Number.isFinite(observation.objectiveOutcome)) {
      addObservation(registerBucket, observation.register, observation.objectiveOutcome);
    }
    for (const [axis, value] of Object.entries(observation.stateVector || {})) {
      if (!Number.isFinite(observation.objectiveOutcome) || Number(value) < 0.55) continue;
      if (!axisBuckets[axis]) axisBuckets[axis] = {};
      addObservation(axisBuckets[axis], observation.register, observation.objectiveOutcome);
    }
    for (const key of observation.contextKeys || []) {
      if (!Number.isFinite(observation.objectiveOutcome)) continue;
      if (!contextBuckets[key]) contextBuckets[key] = {};
      addObservation(contextBuckets[key], observation.register, observation.objectiveOutcome);
    }
    if (Number.isFinite(observation.humanOutcome)) {
      addObservation(feedbackRegisterBucket, observation.register, observation.humanOutcome);
      for (const [axis, value] of Object.entries(observation.responseConfiguration || {})) {
        if (!value) continue;
        if (!feedbackConfigurationBuckets[axis]) feedbackConfigurationBuckets[axis] = {};
        addObservation(feedbackConfigurationBuckets[axis], String(value), observation.humanOutcome);
      }
    }
  }

  const validation = heldOutRegisterValidation(observations, { minN });
  const modelPriors = buildModelPriors(observations, { minN });
  const eligibleModels = Object.values(modelPriors)
    .filter((row) => row.validation?.eligible)
    .map((row) => row.modelKey);
  const pairedOutcomes = observations.filter(
    (observation) => Number.isFinite(observation.humanOutcome) && Number.isFinite(observation.objectiveOutcome),
  );
  const agreements = pairedOutcomes.filter(
    (observation) =>
      Math.sign(observation.humanOutcome) === Math.sign(observation.objectiveOutcome) ||
      (Math.abs(observation.objectiveOutcome) <= 0.05 && observation.humanOutcome === 0),
  ).length;

  return {
    schema: 'machinespirits.tutor-stub.register-empirical-priors.v2',
    generatedAt: new Date().toISOString(),
    source: {
      roots: args.root,
      exportsRoot: args['exports-root'],
      fileCount: files.length,
      observationCount: observations.length,
      uniqueRunCount: new Set(observations.map((observation) => observation.runId || observation.trace)).size,
      humanFeedbackObservationCount: observations.filter((observation) => observation.humanRating).length,
      minN,
    },
    outcomeChannels: {
      objectiveProgress:
        'clamp(-1,1,0.55*progressScore/4 + 0.25*fieldDelta*4 + labelAdjustment + dagProgressBonus - leakPenalty)',
      subjectiveHelpfulness: 'human thumbs-up=1; human thumbs-down=-1; never folded into objective progress',
      interpretation: 'observational associations, not causal response effects',
    },
    deployment: {
      objectiveRegisterPriorEligible: eligibleModels.length > 0,
      eligibleModels,
      humanPreferencePriorEligible: false,
      status: eligibleModels.length ? 'model_indexed_objective_prior_holdout_passed' : 'candidate_only',
      reason: eligibleModels.length
        ? 'Only model-specific objective priors that improved held-out prediction may steer; human preferences remain advisory.'
        : 'Do not apply this corpus prior automatically because no model-specific stratum cleared the independent-run holdout gate.',
    },
    validation,
    modelPriors,
    registerPriors: finalizeBucket(registerBucket, { minN, weight: 0.9 }),
    axisPriors: Object.fromEntries(
      Object.entries(axisBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([axis, bucket]) => [axis, finalizeBucket(bucket, { minN, weight: 0.65 })]),
    ),
    contextPriors: Object.fromEntries(
      Object.entries(contextBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, bucket]) => [key, finalizeBucket(bucket, { minN, weight: 0.45 })]),
    ),
    humanHelpfulnessPriors: {
      register: finalizeBucket(feedbackRegisterBucket, { minN, weight: 0 }),
      responseConfiguration: Object.fromEntries(
        Object.entries(feedbackConfigurationBuckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([axis, bucket]) => [axis, finalizeBucket(bucket, { minN, weight: 0 })]),
      ),
      pairedWithObjectiveProgress: {
        n: pairedOutcomes.length,
        agreementCount: agreements,
        agreementRate: pairedOutcomes.length ? round(agreements / pairedOutcomes.length) : null,
        note: 'Disagreement is retained because subjective helpfulness and proof progress answer different questions.',
      },
      runtimeUse: 'advisory_only',
    },
    samples: observations.slice(0, 12),
  };
}

function renderSummary(prior, outPath) {
  const registerRows = Object.values(prior.registerPriors || {})
    .sort((a, b) => Number(b.logitAdjustment) - Number(a.logitAdjustment) || b.n - a.n)
    .slice(0, 12)
    .map((row) => `${row.register}: n=${row.n}, mean=${row.meanOutcome}, logit=${row.logitAdjustment}`)
    .join('\n  ');
  return [
    `[register-priors] files=${prior.source.fileCount} observations=${prior.source.observationCount} duplicates-removed=${prior.source.duplicateObservationCount || 0}`,
    `[register-priors] runs=${prior.source.uniqueRunCount} human-ratings=${prior.source.humanFeedbackObservationCount} holdout=${prior.validation.status}`,
    `[register-priors] runtime=${prior.deployment.status} eligible-models=${prior.deployment.eligibleModels.join(',') || 'none'}`,
    `[register-priors] wrote ${path.relative(ROOT, outPath)}`,
    registerRows ? `[register-priors] top register priors:\n  ${registerRows}` : '[register-priors] no register priors',
  ].join('\n');
}

function main() {
  const minN = positiveInt(args['min-n'], '--min-n');
  const files = discoverTraceFiles();
  const rawObservations = files.flatMap((file) => analyzeTrace(file));
  const deduplicated = deduplicateObservations(rawObservations);
  const prior = buildPrior(deduplicated.observations, { files, minN });
  prior.source.rawObservationCount = rawObservations.length;
  prior.source.duplicateObservationCount = deduplicated.duplicateCount;
  const outPath = resolvePath(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(prior, null, 2)}\n`);
  if (args.json) {
    console.log(JSON.stringify(prior, null, 2));
  } else {
    console.log(renderSummary(prior, outPath));
  }
}

main();
