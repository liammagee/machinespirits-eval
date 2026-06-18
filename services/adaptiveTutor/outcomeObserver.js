export const OUTCOME_OBSERVER_VERSION = 'adaptation-outcome-observer.v1.0';

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function evidenceSpan(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
}

export function detectOutcomeEvidence(learnerTurn = '') {
  const text = String(learnerTurn || '').trim();
  const lower = text.toLowerCase();
  const mereAgreement = includesAny(lower, [/^(yes|yeah|ok|okay|sure|got it|makes sense|i see)[.! ]*$/u]);
  const rationale = includesAny(lower, [/\bbecause\b/u, /\bso that\b/u, /\btherefore\b/u, /\bpreserve/u, /\binvariant\b/u, /\bdepends on\b/u]);
  const choice = includesAny(lower, [/\bi would\b/u, /\bi'll\b/u, /\bi choose\b/u, /\bmy strategy\b/u, /\bnext i\b/u]);
  const prediction = includesAny(lower, [/\bi predict\b/u, /\bi expect\b/u, /\bwould happen\b/u, /\bwill happen\b/u]);
  const diagnostic = includesAny(lower, [
    /prerequisite|basic idea|don'?t understand the concept|concept.*missing/u,
    /not sure|low confidence|i think.*but/u,
    /approv|acceptable|is that right|before committing|waiting for/u,
    /misread|asking for|task was/u,
    /notation|symbols|equation|concrete example/u,
    /just tell|answer/u,
    /another way|alternative|different model/u,
  ]);
  const taskReorientation = includesAny(lower, [/task asks|question asks|we need to|goal is/u]);
  const modelComparison = includesAny(lower, [/model|method|alternative|compare|instead/u]);
  const selfCheck = includesAny(lower, [/check|recheck|test my|verify/u]);
  const learnerRepair = includesAny(lower, [/i should change|that was wrong|repair|revise|instead i/u]);
  const transfer = includesAny(lower, [/new case|similar problem|transfer|same idea/u]);
  const tutorAdoption = includesAny(lower, [/as you said|your reason|using your explanation/u]);

  return {
    categories: {
      'learner-authored rationale': rationale,
      'learner-authored choice': choice,
      'learner-authored prediction': prediction,
      'learner-authored next step': choice || rationale,
      'learner-authored repair': learnerRepair,
      'learner-authored application': rationale || transfer,
      'learner-authored transfer': transfer,
      'state-disambiguating response': diagnostic,
      'task reorientation': taskReorientation,
      'model comparison': modelComparison,
      'self-check': selfCheck,
      'mere agreement': mereAgreement,
      'verbatim adoption of tutor rationale': tutorAdoption,
      'tutor-completed step': false,
      'empty release': !choice && !rationale && !prediction,
      'premature tutor validation': false,
    },
    span: evidenceSpan(text),
  };
}

export function inferObservedTransition(learnerTurn = '', evidence = detectOutcomeEvidence(learnerTurn)) {
  const c = evidence.categories || {};
  const proof = (c['learner-authored rationale'] ? 0.2 : 0) + (c['model comparison'] ? 0.1 : 0) + (c['self-check'] ? 0.05 : 0);
  const release = (c['learner-authored choice'] ? 0.2 : 0) + (c['learner-authored prediction'] ? 0.1 : 0);
  const ownership =
    (c['learner-authored choice'] ? 0.15 : 0) +
    (c['learner-authored rationale'] ? 0.15 : 0) +
    (c['learner-authored repair'] ? 0.1 : 0);
  const conceptualMastery = (c['learner-authored rationale'] ? 0.1 : 0) + (c['learner-authored transfer'] ? 0.15 : 0);
  const metacognitiveAccuracy =
    (c['state-disambiguating response'] ? 0.2 : 0) + (c['self-check'] ? 0.1 : 0) + (c['task reorientation'] ? 0.1 : 0);

  return {
    proof: Number(proof.toFixed(3)),
    release: Number(release.toFixed(3)),
    ownership: Number(ownership.toFixed(3)),
    conceptual_mastery: Number(conceptualMastery.toFixed(3)),
    metacognitive_accuracy: Number(metacognitiveAccuracy.toFixed(3)),
  };
}

function requiredEvidenceSatisfied(required = [], categories = {}) {
  if (!required.length) return false;
  return required.every((label) => categories[label] === true);
}

function forbiddenEvidencePresent(forbidden = [], categories = {}) {
  return forbidden.some((label) => categories[label] === true);
}

export function observeInterventionOutcome({ pendingIntervention, learnerTurn, turnIndex = null } = {}) {
  if (!pendingIntervention) {
    return {
      version: OUTCOME_OBSERVER_VERSION,
      status: 'no_pending_intervention',
      outcome: 'inconclusive',
      observed_transition: {},
      evidence: [],
    };
  }
  const evidence = detectOutcomeEvidence(learnerTurn);
  const observedTransition = inferObservedTransition(learnerTurn, evidence);
  const required = pendingIntervention.success_signal?.required_evidence || [];
  const forbidden = pendingIntervention.success_signal?.forbidden_evidence || [];
  const requiredOk = requiredEvidenceSatisfied(required, evidence.categories);
  const forbiddenHit = forbiddenEvidencePresent(forbidden, evidence.categories);

  let outcome = 'inconclusive';
  if (requiredOk && !forbiddenHit) outcome = 'success';
  if (forbiddenHit || evidence.categories['mere agreement']) outcome = 'failure';
  if (pendingIntervention.action_type === 'diagnose_with_discriminating_question') {
    if (evidence.categories['state-disambiguating response']) outcome = 'success';
    else if (evidence.categories['mere agreement']) outcome = 'failure';
  }

  return {
    version: OUTCOME_OBSERVER_VERSION,
    status: 'closed',
    outcome,
    observed_transition: observedTransition,
    evidence: evidence.span ? [{ turn_index: turnIndex, quote: evidence.span, categories: evidence.categories }] : [],
    required_evidence_satisfied: requiredOk,
    forbidden_evidence_present: forbiddenHit,
  };
}
