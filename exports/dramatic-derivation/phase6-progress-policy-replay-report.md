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

This keeps the policy shallow: progress pressure is a budget response, not a new
visible/hidden situation class.

## Verification

Focused tests:

```bash
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
```

Result: 31/31 passing.

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

## Interpretation

This is a useful partial repair. Compared with Phase 5h, the replay no longer
fails at D=4 by aporia/disengagement. It releases the two critical early tutor
premises on cue and reaches D=1 by t15.

It is not a pass. The episode does not ground within the bounded window, and it
introduces one early release (`p_brand` at t15 instead of t17). The right status
is therefore: progress pressure is worth one more local design pass, but it has
not earned a fresh paid first-pass retest.

## Next Gate

Do not run the paid fresh Hethel paired retest yet.

The next local increment should address the remaining gap without expanding the
taxonomy:

- avoid early release when progress pressure selects `release_next_evidence`;
- distinguish "safe to release now" from "safe sometime in the window";
- re-run the same Hethel prefix after that fix;
- only then consider a fresh paired retest against hidden+proofDebt.

## Caveats

- This is prefix-controlled replay evidence, not held-out evidence.
- Selector-v4 shadowing was inherited from the source failure prefix; this does
  not revive selector-v4 as the evaluated arm.
- The result uses a live LLM suffix and should not be overfit by repeated reruns.
