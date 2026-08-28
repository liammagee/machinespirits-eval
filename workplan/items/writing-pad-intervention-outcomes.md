---
id: writing-pad-intervention-outcomes
title: Record intervention outcomes in the tutor Writing Pad
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: When a turn resolves, the strategy the previous turn recorded as
  used gets a success or failure mark written to the pad, under a stated, tested
  definition of success; a multi-turn test shows the pad accumulating outcome
  marks across turns; existing pad consumers and the symmetry between tutor-side
  and learner-side trace labels are unchanged; historical logs still parse.
claim_status: methods
links:
  prs:
    - 836
  notes:
    - services/learnerTutorInteractionEngine.js
tags:
  - writing-pad
  - interaction-engine
  - codex-sol
  - effort-xhigh
branch: codex/writing-pad-intervention-outcomes
---

The interaction engine records that an intervention was used
(learnerTutorInteractionEngine.js:2586) and a comment promises the next turn
will mark whether it worked. Nothing does. Strategy-effectiveness data is
silently never written, so any pad-informed adaptation reads a ledger of
attempts with no outcomes.

The engineering is bounded: on the next turn, look up the pending
intervention record and write an outcome mark. The care is in the outcome
definition — it must be derivable from the transcript alone (the
defensibility rule for reader-facing slots), stated in the card's tests, and
mirrored on the learner side if the pad symmetry calls for it. Check the
change against the tutor-learner symmetry rules before merging.

Suggested worker: Codex Sol at Extra High reasoning effort.

## Implemented outcome rule

- **Success:** the next public learner turn contains renewed content-bearing
  work (a learner-owned attempt, rationale, prediction, repair, comparison, or
  self-check).
- **Failure:** the next public learner turn contains shallow control evidence:
  mere agreement, formulaic recitation, empty rationale, verbatim adoption of
  the tutor's rationale, or an undifferentiated help request.
- **Non-binary evidence:** the canonical observer's `partial` and
  `inconclusive` outcomes remain categorical intervention-history records and
  never increment the binary strategy-effectiveness counters.

## 2026-08-28 evidence

- Reused `services/adaptiveTutor/interventionLedger.js`,
  `services/adaptiveTutor/outcomeObserver.js`, and
  `services/memory/tutorWritingPad.js`; no parallel ledger or schema migration.
- Multi-turn regression: one strategy accumulated one success and one failure;
  a second fixture retained an inconclusive observation without counting a
  failure.
- Historical traces without `action_contract` entries still return an empty
  readable ledger.
- Symmetry audit: no tutor/learner agent or action labels changed; the
  tutor-owned ledger is not inserted into learner deliberation; learner/tutor
  Writing Pad snapshot keys and downstream transcript/store shapes are
  unchanged.
- A mixed-backend drama consumer now distinguishes routed model-call records
  from the non-model `action_contract` ledger and explicitly checks that the
  ledger remains tutor-only (112/112 generator tests passed).
- Zero-call checks passed: 238 focused interaction, ledger, observer,
  id-director, transcript, trace-schema, symmetry, and interaction-store tests;
  `npm run lint:all`; `npm run wp:source-check` (539/539 items).
- Model-backed evaluation calls: 0.
- PR #836 merged with all hosted checks complete and no failed or pending
  checks; the stated multi-turn and symmetry acceptance evidence is final.
