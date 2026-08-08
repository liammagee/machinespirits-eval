---
id: sarcasm-mood-floor-replication
title: Does the mood floor reproduce? — replication check on the composition split
status: done
type: experiment
priority: P3
owner: claude
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: A repo-resident report re-scores cell 202's plain mood rows from both runs under one gate and one fold, reads the provenance fields out of the database rather than asserting a match, and reports whether the 0/6 that motivated this sub-line reproduces. Any claim lands in paper §6.7 first.
claim_status: exploratory
links:
  notes:
    - notes/2026-08-08-sarcasm-mood-floor-replication-preregistration.md
    - notes/2026-08-07-sarcasm-precondition-preregistration.md
    - notes/2026-08-06-sarcasm-determinate-negation-preregistration.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-06-4de45d05
    - eval-2026-08-07-e3dffab2
  items:
    - sarcasm-precondition-claim-bearing-mood
    - sarcasm-determinate-negation-grid
---

## Why

The predecessor card closed inconclusive and said the hypothesis "needs a fresh
design on the repaired instrument, not a re-read of these rows." Writing that
design needed two numbers neither earlier design had: how often the control
holds the manner, and how far that number moves between draws. Both were
already on disk. The stance gate computes from message text, so any scored row
can be re-asked at no cost and with no model call.

Re-reading them was not a re-read for a *verdict* — that is what the
predecessor ruled out. It was a re-read for a base rate. It changed the
question.

## What happened

`scripts/analyze-sarcasm-mood-floor-replication.js` →
`exports/sarcasm-mood-floor-replication.{json,md}`. No run, no re-judging, no
row rewritten.

**1. The precondition design measured on the wrong gate.** The pattern the
whole sub-line was built to explain is a plain `sarcastic` number. The 16-row
design registered its primary measure on `sarcastic_determinate`, which
requires the tutor to name a target claim — which is cell 202's treatment, and
is also what the same note registered separately as its manipulation check. So
measure 1 and measure 2 were reading one component, and neither was reading the
manner.

**2. The manipulation ran backwards, so the run was dead by its own rule.**
Plain-mood rows named a claim 6/7; claim-bearing rows named one 5/7. The design
assumed a mood would supply nothing to name; it supplied something in 86% of
rows. The frozen rule: manipulation check fails → the run says nothing about
the precondition, do not read measure 1.

**3. The 0/6 floor does not reproduce.** Cell 202, the two plain mood
scenarios, plain gate, adopting-turn fold:

| run | held the manner | named a claim | marker present |
|---|---|---|---|
| `eval-2026-08-06-4de45d05` | **0/6** | 2/6 | 0/6 |
| `eval-2026-08-07-e3dffab2` | **4/7** | 6/7 | 4/7 |

Two-sided Fisher p = 0.070. The report reads profile, `config_hash`,
`prompt_content_hash`, both generation seats and the judge out of the database
and compares them, failing closed on any disagreement — the match is checked,
not claimed. All six matched. The scenario commit between the runs was purely
additive and touched neither mood scenario. The gate reads text, so the judge
cannot enter the counts.

Every failure in the first run missed the register marker and nothing else;
three of seven did in the second. What swung between draws is exactly the thing
being measured.

## Outcome

**The 0/6 was one draw, not a floor.** The precondition hypothesis explains a
phenomenon that has not been shown to exist, and the 16-row design could not
have answered anything: at the measured 57% control rate its ceiling — 4/8
against a perfect 8/8 — gives p = 0.077, below its own threshold, where the
original power statement assumed a 0/8 control and cleared at p = 0.026.

Paper (v3.0.272): §6.7 gains the re-analysis paragraph and marks the 5/6 → 0/6
contrast withdrawn in place. §8.9's substantive scope condition ("a contract
binds only where its precondition holds") is withdrawn as an empirical claim
and kept as a design maxim; its measurement sibling — name your gate and your
fold — is untouched, because it compares two counts rather than resting on the
level of either. §8.9 gains a third condition: a control rate read off one draw
is not a base rate.

A stage-1 replication of the composition split is frozen in
`notes/2026-08-08-sarcasm-mood-floor-replication-preregistration.md` — 40 rows,
five targets, eight repeats split into two labelled blocks so the run measures
its own noise — and is **recorded as not recommended for launch**: it spends
forty rows on a question about the instrument, not about tutoring. Running it
anyway is a defensible operator call; if taken, the block structure is the part
that must not be dropped for cost.

The sub-line closes here.
