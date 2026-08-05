# Project Memory for Claude

## How to write here

Plain words, short sentences, answer what was asked and stop. The full rule is `.claude/style-rule.md`, which a `UserPromptSubmit` hook injects on every turn — edit that file to change how replies read. It applies to chat, commits, comments and notes alike. Paper prose keeps its own register.

## This fork

This is `machinespirits-eval-dramatic` — a fork of `machinespirits-eval` specialised for the **Dramatic Recognition / Poetics** arc (sanctioned 2026-05-19). Master plan: `DRAMATIC-RECOGNITION-PLAN.md` (now historical — pre-registration plus closeout ledger; live work is tracked on the `workplan/` board). Documentation entry point: `DOCS.md` (layers, authorities, web surfaces, regeneration, deploy). The full eval-factorial machinery below (cells 1–125, ego-superego, adaptive runner, rubrics v2.2) is inherited unchanged; the poetics pipeline's results land as §s of `docs/research/paper-full-2.0.md`. Sibling agent docs at repo root: `AGENTS.md` (Codex), `GEMINI.md`.

## Desktop app (Electron)

There is an Electron desktop app that is the **exact equivalent of the web UX and stays in sync by construction** — it embeds the unchanged Express stack and loads the web UI over loopback, so there is ONE UI codebase. The desktop code lives under `desktop/` on `main` (merged from the now-removed `claude/electron-desktop-app` branch). Active dev happens in a dedicated Electron-ABI worktree — `../ms-electron` on branch `desktop-dev` — launched with `npm run desktop:dev`.

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

Recruitment is gated on IRB approval / real consent text / real item content (tracked in `workplan/items/a1-human-learner-validation.md`; historical design detail remains in `TODO.md` §A1).

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

### Model stack default

**nemotron/kimi must never be the default pairing for new runs** (standing user directive, 2026-07-07 — the A4 run on nemotron/kimi is suspected of producing false negatives). By default, use `codex.gpt-5.5` or claude-code Sonnet 5 via the CLI bridge unless the user specifies otherwise:

```bash
node scripts/eval-cli.js run --profiles <cells> --ego-model codex.gpt-5.5 --superego-model codex.gpt-5.5 --runs N
```

- The CLI bridge now reaches **tutor-core's dialogue engine** (standard-runner cells like 40/93), not just id-director/learner/adaptive/judge seams — via the external-AI-provider hook (`tutor-core/services/externalAIProvider.js`, registered by `evaluationRunner.js`). `--ego-model` / `--superego-model` CLI overrides therefore work for ALL cells.
- `eval-cli run` prints a **non-blocking stderr warning** when a run resolves to the nemotron/kimi pairing with no explicit model override (`services/stackDefaultWarning.js`). Existing cell YAML is unchanged — the weak stack remains available as an explicit choice.
- **Interpretation rule: nulls generated on nemotron/kimi are stack-bounded until replicated on a strong model.** Do not present a nemotron/kimi null as an architecture verdict without a strong-stack replication (or an explicit stack-bounded caveat).

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

**Cell registry (source-of-truth):** canonical `cell_*` names are the profiles in `config/tutor-agents.yaml`. `services/evalProfileRegistry.js` derives `CANONICAL_EVAL_PROFILES` from that YAML and keeps historical non-cell names in the explicit `LEGACY_EVAL_PROFILE_ALIASES` map; `EVAL_ONLY_PROFILES` remains the combined compatibility export. Read the YAML for any specific cell (or use the `/ms-cell-info` skill) and run `node scripts/eval-cli.js validate-config` when in doubt.

The families below are orientation only — they say nothing binding about any single cell's architecture:

| Cells | Family |
|-------|--------|
| 1-8 | 2×2×2 factorial: base/recog × single/multi × unified/ego_superego learner |
| 9-20 | Prompt ablations: enhanced (9-12), hardwired rules (13-14), placebo control (15-18), memory isolation (19-20) |
| 21 | Dynamic prompt rewriting with Writing Pad |
| 22-33 | Divergent superego variants: standard ego (22-27), dialectical ego (28-33) |
| 34-39 | Full-feature dialectical — DEPRECATED |
| 40-59 | Tutor mechanism variants: self-reflective evolution, quantitative disposition, prompt erosion, intersubjective recognition, combined, other-ego profiling |
| 60-79 | Dynamic-learner mechanism variants; 71 is the naive baseline (no recognition, no superego, minimal prompt) |
| 80-92 | Messages-mode variants (`conversation_mode: messages`) |
| 93-100 | Superego variant ablations refining `dialectical_suspicious` |
| 101-109 | Id-director charisma family — see "Id-Director Architecture" below |
| 110-125 | Trap-scenario suite — see "Runner Dispatch" below; 115-123 are the P2.1 bilateral-ToM / P2.2 state-schema ablations (§6.8.5–.6) |

<!-- The old per-cell catalogue was removed on 2026-07-27: it duplicated tutor-agents.yaml, which this file already declares authoritative, and drifted. Recover it from git history if ever needed. -->

### Adding New Cells

Add new eval-repo cells once in `config/tutor-agents.yaml`; the canonical registry derives them automatically. The registry count ratchet and two-way `validate-config` check make additions explicit, malformed or missing `cell_*` names fail closed, and every new non-base `prompt_type` still needs a tested `resolveEvalProfile()` dispatch (unless `runner: adaptive` bypasses tutor-core by design).

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
- `npm run test:hermetic` — runs the full test suite against `mktemp -d` paths (also sets `EVAL_WRITING_PAD_DIR`) so the production DB, logs, and writing pads are never touched
- Adaptive smoke scripts (combined with `ADAPTIVE_TUTOR_LLM=mock` for fully self-contained, no-cost runs)
- Any test that needs full DB+logs isolation

**Read-path discipline**: analysis/report scripts must not hardcode `data/evaluations.db` — open the DB via `openEvaluationDbReadonly()` (`services/evaluationDbReadonly.js`; `EVAL_DB_PATH`-aware, readonly, never creates the file; a `--db` flag threads through as `explicitPath`) and treat a missing or schemaless DB as "no data" (message + exit 0), not a crash. A zero-byte `data/evaluations.db` can legitimately turn up in a fresh worktree (a sqlite MCP server pointed at that path creates one on connect), and a hardcoded path makes "hermetic" tests silently read the production DB. Scripts that intentionally *write* the eval DB (ingest, metric persistence) resolve their default path with `resolveEvaluationDbPath()` (`services/evaluationDataPaths.js`) instead of hardcoding it; writers that only update existing rows should also open with `fileMustExist` so a mis-resolved path fails instead of minting a stray DB (ingest-style scripts that legitimately create a fresh DB are the exception).

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
- **Outputs**: `config/poetics-calibration/phase2-classic-drama-*/` (gitignored; pilot reports, adaptation failures, tutor-adaptation csvs)

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

To see the real columns of `evaluation_results` or `evaluation_runs`, read the migrations or ask the DB:

```bash
sqlite3 data/evaluations.db ".schema evaluation_results"
```

**Dead columns** (kept for historical reads, never written): `holistic_overall_score` (was alias for `tutor_last_turn_score`); `overall_score` (deprecated alias for `tutor_first_turn_score`).

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
- **Rubric version columns**: `tutor_rubric_version`, `learner_rubric_version`, `dialogue_rubric_version`, `deliberation_rubric_version` — auto-resolved from YAML `version:` fields at write time. `"1.0"` = original rubric (14 tutor dimensions). `"2.0"` = v2 rubric overhaul (Feb 26). `"2.1"` = public-only output scoring + deliberation rubric (Feb 27). `"2.2"` = literature-informed redesign (Feb 28): consolidates 14 → 8 tutor dimensions using GuideEval P→O→E decomposition, adds `content_accuracy`, removes `learner_growth`. `"3.0"` = prospective PCA-informed measurement suite: tutor-turn quality is the 1–10 general factor plus 1–5 content accuracy, with separate tutor-trajectory, learner-change, encounter, and deliberation instruments. v3.0 is opt-in under `config/rubrics/v3.0/`; v2.2 remains active. Versioned rubrics live in `config/rubrics/v{X.Y}/`; active rubrics are in `config/`. **Do NOT retroactively score historical data under a newer rubric version** — this creates cross-version contamination that invalidates within-run comparisons.
- **Charisma rubric** (`config/evaluation-rubric-charisma.yaml` v1.0) is independent of v2.2 — used only by id-director cells (101-109). Stored in `tutor_charisma_*` columns and can be cross-correlated with the v2.2 tutor rubric.
- **Provenance hashes**: `config_hash`, `dialogue_content_hash`, `prompt_content_hash` enable cross-run reproducibility checks. `services/evalSignature.js` validates consistency (e.g. detects `config_hash_drift` when the same profile+scenario produces rows with different hashes).
- **Todo / board source of truth**: all live todos, experiments, paper tasks, infra tasks, and maintenance work are tracked in `workplan/`. The write source is one markdown file per item in `workplan/items/`; `workplan/BOARD.md` and `workplan/board.json` are generated views from those items. Do not add new live work to `TODO.md`, old techne board snapshots, or dated notes without also creating/updating a `workplan/items/` card. `TODO.md` is now historical design context only. After changing item files, run `node scripts/workplan.js render && node scripts/workplan.js validate`. **Every change reaching `main` must name its card**: in a PR that is the `Workplan item: <id>` line in the body; pushing straight to `main` it is a commit trailer, `git commit --trailer "Workplan-item: <id>"` (or `N/A`), checked by `npm run wp:commit-link`. Merge commits and `workplan/`-only commits are exempt. Verify before pushing with `npm run wp:commit-link -- --range origin/main..HEAD`. Automated research roundups land in `notes/daily-notes/` and MUST follow the cadence/dedup convention in `notes/daily-notes/README.md` before workplan ingestion.

### Test Directory Convention

- `tests/` — Integration and functional tests for the evaluation system (CLI, runners, stores, analyzers)
- `services/__tests__/` — Unit tests co-located with their service files (evalConfigLoader, learnerRubricEvaluator, learnerTutorInteractionEngine)
- Both directories are included in `npm test`, which runs them through `scripts/run-hermetic-tests.js` with natural teardown (no `--test-force-exit`) and requires every selected file to report a result

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

### Statistical and Qualitative Analysis

Every analysis script — ANOVA and effect sizes, judge reliability, mechanism traces, trajectory curves, within-test change, stagnation, insight-action gap, recognition lexicon, rubric consistency, costs, plus the qualitative coders and the transcript browser — is listed with its flags in `scripts/ANALYSIS-SCRIPTS.md`. Read that file rather than guessing a script name.

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
