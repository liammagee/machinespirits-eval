---
name: analyze-data
description: Route analysis questions to the correct script with exact invocation syntax
argument-hint: <analysis-type-or-question>
allowed-tools: Bash, Read, Grep, Glob
---

Route the user's analysis request (`$ARGUMENTS`) to the correct script.

## Decision Tree

### 1. Effect sizes / ANOVA / factorial analysis
```bash
node scripts/analyze-eval-results.js
node scripts/analyze-eval-results.js --run-id <runId>
node scripts/analyze-eval-results.js --judge claude
```
- Pure computation, no API calls
- Prerequisites: `tutor_first_turn_score` populated
- Paper: sections 6.1-6.4

### 2. Mechanism traces / process measures
```bash
node scripts/analyze-mechanism-traces.js <runId> [--json] [--verbose]
```
- Pure computation, reads dialogue logs
- Outputs: RevDelta, EgoSpec, AdaptDelta, RunVar
- Paper: section 6.2

### 3. Trajectory curves / per-dimension turn-by-turn
```bash
node scripts/analyze-trajectory-curves.js <runId> [<runId> ...]
node scripts/analyze-trajectory-curves.js --all-multiturn
node scripts/analyze-trajectory-curves.js <runId> --json exports/trajectory-curves.json
```
- Pure computation
- Prerequisites: `learner_scores` JSON populated, multi-turn rows
- Paper: sections 6.12.1-6.12.2

### 4. Within-test change / first-to-last delta
```bash
node scripts/analyze-within-test-change.js <runId>
node scripts/analyze-within-test-change.js <runId> --json exports/within-test-change.json
node scripts/analyze-within-test-change.js <runId> --smoke-test
```
- Pure computation, persists derived metrics to DB
- Prerequisites: multi-turn rows, dialogue logs
- Paper: section 6.15

### 5. Learning stagnation
```bash
node scripts/analyze-learning-stagnation.js [<runId> ...]
```
- Pure computation
- Prerequisites: multi-turn rows, dialogue logs
- Paper: section 6.15

### 6. Inter-judge reliability
```bash
node scripts/analyze-judge-reliability.js
```
- Pure computation, no args needed
- Prerequisites: must have rejudged rows (same `suggestions` content scored by different `judge_model`)
- To create paired data first: `node scripts/eval-cli.js rejudge <runId> --judge openrouter.gpt`
- Paper: section 6.8

### 7. Modulation / drama-machine evidence
```bash
node scripts/analyze-modulation-learning.js
```
- Pure computation, no args needed
- Prerequisites: `tutor_first_turn_score`, `scores_with_reasoning` populated
- Paper: section 6.5

### 8. Cost analysis
```bash
node scripts/analyze-eval-costs.js
```
- Pure computation
- Prerequisites: eval progress logs in `logs/eval-progress/`
- Paper: Appendix

### 9. Rubric consistency (cross-level checks)
```bash
node scripts/analyze-rubric-consistency.js
node scripts/analyze-rubric-consistency.js --run-id <runId> --verbose
```
- Pure computation
- Prerequisites: multiple score types populated (tutor, learner, holistic, dialogue, deliberation)
- Paper: section 5.4

### 10. Qualitative: rule-based thematic coding
```bash
node scripts/qualitative-analysis.js
```
- Pure computation, no args needed
- Prerequisites: `suggestions` populated
- Paper: section 6.9

### 11. Qualitative: AI narrative assessment
```bash
node scripts/assess-transcripts.js <runId> [--blinded] [--force] [--model <m>]
```
- **WARNING: Makes API calls** (uses AI judge)
- Prerequisites: scored evaluation rows
- Paper: section 6.9

### 12. Qualitative: AI theme discovery
```bash
node scripts/qualitative-analysis-ai.js [--mode classify|discover|both] [--model <m>]
```
- **WARNING: Makes API calls**
- Prerequisites: `suggestions` populated
- Paper: section 6.9

### 13. Impasse strategy coding
```bash
node scripts/code-impasse-strategies.js [--run-id <id>] [--model <m>] [--force]
```
- **WARNING: Makes API calls**
- Prerequisites: multi-turn dialogue logs
- Paper: section 6.11

### 14. Dialectical modulation coding
```bash
node scripts/code-dialectical-modulation.js [--run-id <id>] [--model <m>] [--force]
```
- **WARNING: Makes API calls**
- Prerequisites: multi-turn dialogue logs with superego traces
- Paper: section 6.11

### 15. Rubric calibration
```bash
node scripts/calibrate-rubric.js                                # synthetic (free)
node scripts/calibrate-rubric.js --live                         # live re-scoring (API calls)
node scripts/calibrate-rubric.js --from-version 2.1 --to-version 2.2 --export calibration.csv
```
- Synthetic mode: pure computation. `--live` mode: **makes API calls**
- Prerequisites: `scores_with_reasoning`, v2.2 YAML files in `config/rubrics/`
- Paper: section 5.4

### 16. Transcript browser (interactive)
```bash
node scripts/browse-transcripts.js [--port 3456] [--run <runId>]
```
- Starts a web server (default port 3456)
- No API calls

## Standard Pipeline Order

After a new run:
1. `analyze:effects` — factorial ANOVA, effect sizes
2. `analyze:traces` — process measures from dialogue logs
3. `analyze:trajectories` — per-dimension trajectory curves
4. `analyze:change` — within-test first-to-last delta

For cross-judge validation:
1. `eval-cli.js rejudge <runId> --judge openrouter.gpt`
2. `analyze:reliability`

For qualitative depth:
1. `assess-transcripts.js <runId>` (API)
2. `qualitative-analysis-ai.js` (API)

## Follow-up Suggestions

After running the requested analysis, suggest:
- If effects analysis: "Run trajectory curves to see per-dimension change patterns"
- If trajectories: "Run within-test change for symmetric tutor/learner delta"
- If reliability: "Check rubric consistency for cross-level agreement"
- If qualitative: "Run impasse strategy coding for Hegelian resolution patterns"
