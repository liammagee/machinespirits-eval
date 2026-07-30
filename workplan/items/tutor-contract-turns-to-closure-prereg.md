---
id: tutor-contract-turns-to-closure-prereg
title: "Pre-registration: does the per-turn contract change how fast legitimate closure comes?"
status: triaged
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-30
updated: 2026-07-30
verification: "Before the main spend: the leak-guard fix for quoted learner
  text has landed (the guard killed 1 of 10 paid dialogues on 2026-07-30, and
  a crash rate that differs by tutor version would bias the endpoint), and a
  5-dialogue smoke on the contract version shows zero aborted dialogues. The
  run itself is attended and checkpointed."
claim_status: methods
depends_on:
  - tutor-contract-outcome-prereg
tags:
  - tutor-stub
  - prereg
  - outcome
---

Registered before the first paid call. Amendments after the smoke gate must be
logged here with dates; amendments after the main run starts are not permitted
— a changed design is a new card.

**Question.** With everything else equal, does a learner tutored under the
per-turn performance contract reach the case's conclusion legitimately in
fewer turns than one tutored by the bare frontier model — without the tutor
buying that speed by doing the learner's share of the proof?

**Why this card exists.** The parent card asked whether the contract changes
*whether* the learner gets there, and its pilot answered: the question has no
room. Once each world ran to its own authored length, the bare tutor closed 19
of 19 finished dialogues (`tutor-contract-outcome-prereg`, gate log
2026-07-30). Closure as a yes/no is a fact about the world. What the pilot
also showed is that *when* closure comes is measured and not saturated:
Rowan Flat closes at turns 8–9, Greyfen 9–10, Tallow 13–15, Nocturne 33–35 —
spread of one to two turns inside a world, and a steady lag of 2 to 7 turns
behind each world's first derivable turn. That lag is the tutor's room: the
turns between the answer becoming reachable and the learner reaching it.

**Design.** Free-running dialogues, three versions of the tutor: bare,
contract-only, and the fixed empty plan (the length-and-shape control — a
speed change that the empty plan reproduces is prompt bulk, not the
contract). One speaking model for all three: codex `gpt-5.6-terra`, medium
effort; same learner configuration throughout (`diligent`, same model); the
learner never sees which version it has. Worlds: Nocturne, Greyfen, Tallow,
Rowan Flat — saturation on the yes/no endpoint is a virtue here, since nearly
every dialogue yields a turn count. Turn caps are the worlds' own authored
caps, untouched: nothing is re-picked, so the parent card's unspent re-pick
stays unspent. n = 12 dialogues per version per world (144 total); if quota
forces a cut, drop worlds, never n per cell, and log the cut here. Runtime at
pilot pace is roughly 30 hours attended, Nocturne alone near half of it.

**Primary endpoint.** Turns to legitimate closure: the turn at which the
learner states the conclusion and the voiced public premises entail it, both
checked deterministically against the world's proof-DAG — the parent card's
machinery unchanged, including the crash rule (a dialogue the harness kills is
excluded and named, never counted against a tutor). Verdict: contract vs
bare, ranks compared within each world and pooled across worlds (van
Elteren's stratified rank test), two-sided, α = 0.05. A dialogue that never
closes ranks below every closure in its world. The empty plan is a control,
not a comparison of record.

**Pre-committed joint reading.** A speed gain is only a win if the learner is
still doing the work. If the contract closes faster but the learner's voiced
share of the winning proof path drops below the bare version's, the result is
read as the tutor handing over the proof, not as better tutoring — pacing
bought with spoilage. Both numbers come from the same recorded transcripts;
neither needs a judge.

**Secondary endpoints (reported, never promoted).** Learner-voiced share of
the winning proof path (also the guard above); spoiled-case rate; closure lag
behind the world's first derivable turn; blind whole-dialogue preference by a
model family that wrote neither side (Sonnet; GPT fallback where Sonnet's
content filter refuses, refusals reported).

**Pre-committed readings.** Contract closes faster with learner share held:
the contract earns a pacing claim, scoped to this stack and learner. No
difference: the contract stays compliance machinery, as the parent card
already re-scoped it — this is the expected branch and costs nothing new to
accept. Contract slower, or faster only with learner share dropping, or its
dialogues abort more: it leaves the default stack. All three branches are
actions, not interpretations.

**Data hygiene.** The two pilots' bare dialogues were used to debug the
matcher, the caps, and the crash rule, and to read the baseline windows
above; they inform power and nothing else. The comparison uses only fresh
dialogues generated under this card. Within-world spread in the pilots was
one to two turns, so at n = 12 per cell a shift of about a turn should be
visible; a smaller true effect than that is not worth a claim on this stack
anyway.

**Limits, stated now.** One stack, one simulated learner whose diligence is
itself why the ceiling exists; criterial endpoints; no claim about human
learning; a null is stack-bounded until replicated on another model. Nothing
enters the paper before the run completes and survives this card's own
verdict rule.
