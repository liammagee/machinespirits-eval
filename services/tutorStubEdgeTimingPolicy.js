import {
  detectEngagementResistanceSignal,
  hasEngagementResistanceSignal,
  selectResistanceRegister,
} from './engagementModeRouter.js';

export const TUTOR_STUB_EDGE_TIMING_SCHEMA = 'machinespirits.tutor-stub.edge-timing-policy.v1';

const EDGED_REGISTERS = Object.freeze(['ironic', 'sarcastic']);
const NON_SIMULATED_MENU = Object.freeze([
  'plain',
  'precise',
  'brisk',
  'warm',
  'witnessing',
  'charismatic',
  'ironic',
  'sarcastic',
]);

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function classificationSignal(classification) {
  const turn = classification?.turn || {};
  const overall = classification?.overall || {};
  return oneLine(
    [
      turn.summary,
      turn.request_type,
      turn.discourse_move,
      turn.evidence_use,
      turn.epistemic_stance,
      turn.affect,
      turn.agency,
      turn.learning_pace,
      turn.pedagogical_need,
      overall.summary,
      overall.current_state,
      overall.next_best_tutor_move,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function firstAvailable(menu, names) {
  for (const name of names) {
    if (menu.includes(name)) return name;
  }
  return menu[0] || null;
}

function activeMenu(state) {
  const configured = Array.isArray(state?.register?.palette) ? state.register.palette : NON_SIMULATED_MENU;
  const menu = configured.filter((register) => NON_SIMULATED_MENU.includes(register));
  return [...new Set(menu)];
}

function previousRegister(state) {
  const previous = state?.register?.history?.at?.(-1) || null;
  return previous?.engagement_stance || previous?.selected_register || previous?.register || null;
}

function hasGroundedClosure(tutorLearnerDag) {
  const assessment = tutorLearnerDag?.model?.assessment || {};
  return Boolean(
    assessment.finalSecretEntailed === true ||
    assessment.assertedSecret === true ||
    tutorLearnerDag?.conversationalCompletion?.lifecycle?.phase === 'closed',
  );
}

export function detectTutorStubEdgeTimingSignal({
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
} = {}) {
  const learner = oneLine(learnerText);
  const classified = classificationSignal(classification);
  const combined = `${learner} ${classified}`.trim();
  const protectedAffect =
    /vulnerability_or_moral_exposure|shame|ashamed|anxious|afraid|humiliat|panic|overwhelm/iu.test(combined);
  const comprehensionRepair =
    /plain_language_request|plain_simplification_followup|what does .+ mean|simpler words|plain (?:english|language)/iu.test(
      combined,
    );

  let resistanceSignal = null;
  let evidence = null;
  if (hasEngagementResistanceSignal(learner)) {
    const detected = detectEngagementResistanceSignal(learner);
    resistanceSignal = detected.signal;
    evidence = detected.evidence;
  } else if (/resistance_or_low_agency|resistant|answer_seeking|passive|complying|low_agency/iu.test(classified)) {
    resistanceSignal = 'unspecified_resistance';
    evidence = classification?.turn?.summary || null;
  }

  if (resistanceSignal) {
    return {
      phase: 'resistance',
      resistanceSignal,
      evidence: oneLine(evidence),
      protectedAffect,
      comprehensionRepair,
    };
  }

  const learnerAdvance = tutorLearnerDag?.advance || tutorLearnerDag?.model?.learnerAdvance || null;
  const explicitUptake =
    /\b(?:now i see|i see why|that makes sense|the deciding feature|the key (?:feature|point|hinge)|i(?:'ll| will) hold|my (?:claim|sentence|test) is|provisionally|this is less dead)\b/iu.test(
      learner,
    );
  const classifiedUptake =
    learnerAdvance?.supportedMoveCount > 0 ||
    /links?_evidence|grounds?_claim|supported_inference|grounded|self_directed|steering|accelerating/iu.test(
      classified,
    );
  if (hasGroundedClosure(tutorLearnerDag) || explicitUptake || classifiedUptake) {
    return {
      phase: 'uptake',
      resistanceSignal: null,
      evidence: oneLine(
        hasGroundedClosure(tutorLearnerDag)
          ? 'grounded or conversational closure'
          : explicitUptake
            ? learner
            : classification?.turn?.summary,
      ),
      protectedAffect,
      comprehensionRepair,
    };
  }

  return {
    phase: 'other',
    resistanceSignal: null,
    evidence: oneLine(classification?.turn?.summary),
    protectedAffect,
    comprehensionRepair,
  };
}

export function buildTutorStubEdgeTimingSelection({
  state,
  classification,
  tutorLearnerDag,
  learnerText = '',
  primaryRegister = null,
} = {}) {
  const menu = activeMenu(state);
  const signal = detectTutorStubEdgeTimingSignal({ learnerText, classification, tutorLearnerDag });
  const prior = previousRegister(state);
  let selected = null;
  let edgeEligible = false;
  let suppressionReason = null;
  let strength = 0;

  if (signal.comprehensionRepair) {
    selected = firstAvailable(menu, ['plain', 'warm', 'precise']);
    suppressionReason = 'comprehension_repair';
    strength = 1;
  } else if (signal.protectedAffect) {
    selected = firstAvailable(menu, ['witnessing', 'warm', 'plain']);
    suppressionReason = 'protected_affect';
    strength = 1;
  } else if (signal.phase === 'uptake') {
    selected = firstAvailable(menu, ['precise', 'plain', 'warm', 'brisk']);
    suppressionReason = 'uptake_closes_edge';
    strength = 1;
  } else if (signal.phase === 'resistance') {
    const requested = selectResistanceRegister(signal.resistanceSignal, menu);
    selected = menu.includes(requested) ? requested : firstAvailable(menu, ['charismatic', 'warm', 'precise', 'plain']);
    edgeEligible = EDGED_REGISTERS.includes(selected);
    const edgeMappedSignal = ['boredom', 'rote_parroting', 'irrelevance', 'question_flood'].includes(
      signal.resistanceSignal,
    );
    suppressionReason = edgeEligible
      ? null
      : edgeMappedSignal
        ? 'edged_register_not_in_active_menu'
        : 'resistance_requires_non_edged_stance';
    strength = signal.resistanceSignal === 'unspecified_resistance' ? 0.85 : 1;
  }

  const edgeTiming = {
    schema: TUTOR_STUB_EDGE_TIMING_SCHEMA,
    phase: signal.phase,
    resistance_signal: signal.resistanceSignal,
    evidence_span: signal.evidence || null,
    previous_register: prior,
    primary_register: primaryRegister,
    router_register_menu: menu,
    admitted_edged_registers: menu.filter((register) => EDGED_REGISTERS.includes(register)),
    edge_eligible: edgeEligible,
    edge_suppressed_reason: suppressionReason,
    selected_register: selected,
    decision_strength: strength,
    mapping: 'adaptive-register-switching-stage1',
  };

  if (!selected) {
    return {
      selected_register: null,
      source: 'edge_timing_register_policy_overlay',
      edge_timing: edgeTiming,
    };
  }

  const transition =
    prior && prior !== selected
      ? `${prior} -> ${selected}`
      : prior === selected
        ? `${selected} held`
        : `initial -> ${selected}`;
  const reason =
    signal.phase === 'uptake'
      ? `Edge timing closed the edged menu on learner uptake and selected ${selected} (${transition}).`
      : edgeEligible
        ? `Edge timing matched ${signal.resistanceSignal} resistance and selected ${selected} from the active menu (${transition}).`
        : `Edge timing matched ${signal.resistanceSignal || 'a protected condition'} and selected non-edged ${selected} (${transition}).`;
  const distribution = [{ register: selected, weight: 1, probability: 1, sourceScore: 1 }];
  return {
    engagement_stance: selected,
    selected_register: selected,
    reviewer_signal: `edge_timing:${signal.phase}:${signal.resistanceSignal || 'none'}`,
    register_reason: reason,
    engagement_stance_reason: reason,
    expected_dag_move:
      signal.phase === 'uptake'
        ? 'Consolidate the learner-owned move without reapplying edged pressure.'
        : 'Use the selected manner while preserving one public, checkable learner move.',
    expected_field_move:
      signal.phase === 'uptake'
        ? 'Preserve uptake and learner ownership.'
        : 'Test whether the timed stance disrupts resistance without narrowing learner agency.',
    expected_progress_marker:
      signal.phase === 'uptake'
        ? 'The learner continues with grounded evidence or a warranted inference.'
        : 'The next learner turn moves from resistance into content-bearing work.',
    confidence: 1,
    selected_probability: 1,
    source: 'edge_timing_register_policy_overlay',
    distribution,
    engagement_stance_distribution: distribution,
    edge_timing: edgeTiming,
  };
}

export function finalizeTutorStubEdgeTimingDecision(edgeTiming, { finalRegister, finalSource } = {}) {
  if (!edgeTiming || typeof edgeTiming !== 'object') return null;
  const timingRegister = edgeTiming.selected_register || null;
  const finalSelectedRegister = finalRegister || timingRegister;
  const displaced = Boolean(
    edgeTiming.activated === true &&
    timingRegister &&
    finalSelectedRegister &&
    timingRegister !== finalSelectedRegister,
  );
  return {
    ...edgeTiming,
    final_selected_register: finalSelectedRegister,
    applied: edgeTiming.activated === true && !displaced,
    post_timing_override: displaced
      ? {
          source: finalSource || 'unknown_post_timing_override',
          selected_register: finalSelectedRegister,
        }
      : null,
  };
}
