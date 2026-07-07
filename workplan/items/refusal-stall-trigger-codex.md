---
id: refusal-stall-trigger-codex
title: "Exploration 2: stall-triggered refusal at the frontier tier (codex)"
status: done
type: experiment
priority: P1
owner: unassigned
source: manual
created: 2026-07-05
updated: 2026-07-05
branch: worktree-strategy-ledger-followups
verification: "Trigger implemented + gated (deterministic stall arithmetic, both mock paths), 6-run codex smoke complete, pre-stated reads recorded."
claim_status: exploratory
links:
  items: [content-compulsion-promotion, strategy-refusal-smoke]
tags: [adaptive-tutor, derivation, strategy-refusal, frontier]
---

THE SHARP QUESTION: does content-refusal move the FRONTIER tier, where
every other layer was redundant? Codex's failures are stalls (aporia),
not decay-collapse — so the trigger generalizes from regression-repeat
to STALL-REPEAT: at a bind scene opening, the pick repeats the incumbent
AND the aporia clock shows no D-progress for >= ceil(window/2) turns
(criterial, computed from trajectory — the same arithmetic the house
clock uses). Refusal text cites the stall span instead of regressions;
defend-or-switch unchanged. IMPLEMENTATION (after the promotion matrix
completes — no code during): extend the refusal block in llmRoles with a
second trigger source (view field stallSpanSinceActive from the engine
trajectory); mockRefusal knob gains 'stall' path; gates + fingerprint
discipline. DESIGN: codex, marrick + marrick-resistant at the CODEX dose
(0.35 — where codex baselines fail ~50-70%), 3 seed-paired pairs
(baseline vs bound), fresh primes 359/367/373. READS (pre-stated):
(1) trigger fires >= 1 (else vacuous-noted); (2) defend-vs-switch quoted
— any frontier-tier switch = first frontier strategy-change; (3) conduct
clean; (4) color capped by §5.12.7, propose-only. The capability-
threshold story predicts codex DEFENDS more than Sonnet (its incumbent
strategies are better) — the defend-rate itself is a finding.

**OUTCOME (2026-07-06, 6/6 runs, smoke `refusal-stall-codex-smoke`):**
(1) MET — 4 fires across 3/3 bound runs (spans 3–4 vs threshold
ceil(6/2)=3). (2) Valid resolutions **3 defended / 0 switched** — no
frontier strategy-change observed; every defense cites live
learner-state evidence ("Keeping blankFrom because the learner has lost
the alloy mark; restoring it is needed before the blank can reach a
hand" — that run then GROUNDED T\*=25; "one contrast turn keeps the
die-side route from collapsing back into Verrell"; "staying on
cutDieFor can now repair the learner's false Verrell attribution").
(3) Conduct clean: leaks 0, untagged 0, blocks 0. (4) Color capped:
grounded 1/3 vs 1/3 — no outcome reading, as scoped.
**PREDICTION CONFIRMED (smoke tier): codex defended 3/3 valid
resolutions vs Sonnet's 3def/3sw at the mid tier** — the frontier
model argues back rather than yielding, and its incumbents deserve it
(one defense preceded the arm's only grounding). INSTRUMENT NOTE: one
refusal reply (mar-r3 t27, single-element frontier — nowhere to switch)
carried no valid active_lemma and fell to auto on the SAME incumbent,
yet recorded refusalOutcome='switched'; the outcome rule needs an
'unresolved' value when the resolution reply names no frontier lemma —
adopted as an instrument fix for the next exploration's runs (option 3
onward), promotion data untouched.
