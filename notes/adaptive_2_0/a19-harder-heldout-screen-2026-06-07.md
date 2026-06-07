# A19 Harder Held-Out Screen

Date: 2026-06-07.
Status: two n=1 local `policy_headroom` candidates in one family, followed by a
two-seed stability smoke that failed to reproduce either candidate. A later
logarithm sibling collapsed to `ceiling` after transfer-control adjudication was
calibrated. No stability-confirmed A19 transfer claim is licensed.

## Boundary

This note records simulated teacher-as-learner screens only. It does not claim
human learning, deployed adaptive tutoring, model-weight learning, a main-harness
effect, paid panel evidence, or a general A19 transfer effect.

## Protocol Change

The v3 materializer now supports sibling-specific held-out learner resistance.
That prevents held-out cards from silently inheriting the training-seed learner
line, which made earlier concrete-domain cards too easy for S0 to self-solve.
The validator also checks selected-policy marker leakage in held-out learner
resistance, not only in held-out setup text.

The free-text blind adjudicator now defines `transfer_control` explicitly as a
fresh or concrete public application gate, distinct from merely naming a
warrant. It also has a deterministic transcript-backed calibration that fires
only when the target repair type is already `transfer_control` and the public
dialogue shows a tutor prompt to try/apply/check a concrete case followed by a
learner application. This makes false headroom less likely when S0 already uses
a fresh-case action gate.

## Candidates Screened

### `fraction_common_unit_counterexample_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-replay/`.
- Initial S0 adjudication:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-headroom.free-text.json`.
- Calibrated S0 adjudication:
  `exports/a19/real-s0s1-harder/fraction-common-unit-counterexample/fraction-common-unit-counterexample-c/s0-headroom.free-text-calibrated.json`.

Result: stop before S1. The first mapper read was a false headroom candidate:
S0 named the old shortcut as the failed move and already converted the fractions
to a common unit. After alias and failed-shortcut calibration, S0 classified as
`target`. Verdict: ceiling/self-solve, not transfer evidence.

### `temperature_unit_conversion_aggregation_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/s0-replay/`.
- S0 adjudication:
  `exports/a19/real-s0s1-harder/temperature-unit-conversion-aggregation/temperature-unit-conversion-aggregation-c/s0-headroom.free-text.json`.

Result: stop before S1. S0 converted readings onto one thermometer scale before
averaging and was adjudicated `target`. Verdict: ceiling/self-solve, not
transfer evidence.

### `surface_agreement_uptake_c`

- Held-out base:
  `exports/a19/materialized-attempts-v3/surface-agreement-uptake/surface-agreement-uptake-c/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s0-headroom.free-text.json`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/s1-axiom-replay/`.
- Paired free-text adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-c/blind-adjudication.free-text-axiom.json`.

Result: local `policy_headroom`. S0 was adjudicated `neither`: it supplied a
domain warrant about simplifying inside terms, but did not commit to the
registered public transfer-control move. S1, with exactly one admitted
surface-agreement axiom and no replay bundle, was adjudicated `target`: it used a
public check/value test and a fresh expansion procedure to force the learner's
old rule against a discriminating case.

### `surface_agreement_uptake_d`

- Held-out base:
  `exports/a19/materialized-attempts-v4/surface-agreement-uptake/surface-agreement-uptake-d/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-d/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-d/s0-headroom.free-text.json`.

Result: stop before S1. S0 was adjudicated `target`: without policy memory, it
already refused agreement as transfer, used a public value check on `(a + b) / a`,
and named the cancellation boundary. Verdict: ceiling/self-solve, not transfer
evidence. This is a useful calibration negative because it shows that the
surface-agreement family is not automatically counted positive.

### `surface_agreement_uptake_e`

- Held-out base:
  `exports/a19/materialized-attempts-v5/surface-agreement-uptake/surface-agreement-uptake-e/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s0-replay/`.
- S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s0-headroom.free-text.json`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/s1-axiom-replay/`.
- Paired free-text adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-e/blind-adjudication.free-text-axiom.json`.

Result: local `policy_headroom`. S0 was adjudicated `neither`: it supplied the
correct square-of-a-sum warrant through a split-square model, but did not commit
to the registered public transfer-control move. S1, with exactly one admitted
surface-agreement axiom and no replay bundle, was adjudicated `target`: it forced
the learner's "square passes through plus" rule against a two-route numerical
check and then required re-application to a fresh expression.

### `surface_agreement_uptake_f`

- Held-out base:
  `exports/a19/materialized-attempts-v6/surface-agreement-uptake/surface-agreement-uptake-f/heldout-base.full.md`.
- S0 replay:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-f/s0-replay/`.
- Initial S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-f/s0-headroom.free-text.json`.
- Calibrated S0 headroom adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-f/s0-headroom.free-text-v2.json`.
- S1 replay with exactly one admitted axiom:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-f/s1-axiom-replay/`.
- Calibrated paired free-text adjudication:
  `exports/a19/real-s0s1-harder/surface-agreement-uptake/surface-agreement-uptake-f/blind-adjudication.free-text-axiom-v2.json`.

Result: stop before stability. Before calibration, S0 looked like observable
headroom because the extractor compressed the move as `name_warrant`. After the
transfer-control prompt definition and transcript-backed action-gate audit, S0
was adjudicated `target`: it required `log(6 * 5)` and `log(6 + 5)` as fresh
inside-first/recombine checks. S1 also reached `target` on `log(5 + 3)`.
Verdict: `ceiling`, not transfer evidence. The useful lesson is that logarithm
variants with obvious numerical recombination checks are still too easy for S0.

## Consequence

This produced two n=1 local A19 headroom candidates, both in
`surface_agreement_uptake` (`surface_agreement_uptake_c`,
`surface_agreement_uptake_e`). A third surface-agreement candidate
(`surface_agreement_uptake_f`) did not survive the S0-first gate after
transfer-control calibration. The two n=1 candidates were enough to update Paper
2.0 and the atlas with a narrow, scope-bound local pilot candidate result, but
not enough for a pooled A19 rate, a sidecar empirical claim independent of Paper
2.0, or any human-learning, deployed-tutor, model-weight-learning, main-harness,
or paid-panel claim.

## Stability Smoke

Harness:
`scripts/run-a19-stability-screen.js`.

Artifact:
`exports/a19/stability/surface-agreement-uptake/a19-stability-summary.json`.

Command:

```bash
npm run a19:stability -- \
  --family-id surface_agreement_uptake \
  --sibling-id surface_agreement_uptake_c \
  --sibling-id surface_agreement_uptake_e \
  --materialized-root exports/a19/materialized-attempts-v5 \
  --axiom exports/a19/axioms/surface-agreement-uptake/axiom.json \
  --k 2 \
  --critics 1 \
  --generator codex \
  --checker claude
```

Result:

- `surface_agreement_uptake_c`: `0/2` stability headroom. S0 remained
  non-target (`neither`) on both seeds, but S1 also remained `neither` on both
  seeds. Interpretation: `no_stable_headroom`.
- `surface_agreement_uptake_e`: `0/2` stability headroom. S0 self-solved to
  `target` on both seeds, so the card collapses to ceiling/self-solve even though
  S1 reached `target` on one seed. Interpretation:
  `stable_s0_self_solve_or_ceiling`.

Consequence: the v3.0.131 wording is too strong if read as a stability-confirmed
pilot result. Paper 2.0 v3.0.132 and the atlas now contract A19 back to a
reproducible framework plus n=1 candidate positives plus falsifying stability
evidence. Stronger sidecar claims, paid panels, and human double-coding should
wait for a new candidate that first survives this stability gate.

The useful next unit is another surface-agreement or uptake-gate sibling, not
more obvious concrete arithmetic/measurement cards, because the concrete-domain
cards continue to collapse into S0 self-solve. Before stronger sidecar claims,
new candidates need stability reruns, multi-critic or paid-panel adjudication,
and eventually human expert double-coding for high-value claims.
