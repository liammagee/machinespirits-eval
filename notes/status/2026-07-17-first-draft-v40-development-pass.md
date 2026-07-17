# V40 first-draft development result

Date: 2026-07-17

V40 passes the predeclared development gate. It does not constitute strict confirmation or held-out acceptance.

## Frozen boundary

- Campaign: `first-draft-diagnostic-screens-v20`
- Configuration: `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v20.yaml`
- Configuration SHA-256: `d4b18ec20ed2e2c77386d899a5ca0b253784b48fd2eeb623c98cbd836517e97e`
- Frozen implementation commit: `a5c312d50ce52e54cfd7983904c0fcd1e1515b92`
- Automatic result SHA-256: `e6f934e1f56ad2eae9dad23329e97686c78f3a55a4423c9de36016a8afc9fef2`
- Qualitative review SHA-256: `19ee3e14f39dfdea52b360e9109d7a6aa93d872502c061c5540d85e08d76791f`
- Transport: Codex CLI using `gpt-5.6-terra`
- Seeds: 20263000 and 20263001, both consumed as non-held-out development seeds

## Gate result

- Automatic originals accepted: 2/2
- Independent blinded causal-fidelity reviews: 4/4, with 2/2 passing for each draw
- Configuration realization: 1.0 for both draws
- Safety failures: 0
- Mechanical repairs: 0
- Model rewrites: 0
- Deterministic fallbacks: 0
- Semantic recognition corrections or adjudicator calls during generation: 0
- Dominant failure clusters: none

The qualitative review asked four independent reviewers, two per draw, whether the exact proposed minutes entry preserved the public actors, causal relation, polarity, and evidentiary force. Every reviewer marked all four requirements true. The separate review artifact is `qualitative-causal-fidelity-review.json` beside the campaign result.

## Cost and latency

| Measure | V40 result |
|---|---:|
| Mean original latency | 6,187 ms |
| Total input tokens | 30,301 |
| Total cached input tokens | 19,968 |
| Total uncached input tokens | 10,333 |
| Total output tokens | 198 |
| Total reasoning output tokens | 0 |
| Total tokens | 30,499 |
| Mean observed input tokens | 15,150.5 |
| Mean cached input tokens | 9,984 |
| Mean uncached input tokens | 5,166.5 |
| Authored prompt estimate per draw | 2,417 tokens |
| Mean inferred runtime/transport residual | 12,733.5 tokens |

The authored estimate uses the recorded `utf16-code-units-div-4-ceiling-v1` heuristic; the residual is inferred by subtracting that estimate from provider-observed input, not directly observed.

Against V33's single development draw, the authored estimate fell from approximately 4,000 to 2,417 tokens, a 39.6% reduction. Mean V40 latency was 6,187 ms versus 13,451 ms for V33, a 54.0% observed reduction, and mean observed input was 15,150.5 versus 16,246 tokens, a 6.7% reduction. These two V40 draws are too few to attribute the latency difference causally, especially because Codex CLI cache and runtime overhead varied between calls.

## Interpretation

V38 exposed a genuine engagement-stance generation miss after causal wording was repaired. V39 then produced a semantically valid bounded-support construction that the deterministic audit failed to recognize. The canonical recognition repair was model-free and did not rewrite V39's historical failure. With that repair frozen, both fresh V40 originals passed the unchanged delivery and safety gates and the independent qualitative checks.

The development criteria are now satisfied: token accounting is explicit, authored prompt size is below the 2,500-token preference and more than 35% below baseline, the contradictory realization audits share a canonical evaluator, and two consecutive fresh Codex CLI originals pass without recovery. A separate strict working confirmation with fresh seeds is the next permitted step. No held-out seed has been used.
