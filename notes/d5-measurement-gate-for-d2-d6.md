# D5 Measurement Gate for the D2-D6 Arc

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: first D2-D6 slice; resolves the scoring gate for the arc unless reopened.

## Decision

For the D2-D6 follow-up arc, keep v2.2 as the default scoring epoch for any
claim that is meant to remain comparable with Paper 2.0. Do not implement or
apply a v3.0 rubric inside this branch unless a separate workplan item is opened
with its own calibration and contamination guard.

This means D5 is not a blocker for D2, D4, or D6. The current paper already
states the PCA caveat: the v2.2 tutor dimensions behave mostly like one
pedagogical-quality factor plus separable `content_accuracy`. That caveat should
shape interpretation, but it does not require a new rubric before the next
no-cost design work.

## Operating rules

1. Paper 2.0 comparable work uses v2.2.
   - Use the existing rubric-version columns.
   - Filter by `judge_model` when querying.
   - Do not mix v2.2 and prospective v3.0 scores inside one effect estimate.

2. v3.0 is future methods infrastructure.
   - A v3.0 item must start with synthetic calibration and same-response
     comparison against v2.2.
   - Existing rows may be used for calibration only, not to replace Paper 2.0
     claims.
   - The likely v3.0 shape remains two fields:
     `overall_pedagogical_quality` and `content_accuracy`.

3. A divergence suite is optional and only answers one question.
   - Run it only if the goal is to defend or reject the eight v2.2 pedagogical
     subdimensions as independently meaningful.
   - It is not required for D2-D6 design work because the D2-D6 arc can treat
     v2.2 as a transparent, over-specified quality instrument.

4. D2 may need a role-specific rubric decision.
   - If D2 stays tutor-like, use v2.2.
   - If D2 reframes the task into non-tutor roles, do not force tutor v2.2 onto
     the new role by default. First decide whether the right instrument is a
     role-neutral quality rubric, an application-specific rubric, or a methods
     sidecar.

5. D4 should remain v2.2 unless the replication target changes.
   - The useful next D4 question is whether the disposition gradient replicates
     under matched judge/model/architecture conditions.
   - Introducing v3.0 would make that replication harder to interpret.

6. D6 is taxonomy-first, not scoring-first.
   - D6 should decide which orientation families are real comparison units.
   - It does not need v3.0 unless a future run asks for a new scoring regime
     across orientation families.

## Stop condition for D5

D5 is resolved for this arc when the branch records the following rule:

> Use v2.2 for Paper 2.0-comparable follow-ups; treat v3.0 as a separately
> gated Paper 3.0 or methods-paper measurement project.

That condition is met by this note. The next item in the D2-D6 order is D6:
turn the current orientation-family taxonomy into a design matrix that D2 and
D4 can use without label drift.
