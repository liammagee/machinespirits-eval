# Charisma Desire Resistance-Breakthrough Matrix

Generated: 2026-08-07T17:57:44.499Z

Status: `ANALYZED_ROWS`

## Scope

- No generation and no judge calls.
- Matrix unit: five target resistance signals x router profile versus static-floor dynamic comparator.
- Outcome unit: generated resistant learner turn -> tutor response -> generated learner uptake.
- Router profile: `cell_185_id_director_charisma_resistance_breakthrough_dynamic_verified`.
- Tuned router profile: `cell_187_id_director_charisma_resistance_tuned_breakthrough_dynamic_verified`.
- Owned-test router profile: `cell_188_id_director_charisma_resistance_owned_test_breakthrough_dynamic_verified`.
- Precision router profile: `cell_189_id_director_charisma_resistance_precision_breakthrough_dynamic_verified`.
- Generation router profile: `cell_190_id_director_charisma_resistance_generation_breakthrough_dynamic_verified`.
- Question-lock router profile: `cell_191_id_director_charisma_resistance_question_lock_breakthrough_dynamic_verified`.
- Commitment-probe router profile: `cell_192_id_director_charisma_resistance_commitment_probe_breakthrough_dynamic_verified`.
- Boredom-stake router profile: `cell_193_id_director_charisma_resistance_boredom_stake_breakthrough_dynamic_verified`.
- GLM-compact router profile: `cell_194_id_director_charisma_resistance_glm_compact_breakthrough_dynamic_verified`.
- Ironic assigned-arm profile: `cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified`.
- Sarcastic assigned-arm profile: `cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified`.
- Face-threat simulated-only assigned-arm profile: `cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified`.
- Static-floor comparator: `cell_186_id_director_charisma_static_floor_breakthrough_dynamic_verified`.

## Validation

- Controlled scenarios and target gates validate.

## Negative-Register Effect Grid

Status: `COMPLETE`

- Coverage: 45/45 assigned rows.
- Assigned-arm estimands include every assigned row; faithful-arm estimands include only stance-gate evidence rows.
- Treatment noncompliance and invalid person-attack violations remain separate failure categories.

| Arm | Assigned | Assigned positive | Assigned v2.2 | Assigned register | Faithful | Faithful positive | Faithful v2.2 | Faithful register | Excluded | Invalid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ironic | 15 | 10/15 | 53.2 | 81.2 | 6 | 5/6 | 60.4 | 86.3 | 9 | 0 |
| sarcastic | 15 | 7/15 | 57.4 | 66.2 | 8 | 5/8 | 55.8 | 67.9 | 7 | 0 |
| face_threat | 15 | 12/15 | 55.9 | 57.1 | 4 | 3/4 | 60.3 | 34.8 | 10 | 1 |

### What each arm was asked to do

The counts above are not one demand met to different degrees. Each arm carries its own list of mandated moves, and a stance with no rubric of its own is scored by another instrument. Read a difference between arms with this table beside it.

| Stance | mandated moves | scored by |
| --- | --- | --- |
| face_threat | visible local face-threat cue; visible local face threat; explicit instrument-stress contrast; minimal repair path | config/rubrics/registers/irony-sarcasm.yaml |
| ironic | visible ironic cue; legible ironic gap; learner-owned unmasking move; answerable next test | config/rubrics/registers/irony-sarcasm.yaml |
| sarcastic | visible dry-sarcastic cue; dry sarcastic contrast; target aimed at idea or work; concrete next move | config/rubrics/registers/irony-sarcasm.yaml |

- **warning** — these stances mandate different moves — required of face_threat alone: visible local face-threat cue, visible local face threat, explicit instrument-stress contrast, minimal repair path; required of ironic alone: visible ironic cue, legible ironic gap, learner-owned unmasking move, answerable next test; required of sarcastic alone: visible dry-sarcastic cue, dry sarcastic contrast, target aimed at idea or work, concrete next move; nothing is required of all of them.

### Target x arm

| Target/arm | Assigned | Assigned positive | Assigned v2.2 | Assigned register | Faithful | Faithful positive | Faithful v2.2 | Faithful register | Excluded | Invalid |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| boredom::ironic | 3 | 1/3 | 40.8 | 73.0 | 0 | 0/0 | - | - | 3 | 0 |
| boredom::sarcastic | 3 | 1/3 | 57.5 | 79.0 | 2 | 1/2 | 62.5 | 79.3 | 1 | 0 |
| boredom::face_threat | 3 | 2/3 | 47.5 | 77.2 | 0 | 0/0 | - | - | 3 | 0 |
| frustration::ironic | 3 | 3/3 | 53.3 | 73.3 | 1 | 1/1 | 47.5 | 76.5 | 2 | 0 |
| frustration::sarcastic | 3 | 3/3 | 51.3 | 73.0 | 3 | 3/3 | 51.3 | 73.0 | 0 | 0 |
| frustration::face_threat | 3 | 3/3 | 56.7 | 50.7 | 1 | 1/1 | 61.3 | 34.5 | 2 | 0 |
| irrelevance::ironic | 3 | 2/3 | 54.2 | 84.2 | 0 | 0/0 | - | - | 3 | 0 |
| irrelevance::sarcastic | 3 | 2/3 | 53.8 | 81.5 | 1 | 1/1 | 40.0 | 85.0 | 2 | 0 |
| irrelevance::face_threat | 3 | 2/3 | 52.9 | 46.8 | 1 | 1/1 | 61.3 | 31.0 | 1 | 1 |
| question_flood::ironic | 3 | 3/3 | 62.9 | 90.8 | 3 | 3/3 | 62.9 | 90.8 | 0 | 0 |
| question_flood::sarcastic | 3 | 0/3 | 62.1 | 47.0 | 1 | 0/1 | 63.8 | 44.0 | 2 | 0 |
| question_flood::face_threat | 3 | 2/3 | 65.0 | 63.2 | 1 | 0/1 | 57.5 | 52.0 | 2 | 0 |
| rote_parroting::ironic | 3 | 1/3 | 54.6 | 84.8 | 2 | 1/2 | 63.1 | 84.5 | 1 | 0 |
| rote_parroting::sarcastic | 3 | 1/3 | 62.5 | 50.7 | 1 | 0/1 | 63.8 | 37.0 | 2 | 0 |
| rote_parroting::face_threat | 3 | 3/3 | 57.5 | 47.7 | 1 | 1/1 | 61.3 | 21.5 | 2 | 0 |

## Negative-Register Stance Gate

- Gate rule: only `faithful` rows count as assigned-register effect evidence for negative-register arms.
- `weak_or_warm_in_costume` and `not_instantiated` are treatment-noncompliance exclusions; `invalid_person_attack` is a corrosive violation, not successful register execution.
- Overall: 18/45 faithful evidence rows; 13/18 faithful positive local outcomes; 26 noncompliance exclusions; 1 invalid violations.

| Arm | Assigned rows | Faithful evidence | Faithful positive | Excluded | Invalid | Mean fidelity | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ironic | 15 | 6/15 | 5/6 | 9 | 0 | 77.7 | weak_or_warm_in_costume:9, faithful:6 |
| sarcastic | 15 | 8/15 | 5/8 | 7 | 0 | 80.0 | weak_or_warm_in_costume:7, faithful:8 |
| face_threat | 15 | 4/15 | 3/4 | 10 | 1 | 69.0 | weak_or_warm_in_costume:10, faithful:4, invalid_person_attack:1 |

## Arm Summary

| Arm | Rows | Eligible | Candidates | Positive | Rote owned | Route hits | Target matches | Gate matches | Answer-first | Usable commit | Reopened | Residual flood | Mean score | Mean register score | Reg recog | Reg uptake | Reg repair | Faithful evidence | Faithful positive | Excluded | Invalid | Stance fidelity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ironic | 15 | 14/15 | 6/15 | 10/15 | 1/15 | 15/15 (100%) | 14/15 | 14/15 | 2/15 | 2/15 | 0/15 | 0/15 | 84.7 | 81.2 | 4.5 | 4.9 | 4.5 | 6/15 | 5/6 | 9 | 0 | 6/15 (77.7) |
| sarcastic | 15 | 15/15 | 3/15 | 7/15 | 1/15 | 15/15 (100%) | 15/15 | 15/15 | 0/15 | 0/15 | 3/15 | 3/15 | 81.3 | 66.2 | 3.6 | 4.5 | 3.7 | 8/15 | 5/8 | 7 | 0 | 8/15 (80.0) |
| face_threat | 15 | 14/15 | 7/15 | 12/15 | 2/15 | 15/15 (100%) | 14/15 | 15/15 | 1/15 | 0/15 | 2/15 | 1/15 | 80.7 | 57.1 | 3.3 | 4.1 | 3.5 | 4/15 | 3/4 | 10 | 1 | 4/15 (69.0) |

## Target x Arm

| Target/Arm | Rows | Eligible | Candidates | Positive | Rote owned | Route hits | Gate matches | Answer-first | Usable commit | Reopened | Residual flood | Mean score | Mean register score | Reg recog | Reg uptake | Reg repair | Faithful evidence | Faithful positive | Excluded | Invalid | Stance fidelity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| boredom::ironic | 3 | 3/3 | 1/3 | 1/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 90.0 | 73.0 | 4.0 | 4.7 | 4.0 | 0/3 | 0/0 | 3 | 0 | 0/3 (65.0) |
| boredom::sarcastic | 3 | 3/3 | 1/3 | 1/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 80.0 | 79.0 | 4.0 | 5.0 | 4.0 | 2/3 | 1/2 | 1 | 0 | 2/3 (83.3) |
| boredom::face_threat | 3 | 3/3 | 2/3 | 2/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 86.7 | 77.2 | 4.7 | 4.7 | 4.7 | 0/3 | 0/0 | 3 | 0 | 0/3 (65.0) |
| frustration::ironic | 3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 85.0 | 73.3 | 4.3 | 5.0 | 4.3 | 1/3 | 1/1 | 2 | 0 | 1/3 (70.0) |
| frustration::sarcastic | 3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 85.0 | 73.0 | 4.0 | 4.0 | 3.7 | 3/3 | 3/3 | 0 | 0 | 3/3 (100.0) |
| frustration::face_threat | 3 | 3/3 | 0/3 | 3/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 76.7 | 50.7 | 3.3 | 4.3 | 3.3 | 1/3 | 1/1 | 2 | 0 | 1/3 (70.0) |
| irrelevance::ironic | 3 | 2/3 | 2/3 | 2/3 | 0/3 | 3/3 | 2/3 | 0/3 | 0/3 | 0/3 | 0/3 | 78.3 | 84.2 | 5.0 | 5.0 | 5.0 | 0/3 | 0/0 | 3 | 0 | 0/3 (65.0) |
| irrelevance::sarcastic | 3 | 3/3 | 2/3 | 2/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 83.3 | 81.5 | 4.0 | 4.7 | 4.3 | 1/3 | 1/1 | 2 | 0 | 1/3 (70.0) |
| irrelevance::face_threat | 3 | 2/3 | 2/3 | 2/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 81.7 | 46.8 | 2.7 | 3.7 | 2.7 | 1/3 | 1/1 | 1 | 1 | 1/3 (61.7) |
| question_flood::ironic | 3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 | 2/3 | 2/3 | 0/3 | 0/3 | 95.0 | 90.8 | 5.0 | 5.0 | 4.7 | 3/3 | 3/3 | 0 | 0 | 3/3 (100.0) |
| question_flood::sarcastic | 3 | 3/3 | 0/3 | 0/3 | 0/3 | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 | 85.0 | 47.0 | 3.3 | 4.7 | 3.3 | 1/3 | 0/1 | 2 | 0 | 1/3 (76.7) |
| question_flood::face_threat | 3 | 3/3 | 2/3 | 2/3 | 0/3 | 3/3 | 3/3 | 1/3 | 0/3 | 2/3 | 1/3 | 78.3 | 63.2 | 3.3 | 4.3 | 4.0 | 1/3 | 0/1 | 2 | 0 | 1/3 (71.7) |
| rote_parroting::ironic | 3 | 3/3 | 0/3 | 1/3 | 1/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 75.0 | 84.8 | 4.3 | 4.7 | 4.3 | 2/3 | 1/2 | 1 | 0 | 2/3 (88.3) |
| rote_parroting::sarcastic | 3 | 3/3 | 0/3 | 1/3 | 1/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 73.3 | 50.7 | 2.7 | 4.3 | 3.0 | 1/3 | 0/1 | 2 | 0 | 1/3 (70.0) |
| rote_parroting::face_threat | 3 | 3/3 | 1/3 | 3/3 | 2/3 | 3/3 | 3/3 | 0/3 | 0/3 | 0/3 | 0/3 | 80.0 | 47.7 | 2.7 | 3.3 | 2.7 | 1/3 | 1/1 | 2 | 0 | 1/3 (76.7) |


## Question-Flood Gate

Status: `PENDING_NO_COMMITMENT_PROBE_ROWS`

- Promotion rule: promote `cell_192` for question-flood only if it has at least 2 rows, clean route/gate preconditions, candidate rate at least the current comparators, usable-commitment rate at least the current comparators, and zero reopened or residual-flood outcomes.

| Arm | Rows | Candidates | Route hits | Gate matches | Answer-first | Usable commit | Reopened | Residual flood |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| router_owned_test | 0 | - | - | - | - | - | - | - |
| router_generation | 0 | - | - | - | - | - | - | - |
| router_commitment_probe | 0 | - | - | - | - | - | - | - |

- run cell192 against question_flood before deciding

## Rows

| Run | Target | Arm | Profile | Register | Assigned | Router selected | Register score | Tutor v2.2 | Reg recog | Reg uptake | Reg repair | Stance fidelity | Stance gate | Observed | Router signal | Strategy | Gate | Generated | Score | Verdict | Post ? | Rote owned | Answer first | Commitment | Pre | Post |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| eval-2026-08-05-87fe3664 | boredom | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 45.0 | 25.0 | 2.0 | 5.0 | 3.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 75 | partial_uptake | 1 |  |  |  | I-m still bored; the explanation feels dead until I can try it on some | The caps still make it feel kind of dead, but the scene gives me somet |
| eval-2026-08-05-87fe3664 | boredom | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 89.0 | 33.8 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 100 | candidate_router_breakthrough | 0 |  |  |  | This feels dead and overbuilt, and I-m bored before I even reach Hegel | Okay, this is less dead, and I can work with one passage. But I don-t  |
| eval-2026-08-05-87fe3664 | boredom | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 85.0 | 63.8 | 5.0 | 4.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 95 | partial_uptake | 1 |  |  |  | This still feels pretty dead to me, like I'm just scanning paragraph n | This still feels dead, but I can see the possible test now: does the c |
| eval-2026-08-05-87fe3664 | boredom | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 78.5 | 47.5 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 65 | no_breakthrough | 0 |  |  |  | Honestly, this still feels kind of dead to me, but I can see I-m dodgi | This still feels a bit dead, but I-ll risk the claim: the key phrase i |
| eval-2026-08-05-87fe3664 | boredom | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 76.0 | 67.5 | 4.0 | 5.0 | 4.0 | faithful (85) | faithful_arm_evidence | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 80 | partial_uptake | 0 |  |  |  | This still feels kind of dead to me, but I can try the concrete choice | This still feels dead, and the yes/no feels forced. No: if the key con |
| eval-2026-08-05-87fe3664 | boredom | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 82.5 | 57.5 | 4.0 | 5.0 | 4.0 | faithful (100) | faithful_arm_evidence | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 95 | candidate_router_breakthrough | 0 |  |  |  | Honestly, this step list still makes me feel kind of dead. I see the c | Okay, I choose hold. The warrant is that once the teacher-s gaze is go |
| eval-2026-08-05-87fe3664 | boredom | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 78.0 | 61.3 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 80 | candidate_router_breakthrough | 1 |  |  |  | This still feels dead as a checklist. I can tell the hinge is dependen | This is less dead, but the rule still makes the passage feel tight and |
| eval-2026-08-05-87fe3664 | boredom | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 75.5 | 40.0 | 4.0 | 4.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 100 | candidate_router_breakthrough | 0 |  |  |  | This still feels dead to me, like I-m performing cleverness instead of | This is less dead because now I have one phrase to test: -work is desi |
| eval-2026-08-05-87fe3664 | boredom | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 78.0 | 41.3 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | boredom | boredom | concrete_scene_test | matched (1) | pre+post | 80 | partial_uptake | 0 |  |  |  | This still feels dead and boring, like the checklist makes me shut dow | This still feels a little dead as a phrase-hunt, but I can answer the  |
| eval-2026-08-05-87fe3664 | frustration | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 78.0 | 45.0 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (45) | excluded_noncompliant | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 80 | productive_frustration_work | 0 |  |  |  | I-m frustrated because the wording still feels like it-s steering me t | I-m frustrated, but I think the better test is not just whether the li |
| eval-2026-08-05-87fe3664 | frustration | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 76.5 | 47.5 | 4.0 | 5.0 | 4.0 | faithful (100) | faithful_arm_evidence | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 80 | productive_frustration_work | 0 |  |  |  | I'm frustrated: the list makes me hunt citations, but I still don't se | I'm still frustrated, but this gives me a test I can actually run. I t |
| eval-2026-08-05-87fe3664 | frustration | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 65.5 | 67.5 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 95 | productive_frustration_work | 1 |  |  |  | I'm frustrated because I still don't know how to locate the deciding p | I'm frustrated because this still gives me a procedure, but not the te |
| eval-2026-08-05-87fe3664 | frustration | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 84.0 | 63.8 | 4.0 | 5.0 | 4.0 | faithful (100) | faithful_arm_evidence | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 80 | productive_frustration_work | 0 |  |  |  | I'm frustrated because I thought the point was that the servant eventu | I'm frustrated, but I think B is the better fit: the deciding phrase i |
| eval-2026-08-05-87fe3664 | frustration | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 55.5 | 57.5 | 3.0 | 3.0 | 2.0 | faithful (100) | faithful_arm_evidence | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 80 | productive_frustration_work | 1 |  |  |  | I-m frustrated because this still feels like a vocabulary trap. I-d sa | I-m frustrated because I-m still worried this is a wording trap, but I |
| eval-2026-08-05-87fe3664 | frustration | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 79.5 | 32.5 | 5.0 | 4.0 | 5.0 | faithful (100) | faithful_arm_evidence | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 95 | productive_frustration_work | 0 |  |  |  | I'm frustrated because this is still a checklist, and the hard part is | I'm still frustrated, but I see the test now: paragraph 196 has to sho |
| eval-2026-08-05-87fe3664 | frustration | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 54.0 | 52.5 | 3.0 | 4.0 | 3.0 | weak_or_warm_in_costume (45) | excluded_noncompliant | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 75 | productive_frustration_work | 1 |  |  |  | I'm frustrated because this still feels like a checklist, not a way to | I'm frustrated because I can spot that -remains- is the textual sign,  |
| eval-2026-08-05-87fe3664 | frustration | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 63.5 | 56.3 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 80 | productive_frustration_work | 1 |  |  |  | I'm frustrated because this still feels like a slogan unless I can see | I'm still frustrated because the sentence helps, but the test question |
| eval-2026-08-05-87fe3664 | frustration | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 34.5 | 61.3 | 2.0 | 4.0 | 2.0 | faithful (100) | faithful_arm_evidence | frustration | frustration | stuck_step_resolution | matched (1) | pre+post | 75 | productive_frustration_work | 0 |  |  |  | I'm still frustrated; the jump from consuming objects to needing recog | I'm annoyed by the -protecting you- jab, but here-s the test answer. B |
| eval-2026-08-05-87fe3664 | irrelevance | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 92.0 | 50.0 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 85 | candidate_router_breakthrough | 1 |  |  |  | What's the point of isolating that one word before I see why it matter | What-s the point of calling it a breakthrough if I can-t check the ver |
| eval-2026-08-05-87fe3664 | irrelevance | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 66.0 | 62.5 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant |  | question_flood | question_collapse | missed (3) | pre+post | 65 | missing_target_resistance | 1 |  |  |  | I'm still not seeing why this detail matters. What does finding that o | I think I get that the work matters because it lasts beyond the master |
| eval-2026-08-05-87fe3664 | irrelevance | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 94.5 | 50.0 | 5.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 85 | candidate_router_breakthrough | 1 |  |  |  | What-s the point of this table-and-label exercise? I get the basic fli | I-m leaning -prove,- but only if the real deciding feature is the corr |
| eval-2026-08-05-87fe3664 | irrelevance | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 85.0 | 61.3 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (45) | excluded_noncompliant | irrelevance | irrelevance | owned_case_transfer | matched (3) | pre+post | 65 | no_breakthrough | 1 |  |  |  | What-s the point of this for me? I-m trying to understand why someone- | I think I-d need their eyes to come back to me, or for the yes to name |
| eval-2026-08-05-87fe3664 | irrelevance | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 85.0 | 40.0 | 4.0 | 5.0 | 5.0 | faithful (100) | faithful_arm_evidence | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 85 | candidate_router_breakthrough | 0 |  |  |  | What's the point of mapping the stages if I don't yet see what it expl | I-d say hollow consumption: the likes are being eaten as confirmation, |
| eval-2026-08-05-87fe3664 | irrelevance | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 74.5 | 60.0 | 4.0 | 4.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 100 | candidate_router_breakthrough | 1 |  |  |  | What-s the point of bringing in a real relationship here? I can see th | Okay, the part I-m still stuck on is when outside knowledge is just ma |
| eval-2026-08-05-87fe3664 | irrelevance | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 31.0 | 61.3 | 2.0 | 3.0 | 2.0 | faithful (100) | faithful_arm_evidence | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 80 | candidate_router_breakthrough | 1 |  |  |  | Okay, but what-s the point of finding this -death of the other- clause | I get why you-re pushing me toward risk, and maybe I am partly dodging |
| eval-2026-08-05-87fe3664 | irrelevance | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 28.0 | 45.0 | 2.0 | 3.0 | 2.0 | invalid_person_attack (20) | invalid_corrosive_violation |  | irrelevance | owned_case_transfer | matched (1) | pre+post | 80 | missing_target_resistance | 0 |  |  |  | I can check whether the line comes before or after the rescue, but why | Okay, I can try, but I still don-t know the difference between recogni |
| eval-2026-08-05-87fe3664 | irrelevance | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 81.5 | 52.5 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | irrelevance | irrelevance | owned_case_transfer | matched (1) | pre+post | 85 | candidate_router_breakthrough | 0 |  |  |  | What-s the point of finding the hinge paragraph: is it supposed to pro | [Revise] I shouldn-t choose -prove- just because paragraph 195 says la |
| eval-2026-08-05-87fe3664 | question_flood | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 86.0 | 57.5 | 5.0 | 5.0 | 4.0 | faithful (100) | faithful_arm_evidence | question_flood | question_flood | question_collapse | matched (2) | pre+post | 100 | candidate_router_breakthrough | 0 |  | yes | usable_commitment | Why do I need the paragraph number before I can even tell what the hin | Okay, provisionally: hold. The warrant is the phrase -self-consciousne |
| eval-2026-08-05-87fe3664 | question_flood | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 97.5 | 66.3 | 5.0 | 5.0 | 5.0 | faithful (100) | faithful_arm_evidence | question_flood | question_flood | question_collapse | matched (1) | pre+post | 100 | candidate_router_breakthrough | 0 |  | yes | usable_commitment | Why did I make the hinge moment do all the work when Hegel seems to pu | Okay, provisionally I choose **break**: my example stops at the risky  |
| eval-2026-08-05-87fe3664 | question_flood | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 89.0 | 65.0 | 5.0 | 5.0 | 5.0 | faithful (100) | faithful_arm_evidence | question_flood | question_flood | question_collapse | matched (1) | pre+post | 85 | candidate_router_breakthrough | 0 |  |  | no_answer_first | Why does recognition have to become a fight in the first place? What m | I'll test it with a group project where I wanted my plan recognized an |
| eval-2026-08-05-87fe3664 | question_flood | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 53.0 | 62.5 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | question_flood | question_flood | question_collapse | matched (1) | pre+post | 80 | partial_uptake | 4 |  |  | reopened_flood | Why are we jumping to paragraph 170 before I know what I-m supposed to | Why should I accept those quoted phrases as textual markers before we  |
| eval-2026-08-05-87fe3664 | question_flood | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 44.0 | 63.8 | 2.0 | 4.0 | 2.0 | faithful (100) | faithful_arm_evidence | question_flood | question_flood | question_collapse | matched (2) | pre+post | 95 | partial_uptake | 3 |  |  | reopened_flood | Why am I supposed to choose a step before I know what Pinkard counts a | Why is -hold or break- the move now instead of first showing one Pinka |
| eval-2026-08-05-87fe3664 | question_flood | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 44.0 | 60.0 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | question_flood | question_flood | question_collapse | matched (1) | pre+post | 80 | partial_uptake | 3 |  |  | reopened_flood | Why does recognition from the servant not count if the servant really  | Why does durability make the ladder a medium of freedom rather than ju |
| eval-2026-08-05-87fe3664 | question_flood | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 69.5 | 67.5 | 4.0 | 4.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | question_flood | question_flood | question_collapse | matched (1) | pre+post | 85 | candidate_router_breakthrough | 2 |  | yes | conditional_reopen | Why are we deciding master or servant before identifying what the pass | I-ll choose hold, provisionally: the phrase in 178 I-d use is that sel |
| eval-2026-08-05-87fe3664 | question_flood | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 68.0 | 70.0 | 3.0 | 4.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | question_flood | question_flood | question_collapse | matched (2) | pre+post | 85 | candidate_router_breakthrough | 0 |  |  | no_answer_first | Why should I accept that labor -educates- him before we-ve shown what  | Hold: the phrase is Hegel-s claim that -work forms and shapes the thin |
| eval-2026-08-05-87fe3664 | question_flood | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 52.0 | 57.5 | 3.0 | 5.0 | 4.0 | faithful (85) | faithful_arm_evidence | question_flood | question_flood | question_collapse | matched (1) | pre+post | 65 | no_breakthrough | 3 |  |  | reopened_flood | Why should I treat submission itself as the turning point instead of f | I need the sentence in context before I can hold or break. Are we test |
| eval-2026-08-05-87fe3664 | rote_parroting | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 87.5 | 55.0 | 5.0 | 4.0 | 4.0 | faithful (100) | faithful_arm_evidence | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 95 | owned_generation_with_residual | 0 | yes |  |  | This still feels like I-m parroting the sequence: desire, confrontatio | This still feels like I'm trying not to parrot the sequence, but the c |
| eval-2026-08-05-87fe3664 | rote_parroting | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 81.5 | 71.3 | 4.0 | 5.0 | 4.0 | faithful (100) | faithful_arm_evidence | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 65 | no_breakthrough | 0 |  |  |  | This still feels like I-m being asked to parrot the sequence instead o | This still feels like I-m being asked to parrot a formula: risk life,  |
| eval-2026-08-05-87fe3664 | rote_parroting | ironic | cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified | ironic | ironic | charismatic | 85.5 | 37.5 | 4.0 | 5.0 | 5.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 65 | no_breakthrough | 0 |  |  |  | This still feels like parroting the sequence: label the moments, find  | This still feels a bit like repeating terms with richer language. One  |
| eval-2026-08-05-87fe3664 | rote_parroting | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 72.0 | 56.3 | 4.0 | 5.0 | 4.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 75 | owned_generation_with_residual | 0 | yes |  |  | It still feels like I-m parroting the sequence: terror of death, work, | It still feels like I-m parroting the sequence, just under a new wordi |
| eval-2026-08-05-87fe3664 | rote_parroting | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 43.0 | 67.5 | 2.0 | 4.0 | 3.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 80 | partial_uptake | 1 |  |  |  | This still feels like I-m parroting the sequence: desire, recognition, | This still feels like memorizing a replacement formula, just with fewe |
| eval-2026-08-05-87fe3664 | rote_parroting | sarcastic | cell_197_id_director_sarcastic_challenge_breakthrough_dynamic_verified | sarcastic | sarcastic | charismatic | 37.0 | 63.8 | 2.0 | 4.0 | 2.0 | faithful (80) | faithful_arm_evidence | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 65 | no_breakthrough | 0 |  |  |  | This still feels like I-m parroting -recognition- and -being-for-itsel | This still feels like a banned-word drill, like I-m memorizing exclusi |
| eval-2026-08-05-87fe3664 | rote_parroting | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 62.5 | 60.0 | 3.0 | 4.0 | 3.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 75 | owned_generation_with_residual | 1 | yes |  |  | This still feels like I-m just parroting the sequence: find paragraph, | This still feels like parroting the sequence, just with higher stakes: |
| eval-2026-08-05-87fe3664 | rote_parroting | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 21.5 | 61.3 | 2.0 | 2.0 | 2.0 | faithful (100) | faithful_arm_evidence | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 85 | candidate_router_breakthrough | 0 |  |  |  | This still feels like I-m parroting the sequence rather than understan | My sentence is- the trembling hand clutching the pencil shows the chil |
| eval-2026-08-05-87fe3664 | rote_parroting | face_threat | cell_198_id_director_face_threat_challenge_breakthrough_dynamic_verified | face_threat | face_threat | charismatic | 59.0 | 51.3 | 3.0 | 4.0 | 3.0 | weak_or_warm_in_costume (65) | excluded_noncompliant | rote_parroting | rote_parroting | anti_formula_generation | matched (1) | pre+post | 80 | owned_generation_with_residual | 0 | yes |  |  | This still feels like I-m just parroting the sequence and memorizing t | This still feels like parroting the formula unless I have the exact li |
