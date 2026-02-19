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

### A2. Dynamic Learner Mechanism Sweep (HIGH)
Only 4 of 9 mechanisms tested with dynamic (ego_superego) learners. Scripted learner confound masks mechanism differentiation.
- **Untested with dynamic learner**: quantitative disposition (46-47), prompt erosion (48-49), tutor-only profiling (54-55)
- Cells 64-65 (intersubjective + combined) are recognition-only; no base pairs defined
- Full 2x9 matrix (recognition x mechanism) with dynamic learner would complete the story
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

### A8. Active Control Rerun on Kimi K2.5 (LOW)
Active control used Nemotron while factorial used Kimi. Model confound acknowledged but not resolved.
- Rerun active control on Kimi K2.5 for direct comparability
- Paper ref: Section 8.1 Limitation #4

### A9. Cells 34-39 Full Run (LOW — superseded)
Full-feature dialectical cells (cross-turn memory + prompt rewriting + learner signals). Early N=20 results showed recognition delta only +1.0, below cells 28-33's +4.5.
- Superseded by cells 40-65: cells 34-39 lack `superego_disposition_rewriting` and use generic `strategy: llm` rewriting; cells 40-45 add both improvements
- YAML definitions kept as historical documentation with DEPRECATED header
- No strong reason to run unless isolating the effect of superego disposition rewriting itself

---

## B. Code Quality & Infrastructure

### B1. Test Coverage Gaps (MEDIUM)
6 services have no test coverage:
- `services/learnerConfigLoader.js` — Learner persona loading
- `services/promptRecommendationService.js` — Prompt recommendations (possibly unused)
- `services/processUtils.js` — Process utilities
- `services/progressLogger.js` — Logging utility
- `services/streamingReporter.js` — Streaming response reporting
- `services/mockProvider.js` — Mock API provider

### B2. Silent Error Handling (MEDIUM)
Multiple locations swallow errors silently:
- `learnerTutorInteractionEngine.js:976,1012,1050,1110` — JSON parse failures return `{}` with no logging
- `evaluationStore.js:113-230` — 20+ migration blocks with empty catch (can't distinguish "column exists" from corruption)
- `promptRewriter.js:497,734,909,1149,1554,1789,1882,2001` — Synthesis failures logged but unstructured

### B3. Hardcoded Constants (LOW)
- HTTP timeout 60000ms appears 6 times in `rubricEvaluator.js` — extract to constant
- Stream timeout/warning thresholds in `evalRoutes.js:61-62` — make configurable
- Learner retry delays in `learnerTutorInteractionEngine.js:893` — extract to config
- Content resolver limits in `contentResolver.js:17-19` — initialize from env

### B4. Configuration Validation CLI (LOW)
No runtime validation of cell definitions. Potential issues:
- `prompt_type` references nonexistent prompts
- Factor combinations invalid
- Learner architectures unavailable
- Scenarios missing `course_ids` (context scoping bug)
Implement: `node scripts/eval-cli.js validate-config`

### B5. Centralized Error Reporting (LOW)
Error reporting scattered across 4+ destinations (progressLogger, reporter, console, DB). Consider unified error handler.

### B6. Judge Model Metrics (LOW)
No tracking of judge response times, success rates, or parse error rates per judge model. Would help diagnose judge drift.

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

### E1. Superego JSON Parse Failures (TUTOR-CORE — not fixable here)
Kimi K2.5 returns malformed JSON 16-45% of turns, causing silent auto-approve.
- Auto-approve fallback in `tutor-core/services/tutorDialogueEngine.js:1574-1582`
- Superego parsing uses only 2-tier fallback (parse + retry with stronger model)
- `jsonrepair` library is available but only used in judge path (`rubricEvaluator.js`), not superego path
- Adversary prompt has lowest failure rate (11.5%) — prompt structure affects reliability
- **Fix lives in tutor-core repo**, not this repo
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
- Regression prevention: automated validation would help (see B4) but current fix is robust

---

## Status Legend

- **CRITICAL** — Blocks publication-quality claims
- **HIGH** — Would significantly strengthen findings
- **MEDIUM** — Valuable improvement, not blocking
- **LOW** — Nice-to-have, opportunistic
