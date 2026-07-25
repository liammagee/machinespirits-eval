---
id: tutor-stub-fallback-register-and-uptake-guard
title: Tutor-stub fallback register and learner-uptake guard
status: active
type: maintenance
priority: P1
owner: claude
source: review
created: 2026-07-26
updated: 2026-07-26
verification: A contemporary-diction world speaks its own props in its own
  register while every period and undeclared world keeps byte-identical
  deterministic text; the learner-uptake guard admits a genuinely responsive
  uptake that shares no tokens with the accepted meaning; targeted and hermetic
  suites pass without model calls.
branch: claude/tutor-stub-scene-diction
claim_status: planned
links:
  code:
    - services/tutorStubSceneDiction.js
    - services/tutorStubDramaticRelease.js
    - services/tutorStubResponseComposition.js
    - services/tutorStubTurnProgressionContract.js
    - scripts/tutor-stub.js
    - tests/tutorStubSceneDiction.test.js
tags:
  - tutor-stub
  - presentation
  - guards
milestone: evaluation-infrastructure
---

A world-030 (domestic, contemporary) transcript published a tutor line in an
assay-guild register: "I examine the record… What changes now?" The line was
entirely deterministic. The model's own draft was plainer and closer to the
world's declared costume, but `live_turn_progression_v1` rejected it, the
recovery draft was rejected too, and the deterministic fallback shipped from
phrase banks authored against the period worlds.

Four defects sit behind that one line, addressed in sequence.

Out of scope:

- Changing any world's authored `presentation` block, register policy, or
  engagement stance.
- Altering evidence, clue-transaction, or leak guard dispositions, which stay
  hard everywhere.
- Running model-backed or paid evaluations.

Acceptance:

- Step 1 — the deterministic fallback reads `presentation.ledger_term` and
  `presentation.narrative_diction` from the world instead of relying on a
  hardcoded period-noun whitelist. A world declaring neither is unchanged.
- Step 2 — the dramatic-release host entrances, stance inflections, and the
  generic learner-uptake tails carry contemporary variants alongside the
  frozen period wording.
- Step 3 — a fallback that publishes while carrying a terminal-fallback
  conversational advisory offers the model one further attempt whose brief
  discloses the near-miss to the learner. The wording is not templated; the
  disclosure is guarded for non-fabrication against real prior attempts and
  for leak containment, and falls through to today's fallback when rejected.
- Step 4 — `substantiveLearnerUptake` no longer requires token overlap as the
  only route to visibility. Overlap stays sufficient; a responsive uptake whose
  declared public focus is the learner's proposed move becomes a second
  sufficient route, with stem-tolerant matching and uninformative required
  terms dropped.

Log:

- 2026-07-26 — Diagnosed from
  `.tutor-stub-traces/2026-07-25T22-35-28-793Z-transcript.html` (world-030,
  `goalpost_shifter`, codex/gpt-5.6-sol). Corrected one earlier reading: the
  terminal fallback is re-audited and a hard failure still kills the turn. The
  accommodation is narrower — `services/tutorStubGuardDisposition.js` downgrades
  `conversational_integrity` findings to advisories on the terminal-fallback
  attempt only, with a written rationale. It is recorded, not silent, but it is
  invisible to the learner.
- 2026-07-26 — Steps 1 and 2 landed. New `services/tutorStubSceneDiction.js`
  resolves diction and declared props from `world.presentation` with
  default-preserving resolution: period unless a world declares a marker-free
  diction, so frozen worlds and every existing call site that omits `world` keep
  byte-identical text. World-030 now opens "I look at the repair notebook"; the
  marrick and undeclared cases still open "I examine the record". Targeted
  suites pass 181/181 plus 5/5 new; the wider tutor-stub sweep is 1307/1309 with
  the only failure `tutorStubCodexRemoteBridge.test.js`, which cannot import
  `@modelcontextprotocol/sdk` — declared in `package.json`, absent from
  `node_modules` in this checkout, and unrelated to these edits.
