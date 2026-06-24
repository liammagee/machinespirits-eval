# D4 SEL Disposition-Gradient Gate

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: fourth D2-D6 slice; no-paid inventory plus replication gate.

## Source status

The D4 workplan card links `exports/d4-disposition-gradient.md`, but that file
is not present in this checkout. The surviving sources are:

- `TODO.md` D4,
- Paper 2.0 section 6.6.8,
- `workplan/items/d4-disposition-gradient-architecture-matched-sel-replication.md`,
- `content-test-sel/scenarios-sel.yaml`, and
- the production evaluation DB at `/Users/lmagee/.machinespirits-data/evaluations.db`.

This note records the actionable gate rather than reconstructing a full report.

## Current evidence

D4 is already resolved for Paper 2.0 as an architecture-scope limit:

| Configuration | Domain | Reading |
|---|---|---|
| Cells 40-45, dialectical ego | Philosophy | Monotone suspicious > adversary > advocate; this is the paper-cited positive. |
| Cells 22-27, standard ego | Philosophy | Reversed gradient; advocate benefits most. |
| Cells 22-27, standard ego | SEL | Non-monotonic gradient on `eval-2026-04-17-4a9b765a`. |

That is enough for the current paper's bounded claim: the disposition gradient is
not a universal property of recognition. It is tied to the dialectical-ego
architecture unless further evidence broadens it.

## No-cost DB inventory

The clean deferred test is cells 40-45 on the SEL scenario set. The exact SEL
scenario IDs in `content-test-sel/scenarios-sel.yaml` are:

- `new_sel_student_first_visit`
- `returning_sel_student_mid_course`
- `struggling_sel_student`
- `feelings_confusion`
- `interpersonal_conflict`
- `sel_frustration_to_breakthrough`
- `sel_misconception_correction`
- `sel_productive_deadlock`

Production DB check on 2026-06-24 found zero rows for cells 40-45 on those eight
SEL scenario IDs. Therefore the clean architecture-matched SEL replication
cannot be done as a reanalysis. It requires new generation and judging.

The existing SEL disposition run is `eval-2026-04-17-4a9b765a`, but it covers
cells 22-27 only:

| Profile family | Rows | Scored |
|---|---:|---:|
| cells 22-23 suspicious | 48 | 48 |
| cells 24-25 adversary | 48 | 45 |
| cells 26-27 advocate | 48 | 48 |

Those rows support the standard-ego SEL non-monotonic finding. They do not answer
the dialectical-ego SEL replication question.

## Replication gate

Only run D4 if the disposition-gradient claim becomes central in a future paper
or section. If run, the clean design is:

| Axis | Setting |
|---|---|
| Profiles | cells 40-45 |
| Scenarios | all eight `content-test-sel/scenarios-sel.yaml` scenarios |
| Runs | 3 per profile/scenario, matching the standard-ego SEL run's density |
| Planned rows | 6 profiles x 8 scenarios x 3 runs = 144 rows |
| Scoring | v2.2 tutor scoring per D5, because this remains tutor-like SEL content |
| Primary contrast | recognition minus base within each disposition pair |
| Primary ordering | suspicious > adversary > advocate by effect size |

Recommended generation/judge choice:

- If the goal is a domain/architecture comparison against the existing standard
  SEL run, use the same Haiku generation and Sonnet judge setup as
  `eval-2026-04-17-4a9b765a`.
- If the goal is a direct extension of the philosophy cells 40-45 result, run an
  Opus cross-judge or second-judge pass as a sensitivity channel, not as a
  post-hoc replacement for the primary endpoint.

## Interpretation rules

Freeze these before any paid run:

- Pass: all three recognition deltas are positive and the effect-size ordering is
  suspicious > adversary > advocate.
- Scope-bound: deltas are positive but non-monotonic. The gradient exists only in
  some domains/judge settings.
- Fail: the ordering reverses or one or more recognition deltas are non-positive.
  The philosophy gradient remains architecture-and-domain bounded.

Do not add new metrics after seeing the run. If per-dimension v2.2 patterns are
reported, treat them as descriptive because D5 already shows v2.2 dimensions are
mostly one quality factor plus content accuracy.

## Stop condition for D4

D4 is resolved for this branch when it records:

- the linked export is absent in this checkout,
- cells 40-45 x exact SEL scenarios have zero production DB rows,
- the existing SEL run covers cells 22-27 only,
- no free reanalysis can answer the deferred test, and
- a paid replication gate exists if the claim becomes central.

That condition is met by this note. The next item in the D2-D6 order is D3:
decide whether heavy bridge follow-ups have an independent acceptance gate strong
enough to justify the cost.
