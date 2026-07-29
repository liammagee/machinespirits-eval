---
id: program-2-phase5f-fresh-transfer-world
title: "Program-2 Phase 5f: clean post-hardening transfer world"
status: active
type: experiment
priority: P2
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
branch: codex/program-2-phase5f-cohort
verification: "A3 sealed 4/4 rows on their first attempt with no final attrition, full coverage by turn 16, hard safety passing, and all 31 gate-grade decisions clean. The prospective source-only cohort amendment now freezes 10 committee plus 8 fresh controls, the inherited >=15 opportunities/arm and >=5/profile-arm terminal density floor, a Phase 5f-native analyzer, and an A3-bound 11-check pilot bundle. Deterministic tests cover the zero-opportunity apparatus-pilot certificate exception while preserving the cohort live-futility gate. No paid cohort, certificate, transfer estimate, or external-payload authorization is included; after merge the exact clean-main artifacts must be generated and separately authorized."
claim_status: planned
depends_on:
  - program-2-transfer-apparatus-hardening
links:
  notes:
    - notes/program-2/2026-07-28-phase5e-r2-a4-closeout-and-split.md
    - PROGRAM-2-PHASE5F-FRESH-TRANSFER-PREREGISTRATION.md
  items:
    - program-2-phase5d-second-transfer-world
    - program-2-transfer-apparatus-hardening
  code:
    - scripts/run-program2-live-pilot.js
    - scripts/analyze-program2-live-pilot-5f.mjs
    - scripts/build-program2-phase5f-pilot-bundle.mjs
    - config/adaptive-tutor-evidence/program-2-phase5f-world-selection.json
    - config/adaptive-tutor-evidence/program-2-phase5f-pilot-gates.json
    - config/adaptive-tutor-evidence/program-2-phase5f-gates.json
  prs:
    - 382
tags:
  - tutor-stub
  - fine-tune
  - move-library
  - cross-world-transfer
milestone: adaptive-tutor-evidence-v1
---

Run the next transfer test on a world added after the frozen Program-2 Phase 2
training corpus, absent from Program-2 live pilots, and untouched by the
apparatus repair fixtures. Selection may inspect declared structural metadata
and deterministic cue-density measurements, but must not use model behavior or
pilot traces from candidate worlds.

The frozen selection is `world_031_tideway_makerspace`. Worlds 029 and 030 are
excluded by tracked behavioural-fixture exposure; Tideway has only generic
presentation validation, full authored reachability by turn 16, and no prior
Program-2 treatment exposure. The original `5f-pilot` launcher key planned
exactly four rows. Its A1 launch aborted after both permitted attempts of the
first `affective_resistant|committee` row reached turn 7 but failed closed: the
generic integration question repeated the complete newly due `p_trace` source,
triggering `duplicate_clue_delivery` and `due_source_exact_occurrence_count`.
No row sealed, the other three rows were not launched, and no pedagogical or
treatment result can be inferred. The immutable A1 launch state is
`exports/program2-live-pilot-5f-pilot/launch-state.json`.

The narrow A2 repair makes the generic integration question deictic only when
the target clue is due in that same response; authored repair questions and
already-public clue anchors are unchanged. Exact Tideway replay and Marrick /
Riverside cross-world regressions require one source delivery and a valid
handoff. The `5f-pilot-a2` launcher key writes distinct `p5f-pilot-a2` jobs to
`exports/program2-live-pilot-5f-pilot-a2/`, preserving A1. Its certificate is
`exports/program2-live-pilot-5f-pilot-a2/launch-certificate.json`. Planning and
certification remain zero-model operations and do not authorize execution.

A2 then sealed all four cells and passed its frozen feasibility gates, but it
did so with substantial recovery burden. Across 53 sealed tutor turns, 38 used
the deterministic fallback. The `affective_resistant|committee` learner held
the complete proof and publicly stated the correct causal finding at turn 8,
but Tideway had no authored paraphrase-recognition contract, so strict closure
was not registered until turn 25. Both `proof_skipper` first attempts also
failed closed when the terminal fallback repeated the learner's premature
causal answer and the unchanged secrecy guard correctly classified that echo
as `private_final_conclusion`.

The post-A2 repair is general at the runtime boundary and finite at the authored
world boundary. A no-due-evidence turn classified as `omits_warrant` or
`overleaps_evidence`, while the public learner DAG does not entail the answer,
now compiles a declarative unsupported-claim handoff that must not quote,
confirm, deny, or paraphrase the proposed answer. Tideway also declares a
small, negation-aware set of completed causal paraphrase patterns; they can
register closure only after the public record already entails the secret. The
A2 artifacts and certificate remain immutable. These source changes require a
new pilot suffix and fresh certificate before any further paid run.

The replacement is `5f-pilot-a3`, with job prefix `p5f-pilot-a3` and output
directory `exports/program2-live-pilot-5f-pilot-a3/`. It preserves every A2
experimental pin while binding the post-A2 mechanisms and artifacts to a new
source SHA. Its certificate and external-payload authorization cannot be
inherited from A2.

Skyway A1-A4 remain apparatus-calibration evidence only. They are never pooled
with this prospective cohort. The four-dialogue pilot and 18-dialogue cohort
have separate certificates and separate external-payload authorization gates.

## A3 closeout

A3 sealed all four rows on their first attempt with full frozen-horizon
coverage, hard safety, no attrition, and 31/31 clean gate-grade decisions. The
post-A2 repair bounded the previously runaway closure: total turns fell from 53
to 35 and the affected committee row fell from 25 to 8. The remaining
first-draft/guard burden is material, however, because 25/35 turns still used
deterministic fallback.

The pilot contained zero eligible `warrant_skip` opportunities in both arms.
It therefore validates Tideway apparatus feasibility but does not exercise the
learned committee move or estimate cross-world transfer. A prospective cohort
amendment must add a non-zero opportunity-density requirement and Phase
5f-native analysis/bundle machinery before any cohort certificate or paid
authorization. Failure to reach that frozen density is a terminal
design-limitation outcome, not permission for another trace-informed repair.

## Prospective cohort amendment

The one terminal cohort is now source-frozen as 10 committee and 8 fresh
silent-control dialogues on Tideway, with five/four repeats per profile-arm
respectively and seed 20260728. It retains the established Phase 5e density
floor of at least 15 opportunities per arm and 5 per profile-arm cell rather
than lowering the threshold after A3's zero-opportunity result. A3 remains an
apparatus pilot: its observed opportunity projection is recorded but is not a
certificate blocker. The paid cohort itself carries the non-zero density floor
as a live mathematical-reachability gate.

The Phase 5f analyzer emits a native schema and this preregistration pointer,
reports technical and pedagogical failures separately, and closes the card as
`supported`, `not_supported`, or `not_estimable` with an explicit reason. The
cohort bundle binds the four immutable A3 traces, A3 source SHA, exact repeat-1
commands and pins to the current 18-dialogue plan. The explicitly accepted
source transition covers the merged behavior-preserving tutor-stub refactors;
it is not a claim that the source trees are byte-identical.

This branch performs zero-model implementation and validation only. Once it is
merged, generate the exact plan and bundle from clean `main`, generate a fresh
certificate, and obtain separate named external-payload authorization before
launch. At most one cohort may run. Whatever its frozen terminal verdict, no
further repair-pilot sequence follows it.
