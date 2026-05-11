# State-Schema Ablation Cells — Design Memo (draft 2026-05-07)

## Why this exists

The N=24 follow-up (`a13-followup-N24-granular-results.md`) documented a
right-family-wrong-cousin signature: bilateral_tom (cell_115/117) clears
family-level recognition (70.8–79.2% family-match) but ties recognition-
only on strict label match (37.5%). Two reasonable hypotheses for this
pattern:

  **H1.** The structured `learnerProfile` (confidence, agencySignal,
  misconceptions, zpdEstimate, lastEvidence, plus the bilateral_tom ToM
  fields) is doing real work, but only at family granularity. Within-
  family discrimination is bottlenecked elsewhere — prompts, scenario
  cues, or the policy-action enum's coarseness.

  **H2.** Most of the structured profile is dead weight; the architecture
  reads only one or two dimensions (most likely confidence, since it
  directly gates `mockLLM.js`'s heuristics and is the most prompt-prominent
  field). The other dimensions are present but ignored.

These hypotheses make crossable predictions: stripping a load-bearing
dimension should drop strategy_shift_correctness by ≥10pp; stripping a
dead dimension should leave it unchanged.

## What gets ablated

The `learnerProfile` schema in `services/adaptiveTutor/stateSchema.js`
has these LLM-visible dimensions (per the realLLM prompt at
`services/adaptiveTutor/realLLM.js:533`, "agencySignal, confidence,
misconceptions, lastEvidence"):

  * `misconceptions` — array of strings; concrete misconception names
  * `confidence` — number in [0, 1]
  * `agencySignal` — enum: compliant / questioning / resistant /
    collaborative / unknown
  * `zpdEstimate` — short string describing zone of proximal development
  * `lastEvidence` — short string quoting dialogue evidence

`updatedAtTurn` is bookkeeping (used by `graph.js:190` for the
constraint-check gate); cannot be stripped without breaking the
constraint pathway.

`summaryText`, `hypothesizedLearnerPerceptionOfTutor`, and `tomProbes`
are bilateral_tom-only and are out of scope for this ablation (the
ablation targets the state_policy baseline, not the bilateral_tom branch).

## Three ablation cells

| Cell  | Name                                           | Profile fields the LLM sees                                | Strips                | Tests                                                                                                              |
| ----- | ---------------------------------------------- | ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 118   | `cell_118_state_policy_minimal_profile`        | `confidence`, `lastEvidence`                               | misconceptions, agencySignal, zpdEstimate | Floor case: how much accuracy survives with just confidence + the most recent evidence quote? Maximally aggressive ablation. |
| 119   | `cell_119_state_policy_no_misconceptions`      | `confidence`, `agencySignal`, `zpdEstimate`, `lastEvidence` | misconceptions        | Does the explicit misconception array carry within-family signal, or is it redundant with `lastEvidence`?         |
| 120   | `cell_120_state_policy_no_agency_signal`       | `confidence`, `misconceptions`, `zpdEstimate`, `lastEvidence` | agencySignal          | Does the 5-state agencySignal drive repair_affective discrimination? Predicted to drop on `affective_shutdown_v1`. |

Baseline for all three: **cell_110** (full state_policy with N=24).

`updatedAtTurn` and `lastEvidence` stay in all three because:
  * `updatedAtTurn` is required for `graph.js:190`'s constraint check
    (`if (state.learnerProfile.updatedAtTurn !== state.turn)`).
  * `lastEvidence` is the cheapest evidence anchor to keep prompt
    grounding intact; stripping it would conflate "which dimension
    matters" with "is the profile populated at all".

## Pre-registered predicted pattern

Predicted ordering on strict_shift_correctness, holding scenario set and
sample N constant:

  cell_110 (full) ≥ cell_119 (no misconceptions) ≥ cell_120 (no agency)
    ≥ cell_118 (minimal)                                  [H1 prediction]

  cell_110 ≈ cell_119 ≈ cell_120 ≈ cell_118               [H2 prediction]

Predicted family-specific drops (H1 with substantive content):

  * cell_120 (no agency) drops on repair_affective family scenarios
    (especially `affective_shutdown_v1`) by ≥15pp vs cell_110, but
    holds on substantive_engagement scenarios. Mechanism: agencySignal
    is the only field that flags affective shutdown without the LLM
    re-reading dialogue text.
  * cell_119 (no misconceptions) drops on substantive_engagement family
    scenarios where the right policy depends on remembering a specific
    misconception across turns (e.g., `metaphor_boundary_case_v1`,
    where the misconception "extends metaphor past valid range" needs
    to persist from turn 2 to turn 3). Predicted ≥10pp drop.
  * cell_118 (minimal) drops uniformly across families.

Falsifying outcomes:

  * If cell_118 ≈ cell_110 within ±5pp on strict_shift_correctness,
    H2 is supported and the structured profile beyond confidence is
    cosmetic. Important finding because it would mean the architecture's
    measured advantage over recognition-only (cell_111) is doing its work
    through a single scalar plus dialogue text — the externalised state
    machine is largely a placebo.
  * If cell_120 drops on substantive_engagement (where it shouldn't),
    agencySignal is doing more than affect-tracking — possibly serving
    as a general-purpose reminder of "what posture the learner is in",
    which would weaken the family-specific story.

## Sample size

24 runs/cell × 8 scenarios = 192 dialogues per cell. Three new cells =
576 dialogues total. Matches v1 follow-up sample. Consistency with the
v1 follow-up enables direct contrast against the cell_110 N=24 baseline
in the existing dataset.

## YAML stubs (config/tutor-agents.yaml)

To register, append the following blocks. Each cell uses
`provider: claude-code, model: sonnet` to match cell_110/115/116/117
(claude-code/sonnet was the cell_110 model in the N=24 follow-up;
matching it controls for the model-substitution caveat documented in
the followup memo §1).

```yaml
  # Ablation: state_policy with minimal profile (confidence + lastEvidence only).
  # Tests how much strategy_shift_correctness survives when the structured
  # profile is stripped to its scalar core. See
  # docs/explorations/claude/state-schema-ablation-design.md for hypotheses.
  cell_118_state_policy_minimal_profile:
    description: "State-schema ablation: state_policy with minimal profile (confidence + lastEvidence only). Strips misconceptions, agencySignal, zpdEstimate. Tests whether structured profile beyond confidence is doing real work (H1) or cosmetic (H2)."
    runner: adaptive
    factors:
      prompt_type: adaptive_state_policy_minimal_profile
      multi_agent_tutor: true
      multi_agent_learner: false
    learner_architecture: adaptive_externalised
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
      architecture: state_policy_minimal_profile
      hyperparameters:
        temperature: 0.6
        max_tokens: 1500
      counterfactual:
        enabled: true

  # Ablation: state_policy without misconceptions array.
  # Tests whether explicit misconception tracking carries within-family
  # signal beyond what lastEvidence's quoted-dialogue anchor provides.
  cell_119_state_policy_no_misconceptions:
    description: "State-schema ablation: state_policy without the misconceptions array. Profile keeps confidence, agencySignal, zpdEstimate, lastEvidence. Tests whether explicit misconception tracking is necessary or redundant with lastEvidence."
    runner: adaptive
    factors:
      prompt_type: adaptive_state_policy_no_misconceptions
      multi_agent_tutor: true
      multi_agent_learner: false
    learner_architecture: adaptive_externalised
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
      architecture: state_policy_no_misconceptions
      hyperparameters:
        temperature: 0.6
        max_tokens: 1500
      counterfactual:
        enabled: true

  # Ablation: state_policy with agencySignal forced to 'unknown'.
  # Tests whether the 5-state agency enum drives repair_affective
  # discrimination, or is redundant with confidence + dialogue text.
  cell_120_state_policy_no_agency_signal:
    description: "State-schema ablation: state_policy with agencySignal forced to 'unknown' constant. Profile keeps confidence, misconceptions, zpdEstimate, lastEvidence. Tests whether agency enum drives repair_affective discrimination."
    runner: adaptive
    factors:
      prompt_type: adaptive_state_policy_no_agency_signal
      multi_agent_tutor: true
      multi_agent_learner: false
    learner_architecture: adaptive_externalised
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
      architecture: state_policy_no_agency_signal
      hyperparameters:
        temperature: 0.6
        max_tokens: 1500
      counterfactual:
        enabled: true
```

Each cell name must also be appended to `EVAL_ONLY_PROFILES` in
`services/evaluationRunner.js` (~line 102). Without that, `resolveEvalProfile()`
silently falls back to the default profile — the documented failure mode.

## Code-change pointers

The ablation operates by populating only a subset of `learnerProfile`
fields and trusting the prompt to read what's there. The cleanest
implementation pattern stays close to the existing architecture-string
dispatch already established for `recognition_only` /
`recognition_named_patterns` / `bilateral_tom` etc.

### File 1: `services/adaptiveTutor/graph.js`

Add three entries to `SUPPORTED_ARCHITECTURES` (line 68-77):

```diff
 const SUPPORTED_ARCHITECTURES = Object.freeze([
   'recognition_only',
   'recognition_named_patterns',
   'ego_superego',
   'state_policy',
   'state_policy_with_validator',
+  'state_policy_minimal_profile',
+  'state_policy_no_misconceptions',
+  'state_policy_no_agency_signal',
   'bilateral_tom',
   'bilateral_tom_named_patterns',
 ]);
```

The graph topology for all three ablation variants is identical to
`state_policy`. The behavioural difference is at the
`learnerProfileUpdate` node (line 87-99), which currently writes every
field returned by the LLM. We need to project the returned profile to
the subset of fields each variant exposes. Concretely:

```diff
 async function learnerProfileUpdate(state) {
   const learnerLastMessage = lastTextOf(state.dialogue, 'learner');
   const profile = await callRole('learnerProfileUpdate', {
     learnerLastMessage,
     hidden: state.hiddenLearnerState,
     currentProfile: state.learnerProfile,
     turn: state.turn,
   });
+  // Per-architecture profile projection. Architectures without an entry
+  // here keep the full profile.
+  const projected = projectProfileForArchitecture(profile, state.architecture);
-  return { learnerProfile: { ...profile, updatedAtTurn: state.turn } };
+  return { learnerProfile: { ...projected, updatedAtTurn: state.turn } };
 }
```

`state.architecture` needs to be plumbed onto the state (or carried as a
graph-construction-time closure variable; either is fine — closure is
simpler since `buildGraph(architecture, …)` already takes it).

The projection helper, in the same file:

```javascript
const PROFILE_PROJECTIONS = {
  state_policy_minimal_profile: ['confidence', 'lastEvidence'],
  state_policy_no_misconceptions: ['confidence', 'agencySignal', 'zpdEstimate', 'lastEvidence'],
  state_policy_no_agency_signal: ['confidence', 'misconceptions', 'zpdEstimate', 'lastEvidence'],
};

function projectProfileForArchitecture(profile, architecture) {
  const keep = PROFILE_PROJECTIONS[architecture];
  if (!keep) return profile;  // no projection — full profile
  const out = { agencySignal: 'unknown', misconceptions: [], zpdEstimate: '', summaryText: '' };
  for (const k of keep) out[k] = profile[k];
  // confidence is required by the schema; default mid-range if dropped.
  if (!('confidence' in out)) out.confidence = 0.5;
  return out;
}
```

Defaults match the schema `.default()` values in `stateSchema.js` — no
schema migration needed.

### File 2: `services/adaptiveTutor/realLLM.js`

The tutor ego prompt at line 533 enumerates the profile fields it expects
("agencySignal, confidence, misconceptions, lastEvidence"). When fields
are projected away the prompt still mentions them, which would invite
the LLM to imagine values for the missing fields. Two options:

**Option A (minimal change):** keep the prompt unchanged. Stripped fields
become `agencySignal: 'unknown'`, `misconceptions: []`, etc., which the
prompt already handles ("if the field is empty / unknown, do not infer").
This is the cheapest path and preserves the contract.

**Option B (cleaner):** add a per-architecture prompt that lists only the
fields the architecture exposes. Cleaner attribution but increases prompt
surface area. Recommended only if Option A produces an LLM that
hallucinates values for stripped fields — verify with mock-mode smoke
first.

Default to Option A. Switch to Option B if mock smoke shows hallucinated
agencySignal / misconceptions when those are stripped.

### File 3: `services/adaptiveTutor/runner.js`

Line 27-28 has an architecture allowlist for emitting tom_accuracy fields.
Verify the new three architectures don't accidentally trigger that branch.
The new architectures should NOT emit ToM scoring (they're not bilateral
variants), so no change needed — but worth a one-line sanity check during
implementation.

### File 4: `services/evaluationRunner.js`

Append to `EVAL_ONLY_PROFILES` (~line 102):

```diff
   'cell_117_bilateral_tom_named_patterns',
+  'cell_118_state_policy_minimal_profile',
+  'cell_119_state_policy_no_misconceptions',
+  'cell_120_state_policy_no_agency_signal',
```

### Smoke testing before any paid run

Mock-mode smoke (no API cost):

```bash
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js cell_118_state_policy_minimal_profile
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js cell_119_state_policy_no_misconceptions
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js cell_120_state_policy_no_agency_signal
```

Verify each persists `id_construction_trace` rows and that the projected
profile fields appear correctly in the trace. Then a 1-run hermetic pass:

```bash
EVAL_DB_PATH=$(mktemp -d)/test.db EVAL_LOGS_DIR=$(mktemp -d) \
  node scripts/eval-cli.js run --profiles cell_118_state_policy_minimal_profile --runs 1
```

Only after both pass should the N=24 paid run be launched.

## Cost estimate

Single tutor turn cost on cell_110/115 with sonnet: ~3¢ avg (per
existing runs). state_policy is the most expensive variant. Three cells
× 192 dialogues × ~4 turns × 4 LLM calls per turn (profile + ego +
superego + revision) ≈ ~$90 raw call cost. Plus rubric scoring downstream
(~$30). Total: ≈ $120 for the full ablation. Within the same envelope as
the v1 follow-up.

## Open items

  * Decide between Option A (minimal prompt change) vs Option B (per-
    architecture prompts) after mock-mode smoke. Default A.
  * Should the projection be done at the Zod parse step (cleaner) or at
    the graph node (simpler)? Graph-node projection chosen above for
    minimal blast radius; revisit if prompt hallucinations are observed.
  * Pre-registration: lock the directional predictions above before any
    real run. The H1 vs H2 contrast is the central claim and must be
    pre-committed.
  * Companion analysis script: `scripts/analyze-state-schema-ablation.js`
    that runs analyze-strategy-shift across cell_110, 118, 119, 120 and
    formats a 4-way comparison with per-family breakdowns. To be drafted
    when the runs land.
