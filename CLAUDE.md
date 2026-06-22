# Project Memory for Claude

## This fork

This is `machinespirits-eval-dramatic` — a fork of `machinespirits-eval` specialised for the **Dramatic Recognition / Poetics** arc (sanctioned 2026-05-19). Master plan: `DRAMATIC-RECOGNITION-PLAN.md`. The full eval-factorial machinery below (cells 1–125, ego-superego, adaptive runner, rubrics v2.2) is inherited unchanged; the *active* work lives in the poetics pipeline and lands as a new § of `docs/research/paper-full-2.0.md`. Sibling agent docs at repo root: `AGENTS.md` (Codex), `GEMINI.md`.

## Desktop app (Electron)

There is an Electron desktop app that is the **exact equivalent of the web UX and stays in sync by construction** — it embeds the unchanged Express stack and loads the web UI over loopback, so there is ONE UI codebase. It lives under `desktop/` on branch `claude/electron-desktop-app` (worktree `../machinespirits-eval-electron`).

**To change the UX (web AND desktop), edit the web stack** — `public/**`, the route renderers in `scripts/browse-poetics-scripts.js`, `routes/**`, `services/**`, or the shared mounter `services/evalSurfaces.js`. The desktop updates automatically; **never fork UI into `desktop/`.** Full rules + file map: `desktop/ARCHITECTURE.md`. Run/build/use docs: `desktop/README.md`.

The sync contract is enforced by tests — `npm run desktop:test` (Electron's Node in that worktree), or the same tests under `npm test` on the Node ABI in CI: route-parity (desktop serves exactly the web route table), no UI files in `desktop/`, one-way dependency (`services/`/`routes/`/`public/` never import `desktop/`). If you add a new **writable** store anywhere in the stack, give it an env override and relocate it in `desktop/paths.js`, else the packaged read-only/asar app crashes at boot (currently relocated: `EVAL_DB_PATH`, `EVAL_LOGS_DIR`, `EVAL_EXPORTS_DIR`, `AUTH_DB_PATH`, `EVAL_WRITING_PAD_DIR`, `TUTOR_CORE_LOG_DIR`). Native modules (`better-sqlite3`, `node-pty`) are rebuilt for Electron's ABI by `npm run desktop:rebuild`, so plain `node`/`npm test` won't load them in that worktree — use a fresh checkout for the Node-ABI suite.

## Core Architecture

### Tutor-core (in-housed)

The Ego/Superego dialogue engine, AI-provider abstraction, and base config/prompts were vendored from the `@machinespirits/tutor-core` npm package into the in-repo `tutor-core/` module (2026-05-30 — see `TUTOR-CORE-INHOUSING.md` for the migration plan + re-externalization note). Import it via **relative paths** (`../tutor-core/index.js`, `../tutor-core/services/<x>.js`), NOT the old `@machinespirits/tutor-core` specifier; there is no longer a peerDependency. tutor-core resolves its *own* bundled `tutor-core/config` + `tutor-core/prompts` (base profiles); the eval layer remaps cells 1–125 onto those via `resolveEvalProfile`, and `services/localPromptLoader.js` makes the eval repo's `prompts/` authoritative for eval-side callers. Keep the seam clean: `tutor-core/**` must never import back into the eval repo (one-way dependency), so it stays re-extractable. `tutor-core/` is excluded from the eval repo's eslint/prettier (it carries its own upstream style).

### Bilateral Ego-Superego Architecture

Both tutor AND learner have dynamic LLM-powered ego-superego architectures:

**Tutor (services in the in-housed `tutor-core/` module — see "Tutor-core (in-housed)" above):**
- Ego generates initial response
- Superego critiques for pedagogical soundness
- Ego revises based on feedback (final authority)

**Learner (services/learnerTutorInteractionEngine.js):**
- Ego generates initial reaction to tutor
- Superego critiques (is it too superficial? what's being missed?)
- Ego revision produces final external message

The learner is NOT scripted — it's a full LLM agent with its own deliberation. Multi-turn scenarios in `config/suggestion-scenarios.yaml` define initial prompts, but actual learner responses are LLM-generated via `generateLearnerResponse()`.

**Bilateral transformation measurement** tracks evolution of BOTH sides:
- `adaptationIndex`: How much tutor approach changes between turns
- `learnerGrowthIndex`: How much learner messages evolve (complexity, revision markers)
- `bilateralTransformationIndex`: Combined measure of mutual change

Related services:
- `services/turnComparisonAnalyzer.js` — Turn-over-turn evolution tracking
- `services/dialogueTraceAnalyzer.js` — Superego feedback incorporation analysis
- `services/learnerConfigLoader.js` — Learner personas and profiles

### Human Learner Pilot (engineering complete 2026-04-25)

Pilot infrastructure for human-learner validation lives at:
- `services/pilotStore.js` — 4 tables in `data/evaluations.db` (`pilot_sessions`, `pilot_turns`, `pilot_test_items`, `pilot_exit_survey`)
- `routes/pilotRoutes.js` — 13 endpoints (enroll → consent → intake → pretest → tutoring → posttest → exit, plus token-gated admin)
- `public/pilot/index.html` — single-file Alpine.js participant UI
- `services/pilotItemBank.js` + `config/pilot/fractions-items.yaml` — form-counterbalanced item bank with server-side scoring
- `scripts/ingest-pilot-sessions.js` — completed pilot sessions → `evaluation_results` rows + dialogue logs (idempotent), so `eval-cli evaluate <runId>` can score real-learner transcripts under v2.2 alongside simulated ones

Recruitment is gated on IRB approval / real consent text / real item content (see `TODO.md` §A1).

### Tutor-Learner Symmetry (Design Principle)

Always aim for absolute symmetry between tutor and learner trace labels, scoring pipelines, and data structures. When adding or modifying one side, mirror the change on the other.

**Trace agent/action labels** must be symmetric:
- Tutor: `tutor/context_input` → `ego/generate` → `superego/review` → `tutor/final_output`
- Learner: `learner/turn_action` → `learner_ego_initial/deliberation` → `learner_superego/deliberation` → `learner_ego_revision/deliberation` → `learner/final_output`

**Backward compat**: consumers must accept both old (`user`) and new (`tutor`/`learner`) agent labels, since existing dialogue log files on disk use the old format. Pattern: `(entry.agent === 'tutor' || entry.agent === 'user')`.

**Scoring pipeline** must be symmetric:
- Every tutor turn gets scored with the tutor rubric
- Every learner turn gets scored with the learner rubric
- Both aggregate to per-turn scores, first/last/overall/development metrics

Do NOT use asymmetric names. When in doubt, check the other side's labels and mirror them exactly.

## Configuration

### How to Read a Cell's Architecture

**RULE: Never guess a cell's architecture from its number or name. Always check `config/tutor-agents.yaml`.**

A cell's architecture is determined by these YAML fields:

| Field | What it controls |
|-------|-----------------|
| `factors.multi_agent_tutor` | Whether tutor has ego+superego (true) or ego-only (false) |
| `superego:` | `null` = no superego agent; configured block = superego present |
| `learner_architecture:` | `unified` = scripted learner; `ego_superego` = dynamic LLM learner |
| `factors.prompt_type:` | `base`, `recognition`, `enhanced`, `placebo`, `dialectical_*`, `naive` |
| `conversation_mode:` | absent = single-prompt; `messages` = multi-turn message chain |
| `dialogue.enabled:` | Whether ego-superego deliberation loop is active |
| `recognition_mode:` | Whether Hegelian recognition theory is in prompts |

**Key relationships:**
- `multi_agent_tutor: false` + `superego: null` = single-agent tutor (ego only, no deliberation)
- `multi_agent_tutor: true` + `superego: null` = tutor has self-reflection/profiling mechanisms but no separate superego agent
- `multi_agent_tutor: true` + `superego:` configured = tutor has distinct superego agent
- `learner_architecture: unified*` = learner messages come from scenario YAML (scripted)
- `learner_architecture: ego_superego*` = learner is a full LLM agent with internal deliberation

### Tutor Agent Cells (config/tutor-agents.yaml)

**Cells 1-8: 2×2×2 factorial** (base/recog × single/multi × unified/ego_superego)
- Odd cells: unified learner. Even cells: ego_superego learner.
- Cells 1-2: base, single. Cells 3-4: base, multi (superego configured). Cells 5-6: recog, single. Cells 7-8: recog, multi (superego configured).

**Cells 9-20: Prompt ablations** (all unified learner)
- 9-12: Enhanced prompts (single/multi × unified/psycho)
- 13-14: Hardwired rules (superego rules embedded in ego prompt)
- 15-18: Placebo control (length-matched, no recognition theory)
- 19-20: Memory isolation (recognition vs memory disentangling)

**Cell 21: Dynamic prompt rewriting** with Writing Pad

**Cells 22-33: Divergent superego variants** (superego configured, unified learner)
- 22-27: Standard ego + divergent superego (suspicious/adversary/advocate × base/recog)
- 28-33: Dialectical ego + divergent superego

**Cells 34-39: Full-feature dialectical** (superego null, unified learner, DEPRECATED)

**Cells 40-59: Mechanism variants** (superego null, unified learner)
- 40-45: Self-reflective evolution (suspicious/adversary/advocate × base/recog)
- 46-47: Quantitative disposition (base/recog)
- 48-49: Prompt erosion (base/recog)
- 50-51: Intersubjective recognition (base/recog)
- 52-53: Combined mechanisms (base/recog)
- 54-59: Other-ego profiling (tutor-only/bidirectional/full-suite/strategy)

**Cells 60-70, 72-79: Dynamic learner mechanism variants** (superego null, ego_superego learner)
- 60-63: Self-reflection/profiling × base/recog
- 64-65: Intersubjective/combined (recognition only)
- 66-68: Cognitive prosthesis variants
- 69-70: Base intersubjective/combined
- 72-77: A2 sweep (quantitative/erosion/tutor-profiling × base/recog)
- 78-79: Authentic learner variants

**Cell 71: Naive baseline** (no recognition, no superego, minimal prompt)

**Cells 80-92: Messages-mode variants** (conversation_mode: messages)
- 80-83: Base (single/multi × unified/psycho) — 82-83 have superego configured
- 84-90: Recognition — 86-89 have superego configured; 84, 85, 90 are single-agent (superego null)
- 91-92: Recognition gemflash variants

**Cells 93-100: Superego variant ablations** (refining the dialectical_suspicious mechanism)
- 93-94: nopad (no Writing Pad), 95: matched, 96: behaviorist, 97: directive, 98: two_pass, 99: coupling, 100: best_of_n

**Cells 101-109: Id-director charisma family** (`factors.id_director: true`)
- New architecture: per-turn id-construction trace persisted to the `id_construction_trace` column.
- Scored against `config/evaluation-rubric-charisma.yaml` (Weber-derived 8-dimension, v1.0, independent of v2.2 tutor rubric).
- 101-104: charisma + register variants; 105-106: tuned (charisma vs pedagogy); 107-109: witness/exemplars variants.

**Cells 110-125: Trap-scenario suite** (scenarios from `config/adaptive-trap-scenarios.yaml` unless noted; cells 115-123 are the P2.1 bilateral-ToM / P2.2 state-schema ablations — see `config/tutor-agents.yaml` and §6.8.5–.6 for those)
- 110: `cell_110_langgraph_adaptive` — `runner: adaptive`; LangGraph state-policy + counterfactual replay; bypasses tutor-core's dialogue engine. Implementation in `services/adaptiveTutor/`.
- 111-113: `runner: adaptive`; A13 pre-registration conditions (C1 recognition_only, C2 egosuperego, C4 validator) — all use the same adaptive runner so `strategy_shift_correctness` is comparable across cells.
- 114: `cell_114_dialogue_engine_trap_baseline` — `runner: standard`; tutor-core's base single-agent ego (= `budget` profile, no superego) driven on the *same* v1 trap suite with the *same* trap-steered LLM learner (`learnerTurn` mechanism). Adapter: `scripts/run-dialogue-engine-trap-baseline.js`. Post-hoc exploratory cross-architecture floor — NOT in the A13 pre-registration. Result: §6.8.4.
- 124-125: `cell_124_langgraph_adaptive_crosssuite` (`runner: adaptive`, cell_110's `state_policy` architecture) + `cell_125_dialogue_engine_crosssuite_baseline` (`runner: standard`, cell_114's dialogue-engine architecture), both on `config/cross-suite-trap-scenarios.yaml` — §6.8.7's "clean cross-suite test": six trap-annotated scenarios re-derived from the §6.3 suggestion suite, scored with the same binary `strict_shift`. cell_125 runs via the same `run-dialogue-engine-trap-baseline.js` adapter (it reads `profile.scenario_source`). Result: §6.8.7.

**Superego presence summary**: Only cells with `multi_agent_tutor: true` AND an explicit superego block have an active superego agent. These are: 3-4, 7-8, 11-12, 17-18, 22-33, 82-83, 86-89. All other cells (including 34-79, 80-81, 84-85, 90, 95-96, 101-109) have `superego: null`.

**Cell registry (source-of-truth):** the canonical list of registered cell names is the `EVAL_ONLY_PROFILES` array in `services/evaluationRunner.js` (~line 100). When in doubt about whether a name is registered, grep there — not this doc.

### Adding New Cells

New eval-repo cells must be registered in the `EVAL_ONLY_PROFILES` array in `services/evaluationRunner.js` (line ~100). Without this, `resolveEvalProfile()` won't remap cell names to tutor-core profiles, and the run will silently fall back to the default profile.

Cell names must include "dialectical" if they use `prompt_type: dialectical_suspicious` (test enforced).

### Runner Dispatch (`runner:` field)

Cells with `runner: adaptive` in `tutor-agents.yaml` bypass `evaluationRunner.js` and tutor-core's dialogue engine entirely, dispatching to `services/adaptiveTutor/` (LangGraph-based: externalised learner state + programmatic constraints + counterfactual replay). Cells without a `runner:` field use the default runner.

- **Implementation**: `services/adaptiveTutor/{index,runner,graph,persistence,llm,realLLM,mockLLM,budgetTracker,policyActions,stateSchema}.js`
- **Scenarios**: `config/adaptive-trap-scenarios.yaml` (NOT `suggestion-scenarios.yaml`); `config/cross-suite-trap-scenarios.yaml` for the §6.8.7 cross-suite cells (124-125). Both runners + both scorers (`analyze-strategy-shift.js`, `grade-adaptive-dialogue.js`) read either file unchanged — same scenario schema.
- **Mock vs real LLM**: `ADAPTIVE_TUTOR_LLM=mock` (default, deterministic — no paid API calls) or `ADAPTIVE_TUTOR_LLM=real` (uses normal provider env vars, e.g. `OPENROUTER_API_KEY`)
- **Smoke scripts**: `scripts/run-adaptive-cell-smoke.js`, `scripts/run-adaptive-persistence-smoke.js`, `scripts/run-langgraph-smoke.js`
- **Active cells**: 110 (langgraph_adaptive), 111-113 (A13 conditions C1/C2/C4), 124 (cross-suite, §6.8.7). NOTE cells 114 and 125 use `runner: standard` (tutor-core dialogue engine) on the trap suites — their own adapter script (`run-dialogue-engine-trap-baseline.js`), not this runner.

### Id-Director Architecture (cells 101-109)

Cells with `factors.id_director: true` use `services/idDirectorEngine.js`. Per turn, the engine constructs an explicit "id" persona JSON envelope and persists it to the `id_construction_trace` column. Used to study charismatic pedagogy: scored against `config/evaluation-rubric-charisma.yaml` (Weber-derived 8-dimension, v1.0, independent of the v2.2 tutor rubric — they can be cross-correlated).

### Hermetic Testing & Sandboxed Runs

`EVAL_DB_PATH` and `EVAL_LOGS_DIR` override the default DB / logs locations (`services/evaluationStore.js`, `services/adaptiveTutor/persistence.js`). Used by:
- `npm run test:hermetic` — runs the full test suite against `mktemp -d` paths so the production DB and logs are never touched
- Adaptive smoke scripts (combined with `ADAPTIVE_TUTOR_LLM=mock` for fully self-contained, no-cost runs)
- Any test that needs full DB+logs isolation

### Placebo Control Design

Placebo prompts (`prompts/tutor-ego-placebo.md`, `prompts/tutor-superego-placebo.md`):
- Match length/complexity of recognition prompts
- Contain pedagogical best practices
- Remove all Hegelian theory (mutual recognition, autonomous subject, etc.)
- Enable 3-way comparison: enhanced vs placebo vs recognition

### Poetics / Dramatic Recognition (active workstream)

Treats the tutoring dialogue as a *drama* and the evaluator as a *literary critic* — scored on dramatic form (peripeteia + anagnorisis) at the **whole-transcript** level, not per-turn. Design doc: `DRAMATIC-RECOGNITION-PLAN.md`. Working notes (live): `notes/poetics/` (dated files).

- **Rubric**: `config/evaluation-rubric-poetics.yaml` (v1.0, Aristotle-derived, 6 dimensions) — independent of v2.2 tutor and charisma rubrics; can be cross-correlated.
- **Generation**: `npm run drama:generate` (scripts/drama-generator.js)
- **Ingest & report**: `npm run poetics:ingest`, `npm run poetics:report`, `npm run poetics:browse` (local web UI for transcripts)
- **Adaptation loop**: `npm run poetics:adaptation-loop`, `poetics:audit-quality`, `poetics:diagnose-adaptation`
- **Scoring**: `poetics:score-sonnet`, `poetics:structure-critic`, `poetics:flag-review`, `poetics:audit` (cross-critic disagreement)
- **Packaging**: `npm run poetics:package-run` (archive a run's artifacts for sharing)
- **Outputs**: `exports/phase2-classic-drama-*` (pilot reports, adaptation failures, tutor-adaptation csvs)

Note: phase-2 transfer of the codex-trained instrument to tutoring transcripts FAILED (weighted κ ≈ 0.04 vs ≥0.60 target) — the instrument classifies dramatic form, NOT mind-reading or real learning. Treat critic divergence as a finding, not a κ-failure.

## Evaluation Methodology

### Inter-Rater Reliability

Inter-judge reliability MUST compare the **same response** scored by different judges, not different responses from similar conditions.

**Correct approach**:
1. Generate paired data by rejudging same responses:
   ```bash
   node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt
   ```
2. Match on `suggestions` content (actual response), not just metadata
3. Then calculate correlation between judges

The script `scripts/analyze-judge-reliability.js` implements this correctly by hashing `suggestions` content.

### Database Schema (evaluation_results columns)

**Source-of-truth**: `services/evaluationStore.js` migrations (top of file). Do NOT rely on inline column lists in this doc — they go stale; the `migrateAddColumn` calls are authoritative.

**There is NO `trace` column.** Do not reference `trace` in SQL queries.

**Column families currently in `evaluation_results`** (browse migrations for exact names):
- Identity: `id`, `run_id`, `scenario_id`, `dialogue_id`, `learner_id`
- Config: `provider`, `model`, `profile_name`, `hyperparameters`, `prompt_id`, `ego_model`, `superego_model`, `factor_*`, `learner_architecture`, `conversation_mode`
- Output: `suggestions`, `raw_response`, `scores_with_reasoning`
- Per-turn tutor: `tutor_first_turn_score` (canonical Turn-0), `tutor_last_turn_score`, `tutor_development_score`, `tutor_scores`, `tutor_overall_score`
- Holistic: `tutor_holistic_*`, `learner_holistic_*`, `dialogue_quality_*`, `dialogue_quality_internal_*`
- Deliberation: `tutor_deliberation_*`, `learner_deliberation_*`
- Charisma (cells 101-109): `tutor_charisma_scores`, `tutor_charisma_overall_score`, `tutor_charisma_rubric_version`, `tutor_charisma_judge_model`
- Transformation indices: `adaptation_index`, `learner_growth_index`, `bilateral_transformation_index`, `incorporation_rate`, `dimension_convergence`, `transformation_quality`
- Provenance: `config_hash`, `dialogue_content_hash`, `prompt_content_hash`, `tutor_ego_prompt_version`, `tutor_superego_prompt_version`, `learner_prompt_version`
- Rubric versions: `tutor_rubric_version`, `learner_rubric_version`, `dialogue_rubric_version`, `deliberation_rubric_version`
- Adaptive / id-director: `id_construction_trace`, `deliberation_rounds`
- Validation: `passes_required`, `passes_forbidden`, `required_missing`, `forbidden_found`
- Metadata: `created_at`, `judge_model`, `evaluation_reasoning`, `success`, `error_message`, `judge_latency_ms`, `qualitative_assessment`, `blinded_qualitative_assessment`

**Dead columns** (kept for historical reads, never written): `holistic_overall_score` (was alias for `tutor_last_turn_score`); `overall_score` (deprecated alias for `tutor_first_turn_score`).

**evaluation_runs columns**: `id` (TEXT PK), `created_at`, `description`, `total_scenarios`, `total_configurations`, `total_tests`, `status`, `completed_at`, `metadata` (JSON), `git_commit`, `package_version`

### Important Notes

- CLI model format uses **dot notation**: `openrouter.gpt`, NOT `openrouter/gpt`
- CLI uses `--runs` NOT `--repeats` for runsPerConfig
- Database: `data/evaluations.db` (SQLite)
- DB tutor score column: `tutor_first_turn_score` (Turn 0 score; `overall_score` is deprecated alias)
- Always filter by `judge_model` when querying — runs can have rows from multiple judges
- `evaluate --force` only processes rows with NULL scores
- `rejudge` without `--judge` defaults to Sonnet 4.5, not Opus
- Rejudge creates new rows by default; `--overwrite` replaces
- **Legacy cell names**: Early runs used shorthand `cell_1`, later runs use canonical `cell_1_base_single_unified`. Both coexist in the DB. Analysis scripts should match on prefix or use `LIKE 'cell_1%'` when querying across runs.
- **Rubric version columns**: `tutor_rubric_version`, `learner_rubric_version`, `dialogue_rubric_version`, `deliberation_rubric_version` — auto-resolved from YAML `version:` fields at write time. `"1.0"` = original rubric (14 tutor dimensions). `"2.0"` = v2 rubric overhaul (Feb 26). `"2.1"` = public-only output scoring + deliberation rubric (Feb 27). `"2.2"` = literature-informed redesign (Feb 28): consolidates 14 → 8 tutor dimensions using GuideEval P→O→E decomposition, adds `content_accuracy`, removes `learner_growth`. Versioned rubrics live in `config/rubrics/v{X.Y}/`; active rubrics are in `config/`. **Do NOT retroactively score historical data under a newer rubric version** — this creates cross-version contamination that invalidates within-run comparisons.
- **Charisma rubric** (`config/evaluation-rubric-charisma.yaml` v1.0) is independent of v2.2 — used only by id-director cells (101-109). Stored in `tutor_charisma_*` columns and can be cross-correlated with the v2.2 tutor rubric.
- **Provenance hashes**: `config_hash`, `dialogue_content_hash`, `prompt_content_hash` enable cross-run reproducibility checks. `services/evalSignature.js` validates consistency (e.g. detects `config_hash_drift` when the same profile+scenario produces rows with different hashes).
- **Boards**: `TODO.md` (root) is the long-horizon experimental/infrastructure list (A* experiments, B* code quality, C* maintenance, D* research). Paper 2.0 working notes live as dated files under `notes/poetics/` (active arc) and `notes/` more broadly — there is no separate `BOARD.md` in this fork. Automated research roundups land in `notes/daily-notes/` and MUST follow the cadence/dedup convention in `notes/daily-notes/README.md` (non-overlapping windows, one arxiv ID per note).

### Test Directory Convention

- `tests/` — Integration and functional tests for the evaluation system (CLI, runners, stores, analyzers)
- `services/__tests__/` — Unit tests co-located with their service files (evalConfigLoader, learnerRubricEvaluator, learnerTutorInteractionEngine)
- Both directories are included in `npm test` via: `node --test --test-force-exit services/__tests__/*.test.js tests/*.test.js`

### Resuming Incomplete Runs

When a run has empty/failed attempts (`suggestions = '[]'`, NULL `overall_score`):
1. Clean out empty rows first:
   ```bash
   sqlite3 data/evaluations.db "DELETE FROM evaluation_results WHERE run_id = '<runId>' AND overall_score IS NULL AND suggestions = '[]'"
   ```
2. Resume generation (skip-rubric) and judge in parallel:
   ```bash
   node scripts/eval-cli.js resume <runId> --skip-rubric
   node scripts/eval-cli.js evaluate <runId> --force --follow
   ```
- `resume` detects missing attempts from the original run plan and re-runs only those
- `--skip-rubric` generates without judging (matching the typical two-phase workflow)
- `evaluate --force --follow` polls and judges each new row as it lands
- `resume` accepts: `--parallelism N`, `--verbose`, `--force`, `--skip-rubric`

## Scripts Reference

### Core CLI (`scripts/eval-cli.js`)

The primary interface for all evaluation workflows:

```bash
node scripts/eval-cli.js run --profiles <cells> --runs N   # Run evaluation
node scripts/eval-cli.js evaluate <runId> [--force]        # Unified: per-turn tutor + holistic tutor + learner + dialogue quality
node scripts/eval-cli.js evaluate <runId> --tutor-only     # Per-turn tutor scoring only (skip holistic tutor + learner + dialogue)
node scripts/eval-cli.js evaluate-learner <runId>          # Score learner quality (standalone, legacy)
node scripts/eval-cli.js evaluate-dialogue <runId>         # Dialogue quality (standalone, now accepts --scenario/--profile)
node scripts/eval-cli.js rejudge <runId> --judge <model>   # Re-judge (e.g. openrouter.gpt)
node scripts/eval-cli.js resume <runId> [--skip-rubric]    # Resume incomplete run
node scripts/eval-cli.js export <runId> --format csv       # Export results
```

### Statistical Analysis

| Script | Usage |
|--------|-------|
| `analyze-eval-results.js` | ANOVA, effect sizes, marginal means across conditions |
| `analyze-judge-reliability.js` | Inter-judge correlation (requires rejudged paired data) |
| `analyze-mechanism-traces.js <runId>` | Process measures (RevΔ, EgoSpec, AdaptΔ, RunVar) |
| `analyze-trajectory-curves.js <runId...>` | Per-dimension turn-by-turn trajectory curves (§6.12) |
| `analyze-within-test-change.js [<runId>]` | Symmetric first-to-last delta (rubric + text-proxy) (§6.15) |
| `analyze-learning-stagnation.js [<runId>]` | Learning stagnation detection in multi-turn dialogues (§6.15) |
| `analyze-insight-action-gap.js <runId...>` | Insight-action gap on reflection-mechanism cells (Finding 11 / D3) |
| `analyze-recognition-lexicon.js [<runId>...]` | Theory-driven mechanism decomposition: 10-concept Hegelian lexicon density × score (D1) |
| `analyze-rubric-consistency.js` | 5-level cross-rubric consistency checks (§5.4) |
| `analyze-eval-costs.js` | Token usage and cost breakdown |
| `analyze-interaction-evals.js` | Bilateral interaction scoring |
| `analyze-modulation-learning.js` | Modulation metrics and learning outcomes |
| `advanced-eval-analysis.js` | Extended multi-turn scenario analysis |
| `compare-transformation.js` | Transformation metrics (adaptation, growth indices) |

### Qualitative Analysis

| Script | Usage |
|--------|-------|
| `assess-transcripts.js <runId>` | AI narrative assessment (`--blinded`, `--force`, `--model`) — **API** |
| `qualitative-analysis.js` | Rule-based thematic coding with chi-square tests |
| `qualitative-analysis-ai.js` | LLM-based theme discovery (`--mode classify\|discover`) — **API** |
| `code-impasse-strategies.js` | Code dialogues into 5 Hegelian resolution strategies — **API** |
| `code-dialectical-modulation.js` | Code superego modulation (structural + semantic) — **API** |
| `browse-transcripts.js` | Interactive transcript browser (web UI on localhost) |
| `calibrate-rubric.js` | Rubric version calibration (synthetic or `--live` re-scoring) |

### Post-Hoc Analysis Workflow

Standard pipeline after a new run (all pure computation except where noted):

```bash
# 1. Score all rows
node scripts/eval-cli.js evaluate <runId>

# 2. Factorial effects
npm run analyze:effects                        # or: node scripts/analyze-eval-results.js --run-id <runId>

# 3. Process measures from dialogue logs
npm run analyze:traces -- <runId>

# 4. Trajectory curves (per-dimension)
npm run analyze:trajectories -- <runId>        # or: --all-multiturn

# 5. Within-test change (symmetric delta)
npm run analyze:change

# Cross-judge validation (requires rejudged data)
node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt
npm run analyze:reliability
```

Full registry: `scripts/ANALYSIS-SCRIPTS.md`. Workflow guide: `docs/analysis-toolkit-guide.md`. Claude skill: `/ms-analyze-data`.

### Paper & Validation

| Script | Usage |
|--------|-------|
| `generate-paper-tables.js` | Generate tables + validate prose N-counts against DB |
| `validate-paper-manifest.js` | Level 1 manifest validation (N-counts, stalled runs) |
| `render-sequence-diagram.js` | Render architecture sequence diagrams to HTML/SVG |
| `validate-content.js` | Validate tutorial content packages |

### Utilities

| Script | Usage |
|--------|-------|
| `test-rate-limit.js [model]` | Probe OpenRouter rate limits (default: nemotron) |
| `test-latency.js` | Latency test across all configured models |
| `seed-db.js` | Initialize database with sample data |

## Paper Authoring Discipline

**Source of truth**: `docs/research/paper-full-2.0.md` is canonical for every empirical claim, number, table, and analysis. Spin-offs (short paper, slides, blog posts, talks) must NOT introduce original empirical claims — they inherit from the main paper.

- **New claim?** Add it to `paper-full-2.0.md` first (with version bump + revision-history entry); the spin-off then inherits it.
- **New analysis?** Script lands in `scripts/`, report in `exports/`, interpretation in `paper-full-2.0.md`, then the spin-off.
- **Allowed in spin-offs without main-paper changes**: framing prose (abstract, intro, related work), spin-off-specific citations, re-presenting existing data through a different lens.
- **Review check**: every number in a spin-off must trace to a specific § of `paper-full-2.0.md`. If not, either add it there or remove it from the spin-off.

## Common Commands

```bash
# Run factorial evaluation
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3

# Judge with Claude Opus (default)
node scripts/eval-cli.js evaluate <runId>

# Rejudge with GPT-5.2
node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt

# Resume incomplete run (generation + judging in parallel)
node scripts/eval-cli.js resume <runId> --skip-rubric
node scripts/eval-cli.js evaluate <runId> --force --follow

# Analyze inter-judge reliability (requires rejudged data)
node scripts/analyze-judge-reliability.js

# Export results
node scripts/eval-cli.js export <runId> --format csv

# Build paper PDF (canonical Paper 2.0). NOTE: `full` builds the LEGACY
# Paper 1.0 from paper-full.md — use `paper2` for paper-full-2.0.md.
cd docs/research && ./build.sh paper2

# Run tests
npm test

# Hermetic test run (isolated tmp DB + logs)
npm run test:hermetic

# Lint
npm run lint        # check
npm run lint:fix    # auto-fix

# Adaptive cell smoke (no paid API calls)
ADAPTIVE_TUTOR_LLM=mock node scripts/run-adaptive-cell-smoke.js

# Interactive chat CLI
npm run chat

# Prompt lab (subcommands: init, fork, run, status, recommend, autotune, diff)
npm run prompt-lab -- <subcommand>

# Model shootout
npm run model-shootout

# Validate provenance / message-chain integrity
npm run provenance:validate
npm run audit:message-chain
```
