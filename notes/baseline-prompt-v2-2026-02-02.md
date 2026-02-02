# Baseline v2.0 — Change Log

Date: 2026-02-02
Files modified:
- `node_modules/@machinespirits/tutor-core/prompts/tutor-ego.md` (prompt changes)
- `services/evaluationRunner.js` (structured context injection)
Triggered by: eval-2026-02-01-f8734b08 variance analysis

## Motivation

The 2x2x2 factorial run (192 results, 3 reps per cell) revealed that base/single-agent
cells (cells 1-4) produce **bimodal output** — roughly half the time the tutor generates
context-aware responses (scored 70-100), and the other half it emits generic fallback
templates like "Begin your learning journey with the introductory lecture" (scored 4-15).

This creates extreme within-cell variance (SD 23-28) and a bimodal score distribution
that makes the base condition unreliable as a control. The generic fallbacks are not
"bad tutoring" in the sense of wrong pedagogical moves — they are **non-responses** that
show the model didn't process the learner context at all.

The recognition prompt (`tutor-ego-recognition.md`) doesn't have this problem because
its CRITICAL rules explicitly demand engagement with learner-specific data. The base
prompt's heuristics were too permissive — they described what to do for each learner
state but never mandated referencing the actual context.

## Design Principle

This change strengthens the base prompt's **context-grounding** without importing any
recognition-specific concepts (dialectical engagement, memory integration, repair, etc.).
The goal is a reliable baseline that consistently reads and responds to scenario context,
so the factorial design can cleanly measure what recognition/multi-agent add *on top of*
competent context-aware tutoring.

Without this fix, the factorial is partly measuring "does the model bother reading the
context?" rather than "does recognition/multi-agent improve tutoring quality?"

## Changes

### 1. Added "The Context-Grounding Rule (CRITICAL)" to `<decision_heuristics>`

Inserted as rule #2 (after Struggle Stop-Rule, before Momentum Rule).

```
**2. The Context-Grounding Rule (CRITICAL)**
EVERY suggestion you generate MUST demonstrate that you have read the learner context by:
- **Naming at least one specific signal** from the learner's data (e.g., "your 3 retries
  on the dialectics quiz", "you've been on this page for 12 minutes", "you completed
  lecture 2 last session")
- **Connecting your suggestion to that signal** (e.g., "those retries suggest the
  foundational concepts need reinforcement — let's revisit...")
- **Never producing generic advice** like "continue your learning journey" or "maintain
  learning momentum" — these indicate you have NOT read the context

IF you cannot identify a specific signal from the learner context, say so explicitly in
your reasoning field. Do NOT fill in with generic language.
```

**Rationale**: This is the minimal intervention to eliminate the fallback behavior. It
doesn't tell the model *how* to engage (that's what recognition adds) — it just requires
the model to prove it read the input. The "say so explicitly" fallback clause prevents
the model from masking a context-read failure with generic language.

### 2. Added context-blind examples to "BAD Suggestion" list

Added two new entries:

```
- **Context-blind defaults**: "Begin your learning journey with the introductory lecture"
  or "Continue your current module to maintain learning momentum" — these ignore ALL
  learner signals and are NEVER acceptable
- **Ignoring struggle signals**: If the learner has retry patterns or frustration signals,
  suggesting "continue" or "start from the beginning" shows you didn't read the context
```

**Rationale**: The bad-example list is a strong steering mechanism for instruction-following
models. Adding the exact fallback phrases we observed in the eval data makes them
recognizable as failure modes the model should avoid.

### 3. Added structured context summary injection in `services/evaluationRunner.js`

New function `structureLearnerContext()` inserted before the multi-turn utilities block.
Applied at both single-turn (line ~1045) and multi-turn (line ~1231) context paths.

The function parses the markdown learner context and prepends a `<structured_context_summary>`
XML block with explicitly labeled fields extracted from the prose. The original markdown
context is preserved in full below the summary.

**What it extracts** (when present in the scenario):
- Learner Type (new/returning, session count, event count)
- Current Content (lecture being viewed)
- Struggle Signals (count)
- Activity Retries (count)
- Primary Struggle (area/activity)
- Difficult Concepts
- Learner Messages (from chat history)
- Completed Lectures
- Time on Page
- Scroll Depth
- Average Score
- Activities Completed

**Example output for `struggling_learner`:**
```xml
<structured_context_summary>
Learner Type: Returning user, 3 sessions, 28 events
Current Content: 479-lecture-3 (Dialectical Learning)
Struggle Signals: 4 detected
Activity Retries: 3 retries
Primary Struggle: Activity quiz-479-3 (retried 3 times)
Difficult Concepts: dialectic, synthesis, thesis-antithesis
Completed Lectures: 479-lecture-1, 479-lecture-2
Time on Page: 12 minutes
Scroll Depth: 45%
</structured_context_summary>

### User Profile
- **Returning user** - 3 sessions, 28 total events
[... original markdown continues unchanged ...]
```

**Example for `mood_frustrated_explicit`:**
```xml
<structured_context_summary>
Learner Type: Returning user, 4 sessions, 35 events
Current Content: 479-lecture-3
Struggle Signals: 6 detected
Learner Messages: I've read this section three times and I still don't get it. This is so frustrating! | Why is this so hard to understand?
</structured_context_summary>
```

**Rationale**: XML tags are a strong attention anchor for instruction-following models.
By placing key signals in a labeled block at the top of the context, the model encounters
them before the longer prose. The original context is kept so the model can still draw
on details not captured in the summary (timeline events, tool usage, etc.). The function
gracefully degrades — if fewer than 2 fields are extractable (e.g., `new_user_first_visit`),
no summary block is added.

**Why not rewrite the YAML scenarios?** The scenarios are authored as realistic learner
profiles. Restructuring them would lose the naturalistic format that also tests whether
the tutor can read real-world context. The structured summary is an *additional* signal,
not a replacement.

### 4. Bug fix: superego never invoked for cells 3/4 (base+multi-agent)

**File**: `node_modules/@machinespirits/tutor-core/services/tutorDialogueEngine.js`

**Bug**: `resolveEvalProfile()` maps all `cell_*` profiles to either `budget` or
`recognition` in tutor-core. Cells 3/4 (`recognition_mode: false`) → `budget` profile,
which has `superego: null`. The `superegoReview()` function checked for a profile-level
superego config and early-returned with auto-approve *before* checking the `superegoModel`
override parameter. So even though the eval runner correctly extracted and passed the
superego model from the eval config, it was never used.

**Result**: Cells 3/4 were logged as `apiCalls: 1, dialogueRounds: 1` — identical to
single-agent cells. The entire Factor B (multi-agent tutor) for the base prompt condition
was effectively measuring single-agent behavior. This explains why cells 3/4 performed
nearly identically to cells 1/2 (42.9 vs 38.6).

**Fix**: When `superegoConfig` is null but `superegoModel` override is provided, bootstrap
a config from the `recognition` profile's superego as a template, then apply the model
override on top. This allows the dialogue loop to actually invoke the superego.

**Impact on previous results**: The ANOVA Factor B (multi-agent tutor) effect size
(eta²=0.069) was entirely driven by cells 7/8 (recognition+multi). With cells 3/4
fixed, the base+multi condition should show a real multi-agent effect, and the overall
Factor B effect size should increase.

## What was NOT changed

- No recognition-specific concepts added (no memory integration, dialectical engagement,
  repair rules, recognition checklist, etc.)
- No changes to the recognition prompt (`tutor-ego-recognition.md`)
- No architectural changes (single vs multi-agent path unchanged)
- The Struggle Stop-Rule, Momentum Rule, and Onboarding Rule are unchanged
- Output format, curriculum navigation, and research lab guidance unchanged
- The structured context summary applies to ALL cells equally (base and recognition),
  so it doesn't confound the factorial comparison — it raises the floor for all conditions
- Scenario YAML files unchanged — the summary is generated at runtime

## Expected Effect

- Base cells should produce fewer generic fallback responses
- Within-cell SD should decrease (less bimodal distribution)
- Base cell averages should increase (fewer ~10-point outliers)
- The gap between base and recognition cells may narrow somewhat, but recognition
  should still show advantage through *quality of engagement* (dialectical depth,
  memory references, repair) rather than *basic context awareness*
- Multi-agent effect may also narrow, since fewer bad outputs means fewer for the
  critic to catch — but multi-agent should still show advantage through refinement

## Verification Plan

Re-run the same factorial design:
```
node scripts/eval-cli.js run --skip-rubric --runs 3 --scenario struggling_learner,mood_frustrated_explicit,recognition_seeking_learner
node scripts/eval-cli.js evaluate <runId> --follow --verbose
```

Compare:
1. Within-cell SD for base cells (target: <20, was 23-28)
2. Proportion of results scoring <20 in base cells (target: <10%, was ~50%)
3. ANOVA effect sizes for Factor A (recognition) and Factor B (multi-agent)
