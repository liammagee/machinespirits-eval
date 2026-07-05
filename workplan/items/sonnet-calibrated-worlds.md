---
id: sonnet-calibrated-worlds
title: Sonnet-calibrated worlds — find the dose/world where a mid-tier baseline has headroom
status: active
type: experiment
priority: P2
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "The dose ladder (rules pre-stated below) either finds a calibrated condition set (Sonnet baseline in the target band, 3-run screens) or exhausts with a recorded structural-floor verdict; either way the outcome is recorded before any contrast prereg."
claim_status: exploratory
links:
  notes: LEMMA-SONNET-CONTRAST-PREREGISTRATION.md
  items:
    - lemma-sonnet-contrast
    - proof-lemma-layer
tags:
  - adaptive-tutor
  - derivation
  - calibration
  - model-tiers
---

Operator gate taken 2026-07-05: make the mid-tier lemma-map question
MEASURABLE. Last night's void showed "headroom" is a property of
world x decay-dose x model — the catalog's screens all ran against codex.
Cheapest lever first: calibrate the DOSE on existing RICH worlds before
authoring new fiction.

**Pre-stated procedure (rules BEFORE data; screens are 3 Sonnet baseline
runs each, seeds 163/167/173, binding stack minus/with the stated decay):**

1. **D0 diagnostic (decisive):** marrick, NO decay. If 0/3 grounded, the
   floor is the world geometry itself for Sonnet (decay irrelevant) ->
   skip to step 3. If >=2/3 grounded, decay dose is the lever -> step 2.
2. **Dose ladder on marrick (descending severity until the band):**
   D1 = {rate 0.15, mutateShare 0.25, maxConcurrent 2};
   D2 = {rate 0.25, mutateShare 0.25, maxConcurrent 2};
   D3 = {rate 0.25, mutateShare 0.5, maxConcurrent 3}.
   BAND RULE: a dose qualifies when the 3-run screen shows 1-2/3 grounded,
   OR >=1 grounded with T* spread >=3 (variance + winnability at n=3).
   First qualifying dose wins; ladder stops. 3/3 grounded = too easy,
   step UP one dose; 0/3 = too hard, step DOWN.
3. **Geometry fallback (only if D0 fails):** repeat D0 on lantern
   (world-002: RICH linExt 3, elimination-shaped, cap 26 — the shortest
   RICH world). If lantern D0 also floors 0/3, record STRUCTURAL FLOOR:
   no catalog world is Sonnet-playable even undamaged; authoring a new
   easy RICH world becomes the (separately gated) path.
4. On a qualifying (world, dose): screen the PARTNER world at the same
   dose (marrick-resistant, or lantern-pair) with the same band rule.
   Two qualifying strata -> the calibrated condition set is recorded and
   a fresh mid-tier contrast prereg becomes proposable (operator gate).

Screens are exploratory instrument work: no claims, no contrast data.
Cost: CLI quota only, 3-12 runs, ~10 min each at concurrency 3.
