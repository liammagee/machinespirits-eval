import {
  average,
  clamp01,
  countWords,
  learnerMisconceptionPressure,
  lineText,
  normalizeBy,
  positiveCueCount,
  questionCount,
  releaseDensity,
  round3,
  tokenOverlap,
  withDynamics,
} from './fieldUtils.js';

export const DISCOURSE_FIELD_SCHEMA = 'machinespirits.derivation.discourse-field.v1';

export const DISCOURSE_FIELD_DIMENSIONS = Object.freeze([
  'conceptIntroduction',
  'sharedVocabulary',
  'dialogueActDensity',
  'explanatoryStructure',
  'openQuestions',
  'commitmentStrength',
  'emotionalTone',
  'interactionRhythm',
]);

export function buildDiscourseFieldFrame({
  turn,
  lines = [],
  releasesByTurn,
  totalPremises,
  learnerTurn,
  previousDiscourse,
} = {}) {
  const tutorLines = lines.filter((line) => line.role === 'tutor');
  const learnerLines = lines.filter((line) => line.role === 'learner');
  const allText = lineText(lines);
  const tutorText = lineText(tutorLines);
  const learnerText = lineText(learnerLines);
  const tutorWords = countWords(tutorText);
  const learnerWords = countWords(learnerText);
  const totalWords = tutorWords + learnerWords;
  const wordBalance = totalWords ? 1 - Math.abs(tutorWords - learnerWords) / totalWords : 0;
  const questions = questionCount(lines);
  const commits = learnerLines.reduce((sum, line) => {
    const meta = line.meta || {};
    return (
      sum +
      (Array.isArray(meta.adopt) ? meta.adopt.length : 0) +
      (Array.isArray(meta.derive) ? meta.derive.length : 0) +
      (meta.asserts ? 1 : 0)
    );
  }, 0);
  const learnerDims = learnerTurn?.summary?.dimensions || {};
  const releasedThisTurn = (releasesByTurn?.get?.(turn) || []).length;
  const misconception = learnerMisconceptionPressure(learnerTurn);

  const dimensions = {
    conceptIntroduction:
      releaseDensity(turn, releasesByTurn, totalPremises) + normalizeBy(releasedThisTurn, totalPremises),
    sharedVocabulary: tokenOverlap(tutorText, learnerText),
    dialogueActDensity: normalizeBy(lines.filter((line) => line.role !== 'director').length, 3),
    explanatoryStructure: clamp01(
      average([learnerDims.evidenceGrounding, learnerDims.mastery]) + normalizeBy(commits, 5) * 0.25,
    ),
    openQuestions: clamp01(normalizeBy(questions, 4) + (learnerDims.uncertainty || 0) * 0.35),
    commitmentStrength: clamp01(normalizeBy(commits + releasedThisTurn, 5)),
    emotionalTone: clamp01(0.52 + positiveCueCount(lines) * 0.08 - misconception * 0.18),
    interactionRhythm: clamp01(wordBalance * 0.72 + normalizeBy(totalWords, 80) * 0.28),
  };
  if (!allText.trim()) dimensions.emotionalTone = 0.5;

  return {
    schema: DISCOURSE_FIELD_SCHEMA,
    evidence: {
      tutorWordCount: tutorWords,
      learnerWordCount: learnerWords,
      questionCount: questions,
      learnerCommitmentCount: commits,
      releasedThisTurn,
      learnerMisconceptionPressure: round3(misconception),
    },
    ...withDynamics(
      Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, round3(value)])),
      previousDiscourse,
      DISCOURSE_FIELD_DIMENSIONS,
    ),
  };
}
