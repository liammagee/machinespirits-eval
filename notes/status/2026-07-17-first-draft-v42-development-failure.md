# V42 typed-causality development result

Date: 2026-07-17

Status: failed non-held-out development diagnostic

V42 stopped after its first hard-prefix draw failed the automatic original-only
gate. The second diagnostic did not start. V42 is terminal failed development
evidence; it is not strict confirmation and does not authorize held-out work.

## Frozen boundary

- Campaign: `first-draft-diagnostic-screens-v21`
- Configuration: `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v21.yaml`
- Configuration SHA-256: `597469e3aa6d0c8bec2425a48ee5ed187515faaeb873c1bea2ef8a3acc5b7318`
- Frozen configuration commit: `30316876d45cd2d9a830ca8977fa30998789af61`
- Automatic result SHA-256: `20cb4672cdcdeb370c15667c70812fab92000328f038deff8ca32e1fdc264ecc`
- Hard-prefix replay SHA-256: `d85916447ea498696c6bcd2c31c682b665925b5865456f4529622f34174a19fe`
- Qualitative review SHA-256: `0c22afec7689fea63272770ee289c7728ebcad9a079df3e73eb67deea9dc5f8a`
- Transport: ordinary Codex CLI, `gpt-5.6-terra`, low effort
- Base-instructions override: disabled
- Direct-provider screening: not used

## What changed before V42

V41 exposed two independent weaknesses: the generated minutes entry widened
`depot chargers` to `depot`, and the PERFORMANCE span did not visibly realize
the selected engagement stance. V42 made the causal relation a typed public
tuple, preserved it through the live and frozen speaker projections, and bound
the requested entry to its exact subject, outcome, family, and polarity. It
also made charismatic advocate counterpressure an explicit PERFORMANCE
operation.

Focused tests cover live/frozen parity, exact prompt-to-audit round trips,
subject widening, outcome substitution, causal-family reversal, malformed and
ambiguous metadata, and repeated matcher calls. The deterministic preflight
passed on the clean frozen commit: 29/29 derivation worlds, 489/489 audit-
contract tests, 24/24 interactive tests, 4/4 adaptive-evidence tests, 57/57
campaign tests, and four model-free corpora with no regression or safety
failure. The integration boundary remained at the seven recorded unrelated
baseline failures, with no new failures.

## Automatic result

- Originals accepted: 0/1
- Mean configuration realization: 0.833
- Safety failures: 0
- Mechanical repairs: 0
- Model rewrites: 0
- Deterministic fallbacks: 0
- Semantic recognition corrections: 0
- Transport normalizations: 0
- Transcript-specific uptake failures: 0
- Compact-prompt failures: 0
- Exact typed causal-uptake recognition: pass
- Typed public subject/outcome/family/polarity binding: pass
- Engagement-stance realization: pass
- Action-family realization: pass

The rejected original was:

> Write: “The depot chargers did not cause the Tallow Street brownout.” My case is: depot chargers did not cause Tallow Street's brownout during stocktake. Dark chargers during stocktake support depot chargers' innocence, but establish no other cause. Next, compare the chargers being dark during the stocktake with the 18:40 chart.

Its structured owners were:

- UPTAKE: `Write: “The depot chargers did not cause the Tallow Street brownout.”`
- PERFORMANCE entry: `My case is: depot chargers did not cause Tallow Street's brownout during stocktake.`
- PERFORMANCE response: `Dark chargers during stocktake support depot chargers' innocence, but establish no other cause.`
- HANDOFF: `Next, compare the chargers being dark during the stocktake with the 18:40 chart.`

The dominant automatic clusters were:

- `actorialRealizationAudit:missing_selected_actorial_part`
- `actorialRealizationAudit:missing_selected_performance_tactic`
- `jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance`

The lower-level ownership checks found a declarative advocate entry and a
relevant next-action handoff. The stricter tactic check rejected the
PERFORMANCE response because `support depot chargers' innocence` does not name
the exact supported public proposition. This is not a reason to add
`innocence` to a regex: that wording is vague, anthropomorphic, and less
accountable than the typed conclusion. The next speaking contract should carry
the exact typed subject and outcome into the PERFORMANCE response as well as
the UPTAKE entry, and require the excluded conclusion separately.

## Independent blinded causal-fidelity review

Two isolated reviewers saw only the learner request, public evidence window,
and exact minutes entry. Both passed:

> The depot chargers did not cause the Tallow Street brownout.

Both marked actor preservation, causal-relation preservation, polarity
preservation, and non-reversal true. This does not overturn the automatic
failure. It establishes that V41's causal-subject widening and V33's
cause/prevention inversion are no longer the active blocker.

## Cost and latency

| Measure | V33 | V41 mean/draw | V42 |
|---|---:|---:|---:|
| Original latency | 13,451 ms | 10,555.5 ms | 20,410 ms |
| Observed input tokens | 16,246 | 14,243 | 14,304 |
| Cached input tokens | unavailable | 9,984 | 9,984 |
| Uncached input tokens | unavailable | 4,259 | 4,320 |
| Output tokens | 517 | 263.5 | 883 |
| Reasoning output tokens | unavailable | 169 | 790 |
| Total tokens | 16,763 | 14,506.5 | 15,187 |
| Authored prompt estimate | approximately 4,000 | 2,417 | 2,462 |
| Inferred runtime/transport residual | approximately 12,246 | 11,826 | 11,842 |

The V42 authored request is about 38.5% below the V33 baseline and remains
below the 2,500-token preference. Its observed input is 11.9% below V33, but
the single-call latency is 51.7% higher. Most of the output growth is reasoning
output. One draw cannot establish a latency trend, and the residual is inferred
by subtraction rather than directly observed.

The separate guarded `model_instructions_file` transport probe reduced input
by 28.0% in a tiny paired call, but it was deliberately disabled here. That
override changes the Codex base contract and cache profile, so it remains
development-only, non-equivalent, and ineligible for strict or held-out
acceptance.

## Seed and stopping boundary

- `20263200`: consumed by diagnostic 1 and retired.
- `20263201`: unconsumed because diagnostic 2 did not start.

V42 shows measurable movement on the prior causal-role cluster but does not
pass the original-only gate. A later development version requires a committed
speaking-contract change and fresh predeclared seeds. V42's result must not be
reclassified after that change.
