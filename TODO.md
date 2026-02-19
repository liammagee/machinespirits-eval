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

### A9. Cells 34-39 Full Run (LOW — possibly superseded)
Full-feature dialectical cells (cross-turn memory + prompt rewriting + learner signals). Early N=20 results showed recognition delta only +1.0, below cells 28-33's +4.5.
- Mechanisms may be superseded by cells 40-65 exploration
- Run or formally deprecate

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

### C1. Stale Files
- [x] `data/eval-results.db` — 0 bytes, orphaned; delete
- [ ] `scripts/generate-paper-figures.py` — superseded by `.js` version; delete
- [ ] `data/evaluations.db.bak-*` — 3 backups totaling ~156 MB; archive or delete old ones

### C2. Deprecated Notation
- `scripts/analyze-judge-reliability.js` lines 4-6, 42-44, 68-69 — contains deprecated `openrouter/` slash notation in example commands; update to dot notation

### C3. Legacy Cell Names in DB
- `cell_1` (shorthand) coexists with `cell_1_base_single_unified` (canonical) in DB
- Document or migrate for consistency

### C4. Cells 34-39 YAML Definitions
Already marked deprecated in YAML. Either:
- Remove definitions entirely (reducing cognitive load)
- Keep with clear DEPRECATED header (current state)

### C5. Short Paper Staleness
`docs/research/paper-short.md` not updated since v2.3.0; full paper is v2.3.14.
- Refresh if needed for circulation, or mark as archived

### C6. Test Directory Convention
Tests split between `tests/` and `services/__tests__/`. Document the convention or consolidate.

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

### E1. Superego JSON Parse Failures (DOCUMENTED)
Kimi K2.5 returns malformed JSON 16-45% of turns, causing silent auto-approve.
- Implement structured output enforcement or retry logic
- Adversary prompt has lowest failure rate (11.5%) — prompt structure affects reliability
- Paper ref: Section 8.2 Future Direction #10

### E2. GPT Rejudge Duplicate Rows (DOCUMENTED)
`rejudge` without `--overwrite` can create 2x rows per response.
- Workaround: dedup with `ROW_NUMBER()`
- Consider adding dedup check to rejudge command

### E3. Context Scoping Bug (FIXED but fragile)
When scenarios lack `current_content`, content resolution can leak cross-domain.
- Fixed by adding `course_ids` to scenarios
- No automated validation prevents regression
- Related to B4 (config validation)

---

## Status Legend

- **CRITICAL** — Blocks publication-quality claims
- **HIGH** — Would significantly strengthen findings
- **MEDIUM** — Valuable improvement, not blocking
- **LOW** — Nice-to-have, opportunistic
