# Future Development TODO

> **NOTE:** For Paper 2.0 related tasks and current active work, see the project board at [`notes/paper-2-0/BOARD.md`](notes/paper-2-0/BOARD.md). This TODO file contains older general experimental extensions and repository sweep items.
>
> **Task tracking (2026-04-16):** Open items from this file have been migrated into the in-session task list (TaskList) — see tasks #1-#12. Use `TaskList` / `TaskGet <id>` to view current status. This document remains the canonical design reference; the task list is the working board.

Generated 2026-02-19 from comprehensive repository sweep.
Organized by theme, roughly priority-ordered within each section.

---

## A. Experimental Extensions

### A1. Human Learner Validation (CRITICAL)
All evaluations use simulated learners. The critical open question is whether recognition-enhanced tutoring produces genuine learning gains with real humans.
- Design RCT with real learners (n>=60/condition)
- Measure: learning gains (pre/post), engagement, satisfaction, retention
- Qualitative interviews on learner experience of recognition vs base
- Paper ref: Section 8.2 Future Direction #1

### A2. Dynamic Learner Mechanism Sweep (COMPLETE)
Full 2×7 matrix (recognition × 7 mechanisms) with dynamic learner. All 7 mechanisms show positive recognition deltas (+4.8 to +17.5 pts). Dynamic learner amplifies mechanism differentiation 1.6–2.8× vs scripted.
- Cells 60-63: self-reflect, bidirectional (eval-2026-02-20-0fbca69e)
- Cells 64-65, 69-70: intersubjective, combined (eval-2026-02-20-117710c0)
- Cells 72-77: quantitative, erosion, tutor-profiling (eval-2026-02-19-03dd8434)
- Haiku supplements: eval-2026-02-20-57ba525c, eval-2026-02-20-90703a6a
- Paper ref: Section 6.10, 6.16.1, 8.2

### A3. Capability Threshold Mapping (MEDIUM — design ready, not yet run)
Nemotron falls below and Haiku falls above the minimum ego capability threshold for mechanism benefit. The threshold boundary is unmapped.

**Known anchors:**
- Nemotron 30B (free): mechanisms **hurt** (−15 pts, cognitive prosthesis cells 66-68)
- Haiku 4.5 (paid): mechanisms **help** (+20 pts)

**Experimental design:**
- **Cells**: 1 (base_single_unified) vs 5 (recog_single_unified) — single-agent, no superego, scripted learner. Cleanest pair to isolate recognition main effect per model.
- **Models** (4 intermediate, all available on OpenRouter as of Feb 2026):
  1. `openrouter.glm47` — GLM-4.7 (likely near Nemotron tier)
  2. `openrouter.qwen3.5` — Qwen 3.5 397B MoE / 17B active (mid-low)
  3. `openrouter.deepseek` — DeepSeek V3.2 (mid-range)
  4. `openrouter.kimi-k2.5` — Kimi K2.5 (known capable, used as superego; probably just below Haiku)
- **Scenarios**: All 18 (no cluster filtering — full scenario coverage for robust means)
- **Runs**: 3 per cell (N = 4 models × 2 cells × 3 runs × 18 scenarios = 432 rows)
- **Superego**: None (cells 1 & 5 are single-agent, `superego: null`)
- **Learner**: Scripted (unified), consistent across models

**Commands** (run sequentially per model to avoid OpenRouter rate limits):
```bash
# 1. GLM-4.7
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --ego-model openrouter.glm47 --description "A3 capability threshold: GLM-4.7"

# 2. Qwen 3.5
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --ego-model openrouter.qwen3.5 --description "A3 capability threshold: Qwen 3.5"

# 3. DeepSeek V3.2
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --ego-model openrouter.deepseek --description "A3 capability threshold: DeepSeek V3.2"

# 4. Kimi K2.5
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --ego-model openrouter.kimi-k2.5 --description "A3 capability threshold: Kimi K2.5"

# Judge each run (replace <runId> with actual IDs):
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- Plot recognition delta (recog − base) by model for each of the 6 data points (4 new + 2 anchors)
- Identify crossover: at what capability level does delta flip from negative to positive?
- Correlate with model properties: parameter count, context window, instruction-following benchmarks
- Look for scenario-level patterns: does the threshold vary by scenario complexity?

**Notes:**
- `--ego-model` overrides only the ego; superego is null for these cells so no interaction
- OpenRouter free-model rate limit is account-level across all free models — space runs out or use `--parallelism 1`
- Kimi K2.5 and DeepSeek may need `--max-tokens 4000` if reasoning tokens consume budget
- Existing Nemotron and Haiku data from factorial runs can serve as anchors (no need to re-run)
- Paper ref: Section 8.2 Future Direction #11

### A4. Learner Superego Redesign (COMPLETE — null result)
Authenticity-focused superego scored *worse* on every dimension including authenticity itself (3.7 vs 4.1 standard). The recognition inversion is structural, not a prompt calibration issue.
- Cells 78-79: eval-2026-02-19-dbcd6543 (Nemotron, N=35), eval-2026-02-20-058c7a0e (Haiku, N=12)
- Standard control: cells 60-61 from eval-2026-02-20-0fbca69e (N=64)
- Paper ref: Section 6.16.1, 7.5, 8.2

### A5. Writing Pad Controlled Ablation ~~(MEDIUM — design ready, not yet run)~~ [RESOLVED v3.0.40]
**Closed 2026-04-19.** Run eval-2026-04-17-f1e851c3 (N=252, 4 cells × 3 runs × 21 scenarios, nemotron × kimi-k2.5, Sonnet judge). 2×2 ANOVA: recognition F=27.10, p<.001, η²=.097 (large); Writing Pad F=3.96, p=.048, η²=.014 (marginal, opposite direction — pad OFF scores 3.2 pts higher); interaction F=0.82, p=.366 (null). Recognition holds without pad (d=0.74 vs 0.56 with pad). **Writing Pad is not load-bearing for the recognition effect.** Full analysis in `exports/a5-writing-pad.md`; paper §6.6.9.

Writing Pad activation coincides with quality improvement, but no controlled ablation exists.

**Current state:**
- Writing Pad is a Freudian three-layer memory system (conscious/preconscious/unconscious) in tutor-core
- Enabled via `writing_pad_enabled: true` in YAML profiles — no CLI toggle
- All cells 22+ have it enabled; cells 1-20 do not
- Persists per-learner within a multi-turn dialogue (synthetic learnerId per dialogue)

**Experimental design:**
- **Approach**: Create paired cells that differ ONLY in `writing_pad_enabled`. Best candidates are cells 40/41 (self-reflective base/recog) since they use all advanced features including Writing Pad.
- **New cells needed** (renumbered — 80-92 already taken by Paper 2.0 messages-mode cells):
  - Cell 93: Clone of cell 40 (base_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
  - Cell 94: Clone of cell 41 (recog_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
- **Scenarios**: Multi-turn only (mutual_transformation_journey, epistemic_resistance_impasse, affective_shutdown_impasse, productive_deadlock_impasse, misconception_correction_flow, mood_frustration_to_breakthrough) — Writing Pad effects only manifest across turns
- **Runs**: 3 per cell (N = 4 cells × 3 runs × 6 scenarios = 72 rows)
- **Controls**: Cells 40/41 (with Writing Pad) serve as within-experiment controls

**Prerequisites:**
- [ ] Define cells 93-94 in `tutor-agents.yaml` (clone 40/41, set `writing_pad_enabled: false`, suffix names with `_nopad`)
- [ ] Register cells 93-94 in `EVAL_ONLY_PROFILES` array in `evaluationRunner.js`
- [ ] Confirm next-free cell ID by re-checking `tutor-agents.yaml` at run time (the highest cell number in use can change)

**Commands:**
```bash
# Run ablation (all 4 cells together for matched conditions)
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified,cell_41_recog_dialectical_selfreflect_unified,cell_93_base_dialectical_selfreflect_unified_nopad,cell_94_recog_dialectical_selfreflect_unified_nopad --runs 3 --description "A5 Writing Pad ablation"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- 2×2 ANOVA: recognition (base/recog) × Writing Pad (on/off)
- Key metrics: state retention across turns, prompt coherence, cumulative learning progression
- Per-turn trajectory analysis: does Writing Pad improve later turns more than early ones?
- Check interaction: does Writing Pad benefit recognition more than base?
- Paper ref: Section 8.1 Limitation #10

### A6. Domain Expansion ~~(MEDIUM — All authoring phases complete; eval runs ~~pending API budget~~ **done**)~~ [RESOLVED v3.0.37]
**Closed 2026-04-17.** All five domains ran and judged; §6.6.6 expanded to 5-row table. Direction replicates in all five: programming d=2.33, math d=1.45, creative d=1.96, SEL d=1.82, philosophy anchor d=2.71 — all "very large" under Cohen's conventions. Domain-only magnitude test remains confounded with conversation mode; matched-mode follow-up deferred. Final report at `exports/a6-domain-generalization.md`.

Tests whether recognition transfers across domains. Originally only 2 domains tested (philosophy via 479, elementary math via 101). Now 5 authored across analytical, symbolic, procedural, aesthetic, and meta-skill domains.

**Current infrastructure:**
- Content switching via env vars: `EVAL_CONTENT_PATH` and `EVAL_SCENARIOS_FILE`
- Course 479 (EPOL philosophy, 8 lectures) — primary evaluation domain
- Course 101 (elementary fractions, 2 lectures) — math test domain, 11 scenarios (5 single-turn, 6 multi-turn)
- Course 201 (introductory programming, 4 lectures) — programming test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16
- Course 301 (creative writing, 4 lectures) — subjective/aesthetic test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16
- Course 401 (college success / social-emotional skills, 4 lectures) — meta-skill/interpersonal test domain, 8 scenarios (5 single-turn, 3 multi-turn) — added 2026-04-16

**Experimental design:**
- ~~**Phase 1 — Expand existing math domain**~~ (authoring complete): 11 scenarios in `content-test-elementary/scenarios-elementary.yaml`, exceeds the 4-6 spec. Run cells 1 vs 5 × 3 runs × ~6 scenarios = 36 rows — ~~pending API budget~~ **done**.
- ~~**Phase 2 — New STEM domain (programming)**~~ (authoring complete): `content-test-programming/courses/201/` (4 lectures: Variables, If/Else, Loops, Debugging) + `scenarios-programming.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate against `eval-cli.js validate-config` and all 3 multi-turn dry-run pass. Python is the example language. Recognition-relevant multi-turn scenarios: `code_frustration_to_breakthrough` (infinite loops), `code_misconception_correction` (= vs ==), `code_productive_deadlock` (range half-open convention). Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.
- **Phase 3 — Non-analytical domains** (all authoring complete):
  - ~~**Phase 3a — Creative writing**~~ (authoring complete): `content-test-creative/courses/301/` (4 lectures: Showing vs Telling, Voice and POV, Revision as Re-Vision, Giving and Receiving Feedback) + `scenarios-creative.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate and all 3 multi-turn dry-run pass (scores 73-78 from nemotron on cell_1). Tests recognition transfer to a subjective/aesthetic domain where "right answers" don't exist. Multi-turn scenarios: `writing_frustration_to_breakthrough` (blocked on opening line), `writing_misconception_correction` ("good writing = follows rules"), `writing_productive_deadlock` (refusing to cut a darling scene). Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.
  - ~~**Phase 3b — Social-emotional learning**~~ (authoring complete): `content-test-sel/courses/401/` (4 lectures: Self-Awareness, Self-Management, Social Awareness, Relationship Skills, loosely modelled on CASEL-5) + `scenarios-sel.yaml` (8 scenarios: 5 single-turn + 3 multi-turn). All 8 validate and all 3 multi-turn dry-run pass (scores 63.7-67.9 from nemotron on cell_1 — SEL is the harder domain because rapport IS the content). Tests recognition in a meta-skill domain where the tutor-learner relationship itself is the subject matter. Multi-turn scenarios: `sel_frustration_to_breakthrough` ("I can't name what I feel"), `sel_misconception_correction` ("emotions are obstacles to reason"), `sel_productive_deadlock` ("I'm not a person who asks for help" — identity-level refusal to file financial aid appeal). Prediction: recognition-vs-base delta will be maximally separated in SEL because rapport authenticity IS the scoring target. Run cells 1 vs 5 × 3 runs × 8 scenarios = 48 rows — ~~pending API budget~~ **done**.

**Prerequisites (Phase 1):** ~~done~~ — 11 scenarios authored, validated, dry-runs pass.

**Prerequisites (Phase 2):** ~~done~~ — course 201 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Prerequisites (Phase 3a):** ~~done~~ — course 301 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Prerequisites (Phase 3b):** ~~done~~ — course 401 and 8 scenarios authored, validated, multi-turn dry-runs pass.

**Commands:**
```bash
# Run math domain evaluation (Phase 1)
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: elementary math"

# Run programming domain evaluation (Phase 2)
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: intro programming"

# Run creative writing domain evaluation (Phase 3a)
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: creative writing"

# Run social-emotional learning domain evaluation (Phase 3b)
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: social-emotional learning"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- Compare recognition delta across domains: is the effect size domain-dependent?
- Per-scenario breakdown: which scenario types transfer recognition benefit?
- Develop deployment rubric: recognition ROI by domain characteristics
- Paper ref: Section 8.2 Future Direction #3

### A7. Longitudinal Multi-Session Evaluation (LOW — infra simpler than originally estimated)
Single-session evaluation cannot capture accumulated understanding.

**Implementation spec**: `notes/design-a7-longitudinal-implementation-2026-04-16.md` — refines the high-level design after reading tutor-core migration 008.

**Current infrastructure gaps (post-discovery 2026-04-16):**
- Writing Pad schema **already supports cross-session persistence**: `writing_pads.learner_id` is UNIQUE and `initializeWritingPad()` is idempotent (tutor-core migration 008 + `writingPadService.js:28-33`).
- `evaluationRunner.runGeneration()` **already accepts** `learnerId` as an option (`services/evaluationRunner.js:1579`); the gap is only that `services/evaluationRunner.js:2611-2613` synthesises a fresh ID every dialogue.
- No CLI `--learner-id` flag on `eval-cli.js run`.
- No `learner_id` column on `evaluation_results` for per-row session-index derivation.

**Experimental design:**

- **Phase 1 — Infrastructure** (≈ half a day):
  - [ ] Add `learner_id TEXT` column to `evaluation_results` (local eval-repo migration; not tutor-core).
  - [ ] Plumb `learnerId` through `runScenarioConfiguration` → `runMultiTurnScenario` options.
  - [ ] At `services/evaluationRunner.js:2611-2613`, prefer `options.learnerId` over the synthetic ID when supplied.
  - [ ] Add `--learner-id <id>` flag to eval-cli `run` command option parser.
  - [ ] 3-session smoke test (`smoke-learner-01`) verifying `writing_pads.total_recognition_moments` grows monotonically across invocations.
  - ~~Implement persistent session table in tutor-core DB~~ — **NOT NEEDED**; Writing Pad already is the cross-session state.
  - ~~`--session-id` flag~~ — **NOT NEEDED**; session identity = `(learner_id, created_at)` tuple inferable from DB.

- **Phase 2 — Evaluation design**:
  - **Cells**: 40 vs 41 (base vs recog, self-reflective, Writing Pad enabled) — maximizes memory accumulation potential
  - **Session structure**: 8 sequential scenarios per "learner", ordered by difficulty:
    1. new_user_first_visit (intro)
    2. returning_user_mid_course (warmup)
    3. concept_confusion (early challenge)
    4. misconception_correction_flow (structured difficulty)
    5. epistemic_resistance_impasse (conflict)
    6. mood_frustration_to_breakthrough (emotional)
    7. mutual_transformation_journey (deep engagement)
    8. productive_deadlock_impasse (culmination)
  - **Runs**: 5 simulated "learners" per condition (N = 2 cells × 5 learners × 8 sessions = 80 dialogues)
  - **Learner**: ego_superego (dynamic) — must use LLM learner for authentic session-over-session evolution

- **Phase 3 — Analysis**:
  - Track Writing Pad growth: unconscious layer accumulation, recognition moment density
  - Learning trajectory: does score improve session-over-session? Does recognition accelerate learning curves?
  - Memory quality: does the tutor reference earlier sessions? Does accumulated context improve responses?
  - Repair quality: are later repairs faster/deeper due to accumulated learner model?

**Commands** (after infrastructure):
```bash
# Run session 1 for base condition
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified --runs 5 --scenario new_user_first_visit --learner-id learner-base-01 --description "A7 longitudinal: base session 1"

# Resume session 2 with same learner
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified --runs 5 --scenario returning_user_mid_course --learner-id learner-base-01 --session-id <session-from-step-1> --description "A7 longitudinal: base session 2"

# ... repeat for sessions 3-8, then repeat all for recog condition
```

**Notes:**
- This is the most infrastructure-heavy experiment — Phase 1 alone is significant engineering
- Consider starting with a manual 3-session pilot to validate the concept before full implementation
- Paper ref: Section 8.2 Future Direction #2

### A8. Active Control Rerun on Kimi K2.5 (COMPLETE)
Active control used Nemotron while factorial used Kimi. Model confound now resolved.
- **Wrong cells run first**: eval-2026-02-19-e000a987 used cells 9-12 (enhanced), not 15-18 (placebo). N=64 scored, 77% hallucination rate. Enhanced prompt causes catastrophic context loss on Kimi — confirms "prompt elaboration hurts strong models" but doesn't address A8.
- **Correct run**: eval-2026-02-19-f2263b04 — cells 15-18 (placebo) on Kimi K2.5. N=216 scored, 46% hallucination. GPT-5.2 rejudge in progress.
- **Reproduction runs**: eval-2026-02-19-13d34bef (Kimi base, grounded mean 71.6) and eval-2026-02-19-411414e4 (Nemotron base, grounded mean 57.4) confirm factorial baselines are stable — no model drift.
- **Three-way comparison** (grounded, matched scenarios, Kimi ego, Opus-judged):
  - Factorial base: N=285, M=64.2
  - Placebo: N=73, M=56.0
  - Factorial recognition: N=549, M=86.8
- **Key finding**: Placebo scores **below base** (−8.2 pts), not between base and recognition. Prompt elaboration without recognition theory is counterproductive on capable models. The gap concentrates in complex multi-turn scenarios (misconception_correction −34.9, mutual_transformation −25.1, frustration_to_breakthrough −17.5); simple scenarios roughly match base.
- **Model confound resolution**: Original Nemotron placebo (66.5) vs Kimi base (68.5) gap was ~2 pts. The real confound was that placebo prompt structure *hurts* Kimi more than Nemotron, so the original comparison actually **understated** recognition's advantage.
- Hallucination pattern: 6 hardcoded example IDs in placebo prompt let Kimi bypass curriculum context; base prompt uses 11 placeholders forcing context lookup (near-zero hallucination historically).
- Paper ref: Section 8.1 Limitation #4

### ~~A9. Cells 34-39 Full Run~~ (WON'T FIX — superseded)
Full-feature dialectical cells (cross-turn memory + prompt rewriting + learner signals). Early N=20 results showed recognition delta only +1.0, below cells 28-33's +4.5.
- Superseded by cells 40-65: cells 34-39 lack `superego_disposition_rewriting` and use generic `strategy: llm` rewriting; cells 40-45 add both improvements
- YAML definitions kept as historical documentation with DEPRECATED header (see C4)
- Decision: not running. The `superego_disposition_rewriting` effect is already captured by the cells 28-33 vs 40-45 comparison; isolating it on cells 34-39 would not add new evidence.

---

## B. Code Quality & Infrastructure

### ~~B1. Test Coverage Gaps~~ (DONE)
Tests added for `processUtils.js` (100%), `streamingReporter.js` (100%), `progressLogger.js` (100%), `learnerConfigLoader.js` (91%), `apiMessageFormatter.js` (100%), `apiPayloadCapture.js` (94%), `liveApiReporter.js` (98%), `provableDiscourse.js` (60%), `promptRewriter.js` (55%), `codexSessionService.js` (91%), and `promptRecommendationService.js` (14% → 87% line, 100% function — 2026-04-16). `mockProvider.js` already tested in `dryRun.test.js` (100%).
Overall project line coverage is at ~45% (partially due to CLI scripts being inherently untestable). All meaningful service-layer untested gaps are now closed; the residual `promptRecommendationService.js` uncovered lines are the optional Anthropic SDK path (peer dep, intentionally skipped) and a couple of fallback config paths.


### ~~B2. Silent Error Handling~~ (FIXED)
- ~~`learnerTutorInteractionEngine.js` JSON parse failures~~ — Now logs warning with status code on parse failure
- ~~`evaluationStore.js` empty migration catches~~ — Replaced 20+ bare catches with `migrateAddColumn()` helper that only ignores "duplicate column name"/"already exists", throws on real errors
- ~~`promptRewriter.js` synthesis failures~~ — Consolidated 8 ad-hoc `console.error` sites behind a single `logSynthesisError(operation, error)` helper. Format unchanged for humans; provides one seam for future telemetry counters. Null-return contract preserved (callers depend on it for template fallback).

### ~~B3. Hardcoded Constants~~ (FIXED)
- ~~HTTP timeout 60000ms in `rubricEvaluator.js`~~ — Extracted to `API_CALL_TIMEOUT_MS` constant (6 occurrences)
- ~~Inconsistent inline `30 * 60 * 1000` in `evalRoutes.js:1055`~~ — Now uses `TIMEOUT_WARNING_MS` constant
- ~~`learnerTutorInteractionEngine.js` `LEARNER_RETRY_DELAYS`~~ — No longer present; learner retries now delegated to tutor-core `callAI()` (single retry policy)
- ~~`contentResolver.js:17-19`~~ — Already configurable via `configure()`, removed from list

### ~~B4. Configuration Validation CLI~~ (DONE)
~~No runtime validation of cell definitions.~~
Implemented: `node scripts/eval-cli.js validate-config [--verbose] [--profile <name>]`
Validates: EVAL_ONLY_PROFILES coverage, provider/model resolution, dialogue consistency, learner architectures, scenario course_ids, hyperparameter ranges, prompt file existence. Also serves as regression prevention for E3 (context scoping).

### ~~B5. Centralized Error Reporting~~ (WON'T FIX — by design)
~~Error reporting scattered across 4+ destinations (progressLogger, reporter, console, DB).~~
The 4-way dispatch in evaluationRunner (progressLogger → JSONL files, streamingReporter → user terminal, DB → persistence, monitoringService → metrics) is intentional redundancy for different consumers. The ~106 console.error calls in services/scripts are mostly CLI user-facing output (stderr) with graceful upstream handling (null fallbacks, template defaults). Centralizing would add abstraction without fixing a real problem.

### ~~B6. Judge Model Metrics~~ (DONE)
~~No tracking of judge response times.~~
Added `judge_latency_ms` column to `evaluation_results`. Stored by `evaluate` (CLI judge) and `rejudge` (API judge) commands. Parse error rates and success rates not yet tracked (low priority) — would require adding counters to `callJudgeModel()`.

---

## C. Cleanup & Maintenance

### ~~C1. Stale Files~~ (DONE)
- [x] `data/eval-results.db` — 0 bytes, orphaned; deleted
- [x] `scripts/generate-paper-figures.py` — superseded by `.js` version; git rm'd
- [ ] `data/evaluations.db.bak-*` — 4 backups totaling ~208 MB; .gitignored (local only), keep for safety

### ~~C2. Deprecated Notation~~ (FIXED)
~~`scripts/analyze-judge-reliability.js` — deprecated `openrouter/` slash notation in example commands~~
Fixed: updated 5 occurrences to dot notation (`openrouter.sonnet`, `openrouter.kimi`).

### ~~C3. Legacy Cell Names in DB~~ (DOCUMENTED)
~~`cell_1` (shorthand) coexists with `cell_1_base_single_unified` (canonical) in DB~~
Documented in CLAUDE.md: use `LIKE 'cell_1%'` when querying across runs.

### C4. Cells 34-39 YAML Definitions (KEEPING)
Kept with DEPRECATED header. Superseded by cells 40-65 but preserved as historical documentation.
See comparison: cells 34-39 lack `superego_disposition_rewriting` and use `strategy: llm` (generic)
vs cells 40-45 which add superego rewriting and use `strategy: self_reflection`.

### ~~C5. Short Paper Staleness~~ (RESOLVED)
~~`docs/research/paper-short.md` at v2.3.14-short.~~ Updated to v2.3.17-short with N=4,144 across forty-eight evaluations. Added A2 mechanism sweep, recognition inversion, updated Table 1 totals. Slides (beamer + pptx) also updated to v2.3.17. All assets rebuilt.

### ~~C6. Test Directory Convention~~ (DOCUMENTED)
~~Tests split between `tests/` and `services/__tests__/`.~~
Documented in CLAUDE.md: `tests/` for integration tests, `services/__tests__/` for co-located unit tests.

---

## D. Theoretical / Mechanistic Research

### D1. Mechanistic Understanding (PARTIALLY ADDRESSED)
Why does recognition-oriented prompting change model behavior?
- ~~First-pass lexicon decomposition~~ — `scripts/analyze-recognition-lexicon.js` (2026-04-16). Complements `analyze-text-behaviors.js` §2 (data-driven JSD) with a theory-driven 10-concept Hegelian lexicon. Each tutor response gets per-concept density; Cohen's d (recog − base) and Pearson r (density × rubric score) flag which concepts are both distinctive AND quality-correlated. First pass on all scored rows (N=10,304): overall d=0.22, r=0.27. Top mechanism markers: `genuine` (d=+0.45, r=0.19) and `transformation` (d=+0.42, r=0.17). `recognition` (d=+0.20, r=0.15) and `struggle` (d=+0.19, r=0.17) moderate. Counterintuitive finding: `hegel`/`master-slave` has NEGATIVE d (−0.30) — base cells name the theory more than recog cells, which suggests enactment replaces explicit naming. `dialectic` is widespread and quality-correlated but not condition-distinctive (generic quality marker).
- Activation analysis, attention patterns, gradient analysis (still open — requires white-box access)
- Paper ref: Section 8.2 Future Direction #4

### D2. Cross-Application Transfer (Path 1 RESOLVED v3.0.38, Path 2 DEFERRED)
Test recognition-oriented design beyond tutoring.

**Path 1 (RESOLVED v3.0.38)** — single-application adjacency test:
- Content package `content-test-support/` (course 501: Peer Support Listener Training) — 4 lectures (Listening as Skill, Reflective Statements, Sitting With Distress, Discomfort as Data), 4 core + 1 mood scenarios (`scenarios-support.yaml`)
- Run: eval-2026-04-17-6766015b, cells 1 (base) vs 5 (recog), single-prompt mode, Haiku 4.5 × Sonnet 4.6, n=15 per cell
- **Result**: base 52.25 (SD 9.63), recog 69.92 (SD 12.73), Δ = 17.67, **d = 1.57** ("very large"). Closest A6 adjacency (SEL) d = 1.82 — Δd = −0.25, inside A6 range (d = 1.45–2.71)
- Integrated as §6.6.7 "Cross-Application Adjacency Pilot" in paper-full-2.0.md; analysis script `scripts/analyze-d2-support-pilot.js` + report `exports/d2-support-pilot.md`
- Directional claim (recognition improves tutor quality) survives a shift into a domain where the skill being coached runs counter to traditional pedagogy

**Path 2 (deferred — separate-paper scope)** — true cross-application with role-reframed prompts:
- Author `tutor-ego-support.md` and `tutor-ego-support-recognition.md` prompt variants that recast the tutor role from "pedagogical guide" to "peer support listener"
- Register new cells in `config/tutor-agents.yaml` + `EVAL_ONLY_PROFILES` (e.g., cells 91-92 for support base/recog)
- Run across 3 applications: peer support listener, customer service, code review
- Matching content packages + scenario sets for each application
- Cost: ~$25-40 API across 3 applications × 2 cells × 3 runs × 5 scenarios
- Deferred because: (a) requires tutor-core prompt authoring, (b) marked as separate-paper scope in v4 roadmap, (c) would extend the paper's length beyond target
- Paper ref: Section 8.2 Future Direction #5

### D3. Insight-Action Gap (PARTIALLY ADDRESSED)
Self-reflection produces awareness without behavioral change; profiling produces adaptation.
- ~~Measure gap quantitatively (semantic similarity of reflections vs behavior)~~ — `scripts/analyze-insight-action-gap.js` (2026-04-16). Computes per-cell coupling (cosine of `ego_self_reflection` text vs same-turn final tutor message), gap = `1 − coupling`, turn drift baseline, and cell-level base-vs-recog Cohen's d. First pass on 14 reflection-mechanism cells (eval-2026-02-13-8d40e086 + eval-2026-02-14-49b33fdd + eval-2026-02-14-e0e3a622): mean gap 0.42, recog gap > base gap (d ≈ -1.05, n=7 per group), gap > turn drift across all cells.
- Test whether explicit directive bridges gap
- Paper ref: Finding 11

### D4. Disposition Gradient Replication — RESOLVED v3.0.39 (architecture-scope-limit)
Finding: the suspicious > adversary > advocate gradient is **dialectical-ego-architecture-specific** (cells 40-45), not a universal property of the recognition mechanism (§6.6.8).
- Dialectical ego × philosophy (cells 40-45, Haiku × Opus, n=17-18): susp d=0.85, adv d=0.62, advocate d=0.51 — monotone, reproduces.
- Standard ego × philosophy (cells 22-27, Haiku × Opus, n=5-10): REVERSED (advocate d=1.70, adv d=0.97, susp d=-0.01).
- Standard ego × SEL (cells 22-27, eval-2026-04-17-4a9b765a, Haiku × Sonnet, n=22-24 per cell, 141/144 judged): non-monotonic (susp d=1.25, adv d=0.53, advocate d=1.09).
- Cells 40-45 × SEL (clean architecture-matched domain test): deferred on cost grounds.
- Learner-side disposition variants: out of scope for v4; requires new cells.
- Artifacts: `scripts/analyze-d4-disposition-gradient.js`, `exports/d4-disposition-gradient.md`.

---

## E. Known Bugs & Workarounds

### ~~E1. Superego JSON Parse Failures~~ (FIXED in tutor-core)
~~Kimi K2.5 returns malformed JSON 16-45% of turns, causing silent auto-approve.~~
Fixed: `jsonrepair` library added to `parseJsonWithFallback()` in tutor-core's `tutorDialogueEngine.js`. Now tries `jsonrepair()` between initial `JSON.parse()` failure and model-retry fallback. Handles trailing commas, unescaped quotes, control characters, and other common LLM JSON malformations. Adversary prompt has lowest failure rate (11.5%) — prompt structure still affects reliability.
- Paper ref: Section 8.2 Future Direction #10

### ~~E2. GPT Rejudge Duplicate Rows~~ (FIXED)
~~`rejudge` without `--overwrite` can create 2x rows per response.~~
Fixed: `rejudgeRun()` now resolves the target judge label and skips responses already
judged by that judge in prior calls. Within-call dedup by suggestion content also preserved.

### ~~E3. Context Scoping Bug~~ (FIXED — robust)
~~When scenarios lack `current_content`, content resolution can leak cross-domain.~~
Fixed comprehensively:
1. Dangerous `listAvailableCourses()` fallback removed from `contentResolver.js`
2. All scenarios have `course_ids` defined
3. Prompt contamination fixed (hardcoded lecture IDs replaced with placeholders)
4. Test coverage validates scenario-content alignment
- Regression prevention: `validate-config` CLI command (B4) now provides automated validation

---

## Status Legend

- **CRITICAL** — Blocks publication-quality claims
- **HIGH** — Would significantly strengthen findings
- **MEDIUM** — Valuable improvement, not blocking
- **LOW** — Nice-to-have, opportunistic
