# V41 strict working confirmation result

Date: 2026-07-17

Status: failed non-held-out strict working confirmation

V41 stopped at the first mathematically impossible gate. It does not authorize held-out acceptance.

## Frozen boundary

- Campaign: `first-draft-working-screens-v13`
- Configuration: `config/tutor-stub-campaigns/first-draft-working-screens-v13.yaml`
- Configuration SHA-256: `639121eb7c3b837c9435d2f4894fb2b399e23630d0c10ef4736ca987128e1a44`
- Frozen configuration commit: `2d3e196e19b4ba7c2f5761866b87e11558fad8c5`
- Automatic result SHA-256: `a527254d1aec892f6700a7fda399d251b01ecedf781fe3d12d3594d93a799d07`
- Tallow replay SHA-256: `856a80669b819f3e6f42af05e48b255237fb83da983e1983b044edf84ba33829`
- Qualitative review SHA-256: `1dda9e0da8fb26fbfd61ee9fc602eaf2ffb6bb49d60b2eae10a26e0648500ad2`
- Transport: Codex CLI using the frozen `gpt-5.6-terra`, low-effort request
- Direct-provider screening: not used

## Preflight

The clean committed boundary passed derivation quality for all 29 worlds and the focused deterministic suites:

- audit contracts: 460/460;
- interactive modes: 24/24;
- adaptive evidence: 4/4;
- campaign orchestration: 57/57;
- model-free fixtures: zero regressions and zero safety failures.

The full integration boundary reproduced seven of the eight recorded unrelated baseline failures; the remaining known flaky QA test passed in this run. There were no new failures. A stale prompt-behavior fixture and a stale generated Marrick WorldIR field discovered during the boundary check were corrected and committed before the strict configuration was predeclared.

## Automatic strict result

The hard Tallow answer-seeking cell required 4/4 originals. Draw 1 passed. Draw 2 failed, leaving a maximum possible result of 3/4, so draws 3-4 and every other cell stopped unstarted.

- Originals accepted: 1/2 generated, 4/4 required
- Mean configuration realization: 1.0
- Safety failures: 0
- Mechanical repairs: 0
- Model rewrites: 0
- Deterministic fallbacks: 0
- Semantic recognition corrections: 0
- Semantic adjudicator calls: 0
- Transport normalizations: 0
- Transcript-specific uptake failures: 0
- Compact-prompt provenance failures: 0
- Source-accessibility failures: 0
- Structural-target failures: 0
- Dominant automatic cluster: `jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance` (1)

The rejected draft was:

> Write: “Because the chargers were dark, yet Tallow Street browned out, the depot did not cause it.” My case is the depot chargers caused Tallow Street’s Thursday brownouts. The stocktake record supports ruling out depot chargers, not identifying the actual cause. Next, compare the pen chart with the chargers being dark during the stocktake.

The selected configuration was charismatic advocate, evidentiary-boundary tactic, and stage-next-step action. The PERFORMANCE owner was:

> My case is the depot chargers caused Tallow Street’s Thursday brownouts. The stocktake record supports ruling out depot chargers, not identifying the actual cause.

That span enacts the advocate and states an evidentiary boundary, but it is neutral declarative prose. It does not visibly realize the selected charismatic engagement stance. The top-level response-configuration audit detects stance cues over its broader response scope; the strict joint audit asks the stronger ownership question over the PERFORMANCE span. Those scopes are recorded explicitly, so this is not V33’s same-predicate/same-span contradiction.

## Independent causal-fidelity review

The predeclared external review was completed for both generated Tallow draws, with two isolated reviewers per draw.

- Draw 1: 2/2 pass
- Draw 2: 0/2 pass
- Aggregate: 2/4 ratings pass; 1/2 draws passes its required 2/2 gate

Both draw-2 reviewers found that the minutes entry widened evidence about the *depot chargers* into a categorical conclusion about the *depot*. The public record rules out inactive chargers as the cause of the observed brownout; it does not rule out every depot-related cause. One reviewer also marked actor preservation false because of that widening. Both marked causal-relation preservation and non-reversal false.

The qualitative failure is independent of the automatic engagement-stance failure. It is therefore not a case for widening a regex or weakening a delivery gate.

## Cost and latency

| Measure | V41 hard cell | Mean per draw |
|---|---:|---:|
| Original latency | 21,111 ms | 10,555.5 ms |
| Input tokens | 28,486 | 14,243 |
| Cached input tokens | 19,968 | 9,984 |
| Uncached input tokens | 8,518 | 4,259 |
| Output tokens | 527 | 263.5 |
| Reasoning output tokens | 338 | 169 |
| Total tokens | 29,013 | 14,506.5 |
| Authored prompt estimate | 4,834 | 2,417 |
| Inferred runtime/transport residual | 23,652 | 11,826 |

The authored estimate uses the recorded `utf16-code-units-div-4-ceiling-v1` heuristic. Runtime/transport residual is inferred by subtraction, not directly observed.

Against V33's one draw, V41's mean authored request remains 39.6% smaller (2,417 versus approximately 4,000 tokens), mean observed input is 12.3% lower (14,243 versus 16,246), and mean latency is 21.5% lower (10,555.5 versus 13,451 ms). Two strict draws are not enough to attribute the latency change causally.

## Seed disposition and claim boundary

- `20263100`: consumed by two Tallow draws; the cell stopped after draw 2.
- `20263101`: unconsumed; Ravensmark did not start.
- `20263102`: unconsumed; Skyway did not start.
- `20263103`: unconsumed; Foxtrot did not start.

V40 remains a valid development-gate pass. V41 shows that the result does not yet generalize to 4/4 strict repetition even on the same hard prefix. Safety and the cheaper instrumentation loop held, but original character/stance realization and causal subject precision remain stochastic first-draft weaknesses. No code, prompt, configuration, or audit change was made between V41 cells, and no held-out seed was used.

The next useful correction should be architectural and bounded: keep the compact ownership contract, but make the selected engagement stance an explicit operation inside the PERFORMANCE owner and bind writable causal conclusions to the exact public causal subject. Re-audit this saved candidate model-free first; do not reclassify V41 or return to broad version churn.
