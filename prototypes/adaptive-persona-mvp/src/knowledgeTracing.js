export const DEFAULT_BKT_PARAMS = Object.freeze({
  pLearn: 0.18,
  pSlip: 0.12,
  pGuess: 0.25,
  pForget: 0.02,
});

export const OUTCOME_WEIGHTS = Object.freeze({
  correct: 1,
  partial: 0.5,
  incorrect: 0,
  unobserved: null,
});

export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeParams(params = {}) {
  return {
    ...DEFAULT_BKT_PARAMS,
    ...params,
  };
}

export function updateMastery(prior, outcome, params = {}) {
  const p = clamp01(Number.isFinite(prior) ? prior : 0.5);
  const { pLearn, pSlip, pGuess, pForget } = normalizeParams(params);
  const weight = OUTCOME_WEIGHTS[outcome];

  if (weight == null) {
    return clamp01(p * (1 - pForget));
  }

  const correctDenom = p * (1 - pSlip) + (1 - p) * pGuess;
  const incorrectDenom = p * pSlip + (1 - p) * (1 - pGuess);
  const posteriorIfCorrect = correctDenom === 0 ? p : (p * (1 - pSlip)) / correctDenom;
  const posteriorIfIncorrect = incorrectDenom === 0 ? p : (p * pSlip) / incorrectDenom;
  const posterior = weight * posteriorIfCorrect + (1 - weight) * posteriorIfIncorrect;
  const learned = posterior + (1 - posterior) * pLearn;

  return clamp01(learned * (1 - pForget));
}

export function initializeMastery(kcs = {}) {
  const mastery = {};
  for (const [kcId, cfg] of Object.entries(kcs)) {
    mastery[kcId] = {
      pMastery: clamp01(cfg?.prior ?? 0.5),
      observations: 0,
      lastOutcome: 'unobserved',
      lastQuote: '',
    };
  }
  return mastery;
}

export function updateMasteryForEvidence(mastery, evidence, params = {}) {
  const next = structuredClone(mastery);
  for (const kcId of evidence.kcCandidates || []) {
    if (!next[kcId]) {
      next[kcId] = {
        pMastery: 0.5,
        observations: 0,
        lastOutcome: 'unobserved',
        lastQuote: '',
      };
    }
    const previous = next[kcId].pMastery;
    const updated = updateMastery(previous, evidence.outcome, params);
    next[kcId] = {
      pMastery: updated,
      observations: next[kcId].observations + (evidence.outcome === 'unobserved' ? 0 : 1),
      lastOutcome: evidence.outcome,
      lastQuote: evidence.quote,
      delta: updated - previous,
    };
  }
  return next;
}

export function masteryFor(mastery, kcId) {
  return mastery?.[kcId]?.pMastery ?? 0.5;
}
