import { getReflexiveVariant } from './reflexiveVariants.js';

export function initialReflexiveMemory() {
  return buildInitialReflexiveMemory('standard');
}

export function buildInitialReflexiveMemory(variantId = 'standard') {
  const variant = getReflexiveVariant(variantId);
  return {
    variant: variant.id,
    ...structuredClone(variant.memoryFields),
  };
}

export function buildReflexiveEgoDraftPrompt({
  scenario,
  turn,
  dialogueHistory,
  evidence,
  relation,
  policy,
  mastery,
  persona,
  reflexiveMemory,
  reflexiveVariant = 'standard',
}) {
  const variant = getReflexiveVariant(reflexiveVariant);
  return `You are the tutor Ego in a reflexive multi-agent tutoring controller.

Do not edit files. Return only JSON:
{
  "draft_message": "learner-facing draft, 1-4 sentences",
  "intention": "what this draft is trying to do",
  "predicted_learner_response": "what learner evidence you expect next"
}

Variant: ${variant.label}

The Ego is the actor. Draft a plausible learner-facing message from the selected policy, persona, dialogue history, and learner evidence. You do not see the full Superego repair contract at this stage. Let your draft be a sincere first pass rather than a perfect final answer.

If the current state includes an active or escalated challengeState, your draft should visibly change strategy from the prior tutor move instead of repeating the same abstract prompt.

Variant-specific Ego directive:
${variant.egoDraftDirective}

Scenario:
${JSON.stringify({
  id: scenario.id,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Dialogue history:
${JSON.stringify(dialogueHistory, null, 2)}

Current turn:
${JSON.stringify({
  event_id: turn.eventId,
  learner: turn.learner,
  evidence: compactEvidence(evidence),
  relation,
  selected_policy: {
    selectedPolicy: policy.selectedPolicy,
    reason: policy.reason,
    transferGate: policy.transferGate,
  },
  mastery: compactMastery(mastery),
  persona,
  reflexiveMemory,
  reflexiveVariant,
}, null, 2)}
`;
}

export function buildReflexiveSuperegoPrompt({
  scenario,
  turn,
  dialogueHistory,
  evidence,
  relation,
  policy,
  mastery,
  persona,
  reflexiveMemory,
  egoDraft,
  reflexiveVariant = 'standard',
}) {
  const variant = getReflexiveVariant(reflexiveVariant);
  return `You are the tutor Superego in a reflexive multi-agent tutoring controller.

Do not edit files. You do not speak to the learner. Return only JSON:
{
  "critique": "specific critique of the Ego draft",
  "adaptation_risk": "${variant.riskVocabulary.join(' | ')}",
  "required_revision": "what the Ego must change before final output",
  "memory_update": {
    "currentFocus": "focus for the next turn",
    "addCritique": "short durable critique to carry forward",
    "resolvedCritique": "critique resolved by this revision, or empty",
    "psychodynamicHypothesis": "durable hypothesis tied to visible evidence, or empty",
    "transference": "visible tutor/learner relational pattern, or empty",
    "repairDebt": "unresolved repair debt, or empty",
    "sharedGround": "new shared understanding, or empty",
    "unrecognizedClaim": "learner claim still not recognized, or empty"
  }
}

Your job is not to be nice. Challenge the Ego when its draft fails the adaptive chain. Apply the Drama Machine/Geist pattern: the Superego is a backstage critic that creates useful internal conflict, not another tutor voice.

Variant: ${variant.label}

Variant-specific Superego directive:
${variant.superegoDirective}

Variant-specific memory directive:
${variant.memoryDirective}

Check these in order:
1. Does the draft answer the learner's actual evidence, not just the topic?
2. If outcomeGate.status is repair_required, does the draft repair the named misconception before transfer?
3. Does the draft satisfy actionTemplate.mustDo and avoid actionTemplate.mustAvoid?
4. Does it ask for observable learner work that can open the gate?
5. Does it co-construct the repair, or does it over-explain the answer before the learner gets a chance to reason?
6. Does it preserve continuity with prior critiques in reflexiveMemory?
7. If selected_policy.challengeDirective exists, does it change strategy after resistance/forgetfulness/reversion, use the required concrete cue, and avoid repeating the same abstract question?
8. If this is a transfer_challenge or transfer_repair, does it use the transfer case named in actionTemplate.messageFrame rather than inventing an unrelated example?
9. If transferGate.status says transfer is still needed, does the draft elicit learner-owned transfer instead of summarizing?

Scenario:
${JSON.stringify({
  id: scenario.id,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Dialogue history:
${JSON.stringify(dialogueHistory, null, 2)}

Current state:
${JSON.stringify({
  event_id: turn.eventId,
  learner: turn.learner,
  evidence,
  relation,
  selected_policy: policy,
  mastery: compactMastery(mastery),
  persona,
  reflexiveMemory,
  reflexiveVariant,
  egoDraft,
}, null, 2)}
`;
}

export function buildReflexiveEgoRevisionPrompt({
  scenario,
  turn,
  dialogueHistory,
  evidence,
  relation,
  policy,
  mastery,
  persona,
  reflexiveMemory,
  egoDraft,
  superegoCritique,
  reflexiveVariant = 'standard',
}) {
  const variant = getReflexiveVariant(reflexiveVariant);
  return `You are the tutor Ego revising after Superego critique.

Do not edit files. Return only JSON:
{
  "tutor_message": "final learner-facing message, 1-4 sentences",
  "revision_note": "what changed because of the Superego critique",
  "reflexive_adaptation": "how this turn adapts to prior learner evidence and prior critique"
}

The final message must not mention Ego, Superego, internal critique, policy labels, gates, or hidden state. It should sound like one coherent tutor.

Binding constraints:
- If selected_policy.actionTemplate exists, satisfy its mustDo items and avoid its mustAvoid items.
- If selected_policy.selectedPolicy is transfer_challenge or transfer_repair and selected_policy.actionTemplate.messageFrame names a transfer case, use that exact transfer case; do not invent a new example.
- If selected_policy.challengeDirective exists, use its concrete cue and require learner-owned repair work; do not repeat the same abstract question after a hard-mode challenge.
- If selected_policy.outcomeGate.status is repair_required, repair the misconception and ask for observable learner work before transfer.
- If selected_policy.transferGate.status is needs_learner_transfer or missing_at_final_turn, ask for learner-owned transfer rather than summarizing or closing.
- If selected_policy.selectedPolicy is transfer_repair, revise toward a narrow one-case transfer repair with explicit missing boundary markers, not another broad prompt.
- If selected_policy.selectedPolicy is summarize_and_check and selected_policy.transferGate.status is observed, close the loop rather than opening a new unanswered task: name the learner-owned rule and the next self-check.
- Prefer a discriminating contrast plus a learner question over a completed explanation.
- Do not state the key answer before the learner has a chance to decide, unless the prior dialogue already shows the learner made that decision.
- Preserve productive struggle; do not simply give a polished mini-lecture.
- Address the Superego's required_revision materially, not cosmetically.

Variant: ${variant.label}

Variant-specific revision directive:
${variant.revisionDirective}

Scenario:
${JSON.stringify({
  id: scenario.id,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Dialogue history:
${JSON.stringify(dialogueHistory, null, 2)}

Current state:
${JSON.stringify({
  event_id: turn.eventId,
  learner: turn.learner,
  evidence,
  relation,
  selected_policy: policy,
  mastery: compactMastery(mastery),
  persona,
  reflexiveMemory,
  reflexiveVariant,
  egoDraft,
  superegoCritique,
}, null, 2)}
`;
}

export function dryRunReflexiveTurn({ fallback, policy, reflexiveMemory, reflexiveVariant = 'standard' }) {
  const variant = getReflexiveVariant(reflexiveVariant);
  const challengeDirective = policy.challengeDirective || '';
  const critique = challengeDirective
    ? {
        critique: 'DRY RUN: Ego must change strategy after the hard-mode learner challenge.',
        adaptation_risk: 'abstract_repair_loop',
        required_revision: challengeDirective,
        memory_update: {
          currentFocus: 'Resolve the active learner challenge with a concrete cue and observable learner work.',
          addCritique: 'Blocked repeated abstract repair after learner resistance or forgetfulness.',
          resolvedCritique: '',
          psychodynamicHypothesis: variant.id === 'psychodynamic' ? 'Tutor may collude with resistance by asking the same abstract question instead of changing the repair frame.' : '',
          transference: '',
          repairDebt: 'Use the challenge directive before transfer.',
          sharedGround: '',
          unrecognizedClaim: '',
        },
      }
    : policy.outcomeGate?.status === 'repair_required'
    ? {
        critique: 'DRY RUN: Ego must repair the active misconception before transfer.',
        adaptation_risk: 'missed_misconception',
        required_revision: policy.actionTemplate?.messageFrame || 'Use the repair template and ask for observable learner work.',
        memory_update: {
          currentFocus: 'Verify misconception repair before transfer.',
          addCritique: 'Blocked premature transfer until repair evidence appears.',
          resolvedCritique: '',
          psychodynamicHypothesis: variant.id === 'psychodynamic' ? 'Tutor may collude with learner compliance unless it asks for observable work.' : '',
          transference: '',
          repairDebt: 'Verify repair before transfer.',
          sharedGround: '',
          unrecognizedClaim: '',
        },
      }
    : policy.selectedPolicy === 'transfer_repair'
    ? {
        critique: 'DRY RUN: Ego must convert the failed broad transfer into a narrow one-case transfer repair.',
        adaptation_risk: 'failed_transfer_loop',
        required_revision: policy.actionTemplate?.messageFrame || 'Ask one narrow transfer repair question with explicit boundary markers.',
        memory_update: {
          currentFocus: 'Recover missing learner-owned transfer with one narrow case.',
          addCritique: 'Broad transfer prompt did not yield observable transfer; require specific markers next.',
          resolvedCritique: '',
          psychodynamicHypothesis: variant.id === 'psychodynamic' ? 'Tutor may collude with fluent but incomplete learner compliance unless it insists on a transfer boundary.' : '',
          transference: '',
          repairDebt: 'Verify learner-owned transfer before summary.',
          sharedGround: '',
          unrecognizedClaim: '',
        },
      }
    : {
        critique: 'DRY RUN: Ego can proceed but should preserve the repair trace.',
        adaptation_risk: 'none',
        required_revision: 'Keep the next move tied to visible learner evidence.',
        memory_update: {
          currentFocus: 'Preserve transfer evidence and avoid generic summary.',
          addCritique: '',
          resolvedCritique: 'Misconception repair gate opened.',
          psychodynamicHypothesis: '',
          transference: '',
          repairDebt: '',
          sharedGround: 'Learner has supplied repair evidence.',
          unrecognizedClaim: '',
        },
      };
  return {
    egoDraft: {
      draft_message: fallback,
      intention: `DRY RUN Ego draft for ${policy.selectedPolicy}.`,
      predicted_learner_response: 'DRY RUN learner signal.',
    },
    superegoCritique: critique,
    egoRevision: {
      tutor_message: fallback,
      revision_note: 'DRY RUN revision uses deterministic repair template.',
      reflexive_adaptation: `DRY RUN memory focus: ${reflexiveMemory.currentFocus}`,
    },
  };
}

export function updateReflexiveMemory(memory, superegoCritique, egoRevision) {
  const update = superegoCritique?.memory_update || {};
  const priorCritiques = [...(memory.priorCritiques || [])];
  const resolvedCritiques = [...(memory.resolvedCritiques || [])];
  const psychodynamicHypotheses = [...(memory.psychodynamicHypotheses || [])];
  const transferences = [...(memory.transferences || [])];
  const repairDebts = [...(memory.repairDebts || [])];
  const sharedGround = [...(memory.sharedGround || [])];
  const unrecognizedClaims = [...(memory.unrecognizedClaims || [])];
  if (update.addCritique) priorCritiques.push(update.addCritique);
  if (update.resolvedCritique) resolvedCritiques.push(update.resolvedCritique);
  if (update.psychodynamicHypothesis) psychodynamicHypotheses.push(update.psychodynamicHypothesis);
  if (update.transference) transferences.push(update.transference);
  if (update.repairDebt) repairDebts.push(update.repairDebt);
  if (update.sharedGround) sharedGround.push(update.sharedGround);
  if (update.unrecognizedClaim) unrecognizedClaims.push(update.unrecognizedClaim);
  return {
    ...memory,
    priorCritiques: priorCritiques.slice(-4),
    resolvedCritiques: resolvedCritiques.slice(-4),
    psychodynamicHypotheses: psychodynamicHypotheses.slice(-4),
    transferences: transferences.slice(-4),
    repairDebts: repairDebts.slice(-4),
    sharedGround: sharedGround.slice(-4),
    unrecognizedClaims: unrecognizedClaims.slice(-4),
    currentFocus: update.currentFocus || egoRevision?.reflexive_adaptation || memory.currentFocus,
  };
}

function compactEvidence(evidence) {
  return {
    quote: evidence.quote,
    outcome: evidence.outcome,
    affect: evidence.affect,
    stance: evidence.stance,
    kcCandidates: evidence.kcCandidates,
    domainDiagnosis: evidence.domainDiagnosis ? {
      misconceptionId: evidence.domainDiagnosis.misconceptionId,
      repairNeeded: evidence.domainDiagnosis.repairNeeded,
      repaired: evidence.domainDiagnosis.repaired,
    } : null,
  };
}

function compactMastery(mastery) {
  return Object.fromEntries(
    Object.entries(mastery || {}).map(([kc, value]) => [
      kc,
      {
        p_mastery: Number(value.pMastery.toFixed(3)),
        observations: value.observations,
        last_outcome: value.lastOutcome,
      },
    ]),
  );
}
