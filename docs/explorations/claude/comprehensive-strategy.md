# Comprehensive architectural renovation: Hegel/Freud/Weber as architectural primitives

**Date drafted:** 2026-04-30
**Approved & adjudicated:** 2026-05-01 — Ultraplan refinement of Phase 1 engineering detail merged; two flagged conflicts (LiteLLM placement, Gate B sample size) adjudicated. See Phase 1 §"Adjudicated decisions" subsection for the resolved positions.
**Status:** Canonical strategy + execution roadmap. Supersedes the immediate-term portion of `docs/explorations/claude/consolidated-plan.md`; that document remains the canonical short-horizon execution roadmap and is updated in lockstep with this strategy.
**Provenance:** Drafted in plan mode at `~/.claude/plans/reactive-stargazing-neumann.md`.

---

## Context

The current paper documents a clean null on adaptive responsiveness. The companion appendix rewrite (`docs/research/machinagogy_appendix_rewrite_v0_1.md`) frames the supported mechanisms as **calibration** (recognition narrows variance, raises floor) and **error correction** (superego catches defects on baseline prompts, but with diminishing marginal value under recognition). Adaptive responsiveness — the tutor changing strategy in response to learner-specific signals across turns — was *not* supported.

The LangGraph adaptive cell (`cell_110_langgraph_adaptive`, shipped on `experiment/langgraph-adaptive`) is the first architectural attempt to close that gap. It externalises the learner state, registers a recognition state machine, and writes counterfactual-divergence metrics. The mock smoke passes; the real-LLM A13 run (Gate B in the consolidated plan) is the next gate.

This strategy goes further. It turns the three theoretical lenses the project carries — Hegelian recognition, Freudian internal dialectic, Weberian charisma — from *prompt themes* into *architectural primitives* with measurable side-effects. It also commits to a different evaluation discipline: less brute-force ablation, more strategic single runs that look for qualitative differentiation, with the test harness scaling only after the architectural primitives have demonstrated signal.

The literature corpus downloaded into `docs/explorations/literature/pdfs/` (verified locally — KT, ToM, agents, memory all present) provides the technical apparatus. The framework analysis (`docs/explorations/claude/agents/agent-framework-analysis.md`) provides the substrate decisions: stay LangGraph; hybridize with XState (FSM), LiteLLM (multi-provider + cost), Inspect AI (Python eval sidecar); lift small patterns from Generative Agents, Voyager, Letta, Burr, Claude Agent SDK. Nothing in this strategy re-litigates those decisions.

What this strategy does *not* settle: cross-session adaptation (deferred to Phase 4); whether the philosophical framing carries empirical weight beyond conceptual organisation (testable by recognition-vs-neutral-framed contrast cells, queued for after Phase 3); the fate of the existing 90-cell sweep (treated as baseline contrast body, not deprecated).

---

## Three theoretical primitives, made architectural

Each insight is operationalised as a concrete component with its own state, interface, and measurable side-effect. The user's verbatim formulations from the planning conversation are preserved as the anchor for each primitive.

### Freudian primitive — Multi-role internal dialectic

> *"internal dialogue between multiple roles can improve upon single agent simulated thinking via effective dialectical collaboration between different perspectives"*

**Existing scaffolding:** `services/learnerTutorInteractionEngine.js:1100–1227` runs the learner-side ego/superego/ego-revision loop today. The tutor side runs the same pattern via `tutor-core`. `services/adaptiveTutor/graph.js` has `tutorEgoInitial → tutorSuperegoReview → constraintCheck → tutorEgoRevision → tutorEmit` (verified by exploration).

**Extension (Phase 3):** the Psyche-v2 stack from `docs/explorations/gpt-pro/01-adaptive-recognition-psyche-architecture.md` §5 — `realityAgent`, `idAgent`, `superegoAgent`, `otherEgoAgent`, `egoMediator`, `responseGenerator`, `workingThroughMemory` — added behind feature flag, gated on Phase 2 results. Each agent specializes against a specific failure mode (gpt-pro §5.1 table). The `idAgent` is acknowledged as Tree-of-Thoughts with Freudian framing (synthesis §5 critique #2); the framing remains as conceptual organisation, not a metaphysical claim.

**Strict non-leakage rule preserved.** Each new role gets a fixture in `services/adaptiveTutor/mockLLM.js` (which already follows a `callRole(role, payload)` contract — trivial to extend) and a JSON-schema + system-prompt in `realLLM.js`. Internal deliberation MUST NOT appear in learner-facing output. Leakage rate is one of the A14 stop conditions.

### Hegelian primitive — Bilateral mutual-recognition state machine

> *"recognition leads each subject out of its solipsism towards self-consciousness, the precondition for genuine learning"*

**Existing scaffolding:** the adaptive cell already has `learnerProfile` + `hiddenLearnerState` (verified — `services/adaptiveTutor/stateSchema.js`). The bilateral learner with its own ego/superego exists in `learnerTutorInteractionEngine.js`. Cell 110 currently runs against scripted learner turns from `config/adaptive-trap-scenarios.yaml`; the bilateral dynamic learner is unused for that cell.

**Extension (Phase 2 pilot 2):** introduce true bilateral theory of mind. Each side maintains *two* state objects:

- Tutor state: `ownState` + `hypothesizedLearnerState` (already exists as `learnerProfile`) + new `hypothesizedLearnerPerceptionOfTutor`.
- Learner state: `ownState` + new `hypothesizedTutorState` + new `hypothesizedTutorPerceptionOfLearner`.

The recognition primitive becomes the *agreement* between (a) what the tutor thinks the learner thinks, and (b) what the learner actually thinks. **ToM accuracy** = match-rate between tutor's `hypothesizedLearnerState` and learner's `ownState` at trigger turns.

**State format (per Language Bottleneck Models pattern, verified spot-check):** each `hypothesizedXState` is a *paired* representation — a short natural-language paragraph (the "bottleneck" — interpretable, judge-able) plus a structured JSON object (the queryable state). Full rewrite per turn, not delta — LBM showed deltas haven't been validated; rewrite is also more auditable. Implementation cost is small because the existing `learnerProfile` is already JSON; the addition is a paired text summary plus the second-order belief field.

**Caveats from FANToM (verified spot-check):** LLMs exhibit "illusory ToM" — they answer coherently but fail to track distinct mental states across multiple reasoning types. Mitigation: enforce structured consistency by scoring tutor's `hypothesizedLearnerState` against four FANToM-style probes per scenario (BELIEF[DIST], BELIEF[CHOICE], ANSWERABILITY[LIST], INFOACCESS[LIST]). Cheap; cross-validates the bottleneck text against the JSON state.

**Recognition state machine** (per gpt-pro §4.1, with refinement): 6 states — `explore → diagnose → repair → consolidate → stretch → fade`. Implemented as XState FSM (per agent-framework-analysis.md §6.7 hybridization). Half-day spike before commitment to confirm XState gives meaningful ergonomic / visualization wins over LangGraph's conditional edges; if it doesn't, stay in LangGraph and skip the dependency. Transition guards reference `hypothesizedLearnerState` deltas.

### Weberian primitive — Charismatic anti-recognition (genuinely novel)

> *"charisma can alternate intersubjective dynamics from overly 'neurotic' (in the sense that a Hegelian concern with recognition might lead towards eventual unproductive hyper-empathy) to a kind of deliberately staged anti-recognitive projective performance that, despite its narcissistic tendencies, can also lead to pedagogical breakthroughs"*

**Why this is novel work, not a literature redress:** the Tutor Move Taxonomy paper (Zhou et al. 2026, verified spot-check) catalogues 26 moves across 4 categories — *all are empathetically contingent on learner state.* No category for deliberately staged non-recognition exists. Weberian charisma in tutoring is genuinely original architectural design, not a refinement of an existing pedagogical primitive.

**Architectural components (Phase 2 pilot 3):**

1. **Stagnation detector** — cheap heuristic that fires when *all* of these hold for the current dialogue:
   - ≥3 consecutive turns with same `policyAction`
   - Within-action token-Jaccard overlap > 0.6 (i.e., the "refinement proxy" from `analyze-strategy-shift.js` indicates the question is not even getting sharper)
   - `hypothesizedLearnerState` JSON delta is empty (tutor's belief about the learner is not updating)
   - No new `hypothesizedTutorState` deltas on the learner side either (learner's belief about the tutor is not updating)
   This is the operational definition of "neurotic hyper-empathy" — a recognition loop that has converged to mutual confirmation without movement.

2. **Charisma actions** — a *new* class of policy actions extending the 14 in `services/adaptiveTutor/policyActions.js`:
   - `confident_assertion` — tutor asserts a substantive claim about the topic without first soliciting learner agreement
   - `ideal_projection` — tutor describes a vision of mastery the learner is not yet at, as a horizon
   - `productive_provocation` — tutor names a tension or counterposition the learner hasn't yet voiced
   - `staged_disagreement` — tutor adopts a position the tutor doesn't endorse, to surface learner reasoning

3. **Charisma trigger node** — sits between `tutorSuperegoReview` and `tutorEmit` in the graph. When the stagnation detector fires, the policy action set is *temporarily expanded* to include the charisma actions, and the ego is re-invoked with a "charisma admissible" flag. Risk: narcissism / abuse. Bounded by:
   - Superego veto: the existing `tutorSuperegoReview` retains hard veto on charisma actions deemed harmful
   - Frequency cap: ≤1 charisma trigger per 5 turns per dialogue
   - Logged separately in `perTurn[].charismaTrigger` for human inspection (no schema break — exploration confirmed new fields are ignored by current analyzer)

4. **Charisma effectiveness metric** — for each fired trigger, measure: (a) did `hypothesizedLearnerState` delta become non-empty in the next 2 turns? (b) did the learner's `ownState` move (productive struggle, repair, or breakthrough)? (c) human inspection at packet time: did this read as charismatic intervention or as tutor-ego inflation?

**Falsification path:** if charisma triggers fire but produce no measurable downstream learner-state movement, OR if humans judge >40% of triggers as ego inflation rather than productive intervention, the primitive is rejected. The framing in the paper would then be that *the literature is right* — pedagogically effective tutor moves are contingent, full stop. That negative result is paper-worthy.

---

## Knowledge tracing as the externalised belief substrate

The CIKT pattern (verified spot-check: Analyst produces free-text profile; Predictor consumes profile + interaction tuple; iterative loop is essential per their ablation) maps onto the existing tutor ego/superego split with one important distinction: in the project today, the superego critiques the ego's *output*. CIKT's analyst produces the profile that the predictor *consumes*. Adopt the CIKT pattern as the architecture for the state-update node only:

- `learnerProfileUpdate` node (already exists) becomes a CIKT-style Analyst.
- Output: paired JSON state + natural-language bottleneck (LBM pattern).
- Iterative refinement *within a single turn* is the lift — Analyst output becomes Predictor input becomes refined Analyst output, capped at 2 iterations per turn.
- KTO training is **NOT** lifted — out of scope; inference-only pattern is acknowledged as a deviation from CIKT, with an open question about whether iteration without preference learning is enough. (Alternative if iteration is too brittle: drop iteration, keep paired-state format.)

**This is small.** The existing `services/adaptiveTutor/llm.js` already routes by role; adding an `analystRefinement` role is one fixture in mockLLM + one schema in realLLM.

---

## Memory: working-through, durably typed

The exploration confirmed `services/memory/learnerMemoryService.js` defines SQLite tables for `learner_memory`, `concept_states`, `episodes`, `threads`, `personal_definitions`, `connections`, `learner_preferences`, `learning_milestones` — but they are not yet wired into agent prompts. This is a half-built scaffold worth completing.

**Phase 3 work:** wire those tables into the renovated tutor's working-through memory (gpt-pro §4.9). Pattern lifted from Generative Agents (`docs/explorations/literature/pdfs/05-llm-agents/2304.03442_generative-agents-interactive-simulacra-of-human-behavior.pdf`) — recency × importance × relevance retrieval scoring, ~50 LOC. Letta-style typed memory blocks for write paths. Within-dialogue first; cross-session in Phase 4.

**What it stores:** prediction errors, repair episodes, charisma triggers and outcomes, breakthrough moments, ToM-failure cases (where tutor's hypothesizedLearnerState diverged sharply from actual). Not generic conversation summaries.

---

## Revitalized evaluation framework

### Core principle

Per the user's directive: *"less brute force ablative study, more single but strategic runs that look for qualitative differentiation."* The pilot phase explicitly avoids the 90-cell sweep style. Each pilot run = 1 condition × 8 trap scenarios × 3 runs × 1 frontier model + human inspection of all dialogues. Total per pilot ≈ 24 dialogues — small enough to read every one.

### Five pilot runs (one per architectural primitive)

| # | Tests | Cell IDs | Primary endpoint | Predeclared threshold | Stop condition |
|---|---|---|---|---|---|
| **P1** | A13 baseline (the gated next step from consolidated-plan) | `cell_110` (C3) vs new `cell_111` (C1, recognition-only baseline against trap scenarios) vs new `cell_112` (C2, current ego/superego against trap scenarios) | `strategy_shift_correctness` | C3 ≥25 pp over C1 and ≥15 pp over C2; ≥70% genuine on human inspection | Internal leakage >5%, OR strategy-shift can't be reliably scored |
| **P2** | Bilateral ToM (Hegelian primitive) | new `cell_115_bilateral_tom` (extends C3 with paired hypothesizedLearnerState + reactivates dynamic bilateral learner with hypothesizedTutorState) | `tom_accuracy` (FANToM-style 4-probe match rate at trigger turns) | ≥0.6 mean accuracy across scenarios; conditional Δ in `strategy_shift_correctness` ≥10 pp over P1 baseline | ToM accuracy <0.4 (illusory-ToM regime per FANToM lit) |
| **P3** | Charisma intervention (Weberian primitive) | new `cell_116_charisma` (extends P2 cell with stagnation detector + charisma action set) — and 2 *new* trap scenarios specifically designed to provoke stagnation | `charisma_effectiveness` (fraction of fired triggers followed by non-empty learner-state delta within 2 turns) | ≥0.5 effectiveness; ≤40% of triggers judged as ego inflation by human inspection | Charisma fires <2 times across all pilot dialogues (signal too rare to evaluate) |
| **P4** | CIKT-pattern KT (knowledge tracing) | new `cell_117_cikt_state` (replaces single-shot `learnerProfileUpdate` with 2-iteration Analyst↔Predictor) | `state_update_accuracy` (LLM-judged match between iterated profile and post-hoc-correct profile) | ≥10 pp over single-shot baseline; OR clear qualitative win on human inspection | No measurable difference + human inspection finds iterations cosmetic |
| **P5** | Combined renovation (Psyche-v2 + bilateral ToM + charisma + KT) | new `cell_118_psyche_v2_full` | `strategy_shift_correctness` AND `bilateral_transformationIndex` | C5 ≥10 pp over best-of-P2/P3/P4 cell; coupling rubric ≥3.0/4.0; leakage ≤5% | Cost overrun, OR diminishing returns vs cheaper P2-P4 cells |

P5 only happens if at least 2 of P2/P3/P4 show signal. If only P1 shows signal and the rest are null, the architectural primitives are individually too weak and the project pivots to Strategy 4 (substrate change) per Gate C of the consolidated plan.

### Methodological additions

- **Inspect AI Python sidecar** (per agent-framework-analysis.md §5): each pilot's primary metric is *also* implementable as an Inspect AI task. Lift A13 + ToM + charisma scorers there. Goal: cross-validation against an industry-standard harness; not replacing the JS analyzer. Effort: ~150-200 LOC Python.
- **MathTutorBench / MRBench transfer test**: take the strongest pilot cell, re-judge a sample of its dialogues against the BEA 2025 8-dim rubric (`pdfs/07-llm-as-judge/2507.10579_bea-2025-shared-task-on-pedagogical-ability-assessment-of-ai-powered-tutors.pdf`). Tests whether our internal rubric scores agree with external benchmarks. Cheap.
- **Bridge / MathDial cross-corpus probe**: take the strongest pilot cell, run it against a sample from `docs/explorations/literature/pdfs/08-educational-datasets/` corpora. Tests whether the architecture transfers off-distribution from our trap scenarios. Cheaper than re-running everything; load-bearing for external validity.
- **Multi-judge jury** (per `pdfs/07-llm-as-judge/2602.16610_who-can-we-trust-llm-as-a-jury-for-comparative-assessment.pdf`): for the P5 (combined) cell only, score with 3-judge jury (Sonnet 4.6, GPT-5.x, Gemini-class) with reliability weighting. Justifies any paper claim about the combined renovation.
- **Human inspection packet** before any paper claim — non-negotiable. Encoded as a hard gate in the workflow, not a recommendation.

### Stop conditions, encoded as runtime checks

- Cost ceiling per pilot exceeded → halt the run (already P0 of consolidated-plan)
- Internal leakage > 5% in any condition → halt that condition, do not score
- Strategy-shift can't be reliably scored (e.g., expected_strategy_shift returns nulls) → halt and revise rubric, don't paper-over with judgement calls
- Charisma triggers fire <2 times across all pilot dialogues → P3 is inconclusive, not "negative" — flag as needing more provocative scenarios

### Scale phase (Phase 4 — long horizon, post-Phase-3)

Only after the pilot phase resolves which primitives are real does the test harness scale up. At that point: Inspect AI as primary harness, multi-judge jury default, larger N per cell, cross-session adaptation as a new dimension. Until then, deliberately small.

---

## Implementation sequence

Phasing is gated, not parallel. Each phase produces a result that determines whether the next phase is worth building. Phases nest cleanly inside the consolidated-plan's gate structure; Phase 1 below = Gates A→B; Phase 2 = Gate D content broken into smaller pilots; Phase 3 = full renovation; Phase 4 = scale.

### Phase 1 — A13 prerequisites + Gate B (next ~2 weeks)

> Engineering detail in this section was sharpened by Ultraplan refinement on 2026-05-01 and adjudicated the same day; see §"Adjudicated decisions" subsection at end. Cell IDs and high-level approach unchanged from the original draft.

These are already P0 in `consolidated-plan.md`; restated here so this strategy is self-contained.

**Dependency shape** — item 1 must precede any real-LLM call; items 2–4 are independent of each other; item 5 needs items 3 and 4 to be useful (C4 reads richer policy cues; analyzer scores against richer scenario fields):

```
                ┌──────────────────────────────┐
                │ 1. cost-ceiling guard        │  must precede any real-LLM call
                │    (services/adaptiveTutor/  │
                │     realLLM.js +             │
                │     scripts/eval-cli.js)     │
                └──────────────┬───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
 ┌───────────────┐   ┌──────────────────┐   ┌───────────────────────────┐
 │ 2. pre-reg    │   │ 3. policy-actions│   │ 4. scenario completeness  │
 │    doc        │   │    YAML +        │   │    (failure_mode,         │
 │    (locks Q,  │   │    loader        │   │     success_criteria)     │
 │     budget,   │   │    (richer cues  │   │    (analyzer can score    │
 │     thresh)   │   │     for real-LLM)│   │     repair, uptake later) │
 └───────┬───────┘   └────────┬─────────┘   └────────────┬──────────────┘
         │                    │                          │
         └────────────────────┼──────────────────────────┘
                              ▼
                 ┌──────────────────────────────┐
                 │ 5. A13 condition cells       │
                 │    cell_111 (C1: recog only) │
                 │    cell_112 (C2: ego/super)  │
                 │    cell_113 (C4: + validator)│
                 │    (cell_110 is C3)          │
                 └──────────────┬───────────────┘
                                ▼
                       ┌─────────────────┐
                       │ Gate B run      │
                       │ small-N smoke,  │
                       │ then full A13   │
                       └─────────────────┘
```

#### 1. Cost-ceiling guard (must precede any real-LLM call)

The current `ADAPTIVE_TUTOR_LLM=real` path has no budget. A misconfigured run with frontier models on 8 scenarios × 4 turns × 4 LLM roles per turn × counterfactual replay can quietly burn through hundreds of dollars.

**Approach.** Use building blocks already present; **don't introduce LiteLLM yet** (deferred per §"Adjudicated decisions" below). `tutor-core`'s `callAI` already returns flat `inputTokens`, `outputTokens`, `cost` per call (canonical access pattern at `services/idDirectorEngine.js:874–879`). Budget-guard wrapper around `realLLM.callRole`:

- Accumulate per-role usage in a run-scoped accumulator.
- Pre-call estimate: cheap tokenizer (use `gpt-tokenizer` if already in deps, else 4-chars-per-token heuristic — ±20% accuracy is fine for an abort gate). Multiply by `cost_per_input_token` from `config/providers.yaml` for the selected model. Reserve for output tokens at the configured `max_tokens`.
- If `accumulated + estimated > maxCostUsd`, throw before issuing the call.

**Files.**
- `services/adaptiveTutor/realLLM.js` — wrap `callRole` to accept budget tracker, update post-call from `raw.inputTokens` / `raw.outputTokens` / `raw.cost`, pre-call gate.
- `services/adaptiveTutor/index.js` — instantiate tracker per run; thread into runner.
- `services/adaptiveTutor/runner.js` — pass tracker through `runScenario` / `runScenarioWithCounterfactual`.
- `scripts/eval-cli.js` — add `--max-cost <USD>` flag; pass through to `runAdaptiveEvaluation` for adaptive profiles (around line 1690).
- **NEW:** `services/adaptiveTutor/budgetTracker.js` — `create({ maxUsd })`, `estimate(promptText, maxOutputTokens, model) -> usd`, `record({ inputTokens, outputTokens, cost })`, `assertBelowCeiling(estimateUsd)`.

**Acceptance.** Unit test: tracker aborts before exceeding ceiling. Smoke: `... --max-cost 0.01` aborts within first scenario; `... --max-cost 5.00` runs to completion.

#### 2. A13 pre-registration document

NEW file: `docs/explorations/claude/a13-pre-registration.md`. Required by `consolidated-plan.md` §4 P0 #2 and synthesis §6 step 1. Locks question, conditions, primary endpoint, success thresholds, stop conditions, budget *before* the run, so the analysis can't be retrofitted. Pull predeclared content from existing sources rather than re-deriving:

- **Question and design** — `synthesis-with-gpt-pro.md` §6 step 9 (the "C3/C4 improves strategy_shift_correctness ≥25 pp over C1, ≥15 pp over C2" thresholds).
- **Conditions (C1/C2/C3/C4)** — `consolidated-plan.md` §4 P0 #5.
- **Scenarios** — `config/adaptive-trap-scenarios.yaml` (paste 8 IDs, lock the version).
- **Stop conditions** — `consolidated-plan.md` §3.4 / synthesis §6: internal leakage > 5%, state updates don't affect policy in dry-run, strategy-shift-correctness can't be scored reliably.
- **Budget** — real number ($50 ceiling for the small-N smoke, justified against the per-run cost the budget guard exposes once item 1 lands).

**Acceptance.** File exists, referenced in the Gate B run command, names model versions / dates explicitly.

#### 3. Polished policy-action taxonomy

The inline taxonomy in `services/adaptiveTutor/policyActions.js` only gives the LLM short one-line descriptions. Synthesis §4 point 3 preserves gpt-pro's recommendation that each action carry **trigger conditions, contraindications, and expected next learner signal** — these are the cues that make policy selection less brittle on real LLMs.

**Approach.**
- **NEW** `config/adaptive-policy-actions.yaml` — one entry per action with `description`, `trigger_conditions` (array), `contraindications` (array), `expected_next_learner_signal`, `example_tutor_move`.
- `services/adaptiveTutor/policyActions.js` — keep the frozen `POLICY_ACTIONS` enum (load-bearing for `realLLM.js`'s Zod schema and analyzer's `expected_strategy_shift` matching). Add YAML loader that hydrates `POLICY_ACTION_DETAILS` at module load; fall back to current inline `POLICY_ACTION_DESCRIPTIONS` if YAML absent (graceful regression).
- `services/adaptiveTutor/realLLM.js` — extend `policyMenuStr` to include trigger conditions + contraindications + expected next signal in system prompt for `tutorEgoInitial` and `tutorEgoRevision`. **Watch prompt-length:** current menu ~400 tokens; expanded version may be ~1,500. Cache as module-level constant.

**Acceptance.** Mock smoke still passes (loader falls back cleanly). Real-LLM smoke shows LLM's `rationale` field referencing trigger conditions or contraindications by name (qualitative — visible in persisted trace).

#### 4. Scenario completeness

Edit `config/adaptive-trap-scenarios.yaml`: add `failure_mode` (string describing what tutor failure looks like for that scenario) and `success_criteria` (object with scenario-specific keys, e.g. `repair_success: { tutor_must_explicitly_name_mismatch: true }`, `delayed_task_success: { learner_microtask_completion: true }`).

**Content edit only.** Don't wire the new analyzer metrics yet — `trigger_detection`, `state_update_accuracy`, `uptake_score`, `repair_success`, `delayed_task_success` are P1 in the roadmap, not P0. The YAML extension is here so the data is there once the analyzer extends post-Gate-B.

**Acceptance.** Scenario YAML round-trips through the runner; mock smoke still green.

#### 5. A13 condition cells

The cell as shipped (`cell_110_langgraph_adaptive`) is C3-equivalent (adaptive state + policy selector + recognition generator). A13 needs C1, C2, C4 to compare against; without them the run produces only C3 numbers and there's no contrast.

- **`cell_111_a13_C1_recognition_only`** — `runner: standard`, single-agent recognition prompt, against `config/adaptive-trap-scenarios.yaml`. Cleanest implementation: write a thin scenario adapter so `runner: standard` cells consume `scenario_source: config/adaptive-trap-scenarios.yaml` by collapsing trap scenarios to single-prompt openings.
- **`cell_112_a13_C2_egosuperego`** — `runner: standard`, current ego/superego architecture, recognition prompt, against the trap scenarios.
- **`cell_113_a13_C4_validator`** — `runner: adaptive` (extends `cell_110`); add a small validator node to `services/adaptiveTutor/graph.js` between `tutorSuperegoReview` and `constraintCheck` that re-checks the policy-action label against the just-emitted `learnerProfile` and forces revision if mismatched. The `realLLM.js` `tutorSuperego` schema already returns `needsRevision` + `feedback`; the validator is structurally a second pass with stricter rules.

**Files.**
- `config/tutor-agents.yaml` — three new cell blocks following the `cell_110` pattern at line 4879.
- `services/evaluationRunner.js` — append three IDs to `EVAL_ONLY_PROFILES` (current entry for `cell_110_langgraph_adaptive` at line 222).
- `services/adaptiveTutor/graph.js` — for C4 only: add `tutorValidator` node + edge between `tutorSuperegoReview` and `constraintCheck`. Gate with `validatorEnabled` flag from cell config so cell_110 (C3) keeps current graph shape.
- `services/adaptiveTutor/index.js` — read `validator` flag from `evalProfile.adaptive` and pass to graph builder.

**Acceptance.** Mock smoke runs all four cells, traces persist under each profile name. Strategy-shift analyzer aggregates by `profile_name` with distinct rows for cells 110/111/112/113.

#### What's deferred from Phase 1 (Ultraplan reinforcement)

Even though the substrate document recommends them, these are **not** in this phase — doing them on the critical path delays Gate B without buying anything for it:

- **LiteLLM** beneath `realLLM.callRole` — see §"Adjudicated decisions" (next).
- **XState** for the recognition FSM — current `policyActions.js` enum + `constraintCheck` node is sufficient for A13. Revisit if A13 produces signal and we need the methods-section figure (Phase 2/3 per the existing plan; Ultraplan agrees).
- **Inspect AI** as evaluation harness — current `analyze-strategy-shift.js` plus the `evaluation_results` table is enough for A13. Revisit for A14 / pre-registered publication runs (Phase 3).
- **Generative Agents memory stream / Voyager retrieval / Burr checkpoint-as-eval-case** — all deferred to Phase 3 (working-through memory) or Phase 2 nice-to-have.
- **P1 expanded analyzer metrics** (`trigger_detection`, `state_update_accuracy`, `uptake_score`, `repair_success`, `delayed_task_success`). Item 4 above makes these scorable later; wiring the analyzer is post-Gate-B work.

#### Adjudicated decisions (2026-05-01)

Two of Ultraplan's refinements diverged from the prior plan's pinned positions. Both are resolved here. The §"Hybridization decisions" subsection below is annotated with the LiteLLM resolution.

1. **LiteLLM placement.** The prior plan adopted LiteLLM in Phase 1 as a multi-provider + cost-control layer. Ultraplan: defer past Gate B because the budget-tracker module (Phase 1 item 1) gives ~80% of LiteLLM's value (budget gating across providers via the existing `callAI` cost field) without adding a critical-path dependency.
   - **Decision:** Defer LiteLLM to "when a second non-Anthropic / non-OpenRouter provider is needed" — likely Phase 3 multi-judge jury. Not pinned to Phase 1. The Phase 1 budget tracker stands alone.

2. **Sample size for Gate B.** Prior plan: `--runs 3` (4 cells × 8 scenarios × 3 = 96 attempts). Ultraplan: `--runs 8` (256 attempts) for the full A13, preceded by an N=1 micro-smoke (`--scenarios false_confusion_v1` for the cost-ceiling regression).
   - **Decision:** Keep `--runs 3` for the budget-conscious initial Gate B run (preserves the $50 ceiling). If signal is suggestive but underpowered (effect direction matches, p > 0.05), follow up with `--runs 8` and a higher ceiling. The N=1 micro-smoke is adopted regardless and is in the verification block.

### Phase 2 — Architectural primitive prototypes (after Gate B; ~3-5 weeks)

Run pilots P2, P3, P4 in sequence (not parallel — each informs the next). Each pilot is one cell, 8 scenarios, 3 runs, ≤24 dialogues, full human inspection.

**P2 first** (bilateral ToM) — it's the cleanest extension of the existing scaffold and least architecturally invasive. New cell `cell_115_bilateral_tom` adds:
- Paired natural-language + JSON `hypothesizedLearnerState` in `tutorInternal` (per LBM pattern).
- Reactivates the bilateral dynamic learner from `learnerTutorInteractionEngine.js:1100–1227` for this cell only — adaptive runner gets a `learner_architecture: ego_superego_bilateral_tom` branch. Scripted opening turns from trap scenarios remain (provides scenario fidelity); subsequent learner turns are dynamic.
- Adds `hypothesizedTutorState` to learner ego prompt (small change to `learnerTutorInteractionEngine.js`).
- Adds `tom_accuracy` to `analyze-strategy-shift.js` or a sibling script `scripts/analyze-tom-accuracy.js`.

**P3 second** (charisma) — only if P2 shows ToM accuracy ≥ 0.4 (otherwise the charisma trigger has no reliable signal to fire on). New cell `cell_116_charisma` adds:
- Stagnation detector node in `services/adaptiveTutor/graph.js`.
- New charisma action set in `config/adaptive-policy-actions.yaml`.
- Charisma trigger expansion of policy action set when stagnation fires.
- 2 new trap scenarios in `config/adaptive-trap-scenarios.yaml` designed to provoke stagnation.
- New scoring in `scripts/analyze-charisma.js`.

**P4 third** (CIKT iteration) — orthogonal to P2/P3, can run in parallel if engineering bandwidth allows. New cell `cell_117_cikt_state` adds:
- 2-iteration Analyst↔Predictor loop in `learnerProfileUpdate` node.
- Paired-state output if not already adopted in P2.

**XState half-day spike** before P3 — only if the FSM transition guard logic is getting tangled in LangGraph conditional edges. If LangGraph stays clean, skip XState entirely; document the negative spike result.

### Phase 3 — Combined renovation + revamped harness (after Phase 2; ~4-8 weeks)

Run P5 (combined cell) only if ≥2 of P2/P3/P4 cleared their thresholds. Combined cell = Psyche-v2 stack + bilateral ToM + charisma + CIKT KT + working-through memory wired through `services/memory/learnerMemoryService.js`.

Concurrent work in Phase 3:
- Inspect AI sidecar implementation in a new `eval-inspect/` Python directory (separate from JS code; communicates via JSON over stdin/stdout or via reading SQLite read-only).
- MathTutorBench / MRBench / Bridge transfer probes on the strongest pilot cell.
- Paper delta report — `scripts/generate-adaptive-paper-delta.js` integrating P1–P5 against `paper-full-2.0.md` claims, per `gpt-pro/02-codex-claude-code-action-plan.md` Track J.

### Phase 4 — Scale + cross-session (long horizon; post-Phase-3)

Only if Phase 3 produces a publishable contribution. Includes:
- Multi-judge jury default for primary endpoints
- Larger N per cell (back to factorial sweep style, but on the renovated architecture)
- Cross-session adaptation: connect `services/memory/learnerMemoryService.js` to learner persistence across runs
- Submit to GAIED / BEA / EDM / NeurIPS edu workshop

### Hybridization decisions (lifted intact from `agent-framework-analysis.md`, restated for plan-completeness)

**Adopt as dependencies:**
- LiteLLM beneath `realLLM.callRole` in `services/adaptiveTutor/realLLM.js` — multi-provider + cost-control. **Adjudicated 2026-05-01: deferred from Phase 1 to "when a second non-OpenRouter provider arrives" (likely Phase 3 multi-judge jury). See Phase 1 §"Adjudicated decisions" above. The Phase 1 budget tracker covers ~80% of LiteLLM's cost-control value standalone.**
- XState as recognition FSM — *only* if the half-day spike validates ergonomic gain. Phase 2/3.
- Inspect AI as Python sidecar — Phase 3.

**Lift patterns (no new dependencies, ≤200 LOC each):**
- Generative Agents memory stream (recency × importance × relevance) for working-through memory — Phase 3.
- Voyager skill library pattern for the expanded action set including charisma actions — Phase 2/3.
- Letta typed memory blocks for `services/memory/learnerMemoryService.js` write paths — Phase 3.
- Burr checkpoint-as-eval-case for trap scenario validation — Phase 1 nice-to-have, Phase 2 required.
- Claude Agent SDK `max_budget_usd` for cost ceiling — Phase 1.

**Reject:**
- Letta as full agent runtime (auto-memory violates pre-registration discipline)
- CrewAI / AutoGen / OpenAI Agents SDK (all wrong shape — assessed in framework analysis §3-§4)

---

## Critical files and where the work lands

Listed for execution-time reference. Files marked NEW are created; others are extended.

**Configuration:**
- `config/tutor-agents.yaml` — extend with cells 111–118 (and `EVAL_ONLY_PROFILES` mirror in `services/evaluationRunner.js`)
- `config/adaptive-trap-scenarios.yaml` — add `failure_mode` + `success_criteria` per scenario; add 2 stagnation-provocation scenarios in P3
- `config/adaptive-policy-actions.yaml` — NEW (Phase 1, P0 #3)

**Adaptive runner (Phase 1–3 extensions):**
- `services/adaptiveTutor/stateSchema.js` — extend `tutorInternal` and (P2) `learnerProfile` with paired-state fields; add `charismaTrigger` (P3)
- `services/adaptiveTutor/graph.js` — add stagnation-detector node (P3); add charisma-trigger conditional edge (P3); extend constraint check for charisma admissibility
- `services/adaptiveTutor/policyActions.js` — load from YAML (Phase 1); register charisma action set (P3)
- `services/adaptiveTutor/llm.js`, `mockLLM.js`, `realLLM.js` — add roles `analystRefinement` (P4), `tomTracker` (P2), `charismaAgent` (P3)
- `services/adaptiveTutor/persistence.js` — extend `extractTurnTrace` for new fields (already shown to be back-compat by exploration)
- `services/adaptiveTutor/index.js` — `--max-cost` flag plumbing (Phase 1)

**Bilateral learner (P2):**
- `services/learnerTutorInteractionEngine.js` — add `hypothesizedTutorState` to learner ego context (small ~20-line change at the prompt-build site around line 1114)

**Memory (Phase 3):**
- `services/memory/learnerMemoryService.js` — wire existing tables into prompts; extend with tutor-side memory tables
- new `services/memory/workingThroughMemory.js` — Generative-Agents-style retrieval over the SQLite tables

**Analysis scripts:**
- `scripts/analyze-strategy-shift.js` — extend; or split into siblings for P2/P3/P4 metrics (`scripts/analyze-tom-accuracy.js`, `scripts/analyze-charisma.js`, `scripts/analyze-state-update.js`)
- new `scripts/export-adaptive-human-packet.js` — required before any paper claim (Phase 1 nice-to-have, Phase 2 required)
- new `scripts/generate-adaptive-paper-delta.js` — Phase 3

**Documentation:**
- this file (`docs/explorations/claude/comprehensive-strategy.md`) — canonical strategy doc; provenance in header
- new `docs/explorations/claude/a13-pre-registration.md` — Phase 1
- new `docs/explorations/claude/p2-bilateral-tom-pre-registration.md`, `p3-charisma-pre-registration.md`, `p4-cikt-pre-registration.md`, `p5-combined-pre-registration.md` — created at the start of each pilot
- update `docs/explorations/claude/consolidated-plan.md` — append a §3.5 referencing this strategy doc as the upstream architectural plan

**Eval sidecar (Phase 3, NEW directory):**
- `eval-inspect/` — Python Inspect AI tasks for cross-validation

---

## What this strategy deliberately does NOT do

1. **Does NOT abandon the existing 90-cell sweep.** `paper-full-2.0.md` remains canonical. The renovated cells contrast against the existing factorial body.
2. **Does NOT promise empirical validation of Hegel/Freud/Weber.** The framing's contribution is conceptual organisation. Empirical validation of the *philosophical* claims would require recognition-vs-neutral-framed contrast cells (queued for after Phase 3).
3. **Does NOT commit to brute-force factorial of every primitive combination.** Pilot phase is single strategic runs. P5 is the only combined cell.
4. **Does NOT solve cross-session adaptation in Phase 1–3.** Working-through memory is within-dialogue first; cross-session is Phase 4.
5. **Does NOT replace LangGraph wholesale.** XState / LiteLLM / Inspect AI are surgical hybridizations, each behind a confirmed-need check.
6. **Does NOT lift CIKT's KTO training.** Inference-only adaptation, with explicit acknowledgement that this is a deviation from the paper's pattern. Open question whether iteration without preference learning is enough.

## Open questions to resolve before Phase 2 begins

1. **Operational definition of stagnation.** The 4-condition AND of (3+ same actions, Jaccard >0.6, empty learner-state delta, empty tutor-state delta) is a first cut. Will validate against the 24 P2 dialogues' qualitative inspection — does the threshold actually match the moments humans flag as "the tutor and learner are stuck in mutual confirmation"? Adjustable before P3.
2. **Whether bilateral ToM should be tested independently (P2) or only inside the combined renovation (P5).** Current plan: independent in P2 because it's the substrate the charisma trigger reads. Alternative: combine P2+P3 into one richer pilot. Tradeoff: combined gives faster signal but conflates effects.
3. **Whether the existing tutor-core 0.5.0 contract is stable enough for Phase 2.** The recent setQuietMode regression suggests not. May need a contract assertion test in `services/__tests__/` before Phase 2 proceeds. (Cheap; do as Phase 1 nice-to-have.)
4. **Whether the philosophical framing earns its keep in the paper.** A successful P2/P3/P4 doesn't validate Hegel/Freud/Weber per se — only that *some* explicit primitive works. The framing's load-bearing function is conceptual organisation, not empirical claim. Restate this in `paper-full-2.0.md` when the time comes.

---

## Verification (per phase)

**Phase 1 verification (after the 5 prerequisites land, before and during Gate B):**

1. **Mock smoke (all 4 cells):**
   ```
   node scripts/eval-cli.js run \
     --profiles cell_110_langgraph_adaptive,cell_111_a13_C1_recognition_only,cell_112_a13_C2_egosuperego,cell_113_a13_C4_validator \
     --runs 1 --dry-run
   ```
   Expect: 4 cells × 8 scenarios = 32 persisted rows, no errors.

2. **Cost-ceiling regression** (with `ADAPTIVE_TUTOR_LLM=real`):
   ```
   node scripts/eval-cli.js run --profiles cell_110_langgraph_adaptive --runs 1 --max-cost 0.01
   ```
   Expect: aborts cleanly with budget-exceeded error before second LLM call.

3. **Real-LLM micro-smoke** (one cheap scenario across all four cells):
   ```
   node scripts/eval-cli.js run \
     --profiles cell_110_langgraph_adaptive,cell_111_a13_C1_recognition_only,cell_112_a13_C2_egosuperego,cell_113_a13_C4_validator \
     --runs 1 --max-cost 5.00 --scenarios false_confusion_v1
   ```
   Expect: writes 4 rows (one per cell), each with non-mock dialogue text, all four `policyAction` fields populated and drawn from `POLICY_ACTIONS` enum.

4. **Analyzer sanity:**
   ```
   node scripts/analyze-strategy-shift.js --run-id <smoke-runId>
   ```
   Expect: per-profile breakdown with four rows; `strategy_shift_correctness` non-null where smoke hit a turn at `triggerTurn + 1`.

5. **Pre-registration check:** `docs/explorations/claude/a13-pre-registration.md` referenced in run's `description` (so `evaluation_runs.metadata` JSON carries the pre-reg pointer). Pre-reg doc commits ≥48 hours before Gate B run (visible in git log).

6. **24 dialogues per cell inspectable** via `node scripts/browse-transcripts.js`.

**Full Gate B run command** (after all six verification steps green):
```
node scripts/eval-cli.js run \
  --profiles cell_110_langgraph_adaptive,cell_111_a13_C1_recognition_only,cell_112_a13_C2_egosuperego,cell_113_a13_C4_validator \
  --runs 3 --max-cost 50 \
  --description "A13 Gate B — see docs/explorations/claude/a13-pre-registration.md"
```
Frontier-class judge (Sonnet 4.6 default). Sample size `--runs 3` (adjudicated 2026-05-01: budget-conscious initial run, $50 ceiling; follow up with `--runs 8` if signal underpowered). Result interpretation is the next gate, not this strategy.

**Phase 2 verification (per pilot):**
- New cell registered in both `config/tutor-agents.yaml` and `EVAL_ONLY_PROFILES`. `node scripts/run-adaptive-cell-smoke.js` (or its sibling) passes for the new cell against mock LLM.
- Pilot's pre-registration doc commits before the real-LLM run.
- Real-LLM run completes within `--max-cost`.
- Pilot-specific analyzer script produces the predeclared primary metric.
- All 24 pilot dialogues read by the author with the human-inspection packet rubric.
- Pre-declared threshold check produces a binary pass/fail decision before any paper-claim drafting.

**Phase 3 verification (combined cell + harness):**
- P5 cell runs end-to-end, leakage rate <5% measured.
- Inspect AI Python sidecar reproduces the JS analyzer's primary metrics within ±5 pp on the same dialogues.
- MathTutorBench / Bridge transfer probe shows non-degenerate scores (cell hasn't memorized scenarios).
- Paper delta report generated; new claims trace back to specific runIDs and pilot result tables.

**Phase 4 verification:**
- Cross-session adaptation produces a measurable improvement over within-session-only baseline.
- Workshop submission accepted (the only external verification that matters at this stage).

---

## Status checklist (live during execution)

Update this section in-place as phases complete. (Initial state: only Phase 1 prerequisites partially done per consolidated-plan §1.)

- [ ] Phase 1: A13 prerequisites + Gate B
  - [x] Adaptive scaffold shipped (consolidated-plan §1)
  - [x] `analyze-strategy-shift.js` shipped
  - [x] eval-cli regression unblocked
  - [x] A13 pre-registration doc (`docs/explorations/claude/a13-pre-registration.md` — locked 2026-05-01; earliest run-start 2026-05-03)
  - [x] Cost ceiling (commit `aa2b64f` — `services/adaptiveTutor/budgetTracker.js` + `--max-cost` flag; 11 tests)
  - [ ] Polished policy-action YAML
  - [ ] Scenario completeness fields
  - [ ] A13 condition cells (111, 112, 113)
  - [ ] Real-LLM Gate B run
- [ ] Phase 2: Pilot runs P2 / P3 / P4
- [ ] Phase 3: P5 combined + revamped harness
- [ ] Phase 4: Scale + cross-session
