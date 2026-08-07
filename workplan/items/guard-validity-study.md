---
id: guard-validity-study
title: Test whether the guards' vetoes pick the better turn
status: review
type: research
priority: P1
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-07
verification: >-
  For a sample of vetoed drafts, a blind pairwise comparison between the vetoed
  draft and what actually shipped, scored by a judge that never sees which is
  which or why either was chosen. Reported per guard family: how often the
  vetoed draft was preferred. A family preferred above chance is a family whose
  veto is costing more than it saves.
claim_status: scope-bound
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
- 2026-08-06 — main pass interim, 33 of ~150 pairs: overall draft 4.15 vs
  template 2.73, template outright wins 0 of 33; uptake 4.76 vs 2.97; fit 4.58
  vs 2.58; advance closest at 4.03 vs 2.82 with 2 template wins. One judge,
  a third of the sample — recorded here so the shape is on the card, decided
  on the full sample only. Downstream regime documented in
  `docs/tutor-stub-guard-catalog.md` and gated behind this card's full
  readout: `guard-policy-default-flip`, `guard-findings-feed-forward`,
  `tutor-stub-template-rate-audit`, `phase-b-rerun-under-flipped-policy`.
- 2026-08-07 — **final readout, 108 complete pairs** (judge stopped there;
  239 single-text scores). Overall draft 4.17 vs template 2.51 — draft wins 91,
  ties 15, template wins 2. Uptake 4.67 vs 2.75 (87/19/2); advance 4.12 vs 2.63
  (73/31/4); fit 4.57 vs 2.44 (97/10/1). By family: live turn progression 4.40
  vs 2.73 (n=30), mixed 4.08 vs 2.00 (n=26), repetition 3.53 vs 2.37 (n=19),
  actorial realization 4.22 vs 2.06 (n=18), dramatic release 4.75 vs 4.25
  (n=8), response composition 4.25 vs 2.50 (n=4), source alignment 4.67 vs 3.67
  (n=3). No family favours the template; dramatic release is the closest and
  still favours the draft. Verdict: every quality family's veto costs more than
  it saves on this stack. `guard-policy-default-flip` released and done the same
  day. Scope limits from the card stand — one author model, one judge family,
  one run's traces, and the sharper draft-against-passing-draft comparison
  never ran.
- 2026-08-08 — **the repair pass judged, 33 turns.** The readouts above scored
  whatever the guard catalog of the day would have shipped, which on most of
  those turns was the model's first draft. Demoting the anchoring check to
  record-only moves 33 turns from "template shipped" to "the model's own reply
  shipped", 32 of them the plain repair. Scoring those replies against the very
  templates they displace (`guard-validity-study.js recheck`, same judge, same
  single-text questions, templates reused because their text is unchanged):
  the repair beats the template on every question — uptake 3.82 vs 2.76, fit
  3.70 vs 2.55, overall 3.61 vs 2.82, advance 3.76 vs 3.42 — and loses outright
  on at most 3 of 33 anywhere. The point is what it does to faithfulness, the
  one thing the template was protecting. On these same 33 turns the original
  draft never touched the world's passage on 19 of them and scores 1.06; the
  template scores 4.70; the repair scores 4.82 and touches the passage on all
  33. So the veto was right about the first draft and wrong to survive the
  repair: the repair recovers the template's faithfulness without paying its
  cost in uptake and fit. Recorded in `services/tutorStubGuardDisposition.js`
  catalog version 7. Same scope limits — one author model, one judge, one run.
- 2026-08-06 — blinding probe run (`scripts/guard-validity-study.js probe`,
  Sonnet judge, 20 items). Side by side, the judge named the template on 13 of
  14 parsed items, citing the real fingerprints (the fixed sentences, the
  quote-back wrapper, the orphaned notebook line). Shown one text alone it
  could not classify at all — 13 of 13 single texts called "stock", drafts
  included. Decision per the plan: the main pass scores each candidate alone
  on anchored 1–5 questions; visible pairs are out. Six items lost to a burst
  of CLI failures; the main pass needs requeue-and-resume, not just retries.
