export const DIDACTIC_MODE_SCHEMA = 'dramatic-derivation.didactic-mode.v0';
export const DIDACTIC_ACT_FALLBACK_SCHEMA = 'dramatic-derivation.didactic-act-fallback.v0';
export const DIDACTIC_OPPORTUNITY_BUDGET_SCHEMA = 'dramatic-derivation.didactic-opportunity-budget.v0';

export const DIDACTIC_MODE_FAMILIES = Object.freeze([
  'teach_back',
  'concrete_example',
  'analogy_bridge',
  'contrast_case',
  'slow_recap',
  'purpose_bridge',
  'decompose_subtask',
  'repair_vocabulary',
]);

const MODE_SET = new Set(DIDACTIC_MODE_FAMILIES);

const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
]);

const MODE_EXIT_CONDITIONS = Object.freeze({
  teach_back: 'learner gives a usable own words account of the current object',
  concrete_example: 'learner maps the example back to the current object',
  analogy_bridge: 'learner names the shared structure between the analogy and the current object',
  contrast_case: 'learner distinguishes the current route from the nearby wrong route',
  slow_recap: 'learner can identify the next missing link in the chain',
  purpose_bridge: 'learner connects the evidence to the current question',
  decompose_subtask: 'learner completes the smaller subtask without a leap',
  repair_vocabulary: 'learner uses the term correctly in dialogue',
});

const MODE_PROOF_NEUTRAL_BUDGETS = Object.freeze({
  teach_back: 1,
  concrete_example: 1,
  analogy_bridge: 1,
  contrast_case: 1,
  slow_recap: 1,
  purpose_bridge: 1,
  decompose_subtask: 1,
  repair_vocabulary: 1,
});

function norm(text) {
  return String(text || '').toLowerCase();
}

function auditForbiddenKeys(value, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => leaks.push(...auditForbiddenKeys(item, [...path, String(index)])));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditDidacticModePublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function recentPublicLines(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      role: line.role === 'director' ? 'stage' : line.role,
      text: typeof line.text === 'string' ? line.text : '',
      exchangeType: line.meta?.exchange?.type || line.exchangeType || null,
    }))
    .filter((line) => line.text.trim());
}

function lastLearnerText(lines = []) {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].role === 'learner') return lines[i].text;
  }
  return '';
}

function countExchange(lines = [], types = []) {
  const wanted = new Set(types);
  return lines.filter((line) => wanted.has(line.exchangeType)).length;
}

function currentObjectLabel(input = {}) {
  const raw =
    input.currentObject ||
    input.currentObjectLabel ||
    input.publicObject ||
    input.objectLabel ||
    input.uptake?.currentObject ||
    input.repairSignals?.find((signal) => signal?.publicObject)?.publicObject ||
    null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 160) : null;
}

function publicRepairSignals(repairSignals = []) {
  return (Array.isArray(repairSignals) ? repairSignals : [])
    .map((signal) => ({
      publicObject: typeof signal?.publicObject === 'string' ? signal.publicObject.trim().slice(0, 160) : null,
      count: Number.isFinite(Number(signal?.count)) ? Number(signal.count) : 0,
      sameObject: signal?.sameObject === true,
    }))
    .filter((signal) => signal.publicObject || signal.count > 0 || signal.sameObject);
}

function publicEvidenceLine(text) {
  return String(text || '').trim().slice(0, 180);
}

function makeState({
  currentObject = null,
  learningSignal,
  recommendedMode,
  scope = 'scene',
  evidence = [],
  inputAudit,
}) {
  const mode = MODE_SET.has(recommendedMode) ? recommendedMode : 'slow_recap';
  const cleanEvidence = evidence.map(publicEvidenceLine).filter(Boolean).slice(0, 4);
  const state = {
    schema: DIDACTIC_MODE_SCHEMA,
    publicOnly: true,
    authority: 'scene_or_act_advisory',
    mayOverrideProofControl: false,
    currentObject,
    learningSignal,
    recommendedMode: mode,
    scope,
    evidence: cleanEvidence.length ? cleanEvidence : ['no public didactic pressure detected'],
    exitCondition: MODE_EXIT_CONDITIONS[mode],
    opportunityCost: deriveDidacticOpportunityBudget(mode),
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditDidacticModePublicInput(state),
  };
}

export function deriveDidacticOpportunityBudget(mode) {
  const selectedMode = MODE_SET.has(mode) ? mode : 'slow_recap';
  return {
    schema: DIDACTIC_OPPORTUNITY_BUDGET_SCHEMA,
    publicOnly: true,
    authority: 'advisory_budget',
    mayOverrideProofControl: false,
    mode: selectedMode,
    proofObligationPreserved: true,
    maxProofNeutralTurns: MODE_PROOF_NEUTRAL_BUDGETS[selectedMode] ?? 1,
    exitCondition: MODE_EXIT_CONDITIONS[selectedMode],
    failureAction: 'resume_hidden_proofdebt_obligation_mark_ownership_unproven',
  };
}

function rejectedState(inputAudit) {
  return makeState({
    currentObject: null,
    learningSignal: 'unknown',
    recommendedMode: 'slow_recap',
    scope: 'scene',
    evidence: ['input rejected by public-only audit'],
    inputAudit,
  });
}

function signalFromInput(input = {}) {
  const lines = recentPublicLines(input.transcript);
  const text = norm([lastLearnerText(lines), input.learnerText, input.exchange?.text].filter(Boolean).join('\n'));
  const exchangeType = input.exchange?.type || input.exchangeType || null;
  const uptake = input.uptake || {};
  const learnerState = input.learnerState || {};
  const discursive = input.discursiveCalibration || {};
  const scene = input.scene || {};
  const act = input.act || {};
  const repairs = publicRepairSignals(input.repairSignals);
  const confusionCount = countExchange(lines, ['confusion', 'repair_request']) + Number(input.confusionCount || 0);
  const repeatedRepair = repairs.some((signal) => signal.sameObject && signal.count >= 2);
  const evidence = [];

  if (
    uptake.vocabularyConfusion ||
    learnerState.vocabularyConfusion ||
    exchangeType === 'vocabulary_confusion' ||
    /\b(what does .* mean|what is .* supposed to mean|what does .* mean here|i don't know what .* means|i do not know what .* means)\b/u.test(text)
  ) {
    evidence.push('public learner text asks for vocabulary or context repair');
    return { learningSignal: 'stalled', recommendedMode: 'repair_vocabulary', scope: 'scene', evidence };
  }

  if (
    uptake.overloaded ||
    learnerState.overloaded ||
    exchangeType === 'overload' ||
    scene.closeStatus === 'drift_guard' ||
    repeatedRepair ||
    act.audit?.outcome === 'fallback_failed'
  ) {
    if (repeatedRepair) evidence.push('same public object has needed repeated repair');
    if (uptake.overloaded || learnerState.overloaded || exchangeType === 'overload') {
      evidence.push('public learner state indicates overload');
    }
    if (act.audit?.outcome === 'fallback_failed') evidence.push('act audit reports fallback failed');
    return { learningSignal: 'overloaded', recommendedMode: 'decompose_subtask', scope: 'next_act', evidence };
  }

  if (
    uptake.wrongRoute ||
    learnerState.wrongRoute ||
    exchangeType === 'misapplied_route' ||
    discursive.publicPosture === 'wrong_route' ||
    /\b(not .* but|instead of|wrong route|wrong road|nearby wrong|i thought it was)\b/u.test(text)
  ) {
    evidence.push('public learner state is taking a nearby wrong route');
    return { learningSignal: 'misapplied', recommendedMode: 'contrast_case', scope: 'scene', evidence };
  }

  if (
    input.asksPurpose ||
    uptake.purposeGap ||
    learnerState.asksPurpose ||
    discursive.publicPosture === 'purpose_question' ||
    /\b(why does|why would|why is|what does .* matter|what is .* for|what does .* prove)\b/u.test(text)
  ) {
    evidence.push('public learner asks why this evidence matters');
    return { learningSignal: 'purpose_gap', recommendedMode: 'purpose_bridge', scope: 'scene', evidence };
  }

  if (
    uptake.quality === 'echo_only' ||
    uptake.echoOnly ||
    learnerState.echoOnly ||
    learnerState.fluentEcho ||
    discursive.publicPosture === 'fluent_echo' ||
    /\b(as you said|you said|just repeating|i can repeat|the words are|the phrase is)\b/u.test(text)
  ) {
    evidence.push('public learner talk echoes the tutor without clear ownership');
    return { learningSignal: 'echo_only', recommendedMode: 'teach_back', scope: 'scene', evidence };
  }

  if (uptake.needsTransfer || learnerState.asksForParallel || exchangeType === 'transfer_gap') {
    evidence.push('public learner needs a parallel structure for transfer');
    return { learningSignal: 'stalled', recommendedMode: 'analogy_bridge', scope: 'scene', evidence };
  }

  if (
    uptake.abstractRuleNotLanding ||
    learnerState.abstractRuleNotLanding ||
    exchangeType === 'abstract_rule_not_landing'
  ) {
    evidence.push('public learner has not situated the abstract rule or detail');
    return { learningSignal: 'stalled', recommendedMode: 'concrete_example', scope: 'scene', evidence };
  }

  if (
    confusionCount >= 2 ||
    scene.closeStatus === 'needs_repair' ||
    discursive.conversationalStrain?.level === 'high' ||
    /\b(i am lost|i'm lost|lost me|still do not follow|still don't follow|sorry.*follow|confused)\b/u.test(text)
  ) {
    evidence.push('public learner confusion or repair request recurs');
    return { learningSignal: 'stalled', recommendedMode: 'slow_recap', scope: 'scene', evidence };
  }

  if (uptake.quality === 'owned' || uptake.ownsCurrentObject || learnerState.ownsCurrentObject) {
    evidence.push('public learner appears to own the current object');
    return { learningSignal: 'acquiring', recommendedMode: 'teach_back', scope: 'scene', evidence };
  }

  return { learningSignal: 'unknown', recommendedMode: 'slow_recap', scope: 'scene', evidence };
}

export function deriveDidacticModeState(input = {}) {
  const inputAudit = auditDidacticModePublicInput(input);
  if (!inputAudit.ok) return rejectedState(inputAudit);
  const signal = signalFromInput(input);
  return makeState({
    currentObject: currentObjectLabel(input),
    learningSignal: signal.learningSignal,
    recommendedMode: signal.recommendedMode,
    scope: signal.scope,
    evidence: signal.evidence,
    inputAudit,
  });
}
