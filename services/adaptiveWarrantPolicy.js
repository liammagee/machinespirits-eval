/**
 * Phase-3 repair-policy layer for the normative/descriptive adaptation design
 * (docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md §11,
 * §18 Phase 3).
 *
 * Maps a WARRANTED divergence diagnosis to a recommended repair policy — an
 * action family from config/engagement-registers.yaml — kept strictly separate
 * from linguistic realization (Phase 4 selects the stance; manner remains a
 * post-hoc measurement). Each mapping cites the family's own catalogue
 * description; the map adds no new ontology.
 *
 * The policy answers: "given WHY revision is warranted, what kind of
 * pedagogical move should govern the next stretch?" It does not generate
 * text and it does not decide WHETHER revision is warranted (the warrant
 * layer owns that).
 */

export const ADAPTIVE_WARRANT_POLICY_SCHEMA = 'machinespirits.adaptation-refinement.repair-policy.v3';
export const ADAPTIVE_WARRANT_CHALLENGE_RESISTANCE_MODES = Object.freeze(['selectable', 'unselectable']);

export function resolveAdaptiveWarrantChallengeResistanceSelectable(
  value = process.env.TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE,
) {
  const mode = String(value || 'selectable')
    .trim()
    .toLowerCase();
  if (!ADAPTIVE_WARRANT_CHALLENGE_RESISTANCE_MODES.includes(mode)) {
    throw new Error(
      `TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE must be one of ${ADAPTIVE_WARRANT_CHALLENGE_RESISTANCE_MODES.join('|')}, got "${mode}"`,
    );
  }
  return mode === 'selectable';
}

const CONTRACT_SUCCESSOR_STANCES = Object.freeze({
  answer_accountably: 'plain',
  clarify_distinction: 'precise',
  clarify_term: 'plain',
  ground_in_material: 'precise',
  receive_vulnerability: 'warm',
  stage_next_step: 'precise',
});

export function buildAdaptiveWarrantObligationDirective(publicObligation = null) {
  const blockingObligation = publicObligation?.blocking_obligation || null;
  if (!blockingObligation) return null;
  return {
    obligation_id: blockingObligation.id,
    target: structuredClone(blockingObligation.target),
    acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
  };
}

/**
 * Recommend a repair policy for a warranted decision point.
 *
 * Inputs mirror the warrant shadow's decision record:
 *  - signal: decision-time learner signal ({primary, labels})
 *  - warrantBasis: the warrant's stated ground (immediate:…, accumulated:…, register_escalation:…)
 *  - divergence: typed divergence rows [{dimension, interpretation}]
 *  - strategyInForce: the action family currently held
 *  - deferenceSustained: true when the learner's recent turns are permission-framed deferrals
 *  - actionContract: typed expected-uptake outcome, including its licensed successor
 *
 * Returns {family, rationale, registerAdvice} or null when no revision is
 * warranted (callers should not ask for a policy without a warrant).
 */
export function recommendRepairPolicy({
  signal = null,
  warrantBasis = 'none',
  divergence = [],
  strategyInForce = null,
  deferenceSustained = false,
  actionContract = null,
  publicObligation = null,
  inquiryCompletion = null,
  proposedActionFamily = null,
  challengeResistanceSelectable = resolveAdaptiveWarrantChallengeResistanceSelectable(),
} = {}) {
  if (warrantBasis === 'none' || warrantBasis === 'masked_by_engaged_analytic') return null;
  const primary = signal?.primary || 'neutral';
  const conceptualStall = divergence.some((row) => row.dimension === 'conceptual' && row.interpretation === 'stalled');

  const blockingObligation = publicObligation?.blocking_obligation || null;
  if (warrantBasis.startsWith('public_obligation_') && blockingObligation) {
    return policy(
      'answer_accountably',
      `supply or validly defer ${blockingObligation.id}: ${blockingObligation.target.kind}`,
      {
        stanceHint: 'precise',
        decisionKind: 'public_obligation_fulfilment',
        review: 'response_level_fulfilment',
        obligationDirective: buildAdaptiveWarrantObligationDirective(publicObligation),
      },
    );
  }

  if (warrantBasis.startsWith('inquiry_complete:') && inquiryCompletion?.status === 'complete') {
    return policy('close_inquiry', `whole-inquiry terminal condition: ${inquiryCompletion.basis}`, {
      stanceHint: 'precise',
      decisionKind: 'terminal_transition',
    });
  }

  if (warrantBasis.startsWith('inquiry_incomplete_candidate:') && proposedActionFamily === 'close_inquiry') {
    const checks = inquiryCompletion?.checks || {};
    if (
      checks.answer_entailed_unasserted === true &&
      checks.release_scope_exhausted === true &&
      Number(checks.open_public_obligation_count || 0) === 0
    ) {
      return policy(
        'compress_sayback',
        'closure is premature until the learner makes the grounded terminal assertion',
        {
          stanceHint: 'precise',
          decisionKind: 'candidate_safety_override',
          review: 'current_candidate_override',
        },
      );
    }
    const reanchor = checks.released_evidence_integrated === false || Number(checks.active_dropped_fact_count || 0) > 0;
    return policy(
      reanchor ? 'reanchor_public_evidence' : 'stage_next_step',
      reanchor
        ? 'closure is unsafe while already-public evidence is unintegrated or has dropped from the active record'
        : 'closure is unsafe while the authored release scope is unknown or still contains licensed evidence',
      {
        stanceHint: reanchor ? 'warm' : 'precise',
        decisionKind: 'candidate_safety_override',
        review: 'current_candidate_override',
      },
    );
  }

  const contractSuccessor = actionContract?.transition?.recommended_action_family || null;
  if (warrantBasis.startsWith('contract_') && actionContract?.transition?.revision_warranted && contractSuccessor) {
    return policy(contractSuccessor, `action-family contract ${actionContract.status}: ${actionContract.reason}`, {
      stanceHint: CONTRACT_SUCCESSOR_STANCES[contractSuccessor] || 'precise',
    });
  }

  // Explicit repair request: the learner asked for the explanation itself to
  // be fixed. Catalogue: repair_explanation — "Restate the current tutor
  // explanation in plain language without advancing the proof or releasing
  // another clue."
  if (primary === 'repair_request') {
    return policy('repair_explanation', 'learner explicitly asked for the explanation to be repaired', {
      stanceHint: 'plain',
    });
  }

  // Stall after engagement: the thread slipped. Catalogue:
  // reanchor_public_evidence — "Restage one previously public clue so a
  // slipped reasoning link can be rebuilt without testing or shaming memory."
  if (primary === 'stall') {
    return policy('reanchor_public_evidence', 'learner stalled; restage a public clue to rebuild the slipped link', {
      stanceHint: 'warm',
    });
  }

  // Escalated register complaints: the relationship channel is failing even if
  // the proof content is right. Repair the explanation register-first.
  if (warrantBasis.startsWith('register_escalation')) {
    return policy('repair_explanation', 'repeated register complaints; restate plainly before any further proof move', {
      stanceHint: 'plain',
      registerRevision: true,
    });
  }

  // Sustained permission-framed deference with a stalled record. Catalogue:
  // challenge_resistance — "Interrupt rote compliance, answer-seeking, or low
  // agency while preserving a repair path."
  if (challengeResistanceSelectable && (deferenceSustained || primary === 'low_agency_deferral')) {
    return policy('challenge_resistance', 'sustained permission-seeking with no record growth; hand agency back', {
      stanceHint: 'precise',
    });
  }

  // Accumulated conceptual stall with no sharper signal: restage public
  // evidence rather than pressing forward.
  if (conceptualStall) {
    return policy('reanchor_public_evidence', 'record not growing under the held strategy; restage public evidence', {
      stanceHint: 'warm',
    });
  }

  // Accumulated interactional trouble only (uptake/repetition): expose the
  // next public step instead of repeating the current one. Catalogue:
  // stage_next_step — "Expose the next public premise, clue, or inference
  // step without doing it for the learner."
  return policy('stage_next_step', 'interactional trouble without conceptual stall; move to the next public step', {
    stanceHint: 'precise',
  });

  function policy(
    family,
    rationale,
    {
      stanceHint = null,
      registerRevision = false,
      obligationDirective = null,
      decisionKind = 'pedagogical_commitment_transition',
      review = null,
    } = {},
  ) {
    return {
      schema: ADAPTIVE_WARRANT_POLICY_SCHEMA,
      family,
      decision_kind: decisionKind,
      review: review || (strategyInForce === family ? 'persist_with_adjustment' : 'switch'),
      from_family: strategyInForce,
      rationale,
      stance_hint: stanceHint,
      register_revision: registerRevision,
      obligation_directive: obligationDirective,
    };
  }
}
