# V35 compact development gate: two consecutive originals pass

Date: 2026-07-17  
Status: passed non-held-out development gate; strict confirmation not yet run  
Campaign: `first-draft-diagnostic-screens-v15`  
Configuration SHA-256: `cde4ab0339485b81dfcaa6944c620862a0ce35c121b23087e6345214f3f5b1ed`

## Honest result

V35 generated two consecutive original speaking-tutor candidates through the
Codex CLI at the same frozen Tallow turn-5 boundary. Both passed every unchanged
automatic gate and both passed their predeclared independent qualitative
causal-fidelity reviews. This satisfies the bounded development gate. It is not
strict confirmation or held-out acceptance.

- Original candidates accepted: `2/2`
- Mean configuration realization: `1.0` in both cells
- Safety failures: `0`
- Mechanical repairs: `0`
- Model rewrites: `0`
- Deterministic fallbacks: `0`
- Semantic recognition corrections: `0`
- Semantic adjudicator calls: `0`
- Transport normalizations: `0`
- Transcript-specific uptake failures: `0`
- Compact-prompt provenance failures: `0`
- Joint output or owner-scoped realization failures: `0`
- Structural target failures: `0`

The first exact candidate was:

> Write: “The dark chargers during stocktake rule out the chargers as the
> brownout’s cause.” My case is dark chargers cannot cause that brownout, but
> no cause is established. The stocktake shows dark chargers and the 18:40
> brownout; it only rules chargers out. Next, compare the chargers being dark
> during the stocktake with the 18:40 chart.

The second exact candidate was:

> Write: “The dark chargers during stocktake rule out the depot as the cause.”
> My case is dark chargers clear the depot, but cannot name the cause. The
> stocktake brownout only shows darkness at the depot did not prevent dimming.
> Next, compare the chargers being dark during the stocktake with the 18:40 pen
> chart.

In both draws, the HANDOFF owner retained all five required focus terms:
`charger`, `being`, `dark`, `during`, and `stocktake`. This resolves V34's
specific progression failure through a general compiled speaking requirement;
no audit regex or delivery gate changed.

## Independent causal-fidelity review

Each exact proposed minutes entry was reviewed twice from isolated packets.
Reviewers did not see the other candidate, the other verdict, the automatic
audit, or the seed. All four ratings passed all four requirements:

- public actors preserved;
- public causal relation preserved;
- public polarity preserved;
- causal or evidentiary force not reversed.

Results:

- diagnostic 1: `2/2 pass`;
- diagnostic 2: `2/2 pass`.

The fourth review used a separate Claude Code Haiku process in isolated print
mode with tools disabled. Its runtime and token cost are reviewer overhead and
are not included in the speaking-tutor metrics below.

Review artifacts:

- `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/iteration-1/tallow_answer_seeking_diagnostic_1/qualitative-causal-fidelity-review.json`
- `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/iteration-1/tallow_answer_seeking_diagnostic_2/qualitative-causal-fidelity-review.json`

## Cost and latency against V33

| Measure | V33 diagnostic 1 | V35 mean, two draws | Change |
|---|---:|---:|---:|
| Authored prompt estimate | 4,930 | 2,353 | -2,577 (-52.3%) |
| Observed provider input | 16,246 | 15,106.5 | -1,139.5 (-7.0%) |
| Cached input | unavailable | 9,984 | now measured |
| Uncached input | unavailable | 5,122.5 | now measured |
| Output tokens | 517 | 470 | -47 (-9.1%) |
| Inferred runtime/transport residual | 11,316 | 12,753.5 | +1,437.5 (+12.7%) |
| Original latency | 13,451 ms | 12,915.5 ms | -535.5 ms (-4.0%) |

V35's aggregate speaker usage was:

- input: `30,213`;
- cached input: `19,968`;
- uncached input: `10,245` (`input - cached`);
- output: `940`;
- reasoning output: `750`;
- total: `31,153`;
- token usage available: `true`.

The authored request is materially smaller and comfortably exceeds the 35%
target. Observed input and latency fell only modestly on average. V34 completed
in 6,685 ms, whereas the two V35 draws took 14,022 ms and 11,809 ms. The compact
contract therefore makes project-authored cost smaller and the loop more
interpretable, but does not reliably remove the Codex CLI runtime cost. The
roughly 12.8k-token mean inferred residual remains the dominant input. It is
explicitly a subtraction estimate, not a directly observed provider field.

No direct-provider screen was used. Both accepted originals are model-specific
Codex CLI verification results.

## Development-gate interpretation

All requested prerequisites for leaving compact development screening are now
met:

- complete nullable token instrumentation, including cached and uncached input;
- one canonical owner-scoped performance evaluator with no unexplained audit
  contradiction;
- exact public-history continuity and unchanged public/private boundaries;
- a 52.3% authored prompt reduction from V33;
- zero safety or recovery-path use;
- two consecutive fresh originals passing every unchanged automatic gate;
- two independent passing causal-fidelity ratings for each candidate.

This authorizes predeclaration of a separate strict confirmation campaign with
fresh seeds. It does not turn V35 itself into strict confirmation.

## Seed and artifact disposition

- `20262500`: consumed non-held-out development seed.
- `20262501`: consumed non-held-out development seed.

Artifacts:

- validation: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/campaign-validation.json`
- diagnostic 1: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/iteration-1/tallow_answer_seeking_diagnostic_1/turn-5.json`
- diagnostic 2: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/iteration-1/tallow_answer_seeking_diagnostic_2/turn-5.json`
- campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v15/iteration-1/working-screen-result.json`

The next step is a separately frozen strict working confirmation. It must use
fresh seeds, run the complete integration boundary, and permit no code or
configuration changes between its cells.
