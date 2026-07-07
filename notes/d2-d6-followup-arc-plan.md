# D2-D6 Follow-up Arc Plan

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: planning note for a new follow-up arc; not a Paper 2.0 claim update.

## Why this arc exists

D2-D6 are not current Paper 2.0 blockers. The existing workplan cards closed
them as deferred/future scope. Reopening them as one arc asks a different
question: what should the next evidence program do after Paper 2.0's main
claims are stable?

Collectively, D2-D6 add an external-validity and measurement-validity layer to
the paper. Paper 2.0 establishes that recognition-oriented tutoring improves
LLM-judged tutor quality under the current harness and carefully scoped
applications. D2-D6 ask whether that result survives stronger tests:

- transfer beyond the tutor role and into different application roles (D2),
- interventions that make reflection change action rather than merely describe
  it (D3),
- domain and architecture matched replications of disposition effects (D4),
- a more honest prospective scoring regime after the v2.2 PCA result (D5), and
- a broader, explicit taxonomy of pedagogical orientation families (D6).

If successful, the arc would not merely add more runs. It would turn Paper 2.0's
bounded mechanism story into a forward research program: what transfers, what
does not transfer, which constructs are being measured, and which pedagogical
families are genuinely distinct rather than prompt-label variants.

## Recommended order

### 1. D5: measurement gate first

Start with D5 because it determines what future evidence should mean. The
current note already says v3.0 must not be retroactively applied to Paper 2.0.
The useful first slice is therefore prospective and no-cost:

- decide whether the next epoch needs a two-factor rubric
  (`overall_pedagogical_quality` plus `content_accuracy`) or a divergence-suite
  test before consolidation;
- define a minimum calibration pilot that uses existing rows only for
  calibration, not Paper 2.0 claim replacement;
- write acceptance gates that prevent cross-version contamination.

Stop condition: a crisp prospective v3.0 plan, or an explicit decision that
v2.2 remains the scoring regime for D2-D4/D6.

### 2. D6: orientation-family map second

D6 should follow D5 because it defines the construct space future scoring has to
respect. Before new runs, tighten the taxonomy into a usable design matrix:

- which orientation families are already represented;
- which families are missing or under-authored;
- which comparisons are theoretically orthogonal versus same-family density
  controls;
- what metadata the UI and run configs need to prevent label drift.

Stop condition: a bounded orientation-family matrix with a short list of
legitimate new prompt families, or a decision that the existing taxonomy is
sufficient for the next empirical slice.

### 3. D2: true cross-application design third

D2 is the largest external-validity move, but it needs D5/D6 boundaries first.
The next slice should recover or recreate the missing Path 2 design note and
turn it into a pre-registered design, not start paid runs:

- choose core applications and exclude anything requiring IRB/clinical claims;
- define role-reframed prompts and content-package requirements;
- decide whether scoring stays tutor-quality-like, role-neutral, or uses a new
  application-specific rubric;
- define the promotion gate before any paid generation.

Stop condition: a runnable design with kill gates, or a conservative decision
that D2 remains separate-paper scope.

### 4. D4: architecture-matched SEL replication fourth

D4 is narrower than D2 and can become a clean replication once the scoring and
orientation boundaries are clear. The existing SEL report did not reproduce the
gradient and has judge/cell confounds. The next slice should be a no-cost audit
first:

- identify whether matched-judge reanalysis is possible from existing rows;
- decide whether cells 40-45 x SEL can be run without inventing new constructs;
- pre-register whether the target is gradient replication, scope-bound null, or
  architecture-specific moderation.

Stop condition: either a cheap reanalysis plan, a small paid replication gate,
or a decision that the existing non-replication is already sufficient as a
scope boundary.

### 5. D3: heavy bridge last

D3 should be last because it is the most expensive and most likely to Goodhart
if run before the metric and construct story is stable. Bridges 0-2 were null;
Bridge 3 was suggestive but not bridgeable at K=3. The next slice should avoid
paid sweeps until the selector and outcome metric are frozen:

- decide whether K-scaling tests a real mechanism or only search over the
  scoring metric;
- specify a held-out acceptance gate independent of the selection criterion;
- prefer a small mock/fixture harness before any K=5/K=10 paid sweep.

Stop condition: a no-paid bridge design with an independent acceptance gate, or
an explicit stop that D3 remains too expensive for current expected information.

## Working rule for this branch

Do not generate new paid data in this branch until the relevant D item has a
frozen acceptance gate. Prefer note recovery, design reconstruction, no-cost DB
audits, script validation, and workplan updates. If a slice needs paid
generation or judging, promote it to a separate item with an explicit budget and
kill gate.
