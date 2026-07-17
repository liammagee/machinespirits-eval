# Analysis Scripts Registry

All post-hoc analysis scripts in `scripts/`. For workflow order, see `notes/paper-2-0/analysis-toolkit-guide.md`.

## Statistical Analysis

| Script | Args | API? | Description | Paper sections | Data prerequisites |
|--------|------|------|-------------|----------------|--------------------|
| `analyze-eval-results.js` | `[--help] [--run-id <id>] [--judge <model>]` | No | ANOVA, effect sizes, marginal means across factorial conditions | 6.1-6.4 | `tutor_first_turn_score` populated |
| `analyze-mechanism-traces.js` | `<runId> [--output <path>] [--json] [--verbose]` | No | Process measures: RevDelta, EgoSpec, AdaptDelta, RunVar from dialogue logs | 6.2 | Dialogue logs in `logs/tutor-dialogues/` |
| `analyze-trajectory-curves.js` | `<runId...> \| --all-multiturn [--json <path>] [--min-turns N]` | No | Per-dimension turn-by-turn trajectory analysis (learner + tutor) | 6.12.1-6.12.2 | `learner_scores` JSON, multi-turn rows |
| `analyze-within-test-change.js` | `[<runId...>] [--db <path>] [--json <path>] [--dry-run] [--smoke-test]` | No | Symmetric first-to-last change (rubric + text-proxy trajectories) | 6.15 | Multi-turn rows, dialogue logs |
| `analyze-learning-stagnation.js` | `[<runId...>] [--db <path>] [--logs <dir>]` | No | Learning stagnation detection across multi-turn dialogues | 6.15 | Multi-turn rows, dialogue logs |
| `analyze-judge-reliability.js` | (none — runs on all paired data) | No | Inter-judge correlation via content-hashed response matching | 6.8 | Rejudged rows (same `suggestions` content, different `judge_model`) |
| `analyze-modulation-learning.js` | (none — hardcoded factorial params) | No | Modulation metrics and learning outcomes for drama-machine evidence | 6.5 | `tutor_first_turn_score`, `scores_with_reasoning` |
| `analyze-eval-costs.js` | `[--help]` | No | Token usage and cost breakdown from eval progress logs | Appendix | Eval progress logs in `logs/eval-progress/` |
| `analyze-rubric-consistency.js` | `[--run-id <id>] [--judge <model>] [--verbose]` | No | 5-level cross-rubric consistency checks (per-turn vs holistic, etc.) | 5.4 | Multiple score types populated |
| `analyze-interaction-evals.js` | (none — reads from `logs/interaction-evals/`) | No | Bilateral interaction scoring from interaction eval JSON logs | 6.6 | Interaction eval JSONs |
| `advanced-eval-analysis.js` | (none — hardcoded DB queries) | No | Extended multi-turn scenario analysis (sustained, breakdown, struggle) | 6.10 | Multi-turn evaluation rows |
| `compare-transformation.js` | (none — reads recent dialogue logs) | No | Transformation metrics (adaptation, growth indices) from log files | 6.7 | Dialogue logs in `logs/tutor-dialogues/` |
| `analyze-prosthesis.js` | (none — hardcoded run ID) | No | Cognitive prosthesis dimension analysis for cells 66-68 | 6.14 | Run `eval-2026-02-17-25aaae85` scored |
| `analyze-insight-action-gap.js` | `<runId...> [--json] [--output PATH] [--min-pairs N]` | No | Insight-action coupling: cosine similarity between `ego_self_reflection` and same-turn final tutor message; reports gap, turn drift, and gap-minus-drift per cell | Finding 11 / TODO §D3 | Multi-turn rows on reflection-mechanism cells (40-45, 46-53, 60-63, 72-77) with dialogue logs |
| `analyze-recognition-lexicon.js` | `[<runId...>] [--json] [--output PATH] [--min-rows N]` | No | Theory-driven mechanism decomposition: per-response density of 10 Hegelian recognition concepts, with Cohen's d (recog − base) and Pearson r (density × score) per concept | TODO §D1 | Any scored rows (`suggestions` populated and `tutor_first_turn_score`/`overall_score` non-null) |
| `analyze-strategy-shift.js` | `[--run-id <id>] [--profile <name>] [--out <path>]` | No | Adaptive-cell (A13) mechanism scorer: per-scenario `strategy_shift_correctness` (pre-registered binary), `counterfactual_divergence`, within-action refinement proxy, + exploratory shift-window metrics, read from `services/adaptiveTutor/` deliberation traces | 6.8.3-6.8.7 | Adaptive-cell deliberation traces (cells 110-113, 124) |
| `analyze-register-confirmatory-step2.js` | `[--check] [--selection <file>] [--terra-root <dir>] [--sonnet-root <dir>]` | No | Rebuilds final Step 2 selected rows, fixed-seed interaction bootstrap, in-run profile gates, post-t16 sensitivity, QA matrix, and lineage from hash-verified Terra/Sonnet archives | Planned §6.17 / final-stretch Step 2 | Register-confirmatory archives and frozen selection manifest |
| `analyze-adaptation-belief-calibration.js` | `--run-id <id>[,<id>] --scenario-file <path> [--judge-model <label>] [--out <path>] [--markdown <path>]` | No | Plan 2.1 trace analyzer for learner-state belief validity: top-k hidden-state coverage, Brier score, expected calibration error, top-two margin, and unsupported high-confidence rate | PLAN_2_0 / adaptive belief-state mechanics | Adaptive Plan 2 traces with `learnerStateBelief`; scenario metadata with hidden state or `expected_belief_hypothesis` |
| `evaluate-adaptation-policy.js` | `[--suite <json>] [--compare <csv>] [--output <json>]` | No | Plan 2.0 deterministic oracle evaluation for typed adaptation contracts, proof/release/ownership gate, intervention closure, action-state fit, and paired bootstrap intervals | PLAN_2_0 / adaptive policy mechanics | `config/adaptation-discrimination-scenarios.json`; no DB or API required |
| `grade-adaptive-dialogue.js` | `[--run-id <id>] [--profile <name>] [--scenario <id>] [--model <m>] [--limit N] [--overwrite] [--dry-run] [--verbose]` | **Yes (codex CLI)** | Bespoke 4-dimension graded rubric for adaptive cells (110, 111-113, 118-120), filling the gap where the v2.2 evaluator skips adaptive-trap rows; writes the `adaptive_*` columns | 6.8.6 | Adaptive-cell rows + dialogue logs in `logs/tutor-dialogues/` |
| `analyze-derivation-loop-results.js` | `[--loop-dir <dir>] [--pattern <glob[,glob]>] [--expected-file <path>] [--selector-version v1\|auto\|none] [--out <dir>] [--json]` | No | Dry analyzer for dramatic-derivation loop artifacts: groups `diagnosis.json` rows, computes selector/static policy regret, classifies failures, and writes `summary.json`, `report.md`, and `manifest.tsv` when `--out` is supplied | Dramatic derivation / selector reliability | Loop artifacts under `exports/dramatic-derivation/loop/<label>/` |
| `analyze-derivation-selector-consolidation.js` | `[--loop-dir <dir>] [--pattern <glob[,glob]>] [--labels <csv>] [--out <path>] [--json] [--episode-window N] [--episode-real]` | No | Cross-arm consolidation diagnostic for selector-visible cases: labels strict V-positive, false positive, or visible-route failure; reports predicate/board evidence and emits prefix-controlled episode replay commands | Dramatic derivation / selector reliability | Completed loop artifacts with `diagnosis.json`, especially selector H/V/baseline/selective fans |
| `analyze-derivation-selector-candidates.js` | `[--summary <json>] [--out <path>] [--critical <csv>] [--json]` | No | Offline selector-policy search over completed H/V arms: scores static selector variants and small runtime-probe predicates, then reports critical-case WorldIR/proof-pressure/visible-guard features | Dramatic derivation / selector reliability | A selector consolidation JSON report plus corresponding loop artifacts |
| `analyze-derivation-learner-object-outcomes.js` | `--run <label-or-dir-or-result-json> [--run ...] [--search-dir <dir>] [--out <dir>]` | No | Post-run dual-outcome report separating proof verdict from learner-object ownership, durability, missing families, assertion gap, and leak-audit status | Dramatic derivation / learner ownership | Completed `run-derivation-loop.js` or episode artifacts with `result.json`; ownership-instrumented runs get richer outcome labels |
| `audit-derivation-ownership-replay-candidates.js` | `[--root exports/dramatic-derivation] [--out <dir>] [--json]` | No | Read-only Path 3 trigger audit for learner-object ownership replay: finds first-pass single-family ownership misses and reports whether adding `--ownership-transfer-gate` is actionable or already tested | Dramatic derivation / learner ownership | Completed artifacts with paired `result.json` and `diagnosis.json`, especially ownership-instrumented Hethel runs |

## Qualitative Analysis

| Script | Args | API? | Description | Paper sections | Data prerequisites |
|--------|------|------|-------------|----------------|--------------------|
| `assess-transcripts.js` | `<runId> [--scenario <id>] [--condition recog\|base] [--blinded] [--force] [--model <m>] [--help]` | **Yes** | AI narrative assessment of transcripts | 6.9 | Scored evaluation rows |
| `qualitative-analysis.js` | (none — runs on all data) | No | Rule-based thematic coding with chi-square tests | 6.9 | `suggestions` populated |
| `qualitative-analysis-ai.js` | `[--mode classify\|discover\|both] [--model <m>] [--run-id <id>] [--help]` | **Yes** | LLM-based theme discovery and classification | 6.9 | `suggestions` populated |
| `code-impasse-strategies.js` | `[--model <m>] [--run-id <id>] [--force] [--help]` | **Yes** | Code dialogues into 5 Hegelian resolution strategies | 6.11 | Multi-turn dialogue logs |
| `code-dialectical-modulation.js` | `[--model <m>] [--run-id <id>] [--force] [--help]` | **Yes** | Code superego modulation (structural + semantic analysis) | 6.11 | Multi-turn dialogue logs with superego traces |

## Rubric Calibration

| Script | Args | API? | Description | Paper sections | Data prerequisites |
|--------|------|------|-------------|----------------|--------------------|
| `calibrate-rubric.js` | `[--run-id <id>] [--judge <model>] [--sample N] [--from-version X] [--to-version Y] [--export <path>] [--verbose] [--live]` | **--live only** | Rubric version calibration (synthetic mapping or live re-scoring) | 5.4 | Scored rows with `scores_with_reasoning`; v2.2 YAML files in `config/rubrics/` |

## Interactive Tools

| Script | Args | API? | Description |
|--------|------|------|-------------|
| `browse-transcripts.js` | `[--port N] [--no-open] [--run <id>] [--scenario <id>] [--dialogue <id>] [--theme light\|dark]` | No | Web UI for browsing transcripts with sequence diagrams |
| `generate-paper-comics.js` | `--pdf <paper.pdf> [--count N] [--out-dir PATH] [--html-template PATH] [--html-placement distributed\|strip] [--html-image-source auto\|svg\|png] [--compose-html-only] [--png-too] [--png-only] [--chatgpt-prompts-only] [--dry-run] [--preview-only]` | Codex CLI / OpenAI Image API | Generate Machine Spirits-style comic-strip image assets, manifest JSON, HTML embed snippets, standalone previews, composed template pages with distributed section-level insertions by default, optional PNG panels via `gpt-image-2`, and paste-ready ChatGPT image prompts |

## npm shortcuts

```bash
npm run analyze:effects        # analyze-eval-results.js
npm run analyze:costs          # analyze-eval-costs.js
npm run analyze:traces         # analyze-mechanism-traces.js (needs <runId> arg)
npm run analyze:reliability    # analyze-judge-reliability.js
npm run analyze:trajectories   # analyze-trajectory-curves.js (needs <runId> or --all-multiturn)
npm run analyze:change         # analyze-within-test-change.js
npm run analyze:modulation     # analyze-modulation-learning.js
npm run analyze:stagnation     # analyze-learning-stagnation.js
npm run analyze:gap            # analyze-insight-action-gap.js (needs <runId>)
npm run analyze:lexicon        # analyze-recognition-lexicon.js (runs on all scored rows; optional <runId>)
npm run analyze:tutor-stub-register-confirmatory -- --check
npm run derivation:analyze-loop -- --pattern '*selector-v1-*'
npm run derivation:selector-consolidation -- --pattern '*selector-vpositive-*'
npm run derivation:selector-candidates -- --summary exports/dramatic-derivation/selector-consolidation-all.json
npm run paper:comics -- docs/research/paper-2.0-v3.0.79.pdf --count 6
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --png-only
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --chatgpt-prompts-only
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-image-source png
```

Pass args after `--`: `npm run analyze:traces -- <runId>`
