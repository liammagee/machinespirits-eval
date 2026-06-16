# Phase 6 Progress-Policy Replay Screen

Date: 2026-06-16

## Purpose

Phase 5g/5h closed selector-v4 conduct promotion as a default arm. The failure
was not generator compliance: conduct enforcement passed locally, but repeated
visible/hidden diagnostics and visible-consolidation holds delayed proof
progress in Hethel.

Phase 6 tests a narrower policy question: when diagnostic pressure is exhausted,
can the conduct layer press progress by reusing existing move families rather
than adding another selector taxonomy?

## Implementation

- New opt-in flag: `--conduct-progress-policy`.
- The flag implies conduct-policy logging but not enforcement.
- Enforcement still requires `--conduct-policy-enforce`.
- No new move family was added.
- When a repeated `visible_hidden_conflict` diagnostic is budget-exhausted:
  - if a certified safe release candidate exists, select `release_next_evidence`;
  - otherwise select `consolidate_subproof`.
- Follow-up safe-now patch: a release is current-authorized only when it is on
  its scheduled turn or force-played; tempo solvency somewhere in the early
  release window is not enough. Early optional releases are redirected to
  `consolidate_subproof`.

This keeps the policy shallow: progress pressure is a budget response, not a new
visible/hidden situation class.

## Verification

Focused tests:

```bash
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
```

Result: 31/31 passing.

After the safe-now patch:

```bash
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
```

Result: 34/34 passing.

## Replay Command

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
  --conduct-progress-policy on \
  --conduct-policy-enforce on \
  --label phase6-hethel-progress-policy-replay-from-t4 \
  --out exports/dramatic-derivation/episodes
```

## Result

| Field | Value |
|---|---|
| Source | `hethel-phase5g-a20-fresh-selective-v4-r1` |
| Episode | `phase6-hethel-progress-policy-replay-from-t4` |
| Prefix integrity | ok, no mismatches |
| Verdict | `cap_reached` |
| Window | t4--t15 |
| D curve | `5->5->5->4->4->4->4->4->3->3->3->3->2->2->1` |
| Grounded | no |
| Conduct compliance | 12/12 passed |
| Enforcement | applied 8/12 turns; post-failures 0 |

Release timing:

| Premise | Planned | Actual | Status |
|---|---:|---:|---|
| `p_point` | t4 | t4 | on cue |
| `p_surface` | t9 | t9 | on cue |
| `p_mark` | t13 | t13 | on cue |
| `p_brand` | t17 | t15 | early |
| `p_carter` | t20 | unreached | unreached |

Conduct move families:

| Family | Count |
|---|---:|
| `release_next_evidence` | 3 |
| `consolidate_subproof` | 4 |
| `repair_dependency` | 1 |
| `ask_diagnostic` | 4 |

Progress-policy reason codes:

| Reason | Count |
|---|---:|
| `progress_pressure_release` | 2 |
| `progress_pressure_consolidate` | 4 |

## Safe-Now Replay

After the early-release artifact in the first replay, the policy was tightened
so that progress pressure and conduct enforcement distinguish "safe on the
current cue" from "tempo-safe inside the early release window."

Replay command:

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
  --conduct-progress-policy on \
  --conduct-policy-enforce on \
  --label phase6-hethel-safe-now-replay-from-t4 \
  --out exports/dramatic-derivation/episodes
```

| Field | Value |
|---|---|
| Episode | `phase6-hethel-safe-now-replay-from-t4` |
| Prefix integrity | ok, no mismatches |
| Verdict | `aporia` |
| End turn | t9 |
| D curve | `5->5->5->4->4->4->4->4->4` |
| Grounded | no |
| Release deviations | none before failure |
| Conduct compliance | 6/6 passed |
| Enforcement | applied 3/6 turns; post-failures 0 |

Release timing before failure:

| Premise | Planned | Actual | Status |
|---|---:|---:|---|
| `p_point` | t4 | t4 | on cue |
| `p_surface` | t9 | t9 | on cue |
| `p_mark` | t13 | unreached | unreached |
| `p_brand` | t17 | unreached | unreached |
| `p_carter` | t20 | unreached | unreached |

Conduct move families:

| Family | Count |
|---|---:|
| `release_next_evidence` | 2 |
| `consolidate_subproof` | 1 |
| `repair_dependency` | 1 |
| `ask_diagnostic` | 2 |

## Interpretation

This is a useful partial repair. Compared with Phase 5h, the replay no longer
fails at D=4 by aporia/disengagement. It releases the two critical early tutor
premises on cue and reaches D=1 by t15.

It is not a pass. The first episode does not ground within the bounded window,
and it introduces one early release (`p_brand` at t15 instead of t17).

The safe-now follow-up removes that early-release artifact, but the controlled
replay regresses to aporia at t9. The failure is therefore not merely release
calendar looseness. The current progress-aware conduct policy has not cleared
the local Hethel gate.

## Next Gate

Do not run the paid fresh Hethel paired retest.

Do not run the non-Hethel no-harm replay from this policy state. The Hethel
replay gate failed before the no-harm screen became meaningful.

The next design question, if continued, should be pre-declared as a new variant:
either relax safe-now only when visible uptake is already strong, or shift the
policy from release timing to decay repair/proof continuity around `m_record`
and `m_yard`. Do not treat the current safe-now variant as promotable.

## Caveats

- This is prefix-controlled replay evidence, not held-out evidence.
- Selector-v4 shadowing was inherited from the source failure prefix; this does
  not revive selector-v4 as the evaluated arm.
- The result uses a live LLM suffix and should not be overfit by repeated reruns.
- The safe-now replay is also a live suffix; it is a controlled debugging
  artifact, not held-out evidence.
