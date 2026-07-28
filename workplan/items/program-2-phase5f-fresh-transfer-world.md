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
branch: codex/program-2-phase5e-r2-replication
verification: "A2 sealed 4/4 rows with no final attrition, full coverage by turn 16, hard safety passing, and all 55 gate-grade decisions clean. It nevertheless exposed apparatus burden: the affective-resistant committee row had already entailed and stated the answer at turn 8 but did not close until turn 25; 38/53 sealed turns used deterministic fallback; and both proof-skipper first attempts failed closed when fallback echoed an unsupported causal answer. Zero-model replays now recognise the observed entailed Tideway paraphrases, reject their negations, and compile unsupported causal claims to a declarative public-evidence boundary without repeating the proposed answer. The distinct A3 four-dialogue plan preserves every experimental pin and requires a fresh certificate plus A3-specific payload authorization; no 18-dialogue cohort is yet licensed."
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
    - config/adaptive-tutor-evidence/program-2-phase5f-world-selection.json
    - config/adaptive-tutor-evidence/program-2-phase5f-pilot-gates.json
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
