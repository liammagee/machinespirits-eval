---
id: guard-validity-study
title: Test whether the guards' vetoes pick the better turn
status: active
type: research
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-06
verification: >-
  For a sample of vetoed drafts, a blind pairwise comparison between the vetoed
  draft and what actually shipped, scored by a judge that never sees which is
  which or why either was chosen. Reported per guard family: how often the
  vetoed draft was preferred. A family preferred above chance is a family whose
  veto is costing more than it saves.
claim_status: planned
links:
  code:
    - services/tutorStubGuardDisposition.js
    - docs/tutor-stub-guard-catalog.md
  items:
    - guard-regime-fallback-census-at-scale
    - guard-delivery-prefer-model-over-canned
tags:
  - tutor-stub
  - guards
---

## The gap

There are roughly thirty deterministic checks at the tutor's mouth. Each was
added for a reason, usually a real failure seen in a trace. None has been
tested for whether it is right — whether the turns it rejects are in fact worse
than the turns that ship in their place.

The Phase-B census makes this urgent rather than tidy: the model's draft passes
10% of the time, and 62% of turns end in a template. If a meaningful share of
the rejected drafts were the better turn, the harness has been degrading the
thing it was built to measure, at scale, across every run on this stack.

The check is cheap and it has never been run.

## Design

The data already exists. Every guard-accounting record holds the drafts, the
findings on each, and what shipped. No new dialogues are needed for the first
pass.

**Sample.** From the fallible-phaseB traces, the 717 fallback turns, stratified
by the sole failing family where there is one (130 live turn progression, 86
costume, 48 repetition, and so on) and by cell, so no one world or persona
dominates.

**Comparison.** Blind pairwise: the vetoed draft against what shipped. The
judge sees the world's public state, the transcript so far, the learner's last
turn, and the two candidates in random order. It does not see the findings, the
guard names, or which candidate the harness chose. Question: which is the
better next tutor turn, and why.

**Readout.** Per family, the share of comparisons where the vetoed draft won.
Near chance means the veto is neutral and its cost is the template. Above
chance means the veto is harmful. Below chance means it earns its place.

**Second pass, harder.** The above compares against the template, which is a
low bar. The sharper comparison is a vetoed draft against a *passing* draft
from the same turn where one exists — that isolates the check from the
template's weakness.

## What has to be true for this to mean anything

- **The judge must not be the tutor's own family.** Author-family critics have
  already produced one confound in the poetics arc. Use a different family from
  whatever generated the drafts, and record it.
- **Blinding must be real.** The template has a fixed register — "Keep only
  what the public evidence already shows" — which a judge could learn to spot.
  If it can identify the template by style, the comparison is not blind. Check
  this first with a small held-out set before running the sample; if it fails,
  the design needs paraphrase or a different endpoint.
- **The three safety families are out of scope.** Their vetoes are contracts,
  not judgments. A judge preferring a draft that leaks the answer would not
  change anything.

## What it licenses

A family preferred above chance is grounds to move it off veto, with the number
attached, rather than by argument. A family below chance stays as it is and the
catalog says so with evidence. Either way the guard catalog stops resting on
the reasoning of whoever added each check.

It also gives `guard-delivery-prefer-model-over-canned` its scoring rule: the
families the judge says are costly are the ones the closest-draft rule should
be willing to ship findings from.

## Scope limits to state up front

One run's traces, one model as author, one judge family. This measures whether
these checks are right on this stack's drafts, not whether the checks are right
in general. Replication on a second author model is the obvious extension and
should not be assumed.

## Run plan (2026-08-06)

The replay made this card the gate: flipping the guard policy default waits on
its verdict, so it runs now, in three stages.

1. **Blinding probe, ~20 items.** Single texts, half vetoed drafts and half
   shipped templates, judge asked only "written for this moment, or assembled
   from stock lines?". If the judge names the template at high accuracy the
   pairwise design is not blind; expected, since the template's wording is
   fixed. The fallback design is already chosen: score each candidate alone on
   anchored 1–5 quality questions, never as a visible pair, so the judge rates
   text it cannot compare side by side.
2. **Main sample, ~150 pairs.** From the 717 fallback turns, stratified by the
   sole failing family where there is one and by cell. Context shown: the
   learner's last turn and the transcript so far. Judged in both orders.
3. **Readout per family**, as above.

Judge: claude-code Sonnet via the CLI bridge — a different family from the
author (codex gpt-5.6-terra), per the poetics author-confound lesson. Each call
is atomic, so no context leaks between items. Attended run on the Max plan.

## Log

- 2026-08-06 — proposed after the Phase-B census showed a 10% first-draft pass
  rate with no test of whether the vetoes are correct.
- 2026-08-06 — moved to active. The replay
  (`scripts/replay-guard-fallback-delivery.js`) showed 91% of template turns
  had a deliverable model draft, so this study now gates the default flip.
