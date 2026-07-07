---
id: shrinkage-probes
title: "Shrinkage probes: within-seed replication + null-scaling controls"
status: done
type: experiment
priority: P1
owner: unassigned
source: manual
created: 2026-07-07
updated: 2026-07-07
branch: worktree-classifier-dag-register
verification: "Both limbs run under the frozen prereg; the pre-stated reads recorded; §5.12.7's 'neither has been run' sentence replaced under the usual audit."
claim_status: methods
links:
  notes: SHRINKAGE-PROBES-PREREGISTRATION.md
  items:
    - register-router-contrast
    - classifier-dag-register
tags: [methodology, shrinkage, derivation]
---

The two discriminating tests §5.12.7 registered when reading the
six-specimen shrinkage record as "near-zero true effects under
tail-selection" (operator: "do two suspicion-probing experiments").
LIMB B (drift vs sampling variance): the register-router smoke's exact
six arms re-run twice at their own seeds (419/421/431, Sonnet) — read =
outcome-flip count across three replications (≥2/6 flips establishes
within-seed sampling variance as the dominant term; ≤1 puts drift back
on the table). LIMB A (selection asymmetry): two KNOWN-NULL smokes
scaled to n=10/arm — A1 the inert learner-mirror-refusal placebo
(Sonnet, primes 541–599), A2 the null codex register-router smoke
(codex, primes 601–653; the router question stays CLOSED, no mechanism
reading licensed). Reads = null-distribution Δ/U, excursion check
(do known nulls produce promoted-smoke-sized signals?), sign symmetry.
Methodology only; every closed question stays closed; analysis
deterministic (scripts/analyze-shrinkage-probes.js, pre-freeze
validated).

**OUTCOME (2026-07-07):** LIMB B: 2/6 outcome flips at identical
seeds/config/provider (criterion met), one flip in each direction,
fires varying at fixed seeds — within-seed sampling variance dominant;
drift unnecessary; smoke-tier n=3 contrasts formally uninformative.
LIMB A: the PLACEBO (flag fired 0 times; prompt-identical arms) scaled
to Δ=−2.80, 10/10 vs 6/10 grounded, U=80/100 — PAST the one-sided 0.05
point: a known nothing produced a promoted-thread-sized, bar-clearing
signal. The active null (A2) wobbled unremarkably (Δ=−0.70, U=58/100).
The censored record's one-way curse does not survive the uncensored
control: regression works both ways, and §5.12.7's zero-truth +
tail-selection account is confirmed from both sides. Standing
recommendation: smokes license mechanism-availability reads only
(fires/conduct/leaks); outcome colour reported without arithmetic;
outcome claims begin at pre-registered tier with shrunken-estimate
sizing. Deviations disclosed on the prereg (rerun2 skip, A1 codex,
quota interruptions — all operator-directed or label-exact-resumed).

