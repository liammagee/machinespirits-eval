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
```

Pass args after `--`: `npm run analyze:traces -- <runId>`
