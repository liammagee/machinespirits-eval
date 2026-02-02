# Baseline v3.0 — Change Log

Date: 2026-02-02
Predecessor: baseline-prompt-v2-2026-02-02.md
Files modified:
- `node_modules/@machinespirits/tutor-core/prompts/tutor-ego.md` (prompt restructure)
- `services/evaluationRunner.js` (structured context injection strengthened)
Triggered by: eval-2026-02-01-894a4308 showed v2 changes had no effect on fallback rate

## Motivation

Baseline v2 added a Context-Grounding Rule at position #2 in `<decision_heuristics>` and
prepended a `<structured_context_summary>` XML block to the learner context. Analysis of
run 894a4308 (the first run after v2) showed these changes had **no measurable effect**:

- Sub-20 score rate in base cells: 54-71% (before) → 56-67% (after) — within noise
- Within-cell SD: 23-28 (before) → 27-32 (after) — no improvement
- The bimodal pattern persists: ~2/3 of outputs are generic templates or hallucinated
  content (wrong course names, placeholder text), ~1/3 are context-aware responses

The model (kimi-k2.5) is ignoring the context-grounding rule because it is buried at
rule #2 inside `<decision_heuristics>`, after 50+ lines of agent identity and learner
analysis framework. By the time the model reaches it, the instruction has low salience
relative to the surrounding template examples and structural patterns that invite
template-filling behavior.

## Design Principle

Same as v2: strengthen context-grounding without importing recognition-specific concepts.
The change is **structural** — moving the grounding mandate to the top of the prompt where
it has maximum salience — and **rhetorical** — using stronger failure-mode language that
the model can pattern-match against its own outputs.

## Changes

### 1. Added `<context_grounding_mandate>` block at TOP of prompt

Inserted as the very first section after the `# AI Tutor - Ego Agent` heading, before
`<agent_identity>`. This is now the first substantive instruction the model encounters.

The block includes:
- **MANDATORY** label with numbered requirements (name a signal, connect to it, use real IDs)
- **NEVER PRODUCE** list with exact fallback phrases observed in eval data:
  - "Begin your learning journey with the introductory lecture"
  - "Continue your current module to maintain learning momentum"
  - "Start: Lecture Name" / "Message: Description" (literal placeholder text)
  - Any suggestion that could apply to ANY learner
- Explicit instruction to reference `<structured_context_summary>` signals by name
- Fallback: if context is unreadable, write "CONTEXT UNREADABLE" instead of generic output

**Rationale**: Instruction-following models weight early-prompt instructions more heavily.
The v2 rule at position #2 in decision_heuristics was ~70 lines deep and sandwiched between
template examples — exactly the kind of context that invites template reproduction. Moving
the mandate to line 3 of the prompt makes it the model's primary frame for the task.

The "NEVER PRODUCE" list with exact observed fallback phrases is a stronger signal than
v2's abstract prohibition of "generic advice." Models are better at avoiding specific
strings they've been shown than avoiding vague categories.

### 2. Strengthened structured context injection header

Changed the `<structured_context_summary>` block to include:
- Warning emoji prefix: `⚠️ YOU MUST REFERENCE AT LEAST ONE OF THESE SIGNALS BY NAME`
- Post-block instruction: `Your suggestion MUST mention specific data from the summary above.`

Before (v2):
```
<structured_context_summary>
Learner Type: Returning user, 3 sessions, 28 events
...
</structured_context_summary>

### User Profile
[original markdown]
```

After (v3):
```
⚠️ YOU MUST REFERENCE AT LEAST ONE OF THESE SIGNALS BY NAME IN YOUR SUGGESTION:
<structured_context_summary>
Learner Type: Returning user, 3 sessions, 28 events
...
</structured_context_summary>
Your suggestion MUST mention specific data from the summary above. Generic responses are WRONG.

### User Profile
[original markdown]
```

**Rationale**: The v2 XML block was presented as data, not as an instruction. The model
treated it as optional context rather than a requirement. Wrapping it with explicit
directives and failure language creates a instruction-data-instruction sandwich that is
harder for the model to ignore.

### 3. Retained the v2 Context-Grounding Rule at position #2

The rule in `<decision_heuristics>` is kept as-is for reinforcement. The top-level mandate
and the heuristic rule now say the same thing in two places — belt and suspenders.

## What was NOT changed

- The v2 Context-Grounding Rule in `<decision_heuristics>` is unchanged (kept for reinforcement)
- The v2 bad-example additions are unchanged
- No recognition-specific concepts added
- No changes to recognition prompts (`tutor-ego-recognition.md`)
- No architectural changes
- Scenario YAML files unchanged
- The structured context summary applies to ALL cells equally

## Observed failure modes this targets

From eval-2026-02-01-894a4308, base cells 1-4:

1. **Literal placeholder text**: `Title: "Start: Lecture Name"`, `Message: "Description"`,
   `Reasoning: "Why this suggestion"` — the model reproduced the template structure without
   filling it in. The v3 NEVER PRODUCE list explicitly names this pattern.

2. **Hallucinated wrong-course content**: `Continue: Introduction to Data Structures` /
   `Start: Course Introduction` with fabricated IDs like `101-lecture-1`. The model invented
   content that doesn't exist in the curriculum. The v3 mandate requires using IDs from the
   curriculum context.

3. **Generic context-blind advice**: `Continue Your Learning Journey` / `Based on your
   progress, we recommend reviewing recent material`. These ignore all structured signals.
   Named explicitly in the NEVER PRODUCE list.

## Expected Effect

- The top-of-prompt mandate should significantly reduce generic fallbacks for models that
  weight early instructions heavily
- The explicit NEVER PRODUCE list should prevent the most common failure patterns
- The strengthened structured context header should make the signals impossible to miss
- If kimi-k2.5 still produces generic output at high rates after these changes, the
  conclusion is that this model cannot reliably follow context-grounding instructions
  regardless of prompt structure, and a different model is needed for baseline cells

## Verification Plan

Re-run the same 3-scenario subset:
```
node scripts/eval-cli.js run --skip-rubric --runs 3 --scenario struggling_learner,mood_frustrated_explicit,recognition_seeking_learner
node scripts/eval-cli.js evaluate <runId> --follow --verbose
```

Compare against 894a4308:
1. Sub-20 score rate in base cells (target: <25%, was 56-67%)
2. Within-cell SD for base cells (target: <20, was 27-32)
3. Absence of placeholder text in suggestions
4. Presence of specific learner signals referenced in suggestions

## Addendum: v3.1 — Task block fix in tutorDialogueEngine.js

**File**: `node_modules/@machinespirits/tutor-core/services/tutorDialogueEngine.js`

**Problem discovered**: Runs c4e9ddc3 and db7b79e5 showed the v3 prompt changes had
no effect. Base cells still produced hallucinated content ("Python Basics",
"Data Science", "Diagnostic Assessment") with fabricated IDs ("101-lecture-1",
"learner-001"). The model was ignoring the structured context entirely.

**Root cause**: The `egoGenerateSuggestions()` function appends a "Your Task" block
AFTER the learner context and curriculum. This block contained:
- `"Have a title like 'Start: [Lecture Title]'"` — teaching the model to produce
  the exact template patterns we were trying to eliminate
- `"Have a message explaining what the lecture covers"` — encouraging generic
  content descriptions instead of learner-specific responses
- `"This is a RETURNING USER - suggest the next lecture they haven't completed"` —
  overriding the Struggle Stop-Rule with a blanket "advance" instruction

Because this task block appears LAST in the prompt (after all context), it has
the highest salience for instruction-following models. The v3 context-grounding
mandate at the TOP of tutor-ego.md was being overridden by these contradictory
instructions at the BOTTOM.

**Fix**: Replaced the generic task template with context-aware instructions:
- For returning users: requires referencing specific learner data, following
  decision heuristics, and using exact curriculum IDs
- Added CRITICAL CONSTRAINTS block forbidding invented IDs, off-curriculum content,
  and "Start:/Continue:" titles when struggle signals are present
- Removed the template patterns ("Start: [Lecture Title]") that were being
  reproduced verbatim by the model
- Preserved new-user path unchanged (first lecture suggestion is correct there)

**Why this should work**: The fix removes the conflicting instruction that was
overriding all upstream prompt changes. The model now receives consistent
instructions: top-of-prompt mandate says "reference learner signals", end-of-prompt
task says "reference learner signals" — no contradiction.
