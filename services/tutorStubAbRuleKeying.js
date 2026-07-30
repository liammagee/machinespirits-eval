/**
 * Which broken rules a tutor could have avoided without being told anything.
 *
 * The A/B bench computes a per-turn performance contract for every turn and
 * grades every version of the tutor against it, but shows that contract to only
 * one of them. So the headline count of broken rules is not a ruler the versions
 * start level on: some rules ask "did you use the part your plan named", which a
 * tutor holding no plan cannot win at all.
 *
 * The test applied here is deliberately narrow, and it is not "does the rule
 * read private data". It is:
 *
 *   Could a tutor handed nothing but the public transcript and the learner's
 *   turn have satisfied this rule?
 *
 * A prohibition — do not repeat yourself, do not state the answer early, do not
 * claim two exhibits match before that is public — passes the test. Any version
 * satisfies it by not doing the thing, and the bare tutor's ignorance costs it
 * nothing. Graded `open`.
 *
 * A rule that requires saying a particular thing, or saying it a particular way,
 * where the particular is fixed by the plan's own named slots or by a release
 * schedule in the world file that only the plan relays, fails the test. Graded
 * `told`.
 *
 * The `open` total is the number to compare versions on. The `told` total is
 * still worth keeping and printing: the gap between them is the size of the
 * bench's own bias, measured rather than asserted.
 *
 * A rule nobody has classified is counted apart and printed, never folded into
 * either total. Summarising must not throw — that would lose a paid run at the
 * last step — so drift is caught by a test over the recorded corpus instead.
 */

export const TUTOR_STUB_AB_RULE_KEYING_SCHEMA = 'tutor-stub-ab-rule-keying@1';

export const RULE_KEYING_OPEN = 'open';
export const RULE_KEYING_TOLD = 'told';
export const RULE_KEYING_UNCLASSIFIED = 'unclassified';

/**
 * Keyed by the issue type alone, not `guardFamily:issueType`. The same issue
 * type is raised by more than one guard family — the live and V2 turn-progression
 * audits both raise `learner_uptake_not_realized`, and a recovery pass re-raises
 * names it did not author — and the answer to "could an untold tutor have
 * avoided this" does not change with the family that noticed it.
 *
 * Each entry states its class outright. Do not derive the class from the reason
 * text: rewording a comment must never move a number.
 */
const RULE_KEYING = new Map(
  Object.entries({
    // --- told: the plan's own named slots -----------------------------------
    // The response configuration picks a public part and a performance tactic
    // for the turn; these ask whether the reply performed the ones it picked.
    missing_selected_actorial_part: ['told', 'the plan names which public part to play'],
    missing_selected_performance_tactic: ['told', 'the plan names which tactic to make visible'],
    invalid_actorial_performance_scope: ['told', 'the plan defines the scope this is measured in'],
    composite_part_requirement_failed: ['told', 'the plan names the parts that compose the turn'],
    // The handoff contract decides whether this turn may ask a question at all,
    // must ask one, and which terms its last sentence has to carry. None of that
    // is legible from the public scene.
    question_forbidden_by_handoff_contract: ['told', 'only the plan says a question is barred this turn'],
    required_handoff_question_missing: ['told', 'only the plan says a question is required this turn'],
    handoff_question_not_terminal: ['told', 'the plan sets whether a question must end the turn'],
    question_outside_terminal_handoff: ['told', 'the slot boundaries are the plan’s'],
    question_in_non_owner_slot: ['told', 'the slot boundaries are the plan’s'],
    handoff_loses_turn_focus: ['told', 'the plan names the terms the last sentence must carry'],
    settled_point_requestioned: ['told', 'the plan supplies the list of settled points'],
    redundant_local_requestion: ['told', 'the plan supplies the list of settled points'],
    resolved_point_reopened: ['told', 'the plan supplies the list of settled points'],
    unlicensed_requested_entry: ['told', 'gated on a causal-relation contract only the plan carries'],
    // --- told: a release schedule only the plan relays ------------------------
    // The world file schedules which evidence falls due at which turn. Every
    // version is graded against that schedule; one version is shown it.
    missing_due_evidence: ['told', 'the world file schedules which evidence is due now'],
    missing_required_evidence: ['told', 'the world file schedules which evidence is due now'],
    duplicate_obligation_evidence: ['told', 'the world file schedules which evidence is due now'],
    opening_clue_missing: ['told', 'the world file schedules which clue opens the turn'],
    due_source_exact_occurrence_count: ['told', 'demands the plan’s host-rendered source text verbatim'],
    due_source_action_referent_missing: ['told', 'demands the plan’s host-rendered source text verbatim'],
    source_accessibility_compensation: ['told', 'demands the plan’s host-rendered source text verbatim'],
    source_surface_accessibility: ['told', 'demands the plan’s host-rendered source text verbatim'],
    quoted_source_changed: ['told', 'demands the plan’s host-rendered source text verbatim'],
    invalid_source_provenance: ['told', 'demands the plan’s host-rendered source text verbatim'],
    // These fire on any turn the world file has evidence falling due, and ask
    // the reply to stage a clue it was never told about.
    opaque_clue_release: ['told', 'asks for a staged entrance for an unannounced clue'],
    missing_in_scene_enactment: ['told', 'asks the reply to voice a clue source it was not given'],
    missing_exhibit_action: ['told', 'asks the reply to show an exhibit it was not given'],
    // --- open: prohibitions, satisfied by not doing the thing ----------------
    unreleased_premise_content: ['open', 'a prohibition — say nothing not yet released'],
    private_final_conclusion: ['open', 'a prohibition — do not state the answer early'],
    private_blank_conclusion: ['open', 'a prohibition — do not state the answer early'],
    private_die_conclusion: ['open', 'a prohibition — do not state the answer early'],
    concealed_answer_name: ['open', 'a prohibition — do not name the concealed answer'],
    unsupported_evidence_correspondence: ['open', 'a prohibition — do not claim a match before it is public'],
    unsupported_endorsement_request: ['open', 'a prohibition — do not ask to be endorsed'],
    abstract_proof_language: ['open', 'a prohibition — no internal proof labels in public speech'],
    harness_machinery_in_public_speech: ['open', 'a prohibition — do not surface the machinery'],
    instructional_meta: ['open', 'a prohibition — do not narrate the lesson from outside it'],
    fourth_wall_break: ['open', 'a prohibition — stay inside the scene'],
    meta_dramatic_announcement: ['open', 'a prohibition — enact rather than announce'],
    role_label_stage_direction: ['open', 'a prohibition — speak from inside the role'],
    source_perspective_drift: ['open', 'a prohibition — keep a deed off the source’s first person'],
    duplicate_clue_delivery: ['open', 'a prohibition — deliver a clue once'],
    fabricated_self_correction_quote: ['open', 'a prohibition — do not invent a quote to correct'],
    unverified_public_input: ['open', 'a prohibition — do not treat unchecked input as established'],
    repeated_tutor_sentence: ['open', 'a prohibition — do not repeat yourself'],
    repeated_tutor_opening: ['open', 'a prohibition — do not repeat yourself'],
    repeated_tutor_response: ['open', 'a prohibition — do not repeat yourself'],
    verbatim_repetition: ['open', 'a prohibition — do not repeat yourself'],
    verbatim_learner_echo: ['open', 'a prohibition — do not parrot the learner'],
    empty_restatement: ['open', 'a prohibition — do not restate without developing'],
    // --- open: judged against the public turn and the reply ------------------
    // The learner's own words reach every version, and echoing them in a
    // responsive opening satisfies the uptake rules with no focus terms at all.
    learner_uptake_not_realized: ['open', 'satisfiable by echoing the learner’s own public words'],
    missing_learner_uptake: ['open', 'satisfiable by answering the learner first'],
    generic_learner_uptake: ['open', 'satisfiable by answering the learner first'],
    missing_tutor_development: ['open', 'satisfiable by developing past the opening'],
    missing_restatement_bridge: ['open', 'satisfiable by bridging from the learner’s words'],
    proposed_move_misread_as_completed: ['open', 'read off the learner’s public turn'],
    conditional_answer_misread_as_present_claim: ['open', 'read off the learner’s public turn'],
    learner_selected_test_not_acknowledged: ['open', 'read off the learner’s public turn'],
    live_question_lost: ['open', 'read off the learner’s public turn'],
    open_learner_owned_question: ['open', 'read off the learner’s public turn'],
    off_task_or_mixed: ['open', 'read off the learner’s public turn'],
    // The question-support frame is built from the learner's own signals of
    // struggle, so a version reading the learner can see the same thing.
    unanswerable_open_recall: ['open', 'a pattern on the reply — do not ask for what is not in the scene'],
    missing_clarification_invitation: ['open', 'the learner’s difficulty is visible in their own turn'],
    missing_direct_response: ['open', 'the learner said in public that they were not answered'],
    missing_bounded_choice: ['open', 'the learner’s repeated uncertainty is visible in their own turn'],
    // Shape rules on the reply itself.
    multiple_questions_violate_terminal_handoff: ['open', 'a count of questions in the reply, nothing else'],
    multiple_closure_questions: ['open', 'a count of questions in the reply, nothing else'],
    missing_return_to_inquiry: ['open', 'satisfiable by ending on what changes'],
    opening_invitation_missing: ['open', 'a shape rule on the reply'],
    missing_explicit_dialogue_close: ['open', 'a shape rule on the reply'],
    closure_response_opens_another_turn: ['open', 'a shape rule on the reply'],
    closure_reopens_proof_work: ['open', 'a shape rule on the reply'],
    terminal_closure: ['open', 'a shape rule on the reply'],
    declarative_shared_attention: ['open', 'a shape rule on the reply'],
    sibling_relation_without_explicit_bridge: ['open', 'a shape rule on the reply'],
    non_mechanical_quarantine_surface: ['open', 'a shape rule on the reply'],
    missing_public_anchor: ['open', 'satisfiable by naming something already in the scene'],
  }),
);

for (const [rule, entry] of RULE_KEYING) {
  if (entry[0] !== RULE_KEYING_OPEN && entry[0] !== RULE_KEYING_TOLD) {
    throw new Error(`rule ${rule} must be graded open or told, got ${entry[0]}`);
  }
}

/** Strip the guard family from a `guardFamily:issueType` name. */
export function tutorStubAbRuleName(cluster) {
  const text = String(cluster || '');
  const colon = text.lastIndexOf(':');
  return colon === -1 ? text : text.slice(colon + 1);
}

/**
 * `open` when an untold tutor could have satisfied the rule, `told` when it
 * could not, `unclassified` when nobody has decided yet.
 */
export function tutorStubAbRuleKeying(cluster) {
  return RULE_KEYING.get(tutorStubAbRuleName(cluster))?.[0] || RULE_KEYING_UNCLASSIFIED;
}

/** Why a rule was graded the way it was — for the report, and for arguing with. */
export function tutorStubAbRuleKeyingReason(cluster) {
  return RULE_KEYING.get(tutorStubAbRuleName(cluster))?.[1] || null;
}

/** Every rule name that has been classified, for tests and for the docs. */
export function tutorStubAbClassifiedRules() {
  return [...RULE_KEYING.keys()].sort();
}

/**
 * Split a list of broken-rule names into the two totals plus anything unknown.
 * Counts, not sets: a rule broken on four turns counts four times, the same way
 * the headline total does.
 */
export function splitTutorStubAbClusters(clusters = []) {
  const split = { open: 0, told: 0, unclassified: 0, unclassifiedRules: [] };
  const unknown = new Set();
  for (const cluster of clusters) {
    const keying = tutorStubAbRuleKeying(cluster);
    split[keying] += 1;
    if (keying === RULE_KEYING_UNCLASSIFIED) unknown.add(cluster);
  }
  split.unclassifiedRules = [...unknown].sort();
  return split;
}
