---
id: reply-feature-stamps
title: 'Reply-feature stamps: measure what the tutor reply did, blind to the card'
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-07
verification: "Terminal, same day, pure computation. New unit suite
  (services/__tests__/tutorStubReplyFeatures.test.js, 10 tests) plus
  wiring tests in tests/tutorStubTurnOrchestration.test.js (4 tests) —
  all pass; lint clean; test manifest updated. Retrospective read-back
  over the falsifier's 122 turns (run C of scripts/analyze-figure-
  lattice.js): 1/7 separated, up from 0/7, with runs A/B/B' asserted to
  reproduce their recorded numbers first. That read-back is CALIBRATION,
  not a clean test — the act patterns were widened after reading three
  labelled replies from the same corpus. The clean test is fresh turns
  carrying the live stamp."
claim_status: methods
links:
  notes:
    - notes/2026-08-06-pedagogical-figure-ontology.md
  items:
    - figure-lattice-falsifier
    - pedagogical-figure-ontology
---

# Reply-feature stamps

The figure-lattice falsifier separated 0 of 7 figures and named the
reason: the harness logs what the tutor was TOLD to do (card, dose,
state) and never what the reply came out like. Of the ontology's five
makeup dimensions — act, register, footing, dose, rights — only dose
and rights were stamped and both were near-constant. This card builds
the missing three as a per-turn stamp.

## What was built

`services/tutorStubReplyFeatures.js` — a pure, dependency-free module.
Given a reply, it returns:

- **acts** (all that apply): ask, cite, credit, assign, contrast,
  restate, concede, plus `assert` as the residual for a reply that only
  tells. Patterns are world-neutral: no scene noun, name or scenario
  term appears in any of them, so the same instrument runs on worlds
  not yet written.
- **authority**: `record | learner | shared | own | none` — whose
  say-so the reply leans on.
- **tutorCommits**: the tutor promising a next action of their own. Only the
  tutor side, because "the learner moves next" would be a rename of
  asking or assigning and a duplicated column makes a lattice look more
  structured than it is.
- **stakes**: the conditional wager shape, its own column because the
  arc found this family never makes one unprompted.
- **sentenceLength** and **latinate**, each bucketed low/medium/high at
  cut points read off the spread of the first corpus alone. Two plain
  measurements kept separate, with no invented weighting between them —
  whether short-and-Anglo-Saxon is one thing is for the lattice to say.

Deliberately not `services/tutorStubRegister*.js`: that models the
register the tutor was ASKED for, and its enum is under a standing
axis-confound review.

## The rule, and how it is enforced

Nothing about the card, the pressure classification or the detected
state may enter the stamp. Otherwise it re-encodes the card and the
separation test passes by construction — the closed-loop tell.

Three guards: the signature (reply text in, features out, learner text
only for echo counting); a test that reads the module's own source and
fails if card vocabulary appears in it; and the reporting caveat below.

## Wiring

`services/tutorStubTurnOrchestration.js` stamps a `tutor_reply_features`
trace event immediately before `turn_complete`, at all three completion
paths (passthrough, analyzed, quarantine). Unconditional — no flag, no
env — because a stamp that only fires when a card fires cannot compare
carded turns with uncarded ones.

Imported rather than injected, against this module's own DI convention:
an unwired dependency would make the stamps silently vanish rather than
fail. A structural test asserts every `turn_complete` is preceded by the
stamp, which covers the two paths no unit test cheaply drives.

## Read-back (run C, added after the falsifier's frozen design)

1/7 separated, up from 0/7. The oblique lure separates on
`{authority:none, state:flat}` — the right/wrong arm split at a shared
state that run B could not see. The plain-words swap narrows from
swallowing the corpus to 20 foreign turns (`latinate:low` on 12/12
mockery turns vs 40% corpus-wide). The lost state is unchanged, which
is the robust-native finding holding under a new instrument. Performed
features alone separate nothing. Full reading in the note.

Attribute realization: 20 attributes, none dead, none near-constant.
Two are rare and informative: conditional wagers on 3/122 turns, and
`act:restate` firing on only 42% of the mockery turns it was written
for — so restate under-detects and is a floor, not a count.

**Calibration, not a clean test.** The act patterns were widened after
reading three labelled replies from this same corpus. The clean test is
fresh turns from the live stamp; the harness now writes them on every
run, so the next planned run supplies them at no extra cost.

## Next

- Read the same lattice on fresh stamped turns from the next run — no
  paid run to be bought for this.
- If it separates there, §7.13 gets the claim. If it does not, prune
  the figures that cannot be told apart; the visible candidate is the
  lost state's three cards, already merged under two instruments.
- Paper untouched until then, per the falsifier card's registered order.
