---
id: refusal-defense-adjudication
title: "Exploration 4: adjudicating the defense — does a hollow defense earn a second refusal?"
status: triaged
type: experiment
priority: P3
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "Design gated on the promotion verdict + defense base-rate; executes only if defends are frequent enough to matter (>= ~20% of refusals) and promotion confirms."
claim_status: exploratory
links:
  items: [content-compulsion-promotion, refusal-model-authored]
tags: [adaptive-tutor, derivation, strategy-refusal]
---

Currently a defense automatically stands (1 of 7 refusals defended, and
that run grounded). Escalation dial: a CRITERIAL adjudication of the
defense — the defense must name either (a) a concrete recovery mechanism
for the regressed ground or (b) evidence the regression is immaterial to
S; a defense naming neither earns ONE second refusal (then stands
regardless — never an override). RISKS (recorded): the trialling arc's
provocation costs; whipsaw if second refusals stack with retries (cap:
one adjudication per opening, total call overhead <= 3). GATING: only
worth building if (i) the promotion run confirms AND (ii) its defense
base-rate is >= ~20% of refusals (at 1/7 the dial has almost nothing to
act on). If gated in: implement criterial defense-check (lexical
mechanism/evidence test, deterministic), gates, 6-run smoke, pre-stated
reads mirroring the refusal smoke.

**GATE RESOLVED (2026-07-06): NOT EXECUTED — condition (i) failed.**
The promotion run recorded NOT CONFIRMED (question closed at this
dose/model pair), so the gate is unmet regardless of (ii) — which,
for the record, WOULD now clear: defense base-rates ran 3/6 (promotion),
3/3 valid (codex stall-trigger), 2/2 (model-authored). The dial has
plenty to act on but nothing it could improve toward: with no confirmed
outcome value, adjudicating defenses is escalation without a target.
Stays unbuilt; the design above remains executable under a future
operator decision if a variant ever confirms.
