# Adaptive-state observability reliability protocol v2.2

**Date frozen:** 2026-07-12

**Status:** prospectively specified before any v2.2 model call

**Parent evidence:** sealed v2.1 fourth preflight at 23/24

**Claim status:** technical and claim-ineligible

## Decision

Replace the brittle single-draw 24/24 *future* gate with a versioned repeated-
draw reliability gate. Do not reinterpret the stopped v2.1 result: it remains a
failure under its frozen rule. The v2.2 run uses only fresh calls and retains
every draw.

## Critical path

Keep the same three worlds, four intended public event families, two language-
model realizers, public inputs, realizer contract, public-turn analyzer, and
strict evidence-span/leakage checks. Repeat each of the 24 base cells exactly
three times:

```text
24 base cells × 3 fixed draws = 72 learner turns
72 realizer calls + 72 analyzer calls = 144 serial CLI dispatches
```

Three draws are deliberately modest. They distinguish an isolated stochastic
wording miss from a cell that fails repeatedly, while staying below the
339-dispatch full S1 technical pilot. This is an engineering reliability screen,
not a precision estimate or population-level confidence claim.

## Frozen pass rule

All of these must pass:

1. 72/72 cases and 144/144 dispatches complete successfully.
2. At least 70/72 intended event families are recovered exactly.
3. Every complete draw block passes at least 23/24.
4. Every base world × family × realizer cell passes at least 2/3.
5. Every world passes at least 23/24.
6. Every event family passes at least 17/18.
7. Each language realizer passes at least 35/36.
8. Every evidence span is a non-empty exact learner-text substring.
9. No learner text contains a harness event identifier and no analyzer input
   contains a hidden structural target.
10. There are no retries, semantic rerolls, repairs, fallbacks, exclusions, or
    reused rows.

The count gates mean that no more than two misses can pass, and two misses must
be distributed across different draw blocks, base cells, worlds, families, and
realizers. A repeated failure in the same condition therefore stops the gate.

## Execution and lineage

- Run three complete balanced blocks in the fixed order `draw_01`, `draw_02`,
  `draw_03`.
- Use one fresh realizer call and one fresh analyzer call per case.
- Continue after semantic mismatches so the frozen denominator remains 72.
- Stop immediately on a technical failure; never resume the same label and
  never reuse a completed prefix.
- Bind the run to the sealed replacement S0, the sealed fourth stopped v2.1
  preflight, current S1-relevant source/config hashes, CLI fingerprints, clean
  Git SHA, immutable plan, event ledger, and seal inventory.
- A passing paid report may authorize only a separately invoked full S1. The
  reliability runner must never launch S1 automatically.

## Interpretation

A pass says only that the combined language-realizer → public-analyzer channel
was sufficiently reliable under these fixed synthetic cases to permit the full
S1 technical pilot. It does not validate the DAG/field/trajectory sensor.

A stop says the observation channel is not reliable enough for S1 under this
protocol. It does not invalidate the sensor, but it blocks using the channel to
judge the sensor. After a stop, do not tune and rerun the same gate. Reconsider
the role of free-form realization in the instrument.

No v2.2 result licenses policy optimization, Phase 6B, efficacy, human-learning,
or deployment claims. Only a later S2 can issue a learner-state validity verdict.
