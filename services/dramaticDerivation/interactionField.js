import { buildDynamicLearnerFieldFromResult } from './learnerField.js';
import { buildDiscourseFieldFrame, DISCOURSE_FIELD_DIMENSIONS } from './discourseField.js';
import { buildTutorFieldFrame, TUTOR_FIELD_DIMENSIONS } from './tutorField.js';
import {
  DEFAULT_PEDAGOGICAL_SCRIPT,
  PEDAGOGICAL_SCRIPT_SCHEMA,
  pedagogicalScriptStageIds,
  pedagogicalScriptStageSpec,
  resolvePedagogicalScript,
} from './pedagogicalScripts.js';
import {
  average,
  clamp01,
  distanceDelta,
  learnerMisconceptionPressure,
  normalizeBy,
  round3,
  vectorDelta,
  withDynamics,
} from './fieldUtils.js';

export const INTERACTION_FIELD_SCHEMA = 'machinespirits.derivation.pedagogical-interaction-field.v1';

export { DISCOURSE_FIELD_DIMENSIONS, TUTOR_FIELD_DIMENSIONS };
export { DEFAULT_PEDAGOGICAL_SCRIPT, PEDAGOGICAL_SCRIPT_SCHEMA };

export const JOINT_INTERACTION_FIELD_DIMENSIONS = Object.freeze([
  'couplingStrength',
  'pedagogicalAlignment',
  'productiveTension',
  'scriptProgress',
  'interactionMomentum',
  'trajectoryRisk',
]);

function linesByTurn(result = {}) {
  const map = new Map();
  for (const line of result.transcript || []) {
    if (!Number.isFinite(Number(line.turn))) continue;
    const rows = map.get(line.turn) || [];
    rows.push(line);
    map.set(line.turn, rows);
  }
  return map;
}

function rowsByTurn(rows = []) {
  const map = new Map();
  for (const row of rows) {
    if (!Number.isFinite(Number(row.turn))) continue;
    const list = map.get(row.turn) || [];
    list.push(row);
    map.set(row.turn, list);
  }
  return map;
}

function trajectoryByTurn(result = {}) {
  const map = new Map();
  for (const row of result.trajectory || []) {
    if (Number.isFinite(Number(row.turn))) map.set(row.turn, row);
  }
  return map;
}

function sortedTurns(result = {}, learnerField = {}) {
  const turns = new Set();
  for (const row of learnerField.turns || []) {
    if (Number.isFinite(Number(row.turn))) turns.add(Number(row.turn));
  }
  for (const line of result.transcript || []) {
    if (Number.isFinite(Number(line.turn))) turns.add(Number(line.turn));
  }
  for (const row of result.trajectory || []) {
    if (Number.isFinite(Number(row.turn))) turns.add(Number(row.turn));
  }
  return [...turns].sort((a, b) => a - b);
}

function learnerTurnByTurn(learnerField = {}) {
  return new Map((learnerField.turns || []).map((turn) => [turn.turn, turn]));
}

function scriptStage({ result, turn, previousTurn, learnerTurn, trajectory, releasesByTurn }) {
  if (
    result.assertedGroundedTurn !== null &&
    result.assertedGroundedTurn !== undefined &&
    turn >= result.assertedGroundedTurn
  ) {
    return { stage: 'transfer', evidence: 'grounded assertion reached' };
  }
  if (learnerTurn?.secretEntailed) return { stage: 'generalisation', evidence: 'learner facts entail the target' };
  const progress = distanceDelta(turn, trajectory, previousTurn);
  const learnerDims = learnerTurn?.summary?.dimensions || {};
  if ((learnerTurn?.summary?.attractorCounts?.misconception_attractor || 0) > 0) {
    return { stage: 'failure', evidence: 'misconception attractor detected' };
  }
  if (progress > 0 || (releasesByTurn.get(turn) || []).length > 0) {
    return { stage: 'repair', evidence: 'field moved after release or derivation-distance decrease' };
  }
  if ((learnerDims.evidenceGrounding || 0) > 0.55 && (learnerDims.mastery || 0) > 0.55) {
    return { stage: 'generalisation', evidence: 'grounding and mastery both high' };
  }
  if ((learnerDims.uncertainty || 0) > 0.65 || (learnerDims.productiveConfusion || 0) > 0.45) {
    return { stage: 'failure', evidence: 'productive confusion or uncertainty is active' };
  }
  return { stage: 'prediction', evidence: 'opening hypothesis space' };
}

function stageIndex(stage, script = DEFAULT_PEDAGOGICAL_SCRIPT) {
  const index = pedagogicalScriptStageIds(script).indexOf(stage);
  return index === -1 ? 0 : index;
}

function jointDimensions({ learnerTurn, tutor, discourse, script, scriptSpec, previousJoint }) {
  const learnerDims = learnerTurn?.summary?.dimensions || {};
  const learnerSpeed = clamp01((learnerTurn?.summary?.meanSpeed || 0) / 1.5);
  const learnerProgress = average([learnerDims.mastery, learnerDims.evidenceGrounding]);
  const tutorConfidence = tutor.dimensions.diagnosticConfidence;
  const couplingStrength = average([
    learnerDims.engagement || 0,
    tutor.dimensions.rapport,
    discourse.dimensions.sharedVocabulary,
    discourse.dimensions.interactionRhythm,
  ]);
  const productiveTension = clamp01(
    average([
      learnerDims.productiveConfusion || 0,
      tutor.dimensions.pedagogicalUncertainty,
      discourse.dimensions.openQuestions,
    ]) -
      learnerMisconceptionPressure(learnerTurn) * 0.12,
  );
  const dimensions = {
    couplingStrength,
    pedagogicalAlignment: clamp01(1 - Math.abs(tutorConfidence - learnerProgress)),
    productiveTension,
    scriptProgress: normalizeBy(script.index, pedagogicalScriptStageIds(scriptSpec).length - 1),
    interactionMomentum: average([
      learnerSpeed,
      tutor.dimensions.instructionalMomentum,
      discourse.dimensions.interactionRhythm,
    ]),
    trajectoryRisk: average([
      learnerMisconceptionPressure(learnerTurn),
      tutor.dimensions.pedagogicalUncertainty,
      discourse.dimensions.openQuestions,
      1 - couplingStrength,
    ]),
  };
  return withDynamics(
    Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, round3(value)])),
    previousJoint,
    JOINT_INTERACTION_FIELD_DIMENSIONS,
  );
}

function classifyJointAttractor(joint) {
  const dims = joint.dimensions;
  if (dims.trajectoryRisk >= 0.62 && dims.interactionMomentum < 0.28) return 'stalled_interaction';
  if (dims.trajectoryRisk >= 0.58 && dims.pedagogicalAlignment < 0.45) return 'asymmetric_drift';
  if (dims.productiveTension >= 0.42 && dims.couplingStrength >= 0.35) return 'productive_tension';
  if (dims.scriptProgress >= 0.75 && dims.pedagogicalAlignment >= 0.6) return 'stable_progress';
  return 'open_interaction';
}

function summarizeTrajectory(turns) {
  const first = turns[0] || null;
  const final = turns.at(-1) || null;
  return {
    turnCount: turns.length,
    finalTurn: final?.turn ?? null,
    finalScriptStage: final?.script?.stage || null,
    meanCouplingStrength: round3(average(turns.map((turn) => turn.joint.dimensions.couplingStrength))),
    meanProductiveTension: round3(average(turns.map((turn) => turn.joint.dimensions.productiveTension))),
    fieldDelta: {
      tutor: vectorDelta(final?.tutor?.dimensions || {}, first?.tutor?.dimensions || {}, TUTOR_FIELD_DIMENSIONS),
      discourse: vectorDelta(
        final?.discourse?.dimensions || {},
        first?.discourse?.dimensions || {},
        DISCOURSE_FIELD_DIMENSIONS,
      ),
      joint: vectorDelta(
        final?.joint?.dimensions || {},
        first?.joint?.dimensions || {},
        JOINT_INTERACTION_FIELD_DIMENSIONS,
      ),
    },
    finalAttractor: final?.joint?.attractor || null,
  };
}

export function buildPedagogicalInteractionField(world, result = {}, { learnerField = null, script = null } = {}) {
  const dynamicLearnerField =
    learnerField || result.dynamicLearnerField || buildDynamicLearnerFieldFromResult(world, result);
  const scriptSpec = resolvePedagogicalScript(script || result.pedagogicalScript || world?.pedagogicalScript);
  const learnerByTurn = learnerTurnByTurn(dynamicLearnerField || {});
  const transcriptByTurn = linesByTurn(result);
  const releasesByTurn = rowsByTurn(result.ledger || []);
  const trajectory = trajectoryByTurn(result);
  const turns = sortedTurns(result, dynamicLearnerField || {});
  const totalPremises = Math.max(1, (world?.premises || []).length);

  let previousTurn = null;
  let previousTutor = null;
  let previousDiscourse = null;
  let previousJoint = null;
  const rows = [];
  for (const turn of turns) {
    const lines = transcriptByTurn.get(turn) || [];
    const learnerTurn = learnerByTurn.get(turn) || null;
    const tutor = buildTutorFieldFrame({
      turn,
      previousTurn,
      learnerTurn,
      lines,
      releasesByTurn,
      trajectory,
      totalPremises,
      previousTutor,
    });
    const discourse = buildDiscourseFieldFrame({
      turn,
      lines,
      releasesByTurn,
      totalPremises,
      learnerTurn,
      previousDiscourse,
    });
    const stage = scriptStage({ result, turn, previousTurn, learnerTurn, trajectory, releasesByTurn });
    const stageSpec = pedagogicalScriptStageSpec(scriptSpec, stage.stage);
    const script = {
      ...stage,
      index: stageIndex(stage.stage, scriptSpec),
      progress: round3(normalizeBy(stageIndex(stage.stage, scriptSpec), pedagogicalScriptStageIds(scriptSpec).length - 1)),
      preferredMoves: stageSpec?.preferredMoves || [],
      antiPatterns: stageSpec?.antiPatterns || [],
      expectedFieldMovement: stageSpec?.expectedFieldMovement || {},
    };
    const joint = jointDimensions({ learnerTurn, tutor, discourse, script, scriptSpec, previousJoint });
    joint.attractor = classifyJointAttractor(joint);
    joint.phase = script.stage;
    const row = {
      turn,
      learner: learnerTurn
        ? {
            dimensions: learnerTurn.summary?.dimensions || {},
            attractorCounts: learnerTurn.summary?.attractorCounts || {},
            meanSpeed: learnerTurn.summary?.meanSpeed || 0,
          }
        : null,
      tutor,
      discourse,
      joint,
      script,
      releasePremiseIds: (releasesByTurn.get(turn) || []).map((release) => release.premiseId),
      events: (result.events || []).filter((event) => event.turn === turn).map((event) => event.type),
    };
    rows.push(row);
    previousTurn = turn;
    previousTutor = tutor;
    previousDiscourse = discourse;
    previousJoint = joint;
  }

  return {
    schema: INTERACTION_FIELD_SCHEMA,
    worldId: world?.id || result.worldId || null,
    source: dynamicLearnerField?.source || result.learnerDag?.source || 'unknown',
    script: scriptSpec,
    turns: rows,
    final: rows.at(-1) || null,
    trajectory: summarizeTrajectory(rows),
  };
}
