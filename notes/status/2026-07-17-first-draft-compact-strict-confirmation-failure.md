# Compact strict working confirmation: hard cell fails on first original

Date: 2026-07-17  
Status: failed non-held-out strict working confirmation  
Campaign: `first-draft-working-screens-v12`  
Configuration SHA-256: `89d9a462e4a49e428cb3b56929cf68424160057e186b7803b8cde708b1c3c73d`

## Honest result

The separate strict confirmation predeclared after V35 failed on its first
fresh Codex CLI original. The hard Tallow cell required `4/4` originals and
mean configuration realization `1.0`. After one rejection its maximum possible
result was only `3/4`, so the campaign stopped immediately. No other cell or
draw was launched.

- Hard-cell originals accepted: `0/1` generated (`4/4` required)
- Configuration realization: `0.833`
- Safety failures: `0`
- Mechanical repairs: `0`
- Model rewrites: `0`
- Deterministic fallbacks: `0`
- Semantic recognition corrections: `0`
- Semantic adjudicator calls: `0`
- Transport normalizations: `0`
- Transcript-specific uptake failures: `0`
- Compact-prompt provenance failures: `0`
- Progression failures: `0`

The exact candidate was:

> Write: “The dark chargers during stocktake rule out the depot as the cause.”
> My case is the depot caused the brownout, but dark chargers cannot support
> it. The stocktake shows the chargers were dark, yet the street still browned
> out at 18:40. Next, compare the chargers being dark during the stocktake with
> the 18:40 pen chart.

It failed three related strict clusters:

- `actorialRealizationAudit:missing_selected_actorial_part`;
- `actorialRealizationAudit:missing_selected_performance_tactic`;
- `jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance`.

The selected configuration required the PERFORMANCE owner to enact an advocate
and an evidentiary boundary. The draft begins with “My case,” but then uses the
vague limit “cannot support it”; its following sentence reports the
counterexample without itself stating what that evidence does and does not
establish. Under the unchanged strict contract, that is not a sufficiently
explicit enacted boundary.

## Model-free re-audit

The saved candidate was re-audited with the committed implementation and no
model call. It reproduced the same three clusters exactly. Both the response-
configuration audit and joint-performance audit evaluate the same PERFORMANCE
owner and both mark the selected performance false. The owner text hash is:

`c2a0eb7c7ac98ee276f38e92e5edafdccea8ae1f5cde20ce974ebcd80153178d`

This is not V33's contradictory-audit problem. The result is coherent across
the canonical evaluator. The wording is close enough to the boundary that
future work should treat it as a recognition-calibration question as well as a
generation-quality question; it must not be reclassified inside this frozen
campaign. No audit or prompt change was made after the result.

## Cost and latency

| Measure | V33 diagnostic 1 | Strict hard draw | Change |
|---|---:|---:|---:|
| Authored prompt estimate | 4,930 | 2,353 | -2,577 (-52.3%) |
| Observed provider input | 16,246 | 16,219 | -27 (-0.2%) |
| Cached input | unavailable | 13,056 | now measured |
| Uncached input | unavailable | 3,163 | now measured |
| Output tokens | 517 | 95 | -422 (-81.6%) |
| Inferred runtime/transport residual | 11,316 | 13,866 | +2,550 (+22.5%) |
| Original latency | 13,451 ms | 6,371 ms | -7,080 ms (-52.6%) |

Usage was fully available: `16,219` input, `13,056` cached input, `3,163`
uncached input, `95` output, `0` reasoning output, and `16,314` total tokens.
The authored request remains materially smaller, but provider-observed input is
almost unchanged from V33 because the inferred Codex CLI runtime/transport
residual is larger. The single-draw latency improvement is real for this call,
not enough evidence for a general latency claim.

No direct-provider screen was used. This was the model-specific Codex CLI path.

## Preflight revisions

Iteration 1 made zero model calls. It passed world quality, 454 audit-contract
tests, and 24 interactive-mode tests, but the orchestration process ended before
finishing and before writing a campaign result. Its stdout/stderr artifacts are
preserved as an incomplete preflight revision; it is not a tutor-generation
result and consumed no seed.

Iteration 2 reused the content-addressed preflight certificate for the unchanged
implementation/configuration boundary, then ran the hard cell. This avoided
repeating the completed deterministic work and did not weaken any gate.

The full integration suite at the frozen boundary remained at the recorded
eight unrelated baseline failures with no new compact/audit regression.
Derivation quality passed for all 29 worlds.

## Seed and artifact disposition

- `20262600`: consumed by the failed hard-cell original.
- `20262601`: unconsumed; Ravensmark did not start.
- `20262602`: unconsumed; Skyway did not start.
- `20262603`: unconsumed; Foxtrot did not start.

The unstarted seeds remain recorded as unconsumed. They are not silently
treated as calls or failures.

Artifacts:

- validation: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v12/campaign-validation.json`
- incomplete zero-call preflight: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v12/iteration-1/`
- strict hard draw: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v12/iteration-2/tallow_answer_seeking/turn-5.json`
- strict result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v12/iteration-2/working-screen-result.json`

## Claim boundary and next step

The compact development gate passed, but strict working confirmation did not.
There is therefore no held-out or broad-campaign authorization from this
result. The useful next step is model-free calibration around short, natural
boundary constructions such as “cannot support that case,” followed by one
newly predeclared hard-prefix development draw only if the calibration shows a
genuine prompt/generation change is needed. Delivery and safety gates should
remain unchanged.
