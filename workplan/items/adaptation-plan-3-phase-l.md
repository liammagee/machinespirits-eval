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
