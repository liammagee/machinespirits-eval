---
id: program-2-transfer-apparatus-hardening
title: Program-2 transfer apparatus hardening after Phase 5e A4
status: review
type: infra
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
branch: codex/program-2-phase5e-r2-replication
verification: "Without model calls, frozen A1-A4 and Phase 5f A2 prefixes plus non-Skyway fixtures prove queued recovery for every released-but-unheld best-path premise, rejection of closure while strict DAG premises remain missing, idempotent one-time due-clue delivery, preservation of cue-bearing committee content, recognition of authored entailed-answer paraphrases, and a fail-closed unsupported-answer recovery that does not echo the proposed conclusion. Focused, derivation-quality, hermetic-manifest, lint, and workplan source gates must pass before a replacement certificate is prepared."
claim_status: methods
links:
  notes:
    - notes/program-2/2026-07-28-phase5e-r2-a4-closeout-and-split.md
  items:
    - program-2-phase5d-second-transfer-world
    - program-2-phase5f-fresh-transfer-world
  code:
    - services/tutorStubResponseConfiguration.js
    - services/tutorStubTurnProgressionContract.js
    - services/tutorStubDialogueClosure.js
    - services/tutorStubDramaticRelease.js
    - services/program2CommitteeEngine.js
    - scripts/tutor-stub.js
    - tests/tutorStubPhase5eR2PilotReplay.test.js
tags:
  - tutor-stub
  - program-2
  - apparatus
  - guards
milestone: adaptive-tutor-evidence-v1
---

Phase 5e A1-A4 repeatedly converted a world-specific missing premise into a
new patch target. A4 repaired `p_spiral` but then stalled on `p_soleLift`, while
one retry duplicated its due clue and one committee moment dropped cue-bearing
material during public composition. Further Skyway-specific tuning would no
longer test transfer.

## Acceptance

- Treat released-but-unheld best-path premises as an ordered recovery queue;
  authored repair wording may refine a premise, but is never required for the
  mechanism to activate.
- A public tutor response cannot close or settle an inquiry while the strict
  learner DAG remains open.
- Deterministic clue-release fallback carries a due clue exactly once, even
  when learner uptake overlaps its surface.
- A committee reply whose complete one-question turn carries the frozen
  warrant cue cannot lose that cue merely because its extracted question is
  generic.
- Replays cover the observed A4 turn-2 duplicate, turn-9/16 multi-gap state,
  turn-34 sole-gap state, and the committee handoff, plus at least two worlds
  outside Skyway.
- An entailed natural-language answer may close through a finite,
  negation-aware authored recognition contract; a denied answer must not close.
- Before entailment, deterministic recovery must hold a premature causal claim
  at the public-evidence boundary without repeating the proposed conclusion or
  weakening the secrecy guard.

No paid pilot belongs to this card.

## Review handoff

The generic recovery queue, strict-DAG closure refusal, idempotent due-clue
delivery, cue-preserving committee handoff, authored entailed-answer
recognition, and non-echoing unsupported-answer boundary are implemented with
zero-model replays over the frozen Skyway and Tideway failures plus non-Skyway
fixtures. The certified Tideway A3 feasibility pilot then sealed 4/4 rows on
their first attempt with full frozen-horizon coverage, hard safety, and no
attrition. Its zero eligible committee moments are recorded on the separate
Phase 5f experiment card and are not evidence for or against this infra card.

The branch is reconciled with current `main`. Its review gates pass: 309
focused Program-2 and tutor-response tests, the 32-world derivation-quality
audit, the hermetic manifest check, lint, and the 294-item workplan source
check. The separate post-sync outer-loop and merged model-selection suites also
pass. No further paid run is required for this card.
