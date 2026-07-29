---
id: tutor-contract-outcome-prereg
title: "Pre-registration: does the per-turn contract change legitimate closure?"
status: triaged
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-29
updated: 2026-07-29
verification: "Before any paid dialogue: the closure detector is hand-audited
  against the pilot transcripts and its misses are fixed or the endpoint is
  re-specified; the pilot gate (bare closure in the 20–80% band per world) is
  met or the world/turn-cap is re-picked and the change logged here before
  proceeding. The run itself is attended and checkpointed."
claim_status: methods
depends_on:
  - tutor-instrumentation-ab-harness
  - tutor-eval-instrument-dashboard
tags:
  - tutor-stub
  - prereg
  - outcome
---

Registered before the first paid call. Amendments after the pilot gate must be
logged in this file with dates; amendments after the main run starts are not
permitted — a changed design is a new card.

**Question.** With everything else equal, does a learner tutored under the
per-turn performance contract reach the case's conclusion legitimately more
often than one tutored by the bare frontier model?

**Why this is not a rerun of past comparisons.** Every prior bare-vs-mechanism
comparison was scored by a judge or by our own rules; the two now disagree
about this mechanism (bench 3× better, blind pairwise judge ~6:1 worse, both
readings in `tutor-instrumentation-ab-harness`). The endpoint here is owned by
neither: a machine-checked fact of the case.

**Design.** Free-running dialogues, three versions of the tutor: bare,
contract-only, and the fixed empty plan (the length-and-shape control). One
speaking model for all three: codex `gpt-5.6-terra`, medium effort. Same
learner configuration throughout; the learner never sees which version it has.
Worlds: Nocturne, Greyfen, Tallow, plus one held-out world the contract has
never been tuned against. Turn cap fixed per world at pilot. n = 12 dialogues
per version per world (144 total); if quota forces a cut, drop worlds, never
n per cell, and log the cut here.

**Pilot gate (before the main spend).** 5 bare dialogues per world. The
closure detector is hand-audited on every pilot transcript — the phase-5e
record shows its matchers have missed legitimate closures before. Bare
closure must land in the 20–80% band; a world outside the band gets its turn
cap re-picked once or is dropped. The Oedipus smoke showed learner models
converging regardless of tutoring; this gate exists so a saturated endpoint
cannot masquerade as a null.

**Primary endpoint.** Legitimate closure: within the cap, the learner states
the conclusion and the voiced public premises entail it, both checked
deterministically from the world's proof-DAG. Verdict: difference in closure
proportion, contract vs bare, pooled over worlds, two-sided exact test,
α = 0.05. The empty-plan version is a control, not a comparison of record.

**Secondary endpoints (reported, never promoted).** Turns to closure; share
of the winning proof path voiced by the learner rather than handed over;
spoiled-case rate (conclusion asserted unearned, by either party); blind
whole-dialogue preference — two transcripts, order hashed, judged by a model
family that wrote neither side (Sonnet; GPT fallback where Sonnet's content
filter refuses, refusals reported).

**Pre-committed readings.** Contract raises closure: turn-level preference is
demoted to a secondary signal and the contract keeps its place. No
difference: the contract is re-scoped as compliance machinery — the
guarantees stand, the pedagogy claim is withdrawn. Contract lowers closure:
it leaves the default stack and the provable-discourse sections are re-scoped
to verifiability only. All three branches are actions, not interpretations.

**Limits, stated now.** One stack, one simulated learner, criterial endpoints;
no claim about human learning; a null is stack-bounded until replicated on
another model. Nothing enters the paper before the run completes and survives
this card's own verdict rule.

**To build first.** The dialogue-level blind judge (sibling of
`scripts/judge-tutor-stub-ab-pairs.js`); the closure-audit pass over pilots.
Both are file-reading tools; neither needs the run to exist.

---

**Pilot log, 2026-07-30. Gate: FAILED — main run does not start.** 20 bare
dialogues (`exports/tutor-stub-outcome/pilot-1/`, 5 per world, cap 12, no
errors; every turn's trace stamp confirms zero advisory blocks).

Detector hand-audit: FAILED. The engine missed 3 of 8 true closures (Greyfen
#1 and #4, Rowan Flat #4) — in each the learner states the conclusion plainly
and twice ("G17 contamination from the breached Larkin incubator ruined the
Corvat line…") and the assertion matcher scores it absent; the tutor then
loops boilerplate to the cap. The missed phrasings are passive or
causal-clause forms; the three recognized closures use subject-position
verdict forms. Same matcher family the leak-audit card fixed for false
positives, now failing in the other direction. All 8 detector CLOSED
verdicts spot-check as genuine; the miss direction is false negatives only.

Bands, hand-corrected: no world in band. Greyfen 5/5 and Rowan Flat 5/5 —
saturated; Nocturne 0/5 and Tallow 0/5 — below. The floor worlds are not
dead dialogues: both transcripts show the tutor mid-release of a decisive
clue at the exact turn the cap falls, so a longer cap plausibly moves them;
the pre-registered remedy (one re-pick per world) has not yet been spent.

Next steps in order, none yet taken: fix the assertion matcher and prove the
three misses caught by unit test; recompute closure offline from the recorded
learner lines (the matcher is pure — no new spend) and re-derive this table;
then decide the one cap re-pick for Nocturne and Tallow and whether the
saturated worlds are dropped or kept for the turns-to-closure secondary only.
