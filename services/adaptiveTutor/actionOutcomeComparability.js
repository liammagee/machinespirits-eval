export const ACTION_OUTCOME_ELIGIBLE_SET_VERSION = 'action-outcome-eligible-set.v1';

function normalizedMoveFamilies(moveFamilies = []) {
  if (!Array.isArray(moveFamilies)) throw new Error('eligible move families must be an array');
  const normalized = moveFamilies.map((value) => String(value || '').trim());
  if (normalized.some((value) => !value)) throw new Error('eligible move families must be nonempty strings');
  return [...new Set(normalized)].sort();
}

export function canonicalActionOutcomeEligibleSet(moveFamilies = []) {
  const families = normalizedMoveFamilies(moveFamilies);
  return {
    version: ACTION_OUTCOME_ELIGIBLE_SET_VERSION,
    id: `${ACTION_OUTCOME_ELIGIBLE_SET_VERSION}:${families.join('+')}`,
    families,
    familyCount: families.length,
    comparative: families.length >= 2,
  };
}

export function actionOutcomeEligibleSetForCandidates(candidates = [], moveFamilyForAction) {
  if (!Array.isArray(candidates) || typeof moveFamilyForAction !== 'function') {
    throw new Error('eligible-set construction needs candidates and a move-family resolver');
  }
  return canonicalActionOutcomeEligibleSet(candidates.map((candidate) => moveFamilyForAction(candidate.action_type)));
}

export function actionOutcomeEligibleSetMatches(id, moveFamilies = []) {
  return id === canonicalActionOutcomeEligibleSet(moveFamilies).id;
}

export function actionOutcomeEligibleSetIncludes(id, moveFamily) {
  const prefix = `${ACTION_OUTCOME_ELIGIBLE_SET_VERSION}:`;
  if (typeof id !== 'string' || !id.startsWith(prefix)) return false;
  const families = id.slice(prefix.length).split('+').filter(Boolean);
  return actionOutcomeEligibleSetMatches(id, families) && families.includes(moveFamily);
}
