---
id: exploratory-confirmatory-shrinkage-audit
title: Shrinkage audit — why do good exploratory results shrink on confirmation?
status: triaged
type: research
priority: P2
owner: unassigned
source: manual
created: 2026-07-04
updated: 2026-07-04
branch: worktree-strategy-ledger-followups
verification: "Pure-computation audit over existing matrix artifacts produces per-pair observed-vs-selection-predicted shrinkage; lands as a §5 methodology subsection; no new paid runs required."
claim_status: methods
links:
  items:
    - proof-lemma-layer
    - strategy-ledger-followups
tags:
  - methodology
  - statistics
  - meta
---

Operator observation (2026-07-04, during the lemma-display confirmatory):
"We often have this good exploratory result followed by null or minimal
results on a scaled version. More than by chance." Noted for return.

The arc now holds enough exploratory→confirmatory PAIRS with frozen
artifacts, matched seed designs, and recorded statistics to study this
quantitatively: V2b pilot→confirmatory (replicated primary, negative
transfer); flash smoke→cross-model (fully reversed); lemma exploratory
display arm (U=40.5, 6/12 vs 1/12)→display confirmatory (running at note
time, tracking much thinner); plus plan-mode's direction-without-power and
the world screens.

**Candidate mechanisms to separate, all measurable from disk:**
1. Winner's curse / regression to the mean — bootstrap per-run artifacts
   for the sampling distribution of U at n=12/arm; compare observed
   shrinkage per pair to selection-predicted shrinkage.
2. Bar calibration — bars set AT the exploratory point estimate (e.g.
   U≤42 vs an exploratory 40.5) make confirmation ~a coin flip even when
   the true effect equals the estimate; record as a design rule: power
   confirmatories against a SHRUNKEN estimate or raise n.
3. Draw-to-draw heterogeneity — estimate the between-matrix variance
   component from the ~15 matrices on disk (e.g. marrick baseline 0/6 on
   seeds 59-79 vs 1/6-with-fast-win on 101-127); derive the n a stable
   grounded-rate contrast actually needs.
4. Backend nonstationarity — paired seed/world/arm cells run on different
   days permit a within-condition drift test on the quota-metered CLI.
5. The observation's own selection effect — nulls are never re-run, so
   only positive→worse transitions are observable; compute the base rate.

Deliverable: shrinkage audit script + report; interpretation lands in
paper §5 (methodology) beside the closed-loop-tells discipline. Zero paid
runs. Trigger: after the lemma-display confirmatory verdict is recorded.
