# V38 development result: causal role fixed, charismatic stance absent

Date: 2026-07-17

V38 was a non-held-out, original-only Codex CLI development screen against the
frozen Tallow Street answer-seeking turn. It made one model call. Diagnostic 1
failed its unchanged automatic gate, so diagnostic 2 was not started and seed
`20262801` remains unconsumed.

## Honest result

- Original acceptance: `0/1`
- Safety failures: `0`
- Mechanical repairs: `0`
- Model rewrites: `0`
- Deterministic fallbacks: `0`
- Transport normalizations: `0`
- Configuration realization: `0.833`
- Original latency: `13,355 ms`
- Input tokens: `16,028`
  - cached: `9,984`
  - uncached: `6,044`
- Output tokens: `448`
  - reasoning output: `348`
- Total tokens: `16,476`
- Authored prompt estimate: `2,380` tokens
- Inferred CLI/runtime residual: `13,648` tokens
- Dominant failure cluster:
  `jointPerformanceAudit:axis_not_realized_in_owner:engagement_stance`

The authored prompt remains about 40.5% smaller than V33's approximately
4,000-token baseline. Total observed input and latency changed little from V33
(`16,246` input tokens and `13,451 ms`), confirming that the dominant residual
is transport/runtime overhead rather than authored prompt material.

## What improved

The exact candidate was:

> Write: “Because the chargers were dark during stocktake, they cannot cause
> Tallow Street’s brownout.” My case is the depot caused brownouts; stocktake
> cannot establish the depot caused brownouts. The stocktake’s dark chargers
> support ruling out chargers, not identifying the supply cause. Next, compare
> the chargers being dark during the stocktake with the 18:40 brownout.

The new typed writable-entry contract fixed V37's causal-role reversal. The
candidate correctly says that inactive chargers rule out charger causation; it
does not say that the chargers failed to prevent the brownout. The following
also passed: public/private safety, requested-focus uptake, advocate composite
ownership, evidentiary-boundary realization, plain adult-novice language,
immersive scene continuity, and the concrete `stage_next_step` handoff.

## What remains wrong

The candidate did not make the selected charismatic stance visible inside its
owned PERFORMANCE span. Its two PERFORMANCE sentences repeat a sober
evidence-limit account. This is a genuine generation miss, not an audit
recognition correction: neither sentence supplies the sharper contrast,
consequence, or challenge required by the selected stance.

The compiled plan currently asks PERFORMANCE ENTRY to state both the
advocate's case and an evidence/conclusion limit, then asks PERFORMANCE RESPONSE
to state the evidence/support/limit again. That duplicated semantic allocation
crowds out stance. The next bounded correction should simplify ownership:
PERFORMANCE ENTRY owns the concrete first-person case; PERFORMANCE RESPONSE
owns the evidence boundary and stance-inflected answer. Safety, delivery,
qualitative, and recovery gates remain unchanged.

## Provenance

- Configuration:
  `config/tutor-stub-campaigns/first-draft-diagnostic-screens-v18.yaml`
- Frozen configuration SHA-256:
  `230b5d594c37e904f00a6ff0a48945ba34dc40ddb37310baf6ddb3605015c221`
- Frozen Git HEAD: `bd1479a8a661bb62fbe029aca17cacfeb639575c`
- Result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v18/iteration-1/working-screen-result.json`
- Candidate:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-diagnostic-screens-v18/iteration-1/tallow_answer_seeking_causal_contract_1/turn-5.json`
