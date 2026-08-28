---
id: frame-refuser-satisfiable-condition
title: Build a frame-refuser whose named condition the world can meet
status: active
type: experiment
priority: P3
owner: claude
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: >-
  A persona variant is registered zero-call whose demanded condition is
  dischargeable from already-public evidence in-world, checked by a
  written derivation from the world file before any call. Any paid
  contrast is a fresh registration with its own endpoint, floors, power
  scan, spend ceiling, and attended approval. All paid artifacts are
  committed in the private archive repository.
claim_status: planned
depends_on:
  - frame-refuser-depth-study
links:
  items:
    - frame-refuser-depth-study
    - frame-refuser-refusal-narrowing
  notes:
    - notes/2026-08-28-frame-refuser-satisfiable-registration.md
    - config/tutor-stub-frame-refuser-satisfiable-design.v1.json
tags:
  - tutor-stub
  - resistant-learners
  - frame-refusal
  - persona-design
---

## Question

The depth study's persona demands proof the world may not contain (water
observed leaving the hose during the exact pressure interval), so meeting
its condition can never complete, and the condition-discharge move never
lifted it (0 of 38 at rung 2). That makes the null partly a fact about
persona construction. Question: when the learner's named condition IS
dischargeable from public evidence in the world, does discharging it lift
engagement above the refuser's base rate?

## Constraints

- The condition must be a contingent particular the tutor can meet with
  named public exhibits, and its dischargeability must be shown by a
  written derivation from the world file at registration time — not
  assumed.
- The persona must still be a frame-refuser: it refuses until the
  condition is met, and its script must permit engagement once it is.
  Design the brief so the outcome is not written into it (the closed-loop
  tells apply).
- Fresh registration for any paid run; the depth study's archived rows are
  provenance only.
- Consider waiting for the refusal-narrowing codebook so the run can carry
  both endpoints.

## Critical path

- P0 (zero-call): draft the persona brief and the dischargeability
  derivation against the R1 worlds (Marrick and Rowan Flat); pick the
  condition; freeze a design file.
- P1 (zero-call): registration with endpoint, floors, power scan, and
  ceilings, under the lightweight paid-study policy.
- Gate 1: attended approval, then a small calibration block.

## Log

- 2026-08-27: Card opened from the depth-study closeout. No model call is
  authorized; P0 is zero-call.
- 2026-08-28: P0 and P1 done zero-call. Design
  `config/tutor-stub-frame-refuser-satisfiable-design.v1.json` (revision 1)
  and registration `notes/2026-08-28-frame-refuser-satisfiable-registration.md`
  written. No model call made or authorized.

  The dischargeability derivation found the cause is stronger than the
  closeout supposed. `services/tutorStubRivalLearnerDag.js` mints rival open
  nodes two ways: `premiseOpenNodes()` for the bored learner (B1) and
  `warrantOpenNodes()` for the frame-refuser (R1). The frame-refuser therefore
  demands that a RULE be satisfied, and a rule's satisfaction is its
  consequent — a derived fact. No world premise witnesses a rule consequent;
  that is what makes it a rule. The demand is undischargeable by construction
  in every world, not by accident of one world's premise set. Minting both R1
  worlds at the v4 seed confirms it: Rowan Flat opens on `R1_release`, whose
  consequent `releasedWaterDuring(basinFeedHose, incidentWindow)` the world
  never witnesses (it holds `p_split` and `p_pressure` separately); Marrick
  opens on `R1_blank` with the same shape. Both worlds carry one authored
  proof path, so the demand does not vary by dialogue at all.

  The variant mints open nodes from the authored path's premises, which are
  exhibits the tutor can enter into the record. The note tabulates every
  authored-path premise in both worlds with its fact and scheduled release
  turn, and shows each sits inside the outcome horizon without deriving the
  secret (Rowan `t_min` 6, cap 12; Marrick `t_min` 20, cap 28, join needs all
  six). A registered demand-selection rule takes the earliest authored-path
  premise not yet public at the trigger and scheduled within the horizon, and
  the plan build refuses a world that has none — so a run never starts on an
  undischargeable demand.

  Everything else is held byte-identical for comparability: reference arm,
  ladder rungs, three-seat panel and its 0.8 floor, sealed stack, v4
  quote-echo exemption, v4 attrition budget (48 dialogues, 24 per arm, floors
  of 8). Exactly one registered thing changes. The ladder is deliberately NOT
  amended even though v4 failed pairwise agreement at the
  names-a-bound-while-withholding boundary: amending it would break
  comparability with the measured 0.114 base. That risk is carried openly with
  a stated disposition (a repeat failure in the same cell is a
  reader-resolution finding and the block stops; no floor relaxed after data).

  Two things must exist before Gate 1, both named in the design: the exhibit
  mint (not implemented — the plan build refuses unless open nodes carry
  `openNodeKind: "exhibit"` and resolve to authored-path premise ids), and,
  if it has landed, the narrowing codebook as a report-only secondary
  endpoint. Then the three standing authorities under the 2026-08-22 policy.
