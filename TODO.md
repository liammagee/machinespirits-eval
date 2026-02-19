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

### A2. Dynamic Learner Mechanism Sweep (HIGH — cells defined, not yet run)
Only 4 of 9 mechanisms tested with dynamic (ego_superego) learners. Scripted learner confound masks mechanism differentiation.
- ~~Cells 64-65 (intersubjective + combined) are recognition-only; no base pairs defined~~ — Fixed: cells 69-70 added
- ~~**Untested with dynamic learner**: quantitative disposition (46-47), prompt erosion (48-49), tutor-only profiling (54-55)~~ — Fixed: cells 72-77 defined
  - 72/73: quantitative disposition (base/recog) × ego_superego
  - 74/75: prompt erosion (base/recog) × ego_superego
  - 76/77: tutor-only profiling (base/recog) × ego_superego
- **Next step**: Run cells 72-77 (`eval-cli.js run --profiles cell_72_...,cell_73_... --runs 3`) and judge
- Full 2×7 matrix (recognition × mechanism) with dynamic learner now fully defined
- Paper ref: Section 8.2 Future Direction #7, Finding 11

### A3. Capability Threshold Mapping (MEDIUM)
Nemotron falls below and Haiku falls above the minimum ego capability threshold for mechanism benefit. The threshold boundary is unmapped.
- Test 3-4 intermediate models (GLM-4.7, DeepSeek V3.2, others)
- Identify model properties that predict mechanism effectiveness
- Correlate: context window, parameter count, instruction-following quality
- Paper ref: Section 8.2 Future Direction #11

### A4. Learner Superego Redesign (MEDIUM)
Current learner ego/superego degrades learner quality (d=1.43). Hypothesis: superego optimizes for "good student" not "authentic student."
- Re-engineer learner superego to critique for inauthenticity, not correctness
- A/B test: current vs authenticity-focused superego
- Paper ref: Section 8.2 Future Direction #6

### A5. Writing Pad Controlled Ablation (MEDIUM)
Writing Pad activation coincides with quality improvement, but no controlled ablation exists.
- Run Writing Pad ON/OFF with all else held constant
- Measure state retention, prompt coherence, cumulative learning
- Paper ref: Section 8.1 Limitation #10

### A6. Domain Expansion (MEDIUM)
Only 2 domains tested (philosophy, elementary math).
- Expand to: technical STEM, creative writing, social-emotional content
- Develop deployment rubric: when recognition is worth the cost
- Paper ref: Section 8.2 Future Direction #3

### A7. Longitudinal Multi-Session Evaluation (LOW)
Single-session evaluation cannot capture accumulated understanding.
- Multi-session study (8-12 sessions)
- Track: accumulated memory, repair quality, transformation trajectories
- Paper ref: Section 8.2 Future Direction #2

### A8. Active Control Rerun on Kimi K2.5 (IN PROGRESS)
Active control used Nemotron while factorial used Kimi. Model confound acknowledged but not resolved.
- **Wrong cells run first**: eval-2026-02-19-e000a987 used cells 9-12 (enhanced), not 15-18 (placebo). N=64 scored, 77% hallucination rate. Enhanced prompt causes catastrophic context loss on Kimi — confirms "prompt elaboration hurts strong models" but doesn't address A8.
- **Correct run**: eval-2026-02-19-f2263b04 uses cells 15-18 (placebo) on Kimi K2.5. In progress (~25% complete). ~50% hallucination rate (Kimi baseline artifact). Grounded rows (N=22 so far): placebo Kimi ~69, base Kimi ~73, recognition Kimi ~80. Gap concentrates in theory-dependent dimensions (mutual_recognition, dialectical_responsiveness, transformative_potential).
- Early finding: model confound accounts for ~5 pts (Nemotron placebo 66.5 → Kimi placebo ~69). Recognition advantage (~11 pts over placebo on same model) holds after removing confound.
- Kimi hallucination rate (~20-50% depending on scenario complexity) is a known baseline artifact across all runs, not specific to this experiment.
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

### B5. Centralized Error Reporting (LOW)
Error reporting scattered across 4+ destinations (progressLogger, reporter, console, DB). Consider unified error handler.

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

### ~~C5. Short Paper Staleness~~ (ALREADY RESOLVED)
~~`docs/research/paper-short.md` not updated since v2.3.0~~
Already at v2.3.14-short with current N=3,383 counts. No action needed.

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
