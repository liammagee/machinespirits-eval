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
branch: claude/tutor-stub-uptake-guard
claim_status: planned
links:
  code:
    - services/tutorStubSceneDiction.js
    - services/tutorStubDramaticRelease.js
    - services/tutorStubResponseComposition.js
    - services/tutorStubTurnProgressionContract.js
    - scripts/tutor-stub.js
    - tests/tutorStubSceneDiction.test.js
    - services/tutorStubConversationalCompletion.js
    - tests/tutorStubUptakeGuardLinkage.test.js
    - services/tutorStubSelfCorrectionDisclosure.js
    - services/tutorStubGuardDisposition.js
    - tests/tutorStubSelfCorrectionDisclosure.test.js
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
- Step 4 — an accepted meaning that describes the learner's discourse act
  rather than their content never becomes the turn focus surface and never
  contributes required terms. Token overlap stays sufficient for uptake
  visibility; a responsive uptake that echoes the learner's own surface becomes
  a second sufficient route.

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
- 2026-07-26 — Step 4 landed, and the diagnosis is sharper than the one written
  above. The guard was not too strict; it was pointed at the wrong text.
  `conversationalCompletion.acceptedMeaning` carries two different kinds of
  sentence — a classifier paraphrase of what the learner said, and a
  generous-inference description of what the learner did ("The learner gives a
  short answer whose referent and scope are supplied by the immediately
  preceding public question"). The contract took the second as the turn focus
  surface, so the recorded world-030 turn demanded the tutor speak "referent",
  "scope" and "preceding" back to a learner who had said "check for sources of
  water". No natural uptake could pass. `acceptedMeaningKind` is now stamped at
  the point of resolution, act descriptions are excluded from the focus surface
  and from required terms, and the previously unreachable
  `RESPONSIVE_UPTAKE_PATTERN` route is revived as a second sufficient route for
  a responsive uptake that echoes the learner's own words. Replaying the two
  recorded rejections through the changed guard: both now pass, both by term
  overlap alone, on focus terms `["check","sourc","water"]`. Seven new tests in
  `tests/tutorStubUptakeGuardLinkage.test.js`; five fail on the pre-change code
  and two pass on both, pinning that the loosening did not open the gate
  generally. Tutor-stub sweep 2114/2115, same single pre-existing MCP-SDK
  import failure. An earlier line in this item asked for stem-tolerant
  matching; that is redundant — `normalizeToken` already stems.
- 2026-07-26 — Step 3 landed. A new rung sits between the source-voice repair
  and the deterministic fallback. It opens on exactly one condition: every hard
  finding on the current draft is one the terminal fallback would downgrade to a
  conversational advisory. The predicate reads that from
  `classifyTutorStubGuardIssue` rather than restating the catalog, so the rung
  and the accommodation can never drift apart. Requiring *all* hard findings to
  be waivable keeps a draft that also crossed an evidence boundary out of scope
  — there the fallback is replacing something the tutor should not have said,
  not absorbing an unanswered question.
  The brief tells the model what it drafted, why that does not answer the
  learner, and that the learner is present for the change of course; it states
  that saying so is permitted and that answering well while saying nothing is
  equally acceptable. No phrase is supplied. A test asserts the brief itself
  contains no marker the detector recognises, so the outcome label cannot be
  measuring the prompt.
  Two failures the normal chain cannot see are guarded. A disclosure may not
  quote a discarded line the tutor never drafted, and may not name the private
  apparatus whose vocabulary the brief just handed it. Both are hard in both
  dispositions and on the terminal fallback, for free: the disclosure audit
  carries no catalog rule, and unregistered issues fail closed.
  Two corrections came out of probing rather than unit tests. The
  non-fabrication check first read every quoted span as a claim about the
  discarded draft, but quotation marks in this harness carry the learner's own
  words, Write entries and released evidence; only a quote inside the correcting
  sentence is now checked. And a self-correction placed first was being scored
  as the turn's uptake, so both uptake guards rejected the very move the rung
  invites — `auditTutorStubResponseComposition` now peels a leading
  self-correction preface and points the guards at the sentence that follows,
  and only when that opening does not already answer the learner on its own.
  End-to-end on the `--world none` path, where both drafts fail live progression
  and nothing else: the rung fires, and a disclosed turn ships as
  `guarded_self_correction_disclosed` with the preface excluded from the uptake
  and live progression clean. A rejected disclosure falls through to the
  byte-identical fallback the ladder always produced. Cost note: in the target
  population this is one extra model call per fallback turn, which matters on
  paid runs. Tutor-stub sweep 2114/2115 plus 14 new disclosure tests and a new
  composition test, with the same pre-existing MCP-SDK import failure.
