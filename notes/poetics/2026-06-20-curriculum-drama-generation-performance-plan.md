# Curriculum Drama Generation Performance Plan

Date: 2026-06-20
Status: proposed implementation plan
Scope: `scripts/generate-pedagogical-dramas.js` and the curriculum-driven light-drama path through `services/learnerTutorInteractionEngine.js`

## Summary

The slow Sonnet curriculum-drama runs appear to be dominated by harness design, not by Sonnet model speed alone. A single visible dialogue turn is produced by several serial Claude CLI calls, and each call receives large role prompts plus repeated drama, curriculum, world, affective, and reframe constraints.

The practical target is to make the light-drama generator cheaper and more observable without changing the research meaning of the current full-fidelity path. Keep the full ego-superego path available, but add a compact drama lane and better instrumentation so we can decide when the expensive path is warranted.

## Evidence From The AF11 Run

The live `D_AF11_CURRICULUM_ADAPTIVE` Sonnet worker run showed:

- Director plan call: approximately 86.9 seconds.
- Opening learner ego call: approximately 21.9 seconds.
- Opening learner superego call: approximately 33.4 seconds.
- Opening learner ego adjudication call: approximately 20.4 seconds.
- First public learner line appeared only after roughly 2.7 minutes.

This means the apparent stall before turn 0 is expected under the current architecture. The generator is doing hidden director and learner-internal work before any public transcript can be flushed.

The same inspection also showed:

- The partial director plan was about 18.8k JSON characters.
- The learner side constraint alone was about 3.7k characters.
- The normal recognition tutor prompt files are large:
  - `prompts/tutor-ego-recognition.md`: about 20.4k characters.
  - `prompts/tutor-superego-recognition.md`: about 19.8k characters.
- The drama tutor inherits normal suggestion/navigation prompt sections such as `suggestion_principles`, `output_format`, `curriculum_navigation`, and `recognition_checklist`, even though the drama runtime only needs a public tutor line.

## Diagnosis

The bottleneck has six parts.

1. The run is many serial LLM calls, not one Sonnet generation.

   A full scene can include one director call, three opening learner calls, then up to three tutor calls and three learner calls for each tutor/learner exchange. A six-turn scene can therefore approach dozens of serial Claude CLI transactions.

2. Persistent workers are not reusing enough.

   The worker key includes `role + model + effort + hash(systemPrompt)`. Dynamic scene and turn context are currently embedded into system prompts, so many calls get distinct worker keys. Persistence avoids some CLI startup, but it does not remove prompt bloat or guarantee reuse across turns.

3. Role prompts are too large for drama generation.

   The normal tutor prompts were designed for suggestion/navigation evaluation, not for script dialogue generation. They carry irrelevant output schemas and curriculum navigation instructions into a path that only needs direct speech plus hidden review.

4. Dynamic context is repeated too often.

   The same scene constraints, world constraints, affective policy, and reframe policy are repeatedly copied into ego, superego, and adjudication prompts. This is defensible for fidelity, but it is costly and noisy.

5. Progress reporting is too coarse.

   Partial transcript flushing happens only after public turns. Director calls and internal ego-superego deliberation are invisible, so long periods of real work look like stalls.

6. Output length is not bounded by role.

   The most expensive review roles, especially tutor superego, can produce long critiques even when the runtime only needs a compact pass/fail/revise signal. Per-role output caps will not reduce repeated input context, but they should reduce output-token cost and long-tail latency while preserving the current full-fidelity input contract.

## Plan Of Record

### Slice 1: Instrument Before Optimizing

Add lightweight per-call telemetry to the drama generator's Claude bridge:

- role
- backend and model
- reasoning effort
- start and finish timestamps
- latency
- system prompt character count
- user prompt character count
- output character count
- prompt hash
- worker key
- whether the call used an existing persistent worker or created a new one

Persist this in the held-out deliberation JSON and optionally print a concise progress line when `--trace-calls` or equivalent is enabled.

Acceptance criteria:

- A partial run can explain where time is being spent before the first public turn.
- The trace shows prompt sizes without exposing full hidden prompt text.
- Existing runs remain unchanged unless tracing is enabled.

### Slice 2: Move Dynamic Context Out Of Persistent Worker System Prompts

Refactor the Claude worker path so static role identity remains in `systemPrompt`, while dynamic scene, dialogue, director cue, world, and turn context are sent in the user message.

Target static system prompts:

- director role identity and JSON contract
- drama tutor ego identity
- drama tutor superego identity
- drama learner ego identity
- drama learner superego identity

Target dynamic user payload:

- topic
- scenario
- current dialogue history
- director plan
- current cue
- world constraints
- affective adaptation context
- peripeteia/reframe event context

Acceptance criteria:

- Persistent worker count drops to one stable worker per role/model/effort where possible.
- Worker reuse is visible in telemetry.
- Public transcript and quality warnings remain comparable to the current path.

### Slice 3: Add Per-Role Output Token Budgets

Add explicit role-specific `max_tokens` budgets for the light-drama generator, with conservative defaults and CLI/env overrides.

Initial candidate budgets:

- `director`: keep generous initially, approximately `2500-4000` output tokens, because the director plan sets the full scene contract.
- `tutor_ego`: approximately `500-900` output tokens, enough for private decision plus concise public tutor speech.
- `tutor_superego`: approximately `500-900` output tokens, with a strict checklist/rewrite instruction rather than essay critique.
- `learner_ego`: approximately `400-800` output tokens, enough for private decision plus short public learner speech.
- `learner_superego`: approximately `300-700` output tokens, enough to name missed pressure and revision need.

Implementation options:

- Add a role budget map in `scripts/generate-pedagogical-dramas.js`.
- Thread role budgets into the generator bridge so CLI/API backends receive the relevant cap.
- Record requested and effective role token caps in call telemetry and held-out keys.
- Allow overrides such as `--role-max-tokens tutor_superego=700,learner_superego=500` or an equivalent env var for quick probes.

Acceptance criteria:

- Telemetry records role max-token caps per call.
- Superego calls show lower output-token counts without hidden-label leakage or stock fallback.
- Quality gate remains clean on the same AF1/AF11 comparison cases.
- The result is treated as latency-tail control, not as a replacement for input-context compression.

### Slice 4: Add Compact Drama-Specific Tutor Prompts

Create drama-specific tutor prompts instead of reusing the full suggestion/navigation tutor prompts.

The compact tutor ego prompt should include only:

- role: public tutor in a teaching drama
- output: direct public speech only
- no hidden label exposure
- artifact/world grounding
- adaptation constraints supplied dynamically

The compact tutor superego prompt should include only:

- review the draft for pedagogy, public safety, route change, affective stance, and action gate
- return concise structured critique
- do not draft public speech

Remove from the drama lane:

- suggestion JSON schema
- curriculum navigation action targets
- generic recommendation principles
- browser/navigation affordances

Acceptance criteria:

- Tutor system prompt character count is materially lower.
- Tutor calls stop carrying suggestion/navigation sections.
- Existing standard evaluation tutor prompts are untouched.

### Slice 5: Add A Preview Fidelity Mode

Add a generator option for cheap structural screens before full-fidelity paid runs.

Possible modes:

- `--drama-fidelity full`: current director plus tutor ego-superego plus learner ego-superego.
- `--drama-fidelity compact`: compact drama prompts, same multi-agent structure.
- `--drama-fidelity preview`: compact prompts, no superego except selected intervention turns.
- `--drama-fidelity public-only`: one tutor call and one learner call per public turn, no internal deliberation.

Acceptance criteria:

- Preview runs produce usable public transcripts quickly.
- Full mode remains available for final artifacts.
- Key files record the fidelity mode.

### Slice 6: Cache Or Reuse Director Plans

Avoid regenerating the director plan when rerunning the same drama with the same spec, seed, model, and director policy.

Options:

- Add `--director-plan-cache <path>`.
- Add `--reuse-director-plan <json-or-yaml>`.
- Store director plan beside the key and allow rerun from it.

Acceptance criteria:

- Rerunning AF11 after a cue/runtime patch can skip the 80-90 second director call.
- The key records whether the director plan was generated or reused.

## Validation Plan

Use a narrow validation ladder:

1. Run a mock or no-LLM unit test for prompt routing and telemetry fields.
2. Run one short Sonnet preview on AF11 and compare call counts and prompt sizes.
3. Run one token-capped full-fidelity AF1/AF11 sample and compare output tokens, latency, and quality warnings against the uncapped split baseline.
4. Run one compact full-fidelity AF11 sample and compare quality warnings against the current full path.
5. Only then rerun paid full samples for scoring.

Success metrics:

- First public turn latency is reduced.
- Per-turn latency is attributable to specific roles.
- Prompt character counts are materially reduced.
- Output token counts and long-tail review latencies are materially reduced for capped roles.
- Persistent worker reuse increases.
- No hidden labels, spec hashes, answer keys, or evaluator internals leak into public transcript text.

## Non-Goals

- Do not remove the existing full ego-superego path.
- Do not change the curriculum/world contract semantics in this performance slice.
- Do not treat compact drama output as final quality evidence until compared against full-fidelity output.
- Do not optimize by weakening hidden-label safety or curriculum evidence constraints.

## Suggested Next Move

Implement Slice 1 first. The current system lacks enough timing and prompt-size telemetry to make later optimization evidence-backed. Once call-level telemetry is present, run AF11 with tracing enabled and decide whether Slice 2 or Slice 3 gives the larger win.
