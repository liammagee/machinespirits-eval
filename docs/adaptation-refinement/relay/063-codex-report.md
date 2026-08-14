# 063 — Codex report: ruling-060b menu membership classified

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-N`, continued under direction 062

**Authority:** direction 062, ruling 060b, Amendment 1, and the frozen report-056 source table

## Boundary reached

The zero-call send-back is complete. Every rendered-menu candidate now records
its switching variable, whether the gate verdict / repair policy / register
selection can reach that variable, the IN/OUT verdict, and the trace. The menu
contains **63 instruction entries** from 87 classified candidates: 63 IN and 24
OUT. One OUT candidate, `tactic.support.0`, is the documented null branch and
contains no instruction bytes; the other 23 were removed as strings whose
switch the gate path cannot reach.

- Final A1 classification commit: `df187b0cd9177d69ecc8b8010c867ad865a438c4`
- Final pilot-manifest repin commit: `65029ccd`
- Menu JSON SHA-256:
  `ce8d88065fb7ce23f64a4ebc99a7b2a47615f0a453dabf8c97e27d9dfc073cb3`
- Menu text SHA-256:
  `966f3aa71dbcb907cf9f98e5d873c78ef00c697d29a4e6e360519a784d8257dd`
- Calls made under direction 062: **0**
- Seeds 515–517: claimed by the frozen manifest, still unspent
- Branch push: **none**

The full trace text is frozen in
`standing-permission-menu.json` under
`enumeration_rule.per_string_classification`; the table below gives the same
per-string switching variable, reachability, and verdict.

## Per-string classification

| String | Switching variable | Gate path reaches it? | Verdict |
|---|---|:---:|:---:|
| `uptake.default` | `progression.public_obligation_contract.complete` versus compact-uptake fallback | yes | IN |
| `uptake.accelerated` | learner-DAG `learner_advance.accelerated` | no | OUT |
| `uptake.learner_move` | learner text / composition-frame learner move | no | OUT |
| `uptake.writable_complementary` | writable-entry request + due release | no | OUT |
| `uptake.writable_causal` | writable-entry request + named causal contract | no | OUT |
| `uptake.writable_causal_generic` | writable-entry request + unnamed causal subject | no | OUT |
| `uptake.writable_record` | writable-entry request + rendered public record | no | OUT |
| `uptake.writable_record_fallback` | writable-entry request + no rendered public record | no | OUT |
| `uptake.responsive_repair` | `questionSupport.responsiveRepairRequired` | no | OUT |
| `opening.instructional_meta` | learner-classified discourse plane | no | OUT |
| `opening.writable_before_due_evidence` | writable-entry request + due release | no | OUT |
| `opening.writable_entry` | writable-entry request + no due release | no | OUT |
| `opening.default_response` | fallback after gate-reachable public-obligation branch | yes | IN |
| `part.compact_cue.adversarial_teacher` | selected actorial part | yes | IN |
| `part.compact_cue.advocate` | selected actorial part | yes | IN |
| `part.compact_cue.authored_source` | selected actorial part | yes | IN |
| `part.compact_cue.exacting_schoolmaster` | selected actorial part | yes | IN |
| `part.compact_cue.examiner` | selected actorial part | yes | IN |
| `part.compact_cue.foreperson` | selected actorial part | yes | IN |
| `part.compact_cue.record_keeper` | selected actorial part | yes | IN |
| `part.compact_cue.satirist` | selected actorial part | yes | IN |
| `part.compact_cue.scene_partner` | selected actorial part | yes | IN |
| `part.compact_cue.skeptic` | selected actorial part | yes | IN |
| `part.inline.scene_partner` | selected actorial part | yes | IN |
| `part.fallback` | selected actorial part | yes, doubtful unlisted-value reach retained IN | IN |
| `part.prop.existing` | scene budget + exhibit requirement | no | OUT |
| `part.prop.named` | scene budget + exhibit requirement | no | OUT |
| `part.wrapper` | selected actorial part + label | yes | IN |
| `tactic.execution.adversarial_pressure` | selected actorial performance | yes | IN |
| `tactic.execution.dramatic_counterpressure` | selected actorial performance | yes | IN |
| `tactic.execution.dry_counterexample` | selected actorial performance | yes | IN |
| `tactic.execution.evidentiary_boundary` | selected actorial performance | yes | IN |
| `tactic.execution.exposed_mismatch` | selected actorial performance | yes | IN |
| `tactic.execution.measured_testimony` | selected actorial performance | yes | IN |
| `tactic.execution.rapid_handoff` | selected actorial performance | yes | IN |
| `tactic.execution.shared_scene_invitation` | selected actorial performance | yes | IN |
| `tactic.execution.unadorned_report` | selected actorial performance | yes | IN |
| `tactic.support.3` | selected support level | yes | IN |
| `tactic.support.2` | selected support level | yes | IN |
| `tactic.support.1` | selected support level | yes | IN |
| `tactic.support.0` | selected support level zero / unset | yes, but renders no string | OUT |
| `tactic.source_accessibility.max_words` | source-accessibility mode + owner | no | OUT |
| `tactic.source_accessibility.material_tokens` | source-accessibility mode + owner | no | OUT |
| `tactic.source_accessibility.constraints` | source-accessibility mode + owner | no | OUT |
| `tactic.source_boundary` | active SOURCE presence | no | OUT |
| `tactic.delivered_boundary` | applicability of gate-selected tactic | yes | IN |
| `tactic.direction_only_rapid_handoff` | question support + gate-reachable selected tactic | yes | IN |
| `tactic.causal_performance` | writable causal contract | no | OUT |
| `tactic.question_boundary.handoff` | progression `question_allowed` | yes | IN |
| `tactic.question_boundary.none` | progression `question_allowed` | yes | IN |
| `tactic.question_owned.rapid_handoff` | selected tactic + question ownership | yes | IN |
| `tactic.question_owned.shared_scene_invitation` | selected tactic + question ownership | yes | IN |
| `tactic.question_owned.general` | selected tactic + question ownership | yes | IN |
| `stance.compact_cue.brisk` | selected engagement stance | yes | IN |
| `stance.compact_cue.charismatic` | selected engagement stance | yes | IN |
| `stance.compact_cue.face_threat` | selected engagement stance | yes | IN |
| `stance.compact_cue.ironic` | selected engagement stance | yes | IN |
| `stance.compact_cue.plain` | selected engagement stance | yes | IN |
| `stance.compact_cue.precise` | selected engagement stance | yes | IN |
| `stance.compact_cue.sarcastic` | selected engagement stance | yes | IN |
| `stance.compact_cue.warm` | selected engagement stance | yes | IN |
| `stance.compact_cue.witnessing` | selected engagement stance | yes | IN |
| `stance.fallback` | selected engagement stance | yes, doubtful unlisted-value reach retained IN | IN |
| `handoff.settled` | conversational-completion settled bookkeeping | no | OUT |
| `handoff.bridge` | sibling-relation bridge flag | yes | IN |
| `handoff.declarative_fallback` | absent compiled handoff instruction | no | OUT |
| `handoff.public_limit` | handoff mode + question requirement | yes | IN |
| `handoff.optional_question` | handoff mode + question requirement | yes | IN |
| `handoff.source_question` | selected `stage_next_step` with active source | yes | IN |
| `handoff.action_question` | selected compact action + default handoff | yes | IN |
| `handoff.bounded_choices` | question-support bounded-choice modality | no | OUT |
| `handoff.clarification_invitation` | question-support clarification flag | no | OUT |
| `action.override.closure` | closure after gate inquiry-completion constraint | yes | IN |
| `action.override.responsive_repair` | `questionSupport.responsiveRepairRequired` | no | OUT |
| `action.override.active_source` | selected `stage_next_step` with active source | yes | IN |
| `action.compact_cue.answer_accountably` | selected action family | yes | IN |
| `action.compact_cue.baseline_plain_response` | selected action family | yes | IN |
| `action.compact_cue.challenge_resistance` | selected action family | yes | IN |
| `action.compact_cue.clarify_distinction` | selected action family | yes | IN |
| `action.compact_cue.clarify_term` | selected action family | yes | IN |
| `action.compact_cue.close_inquiry` | selected action family | yes | IN |
| `action.compact_cue.compress_sayback` | selected action family | yes | IN |
| `action.compact_cue.ground_in_material` | selected action family | yes | IN |
| `action.compact_cue.reanchor_lived_stake` | selected action family | yes | IN |
| `action.compact_cue.reanchor_public_evidence` | selected action family | yes | IN |
| `action.compact_cue.receive_vulnerability` | selected action family | yes | IN |
| `action.compact_cue.stage_next_step` | selected action family | yes | IN |

The question-boundary pair stays IN after tracing: although question-support
state is an input, the gate-selected action family and public-obligation
directive both feed `chooseHandoffMode`, which sets
`progression.handoff_contract.question_allowed`. The bounded-choice and
clarification additions are different: `buildHostPlan` appends them directly
from question-support fields the gate cannot write, so they are OUT.

## Removal list and traces

- `uptake.accelerated` — learner-DAG acceleration is computed from learner
  state before response configuration; the gate path does not write it.
- `uptake.learner_move` — copied from learner text and the learner composition
  frame; the gate path cannot change that field.
- `uptake.writable_complementary` — switched by learner writable-entry wording
  plus due evidence, both upstream of the gate.
- `uptake.writable_causal` — switched by learner writable-entry wording plus a
  causal contract derived from committed public evidence; neither is gate-owned.
- `uptake.writable_causal_generic` — same upstream writable/evidence trace as
  the named causal branch.
- `uptake.writable_record` — switched by learner writable-entry wording plus
  rendered-record availability; neither is gate-owned.
- `uptake.writable_record_fallback` — the complementary no-record branch of the
  same unreachable writable/evidence switch.
- `uptake.responsive_repair` — switched by
  `questionSupport.responsiveRepairRequired`, compiled upstream from the learner
  turn.
- `opening.instructional_meta` — switched by the learner-wording discourse-plane
  classifier; instructional repair structurally overrides gate selections.
- `opening.writable_before_due_evidence` — switched by learner writable-entry
  wording plus due release, both outside the gate path.
- `opening.writable_entry` — switched by learner writable-entry wording plus
  absence of due release, both outside the gate path.
- `part.prop.existing` — switched by scene-action saturation and exhibit state;
  the gate does not write either variable.
- `part.prop.named` — the complementary branch of the same unreachable
  scene/exhibit switch.
- `tactic.support.0` — support level zero is reachable, but
  `compactSupportInstruction` returns `''`; the null branch injects no words and
  is therefore documented rather than quoted as a menu entry.
- `tactic.source_accessibility.max_words` — switched by source-accessibility
  mode and ownership compiled from source policy / due-source state, not the
  gate.
- `tactic.source_accessibility.material_tokens` — same source-policy switch.
- `tactic.source_accessibility.constraints` — same source-policy switch.
- `tactic.source_boundary` — switched only by active SOURCE presence, fixed by
  dramatic release state before the speaking configuration.
- `tactic.causal_performance` — switched by the writable causal contract from
  learner wording and committed evidence, neither gate-owned.
- `handoff.settled` — switched by conversational-completion settled-surface
  bookkeeping copied from learner state.
- `handoff.declarative_fallback` — switched by absence of
  `handoff_contract.instruction`; the progression compiler always supplies that
  instruction, and the gate cannot create the missing-instruction condition.
- `handoff.bounded_choices` — appended directly from question-support modality,
  which the gate cannot write.
- `handoff.clarification_invitation` — appended directly from the
  question-support clarification flag, which the gate cannot write.
- `action.override.responsive_repair` — switched by the same upstream
  `questionSupport.responsiveRepairRequired` field as the removed uptake string.

## Frozen source SHA table

This table equals report 056 exactly:

| Source | SHA-256 |
|---|---|
| `services/tutorStubWarrantGate.js` | `db30f563bb5107544f0f64677410f3e67cb2f0f2fbe573d4c5d66976b791fc24` |
| `services/adaptiveWarrantPolicy.js` | `9edce479cca6dfde74a2a48f8321cbd3366ee0a97e4ac3e6565b656de0212c1d` |
| `services/tutorStubFirstDraftContract.js` | `868c5ef7af8677a59cbf391cc0948c71cb567802e4d7d15d6f980366db707a29` |
| `services/tutorStubQuestionSupport.js` | `6084936a3dd7093a14b4ef76eb6914549064bf095bf7bc1c8b5e15eba168dfa3` |
| `config/engagement-registers.yaml` | `6284ffb82d8fe151312c05d6426f809de43addfe5275bbd5f70cbd39361a84c2` |

## Verification boundary

Final post-classification results:

```text
node --test --test-name-pattern='standing-permission byte guard' tests/adaptiveWarrantOutcomeStudy.test.js
4/4 passed

node --test tests/adaptiveWarrantOutcomeStudy.test.js
18/18 passed

node --test tests/adaptiveWarrantOutcomeStudy.test.js tests/tutorStubCliHelp.test.js tests/tutorStubCliParsing.test.js tests/tutorStubAutoEvalEvidence.test.js
34/34 passed

npx eslint scripts/prepare-adaptive-warrant-outcome-study.js tests/adaptiveWarrantOutcomeStudy.test.js
PASS
```

The drift guard checks the complete 63-entry menu, the 87-row membership
classification, source pins, exact quotes and fixed template segments, prefixes,
source selectors, duplicates, rendered text, altered-byte failure, missing-branch
failure, and classification-drift failure. The pilot manifest was then repinned
and verified against the files on disk; its report-056 source table is unchanged.

## Planned-call arithmetic and HOLD

The registered arithmetic is unchanged:

- generation: 18 dialogues = **18 calls**;
- extracted cases: 18 × 8 = **144**;
- presence readers: 2 × 144 = **288 calls**;
- decision readers: 2 × 144 = **288 calls**;
- planned pilot: 18 + 288 + 288 = **594 calls**;
- counter on completion: **3,523 + 594 = 4,117 / 11,337**;
- remaining ceiling on completion: **7,220 calls**.

Budget remains **3,523 / 11,337** because this direction spent zero calls. No
r47, r49, or r52 response was admitted or pooled. The paid-call HOLD remains
absolute until the sibling byte review, reviewer manifest re-check, and a
committed reviewer GO note. No pilot process is running and the branch was not
pushed.
