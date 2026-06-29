export const CHARACTER_STATE_VERSION = 'adaptive-character-state.v0.1';

export const CHARACTER_AXES = Object.freeze([
  'proof_ownership',
  'relevance_orientation',
  'frustration_tolerance',
  'question_consolidation',
  'non_formulaic_reasoning',
  'next_step_agency',
]);

const LABEL_UPDATES = Object.freeze({
  'learner-authored rationale': { proof_ownership: 0.18 },
  'learner-authored prediction': { proof_ownership: 0.08, non_formulaic_reasoning: 0.14 },
  'non-formulaic learner rationale': { proof_ownership: 0.1, non_formulaic_reasoning: 0.2 },
  'learner-authored application': { proof_ownership: 0.08, next_step_agency: 0.08 },
  'learner-authored transfer': { proof_ownership: 0.08, relevance_orientation: 0.1 },
  'learner-authored next step': { next_step_agency: 0.16 },
  'learner-authored choice': { next_step_agency: 0.18 },
  'learner-owned relevance test': { relevance_orientation: 0.2 },
  'task reorientation': { relevance_orientation: 0.16 },
  'learner-owned test case': { relevance_orientation: 0.08, next_step_agency: 0.08 },
  'renewed content-bearing work': { next_step_agency: 0.1 },
  'renewed attempt after affective repair': { frustration_tolerance: 0.18 },
  'smaller learner-owned move': { frustration_tolerance: 0.18, next_step_agency: 0.08 },
  'collapsed question set': { question_consolidation: 0.2 },
  'state-disambiguating response': { question_consolidation: 0.12, relevance_orientation: 0.04 },
  'model comparison': { proof_ownership: 0.08, non_formulaic_reasoning: 0.08 },
  'self-check': { proof_ownership: 0.06, next_step_agency: 0.06 },
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function round3(value) {
  return Number(clamp01(value).toFixed(3));
}

function emptyAxes(value = 0) {
  return Object.fromEntries(CHARACTER_AXES.map((axis) => [axis, round3(value)]));
}

export function initialCharacterState({ learnerId = 'longitudinal-learner', arm = null } = {}) {
  return {
    version: CHARACTER_STATE_VERSION,
    learner_id: learnerId,
    arm,
    scene_count: 0,
    axes: emptyAxes(0),
    evidence_counts: {},
    scene_summaries: [],
  };
}

export function characterMaturityScore(state = {}) {
  const axes = state.axes || {};
  const values = CHARACTER_AXES.map((axis) => Number(axes[axis] || 0));
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

export function dominantCharacterAxes(state = {}, limit = 3) {
  const axes = state.axes || {};
  return CHARACTER_AXES.map((axis) => ({ axis, value: Number(axes[axis] || 0) }))
    .sort((a, b) => b.value - a.value || a.axis.localeCompare(b.axis))
    .slice(0, limit);
}

export function categoriesFromEvidence(evidence = []) {
  const categories = {};
  for (const entry of evidence || []) {
    for (const [label, value] of Object.entries(entry?.categories || {})) {
      categories[label] = categories[label] === true || value === true;
    }
  }
  return categories;
}

function evidenceLabelsFromCategories(categories = {}) {
  return Object.entries(categories)
    .filter(([, value]) => value === true)
    .map(([label]) => label)
    .sort();
}

export function updateCharacterStateFromEvidence(
  state,
  { evidence = [], sceneId = null, outcome = null, stagedFollowup = false } = {},
) {
  const next = JSON.parse(JSON.stringify(state || initialCharacterState()));
  const categories = categoriesFromEvidence(evidence);
  const labels = evidenceLabelsFromCategories(categories);
  const axisDeltas = emptyAxes(0);

  for (const label of labels) {
    next.evidence_counts[label] = (next.evidence_counts[label] || 0) + 1;
    for (const [axis, delta] of Object.entries(LABEL_UPDATES[label] || {})) {
      axisDeltas[axis] = round3(Number(axisDeltas[axis] || 0) + delta);
      next.axes[axis] = round3(Number(next.axes[axis] || 0) + delta);
    }
  }

  if (outcome === 'success') {
    next.axes.proof_ownership = round3(Number(next.axes.proof_ownership || 0) + 0.03);
    next.axes.next_step_agency = round3(Number(next.axes.next_step_agency || 0) + 0.03);
    axisDeltas.proof_ownership = round3(Number(axisDeltas.proof_ownership || 0) + 0.03);
    axisDeltas.next_step_agency = round3(Number(axisDeltas.next_step_agency || 0) + 0.03);
  }

  next.scene_count = Number(next.scene_count || 0) + 1;
  next.scene_summaries.push({
    scene_id: sceneId,
    outcome,
    staged_followup: Boolean(stagedFollowup),
    evidence_labels: labels,
    axis_deltas: axisDeltas,
    maturity_after: characterMaturityScore(next),
  });
  return next;
}

export function characterStateForTutorContext(state = {}) {
  const axes = state.axes || {};
  const dominant = dominantCharacterAxes(state, 3)
    .map(({ axis, value }) => `${axis}=${value.toFixed(2)}`)
    .join(', ');
  return {
    version: CHARACTER_STATE_VERSION,
    maturity: characterMaturityScore(state),
    axes: Object.fromEntries(CHARACTER_AXES.map((axis) => [axis, round3(axes[axis] || 0)])),
    dominant_axes: dominant,
    scene_count: state.scene_count || 0,
  };
}

export function shouldUseMatureFirstResponse(state = {}, { signal = null, transfer = false } = {}) {
  const axes = state.axes || {};
  const maturity = characterMaturityScore(state);
  if (transfer && maturity >= 0.22) return true;
  if (maturity >= 0.28) return true;
  if (signal === 'irrelevance' && Number(axes.relevance_orientation || 0) >= 0.2) return true;
  if (signal === 'frustration' && Number(axes.frustration_tolerance || 0) >= 0.18) return true;
  if (signal === 'question_flood' && Number(axes.question_consolidation || 0) >= 0.18) return true;
  if (signal === 'rote_parroting' && Number(axes.non_formulaic_reasoning || 0) >= 0.2) return true;
  if (signal === 'boredom' && Number(axes.next_step_agency || 0) >= 0.22) return true;
  return false;
}
