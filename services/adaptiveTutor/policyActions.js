// Closed set of pedagogical actions the tutor can pick at each turn.
//
// Used as the policy-action enum across the adaptive cell:
// - mockLLM and realLLM both emit one of these labels per turn
// - constraintCheck conditions on these labels
// - analyze-strategy-shift.js scores them against scenario-defined expected shifts
//
// The 14 actions roughly mirror gpt-pro's policy taxonomy. They are *control
// labels*, not free-form descriptions; the prompt language tutoring teachers
// would actually use is in the tutor message text, not here.

export const POLICY_ACTIONS = Object.freeze([
  'ask_diagnostic_question',
  'mirror_and_extend',
  'scope_test',
  'repair_misrecognition',
  'give_worked_example',
  'lower_cognitive_load',
  'provide_hint',
  'request_elaboration',
  'acknowledge_and_redirect',
  'name_the_disagreement',
  'withhold_answer',
  'summarize_and_check',
  'pose_counterexample',
  'invite_objection',
]);

export const POLICY_ACTION_DESCRIPTIONS = Object.freeze({
  ask_diagnostic_question: 'Probe the learner with a question whose answer reveals what they actually believe.',
  mirror_and_extend: 'Restate the learner\'s point in tighter form and push it one logical step further.',
  scope_test: 'Propose a boundary or limit case to test whether the learner\'s claim still holds.',
  repair_misrecognition: 'Explicitly correct an earlier misread of the learner\'s position before continuing.',
  give_worked_example: 'Demonstrate a complete worked example end-to-end.',
  lower_cognitive_load: 'Slow the dialogue down or simplify the framing for an overloaded learner.',
  provide_hint: 'Offer a partial scaffold without giving away the answer.',
  request_elaboration: 'Ask the learner to expand their reasoning, not their conclusion.',
  acknowledge_and_redirect: 'Recognise an affective signal explicitly, then redirect productively.',
  name_the_disagreement: 'Make the substantive point of disagreement explicit instead of papering it over.',
  withhold_answer: 'Refuse to give the answer in order to keep the learner in productive struggle.',
  summarize_and_check: 'Consolidate the dialogue so far and verify shared understanding.',
  pose_counterexample: 'Present a counterexample that challenges the learner\'s current claim.',
  invite_objection: 'Explicitly invite the learner to push back ("what are you not buying here?").',
});

export const isPolicyAction = (s) => POLICY_ACTIONS.includes(s);
