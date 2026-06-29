// LangGraph definition for the adaptive bilateral tutor variant.
//
// Five supported architectures, switched by the `architecture` option to
// buildGraph(). All variants emit the same per-turn record shape (so the
// strategy-shift analyzer can score them uniformly), but the deliberation
// pipelines differ:
//
//   recognition_only           (A13 condition C1 — cell_111)
//     learnerTurn ↔ tutorEgoInitial → tutorEmit
//     Single LLM call per tutor turn. No superego, no profile update,
//     no constraint check, no revision. Policy action still emitted so
//     strategy_shift_correctness is scoreable.
//
//   recognition_named_patterns (cell_116 — paired comparison to cell_111)
//     Same topology as recognition_only. Differs only in the ego prompt:
//     adds an instruction to name recurring meta-patterns (polite
//     affirmation, oracle-seeking, deflection) explicitly, and passes
//     dialogue history into the user prompt so the ego can actually see
//     them. Tests whether the cell_111-vs-cell_115 gap on
//     polite_false_mastery is closable by prompt addition alone.
//
//   ego_superego               (A13 condition C2 — cell_112)
//     learnerTurn ↔ tutorEgoInitial → tutorSuperegoReview
//                  → tutorEgoRevision (always) → tutorEmit
//     Two-pass deliberation matching the project's standard ego/superego
//     architecture. No profile update, no constraint check.
//
//   state_policy   (DEFAULT)   (A13 condition C3 — cell_110)
//     learnerProfileUpdate → tutorEgoInitial → tutorSuperegoReview
//       → constraintCheck → [tutorEgoRevision]? → tutorEmit → learnerTurn
//     Strategy 1 (externalised profile) + Strategy 3 (constraint-driven
//     revision) + Strategy 5 (counterfactual replay, in runner.js).
//
//   state_policy_with_validator (A13 condition C4 — cell_113)
//     state_policy + tutorValidator node between tutorSuperegoReview and
//     constraintCheck. Validator is a stricter second-pass that reads the
//     just-picked policy action against POLICY_ACTION_DETAILS' trigger
//     conditions and contraindications, and forces revision on mismatch.
//
//   bilateral_tom              (P2 cell C5 — cell_115)
//     learnerProfileUpdate → tutorTomTracker → tutorEgoInitial
//       → tutorSuperegoReview → constraintCheck → [tutorEgoRevision]?
//       → tutorEmit → learnerTurn
//     state_policy + a ToM tracker that emits paired summaryText (LBM
//     bottleneck), hypothesizedLearnerPerceptionOfTutor (second-order
//     belief), and tomProbes (FANToM-style predictions scored against
//     ground truth in post-hoc analysis). All three fields land on
//     learnerProfile, which the existing tutorEgoInitial prompt is now
//     ToM-aware about. Tutor side only — bilateral learner extension
//     in services/learnerTutorInteractionEngine.js is a separate
//     deliverable per docs/explorations/claude/2026-05-05-p2-bilateral-tom-pre-registration.md §3.
//
//   bilateral_tom_named_patterns (cell_117 — additivity probe)
//     Same topology as bilateral_tom. Differs only in the ego prompt:
//     swaps tutorEgoInitial for tutorEgoInitialNamedPatterns (the cell_116
//     prompt that names recurring meta-patterns and reads dialogue history).
//     Tests whether the two interventions — ToM tracker (cell_115) and
//     named-patterns prompt (cell_116) — combine additively. Pilot
//     comparison in 3-arm cell_111/115/116 showed each intervention won
//     on a different scenario family (115 stronger on false_confusion;
//     116 stronger on polite_false_mastery), so additivity is plausible
//     but not guaranteed.
//
//   superego_revise_stateless / superego_revise_cumulative
//                              (A16 §6.3.10 pre-registration — P2)
//     learnerTurn ↔ superegoRevise → tutorEgoInitial → tutorEmit
//     The F-floor topology (= recognition_only) with a superegoRevise node
//     inserted before the ego. The superego reads the full real dialogue
//     and rewrites the ego's entire system prompt for the turn (ported from
//     prototypes/adversarial-superego-mvp; scenario answer key never shown).
//     The two arms are byte-identical except for rewrite-policy
//     statefulness: _stateless (S0 ≈ id-director — no memory of prior
//     rewrites) vs _cumulative (S1 — threads + appends its own
//     revisionLedger). S1-vs-S0 is the pre-registered decisive contrast.

import { createHash } from 'crypto';
import { StateGraph, START, END } from '@langchain/langgraph';
import { AdaptiveTutorState } from './stateSchema.js';
import { callRole } from './llm.js';
import { createAdaptationContract, updateContractRealizationChecks } from './adaptationContract.js';
import {
  applyAdaptationPolicyLayerToAction,
  applyWorldAdaptationToAction,
  estimateLearnerStateBelief,
  legacyPolicyActionForAdaptiveAction,
  scrambleLearnerStateBelief,
  selectPedagogicalAction,
  summarizeWorldAdaptationSpec,
} from './actionPolicy.js';
import { validateProofReleaseOwnershipGate, repairActionFromGate } from './proofReleaseOwnershipGate.js';
import { appendPendingIntervention, closePendingIntervention } from './interventionLedger.js';
import {
  realizeStagedFollowup,
  realizeTutorUtterance,
  repairRealization,
  verifyRealization,
} from './realizationVerifier.js';

const SUPPORTED_ARCHITECTURES = Object.freeze([
  'recognition_only',
  'recognition_named_patterns',
  'ego_superego',
  'state_policy',
  'state_policy_closed_loop',
  'state_policy_with_validator',
  'state_policy_minimal_profile',
  'state_policy_no_misconceptions',
  'state_policy_no_agency_signal',
  'state_policy_minimal_plus_zpd',
  'bilateral_tom',
  'bilateral_tom_named_patterns',
  // P2.3 crossover (cells 121, 122): bilateral_tom learner state feeds an
  // id-director that authors the ego's system prompt per turn. v1 is single-
  // pass (id → ego → emit, no superego/revision); v2 keeps the state_policy
  // pathway with the id-authored prompt threaded into the existing ego node.
  'bilateral_tom_id_director_v1',
  'bilateral_tom_id_director_v2',
  // A14 (cell 126): state_policy + evidenceExtractor + hypothesisUpdater
  // at the loop head. Stage 2a populates evidenceLog with typed observations
  // gated by exact-substring quote validation. Stage 2b adds the
  // hypothesisUpdater between extractor and learnerProfileUpdate: it
  // synthesises typed hypotheses with TTL from the validated ledger, owns
  // hypothesis_id derivation + created_at_turn preservation + evidence-ref
  // filtering. The flag-driven shared block keeps cells 110-113 /
  // bilateral_tom variants untouched while this architecture accretes new
  // nodes stage by stage.
  'state_policy_evidence_bound',
  // A14 Stage 3 (cell 127): state_policy_evidence_bound + groundingValidator.
  // After the updater proposes hypotheses, the validator walks the still-
  // tentative subset and decides which to PROMOTE to `validated` (multiple
  // supporting obs_ids accumulated, no contradiction) and which to RETIRE
  // to `contradicted` (new evidence directly conflicts). The retain/retire
  // gate is the explicit retention layer A14 §4.3 calls for; without it,
  // status transitions are limited to whatever the updater itself proposes
  // (and the Stage 2b smoke showed the updater rarely promotes — 0 of 53
  // hypotheses were marked `validated`, only `tentative`/`contradicted`).
  // cell_126 vs cell_127 contrast = validator off vs on, same scenarios.
  'state_policy_evidence_bound_validated',
  // A14 Stage 5 diagnostic (cell 128): the full audit chain
  // (evidenceExtractor + hypothesisUpdater + groundingValidator) on the
  // MINIMAL {confidence, lastEvidence} profile (cell_118's projection)
  // instead of cell_127's full 5-field profile. Same topology as
  // state_policy_evidence_bound_validated; the only difference is the
  // PROFILE_PROJECTIONS entry below. Isolates the grounding effect from the
  // rich-state load confound (§6.8.6 state-richness reversal): cell_128 vs
  // cell_118 holds the lean profile fixed and adds only the evidence-bound
  // discipline; cell_128 vs cell_127 holds the audit chain fixed and varies
  // profile width — separating trust/grounding from capacity/load.
  'state_policy_minimal_profile_evidence_bound_validated',
  // A16 (P2): adversarial-rewrite superego, promoted from
  // prototypes/adversarial-superego-mvp under the §6.3.10 pre-registration.
  // The superego sees the full tutor↔learner dialogue and REWRITES the ego's
  // entire system prompt for its next turn (the prototype's proven channel;
  // message-array mutation was shown non-load-bearing — the v3 finding).
  // Two arms differing ONLY in rewrite-policy statefulness (the pre-registered
  // decisive S1-vs-S0 contrast): superego_revise_stateless (S0 ≈ id-director —
  // every rewrite re-derived from scratch, no memory of prior corrections)
  // vs superego_revise_cumulative (S1 — the superego threads its own prior
  // revisionLedger into each rewrite and appends to it; the psychoanalytic
  // continuous-revision analogue). The superegoRevise role prompt and the
  // ego node are byte-identical across the two arms (validity control).
  'superego_revise_stateless',
  'superego_revise_cumulative',
]);
export { SUPPORTED_ARCHITECTURES };

// Per-architecture projection of the learnerProfile fields the LLM sees.
// Architectures not listed keep the full profile. Each entry names the
// fields preserved from the LLM's structured output; everything else is
// reset to the schema's default value (agencySignal='unknown',
// misconceptions=[], zpdEstimate='', summaryText=''). updatedAtTurn is
// always set by the graph node, never via projection — see learnerProfileUpdate.
//
// Source-of-truth for which fields each cell exposes:
// docs/explorations/claude/2026-05-10-p2-followup-pre-registration.md §P2.2.
const PROFILE_PROJECTIONS = Object.freeze({
  state_policy_minimal_profile: ['confidence', 'lastEvidence'],
  state_policy_no_misconceptions: ['confidence', 'agencySignal', 'zpdEstimate', 'lastEvidence'],
  state_policy_no_agency_signal: ['confidence', 'misconceptions', 'zpdEstimate', 'lastEvidence'],
  // Post-hoc P2.2 follow-up (cell_123): minimal profile + zpdEstimate only.
  // Disentangles whether zpdEstimate alone re-introduces the ~50% strict_shift
  // floor shared by cells 110/119/120, or whether profile field-count is the
  // operative variable. See §6.8.6.
  state_policy_minimal_plus_zpd: ['confidence', 'lastEvidence', 'zpdEstimate'],
  // A14 Stage 5 diagnostic (cell_128): cell_118's minimal projection paired
  // with the full evidence-bound audit chain (see SUPPORTED_ARCHITECTURES).
  // Same two fields as state_policy_minimal_profile — what differs is the
  // graph topology (extractor + updater + validator), not the projection.
  state_policy_minimal_profile_evidence_bound_validated: ['confidence', 'lastEvidence'],
});

function projectProfileForArchitecture(profile, architecture) {
  const keep = PROFILE_PROJECTIONS[architecture];
  if (!keep) return profile;
  const out = {
    misconceptions: [],
    confidence: 0.5,
    agencySignal: 'unknown',
    zpdEstimate: '',
    lastEvidence: '',
    summaryText: '',
  };
  for (const k of keep) {
    if (k in profile) out[k] = profile[k];
  }
  return out;
}

const lastTextOf = (messages, role) => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === role || m._getType?.() === role) return m.content || m.text || '';
  }
  return '';
};

function makeLearnerProfileUpdate(architecture) {
  return async function learnerProfileUpdate(state) {
    const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
    const profile = await callRole('learnerProfileUpdate', {
      learnerLastMessage,
      hidden: state.hiddenLearnerState,
      currentProfile: state.learnerProfile,
      turn: state.turn,
    });
    const projected = projectProfileForArchitecture(profile, architecture);
    // Bookkeeping is owned by the graph, not the model — guarantees
    // the constraint check has a reliable updatedAtTurn signal regardless
    // of which LLM backend produced the profile.
    return { learnerProfile: { ...projected, updatedAtTurn: state.turn } };
  };
}

// Bilateral-ToM tracker: paired LBM bottleneck text + second-order belief +
// FANToM-style probes, all written back onto learnerProfile so the existing
// tutorEgoInitial node can read them as part of the profile context. Spreads
// the prior profile so updatedAtTurn (set by learnerProfileUpdate immediately
// before this node) is preserved — otherwise constraintCheck would flag
// "learner profile not updated at turn N" and force a spurious revision.
async function tutorTomTracker(state) {
  const tom = await callRole('tutorTomTracker', {
    learnerProfile: state.learnerProfile,
    dialogue: state.dialogue,
    turn: state.turn,
  });
  return {
    learnerProfile: {
      ...state.learnerProfile,
      summaryText: tom.summaryText,
      hypothesizedLearnerPerceptionOfTutor: tom.hypothesizedLearnerPerceptionOfTutor,
      tomProbes: tom.tomProbes,
    },
  };
}

async function tutorEgoInitial(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  // A16 (P2): the superego_revise_* superegoRevise node writes a dedicated
  // superegoAuthoredPrompt; prefer it, falling back to the id-director's
  // idAuthoredPrompt (cells 121/122). No architecture writes both, so the
  // precedence is unambiguous and the ego node stays byte-identical across
  // the S0/S1 arms (the §6.3.10 validity control) while reusing the proven
  // id-director system-prompt-override channel — no new ego machinery.
  const systemPromptOverride =
    state.tutorInternal?.superegoAuthoredPrompt || state.tutorInternal?.idAuthoredPrompt || undefined;
  const out = await callRole('tutorEgoInitial', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    systemPromptOverride,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

// Id-director node for the bilateral_tom × id-director crossover (cells 121, 122).
// Authors the ego's system prompt for the turn from the bilateral_tom-enriched
// learner profile (misconceptions, confidence, agencySignal, summaryText,
// hypothesizedLearnerPerceptionOfTutor, tomProbes). Mirrors
// services/idDirectorEngine.js: prompt comes from the same tutor-id-director.md
// file (loaded inside realLLM.js); the response is parsed into the same
// construction envelope. The graph carries the construction forward via
// tutorInternal so persistence.js can record it on the per-turn trace.
async function idAuthorPersona(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const previousPersona = state.tutorInternal?.idConstruction?.generated_prompt
    ? `last_persona_delta: ${state.tutorInternal.idConstruction.persona_delta || 'UNKNOWN'}\nlast_reasoning: ${state.tutorInternal.idConstruction.reasoning || ''}\nlast_generated_prompt_head: ${state.tutorInternal.idConstruction.generated_prompt.slice(0, 240)}${state.tutorInternal.idConstruction.generated_prompt.length > 240 ? '...' : ''}`
    : 'FIRST_TURN';
  const construction = await callRole('idAuthorPersona', {
    dialogue: state.dialogue,
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    previousPersona,
    turn: state.turn,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      idConstruction: construction,
      idAuthoredPrompt: construction.generated_prompt,
    },
  };
}

// Single-pass ego executor for Variant A (bilateral_tom_id_director_v1).
// The id-authored prompt is the ego's system prompt for this call; the role's
// canonical TUTOR_EGO_INITIAL_SYSTEM is bypassed via systemPromptOverride.
// Still emits {text, policyAction} so strategy_shift_correctness is scoreable.
async function tutorEgoExecute(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const out = await callRole('tutorEgoExecute', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    systemPromptOverride: state.tutorInternal?.idAuthoredPrompt || '',
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

// A16 (P2): adversarial-rewrite superego node, promoted from
// prototypes/adversarial-superego-mvp under the §6.3.10 pre-registration.
// Structurally modelled on idAuthorPersona (the id-director persona
// constructor) but writes a DEDICATED tutorInternal.superegoAuthoredPrompt
// — consumed by tutorEgoInitial via the existing system-prompt-override
// path, so no ego-node change and the ego stays byte-identical across the
// S0/S1 arms (the pre-registered validity control).
//
// Ported from the prototype's buildCrossSuiteSuperegoPrompt
// (adversarial_prompt_only shape): the role sees ONLY the real dialogue —
// never the scenario's expected-strategy-shift answer key — preserving the
// prototype's stated validity choice (handing the target would make the
// arm win trivially).
//
// The factory's `cumulative` flag is the ENTIRE operationalisation of the
// pre-registered decisive S1-vs-S0 contrast and the only thing that differs
// between the two arms:
//   S0 (stateless, ≈ id-director): passes no prior ledger and appends
//     nothing — each rewrite is re-derived from scratch.
//   S1 (cumulative): threads its own prior revisionLedger into the rewrite
//     context and appends exactly one ledger entry per turn through the
//     append-only channel (evidenceLogReducer) — the psychoanalytic
//     continuous-revision analogue. The role prompt is byte-identical to S0.
function makeSuperegoRevise(architecture) {
  const cumulative = architecture === 'superego_revise_cumulative';
  return async function superegoRevise(state) {
    const priorLedger = cumulative ? state.revisionLedger || [] : [];
    const out = await callRole('superegoRevise', {
      dialogue: state.dialogue,
      turn: state.turn,
      priorLedger,
      cumulative,
    });
    const newPrompt = String(out?.newSystemPrompt || '');
    const update = {
      tutorInternal: {
        ...state.tutorInternal,
        superegoAuthoredPrompt: newPrompt,
      },
    };
    if (cumulative) {
      // Exactly one append per turn — same single-entry-per-turn discipline
      // as A14's evidenceExtractor on the shared append-only reducer.
      update.revisionLedger = [
        {
          turn: state.turn,
          detectedFrustrationSignal: String(out?.detectedFrustrationSignal || ''),
          correctiveDirective: String(out?.correctiveDirective || ''),
          promptDiffHead: newPrompt.slice(0, 240),
        },
      ];
    }
    return update;
  };
}

// Variant ego node used by recognition_named_patterns. Identical to
// tutorEgoInitial except (a) routes to the tutorEgoInitialNamedPatterns
// role (different system prompt) and (b) passes dialogue history so the
// prompt can actually see the cross-turn patterns it's instructed to
// surface.
async function tutorEgoInitialNamedPatterns(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  const out = await callRole('tutorEgoInitialNamedPatterns', {
    learnerLastMessage,
    learnerProfile: state.learnerProfile,
    dialogue: state.dialogue,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
      superegoFeedback: '',
      egoRevision: '',
    },
  };
}

async function tutorSuperegoReview(state) {
  const out = await callRole('tutorSuperego', {
    tutorInternal: state.tutorInternal,
    learnerProfile: state.learnerProfile,
  });
  return {
    tutorInternal: { ...state.tutorInternal, superegoFeedback: out.feedback },
    constraintViolations: out.needsRevision ? [out.feedback] : [],
  };
}

async function tutorValidator(state) {
  const out = await callRole('tutorValidator', {
    policyAction: state.tutorInternal.policyAction,
    tutorDraft: state.tutorInternal.egoDraft,
    learnerProfile: state.learnerProfile,
  });
  // Validator appends to the same constraintViolations channel as the
  // structural constraint check so the existing routing logic picks it up.
  return {
    constraintViolations: out.needsRevision ? [`validator: ${out.feedback}`] : [],
  };
}

async function constraintCheck(state) {
  const violations = [];
  // Strategy 3: a turn must show that the learner profile was updated this turn.
  if (state.learnerProfile.updatedAtTurn !== state.turn) {
    violations.push(`learner profile not updated at turn ${state.turn}`);
  }
  // Strategy 3: if learner is resistant, tutor must not pick a pure-explanation action.
  const explanationActions = new Set(['give_worked_example', 'lower_cognitive_load']);
  if (state.learnerProfile.agencySignal === 'resistant' && explanationActions.has(state.tutorInternal.policyAction)) {
    violations.push(`policy ${state.tutorInternal.policyAction} contraindicated for resistant learner`);
  }
  return { constraintViolations: violations };
}

async function tutorEgoRevision(state) {
  const out = await callRole('tutorEgoRevision', {
    tutorInternal: state.tutorInternal,
    learnerProfile: state.learnerProfile,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoRevision: out.text,
      policyAction: out.policyAction,
    },
  };
}

async function tutorEmit(state) {
  const finalText = state.tutorInternal.egoRevision || state.tutorInternal.egoDraft;
  return { dialogue: [{ role: 'tutor', content: finalText }] };
}

// A14 Stage 2a: evidence extractor node. Reads the most recent learner
// message from state.dialogue, calls the extractor role for typed
// observations, then runs each one through the quote-validation gate
// (exact-substring match against the dialogue text). Failed-quote entries
// are NOT dropped — they're recorded with validated=false so Stage 3's
// validator + Stage 4's analyzer can report the unsupported-claim rate
// rather than silently filtering hallucinations out of view.
//
// obs_id uses a content-derived sha1 prefix so identical extractions across
// the original and counterfactual branches collide on the same ID (the
// merge-by-id reducer isn't on this channel — evidenceLog is append-only —
// but the IDs still need to be stable for cross-branch comparison in the
// analyzer). idx is included so two near-identical quotes in the same turn
// still get distinct IDs.
async function evidenceExtractor(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  if (!learnerLastMessage) return {};
  const extracted = await callRole('evidenceExtractor', {
    learnerLastMessage,
    dialogue: state.dialogue,
    turn: state.turn,
  });
  const dialogueText = state.dialogue.map((m) => m.content || '').join('\n');
  const raw = Array.isArray(extracted?.evidence) ? extracted.evidence : [];
  const entries = raw.map((e, idx) => {
    const quote = String(e.quote || '');
    const hash = createHash('sha1').update(quote).digest('hex').slice(0, 8);
    return {
      obs_id: `t${state.turn}_${idx}_${hash}`,
      turn: state.turn,
      quote,
      type: e.type,
      kc_candidates: Array.isArray(e.kc_candidates) ? e.kc_candidates : [],
      created_by: 'extractor_v1',
      validated: quote.length > 0 && dialogueText.includes(quote),
    };
  });
  return { evidenceLog: entries };
}

// A14 Stage 2b: hypothesisUpdater. Reads the validated evidence ledger and
// the current hypotheses, calls the LLM (or mock) to propose updates, then
// applies node-side bookkeeping:
//   (a) Deterministic TTL sweep marks tentative hypotheses as `expired` when
//       turn > created_at_turn + expires_after_turns. Done in code, not by
//       the LLM, because expiry is mechanical and shouldn't burn tokens or
//       risk the model forgetting to expire.
//   (b) hypothesis_id derivation. Newly proposed hypotheses (those without a
//       model-supplied hypothesis_id) get `hyp_<sha1-prefix-of-claim>` so
//       paraphrases of the "same" idea collide on the same id rather than
//       fragmenting the ledger. Counterfactual-replay stability comes free
//       from content-derived ids — same posture as obs_id in the extractor.
//   (c) created_at_turn / expires_after_turns preservation. When the LLM
//       revises an existing hypothesis (matching hypothesis_id), the node
//       preserves the original creation turn and TTL offset. The reducer is
//       merge-by-id last-write-wins, so without this preservation the LLM
//       could implicitly reset the TTL clock on every revision.
//   (d) Evidence-ref filtering. supporting_evidence / contradicting_evidence
//       arrays are filtered to obs_ids that actually appear in the validated
//       ledger. A fabricated obs_id is silently dropped rather than carried
//       forward — the audit trail in the ledger should not be polluted by
//       hallucinated cross-references.
//
// Empty-evidence shortcut: if no validated evidence exists yet, the LLM call
// is skipped (nothing to update from). The TTL sweep still runs — a turn-0
// hypothesis with expires_after_turns=1 can expire on turn 2 even if no new
// evidence has arrived.
async function hypothesisUpdater(state) {
  const turn = state.turn;
  const validatedEvidence = (state.evidenceLog || []).filter((e) => e.validated);
  const currentHypotheses = state.hypotheses || [];

  const expiredUpdates = currentHypotheses
    .filter((h) => h.status === 'tentative' && turn > h.created_at_turn + h.expires_after_turns)
    .map((h) => ({ ...h, status: 'expired' }));

  if (validatedEvidence.length === 0) {
    return expiredUpdates.length > 0 ? { hypotheses: expiredUpdates } : {};
  }

  // Show the LLM all non-expired hypotheses including about-to-expire ones —
  // fresh evidence may revive them, and the revision (in `synthesised` below)
  // will win over the TTL sweep entry via ordering in the returned array.
  const liveHypotheses = currentHypotheses.filter((h) => h.status !== 'expired');

  const proposed = await callRole('hypothesisUpdater', {
    validatedEvidence,
    currentHypotheses: liveHypotheses,
    turn,
  });

  const validObsIds = new Set(validatedEvidence.map((e) => e.obs_id));
  const existingById = new Map(currentHypotheses.map((h) => [h.hypothesis_id, h]));

  const synthesised = (proposed?.hypotheses || [])
    .map((h) => {
      const claim = String(h.claim || '').trim();
      if (!claim) return null;
      const declaredId =
        typeof h.hypothesis_id === 'string' && h.hypothesis_id.trim().length > 0 ? h.hypothesis_id.trim() : null;
      const derivedId = `hyp_${createHash('sha1').update(claim).digest('hex').slice(0, 8)}`;
      const id = declaredId || derivedId;
      const existing = existingById.get(id);
      const support = Array.isArray(h.supporting_evidence) ? h.supporting_evidence : [];
      const contradict = Array.isArray(h.contradicting_evidence) ? h.contradicting_evidence : [];
      return {
        hypothesis_id: id,
        claim,
        confidence: typeof h.confidence === 'number' ? Math.max(0, Math.min(1, h.confidence)) : 0.5,
        supporting_evidence: support.filter((oid) => validObsIds.has(oid)),
        contradicting_evidence: contradict.filter((oid) => validObsIds.has(oid)),
        status: h.status || 'tentative',
        created_at_turn: existing ? existing.created_at_turn : turn,
        expires_after_turns: existing ? existing.expires_after_turns : 2,
        next_validation_action: h.next_validation_action || '',
      };
    })
    .filter(Boolean);

  // Order matters for the merge-by-id reducer: synthesised entries come
  // after expiredUpdates, so a hypothesis revived by fresh evidence overrides
  // the TTL sweep's `expired` status.
  return { hypotheses: [...expiredUpdates, ...synthesised] };
}

// A14 Stage 3: groundingValidator. After the updater proposes the turn's
// hypothesis updates, the validator walks the still-tentative subset and
// decides which to promote to `validated` and which to retire to
// `contradicted`. The retain/retire decision is informed by:
//   (a) accumulated supporting evidence count and turn-spread
//   (b) presence and weight of contradicting evidence
//   (c) confidence trajectory (high+stable vs low+wobbling)
// Node-side bookkeeping:
//   - The validator emits {hypothesis_id, new_status, reasoning} only. The
//     node looks up each id in the current hypotheses, preserves claim /
//     supporting_evidence / contradicting_evidence / created_at_turn /
//     expires_after_turns, and changes only the status. The LLM doesn't
//     own the hypothesis fields — it owns the verdict.
//   - Validator output is filtered against the current `tentative` set; a
//     decision about an id the validator hallucinates is silently dropped
//     (same posture as obs_id filtering in the updater).
//   - new_status must be either `validated` or `contradicted` — leaving a
//     hypothesis as-is is expressed by NOT emitting a decision for it,
//     mirroring the SILENCE convention in the updater.
async function groundingValidator(state) {
  const tentative = (state.hypotheses || []).filter((h) => h.status === 'tentative');
  if (tentative.length === 0) return {};

  const validatedEvidence = (state.evidenceLog || []).filter((e) => e.validated);
  const proposed = await callRole('groundingValidator', {
    hypotheses: tentative,
    evidenceLedger: validatedEvidence,
    turn: state.turn,
  });

  const tentativeById = new Map(tentative.map((h) => [h.hypothesis_id, h]));
  const updates = (proposed?.decisions || [])
    .map((d) => {
      const h = tentativeById.get(d?.hypothesis_id);
      if (!h) return null;
      if (d.new_status !== 'validated' && d.new_status !== 'contradicted') return null;
      return { ...h, status: d.new_status };
    })
    .filter(Boolean);

  return updates.length > 0 ? { hypotheses: updates } : {};
}

function scriptedLearnerTurn({ hidden, turn, actionType } = {}) {
  if (turn === hidden?.triggerTurn) return hidden?.triggerSignal || 'I have a different read on that.';
  const scripted = hidden?.scriptedResponses || {};
  const canUseScript = turn > Number(hidden?.triggerTurn ?? -1);
  if (!canUseScript) return null;
  if (actionType && scripted[actionType]) return scripted[actionType];
  if (scripted[`turn_${turn}`]) return scripted[`turn_${turn}`];
  if (scripted.default) return scripted.default;
  return null;
}

async function learnerTurn(state) {
  const tutorLastMessage = lastTextOf(state.dialogue, 'tutor');
  const actionType =
    state.tutorInternal?.adaptationAction ||
    state.selectedPedagogicalAction?.action_type ||
    state.tutorInternal?.policyAction ||
    '';
  const scripted = scriptedLearnerTurn({ hidden: state.hiddenLearnerState, turn: state.turn, actionType });
  const text =
    scripted ??
    (await callRole('learnerTurn', {
      tutorLastMessage,
      hidden: state.hiddenLearnerState,
      turn: state.turn,
      actionType,
    }));
  return { dialogue: [{ role: 'learner', content: text }], turn: state.turn + 1 };
}

const routeAfterConstraint = (state) => {
  const violationsThisTurn = state.constraintViolations.length > 0 && state.tutorInternal.egoRevision === '';
  return violationsThisTurn ? 'tutorEgoRevision' : 'tutorEmit';
};

const routeAfterLearner = (loopBackNode) => (state) => (state.turn >= state.maxTurns ? END : loopBackNode);

const GATED_ADAPTATION_MODES = new Set(['contract_gate', 'closed_loop', 'closed_loop_counterfactual']);
const LEDGER_ADAPTATION_MODES = new Set(['closed_loop', 'closed_loop_counterfactual']);

function policyModeFromState(state, defaultMode = 'closed_loop') {
  if (state?.adaptationPolicyMode && state.adaptationPolicyMode !== 'legacy') return state.adaptationPolicyMode;
  return defaultMode;
}

function policyConfigFromState(state, defaultConfig = {}) {
  return { ...defaultConfig, ...(state?.adaptivePolicyConfig || {}) };
}

function normalizePolicyConfig(config = {}) {
  return {
    ...config,
    maxHypotheses: config.maxHypotheses ?? config.max_hypotheses,
    maxActionCandidates: config.maxActionCandidates ?? config.max_action_candidates,
    uncertaintyWeight: config.uncertaintyWeight ?? config.uncertainty_weight,
    ownershipWeight: config.ownershipWeight ?? config.ownership_weight,
    controlWeight: config.controlWeight ?? config.control_weight,
    actionFitWeight: config.actionFitWeight ?? config.action_fit_weight,
    repetitionPenalty: config.repetitionPenalty ?? config.repetition_penalty,
    sameActionPenalty: config.sameActionPenalty ?? config.same_action_penalty,
    sameActionWindow: config.sameActionWindow ?? config.same_action_window,
    sameActionScope: config.sameActionScope ?? config.same_action_scope,
    worldAdaptationSpec: config.worldAdaptationSpec ?? config.world_adaptation_spec,
    worldAdaptationWeight: config.worldAdaptationWeight ?? config.world_adaptation_weight,
    realizationContext: config.realizationContext ?? config.realization_context,
    resistanceSignalPolicy: config.resistanceSignalPolicy ?? config.resistance_signal_policy,
    resistanceSignalTarget: config.resistanceSignalTarget ?? config.resistance_signal_target,
    resistanceSignalGate: config.resistanceSignalGate ?? config.resistance_signal_gate,
    resistanceSignalStrategy: config.resistanceSignalStrategy ?? config.resistance_signal_strategy,
    resistanceSignalWeight: config.resistanceSignalWeight ?? config.resistance_signal_weight,
    stagedCombinedClosure: config.stagedCombinedClosure ?? config.staged_combined_closure,
    typedEvidenceContracts: config.typedEvidenceContracts ?? config.typed_evidence_contracts,
    semanticOutcomeObserver: config.semanticOutcomeObserver ?? config.semantic_outcome_observer,
    typedStagedFollowup: config.typedStagedFollowup ?? config.typed_staged_followup,
    earlyCompletionAfterSuccessfulNoIntervention:
      config.earlyCompletionAfterSuccessfulNoIntervention ?? config.early_completion_after_successful_no_intervention,
    utilityTieEpsilon: config.utilityTieEpsilon ?? config.utility_tie_epsilon,
    stateScramble: config.stateScramble ?? config.state_scramble,
  };
}

function traceEntry(type, state, payload = {}) {
  return {
    type,
    turn: state?.turn,
    payload,
  };
}

function completionFromClosedIntervention(closedRecord, config = {}) {
  const normalized = normalizePolicyConfig(config);
  if (!normalized.earlyCompletionAfterSuccessfulNoIntervention) return null;
  if (closedRecord?.status !== 'closed') return null;
  if (closedRecord.action_type !== 'observe_no_intervention') return null;
  if (closedRecord.outcome !== 'success') return null;
  if (!(closedRecord.hypothesis_ids || []).includes('productive_progress')) return null;
  return {
    should_end: true,
    reason: 'successful_no_intervention_after_productive_progress',
    contract_id: closedRecord.contract_id || null,
    action_type: closedRecord.action_type,
    outcome: closedRecord.outcome,
    closed_turn_index: closedRecord.closed_turn_index ?? null,
  };
}

const routeAfterClosePrevious = (nextNode) => (state) => {
  if (state.adaptiveCompletion?.should_end === true) return END;
  if (state.pendingIntervention?.staged_closure?.missing_required_evidence?.length > 0) {
    return 'realize_staged_followup';
  }
  return nextNode;
};

function makeClosePreviousIntervention(defaultMode, defaultPolicyConfig) {
  return async function closePreviousIntervention(state) {
    const mode = policyModeFromState(state, defaultMode);
    const config = policyConfigFromState(state, defaultPolicyConfig);
    const ledger = state.interventionLedger || [];
    const base = {
      adaptationPolicyMode: mode,
      adaptivePolicyConfig: config,
    };

    if (!LEDGER_ADAPTATION_MODES.has(mode) || !ledger.some((record) => record?.status === 'pending')) {
      return {
        ...base,
        adaptiveCompletion: null,
        adaptationTrace: [traceEntry('close_previous_intervention_skipped', state, { mode })],
      };
    }

    const learnerTurnText = lastTextOf(state.dialogue, 'learner');
    const closed = closePendingIntervention({
      ledger,
      learnerTurn: learnerTurnText,
      turnIndex: state.turn,
      config,
    });
    const completion = completionFromClosedIntervention(closed.closedRecord, config);
    const closeTrace = traceEntry('close_previous_intervention', state, {
      contract_id: closed.closedRecord?.contract_id || closed.pendingIntervention?.contract_id || null,
      outcome: closed.closedRecord?.outcome || null,
      action_type: closed.closedRecord?.action_type || null,
      staged_pending: closed.pendingIntervention?.staged_closure || null,
    });
    const completionTrace = completion
      ? [traceEntry('adaptive_completion', state, { reason: completion.reason, contract_id: completion.contract_id })]
      : [];
    return {
      ...base,
      interventionLedger: closed.ledger,
      pendingIntervention: closed.pendingIntervention,
      adaptiveCompletion: completion,
      adaptationTrace: [closeTrace, ...completionTrace],
    };
  };
}

async function realizeStagedFollowupNode(state) {
  const followup = realizeStagedFollowup({ pendingIntervention: state.pendingIntervention });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: followup.text,
      egoRevision: '',
      superegoFeedback: '',
      adaptationAction: 'staged_followup',
      policyAction: 'request_elaboration',
    },
    adaptationTrace: [
      traceEntry('realize_staged_followup', state, {
        contract_id: state.pendingIntervention?.contract_id || null,
        missing_required_evidence: followup.missing_required_evidence || [],
        missing_evidence_axes: followup.missing_evidence_axes || [],
      }),
    ],
  };
}

function makeEstimateLearnerState(defaultMode, defaultPolicyConfig) {
  return async function estimateLearnerState(state) {
    const mode = policyModeFromState(state, defaultMode);
    const config = normalizePolicyConfig(policyConfigFromState(state, defaultPolicyConfig));
    let stateBelief = estimateLearnerStateBelief({
      dialogue: state.dialogue,
      interventionLedger: state.interventionLedger || [],
      turnIndex: state.turn,
      maxHypotheses: config.maxHypotheses,
      config,
    });
    // state-scramble ablation placebo: decouple the belief from the learner so the rest of
    // the pipeline (selection, gate, contract) operates on a state that no longer matches.
    if (config.stateScramble) stateBelief = scrambleLearnerStateBelief(stateBelief, state.turn);
    return {
      adaptationPolicyMode: mode,
      learnerStateBelief: stateBelief,
      adaptationTrace: [
        traceEntry('estimate_learner_state', state, {
          top_hypothesis: stateBelief.hypotheses?.[0]?.id || null,
          needs_discrimination: stateBelief.uncertainty?.needs_discrimination === true,
          state_scramble: config.stateScramble === true,
          policy_signals: stateBelief.policy_signals || {},
        }),
      ],
    };
  };
}

function makeSelectPedagogicalAction(defaultMode, defaultPolicyConfig) {
  return async function selectPedagogicalActionNode(state) {
    const mode = policyModeFromState(state, defaultMode);
    const config = normalizePolicyConfig(policyConfigFromState(state, defaultPolicyConfig));
    const policy = selectPedagogicalAction({
      stateBelief: state.learnerStateBelief,
      interventionLedger: state.interventionLedger || [],
      mode,
      config,
    });
    return {
      selectedPedagogicalAction: policy.selectedAction,
      candidatePedagogicalActions: policy.candidateActions,
      adaptationTrace: [
        traceEntry('select_pedagogical_action', state, {
          mode,
          action_type: policy.selectedAction.action_type,
          candidate_actions: policy.candidateActions.map((c) => c.action_type),
          world_adaptation_spec: policy.worldAdaptationSpec,
          adaptation_policy_layer: policy.adaptationPolicyLayer,
        }),
      ],
    };
  };
}

function makeValidateAdaptationContract(defaultMode, defaultPolicyConfig) {
  return async function validateAdaptationContractNode(state) {
    const mode = policyModeFromState(state, defaultMode);
    const config = normalizePolicyConfig(policyConfigFromState(state, defaultPolicyConfig));
    let selectedAction = state.selectedPedagogicalAction;
    let gateResult = { allowed: true, violations: [], repairs: [] };
    let repairedFrom = null;

    if (GATED_ADAPTATION_MODES.has(mode)) {
      gateResult = validateProofReleaseOwnershipGate({
        stateBelief: state.learnerStateBelief,
        selectedAction,
        candidateActions: state.candidatePedagogicalActions || [],
        interventionLedger: state.interventionLedger || [],
        config,
      });
      if (!gateResult.allowed) {
        const repaired = repairActionFromGate(selectedAction, gateResult);
        if (repaired?.action_type && repaired.action_type !== selectedAction?.action_type) {
          repairedFrom = selectedAction?.action_type || null;
          selectedAction = applyAdaptationPolicyLayerToAction(
            applyWorldAdaptationToAction(repaired, config),
            state.learnerStateBelief,
            config,
          );
          gateResult = validateProofReleaseOwnershipGate({
            stateBelief: state.learnerStateBelief,
            selectedAction,
            candidateActions: state.candidatePedagogicalActions || [],
            interventionLedger: state.interventionLedger || [],
            config,
          });
        }
      }
    }

    const contract = createAdaptationContract({
      contractId: `adaptive-${state.scenarioId || 'scenario'}-turn-${state.turn}`,
      dialogueId: state.scenarioId || 'adaptive',
      turnIndex: state.turn,
      stateBelief: state.learnerStateBelief,
      selectedAction: repairedFrom ? { ...selectedAction, repaired_from: repairedFrom } : selectedAction,
      candidateActions: state.candidatePedagogicalActions || [],
      gateResult,
      realizationChecks: { action_consistent: null, forbidden_move_detected: null },
      policyMode: mode,
      worldAdaptationSpec: summarizeWorldAdaptationSpec(config.worldAdaptationSpec),
    });

    return {
      selectedPedagogicalAction: contract.selected_action,
      adaptationContract: contract,
      constraintViolations: gateResult.allowed
        ? []
        : gateResult.violations.map((v) => `adaptation gate: ${v.code}: ${v.message}`),
      adaptationTrace: [
        traceEntry('validate_adaptation_contract', state, {
          action_type: contract.selected_action.action_type,
          gate_allowed: gateResult.allowed,
          gate_violations: gateResult.violations.map((v) => v.code),
          repaired_from: repairedFrom,
          world_adaptation_spec: contract.world_adaptation_spec,
        }),
      ],
    };
  };
}

async function realizeTutorUtteranceNode(state) {
  const config = normalizePolicyConfig(policyConfigFromState(state, {}));
  const realization = realizeTutorUtterance({
    selectedAction: state.selectedPedagogicalAction,
    stateBelief: state.learnerStateBelief,
    interventionLedger: state.interventionLedger || [],
    config,
  });
  const adaptationAction = state.selectedPedagogicalAction?.action_type || '';
  const policyAction = legacyPolicyActionForAdaptiveAction(adaptationAction);
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: realization.text,
      egoRevision: '',
      superegoFeedback: '',
      adaptationAction,
      policyAction,
    },
    adaptationTrace: [
      traceEntry('realize_tutor_utterance', state, {
        action_type: state.selectedPedagogicalAction?.action_type || null,
      }),
    ],
  };
}

async function verifyRealizationNode(state) {
  const draft = state.tutorInternal?.egoDraft || '';
  let checks = verifyRealization({ tutorText: draft, selectedAction: state.selectedPedagogicalAction });
  let finalText = draft;
  let repaired = false;
  if (!checks.allowed) {
    finalText = repairRealization({ tutorText: draft, selectedAction: state.selectedPedagogicalAction, checks });
    checks = verifyRealization({ tutorText: finalText, selectedAction: state.selectedPedagogicalAction });
    repaired = true;
  }
  const contract = state.adaptationContract
    ? updateContractRealizationChecks(state.adaptationContract, { ...checks, repaired })
    : null;
  const adaptationAction = state.selectedPedagogicalAction?.action_type || state.tutorInternal?.adaptationAction || '';
  const policyAction = legacyPolicyActionForAdaptiveAction(adaptationAction || state.tutorInternal?.policyAction || '');
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: finalText,
      egoRevision: '',
      adaptationAction,
      policyAction,
    },
    adaptationContract: contract,
    constraintViolations: checks.allowed
      ? []
      : [`adaptation realization: selected action ${checks.action_type || 'unknown'} did not verify`],
    adaptationTrace: [
      traceEntry('verify_realization', state, {
        action_type: checks.action_type,
        allowed: checks.allowed,
        repaired,
      }),
    ],
  };
}

function makePersistPendingIntervention(defaultMode) {
  return async function persistPendingIntervention(state) {
    const mode = policyModeFromState(state, defaultMode);
    if (!LEDGER_ADAPTATION_MODES.has(mode)) {
      return {
        adaptationTrace: [traceEntry('persist_pending_intervention_skipped', state, { mode })],
      };
    }
    const appended = appendPendingIntervention(state.interventionLedger || [], state.adaptationContract);
    return {
      interventionLedger: appended.ledger,
      pendingIntervention: appended.pendingIntervention,
      adaptationTrace: [
        traceEntry('persist_pending_intervention', state, {
          contract_id: appended.pendingIntervention.contract_id,
          action_type: appended.pendingIntervention.action_type,
        }),
      ],
    };
  };
}

export function buildGraph(options = {}) {
  const architecture = options.architecture ?? 'state_policy';
  if (!SUPPORTED_ARCHITECTURES.includes(architecture)) {
    throw new Error(
      `buildGraph: unsupported architecture "${architecture}". Expected one of: ${SUPPORTED_ARCHITECTURES.join(', ')}`,
    );
  }

  if (architecture === 'recognition_only') {
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitial)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  if (architecture === 'recognition_named_patterns') {
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitialNamedPatterns)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  if (architecture === 'bilateral_tom_id_director_v1') {
    // Variant A (lighter): profile → ToM → id-author → ego-execute → emit.
    // No superego, no constraint check, no revision. Loop back to
    // learnerProfileUpdate so the bilateral_tom state refreshes per turn.
    const learnerProfileUpdate = makeLearnerProfileUpdate(architecture);
    return new StateGraph(AdaptiveTutorState)
      .addNode('learnerProfileUpdate', learnerProfileUpdate)
      .addNode('tutorTomTracker', tutorTomTracker)
      .addNode('idAuthorPersona', idAuthorPersona)
      .addNode('tutorEgoExecute', tutorEgoExecute)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'learnerProfileUpdate')
      .addEdge('learnerProfileUpdate', 'tutorTomTracker')
      .addEdge('tutorTomTracker', 'idAuthorPersona')
      .addEdge('idAuthorPersona', 'tutorEgoExecute')
      .addEdge('tutorEgoExecute', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('learnerProfileUpdate'), ['learnerProfileUpdate', END]);
  }

  if (architecture === 'ego_superego') {
    // Always-revise: the superego unconditionally feeds back, the ego
    // unconditionally revises. This matches the project's two-pass posture
    // for the standard cells while keeping the path linear (no conditional
    // edge — no constraint check exists for this architecture).
    return new StateGraph(AdaptiveTutorState)
      .addNode('tutorEgoInitial', tutorEgoInitial)
      .addNode('tutorSuperegoReview', tutorSuperegoReview)
      .addNode('tutorEgoRevision', tutorEgoRevision)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorSuperegoReview')
      .addEdge('tutorSuperegoReview', 'tutorEgoRevision')
      .addEdge('tutorEgoRevision', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('tutorEgoInitial'), ['tutorEgoInitial', END]);
  }

  if (architecture === 'superego_revise_stateless' || architecture === 'superego_revise_cumulative') {
    // A16 (P2): the F-floor topology (= recognition_only — ego → emit →
    // learner, with NO learnerProfileUpdate / constraintCheck /
    // tutorEgoRevision) with a single superegoRevise node inserted BEFORE
    // the ego, so the rewritten system prompt is in force for the ego's one
    // call this turn. Holding the topology identical to the F floor
    // (cell_111 / recognition_only) makes the inserted superego-rewrite node
    // the sole architectural difference vs F; S0 vs S1 then differ only in
    // the revisionLedger statefulness inside that node — the two nested
    // contrasts the §6.3.10 pre-registration scores. Counterfactual replay
    // is a deliberate no-op here (no learnerProfileUpdate fork point — same
    // as recognition_only / ego_superego; runner.js gates on
    // ARCHITECTURES_WITH_PROFILE_UPDATE, which excludes these by design).
    const superegoRevise = makeSuperegoRevise(architecture);
    return new StateGraph(AdaptiveTutorState)
      .addNode('superegoRevise', superegoRevise)
      .addNode('tutorEgoInitial', tutorEgoInitial)
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'superegoRevise')
      .addEdge('superegoRevise', 'tutorEgoInitial')
      .addEdge('tutorEgoInitial', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('learnerTurn', routeAfterLearner('superegoRevise'), ['superegoRevise', END]);
  }

  if (architecture === 'state_policy_closed_loop') {
    const policyConfig = options.adaptivePolicy || {};
    const policyMode =
      options.adaptationPolicyMode || policyConfig.mode || process.env.ADAPTIVE_POLICY_MODE || 'closed_loop';
    return new StateGraph(AdaptiveTutorState)
      .addNode('close_previous_intervention', makeClosePreviousIntervention(policyMode, policyConfig))
      .addNode('realize_staged_followup', realizeStagedFollowupNode)
      .addNode('estimate_learner_state', makeEstimateLearnerState(policyMode, policyConfig))
      .addNode('select_pedagogical_action', makeSelectPedagogicalAction(policyMode, policyConfig))
      .addNode('validate_adaptation_contract', makeValidateAdaptationContract(policyMode, policyConfig))
      .addNode('realize_tutor_utterance', realizeTutorUtteranceNode)
      .addNode('verify_realization', verifyRealizationNode)
      .addNode('persist_pending_intervention', makePersistPendingIntervention(policyMode))
      .addNode('tutorEmit', tutorEmit)
      .addNode('learnerTurn', learnerTurn)
      .addEdge(START, 'close_previous_intervention')
      .addEdge('realize_staged_followup', 'tutorEmit')
      .addEdge('estimate_learner_state', 'select_pedagogical_action')
      .addEdge('select_pedagogical_action', 'validate_adaptation_contract')
      .addEdge('validate_adaptation_contract', 'realize_tutor_utterance')
      .addEdge('realize_tutor_utterance', 'verify_realization')
      .addEdge('verify_realization', 'persist_pending_intervention')
      .addEdge('persist_pending_intervention', 'tutorEmit')
      .addEdge('tutorEmit', 'learnerTurn')
      .addConditionalEdges('close_previous_intervention', routeAfterClosePrevious('estimate_learner_state'), [
        'realize_staged_followup',
        'estimate_learner_state',
        END,
      ])
      .addConditionalEdges('learnerTurn', routeAfterLearner('close_previous_intervention'), [
        'close_previous_intervention',
        END,
      ]);
  }

  // state_policy, state_policy_with_validator, bilateral_tom,
  // bilateral_tom_named_patterns, and the three state_policy_*_profile
  // ablations share the bulk of the graph. Conditional slots: validator
  // inserts between superego and constraint check (post-policy stricter
  // pass); tom-tracker inserts between profile update and ego (pre-policy
  // second-order context); named-patterns swaps the ego node function so
  // the prompt that surfaces meta-patterns is used while keeping the rest
  // of the topology identical. The state_policy_*_profile ablations share
  // the state_policy topology unchanged but project the LLM-emitted
  // profile to a subset of fields via PROFILE_PROJECTIONS.
  const includeValidator = architecture === 'state_policy_with_validator';
  const includeTomTracker =
    architecture === 'bilateral_tom' ||
    architecture === 'bilateral_tom_named_patterns' ||
    architecture === 'bilateral_tom_id_director_v2';
  const includeIdAuthor = architecture === 'bilateral_tom_id_director_v2';
  // A14 Stage 2a: evidence extractor inserts at the loop head so it fires
  // once per turn including turn 0 (where the opening learner message is
  // at the tail of state.dialogue). Loop-back point in the conditional
  // edge below switches from learnerProfileUpdate to evidenceExtractor.
  // Stage 3 adds the groundingValidator between updater and profileUpdate
  // when the architecture flag carries the `_validated` suffix.
  const includeExtractor =
    architecture === 'state_policy_evidence_bound' ||
    architecture === 'state_policy_evidence_bound_validated' ||
    architecture === 'state_policy_minimal_profile_evidence_bound_validated';
  const includeGroundingValidator =
    architecture === 'state_policy_evidence_bound_validated' ||
    architecture === 'state_policy_minimal_profile_evidence_bound_validated';
  const egoInitialFn = architecture === 'bilateral_tom_named_patterns' ? tutorEgoInitialNamedPatterns : tutorEgoInitial;
  const learnerProfileUpdate = makeLearnerProfileUpdate(architecture);
  const loopHeadNode = includeExtractor ? 'evidenceExtractor' : 'learnerProfileUpdate';

  const g = new StateGraph(AdaptiveTutorState)
    .addNode('learnerProfileUpdate', learnerProfileUpdate)
    .addNode('tutorEgoInitial', egoInitialFn)
    .addNode('tutorSuperegoReview', tutorSuperegoReview)
    .addNode('constraintCheck', constraintCheck)
    .addNode('tutorEgoRevision', tutorEgoRevision)
    .addNode('tutorEmit', tutorEmit)
    .addNode('learnerTurn', learnerTurn);

  if (includeExtractor) {
    // A14 Stage 2a wired the extractor at the loop head; Stage 2b inserts the
    // hypothesisUpdater between extractor and learnerProfileUpdate so the
    // updater sees fresh evidence from this turn before profileUpdate runs.
    // Stage 3 inserts groundingValidator between updater and profileUpdate
    // when the `_validated` architecture flag is set; profileUpdate then
    // sees the validator's promotions/retirements when constructing the
    // learnerProfile that downstream nodes consume.
    g.addNode('evidenceExtractor', evidenceExtractor)
      .addNode('hypothesisUpdater', hypothesisUpdater)
      .addEdge(START, 'evidenceExtractor')
      .addEdge('evidenceExtractor', 'hypothesisUpdater');
    if (includeGroundingValidator) {
      g.addNode('groundingValidator', groundingValidator)
        .addEdge('hypothesisUpdater', 'groundingValidator')
        .addEdge('groundingValidator', 'learnerProfileUpdate');
    } else {
      g.addEdge('hypothesisUpdater', 'learnerProfileUpdate');
    }
  } else {
    g.addEdge(START, 'learnerProfileUpdate');
  }

  if (includeTomTracker) {
    g.addNode('tutorTomTracker', tutorTomTracker).addEdge('learnerProfileUpdate', 'tutorTomTracker');
    if (includeIdAuthor) {
      g.addNode('idAuthorPersona', idAuthorPersona)
        .addEdge('tutorTomTracker', 'idAuthorPersona')
        .addEdge('idAuthorPersona', 'tutorEgoInitial');
    } else {
      g.addEdge('tutorTomTracker', 'tutorEgoInitial');
    }
  } else {
    g.addEdge('learnerProfileUpdate', 'tutorEgoInitial');
  }

  g.addEdge('tutorEgoInitial', 'tutorSuperegoReview');

  if (includeValidator) {
    g.addNode('tutorValidator', tutorValidator)
      .addEdge('tutorSuperegoReview', 'tutorValidator')
      .addEdge('tutorValidator', 'constraintCheck');
  } else {
    g.addEdge('tutorSuperegoReview', 'constraintCheck');
  }

  return g
    .addConditionalEdges('constraintCheck', routeAfterConstraint, ['tutorEgoRevision', 'tutorEmit'])
    .addEdge('tutorEgoRevision', 'tutorEmit')
    .addEdge('tutorEmit', 'learnerTurn')
    .addConditionalEdges('learnerTurn', routeAfterLearner(loopHeadNode), [loopHeadNode, END]);
}
