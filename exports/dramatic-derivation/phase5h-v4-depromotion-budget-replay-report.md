# Phase 5h Selector-v4 De-promotion and Hethel Replay Gate

Date: 2026-06-16

## Purpose

Phase 5g found first-pass negative transfer in Hethel: promoted selector-v4 plus
proofDebt selected the hidden route but failed by disengagement at turn 11 with
final D=4, while hidden+proofDebt grounded. Conduct enforcement was locally
compliant, so the failure was policy-level rather than generator-compliance
level: repeated `visible_hidden_conflict` diagnostics delayed releases.

This increment tested whether a small, predeclared policy adjustment could
remove that failure without paying for another full prefix:

1. De-promote selector-v4 conduct behavior so v4 no longer implies conduct
   logging or enforcement.
2. Add a strict diagnostic budget for repeated visible/hidden conflict probes.
3. Use episode replay from the Hethel failure before launching any fresh paid
   retest.

## Implementation

- `scripts/run-derivation-loop.js`
  - `--pacing-guard-selective-v4` no longer defaults
    `--conduct-policy-enforce`.
  - Conduct-policy logging/enforcement is now explicit:
    pass `--conduct-policy` or `--conduct-policy-enforce`.

- `scripts/run-derivation-episode.js`
  - Episode replay no longer treats selector-v4 as an enforcement default.
  - Old source artifacts that already had conduct enforcement still inherit it
    unless the replay overrides the flag, preserving replay intent.

- `services/dramaticDerivation/llmRoles.js`
  - Added a shallow budget for `visible_hidden_conflict -> ask_diagnostic`.
  - Suppresses an adjacent same-premise visible-conflict diagnostic.
  - Suppresses after two recent visible-conflict diagnostics in three turns.
  - Adds a public-transcript fallback for replay prefixes without conduct-policy
    metadata: adjacent tutor `test`/`confront` moves on the same premise, or two
    recent public diagnostic-like tutor moves, also suppress a new diagnostic.
  - Release candidates still outrank visible-conflict diagnostics.

The budget is deliberately not a new taxonomy. It only limits repeated
diagnostic pressure and does not reclassify Hethel after seeing the outcome.

## Verification

Focused tests:

```bash
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
```

Result: 29/29 passing.

## Replay Commands

Source failure:

```text
exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1
```

Replay shape:

```bash
DERIVATION_PROVIDER=codex \
DERIVATION_LEARNER_PROVIDER=claude \
DERIVATION_LEARNER_MODEL=sonnet \
DERIVATION_CLI_TIMEOUT_MS=900000 \
DERIVATION_LLM=real \
DERIVATION_TRACE=0 \
node scripts/run-derivation-episode.js \
  --from exports/dramatic-derivation/loop/hethel-phase5g-a20-fresh-selective-v4-r1 \
  --turn 4 \
  --window 12 \
  --real \
  --conduct-policy on \
  --conduct-policy-enforce on \
  --label <label> \
  --out exports/dramatic-derivation/episodes
```

## Replay Results

| Label | Prefix | Verdict | Turns | Final D | Releases | Conduct pattern |
|---|---:|---|---:|---:|---|---|
| `phase5h-hethel-v4-budget-replay-from-t4` | ok, 3 identical turns | disengagement | 11 | 4 | `p_point` t6; `p_surface` t11 | `ask_diagnostic` 4; `release_next_evidence` 2; `repair_dependency` 1 |
| `phase5h-hethel-v4-budget2-replay-from-t4` | ok, 3 identical turns | aporia | 10 | 4 | `p_point` t5; `p_surface` t10 | `ask_diagnostic` 1; `release_next_evidence` 2; `repair_dependency` 2 |

The stronger budget improved timing and reduced diagnostic churn, but it did not
ground the run. The local replay gate therefore failed.

## Interpretation

The negative transfer is not explained away by conduct-generator noncompliance.
The diagnostic budget helps, but Hethel still stalls with final D=4 under the
same frozen prefix. That suggests selector-v4/conduct enforcement is not merely
too chatty; it lacks a progress-sensitive release pressure strong enough to
recover after the early visible/hidden conflict.

No fresh paid Hethel paired retest was launched, because the prefix-controlled
episode replay did not pass.

## Recommendation

Keep hidden+proofDebt as the reliability baseline. Do not promote selector-v4 or
conduct enforcement as a general derivation arm.

If this line continues, the next candidate should be separately labelled and
should target progress/release pressure, not a finer visible/hidden situation
taxonomy. The current evidence supports a narrower claim: the H/V channel
distinction is real, but the selector/conduct overlay is still underpowered and
can create negative transfer.

## Caveats

- The public-transcript fallback is intentionally shallow and may suppress some
  legitimate repeated diagnostics after a tutor `test`/`confront` move.
- These are prefix-controlled Hethel replays, not a fresh paid matrix.
- Raw episode artifacts remain under
  `exports/dramatic-derivation/episodes/phase5h-*` and are not required for the
  main repository history.
