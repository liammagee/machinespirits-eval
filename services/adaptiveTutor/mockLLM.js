// Deterministic mock LLM responses for the smoke test.
//
// Real-provider hookup will replace these with calls through the existing
// provider routing (services/evaluationRunner.js). Keeping the swap point
// behind a single interface (`callRole`) means the graph nodes don't change.

const fixtures = {
  tutorEgoInitial: ({ learnerProfile }) => {
    const c = learnerProfile.confidence;
    const sig = learnerProfile.agencySignal;
    if (sig === 'resistant')
      return {
        policyAction: 'scope_test',
        text: 'Your objection is doing real work. Try this case: imagine the same setup but with X negated — what would your answer be?',
      };
    if (sig === 'compliant' && c < 0.5)
      return {
        policyAction: 'lower_cognitive_load',
        text: `Let's slow this down. What part is hardest to hold in mind right now?`,
      };
    if (sig === 'questioning')
      return {
        policyAction: 'mirror_and_extend',
        text: 'Good question — let me push it one step further. If we accept the premise, what does it commit us to?',
      };
    return {
      policyAction: 'ask_diagnostic_question',
      text: 'What would change in your answer if the input were different?',
    };
  },

  // Mock for cell_116. Same heuristic as tutorEgoInitial — under mock there
  // is no actual prompt in play, so the named-patterns variant is
  // distinguishable only at real-LLM time. The mock delegates so smoke
  // tests stay deterministic.
  tutorEgoInitialNamedPatterns: ({ learnerProfile }) => {
    const c = learnerProfile.confidence;
    const sig = learnerProfile.agencySignal;
    if (sig === 'resistant')
      return {
        policyAction: 'scope_test',
        text: 'Your objection is doing real work. Try this case: imagine the same setup but with X negated — what would your answer be?',
      };
    if (sig === 'compliant' && c < 0.5)
      return {
        policyAction: 'lower_cognitive_load',
        text: `Let's slow this down. What part is hardest to hold in mind right now?`,
      };
    if (sig === 'questioning')
      return {
        policyAction: 'mirror_and_extend',
        text: 'Good question — let me push it one step further. If we accept the premise, what does it commit us to?',
      };
    return {
      policyAction: 'ask_diagnostic_question',
      text: 'What would change in your answer if the input were different?',
    };
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
    return {
      text: previous.replace(/let me explain/i, 'let me ask you something instead'),
      policyAction: 'scope_test',
    };
  },

  // Stricter second-pass than the superego: re-checks the just-picked
  // policyAction against the same contraindications encoded in
  // POLICY_ACTION_DETAILS for that action. The mock fires on a small set of
  // obvious mismatches so the smoke exercises both branches; the real-LLM
  // version reads the full action detail block out of the YAML.
  tutorValidator: ({ policyAction, tutorDraft, learnerProfile }) => {
    const sig = learnerProfile?.agencySignal;
    const conf = learnerProfile?.confidence ?? 0.5;
    if ((policyAction === 'give_worked_example' || policyAction === 'lower_cognitive_load') && sig === 'resistant') {
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
  tutorTomTracker: ({ learnerProfile, dialogue }) => {
    const sig = learnerProfile?.agencySignal || 'unknown';
    const conf = typeof learnerProfile?.confidence === 'number' ? learnerProfile.confidence : 0.5;
    const misconception = learnerProfile?.misconceptions?.[0] || '';
    const perceivedRole =
      sig === 'resistant'
        ? 'adversary'
        : sig === 'compliant'
          ? 'authority'
          : sig === 'questioning'
            ? 'thinking-partner'
            : 'unknown';
    const tutorTurnsSeen = Array.isArray(dialogue) ? dialogue.filter((m) => m.role === 'tutor').length : 0;
    return {
      summaryText: `Tutor's current belief: learner is ${sig} (confidence ~${conf.toFixed(2)})${misconception ? `, suspected misconception: "${misconception}"` : ''}.`,
      hypothesizedLearnerPerceptionOfTutor: {
        summaryText:
          sig === 'resistant'
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

  // Mock id-author for cells 121/122. Returns the construction envelope shape
  // services/idDirectorEngine.js parseIdConstruction emits, so the graph node
  // and persistence layer behave identically under mock and real backends.
  // Heuristic: bend persona on the agencySignal in the bilateral_tom-enriched
  // learnerProfile so the mock exercises the both-arms-of-the-graph path.
  idAuthorPersona: ({ learnerProfile, previousPersona, turn }) => {
    const sig = learnerProfile?.agencySignal || 'unknown';
    const persona =
      sig === 'resistant'
        ? 'patient interlocutor; surface the disagreement, do not push'
        : sig === 'compliant'
          ? 'attentive but unsatisfied; probe whether agreement is real'
          : sig === 'questioning'
            ? 'collaborator; extend the question, do not collapse to an answer'
            : 'curious witness; ask one clarifying probe';
    const generated_prompt = [
      `You are a tutor. The learner's current stance reads as "${sig}". Adopt this voice for this turn: ${persona}.`,
      'Speak briefly. Do not lecture. End with a probe that the learner can answer in one or two sentences.',
      'Mock-mode persona — deterministic, derived from bilateral_tom learner state.',
    ].join(' ');
    return {
      generated_prompt,
      persona_delta: previousPersona === 'FIRST_TURN' ? 'INITIAL' : `bend toward ${sig}`,
      stage_directions: 'mock id author',
      reasoning: `mock-mode id author: agencySignal=${sig}, turn=${turn}`,
      parse_status: 'ok',
    };
  },

  // Mock tutor-ego executor for cell_121 (Variant A). Synthesizes a one-line
  // tutor message that reads as if it were following the id-authored persona,
  // and emits a defensible policyAction. Mirrors tutorEgoInitial's heuristic
  // so paired cell_121-vs-cell_115 mock smoke produces comparable traces.
  tutorEgoExecute: ({ learnerProfile }) => {
    const sig = learnerProfile?.agencySignal || 'unknown';
    const c = typeof learnerProfile?.confidence === 'number' ? learnerProfile.confidence : 0.5;
    if (sig === 'resistant')
      return {
        policyAction: 'scope_test',
        text: '(id-authored) Your pushback is doing real work — let me test the edge of it. If we accepted the opposite, what would change?',
      };
    if (sig === 'compliant' && c < 0.5)
      return {
        policyAction: 'lower_cognitive_load',
        text: '(id-authored) Slow it down. What part of the setup is hardest to hold in mind right now?',
      };
    if (sig === 'questioning')
      return {
        policyAction: 'mirror_and_extend',
        text: '(id-authored) Good question — push it one step. If the premise holds, what does it commit us to?',
      };
    return {
      policyAction: 'ask_diagnostic_question',
      text: '(id-authored) What would change in your answer if the input were different?',
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

  // A14 Stage 2a: deterministic evidence extractor mock. Emits one verbatim
  // entry (validated=true expected) plus, when the learner message contains
  // a paraphrasable marker, a second entry whose `quote` deliberately drops a
  // word so the graph's substring-match gate flips validated=false. That
  // exercises both branches of the gate from a single mock; the unit test in
  // services/__tests__/adaptiveExtractor.test.js asserts the resulting flags.
  //
  // No `obs_id` / `turn` / `created_by` / `validated` here — those are
  // bookkeeping the graph node fills in (matches the learnerProfileUpdate
  // pattern, which also leaves updatedAtTurn for the node).
  evidenceExtractor: ({ learnerLastMessage }) => {
    const msg = (learnerLastMessage || '').trim();
    if (!msg) return { evidence: [] };
    const head = msg.slice(0, Math.min(60, msg.length));
    const evidence = [{ quote: head, type: 'learner_self_report', kc_candidates: [] }];
    // Inject a clearly hallucinated quote (prefix with a sentinel character
    // that won't appear elsewhere in the dialogue) so the substring-match
    // gate flips validated=false on every turn where this fires. This
    // exercises the negative branch of the gate from a single mock; without
    // it, mock smokes would always produce 100% validated rates and the
    // gate's "reject" path would go untested. Real LLMs hallucinate by
    // paraphrasing, not by sentinel prefix; the gate sees both as misses.
    if (msg.length > 30) {
      evidence.push({ quote: `★fabricated★ ${head}`, type: 'tutor_inference', kc_candidates: [] });
    }
    return { evidence };
  },

  // Mock hypothesisUpdater (Stage 2b). Synthesises typed hypotheses from the
  // validated evidence ledger. Heuristic:
  //   ≥2 learner_question entries → "questioning_stance" hypothesis
  //   ≥2 learner_self_report (and <2 questions) → "low_confidence_signal"
  //   ≥1 learner_correction → "active_revision"
  // Mock emits with stable hypothesis_ids so the merge-by-id reducer
  // exercises revision-on-second-turn, not new-creation-on-every-turn. The
  // node fills created_at_turn / expires_after_turns / TTL bookkeeping —
  // mock stays focused on the LLM-shape output the real backend also emits.
  hypothesisUpdater: ({ validatedEvidence }) => {
    if (!Array.isArray(validatedEvidence) || validatedEvidence.length === 0) {
      return { hypotheses: [] };
    }
    const byType = validatedEvidence.reduce((acc, e) => {
      if (!acc[e.type]) acc[e.type] = [];
      acc[e.type].push(e.obs_id);
      return acc;
    }, {});
    const hypotheses = [];
    const qIds = byType.learner_question || [];
    const sIds = byType.learner_self_report || [];
    const cIds = byType.learner_correction || [];
    if (qIds.length >= 2) {
      hypotheses.push({
        hypothesis_id: 'hyp_questioning_stance',
        claim: 'The learner is in a questioning, probing stance toward the material.',
        confidence: Math.min(0.9, 0.4 + 0.15 * qIds.length),
        supporting_evidence: qIds,
        contradicting_evidence: [],
        status: qIds.length >= 4 ? 'validated' : 'tentative',
        next_validation_action: 'mirror_and_extend',
      });
    }
    if (sIds.length >= 2 && qIds.length < 2) {
      hypotheses.push({
        hypothesis_id: 'hyp_low_confidence_signal',
        claim: 'The learner is self-reporting confusion or low confidence.',
        confidence: Math.min(0.8, 0.4 + 0.1 * sIds.length),
        supporting_evidence: sIds,
        contradicting_evidence: [],
        status: 'tentative',
        next_validation_action: 'lower_cognitive_load',
      });
    }
    if (cIds.length >= 1) {
      hypotheses.push({
        hypothesis_id: 'hyp_active_revision',
        claim: 'The learner is actively revising or pushing back on tutor framing.',
        confidence: Math.min(0.85, 0.5 + 0.2 * cIds.length),
        supporting_evidence: cIds,
        contradicting_evidence: [],
        status: 'tentative',
        next_validation_action: 'scope_test',
      });
    }
    return { hypotheses };
  },

  // A14 Stage 3: groundingValidator mock. Deterministic retain/retire rule
  // exercises both promotion and retirement branches:
  //   - ≥3 supporting obs_ids and no contradicting evidence → promote to
  //     `validated` (a tentative claim has accumulated enough corroboration)
  //   - ≥1 contradicting obs_id AND confidence < 0.4 → retire to
  //     `contradicted` (new evidence undermines a weak claim)
  //   - else leave as-is (emit no decision; the merge-by-id reducer keeps
  //     the existing entry)
  // The thresholds match the conservative gate the real-LLM prompt asks for;
  // unit tests in services/__tests__/ pin the exact transition points. Mock
  // keeps determinism so cell_127's mock smoke produces the same trace on
  // every run.
  groundingValidator: ({ hypotheses }) => {
    const decisions = [];
    for (const h of hypotheses) {
      const supportCount = (h.supporting_evidence || []).length;
      const contradictCount = (h.contradicting_evidence || []).length;
      const conf = typeof h.confidence === 'number' ? h.confidence : 0.5;
      if (contradictCount >= 1 && conf < 0.4) {
        decisions.push({
          hypothesis_id: h.hypothesis_id,
          new_status: 'contradicted',
          reasoning: `mock: ${contradictCount} contradicting obs_ids with confidence ${conf.toFixed(2)} < 0.4`,
        });
      } else if (supportCount >= 3 && contradictCount === 0) {
        decisions.push({
          hypothesis_id: h.hypothesis_id,
          new_status: 'validated',
          reasoning: `mock: ${supportCount} supporting obs_ids, no contradiction`,
        });
      }
    }
    return { decisions };
  },

  // A16 (P2): deterministic adversarial-rewrite superego mock (§6.3.10).
  // Detects a frustration signal by string-matching the real dialogue —
  // mirrors the prototype's branch-blind triggerState heuristic, and never
  // consults a scenario answer key (the validity choice). The S0/S1
  // difference — the entire pre-registered decisive contrast — is visible
  // HERE and is provable under mock without any paid call: the stateless arm
  // (cumulative=false) re-derives the SAME flat directive every turn (no
  // memory); the cumulative arm escalates, explicitly chaining onto its
  // prior ledger depth. Under mock the ego ignores the rewritten prompt (no
  // real prompt in play — same posture as the id-director mock), so this
  // fixture proves WIRING + ledger statefulness, not behavioural conversion
  // (that needs the real-LLM P3 run).
  superegoRevise: ({ dialogue, turn, priorLedger, cumulative }) => {
    const blob = (dialogue || [])
      .map((m) => m.content || '')
      .join('\n')
      .toLowerCase();
    const frustrated =
      /\b(but|however|don'?t get|confused|lost|disagree|why should|i still|not following|stuck)\b/.test(blob);
    const signal = frustrated ? `learner pushback/confusion detected at turn ${turn}` : '';
    const priorCount = Array.isArray(priorLedger) ? priorLedger.length : 0;
    const directive =
      cumulative && priorCount > 0
        ? `escalate: building on ${priorCount} prior rewrite(s), sharpen the adaptation (cumulative step ${priorCount + 1})`
        : frustrated
          ? 'adapt: stop explaining, surface and address the learner objection directly'
          : 'hold: no frustration evident — keep the responsive baseline';
    const newSystemPrompt = [
      'You are a patient one-on-one tutor. Keep replies to 1-5 sentences and',
      'stay responsive to what the learner actually says.',
      `[[SUPEREGO_DIRECTIVE@t${turn}]] ${directive}`,
      cumulative && priorCount > 0
        ? `[[LEDGER_DEPTH]] ${priorCount}`
        : '[[STATELESS_REWRITE]] re-derived from scratch this turn',
    ].join('\n');
    return { newSystemPrompt, detectedFrustrationSignal: signal, correctiveDirective: directive };
  },

  learnerTurn: ({ tutorLastMessage, hidden, turn, actionType }) => {
    if (turn === hidden.triggerTurn) return hidden.triggerSignal || 'I have a different read on that.';
    const scripted = hidden?.scriptedResponses || {};
    const canUseScript = turn > Number(hidden?.triggerTurn ?? -1);
    if (canUseScript && actionType && scripted[actionType]) return scripted[actionType];
    if (canUseScript && actionType === 'observe_no_intervention') {
      return 'I choose to continue with the next step in my own words because I already have a workable route.';
    }
    if (canUseScript && scripted[`turn_${turn}`]) return scripted[`turn_${turn}`];
    if (canUseScript && scripted.default) return scripted.default;
    const context = hidden?.publicLearnerContext || {};
    if (context.learnerMode === 'llm') {
      const maturity = Number(context.characterState?.maturity || 0);
      const routed = context.memoryEnabled === true;
      const hasPriorSceneState = Array.isArray(context.priorSceneSummaries) && context.priorSceneSummaries.length > 0;
      const prompt = `${context.openingStance || ''}\n${tutorLastMessage || ''}`.toLowerCase();
      const dramaEnabled = context.dramaEnabled === true || context.dramaticEnabled === true;
      const signal =
        context.resistanceSignal ||
        (/boring|worksheet|dead/.test(prompt)
          ? 'boredom'
          : /frustrat|stuck|small|where/.test(prompt)
            ? 'frustration'
            : /irrelevance|matter|task|valid|care/.test(prompt)
              ? 'irrelevance'
              : /question|flood|collapse/.test(prompt)
                ? 'question_flood'
                : /parrot|repeat|formula|own words|prediction/.test(prompt)
                  ? 'rote_parroting'
                  : '');
      if (
        dramaEnabled &&
        (context.dramaticContext?.requiresPeripeteia === true || /old check|repeated terms settle/.test(prompt))
      ) {
        return 'I was using the old check that repeated terms settle the problem; now the check is whether this proof move decides if the method is valid for the actual task, because that is the evidence that matters here.';
      }
      if (context.stateQuality === 'mismatched_prior') {
        return 'I can see there was prior work, but I am not sure how it applies here yet, so I only have a partial reason.';
      }
      if (actionType === 'staged_followup') {
        if (signal === 'boredom') {
          return 'Because the relation supports the next step, I will test one concrete case and use what happens there as my reason.';
        }
        if (signal === 'frustration') {
          return 'Because the relation supports the next step, I will make one small try, then name exactly where it still sticks.';
        }
        if (signal === 'irrelevance') {
          return 'This matters for the actual task because it decides whether the method is valid for this case.';
        }
        if (signal === 'question_flood') {
          return 'Because the relation supports the next step, my one main question is what changes when this relation changes.';
        }
        if (signal === 'rote_parroting') {
          return 'I predict the formula breaks when the case changes, because I need to explain the relation in my own words.';
        }
      }
      if (!routed || (!hasPriorSceneState && maturity < 0.03)) {
        return 'I am not sure yet; I need one clearer next step before I can give my reason.';
      }
      if (context.transfer === true) {
        return 'In this new case, this step matters for the actual problem because it tests whether the method is valid for the case; I will use that as my next check.';
      }
      if (/concrete|case|live|worksheet|boring/.test(prompt)) {
        return 'I can test one concrete case and use what happens there as my reason for the next step.';
      }
      if (/small|stuck|frustrat|where/.test(prompt)) {
        return 'I will make one small try, then name exactly where it still sticks instead of repeating the whole sequence.';
      }
      if (/matter|task|decide|valid|relevance|care/.test(prompt)) {
        return 'This matters for the actual task because it decides whether the method is valid for this case.';
      }
      if (/question|single|flood|collapse/.test(prompt)) {
        return 'My one main question is what changes when this relation changes, and I can test that next.';
      }
      if (/own words|parrot|repeat|prediction|formula/.test(prompt)) {
        return 'I predict the formula breaks when the case changes, so I need to explain the relation in my own words.';
      }
      return 'I can give my own reason and one next move instead of only asking for the answer.';
    }
    if (/ask you something/i.test(tutorLastMessage || '')) return 'OK, let me try.';
    if (hidden.actualSophistication === 'advanced')
      return 'But that only works if we assume X — what about the case where not-X?';
    return 'Hmm, can you explain more?';
  },
};

export async function callRole(role, payload) {
  if (!fixtures[role]) throw new Error(`mockLLM: no fixture for role ${role}`);
  return fixtures[role](payload);
}
