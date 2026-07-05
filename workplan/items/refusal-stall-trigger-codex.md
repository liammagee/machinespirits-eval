---
id: refusal-stall-trigger-codex
title: "Exploration 2: stall-triggered refusal at the frontier tier (codex)"
status: active
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
