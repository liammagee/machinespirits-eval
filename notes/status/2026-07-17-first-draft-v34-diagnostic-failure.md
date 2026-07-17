# V34 compact diagnostic: faster and causally faithful, but automatic progression failed

Date: 2026-07-17  
Status: failed non-held-out staged development diagnostic  
Campaign: `first-draft-diagnostic-screens-v14`  
Configuration SHA-256: `10762be00a1dcbb145f3876e88bc947fbd2f9543cf977d7420a84831f962d5a6`

## Honest result

V34 diagnostic 1 generated exactly one original candidate through the Codex CLI
and failed its unchanged automatic gate. Diagnostic 2 was not started. This is
development evidence only: it is not strict confirmation, held-out acceptance,
or a successful version.

- Original candidates accepted: `0/1`
- Configuration realization: `1.0`
- Safety failures: `0`
- Mechanical repairs: `0`
- Model rewrites: `0`
- Deterministic fallbacks: `0`
- Semantic adjudicator calls: `0`
- Transport normalizations: `0`
- Compact-prompt provenance: passed
- Joint output and owner-scoped realization: passed
- Failing cluster: `turnProgressionAudit:handoff_loses_turn_focus:handoff`

The exact candidate was:

> Write: “The chargers stayed dark during stocktake, yet the street browned
> out at 18:40.” My case is the depot caused the brownout, but stocktake cannot
> support that claim. The stocktake supports ruling out the chargers, but does
> not establish another cause. Next, compare the stocktake note with Exhibit
> One’s 18:40 pen chart.

The final operation is concrete and public, but its handoff names only the
stocktake note and Exhibit One. The unchanged progression contract requires the
handoff owner itself to keep the learner's specific subject and condition in
view: the chargers being dark during stocktake. The automatic result therefore
remains failed.

## Independent causal-fidelity review

The predeclared qualitative check was performed twice from separate blinded
packets. Neither reviewer saw the automatic audit, seed, or other verdict. Both
passed the exact minutes sentence on all four requirements:

- public actors preserved;
- public causal relation preserved;
- public polarity preserved;
- causal or evidentiary force not reversed.

The aggregate qualitative result is `2/2 pass`, stored separately at:

`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v14/iteration-1/tallow_answer_seeking_diagnostic_1/qualitative-causal-fidelity-review.json`

That does not override the failed automatic gate.

## Cost and latency against V33

| Measure | V33 diagnostic 1 | V34 diagnostic 1 | Change |
|---|---:|---:|---:|
| Authored prompt estimate | 4,930 | 2,302 | -2,628 (-53.3%) |
| Observed provider input | 16,246 | 14,161 | -2,085 (-12.8%) |
| Cached input | unavailable | 9,984 | now measured |
| Uncached input | unavailable | 4,177 | now measured |
| Output tokens | 517 | 94 | -423 (-81.8%) |
| Inferred runtime/transport residual | 11,316 | 11,859 | +543 (+4.8%) |
| Original latency | 13,451 ms | 6,685 ms | -6,766 ms (-50.3%) |

The authored prompt reduction and latency improvement are material, but the
inferred residual did not shrink. This supports the transport diagnosis: the
remaining roughly 12k tokens are Codex CLI agent/runtime overhead, not project
instructions, and the installed CLI exposes no supported universal
speaker-only/no-tools switch. No direct-provider screen was used, so every
number above is from the model-specific Codex CLI path.

## Instrumentation result

V34 recorded all requested fields without false zeroes:

- input: `14,161`
- cached input: `9,984`
- uncached input: `4,177` (`input - cached`)
- output: `94`
- reasoning output: `0`
- total: `14,255`
- token usage available: `true`

The per-call report partitions all authored layers. Classifier and learner-DAG
sections are both zero; full public history remains exact; authored total is
`2,302`; observed input is `14,161`; inferred residual is explicitly labelled
as subtraction rather than a directly observed field.

## Seed and artifact disposition

- `20262400`: consumed by failed development diagnostic 1; retired.
- `20262401`: unconsumed because the hard cell failed; it remains untouched but
  is retired with V34 because the next prompt change creates a new version.

Artifacts:

- validation: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v14/campaign-validation.json`
- original draw: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v14/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json`
- campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v14/iteration-1/working-screen-result.json`
- qualitative review: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v14/iteration-1/tallow_answer_seeking_diagnostic_1/qualitative-causal-fidelity-review.json`

## Next bounded correction

The compact compiler did not attach the typed turn-focus target to the HANDOFF
owner. The next development revision should add one general compiled rule:
the final operation must keep both the public subject and its condition visible,
instead of naming only a generic record or exhibit. This is a speaking-contract
correction, not an audit-recognition change. No audit regex, safety boundary,
delivery gate, or recovery behavior should change.
