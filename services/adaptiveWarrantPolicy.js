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

export const ADAPTIVE_WARRANT_POLICY_SCHEMA = 'machinespirits.adaptation-refinement.repair-policy.v1';

const CONTRACT_SUCCESSOR_STANCES = Object.freeze({
  answer_accountably: 'plain',
  clarify_distinction: 'precise',
  clarify_term: 'plain',
  ground_in_material: 'precise',
  receive_vulnerability: 'warm',
  stage_next_step: 'precise',
});

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
} = {}) {
  if (warrantBasis === 'none' || warrantBasis === 'masked_by_engaged_analytic') return null;
  const primary = signal?.primary || 'neutral';
  const conceptualStall = divergence.some((row) => row.dimension === 'conceptual' && row.interpretation === 'stalled');

  const contractSuccessor = actionContract?.transition?.recommended_action_family || null;
  if (
    warrantBasis.startsWith('contract_') &&
    actionContract?.transition?.revision_warranted &&
    contractSuccessor
  ) {
    return policy(
      contractSuccessor,
      `action-family contract ${actionContract.status}: ${actionContract.reason}`,
      { stanceHint: CONTRACT_SUCCESSOR_STANCES[contractSuccessor] || 'precise' },
    );
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
  if (deferenceSustained || primary === 'low_agency_deferral') {
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

  function policy(family, rationale, { stanceHint = null, registerRevision = false } = {}) {
    return {
      schema: ADAPTIVE_WARRANT_POLICY_SCHEMA,
      family,
      review: strategyInForce === family ? 'persist_with_adjustment' : 'switch',
      from_family: strategyInForce,
      rationale,
      stance_hint: stanceHint,
      register_revision: registerRevision,
    };
  }
}
