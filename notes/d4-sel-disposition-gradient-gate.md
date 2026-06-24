# D4 SEL Disposition-Gradient Completion

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: completed; scope-bound result folded into Paper 2.0 §3.4 and §6.6.8.

## Completed Run

The deferred architecture-matched SEL replication has now been run.

| Field | Value |
|---|---|
| Run ID | `eval-2026-06-24-250c6251` |
| Profiles | cells 40-45 |
| Scenarios | all eight `content-test-sel/scenarios-sel.yaml` scenarios |
| Runs | 3 per profile/scenario |
| Rows | 144 generated; 144 successful; 144 first-turn scored |
| Generator | Haiku 4.5 family as stored on run rows |
| Judge | `claude-code/sonnet` |
| Primary metric | `tutor_first_turn_score` |
| Report | `exports/d4-sel-disposition-gradient-eval-2026-06-24-250c6251.md` |
| Analyzer | `scripts/analyze-d4-disposition-gradient.js` |

The standard evaluator supplied the initial Sonnet scores. The remaining
first-turn rows were filled with `scripts/score-d4-first-turns.js`, which reuses
the project v2.2 first-turn prompt builder and writes through
`evaluationStore`, after the built-in multi-turn scorer hit log-path and batched
prompt limits.

## Gate Result

Pre-run gate:

- Pass: all three recognition deltas positive and effect-size ordering is
  suspicious > adversary > advocate.
- Scope-bound: deltas positive but non-monotonic.
- Fail: one or more non-positive deltas, or ordering reverses.

Observed result:

| Disposition | Mean base | Mean recog | Delta | Cohen d |
|---|---:|---:|---:|---:|
| suspicious | 56.8 | 73.9 | +17.1 | 1.03 |
| adversary | 60.7 | 68.0 | +7.3 | 0.52 |
| advocate | 54.5 | 69.8 | +15.4 | 0.92 |

Verdict: **scope-bound**. Recognition improves all three disposition families on
SEL, but the predicted monotone ordering does not hold because advocate exceeds
adversary.

## Paper Consequence

D4 no longer says "the clean replication is deferred." It now adds direct SEL
evidence:

- Broad recognition benefit across disposition families survives in SEL.
- The stronger suspicious > adversary > advocate ordering is not domain-general.
- Paper 2.0 should read the original philosophy gradient as a
  philosophy-domain/dialectical-ego ordering, not a universal recognition
  mechanism law.

Paper updates made:

- §3.4 Prediction 3 scope sentence updated.
- §6.6.8 updated with the architecture-matched SEL row and scope-bound
  interpretation.
- Revision history entry `v3.0.170` added.

## Stop Condition

D4 is complete when the DB audit is 144/144 scored, the analyzer report exists,
the paper points to the result, and the workplan card is closed as
`scope-bound`. That condition is met by this note plus the linked report.
