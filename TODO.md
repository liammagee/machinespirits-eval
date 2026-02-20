# Future Development TODO

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

### A5. Writing Pad Controlled Ablation (MEDIUM — design ready, not yet run)
Writing Pad activation coincides with quality improvement, but no controlled ablation exists.

**Current state:**
- Writing Pad is a Freudian three-layer memory system (conscious/preconscious/unconscious) in tutor-core
- Enabled via `writing_pad_enabled: true` in YAML profiles — no CLI toggle
- All cells 22+ have it enabled; cells 1-20 do not
- Persists per-learner within a multi-turn dialogue (synthetic learnerId per dialogue)

**Experimental design:**
- **Approach**: Create paired cells that differ ONLY in `writing_pad_enabled`. Best candidates are cells 40/41 (self-reflective base/recog) since they use all advanced features including Writing Pad.
- **New cells needed**:
  - Cell 80: Clone of cell 40 (base_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
  - Cell 81: Clone of cell 41 (recog_dialectical_selfreflect_unified) with `writing_pad_enabled: false`
- **Scenarios**: Multi-turn only (mutual_transformation_journey, epistemic_resistance_impasse, affective_shutdown_impasse, productive_deadlock_impasse, misconception_correction_flow, mood_frustration_to_breakthrough) — Writing Pad effects only manifest across turns
- **Runs**: 3 per cell (N = 4 cells × 3 runs × 6 scenarios = 72 rows)
- **Controls**: Cells 40/41 (with Writing Pad) serve as within-experiment controls

**Prerequisites:**
- [ ] Define cells 80-81 in `tutor-agents.yaml` (clone 40/41, set `writing_pad_enabled: false`)
- [ ] Register cells 80-81 in `EVAL_ONLY_PROFILES` array in `evaluationRunner.js`

**Commands:**
```bash
# Run ablation (all 4 cells together for matched conditions)
node scripts/eval-cli.js run --profiles cell_40_base_dialectical_selfreflect_unified,cell_41_recog_dialectical_selfreflect_unified,cell_80_base_dialectical_selfreflect_unified_nopad,cell_81_recog_dialectical_selfreflect_unified_nopad --runs 3 --description "A5 Writing Pad ablation"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- 2×2 ANOVA: recognition (base/recog) × Writing Pad (on/off)
- Key metrics: state retention across turns, prompt coherence, cumulative learning progression
- Per-turn trajectory analysis: does Writing Pad improve later turns more than early ones?
- Check interaction: does Writing Pad benefit recognition more than base?
- Paper ref: Section 8.1 Limitation #10

### A6. Domain Expansion (MEDIUM — design ready, requires content authoring)
Only 2 domains tested (philosophy via course 479, elementary math via course 101).

**Current infrastructure:**
- Content switching via env vars: `EVAL_CONTENT_PATH` and `EVAL_SCENARIOS_FILE`
- Course 479 (EPOL philosophy, 8 lectures) — primary evaluation domain
- Course 101 (elementary fractions, 2 lectures) — test domain, minimal scenarios
- All 18 current scenarios reference only course 479

**Experimental design:**
- **Phase 1 — Expand existing math domain** (lowest effort):
  - Author 4-6 more elementary math scenarios for course 101 (matching complexity levels of core philosophy scenarios)
  - Run cells 1 vs 5 (base vs recog) on math scenarios to test recognition transfer
  - N = 2 cells × 3 runs × ~6 scenarios = 36 rows
- **Phase 2 — New STEM domain** (medium effort):
  - Author course 201: introductory programming (variables, loops, debugging)
  - 4-6 lectures + 6-8 scenarios covering: misconceptions, frustration, impasse, growth
  - Run same cells 1 vs 5 on programming domain
- **Phase 3 — Creative/social-emotional** (higher effort):
  - Course 301: creative writing feedback
  - Course 401: social-emotional learning
  - These test whether recognition transfers to non-analytical domains

**Prerequisites (Phase 1):**
- [ ] Author additional math scenarios in `content-test-elementary/scenarios-elementary.yaml`
- [ ] Ensure scenario structure matches core scenarios (course_ids, follow_up_actions, etc.)
- [ ] Validate with `eval-cli.js validate-config`

**Commands (Phase 1):**
```bash
# Run math domain evaluation
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --description "A6 domain expansion: elementary math"

# Judge
node scripts/eval-cli.js evaluate <runId>
```

**Analysis:**
- Compare recognition delta across domains: is the effect size domain-dependent?
- Per-scenario breakdown: which scenario types transfer recognition benefit?
- Develop deployment rubric: recognition ROI by domain characteristics
- Paper ref: Section 8.2 Future Direction #3

### A7. Longitudinal Multi-Session Evaluation (LOW — requires infrastructure work)
Single-session evaluation cannot capture accumulated understanding.

**Current infrastructure gaps:**
- Writing Pad persists within a dialogue but NOT across dialogues (synthetic learnerId per dialogue is orphaned after run)
- No session persistence table (`session_id` field in tutor-core DB exists but is always NULL, marked "TODO: Phase 3")
- No CLI flags for session management (`--session-id`, `--resume-session`)
- No cross-dialogue learner continuity mechanism

**Experimental design:**

- **Phase 1 — Infrastructure** (prerequisite):
  - [ ] Implement persistent session table in tutor-core DB linking learnerIds across dialogues
  - [ ] Add `--session-id <id>` CLI flag to eval-cli.js to resume a learner's session
  - [ ] Add `--learner-id <id>` flag to reuse an existing Writing Pad across runs
  - [ ] Ensure Writing Pad unconscious layer carries forward (recognition moments, learner archetypes)

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

### A9. Cells 34-39 Full Run (LOW — superseded)
Full-feature dialectical cells (cross-turn memory + prompt rewriting + learner signals). Early N=20 results showed recognition delta only +1.0, below cells 28-33's +4.5.
- Superseded by cells 40-65: cells 34-39 lack `superego_disposition_rewriting` and use generic `strategy: llm` rewriting; cells 40-45 add both improvements
- YAML definitions kept as historical documentation with DEPRECATED header
- No strong reason to run unless isolating the effect of superego disposition rewriting itself

---

## B. Code Quality & Infrastructure

### ~~B1. Test Coverage Gaps~~ (DONE)
Tests added for `processUtils.js` (4 tests), `streamingReporter.js` (8 tests), `progressLogger.js` (13 tests), and `learnerConfigLoader.js` (36 tests). `mockProvider.js` already tested in `dryRun.test.js`.
Remaining untested (low priority):
- `services/promptRecommendationService.js` — 508 LOC, hard to test (requires API mocking), optional feature

### ~~B2. Silent Error Handling~~ (FIXED)
- ~~`learnerTutorInteractionEngine.js` JSON parse failures~~ — Now logs warning with status code on parse failure
- ~~`evaluationStore.js` empty migration catches~~ — Replaced 20+ bare catches with `migrateAddColumn()` helper that only ignores "duplicate column name"/"already exists", throws on real errors
- `promptRewriter.js` — Synthesis failures still return null with console.error. Lower priority: upstream code handles null gracefully with template fallback.

### ~~B3. Hardcoded Constants~~ (FIXED)
- ~~HTTP timeout 60000ms in `rubricEvaluator.js`~~ — Extracted to `API_CALL_TIMEOUT_MS` constant (6 occurrences)
- ~~Inconsistent inline `30 * 60 * 1000` in `evalRoutes.js:1055`~~ — Now uses `TIMEOUT_WARNING_MS` constant
- `learnerTutorInteractionEngine.js:893` — Already a named constant (`LEARNER_RETRY_DELAYS`), could be centralized
- `contentResolver.js:17-19` — Already configurable via `configure()` method, no action needed

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

### C5. Short Paper Staleness (STALE)
`docs/research/paper-short.md` at v2.3.14-short with N=3,383 across thirty-seven evaluations. Full paper now at v2.3.16 with N=4,144 across forty-eight. Needs substantive update if submitting short version.

### ~~C6. Test Directory Convention~~ (DOCUMENTED)
~~Tests split between `tests/` and `services/__tests__/`.~~
Documented in CLAUDE.md: `tests/` for integration tests, `services/__tests__/` for co-located unit tests.

---

## D. Theoretical / Mechanistic Research

### D1. Mechanistic Understanding (OPEN RESEARCH)
Why does recognition-oriented prompting change model behavior? What internal representations shift?
- Activation analysis, attention patterns, gradient analysis
- Paper ref: Section 8.2 Future Direction #4

### D2. Cross-Application Transfer (OPEN RESEARCH)
Test recognition-oriented design beyond tutoring:
- Mental health chatbots, customer service, creative writing feedback, code review
- Paper ref: Section 8.2 Future Direction #5

### D3. Insight-Action Gap (PARTIALLY ADDRESSED)
Self-reflection produces awareness without behavioral change; profiling produces adaptation.
- Measure gap quantitatively (semantic similarity of reflections vs behavior)
- Test whether explicit directive bridges gap
- Paper ref: Finding 11

### D4. Disposition Gradient Replication
Hostile superegos become productive under recognition (suspicious +19.0, adversary +10.9, advocate +2.6). Untested on other domains.
- Replicate on other domains/scenarios
- Test on learner side

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
