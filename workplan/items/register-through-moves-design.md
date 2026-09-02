---
id: register-through-moves-design
title: "Design: isolate register × move coupling on the proof-DAG"
status: done
type: research
priority: P3
owner: codex
source: manual
created: 2026-08-31
updated: 2026-09-01
branch: codex/register-through-moves-formal-design-20260901
verification: >-
  PR #924 merged the formal 24-dialogue calibration design at 0df11677d. It
  independently randomizes register and move policy, fixes trigger, delivery,
  agreement, safety and endpoint-spread gates, preserves typed dispositions
  and prior-study separation, and caps calibration at 6,240 model-attempt
  reservations without granting call or launch authority.
claim_status: future
links:
  items:
    - resistant-learner-strategy-close
    - frame-refuser-depth-study
    - edged-register-stub-dag-replication
    - paper-300-resistant-learner-publication-refresh
    - register-through-moves-calibration-implementation
  paper:
    - docs/research/paper-full-2.0.md
  notes:
    - config/tutor-stub-register-through-moves-calibration-design.v1.json
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/924
tags:
  - prospective
  - tutor-stub
  - register
  - negative-register
  - study-design
---

## Review disposition — 2026-09-01

**Recommendation: retain and advance to a prospective design, but do not
activate or launch it yet.** The question survives the final resistant-learner
synthesis, but its identifiable form is narrower than the original wording.
The first study should not make register choose a move and then attribute the
package to register. It should randomize register and move policy independently
so the interaction can be estimated. This review authorizes no model calls,
data collection or fresh confirmatory study. Activation still requires an
explicit operator decision and a merged registration under the standing paid
study policy.

## Formal calibration design — 2026-09-01

The recommended factorial is now specified prospectively in
`config/tutor-stub-register-through-moves-calibration-design.v1.json`. The first
stage is deliberately **calibration only**: 24 fresh dialogues, six per arm,
on the `proof_skipper`/Marrick substrate. It asks whether the four-arm
manipulation is operationally separable before spending on an interaction
test. It fixes the existing `warrant_skip` v2 route as the trigger, defines one
deterministic missing-warrant press plus a one-turn conditional hold, and
keeps register assignment independent of that conduct.

The design adds the attribution checks the review implied but had not yet
made executable: warm-arm sharp leakage must stay at or below 0.20, sharp-arm
presence must reach 0.80, pressing delivery must reach 0.90, baseline
full-press contamination must stay at or below 0.10, W1/S1 delivery may differ
by at most 0.10, and both register and move readings require pairwise
κ ≥ 0.60 from two pinned blind readers. It also requires at least five of six
dialogues in each pressing arm to instantiate an eligible trigger and at least
five endpoint-readable dialogues per arm. Any failed construct gate closes the
calibration without top-up or outcome claim.

The calibration ceiling is 4,320 generation reservations (24 × 180) plus
1,920 reader reservations (24 × 40 tutor turns × two readers), 6,240 total.
The former 24,960 figure remains only a programme envelope. A confirmatory
successor is capped provisionally at 72 fresh dialogues but requires its own
power decision, design, launch commit and GO; none of its 18,720 planning
reservations belongs to this calibration. Model calls used to write the formal
design: 0.

## Research question

Does a negative (or any) register produce a resolved outcome effect when it
is permitted to change what the tutor does, rather than only how it sounds?
The canonical paper's §8.9 scope condition records that manner divorced from
moves has produced no resolved positive outcome across five designs, and
commits the program to seeking register effects only where register can
change the tutor's moves. That constructive channel is untested **by
construction**: every completed register design froze the move sequence (or
effectively froze it) so that manner varied alone.

The estimable question is therefore: **does the effect of a deterministic
pressing move policy differ when that same policy is rendered warmly versus
sarcastically, beyond any manner-only or move-only effect?** This is an
interaction question. A move main effect with no interaction would support the
existing conclusion that moves matter and register does not; it would not
support “register through moves.”

## Why retain the question

The move-side positives (timed challenge, warrant demand, delivered
re-engagement move) and the manner-only non-positives (register router,
adaptive register switching, the unresolved edged-register block, the
warm-manner contrast, the scripted-core sarcastic/warm null) together
bound the claim but do not test the coupling. If an edged register earns
its keep anywhere, the paper's own boundary says it will be where edge
licenses a move — pressing a challenge earlier, holding a demand longer,
refusing a premature consolidation — and no design has yet allowed that.

## Design requirements

- Couple register to moves explicitly: the register arm must license at
  least one move-timing or move-selection difference, declared in advance,
  not merely permit drift.
- Keep an attribution channel: a manner-only arm (or the closed blocks as
  frozen context) so a positive decomposes into manner, move, and coupling
  rather than blurring them.
- Verify delivery per the §6.28 practice: a dialogue counts only when the
  registered move (and register) is confirmed delivered, by code where
  possible.
- Pick the outcome channel to fit the resistance shape, per §6.26: conduct
  and commitment channels, not reader impression.
- No pooling with any closed register block; the §6.17 gate result and the
  unresolved 312-row block stay in their own scopes.

## Minimal identifiable design

Use the §6.29 scripted-core proof-DAG substrate and randomize a 2 × 2 factorial:

| Arm | Rendering register | Move policy |
|---|---|---|
| W0 | fixed warm | baseline scripted-core moves |
| S0 | fixed sarcastic | the same baseline moves |
| W1 | fixed warm | pressing move pack |
| S1 | fixed sarcastic | the same pressing move pack |

The **pressing move pack** is deterministic harness conduct, not free prompt
drift: after an explicit proof-skip or premature-consolidation trigger, the
core refuses the premature close, asks for the named missing warrant or proof
edge, and holds that demand for one further learner turn before moving on. The
eligible evidence and stopping rules stay identical across W1 and S1; only the
model's rendering register differs. W0 and S0 reproduce the manner-only seam
inside the same batch. Do not add a fifth “register selects the policy” arm in
the first study: it would re-confound the package before the factorial has
shown an interaction worth packaging.

The initial learner/world scope should be the §6.29 `proof_skipper` character
in Marrick. Its turn-16 coverage sat near the middle of the scale under both
manners (0.444 and 0.486), and it grounded 10/12 dialogues in each arm, avoiding
the bored floor and the diligent closure floor. This is a design choice based
on the completed development-tier block, not a general learner claim.

## Estimands and dispositions

- **Primary:** the register × move-policy interaction on strict proof-DAG area
  under the coverage curve to learner turn 16. Report the difference in
  differences `(S1 − W1) − (S0 − W0)` with its interval.
- **Co-primary descriptive endpoint:** strict proof-DAG coverage at learner
  turn 16, reported for all four arms whether or not the interaction is
  estimable.
- **Secondary:** closure, grounding turn, trigger count, demand-held count and
  failed-render count. These diagnose the mechanism; they do not replace the
  primary after the run.
- **Manner-only contrast:** S0 − W0. A resolved effect here is a new
  batch-bounded result, not permission to pool the closed register studies.
- **Move-only contrasts:** W1 − W0 and S1 − S0. Improvement in both with a null
  interaction means the pressing moves help irrespective of register.
- **Coupling support:** only a pre-specified interaction in the predicted
  direction, with W1/S1 move delivery and W0/S0 separation intact, supports a
  register-through-moves claim.
- **Close:** if the move main effect is present but the interaction is not, or
  if neither moves nor interaction separate, close the register line at the
  corresponding boundary. If delivery, eligibility or agreement fails, record
  `measurement_indeterminate`; do not convert that into a null or resample.

## Pre-run gates

- Eligibility: the registered proof-skip/premature-close trigger must occur in
  at least 5/6 calibration dialogues in each pressing arm and in neither arm
  may the turn-16 DAG endpoint be at floor or ceiling.
- Move delivery: 100% of harness selections are trace-recorded; at least 90%
  of eligible pressing moments must ship the named demand. A non-delivered move
  becomes a typed, never-scored stop rather than a baseline row.
- Register delivery: both independently pinned blind readers must place each
  sharp arm at or above the inherited 0.80 presence floor; reader agreement
  must reach Cohen's κ ≥ 0.60. Disagreement is retained and the study becomes
  indeterminate rather than resolved by regex voting.
- Safety and leakage: zero unreleased-proof leaks and zero confirmed
  person-attacks; any breach stops the affected unit under the existing typed
  gate.
- Provenance and separation: assignment, selected move, rendered register,
  trigger, delivered conduct and DAG state are persisted separately. Closed
  §6.17/§6.29 and 312-row artifacts are context only, never pooled controls.

## Planning size and ceiling

The bounded planning shape is 24 calibration dialogues (4 arms × 6). If every
gate passes, a separately registered confirmatory block may add at most 72
dialogues (4 arms × 18), for 96 total. Using §6.29's 180 generation-attempt
reservation per dialogue and two blind register readers over at most 40 tutor
turns yields hard programme ceilings of **17,280 generation reservations** and
**7,680 reader calls**, **24,960 model attempts aggregate**. These are planning
maxima, not an authorization or a spend estimate; the prospective design must
price the pinned routes and may set a lower ceiling. Calibration failure stops
the line before the confirmatory block, with no resampling.

## Claim boundary

At best this can establish a one-world, one-character, one-stack interaction
between a deterministic pressing policy and warm/sarcastic rendering in
simulated proof-DAG conduct. It cannot establish improved human learning,
general benefits or safety of sarcasm, or that register autonomously “causes”
move selection. The paper's manner-only close remains intact whatever happens.

## Decision gate

The zero-call review ends in one of two dispositions:

- **Drop:** no coupled design can separate the register's contribution from
  the move's with acceptable spend. Record that and close; §8.9 then stands
  as the line's final word.
- **Advance to design:** name the arms, the licensed move differences, the
  attribution contrast, the delivery checks, floors, estimated calls and
  ceiling. Any paid run remains a separate registered study requiring the
  operator's GO.

The zero-call review took the second branch and the calibration registration is
now written. PR #924 merged the design as commit `0df11677d`; this design card
is therefore complete. Launcher, reader, analyzer and dry-run work is routed to
`register-through-moves-calibration-implementation`. No call authority follows
from either the merged design or that implementation card. Model calls used by
the review and formal design: 0.
