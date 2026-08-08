---
id: ironic-question-flood-target
title: Irony against question-flooding — the one cell worth a second draw
status: done
type: experiment
priority: P3
owner: unassigned
source: manual
created: 2026-08-08
updated: 2026-08-08
verification: Step 1 is a second draw of one cell already run — three rows, ironic tutor against question-flooding, same stacks and judges — reported through the existing grid reporter under the plain stance gate. It passes only if the report states the two draws' counts side by side and the fields that make them comparable are read out of the database rather than asserted. No paper claim from step 1; a claim needs step 2, and step 2 needs a size argued from step 1's spread.
claim_status: speculative
links:
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-07-45154bac
    - eval-2026-08-05-87fe3664
    - eval-2026-07-02-5c4d52e6
    - eval-2026-07-02-67be317c
  items:
    - negative-register-effect-estimation-grid
    - sarcasm-mood-floor-replication
    - sarcasm-determinate-negation-grid
---

## What was seen

In the 45-row grid (`eval-2026-08-05-87fe3664`), the ironic tutor against a
question-flooding learner was the standout cell: 3 of 3 rows held the assigned
manner, 3 of 3 came out positive, register score 90.8. The same tutor across
all five resistance targets held the manner in only 6 of 15 rows. Nothing else
in the negative-register line pairs high manner-holding with high outcomes in
one cell.

Question-flooding has also come out well twice before, under a different
mechanism. The commitment-probe router (cell 192, `eval-2026-07-02-67be317c`)
scored 2/2 on every measure against question-flooding and was promoted for
that subtype alone. The held-out two-target check
(`eval-2026-07-02-5c4d52e6`) covered frustration and question-flooding at 6/6
faithful. So either question-flooding is a genuinely tractable kind of
resistance, or the scenario that stages it is written in a way that makes
tutors look good. Those two readings have never been separated.

## Why this is not yet a finding

Three rows. Seen after the fact. One of five targets, picked because it looked
best — the same shape as the composition split that the mood-floor re-analysis
withdrew, where 0 of 6 became 4 of 7 one day later on the same configuration.

There is no second draw of this cell, so its between-draw spread is unknown,
and without that no design for it can be sized. That is the lesson the line
already paid for.

## What to do, in order

1. **Re-draw the one cell.** Three more rows: ironic tutor, question-flooding,
   same two generation seats and the same judge, scored under the plain
   stance gate on the adopting-turn fold. Cheap. If 3/3 does not come back,
   the thread ends here and the card closes, exactly as the mood floor did.
2. **Only if it holds:** design a proper comparison, sized against the spread
   the two draws show rather than against either draw alone, with the target
   held out rather than chosen from the same data, and a control that is not
   the same tutor scored a second way.

Step 2 is not authorized and should not be written until step 1 reports.

## Step 1, frozen

Plan SHA-256 `b980609c…9947`, three rows, operator-authorized 2026-08-08
("launch it as proposed"). Apparatus:
`services/ironicQuestionFloodRedraw.js` holds the plan and the decision rule,
`scripts/run-ironic-question-flood-redraw.js` launches and reports.

Generation and scoring are read off the parent grid's frozen plan rather than
restated, and the plan fails if either drifts — two draws are only comparable
if nothing between them moved, and a copied constant is one that can drift.

The rule was written before the run: **0 or 1 of 3 closes the thread, 3 of 3
clears it for a design, 2 of 3 is inconclusive.** The background it is read
against is 3 of 12 — the ironic tutor on the other four targets in the first
draw. Nothing here licenses a paper claim; a second sweep licenses writing a
design.

## Step 1 result — 0 of 3. The thread closes.

Run `eval-2026-08-07-45154bac`, 2026-08-08. Three rows generated, none failed,
all three scored under both rubrics. Report:
`exports/ironic-question-flood-redraw/eval-2026-08-07-45154bac.md`.

| draw | run | held the manner |
| --- | --- | --- |
| first | `eval-2026-08-05-87fe3664` | 3/3 |
| second | `eval-2026-08-07-45154bac` | 0/3 |

Two-sided Fisher exact between the draws p = 0.10. The two draws are matched
on the things that would otherwise explain the gap: same profile, same
configuration hash, same prompt hash, both writing seats on `codex.gpt-5.5`,
same judge, same gate and same slice. All read out of the database, not
asserted.

All three new rows missed for one reason — no marker of the assigned manner in
the tutor's turn. The tutor did not write ironically at all, where in the first
draw it did so three times out of three. The first draw's 3/3 was a draw.

Two things worth carrying forward:

- **The register judge and the text gate disagreed cleanly here.** The judge
  scored these same three turns 91, 55 and 72.5, while the gate found no
  ironic marker in any of them. The judge is scoring how well the turn reads;
  the gate is checking whether the assigned manner is present. On rows where
  the manner is simply absent, a high judge score is not evidence against the
  gate.
- **This is the second time on this line that a clean sweep did not survive
  its own second draw** — the mood floor went 0/6 to 4/7, this went 3/3 to
  0/3. At three rows the ironic tutor's manner-holding is not stable enough
  for any cell of that size to be read as a signal, however it comes out.

Step 2 is not written and will not be. The card closes.

## Why it is worth keeping open at all

Every other thread on the negative-register line closed on a lesson about the
instrument — which gate, which slice, how many rows. This is the only place
left where a run would be asking something about tutoring: whether a particular
manner meets a particular kind of resistance well. That is worth three rows to
find out, and not worth more until it survives them.
