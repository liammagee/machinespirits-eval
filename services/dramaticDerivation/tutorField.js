import {
  average,
  clamp01,
  distanceDelta,
  learnerHypothesisPressure,
  learnerMisconceptionPressure,
  normalizeBy,
  positiveCueCount,
  releaseDensity,
  round3,
  withDynamics,
} from './fieldUtils.js';

export const TUTOR_FIELD_SCHEMA = 'machinespirits.derivation.tutor-field.v1';

export const TUTOR_FIELD_DIMENSIONS = Object.freeze([
  'diagnosticConfidence',
  'pedagogicalUncertainty',
  'strategyMomentum',
  'rapport',
  'activeHypotheses',
  'instructionalMomentum',
]);

export function buildTutorFieldFrame({
  turn,
  previousTurn,
  learnerTurn,
  lines = [],
  releasesByTurn,
  trajectory,
  totalPremises,
  previousTutor,
} = {}) {
  const tutorLines = lines.filter((line) => line.role === 'tutor');
  const learnerDims = learnerTurn?.summary?.dimensions || {};
  const progress = normalizeBy(distanceDelta(turn, trajectory, previousTurn), Math.max(1, totalPremises));
  const release = releaseDensity(turn, releasesByTurn, totalPremises);
  const misconception = learnerMisconceptionPressure(learnerTurn);
  const hypothesis = learnerHypothesisPressure(learnerTurn);
  const meanLearnerSpeed = clamp01((learnerTurn?.summary?.meanSpeed || 0) / 1.5);
  const figure = tutorLines.find((line) => line.meta?.move?.figure)?.meta?.move?.figure || null;
  const previousFigure = previousTutor?.figure || null;
  const repeatedFigure = figure && previousFigure && figure === previousFigure ? 1 : 0;
  const phatic = tutorLines.reduce((sum, line) => sum + (line.meta?.phaticRecognition || []).length, 0);
  const positive = positiveCueCount(tutorLines);

  const dimensions = {
    diagnosticConfidence: clamp01(
      average([learnerDims.evidenceGrounding, learnerDims.mastery, 1 - (learnerDims.uncertainty || 0)]) +
        progress * 0.2 -
        misconception * 0.15,
    ),
    pedagogicalUncertainty: clamp01(
      average([learnerDims.uncertainty, learnerDims.productiveConfusion, misconception]) + hypothesis * 0.1,
    ),
    strategyMomentum: clamp01(0.25 + repeatedFigure * 0.35 + release * 0.3 + progress * 0.45),
    rapport: clamp01(0.35 + phatic * 0.16 + positive * 0.12 + (learnerDims.engagement || 0) * 0.25),
    activeHypotheses: clamp01(hypothesis + misconception * 0.35 + (learnerDims.productiveConfusion || 0) * 0.25),
    instructionalMomentum: clamp01(meanLearnerSpeed * 0.45 + progress * 0.45 + release * 0.28),
  };

  return {
    schema: TUTOR_FIELD_SCHEMA,
    figure,
    evidence: {
      tutorLineCount: tutorLines.length,
      repeatedFigure: Boolean(repeatedFigure),
      phaticRecognitionCount: phatic,
      positiveCueCount: positive,
      progress,
      releaseDensity: release,
      learnerMisconceptionPressure: round3(misconception),
      learnerHypothesisPressure: round3(hypothesis),
    },
    ...withDynamics(
      Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, round3(value)])),
      previousTutor,
      TUTOR_FIELD_DIMENSIONS,
    ),
  };
}
