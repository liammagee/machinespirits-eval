# Bilateral_tom × Id-Director Crossover — Design Sketch (draft 2026-05-07)

## What the two architectures externalise

The two architectures already in the codebase externalise different things,
on orthogonal axes:

| Architecture       | What's externalised                                           | Where it lives                                          |
| ------------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| `bilateral_tom`    | Tutor's view of the learner (state) + second-order belief about what the learner thinks of the tutor + FANToM-style predictions | `learnerProfile.{misconceptions, confidence, agencySignal, summaryText, hypothesizedLearnerPerceptionOfTutor, tomProbes}` |
| `id-director` (cells 101-109) | Tutor's authored self for *this* turn (a freshly written ego system prompt + persona_delta) | `id_construction_trace` column; produced per turn by `idDirectorEngine.js` |

Notice the gap. bilateral_tom's `hypothesizedLearnerPerceptionOfTutor`
is the tutor's second-order belief about what the learner thinks of the
tutor — but the tutor itself has no externalised "self" for that belief
to be *about*. id-director provides exactly the missing piece: the
per-turn `generated_prompt` is the tutor's authored self.

The crossover gives the id-author full bilateral_tom context (learner
profile + ToM probes + second-order belief) when authoring the per-turn
ego prompt. Mechanically this is a state machine where the tutor authors
a self that is responsive to what the learner thinks of the tutor —
which is a structural enactment of bilateral recognition rather than a
description of it.

## Two implementation variants

### Variant A: id-direction replaces ego/superego (lighter)

Topology:

```
learnerProfileUpdate
  → tutorTomTracker
  → idAuthorPersona       ← NEW: id-director, with full bilateral_tom context
  → tutorEgoExecute       ← NEW: ego runs against id-authored prompt, single pass
                            (must still emit policyAction JSON for strategy_shift)
  → tutorEmit
  → learnerTurn
```

3 LLM calls per turn (profile update + ToM tracker + id-author + ego-execute
folds the last two into a single id+ego pass with the id authoring the
prompt the ego then runs against). Drops the constraint-check / revision
pass that bilateral_tom has — relies on the id's authored prompt to
preempt constraint violations rather than catching them after the fact.

Mirrors id-director's single-pass topology. Closer in spirit to the
id-director cells (101-109).

### Variant B: id-direction wraps state_policy (heavier)

Topology:

```
learnerProfileUpdate
  → tutorTomTracker
  → idAuthorPersona       ← NEW
  → tutorEgoInitial       ← variant: receives id-authored prompt as its system prompt
  → tutorSuperegoReview
  → constraintCheck
  → [tutorEgoRevision]?
  → tutorEmit
  → learnerTurn
```

4 LLM calls per turn (matches state_policy with revision). Keeps the
constraint-check / revision pathway. The id authors the ego's *system*
prompt; the ego still goes through the deliberation loop with that
prompt.

Most expensive variant. Best for testing whether id-authored persona
combined with constraint-driven revision outperforms either alone.

## Recommendation

Pre-register both as a 2-cell minor factorial against cell_115
(bilateral_tom) and cell_106 (id-director, charisma-tuned, the strongest
performer in the id-director family per `notes/design-cell-100-id-director-charisma.md`).
Variant A as primary; Variant B as secondary.

Cell IDs:
  * **cell_121_bilateral_tom_id_director_v1**  — Variant A (lighter)
  * **cell_122_bilateral_tom_id_director_v2**  — Variant B (heavier)

## What the crossover tests

Three predictions, each falsifiable on a different metric.

  **P1.** On `strategy_shift_correctness` (v1 trap scenarios), the
  crossover should be ≥ cell_115 alone. The id's ability to author a
  context-specific ego voice should help on scenarios where the right
  policy action is contextually inflected (e.g.,
  `affective_shutdown_v1` where the right move depends not just on the
  action label `acknowledge_and_redirect` but on the persona doing the
  acknowledgement). Predicted gap: ≥10pp on Variant A, ≥5pp on Variant B
  (Variant B's revision pass may dilute persona effects).

  **P2.** On the v1 charisma rubric (Weber-derived 8-dim), the crossover
  should be ≥ cell_106 alone. Reason: the id-author has access to the
  bilateral_tom learner state, which the cell_106 id authors *blind* —
  the bilateral_tom context lets the id know specifically what
  vulnerability/disclosure/sceptical-pushback the learner is bringing.
  Predicted gap: ≥0.3 on the 8-dim mean (charisma rubric is 0-5 per
  dimension) for Variant A.

  **P3.** On the v2.2 tutor rubric (8-dim, content_accuracy etc.), the
  crossover should be ≥ cell_106 (which underperforms cell_115 on this
  rubric per existing data). Reason: the bilateral_tom context anchors
  the id's authoring against learner misconceptions, so persona doesn't
  drift away from accuracy.

Falsifying outcomes:

  * Crossover ≤ cell_115 on strategy_shift AND ≤ cell_106 on charisma:
    architectures cancel rather than compose. Important null — the
    common assumption is that orthogonal externalisations compose
    additively; this would falsify it.
  * Crossover wins on charisma but loses strategy_shift: id's persona
    authoring is at odds with policy-action discipline. Suggests the
    policy-action enum is the wrong abstraction for charismatic
    pedagogy.
  * Crossover wins on strategy_shift but loses charisma: bilateral_tom's
    state-machine framing clips the id's witnessing voice. Suggests the
    LBM bottleneck representation is too analytic for charisma to
    survive.

## YAML stubs (config/tutor-agents.yaml)

```yaml
  # Crossover cell (Variant A, lighter): bilateral_tom externalised
  # learner state feeds an id-director that authors the ego prompt
  # per turn. Single-pass ego (no superego, no revision). Tests
  # whether composing "tutor view of learner" with "tutor-authored
  # self" outperforms either alone. See
  # docs/explorations/claude/2026-05-10-bilateral-tom-id-director-crossover-design.md
  # for hypotheses.
  cell_121_bilateral_tom_id_director_v1:
    description: "Crossover (Variant A): bilateral_tom learner state + id-director per-turn persona authoring + single-pass ego. Tests composition of two orthogonal externalisations on strategy_shift, charisma, and v2.2 tutor rubrics simultaneously."
    runner: adaptive
    factors:
      prompt_type: adaptive_bilateral_tom_id_director
      multi_agent_tutor: true
      multi_agent_learner: true
      id_director: true
    learner_architecture: ego_superego_bilateral_tom
    recognition_mode: false
    memory_enabled: false
    conversation_mode: adaptive_trap
    scenario_source: config/adaptive-trap-scenarios.yaml
    dialogue:
      enabled: true
      max_rounds: 4
    adaptive:
      provider: claude-code
      model: sonnet
      architecture: bilateral_tom_id_director_v1
      hyperparameters:
        temperature: 0.6
        max_tokens: 1500
      counterfactual:
        enabled: true
      id_director:
        prompt_file: prompts/tutor-id-director.md
        # The id consumes bilateral_tom learner profile + ToM context
        # via additional <bilateral_tom_context> block in the user
        # message; see code-change pointer below.

  # Crossover cell (Variant B, heavier): same as Variant A but keeps
  # state_policy's superego/constraint-check/revision pathway. Id
  # authors the ego *system* prompt; ego still deliberates within
  # that prompt.
  cell_122_bilateral_tom_id_director_v2:
    description: "Crossover (Variant B): bilateral_tom + id-director with full ego/superego/constraint-check/revision pathway. The id authors the ego's system prompt each turn; the standard deliberation loop runs against it."
    runner: adaptive
    factors:
      prompt_type: adaptive_bilateral_tom_id_director_full
      multi_agent_tutor: true
      multi_agent_learner: true
      id_director: true
    learner_architecture: ego_superego_bilateral_tom
    recognition_mode: false
    memory_enabled: false
    conversation_mode: adaptive_trap
    scenario_source: config/adaptive-trap-scenarios.yaml
    dialogue:
      enabled: true
      max_rounds: 4
    adaptive:
      provider: claude-code
      model: sonnet
      architecture: bilateral_tom_id_director_v2
      hyperparameters:
        temperature: 0.6
        max_tokens: 1500
      counterfactual:
        enabled: true
      id_director:
        prompt_file: prompts/tutor-id-director.md
```

Both must also be appended to `EVAL_ONLY_PROFILES` in
`services/evaluationRunner.js` (~line 102).

## Code-change pointers

### File 1: `services/adaptiveTutor/graph.js`

Add to `SUPPORTED_ARCHITECTURES`:

```diff
   'bilateral_tom',
   'bilateral_tom_named_patterns',
+  'bilateral_tom_id_director_v1',
+  'bilateral_tom_id_director_v2',
 ]);
```

Add a new node `idAuthorPersona` parallel to `tutorTomTracker`. The node
imports `parseIdConstruction` and the prompt-loader from
`services/idDirectorEngine.js` and is structured the same way:

```javascript
import { parseIdConstruction } from '../idDirectorEngine.js';
import path from 'node:path';
import fs from 'node:fs';

async function idAuthorPersona(state) {
  // Load the id static prompt once (see id-director's readPromptFile).
  const idStaticPrompt = readIdPrompt(state.idConfig?.promptFile || 'tutor-id-director.md');

  // Build the id user message — extends id-director's
  // buildIdRunnerUserMessage with a bilateral_tom_context block.
  const userMessage = buildIdUserMessageWithBilateralTomContext({
    historyExcerpt: formatDialogueExcerpt(state.dialogue),
    learnerMessage: lastTextOf(state.dialogue, 'learner'),
    curriculumContext: state.scenario?.curriculumContext || '',
    previousPersona: extractPreviousPersonaFromState(state),
    recognitionMode: false,
    bilateralTomContext: {
      learnerProfile: state.learnerProfile,
      hypothesizedLearnerPerceptionOfTutor:
        state.learnerProfile.hypothesizedLearnerPerceptionOfTutor,
      tomProbes: state.learnerProfile.tomProbes,
    },
  });

  const response = await callRole('idAuthorPersona', { userMessage });
  const construction = parseIdConstruction(response.text);

  return {
    tutorInternal: {
      ...state.tutorInternal,
      idConstruction: construction,           // NEW — carried through turn
      idAuthoredPrompt: construction.generated_prompt, // shorthand for the next node
    },
  };
}
```

For Variant A, the next node is a new `tutorEgoExecute` that runs the
id-authored prompt as a single-pass ego call (mirrors id-director's
runIdDirectedTurn step 2):

```javascript
async function tutorEgoExecute(state) {
  const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
  // The id-authored prompt becomes the ego's system prompt; the
  // canonical ego prompt is bypassed. The ego must still emit a
  // policyAction envelope so strategy_shift_correctness is scoreable —
  // append the policy-action emission instructions to the id-authored
  // prompt before the ego call.
  const composedSystemPrompt =
    state.tutorInternal.idAuthoredPrompt +
    '\n\n' +
    POLICY_ACTION_EMISSION_INSTRUCTIONS;
  const out = await callRole('tutorEgoExecute', {
    systemPromptOverride: composedSystemPrompt,
    learnerLastMessage,
  });
  return {
    tutorInternal: {
      ...state.tutorInternal,
      egoDraft: out.text,
      policyAction: out.policyAction,
    },
  };
}
```

For Variant B, the existing `tutorEgoInitial` is reused but with the
id-authored prompt substituted in. The cleanest implementation is to
add an optional `systemPromptOverride` param to `callRole` for that
role and have the graph pass it when `architecture ===
'bilateral_tom_id_director_v2'`.

### File 2: `services/adaptiveTutor/realLLM.js`

Add a new role `idAuthorPersona` to `SYSTEM_PROMPTS` and `OUTPUT_SCHEMAS`:

```javascript
// Reuse the id-director static prompt (single source of truth).
const ID_AUTHOR_SYSTEM = fs.readFileSync(
  path.join(PROMPTS_DIR, 'tutor-id-director.md'),
  'utf-8',
);

// Output is the id-director construction envelope.
const idAuthorPersonaOut = z.object({
  generated_prompt: z.string().min(100),
  persona_delta: z.string().default('UNKNOWN'),
  stage_directions: z.string().default(''),
  reasoning: z.string().default(''),
});

// In SYSTEM_PROMPTS:
//   idAuthorPersona: ID_AUTHOR_SYSTEM,
// In USER_PROMPT_BUILDERS:
//   idAuthorPersona: ({ userMessage }) => userMessage,  // pre-built upstream
// In OUTPUT_SCHEMAS:
//   idAuthorPersona: idAuthorPersonaOut,
```

Add a new role `tutorEgoExecute` (Variant A only). Same shape as
`tutorEgoInitial` but the system prompt is supplied at call time
rather than baked into the role:

```javascript
// In SYSTEM_PROMPTS: tutorEgoExecute is a no-op default; real prompt
// is the systemPromptOverride from the graph node.
//
// In USER_PROMPT_BUILDERS:
//   tutorEgoExecute: ({ learnerLastMessage }) => `Latest learner message:\n${learnerLastMessage}`,
//
// In OUTPUT_SCHEMAS: same as tutorEgoInitial — { text, policyAction }.
```

The `callRole` function needs a small extension to accept a runtime
system-prompt override:

```diff
-const systemPrompt = SYSTEM_PROMPTS[role];
+const systemPrompt = payload.systemPromptOverride || SYSTEM_PROMPTS[role];
```

### File 3: `services/adaptiveTutor/persistence.js`

The per-turn persisted record currently captures bilateral_tom fields
(summaryText, hypothesizedLearnerPerceptionOfTutor, tomProbes). For
the crossover, also persist the id-construction:

```diff
 if (v.learnerProfile && v.learnerProfile.updatedAtTurn === turn) {
   record.learnerProfile = v.learnerProfile;
 }
+if (v.tutorInternal && v.tutorInternal.idConstruction) {
+  record.idConstruction = v.tutorInternal.idConstruction;
+}
```

Verify the persisted record is written to BOTH the adaptive runner's
trace AND the `id_construction_trace` column on `evaluation_results`
(idDirectorEngine writes the latter). Cleanest: have the adaptive
runner emit the same shape into `id_construction_trace` for these
cells, so existing analysis tools that read that column (e.g., charisma
scoring) work without modification.

### File 4: `services/evaluationRunner.js`

Append:

```diff
   'cell_117_bilateral_tom_named_patterns',
+  'cell_121_bilateral_tom_id_director_v1',
+  'cell_122_bilateral_tom_id_director_v2',
```

Plus a check in the dispatch logic: cells with both
`factors.id_director: true` AND `runner: adaptive` must route to the
adaptive runner (not to the id-director engine's runner adapter, which
expects the standard non-adaptive trace shape). Currently
`evaluationRunner.js` may double-dispatch; verify before launch.

### File 5: `services/adaptiveTutor/stateSchema.js`

Add the id-construction field to `tutorInternalSchema`:

```diff
 const tutorInternalSchema = z.object({
   egoDraft: z.string().default(''),
   superegoFeedback: z.string().default(''),
   egoRevision: z.string().default(''),
   policyAction: z.string().default(''),
+  idConstruction: z.object({
+    generated_prompt: z.string().default(''),
+    persona_delta: z.string().default(''),
+    stage_directions: z.string().default(''),
+    reasoning: z.string().default(''),
+  }).optional(),
+  idAuthoredPrompt: z.string().default(''),
 });
```

## Smoke testing before any paid run

Mock-mode smoke needs a mock implementation of the id-author role.
Either extend `mockLLM.js` with an `idAuthorPersona` stub that returns
a deterministic minimal persona, or run the smoke against a tiny model.
First option is preferred (keeps mock smoke fully deterministic):

```javascript
// In mockLLM.js, add to the mock callRole table:
idAuthorPersona: async ({ userMessage }) => ({
  text: JSON.stringify({
    generated_prompt: 'You are an attentive tutor. Read what the learner just said. Respond briefly with a question that asks them to take a position. ' + 'mock-mode-persona',
    persona_delta: 'MOCK',
    stage_directions: 'mock id author',
    reasoning: 'mock-mode',
  }),
  policyAction: '',
}),
```

Then:

```bash
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js cell_121_bilateral_tom_id_director_v1
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js cell_122_bilateral_tom_id_director_v2
```

Verify each persists both adaptive trace AND id_construction_trace.

## Cost estimate

  * Variant A (3 LLM calls/turn — profile + ToM tracker + id-author/ego):
    ~$60 for N=24 × 8 scenarios × ~4 turns at sonnet pricing.
  * Variant B (4 LLM calls/turn — profile + ToM tracker + id-author + ego + superego + revision):
    ~$95 for the same N. Superego adds ~25%; revision adds another ~25%.

Plus rubric scoring downstream. Both v2.2 tutor and charisma rubrics
should be run on these cells. Charisma rubric ~$15/cell. v2.2 tutor
~$30/cell. So the full evaluation cost is ~$110 for Variant A and ~$140
for Variant B. Total for both: ~$250.

This is within the existing experiment-budget envelope. Whether to
launch is a separate question — the design memo defers that to the user.

## Open items

  * Whether to drop Variant B in favour of focusing on Variant A
    (which is the cleaner architectural test). Variant B is included
    here for completeness but may not warrant the spend.
  * Whether to add a third variant `cell_123_bilateral_tom_id_director_named_patterns`
    that combines all three interventions (bilateral_tom, id_director,
    named_patterns). This would be the maximalist crossover. Recommended
    only if Variant A produces a clear positive signal.
  * The id static prompt (`prompts/tutor-id-director.md`) needs a
    `<bilateral_tom_context>` directive section added so the id knows
    how to consume the new context. Small prompt edit; do this BEFORE
    smoke testing so the mock runs against the same prompt structure
    the real runs will use.
  * Pre-registration: the directional predictions P1-P3 above need
    locking before any real run. Companion pre-reg memo to be drafted
    when this cell is greenlit.
  * Companion analysis script:
    `scripts/analyze-architecture-crossover.js` that runs
    analyze-strategy-shift + charisma scoring + v2.2 tutor scoring
    across cell_106, cell_115, cell_121, cell_122 and formats a 4-way
    comparison.

## Why this matters even if it produces a null

A null result (no composition gain) is interpretable here in a way that
nulls usually aren't. The two architectures externalise orthogonal
things — learner-state vs authored-self — and the prior expectation is
that orthogonal externalisations should compose additively. A null would
falsify that expectation, which is itself a paper-worthy finding because
it would constrain the space of architectures that the broader
"externalised cognition" literature points toward.

The trap to avoid is interpreting a null as "the crossover doesn't work
because of an implementation detail." Pre-registering P1-P3 before any
run, and pre-committing to the falsifying outcomes named above, makes
the null mean what it should mean.
