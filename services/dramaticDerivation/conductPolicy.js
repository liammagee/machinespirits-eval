export const CONDUCT_POLICY_SCHEMA = 'dramatic-derivation.conduct-policy.v0';
export const CONDUCT_COMPLIANCE_SCHEMA = 'dramatic-derivation.conduct-policy-compliance.v0';

export const CONDUCT_MOVE_FAMILIES = Object.freeze([
  'repair_dependency',
  'ask_diagnostic',
  'ask_scope_test',
  'consolidate_subproof',
  'release_next_evidence',
  'block_assertion',
  'invite_final_assertion',
  'repair_recognition_rupture',
]);

const MOVE_SPECS = Object.freeze({
  repair_dependency: Object.freeze({
    preconditions: ['proof debt or dependency-repair trigger is active'],
    blockedActions: ['invite_final_assertion', 'release_unrelated_evidence'],
    permittedTutorFields: ['moveFamily', 'targetPremise', 'surface', 'sinceTurn', 'publicReason', 'learnerExcerpt'],
    expectedUptake: 'learner re-seats the missing dependency or uses it before advancing',
  }),
  ask_diagnostic: Object.freeze({
    preconditions: ['public evidence is underdetermined or conflicts with hidden continuity'],
    blockedActions: ['pretend_entitlement_is_settled', 'continue_hidden_delay_without_diagnostic'],
    permittedTutorFields: ['moveFamily', 'targetPremise', 'publicReason', 'learnerExcerpt', 'visibleReason'],
    expectedUptake: 'learner clarifies whether public conduct licenses the next move',
  }),
  ask_scope_test: Object.freeze({
    preconditions: ['learner has a substantive counter-warrant or over-broad warrant'],
    blockedActions: ['validate_without_testing_scope'],
    permittedTutorFields: ['moveFamily', 'targetPremise', 'publicReason', 'learnerExcerpt'],
    expectedUptake: 'learner distinguishes where the warrant applies',
  }),
  consolidate_subproof: Object.freeze({
    preconditions: ['local proof progress is valid but not yet owned'],
    blockedActions: ['release_unrelated_evidence', 'invite_final_assertion'],
    permittedTutorFields: ['moveFamily', 'targetPremise', 'publicReason', 'learnerExcerpt'],
    expectedUptake: 'learner states the local dependency in their own words',
  }),
  release_next_evidence: Object.freeze({
    preconditions: ['guard permits next evidence and no dependency repair is due'],
    blockedActions: ['release_uncertified_evidence'],
    permittedTutorFields: ['moveFamily', 'targetPremise', 'surface', 'publicReason'],
    expectedUptake: 'learner adopts the newly released public exhibit',
  }),
  block_assertion: Object.freeze({
    preconditions: ['learner attempted an unsupported final assertion'],
    blockedActions: ['accept_unsupported_assertion', 'treat_local_fluency_as_entitlement'],
    permittedTutorFields: ['moveFamily', 'publicReason', 'learnerExcerpt'],
    expectedUptake: 'learner continues reasoning instead of taking an unsupported answer',
  }),
  invite_final_assertion: Object.freeze({
    preconditions: ['public board entails the answer and no repair is due'],
    blockedActions: ['continue_dependency_repair', 'release_unrelated_evidence'],
    permittedTutorFields: ['moveFamily', 'publicReason', 'learnerExcerpt'],
    expectedUptake: 'learner asserts the answer from the public record',
  }),
  repair_recognition_rupture: Object.freeze({
    preconditions: ['recognition rupture is active before proof pressure can continue'],
    blockedActions: ['increase_proof_pressure_without_acknowledgement'],
    permittedTutorFields: ['moveFamily', 'publicReason', 'learnerExcerpt', 'recognitionNeed'],
    expectedUptake: 'learner acknowledges being heard before proof pressure resumes',
  }),
});

const FORBIDDEN_TUTOR_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'closesProof',
  'fact',
  'facts',
  'proof',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'trajectoryD',
  'boardD',
]);

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .trim();
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`conductPolicy: ${label} must be an object`);
  }
  return value;
}

function moveSpec(moveFamily) {
  const spec = MOVE_SPECS[moveFamily];
  if (!spec) throw new Error(`conductPolicy: unknown move family ${JSON.stringify(moveFamily)}`);
  return spec;
}

function proofDebtActive(state) {
  if (state.proofDebt?.active) return true;
  if (state.proofDebtReport?.active) return true;
  if (state.proofDebtTutorView?.active) return true;
  return false;
}

function recognitionActive(state) {
  return state.recognitionNeed?.active === true || state.evidence?.recognitionNeed?.active === true;
}

function unsupportedAssertion(state) {
  return (
    state.triggerType === 'unsupported_assertion_blocked' ||
    state.assertionGate?.blocked === true ||
    state.evidence?.assertionGate?.blocked === true
  );
}

function finalAssertionAvailable(state) {
  return state.triggerType === 'final_assertion_available_but_delayed' || state.canAssertFinal === true;
}

function validAlternativeCandidate(state) {
  return state.triggerType === 'valid_alternative_route_candidate' || state.validAlternativeCandidate === true;
}

function visibleHiddenConflict(state) {
  return state.triggerType === 'visible_hidden_conflict' || state.visibleHiddenConflict === true;
}

function progressPressureActive(state) {
  return state.triggerType === 'progress_pressure_after_diagnostic_budget' || state.progressPressure?.active === true;
}

function earlyReleaseHold(state) {
  return state.triggerType === 'early_release_not_current_authorized' || state.holdEarlyRelease === true;
}

function dependencyRepairNeeded(state) {
  return state.triggerType === 'dependency_repair_needed' || state.needsDependencyRepair === true || proofDebtActive(state);
}

function entitlementState(state) {
  return state.learnerEntitlement || state.entitlementState || state.evidence?.learnerEntitlement || null;
}

function hiddenCertifiedRelease(state) {
  return state.hiddenCertifiedRelease === true || state.evidence?.hybridGuard?.accepted === true;
}

function targetPremise(state) {
  const entitlement = entitlementState(state);
  return (
    state.premiseId ||
    state.targetPremise ||
    state.releaseCandidate ||
    state.evidence?.releaseCandidate ||
    entitlement?.targetPremise ||
    entitlement?.validAlternative?.targetPremise ||
    entitlement?.proofDebt?.targetPremise ||
    entitlement?.release?.targetPremise ||
    entitlement?.visible?.premiseId ||
    state.proofDebt?.target ||
    state.proofDebtTutorView?.debts?.[0]?.premiseId ||
    state.proofDebtReport?.debts?.[0]?.premiseId ||
    state.evidence?.intervention?.premise ||
    null
  );
}

function firstDebt(state) {
  const entitlement = entitlementState(state);
  return (
    state.proofDebtTutorView?.debts?.[0] ||
    state.proofDebt?.debts?.[0] ||
    state.proofDebtReport?.debts?.[0] ||
    entitlement?.proofDebt?.debts?.[0] ||
    null
  );
}

function classifyEntitlementState(entitlement) {
  if (!entitlement || typeof entitlement !== 'object') return null;
  if (entitlement.recognition?.active) {
    return {
      moveFamily: 'repair_recognition_rupture',
      reasonCode: 'recognition_rupture',
      rationale: 'recognition repair is active before further proof pressure',
    };
  }
  if (entitlement.validAlternative?.active) {
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'valid_alternative_candidate',
      rationale: 'public evidence may license a route not served by hidden delay',
    };
  }
  if (entitlement.proofDebt?.active) {
    return {
      moveFamily: 'repair_dependency',
      reasonCode: 'dependency_repair_needed',
      rationale: 'a proof-critical dependency must be restored before advancing',
    };
  }
  if (entitlement.finalAssertion?.available) {
    return {
      moveFamily: 'invite_final_assertion',
      reasonCode: 'final_assertion_available',
      rationale: 'the public board can now support the answer',
    };
  }
  if (entitlement.release?.earlyOptional) {
    return {
      moveFamily: 'consolidate_subproof',
      reasonCode: 'early_release_not_current_authorized',
      rationale: 'the candidate exhibit is in the early window but is not due or forced; consolidate current support',
    };
  }
  if (entitlement.visible?.progressPressure) {
    if (entitlement.release?.progressCandidate) {
      return {
        moveFamily: 'release_next_evidence',
        reasonCode: 'progress_pressure_release',
        rationale: 'diagnostic pressure is exhausted and a certified next exhibit can move the proof forward',
      };
    }
    return {
      moveFamily: 'consolidate_subproof',
      reasonCode: 'progress_pressure_consolidate',
      rationale: 'diagnostic pressure is exhausted; consolidate the staged support instead of asking again',
    };
  }
  if (entitlement.visible?.active) {
    if (entitlement.visible.hiddenCertifiedRelease) {
      return {
        moveFamily: 'release_next_evidence',
        reasonCode: 'hidden_certifies_release_over_visible_conflict',
        rationale: 'hidden reference certifies the release despite visible conflict',
      };
    }
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'visible_hidden_conflict',
      rationale: 'visible evidence and hidden continuity disagree; ask before acting',
    };
  }
  if (entitlement.release?.played && entitlement.release?.currentAuthorized) {
    return {
      moveFamily: 'release_next_evidence',
      reasonCode: 'release_candidate_certified',
      rationale: 'the next exhibit is certified and no repair is due',
    };
  }
  if (entitlement.uncertainty?.active) {
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'underdetermined',
      rationale: 'state evidence is too weak to advance or repair confidently',
    };
  }
  return null;
}

function classifyConductState(state) {
  if (unsupportedAssertion(state)) {
    return {
      moveFamily: 'block_assertion',
      reasonCode: 'unsupported_assertion',
      rationale: 'learner attempted a final assertion the public board does not yet support',
    };
  }
  if (recognitionActive(state) || state.triggerType === 'recognition_rupture_active') {
    return {
      moveFamily: 'repair_recognition_rupture',
      reasonCode: 'recognition_rupture',
      rationale: 'recognition repair is active before further proof pressure',
    };
  }
  const entitlement = classifyEntitlementState(entitlementState(state));
  if (entitlement) return entitlement;
  if (validAlternativeCandidate(state)) {
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'valid_alternative_candidate',
      rationale: 'public evidence may license a route not served by hidden delay',
    };
  }
  if (dependencyRepairNeeded(state)) {
    return {
      moveFamily: 'repair_dependency',
      reasonCode: 'dependency_repair_needed',
      rationale: 'a proof-critical dependency must be restored before advancing',
    };
  }
  if (finalAssertionAvailable(state)) {
    return {
      moveFamily: 'invite_final_assertion',
      reasonCode: 'final_assertion_available',
      rationale: 'the public board can now support the answer',
    };
  }
  if (earlyReleaseHold(state)) {
    return {
      moveFamily: 'consolidate_subproof',
      reasonCode: 'early_release_not_current_authorized',
      rationale: 'the candidate exhibit is in the early window but is not due or forced; consolidate current support',
    };
  }
  if (progressPressureActive(state)) {
    if (state.releaseCandidate || state.evidence?.releaseCandidate) {
      return {
        moveFamily: 'release_next_evidence',
        reasonCode: 'progress_pressure_release',
        rationale: 'diagnostic pressure is exhausted and a certified next exhibit can move the proof forward',
      };
    }
    return {
      moveFamily: 'consolidate_subproof',
      reasonCode: 'progress_pressure_consolidate',
      rationale: 'diagnostic pressure is exhausted; consolidate the staged support instead of asking again',
    };
  }
  if (visibleHiddenConflict(state)) {
    if (hiddenCertifiedRelease(state)) {
      return {
        moveFamily: 'release_next_evidence',
        reasonCode: 'hidden_certifies_release_over_visible_conflict',
        rationale: 'hidden reference certifies the release despite visible conflict',
      };
    }
    return {
      moveFamily: 'ask_diagnostic',
      reasonCode: 'visible_hidden_conflict',
      rationale: 'visible evidence and hidden continuity disagree; ask before acting',
    };
  }
  if (state.releaseCandidate || state.evidence?.releaseCandidate) {
    return {
      moveFamily: 'release_next_evidence',
      reasonCode: 'release_candidate_certified',
      rationale: 'the next exhibit is certified and no repair is due',
    };
  }
  return {
    moveFamily: 'ask_diagnostic',
    reasonCode: 'underdetermined',
    rationale: 'state evidence is too weak to advance or repair confidently',
  };
}

function sanitizedDebt(debt) {
  if (!debt || typeof debt !== 'object') return null;
  return {
    ...(debt.premiseId ? { premiseId: debt.premiseId } : {}),
    ...(debt.surface ? { surface: debt.surface } : {}),
    ...(debt.sinceTurn != null ? { sinceTurn: debt.sinceTurn } : {}),
  };
}

function buildTutorView(state, classification, spec) {
  const debt = sanitizedDebt(firstDebt(state));
  const entitlement = entitlementState(state);
  const view = {
    moveFamily: classification.moveFamily,
    reasonCode: classification.reasonCode,
    targetPremise: targetPremise(state),
    publicReason: classification.rationale,
  };
  if (debt) {
    if (debt.surface) view.surface = debt.surface;
    if (debt.sinceTurn != null) view.sinceTurn = debt.sinceTurn;
  }
  const learnerExcerpt = state.evidence?.learnerExcerpt || state.learnerExcerpt || null;
  if (learnerExcerpt) view.learnerExcerpt = learnerExcerpt;
  const visibleReason = state.evidence?.intervention?.reason || state.visibleReason || entitlement?.visible?.reason || null;
  if (visibleReason && spec.permittedTutorFields.includes('visibleReason')) view.visibleReason = visibleReason;
  if (state.recognitionNeed && spec.permittedTutorFields.includes('recognitionNeed')) {
    view.recognitionNeed = {
      level: state.recognitionNeed.level ?? null,
      desiredActs: Array.isArray(state.recognitionNeed.desiredActs) ? state.recognitionNeed.desiredActs : [],
    };
  } else if (entitlement?.recognition?.active && spec.permittedTutorFields.includes('recognitionNeed')) {
    view.recognitionNeed = {
      level: entitlement.recognition.level ?? null,
      desiredActs: Array.isArray(entitlement.recognition.desiredActs) ? entitlement.recognition.desiredActs : [],
    };
  }
  return Object.fromEntries(Object.entries(view).filter(([, value]) => value != null));
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
    if (FORBIDDEN_TUTOR_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditConductTutorView(view) {
  const leaks = auditForbiddenKeys(view);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_TUTOR_KEYS].sort(),
  };
}

export function selectConductMove(rawState = {}) {
  const state = requireObject(rawState, 'state');
  const classification = classifyConductState(state);
  const spec = moveSpec(classification.moveFamily);
  const blockedActions = uniq([...(spec.blockedActions || []), ...(state.blockedActions || [])]);
  const tutorView = buildTutorView(state, classification, spec);
  const nonLeakAudit = auditConductTutorView(tutorView);

  return {
    schema: CONDUCT_POLICY_SCHEMA,
    selectedMoveFamily: classification.moveFamily,
    reasonCode: classification.reasonCode,
    rationale: classification.rationale,
    targetPremise: targetPremise(state),
    preconditions: [...spec.preconditions],
    blockedActions,
    permittedTutorFields: [...spec.permittedTutorFields],
    expectedLocalUptake: state.localUptakeExpectation || spec.expectedUptake,
    tutorView,
    nonLeakAudit,
    sourceTriggerId: state.id || null,
    ...(entitlementState(state) ? { learnerEntitlement: entitlementState(state) } : {}),
  };
}

function realizedAction(raw = {}) {
  const move = raw.move || raw.realizedMove || null;
  return {
    intent: norm(move?.intent),
    targetPremise: move?.targetPremise || move?.target_premise || null,
    release: raw.release ?? raw.realizedRelease ?? null,
    figure: move?.figure || null,
  };
}

function complianceSpec(moveFamily) {
  switch (moveFamily) {
    case 'repair_dependency':
      return {
        allowedIntents: ['restore'],
        releasePolicy: 'allowed',
        requireTarget: true,
        rationale: 'repair_dependency requires a restore move on the selected dependency',
      };
    case 'release_next_evidence':
      return {
        allowedIntents: ['release', 'orient', 'consolidate'],
        releasePolicy: 'required',
        requireTarget: false,
        rationale: 'release_next_evidence requires an actual release',
      };
    case 'ask_diagnostic':
      return {
        allowedIntents: ['test', 'confront', 'orient'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'ask_diagnostic should ask before acting, without releasing new evidence',
      };
    case 'ask_scope_test':
      return {
        allowedIntents: ['test', 'counter_mirror'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'ask_scope_test should test the warrant, not validate it or release new evidence',
      };
    case 'consolidate_subproof':
      return {
        allowedIntents: ['consolidate', 'orient', 'test'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'consolidate_subproof should keep attention on already-staged support',
      };
    case 'block_assertion':
      return {
        allowedIntents: ['test', 'counter_mirror', 'confront'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'block_assertion should interrupt unsupported closure without adding evidence',
      };
    case 'invite_final_assertion':
      return {
        allowedIntents: ['stage_recognition', 'test'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'invite_final_assertion should elicit the answer from the public record',
      };
    case 'repair_recognition_rupture':
      return {
        allowedIntents: ['stage_recognition', 'orient', 'consolidate'],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: 'repair_recognition_rupture should acknowledge the relation before proof pressure resumes',
      };
    default:
      return {
        allowedIntents: [],
        releasePolicy: 'forbidden',
        requireTarget: false,
        rationale: `unknown conduct move family ${JSON.stringify(moveFamily)}`,
      };
  }
}

export function auditConductGeneratorCompliance(rawDecision = {}, rawRealized = {}) {
  const decision = rawDecision && typeof rawDecision === 'object' ? rawDecision : {};
  const active = decision.active !== false && Boolean(decision.selectedMoveFamily);
  const observed = realizedAction(rawRealized);
  if (!active) {
    return {
      schema: CONDUCT_COMPLIANCE_SCHEMA,
      checked: false,
      ok: null,
      reason: 'no_active_policy_trigger',
      expected: null,
      observed,
      failures: [],
    };
  }

  const expected = complianceSpec(decision.selectedMoveFamily);
  const failures = [];
  if (expected.allowedIntents.length && !expected.allowedIntents.includes(observed.intent)) {
    failures.push({
      code: 'intent_mismatch',
      expected: expected.allowedIntents,
      observed: observed.intent || null,
    });
  }
  if (expected.requireTarget && decision.targetPremise && observed.targetPremise !== decision.targetPremise) {
    failures.push({
      code: 'target_mismatch',
      expected: decision.targetPremise,
      observed: observed.targetPremise,
    });
  }
  if (expected.releasePolicy === 'required' && !observed.release) {
    failures.push({ code: 'missing_release', expected: decision.targetPremise || '(any certified release)' });
  }
  if (expected.releasePolicy === 'forbidden' && observed.release) {
    failures.push({ code: 'forbidden_release', observed: observed.release });
  }
  if (
    expected.releasePolicy === 'required' &&
    decision.targetPremise &&
    observed.release &&
    observed.release !== decision.targetPremise
  ) {
    failures.push({
      code: 'release_target_mismatch',
      expected: decision.targetPremise,
      observed: observed.release,
    });
  }

  return {
    schema: CONDUCT_COMPLIANCE_SCHEMA,
    checked: true,
    ok: failures.length === 0,
    reason: failures.length ? 'realized tutor move did not satisfy selected conduct move family' : expected.rationale,
    selectedMoveFamily: decision.selectedMoveFamily,
    expected: {
      allowedIntents: expected.allowedIntents,
      releasePolicy: expected.releasePolicy,
      targetPremise: decision.targetPremise || null,
      requireTarget: expected.requireTarget,
    },
    observed,
    failures,
  };
}

export function conductMoveSpec(moveFamily) {
  const spec = moveSpec(moveFamily);
  return {
    moveFamily,
    preconditions: [...spec.preconditions],
    blockedActions: [...spec.blockedActions],
    permittedTutorFields: [...spec.permittedTutorFields],
    expectedUptake: spec.expectedUptake,
  };
}

export function conductMoveSpecs() {
  return Object.fromEntries(CONDUCT_MOVE_FAMILIES.map((family) => [family, conductMoveSpec(family)]));
}
