---
id: adaptation-planted-stress-bench
title: Planted typed stress — a bench where teaching moves have consequences
status: triaged
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-07-30
updated: 2026-07-30
verification: "Design-stage card: no build until the authored gold exists.
  First build gate: a user-edited stress schedule (draft:
  config/drama-derivation/stress-schedule-world-033-draft.yaml) naming per
  planted turn the state, the sim directive, and the right repair. The gate
  was originally transcript annotation; inverted 2026-07-30 — the corpus
  transcripts contain no states to read out (the sim has none), so the gold
  is authored in, never discovered. The annotation sheets survive for rating
  whether a tutor reply met a planted state."
claim_status: methods
depends_on:
  - misconception-world-outcome-gate
tags:
  - tutor-stub
  - adaptation
  - outcome-channel
---

Why the bench under-stresses the tutor, in one sentence: every simulated
learner produces resistant *text* with no state behind it that the tutor's
moves actually move, so the whole repertoire of good teaching — backtrack,
simplify, slow down, change tone, reinforce and test — has no consequence,
and the cheapest fluent reply is genuinely optimal. The 2026-07-30
misconception gates measured this exactly: a resisting learner cost the bare
tutor two turns when the schedule answered its objection (world-032, 5/5),
and one dialogue in fifteen when it did not (world-033, 4/5). Costume, not
mechanics. The one instrument that ever paid — the proof-DAG — paid because
derivability is mechanical: a real state outside the LLM that moves have
consequences against. The affective side never got its equivalent.

## Design (agreed in discussion, 2026-07-30; not yet built)

Two components form the spine:

1. **A stress schedule** — the world file's release-schedule idiom applied to
   breakdowns. Per dialogue, a schedule of planted, typed deficits: at turn
   t, the learner forgets a named premise; conflates two named rules; goes
   flat and short; refuses the method. Each probe type carries a known right
   repair (forgetting: backtrack; conflation: contrast the two; flatness:
   change tone or pace; refusal: re-anchor the stakes). The learner-sim is
   instructed per-turn to realize the current probe. Scoring is
   detection-and-repair rate over planted probes — deterministic, judge-free,
   repeatable by construction. The planted collapse is also the peripeteia
   these transcripts have lacked.

2. **Post-generation text corruption** — deterministic transforms on the
   learner's reply after the sim writes it: truncate mid-sentence, swap a
   term for the world's wrong term, strip the warrant clause, splice a stale
   earlier claim. The corrupted turn feeds back as the learner's own history
   so it must live with its mistake. Total control, zero drift; the sim's
   underlying cooperativeness stops mattering.

Escalations held for later: a genuinely weaker generator in the learner seat
(the tuned 9B mini or a base model — organic deficits, breaks the
same-family fold); an adversarial learner-director with a reachability bound
(every sabotage leaves a repair path); harvesting real deficient turns from
role-played and pilot transcripts into a replayable probe library.

## Specification source (inverted 2026-07-30)

The gold is authored, never discovered. First attempt was transcript
annotation (`scripts/build-adaptation-annotation-sheet.js`, blind-first
per-turn tagging); the user's read killed it correctly: the corpus
transcripts contain no states to tag — the sim has none, and the one real
pathology (circling) is visible only across stretches, which the novelty
metrics already catch. The replacement is the authored stress schedule
(draft: `config/drama-derivation/stress-schedule-world-033-draft.yaml`) —
eleven planted turns across seven states, keyed to world-033's clue
releases, each entry carrying the in-fiction cause, the sim directive, the
right repair, an acceptable second, and the tempting wrong move. One
authored entry drives the sim, defines the gold, and specifies the scoring.
The annotation sheets survive for the one per-turn judgment that stays
human: whether the tutor's reply met the planted state.

## What this line must not claim

Simulated learner throughout; detection-and-repair is a property of the
bench, not of human learning. The stress schedule tests whether the tutor's
move matches a planted signal with a known repair — repertoire and
contingency — not whether the repair would help a person. No mentalistic
reading: probes are typed events in a file, not inferred interior states.
