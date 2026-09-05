# Writing Pad state-lifecycle audit

Date: 2026-09-04
Status: complete, zero-call source-and-test audit

## Scope

This audit covers the SQLite-backed three-layer Writing Pad in
`tutor-core/services/writingPadService.js`, its live dialogue-engine lifecycle,
cell 21, and the LangGraph adaptive-trap runner. It does not generalize to the
separate drama/tutor-stub pad in `services/memory/tutorWritingPad.js`, and it
makes no effectiveness or security claim.

## Conclusion

The tutor-core Writing Pad **selectively accumulates and consolidates state; it
does not simply overwrite the learner's prior pad**:

- A learner id reuses one stored pad rather than reinitializing it
  ([initialization and read path](../tutor-core/services/writingPadService.js#L23-L112)).
- The conscious layer is a scratch surface. The live generation path appends the
  current suggestion, then the memory cycle detects promotable patterns and
  deliberately clears the conscious arrays and notes
  ([live write](../tutor-core/services/tutorDialogueEngine.js#L1949-L1986),
  [promote-then-clear cycle](../tutor-core/services/memoryDynamicsService.js#L294-L358)).
- The preconscious layer adds a novel `(type, signature)` pattern or reinforces
  the matching entry; maintenance later removes stale, low-confidence patterns
  ([promotion/reinforcement](../tutor-core/services/writingPadService.js#L185-L243),
  [decay](../tutor-core/services/writingPadService.js#L322-L359)).
- The unconscious layer appends a compact trace for each eligible recognition
  moment and marks the source moment consolidated
  ([trace append](../tutor-core/services/writingPadService.js#L245-L299),
  [eligibility and maintenance](../tutor-core/services/memoryDynamicsService.js#L138-L214)).

"Compaction" therefore has a narrow meaning here: selected events become
smaller pattern/trace records, duplicates in the preconscious layer are
reinforced in place, and stale preconscious records can decay. There is no
general summarizer or size bound for `unconscious.permanentTraces`, so this is
not an indefinitely bounded antibody library. The generic `updateConscious`
and `updateUnconscious` helpers shallow-merge top-level objects and will replace
an array supplied by a caller; accumulation is guaranteed by the inspected live
callers that spread the prior array, not by those generic setters alone.

## Consequence for cell 21

Cell 21 enables LLM prompt rewriting and dialectical negotiation
([profile](../config/tutor-agents.yaml#L969-L1007)). The evaluation runner keeps
one synthetic learner id for the whole dialogue, or reuses an explicitly
provided id across sessions
([identity resolution](../services/evaluationMultiTurnSetupRuntime.js#L64-L85)).
That stable id lets the dialogue engine fetch the existing pad and place its
preconscious/unconscious contents on the dialectical read path; the focused
two-session test proves a session-1 synthesis reaches the session-2 superego
prompt without an external injection file
([test](../tutor-core/services/__tests__/writingPadInternalPathDelivery.test.js#L54-L166)).

This does **not** mean cell 21 accumulates every rewritten ego directive. Its
`sessionEvolution` directive block is reassigned between turns from the current
rewrite result (or deterministic fallback), although that rewrite sees the
accumulated turn results, trace, and conversation history
([between-turn assignment](../services/evaluationBetweenTurnAdaptationRuntime.js#L170-L225)).
The durable memory is the Writing Pad's selected patterns and consolidated
recognition traces; the prompt-rewrite block is a fresh current snapshot.

The profile's `writing_pad_enabled: true` line is not itself the runtime gate:
no JavaScript reads that historical YAML flag, and the maintained blueprint
already records that pads key on the runner-supplied learner id
([existing caveat](../config/tutor-blueprint.yaml#L99-L112)). For cell 21, the
load-bearing wiring is the stable learner id plus the dialogue engine's
pad read/write cycle and `dialectical_negotiation: true`.

## Consequence for the adaptive trap suite

The trap runner is **not stateless within one scenario**. Its dialogue,
constraint violations, trap events, policy-action history, and (for applicable
architectures) evidence ledger are append-reduced across turns, while the
current learner profile is last-write-wins
([state reducers](../services/adaptiveTutor/stateSchema.js#L232-L323)).

The missing boundary is learner-keyed memory **between scenario invocations**.
Every `runScenario` compiles a fresh in-memory checkpointer and invokes the
graph with `baseInitialState`, which resets the learner profile, tutor state,
dialogue seed, trap-event list, and policy-action history; neither the scenario
input nor the runner accepts a learner id or loads the tutor-core Writing Pad
([runner lifecycle](../services/adaptiveTutor/runner.js#L14-L85)). Thus a tutor
can react to a trap recorded earlier in the current scenario, but a later
scenario for the same conceptual learner cannot retrieve which traps were
previously attempted. An AgentAntibody-like cross-encounter memory would need a
separate learner-keyed durable store plus an explicit match/reuse/update rule;
this audit does not propose or implement one.

This distinction corrects the card's shorthand "lack of cross-turn learner
memory": the suite has cross-turn state inside a run, but lacks durable
cross-scenario/cross-session learner memory.

## Verification

No model or provider calls were made.

- `npm --prefix tutor-core test -- services/__tests__/writingPadInternalPathDelivery.test.js services/__tests__/memoryDynamicsService.runMemoryCycle.test.js services/__tests__/tutorDialogueSessionIdentity.test.js`
  — 3 files, 8 tests passed.
- `ADAPTIVE_TUTOR_LLM=mock node --test tests/adaptation-closed-loop.test.js`
  — 5 tests passed; confirms the adaptive runner retains multi-turn dialogue
  and intervention state inside one scenario on the deterministic mock path.
