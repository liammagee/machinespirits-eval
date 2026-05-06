// Deterministic mock LLM responses for the smoke test.
//
// Real-provider hookup will replace these with calls through the existing
// provider routing (services/evaluationRunner.js). Keeping the swap point
// behind a single interface (`callRole`) means the graph nodes don't change.

const fixtures = {
  tutorEgoInitial: ({ learnerLastMessage, learnerProfile }) => {
    const c = learnerProfile.confidence;
    const sig = learnerProfile.agencySignal;
    if (sig === 'resistant') return { policyAction: 'scope_test', text: 'Your objection is doing real work. Try this case: imagine the same setup but with X negated — what would your answer be?' };
    if (sig === 'compliant' && c < 0.5) return { policyAction: 'lower_cognitive_load', text: `Let's slow this down. What part is hardest to hold in mind right now?` };
    if (sig === 'questioning') return { policyAction: 'mirror_and_extend', text: 'Good question — let me push it one step further. If we accept the premise, what does it commit us to?' };
    return { policyAction: 'ask_diagnostic_question', text: 'What would change in your answer if the input were different?' };
  },

  tutorSuperego: ({ tutorInternal, learnerProfile }) => {
    const draft = tutorInternal.egoDraft;
    if (!draft) return { needsRevision: false, feedback: 'no draft to review' };
    if (learnerProfile.agencySignal === 'resistant' && /let me explain/i.test(draft)) {
      return { needsRevision: true, feedback: 'Drafted explanation despite resistance signal; switch to scope_test.' };
    }
    if (learnerProfile.confidence < 0.3 && draft.length > 400) {
      return { needsRevision: true, feedback: 'Response too long for low-confidence learner; shorten.' };
    }
    return { needsRevision: false, feedback: 'looks acceptable' };
  },

  tutorEgoRevision: ({ tutorInternal }) => {
    const previous = tutorInternal.egoDraft;
    return { text: previous.replace(/let me explain/i, 'let me ask you something instead'), policyAction: 'scope_test' };
  },

  // Stricter second-pass than the superego: re-checks the just-picked
  // policyAction against the same contraindications encoded in
  // POLICY_ACTION_DETAILS for that action. The mock fires on a small set of
  // obvious mismatches so the smoke exercises both branches; the real-LLM
  // version reads the full action detail block out of the YAML.
  tutorValidator: ({ policyAction, tutorDraft, learnerProfile }) => {
    const sig = learnerProfile?.agencySignal;
    const conf = learnerProfile?.confidence ?? 0.5;
    if ((policyAction === 'give_worked_example' || policyAction === 'lower_cognitive_load')
        && sig === 'resistant') {
      return { needsRevision: true, feedback: `policy ${policyAction} contraindicated for resistant learner` };
    }
    if (policyAction === 'withhold_answer' && /the answer is/i.test(tutorDraft || '')) {
      return { needsRevision: true, feedback: 'withhold_answer chosen but draft hands the answer over' };
    }
    if (policyAction === 'mirror_and_extend' && conf < 0.3) {
      return { needsRevision: true, feedback: 'mirror_and_extend contraindicated at very low confidence' };
    }
    return { needsRevision: false, feedback: 'policy fits profile' };
  },

  // Bilateral-ToM mock: synthesises the paired LBM bottleneck text, the
  // second-order belief about the learner's perception of the tutor, and four
  // FANToM-style probes. Heuristic — derives from the current learnerProfile
  // (so the field actually moves turn-over-turn under mock) and the dialogue
  // length (for the answerability/infoaccess turn-index lists).
  tutorTomTracker: ({ learnerProfile, dialogue, turn }) => {
    const sig = learnerProfile?.agencySignal || 'unknown';
    const conf = typeof learnerProfile?.confidence === 'number' ? learnerProfile.confidence : 0.5;
    const misconception = learnerProfile?.misconceptions?.[0] || '';
    const perceivedRole = sig === 'resistant' ? 'adversary'
      : sig === 'compliant' ? 'authority'
      : sig === 'questioning' ? 'thinking-partner'
      : 'unknown';
    const tutorTurnsSeen = Array.isArray(dialogue)
      ? dialogue.filter((m) => m.role === 'tutor').length
      : 0;
    return {
      summaryText: `Tutor's current belief: learner is ${sig} (confidence ~${conf.toFixed(2)})${misconception ? `, suspected misconception: "${misconception}"` : ''}.`,
      hypothesizedLearnerPerceptionOfTutor: {
        summaryText: sig === 'resistant'
          ? 'Learner likely sees the tutor as pushing them toward an answer they disagree with.'
          : sig === 'compliant'
            ? 'Learner likely defers to the tutor as the authority on the topic.'
            : sig === 'questioning'
              ? 'Learner likely sees the tutor as a thinking partner exploring the question with them.'
              : 'Learner has not yet formed a stable read of the tutor.',
        jsonState: { perceivedRole, tutorTurnsSeen },
      },
      tomProbes: {
        belief_dist: misconception,
        belief_choice: sig,
        // Mock has no per-turn integration tracking; conservative prediction:
        // no unanswerable turns; learner has integrated all prior tutor turns.
        answerability_list: [],
        infoaccess_list: Array.from({ length: tutorTurnsSeen }, (_, i) => i),
      },
    };
  },

  learnerProfileUpdate: ({ learnerLastMessage, hidden, currentProfile, turn }) => {
    // The "real" version would be an LLM that reads the dialogue and emits
    // an updated structured profile. Mock heuristic: if the learner's text
    // mentions a contrast, mark them advanced; if affect tokens appear, drop
    // confidence.
    const text = learnerLastMessage || '';
    const profile = { ...currentProfile, updatedAtTurn: turn };
    if (/but|however|except|unless|counter/i.test(text)) {
      profile.agencySignal = 'questioning';
      profile.confidence = Math.min(1, currentProfile.confidence + 0.1);
      profile.lastEvidence = `learner introduced contrast at turn ${turn}`;
    }
    if (/idk|don't get|confused|lost/i.test(text)) {
      profile.agencySignal = 'compliant';
      profile.confidence = Math.max(0, currentProfile.confidence - 0.15);
      profile.lastEvidence = `learner signaled confusion at turn ${turn}`;
    }
    if (turn === hidden.triggerTurn && hidden.triggerSignal) {
      profile.agencySignal = 'resistant';
      profile.confidence = Math.min(1, currentProfile.confidence + 0.05);
      profile.lastEvidence = `trigger fired at turn ${turn}: ${hidden.triggerSignal}`;
    }
    return profile;
  },

  learnerTurn: ({ tutorLastMessage, hidden, turn }) => {
    if (turn === hidden.triggerTurn) return hidden.triggerSignal || 'I have a different read on that.';
    if (/ask you something/i.test(tutorLastMessage || '')) return 'OK, let me try.';
    if (hidden.actualSophistication === 'advanced') return 'But that only works if we assume X — what about the case where not-X?';
    return 'Hmm, can you explain more?';
  },
};

export async function callRole(role, payload) {
  if (!fixtures[role]) throw new Error(`mockLLM: no fixture for role ${role}`);
  return fixtures[role](payload);
}
