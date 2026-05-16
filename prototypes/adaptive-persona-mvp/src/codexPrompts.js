export function buildTutorPrompt({
  scenario,
  turn,
  dialogueHistory,
  evidence,
  relation,
  policy,
  mastery,
  persona,
}) {
  const compactMastery = Object.fromEntries(
    Object.entries(mastery || {}).map(([kc, value]) => [
      kc,
      {
        p_mastery: Number(value.pMastery.toFixed(3)),
        observations: value.observations,
        last_outcome: value.lastOutcome,
      },
    ]),
  );

  return `You are playing the learner-facing tutor in an adaptive tutoring MVP.

Do not edit files. Do not explain your reasoning outside JSON.

The controller has already selected the pedagogical state and policy. Your job is to write the actual tutor message. You may choose wording, but you must obey the selected policy and persona. Do not reveal hidden labels, policy names, mastery probabilities, or internal state to the learner.

If selected_policy.actionTemplate is present, treat it as binding:
- Satisfy every mustDo item in learner-facing language.
- Avoid every mustAvoid item.
- Use the messageFrame as a contrastive test, not as a mini-lecture script.
- Ask for the successCheck before transfer or summary.
- If the selected policy is a transfer_challenge and the messageFrame names a transfer case, use that exact transfer case. Do not invent a different example.

If selected_policy.challengeDirective is present, it is a hard adaptation constraint:
- Do not repeat the same abstract question after the learner has resisted, forgotten, or reverted.
- Use the concrete retrieval cue or discriminating case named in the directive.
- Make the learner produce the missing comparison, audit, confounder, or memory check in their own words.
- Keep the tutor move short enough that the learner still has the central work to do.

If selected_policy.outcomeGate.status is "repair_required", do not advance to transfer, do not summarize as if mastery is established, and do not give generic encouragement. Repair the named misconception by setting up a discriminating contrast and asking for observable learner work. Prefer letting the learner make the key comparison, causal diagnosis, or audit choice before you state it for them.

Dialogue quality constraint:
- Keep the tutor move co-constructive. Do not simply deliver the corrected rule.
- A strong repair move should usually acknowledge the learner's current rule as testable, set up a precise contrast, and ask the learner to decide or explain.
- Use concise setup plus a question; avoid solving the whole step in the first sentence.

Return exactly this JSON shape:
{
  "tutor_message": "learner-facing message, 1-4 sentences",
  "policy_alignment": "one sentence explaining how the message enacts the selected policy",
  "adaptation_observation": "one sentence naming what changed because of the learner evidence"
}

Scenario:
${JSON.stringify({
  id: scenario.id,
  name: scenario.name,
  discipline: scenario.discipline,
  objective: scenario.objective,
}, null, 2)}

Dialogue history:
${JSON.stringify(dialogueHistory, null, 2)}

Current turn:
${JSON.stringify({
  event_id: turn.eventId,
  learner: turn.learner,
  evidence,
  relation,
  selected_policy: policy,
  mastery: compactMastery,
  persona,
}, null, 2)}
`;
}

export function buildObserverPrompt({ trace, rubric }) {
  const compactTrace = {
    scenarioId: trace.scenarioId,
    scenarioName: trace.scenarioName,
    objective: trace.objective,
    deterministicEvaluation: trace.evaluation,
    counterfactualComparison: trace.counterfactualComparison,
    turns: trace.turns.map((turn) => ({
      eventId: turn.eventId,
      learner: turn.learner,
      evidence: turn.evidence,
      relation: turn.relation,
      policy: turn.policy,
      expectedPolicy: turn.expectedPolicy,
      masteryDelta: turn.masteryDelta,
      personaDelta: turn.personaDelta,
      tutorMessage: turn.tutorMessage,
      codexPolicyAlignment: turn.codexTutor?.policy_alignment || null,
      codexAdaptationObservation: turn.codexTutor?.adaptation_observation || null,
    })),
    counterfactual: trace.counterfactual ? {
      turns: trace.counterfactual.turns.map((turn) => ({
        eventId: turn.eventId,
        learner: turn.learner,
        policy: turn.policy,
        masteryDelta: turn.masteryDelta,
        personaDelta: turn.personaDelta,
        tutorMessage: turn.tutorMessage,
      })),
    } : null,
  };

  return `You are an adaptation observer for an adaptive tutoring MVP.

Do not edit files. Do not score surface personalization unless the trace shows the full chain:
learner evidence -> mastery/relation state -> policy -> persona -> tutor move.

Use the provided rubric, but be stricter than a style judge. A fluent tutor message is not adaptation unless state and policy changed for a learner-evidence reason.

Return exactly this JSON shape:
{
  "scores": {
    "evidence_bound_state_update": 1,
    "knowledge_tracing_signal": 1,
    "policy_evidence_fit": 1,
    "persona_evolution_control": 1,
    "recognition_repair": 1,
    "counterfactual_sensitivity": 1,
    "trajectory_gain": 1
  },
  "weighted_score": 0,
  "verdict": "short verdict",
  "observed_adaptation_chain": "one paragraph",
  "failure_modes": []
}

Rubric:
${JSON.stringify(rubric, null, 2)}

Trace:
${JSON.stringify(compactTrace, null, 2)}
`;
}

export function buildDryRunTutorResponse(policy) {
  return {
    tutor_message: null,
    policy_alignment: `DRY RUN: would call Codex to enact ${policy.selectedPolicy}.`,
    adaptation_observation: 'DRY RUN: no LLM tutor message generated.',
  };
}

export function buildDryRunObserverResponse() {
  return {
    scores: null,
    weighted_score: null,
    verdict: 'DRY RUN: would call Codex to observe adaptation.',
    observed_adaptation_chain: 'DRY RUN only.',
    failure_modes: [],
  };
}
