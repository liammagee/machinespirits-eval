---
id: shrinkage-probes
title: "Shrinkage probes: within-seed replication + null-scaling controls"
status: active
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
