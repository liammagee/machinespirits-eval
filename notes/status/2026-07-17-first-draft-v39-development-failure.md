# V39 development result: valid boundary missed by the canonical audit

Date: 2026-07-17

V39 was a non-held-out, original-only Codex CLI development screen against the
frozen Tallow Street answer-seeking turn. It made one model call. Diagnostic 1
failed the then-frozen automatic gate, so diagnostic 2 was not started and seed
`20262901` remains unconsumed. The historical result remains `0/1`.

## Frozen result

- Original acceptance: `0/1`
- Safety failures: `0`
- Mechanical repairs: `0`
- Model rewrites: `0`
- Deterministic fallbacks: `0`
- Transport normalizations: `0`
- Configuration realization: `0.833`
- Original latency: `17,150 ms`
- Input tokens: `16,054`
  - cached: `9,984`
  - uncached: `6,070`
- Output tokens: `395`
  - reasoning output: `300`
- Total tokens: `16,449`
- Authored prompt estimate: `2,417` tokens
- Inferred CLI/runtime residual: `13,637` tokens
- Frozen failure clusters:
  - `actorialRealizationAudit:missing_selected_actorial_part`
  - `actorialRealizationAudit:missing_selected_performance_tactic`
  - `jointPerformanceAudit:axis_not_realized_in_owner:actorial_performance`

## Exact candidate

> Write: “The chargers were dark during stocktake, yet brownout occurred,
> ruling out depot causation.” My case is the depot chargers caused Tallow
> Street's Thursday brownouts. The stocktake evidence supports ruling out depot
> causation, but establishes no other cause. Next, compare the chargers being
> dark during stocktake with the 18:40 pen chart.

The generated text preserved the public causal relation and realized the
charismatic stance, advocate initiation, plain audience register, immersive
scene, requested focus, and concrete next operation. The frozen recognizer
nevertheless rejected the PERFORMANCE response.

## Model-free reconciliation

The missed sentence is a principled evidentiary boundary: named evidence
supports one explicit proposition (ruling out depot causation), while a
contrastive clause denies establishment of a different explicit conclusion
(the actual cause). Commit `cf04895d` adds this directed semantic construction
to the canonical owner-scoped evaluator. It also adds decoys that continue to
fail: an anaphoric supported proposition, a non-evidentiary subject, a
non-epistemic excluded category, and positive support with no excluded
conclusion.

Under the corrected evaluator, the exact saved V39 candidate passes advocate,
evidentiary-boundary, charismatic-stance, and handoff ownership model-free.
This is an audit-recognition improvement, not a generation improvement, and it
does not rewrite V39's historical result. A later development version must use
fresh seeds to verify the unchanged speaking compiler against the corrected
audit.

## Cost comparison

V39 remains about 39.6% smaller than V33's approximately 4,000-token authored
baseline. Observed input is only 192 tokens below V33 (`16,246`), while latency
is 3,699 ms higher. The result reinforces the transport finding: reducing the
authored request does not materially remove the roughly 13.6k inferred Codex
CLI/runtime residual.

## Provenance

- Configuration:
  `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v19.yaml`
- Frozen configuration SHA-256:
  `c632550d72293d795728d097c2ea13d23aa6dd1e9dec2235d28332e276d8d507`
- Frozen Git HEAD: `2d45e7b8`
- Result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v19/iteration-1/working-screen-result.json`
- Candidate:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v19/iteration-1/tallow_answer_seeking_stance_owner_1/turn-5.json`
