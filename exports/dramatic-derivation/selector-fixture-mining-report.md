# Selector Fixture Mining Report

Date: 2026-06-16

## Purpose

Mine existing dramatic-derivation artifacts for a real V-positive or
hidden-hurts fixture before spending on another selector matrix.

No new model calls were made. The pass read completed loop/episode artifacts
under `exports/dramatic-derivation/loop/` and existing selector reports.

## Result

Primary fixture candidate: Hethel r2.

Hethel r2 is the cleanest existing hidden-hurts / visible-helps datum. It is
also already identified by the consolidation report as the only strict
V-positive candidate in the accumulated selector artifacts.

| world | label | arm | route | verdict | turns | final D | note |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Hethel | `hethel-selector-v1-baseline-r2` | baseline | none | aporia | 8 | 5 | liability branch dominates; no recovery |
| Hethel | `hethel-selector-v1-hidden-r2` | hidden | hidden | disengagement | 7 | 5 | holds physical-cause evidence too long; exits before `p_surface` |
| Hethel | `hethel-selector-v1-visible-r2` | visible | visible | grounded_anagnorisis | 20 | 0 | pushes `p_surface` at t7 and `p_brand` at t15 |
| Hethel | `hethel-selector-v1-selective-r2` | selective-v1 | visible | grounded_anagnorisis | 20 | 0 | selected visible by `mirror_dead_predicate_visible` |

Mechanism:

- The learner is pulled into a dead liability branch around Reyner: `builtUnder`
  and `liableFor` can be derived, but they do not answer `felledBy`.
- Hidden proof continuity does not expose the physical-cause distinction early
  enough. In `hethel-selector-v1-hidden-r2`, the run dies at t7 with D=5 and
  unrepaired slips on `m_record` and `p_point`; `p_surface` is never reached.
- Visible/selective-visible uses page-state pressure to push `p_surface` early
  at t7. That gives the learner the broken-bed cause distinction and keeps the
  dead liability predicate from consuming the drama.
- Selective-v1 routes visible for the right declared reason:
  `mirror_dead_predicate_visible`, with dead-predicate candidates
  `builtUnder(hethelSpan, reyner)` and `liableFor(hethelSpan, reyner)`.

This is therefore a plausible V-positive fixture: the helpful visible move is
not generic pace acceleration; it is early public clarification of a
dead-predicate branch that hidden fails to dislodge in the failed replicate.

## Existing Replay Evidence

Existing mock replay:

- Source: `exports/dramatic-derivation/loop/hethel-selector-v1-selective-r2/`
- Episode: `exports/dramatic-derivation/episodes/hethel-selector-v1-selective-r2-as-hidden-from-t4/`
- Result: `cap_reached`, 11 turns, final D=4, prefix integrity acceptable.

This does not disconfirm Hethel r2. The hidden suffix did not recover within the
short mock window after freezing the successful visible prefix. It is debugging
evidence only, not independent held-out evidence.

## Secondary Lead

Withercombe r2 superficially looks like hidden-hurts:

| world | label | arm | route | verdict | turns | final D |
| --- | --- | --- | --- | --- | ---: | ---: |
| Withercombe | `withercombe-selector-hidden-r2` | hidden | hidden | disengagement | 24 | 1 |
| Withercombe | `withercombe-selector-visible-r2` | visible | visible | grounded_anagnorisis | 19 | 0 |
| Withercombe | `withercombe-selector-selective-r2` | selective-v0 | visible | grounded_anagnorisis | 19 | 0 |

Do not use this as the primary fixture. The broader Withercombe record is
unstable and historically negative for visible selection: visible/selective
also produced aporia, disengagement, overreach, and lucky-leap artifacts in
nearby replicates. Withercombe remains useful as a visible false-positive /
decay-instability diagnostic, not as clean V-positive evidence.

## Negative / Non-Fixtures

- Ravensmark V-positive attempts: selector-v2 chose visible correctly by the
  mirror-dead-predicate diagnostic, but baseline and hidden also grounded. This
  is a route-diagnostic world, not a hidden-hurts fixture.
- Phase 5d Lantern/Marrick: promoted selector-v4 avoided final negative
  transfer and enforced local `ask_diagnostic` corrections, but selector-v4
  selected hidden in both worlds. This tests clamp safety, not adaptive H/V
  selection.
- Current v4 confidence ladder: with proofDebt active, always-H remains the
  current reliability winner. Hethel's old V-positive signal is not yet proven
  under the current promoted selector-v4/proofDebt stack.

## Recommended Next Step

Use Hethel r2 as a prefix-controlled fixture before another paid matrix.

Start with a no-cost or one-paid episode from the successful visible run, then
flip the live suffix to the current candidate policies at the point where the
visible benefit begins:

```bash
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-selector-v1-selective-r2 \
  --turn 7 \
  --window 8 \
  --pacing-guard-selective-v1 off \
  --pacing-guard-selective-v4 on \
  --proof-debt-guard on \
  --conduct-policy-enforce on \
  --label hethel-vpositive-r2-promoted-v4-from-t7 \
  --out exports/dramatic-derivation/episodes
```

If using the real stack, add:

```bash
--real
```

Interpretation rule:

- If promoted v4 preserves the visible benefit from t7 and grounds without
  fabrication/overreach/lucky leap, then run one fresh first-pass Hethel loop
  under promoted selector-v4 + proofDebt.
- If promoted v4 collapses to hidden and repeats the stall, the issue is a
  selector-route failure: current v4 has lost the old mirror-dead-predicate
  V-positive gate.
- If promoted v4 routes hidden but still grounds because proofDebt repairs the
  failure, the fixture remains useful but no longer proves visible is needed
  under the current stack.

Do not run a broad mixed-world matrix until this prefix-controlled Hethel
fixture tells us whether the current candidate policy can preserve the only
strict visible-positive signal already in hand.

## Commands Used

Inventory:

```bash
find exports/dramatic-derivation/loop -mindepth 2 -maxdepth 2 -name diagnosis.json
```

Parser:

```bash
node - <<'NODE'
// Parsed all loop diagnosis.json files, grouped by group/world/run, and
// compared hidden against visible/selective arms by verdict, turns, final D,
// selected route, proof-debt actions, and D curve.
NODE
```

Existing reports consulted:

- `exports/dramatic-derivation/selector-v1-report.md`
- `exports/dramatic-derivation/selector-consolidation-unattended-report.md`
- `exports/dramatic-derivation/selector-v4-confidence-report.md`
- `exports/dramatic-derivation/selector-vpositive-ravensmark-report.md`

