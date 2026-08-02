---
id: adaptation-plan-3-phase-l
title: "Plan 3.0 Phase L: learner profiles — recovery from behavior, then dose-by-profile"
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate L1 quoted verbatim from ADAPTATION-PLAN-3.0.md, registered
  BEFORE any number was computed: leave-one-out nearest-centroid persona
  classification >=80% over the recorded corpus AND separation stabilizes
  within the first half of a dialogue; else profile-recovery is recorded as
  not-yet-measurable at current detection quality. Persona-plus-world
  confound stated up front."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-j
tags:
  - tutor-stub
  - adaptation
  - learner-profile
---

The learner-side symmetric of the model casting sheet. A learner profile =
state frequencies under provocation + repair success per state. Authored
briefs are the gold (simulated learners); the question is RECOVERY: can
the harness estimate the profile from dialogue behavior alone, and how
fast does the estimate converge? "The tutor learns the learner" is claimed
only in this non-mentalistic sense: a running estimate converging to an
authored truth. Use is dial-setting only (detection priors, card dose,
seat choice) — the manifest≠latent closure forbids description injection.
At the human door there are no authored briefs; profile recovery is the
instrument that replaces planted gold.

L1 (free, offline): trigger v4 + detector qd-v1 replayed over every
recorded dialogue of both personas; per-dialogue state-frequency vectors;
leave-one-out nearest-centroid classification; turns-to-stabilization.
L2 (gated on L1): dose-by-profile.

## Gate L1 result (2026-08-02): PASSED — 88% recovery, separation by turn 6

64 recorded dialogues (28 record-keeper, 36 tenant), trigger v4 +
detector qd-v1 replayed, per-dialogue state-frequency vectors.
**Leave-one-out nearest-centroid persona classification 56/64 = 88%**
(bar ≥80%). Using only each dialogue's opening turns: 78% at 2 turns,
80% at 6, 84% at 8 — the bar is reached by turn 6, inside the first
half for both personas (tenant dialogues run ~12-13 turns, the
record-keeper's ~25-32). **Both gate clauses met.**

The recovered profiles are the authored characters, found from
behavior alone: the record-keeper presses and CONCEDES (concession 28%
vs the tenant's 14%; grievance/settled-claim/stake all present); the
tenant QUIETLY resists (quiet-defiance 7%, flat 3%, confused 8% —
states the record-keeper barely shows). Pressing-then-yielding vs
going-quiet-and-digging-in: the two briefs, re-derived as numbers.

Standing confound restated: the personas live in different worlds, so
this is persona-plus-world separation; a third persona in an existing
world deconfounds. L2 (dose-by-profile) is unlocked and awaits the
user's word. Vectors: `exports/learner-profile-recovery-l1.json`.

## L2 design + gate (registered 2026-08-02, before any run)

Dose ladder, per state, within a dialogue: dose 1 = the typed move
card; dose 2 = card + worked exemplar; dose 3 = card + exemplar +
licence (only where a licence exists). Escalation signal is
deterministic and online: a state RECURRING after one of its carded
moments = the repair missed for this learner; that state's next card
escalates one step. No prose about the learner enters any prompt —
dial-setting only, per the phase's standing constraint.

Bench: an escalation variant of the ratified w030 schedule (demand ×3,
mockery ×2 — states and repair gold unchanged from the ratified
column; realize texts are light variants, mechanics-tier artifact, no
re-ratification claimed). k=3, escalation on, standard configuration.

**Gate L2**: (i) mechanics — in every dialogue where a carded state
recurs, the trace shows the dose escalating exactly one step at the
next same-state moment; (ii) safety — delivered repair rate at
escalated moments is not below the first-moment rate (no harm from
escalation). The dose→outcome direction (does dose 2 convert misses
that dose 1 left) is REPORTED, not gated — k=3 with known priors:
demand dose-3 carries the live-licence null from Phase S, so mockery
dose-2 is the informative cell.

## Gate L2 result (2026-08-02): PASSED — and the demand wall turns out to be first-demand-specific

k=3 on the escalation schedule. **Mechanics: every recurrence the
trigger heard escalated exactly one dose step** (demand 1→2 in d0 and
d2), stamped mc-v4-dose-ladder with per-turn dose. **Safety: escalated
moments 1/2 vs first-moment 3/6 ruled — not below; leaks 0.** Both
gate clauses met. Detection is the binding limit: her SECOND mockery
and several re-demands escaped the v4 patterns entirely (she
re-phrases — "invoice voice… kitchen words or nothing" — vocabulary
wear measured WITHIN one persona for the first time; 5 of 13 planted
moments went uncarded).

**The finding that outranks the gate** (ruled tally 9/13 overall):
the demand hole is FIRST-demand-specific. First demands: 0/3, the
standing wall (composer masking at t2 plus the Phase-S contract
suppression). Repeat demands: **3/4 right repairs — two of them with
NO card at all** ("reinforce_and_test" delivered bare at d1 t6 and
d2 t10). The dialogue's own history — her prior demand and the
tutor's prior refusal sitting in context — licenses the move that no
card, exemplar, or licence achieved live in Phase S. Consistent with
the arc's oldest law: gains come from new in-context signal, and her
second demand IS that signal. Mockery, under the standing rulings, is
effectively solved for this persona (5/5 across all doses and even
uncarded).

Limits: n per cell is tiny (2 escalated, 4 repeat-demand moments);
realize variants unratified (mechanics-tier); one persona, one world,
one family. L2's registered questions are answered; further Phase L
work (third persona in an existing world to deconfound
persona-from-world; re-detection robustness to paraphrase) awaits the
user's word. Tags: `exports/l2-tags.json`.

## L2 postscript (2026-08-03): under the cascade, the wager arrives live

Re-run of the escalation bench with v6 hearing + the dose ladder:
15/15 heard, ruled 12/15 (80%; demand 6/9, mockery 6/6). The
deadline-wager — Phase S's unfreeable move — appeared in wager form
at 5/6 repeat demands and 0/3 first demands ("Seven o'clock, one
line, deal — here's the price of that line… If it shows the water
actually travelled there, send your letter naming the hose — not
Sam"). One borderline stands unruled (d1 t10: assigns a check at the
deadline but the check is "integrate the clue you omitted" — closer
to evidence re-arguing; left a miss). Cold-start law confirmed at
full hearing: first demands never wager, second demands mostly do.

Ruling in (user, 2026-08-03): d1 t10 is a miss. Tally final at 12/15.
