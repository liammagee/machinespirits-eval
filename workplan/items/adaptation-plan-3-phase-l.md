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
