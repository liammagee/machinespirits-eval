# Ownership Evaluation Closeout

Date: 2026-06-16

## Source Prompt

This increment responds to `adaptive_tutor_a20_a21_analysis.md`.

The analysis accepted the A20/A21 closeout but argued that the missing object is
not another proof-control policy. The missing object is learner ownership under
fixed proof control.

## Implemented

### Object Ownership State

Added `services/dramaticDerivation/objectOwnership.js`.

The object is deterministic, public-only, and evaluation-only. It has no
authority to release, hold, repair, or assert.

It scores six public ownership probes:

- `own_words`
- `use_in_path`
- `discriminate_wrong_route`
- `near_transfer`
- `recover_after_break`
- `purpose_link`

It audits recursively for forbidden proof/private inputs including raw proof
paths, hidden boards, D arithmetic, secrets, and corruption ledgers.

### Didactic Opportunity-Cost Budget

Added an `opportunityCost` field to didactic mode state.

Every didactic mode now exposes:

- proof obligation preserved;
- maximum proof-neutral turns;
- exit condition;
- failure action.

The tutor prompt sees this budget. Diagnosis reports budget metadata and can
flag proof-neutral streaks that exceed the budget. This is deliberately not a
new proof controller.

### Ownership Evaluation CLI

Added `scripts/derivation-ownership-eval.js` and npm alias:

```bash
npm run derivation:ownership-eval -- --pair <pair-id>=<s0>,<s1>
```

The scorer is zero-paid. It reads existing result artifacts, uses released
public premise surfaces plus public learner transcript turns, and emits:

- `exports/dramatic-derivation/ownership-eval/ownership-eval-report.md`
- `exports/dramatic-derivation/ownership-eval/ownership-eval-report.json`

## Coarse Evaluation Run

Command:

```bash
node scripts/derivation-ownership-eval.js \
  --pair phase9-hethel=phase9-a21-s0-hidden-proofdebt-from-t4,phase9-a21-s1-hidden-proofdebt-a21patch-from-t4 \
  --pair didactic-hethel=didactic-hethel-candidate-s0-discursive-from-t4,didactic-hethel-candidate-s1-didactic-from-t4 \
  --pair phase5g-withercombe=withercombe-phase5g-a20-fresh-hidden-r1,withercombe-phase5g-a20-fresh-selective-v4-r1 \
  --pair phase5g-ravensmark=ravensmark-phase5g-a20-fresh-hidden-r1,ravensmark-phase5g-a20-fresh-selective-v4-r1 \
  --pair phase5g-hethel=hethel-phase5g-a20-fresh-hidden-r1,hethel-phase5g-a20-fresh-selective-v4-r1 \
  --out exports/dramatic-derivation/ownership-eval
```

Result summary:

| Pair | Reliability matched | S0 mean ownership | S1 mean ownership | Delta | Decision |
| --- | --- | ---: | ---: | ---: | --- |
| `phase9-hethel` | yes | 2.50 | 2.88 | +0.38 | no ownership gain by threshold |
| `didactic-hethel` | yes | 0.80 | 0.80 | +0.00 | no ownership gain |
| `phase5g-withercombe` | no | 2.33 | 3.00 | +0.67 | blocked by release-signature mismatch |
| `phase5g-ravensmark` | no | 1.80 | 2.40 | +0.60 | blocked by release-signature mismatch |
| `phase5g-hethel` | no | 2.38 | 2.80 | +0.42 | blocked by proof failure |

## Interpretation

The first ownership evaluator pass does not justify another paid run.

The only pairs with matched proof reliability were:

- Phase 9 Hethel A21 S0/S1: S1 had a small ownership-score lift, but below the
  coarse gain threshold, and the action was already matched by hidden+proofDebt.
- Didactic Hethel mock S0/S1: didactic mode changed explanatory regime in prior
  logs, but this ownership scorer found no learner-ownership delta.

The Withercombe and Ravensmark promoted overlays show higher ownership scores,
but they do not preserve the same release signature. They are therefore not
eligible evidence under the declared success definition.

The Hethel promoted overlay remains disqualified because it fails the proof
reliability track.

## Decision Against GPT Pro Success Terms

Success required:

```text
proof-control no harm
+
measurable ownership or transcript-quality gain
```

This increment achieved the evaluator and budget infrastructure, but the coarse
artifact pass did not find a qualifying gain.

Outcome: no success case yet. Stop before paid validation.

## What Is Now Exhausted

Applied from `adaptive_tutor_a20_a21_analysis.md`:

- learner ownership object: implemented;
- didactic opportunity-cost budget: implemented;
- zero-paid ownership probe pass: implemented;
- proof-control no-harm gate before paid validation: applied;
- A21 kept diagnostic rather than promoted: preserved.

Not applied as runtime policy:

- no new selector;
- no new conduct taxonomy;
- no default proof-control change;
- no paid didactic or A21 validation.

## Next Sensible Move

Use this ownership evaluator as a screening tool when a genuinely new transcript
quality overlay appears. For the current A20/A21/didactic evidence, the result
is null: proof-safe variants did not yet show enough learner-ownership gain to
warrant a paid mini-run.

The stronger next evaluation frame is still likely blinded pairwise transcript
rubric scoring, with this ownership evaluator as a mechanical pre-screen.
