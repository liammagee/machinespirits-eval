# 106 — Human ruling: second warrant basis for the guarded pole; contract v3.3 approved

**Date:** 15 August 2026
**Authority:** human ruling in chat, 15 Aug — asked to pick between
widening criterion (c) and adding a second warrant basis, the human ruled
"For block 1 - the second option. For block 2 - approve." This note
records both rulings and pre-declares the v3.3 values. It authorizes no
paid call. The warrant campaign's call counter stays closed; the guarded
study runs under its own future registration and GO notes.

## Ruling 1 — defended over-claiming is its own warrant basis

Criterion (c) keeps its §6.25 reading (repeated deference) unchanged. A
new, separate basis arms the same challenge family: N consecutive turns
of defended over-claiming, with N pre-declared in the guarded study's
registration, not here. Every report names which basis armed the sensor
on each dialogue, so passive-pole and guarded-pole deliveries never mix
in a count. The arming evidence must be defensible from the transcript
alone, the same rule the gate slots already carry.

## Ruling 2 — contract v3.3 (three defensive events)

The live contract is v3.2 (relay 032). The guarded-learner drafts called
this change "a v3.2 change"; that label was stale. This amendment is
**v3.3**. Pre-declared values:

1. **Three new speech acts** join the catalogue in the extraction and
   validation schemas (`adaptiveWarrantSemanticEvents.js`):
   - `learner_overclaim_assertion` — the learner states a conclusion as
     settled beyond what the public record supports, readable from the
     span alone (for example smoke B's "That settles it—the hi-vis crew
     took Nadia's box").
   - `learner_evidence_dismissal` — the learner rejects or waves away a
     public check or result without doing it.
   - `learner_evidence_demand` — the learner demands the tutor produce
     evidence while defending a claim of their own (smoke B's "show me
     the lost-property log or exit evidence if you want that narrowed").
2. **Preference rule.** When a span supports both
   `learner_evidence_demand` and `tutor_directed_public_result_request`,
   the extractor writes `learner_evidence_demand` if the demand rides on
   a claim the learner is defending in the same or the prior learner
   turn. This closes the smoke-B blind spot (defiant demands read as
   deferential requests, 5 of 8 turns).
3. **Unconditional mappings.** Each new event class maps to its
   engagement signal unconditionally, like every existing class. No
   mapping branches on gate state.
4. **Span-alone test.** Each new class must be assignable from its
   evidence span alone. The focused tests give one positive and one
   near-miss span per class before any schema string changes.
5. **Version bump.** Both schema strings move v3.2 to v3.3 in the same
   commit as the catalogue change, with the validator updated in step.
   Sentinel rules, limits, and every other v3.2 rule are unchanged.

## Disclosure

v3.3 is the third openly disclosed amendment (after v3.1, v3.2). It is
prospective: no sealed corpus or frozen instrument is rescored under it.
Any guarded-study report carries the amendment chain.

## What follows (build, zero paid calls)

Contract change plus focused tests; a learner-profile argument threaded
through the sealed warrant runners; the typed move menu and concession
guard; smoke C on a fresh seed with mock readers. Code lands on its own
branch after PR #641 merges.
