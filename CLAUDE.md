# Project Memory for Claude

## Evaluation Methodology

### Inter-Rater Reliability: Compare Apples to Apples

**Critical rule**: Inter-judge reliability MUST compare the **same response** scored by different judges, not different responses from similar conditions.

**Wrong approach** (produces meaningless results):
- Group by scenario + profile
- Compare scores from different runs (different responses)
- This measures response variance, not judge variance

**Correct approach**:
1. Generate paired data by rejudging same responses:
   ```bash
   node scripts/eval-cli.js rejudge <runId> --judge openrouter/anthropic/claude-sonnet-4.5
   node scripts/eval-cli.js rejudge <runId> --judge openrouter/moonshotai/kimi-k2.5
   ```
2. Match on `suggestions` content (actual response), not just metadata
3. Only then calculate correlation between judges

The script `scripts/analyze-judge-reliability.js` implements this correctly by hashing `suggestions` content.

### Sample Size Claims

- **Primary evaluations**: Count distinct (scenario × profile) cells with complete data
- **Total database rows**: May include duplicates, reruns, failed attempts
- Always report both: "N=435 primary; N=2,700+ total"

### Factor Analysis

When reporting factor effects:
- Report within-judge comparisons to control for judge calibration differences
- Different judges have different "grading curves" (up to 23 points apart)
- Relative comparisons within same judge remain valid

## Configuration

### Tutor Agent Cells (config/tutor-agents.yaml)

- Cells 1-4: Base (no recognition theory)
- Cells 5-8: Recognition theory enabled
- Cells 9-14: Enhanced prompts (longer, more pedagogical detail)
- Cells 15-18: Placebo control (length-matched, no recognition theory)

### Placebo Control Design

Placebo prompts (`prompts/tutor-ego-placebo.md`, `prompts/tutor-superego-placebo.md`):
- Match length/complexity of recognition prompts
- Contain pedagogical best practices
- Remove all Hegelian theory (mutual recognition, autonomous subject, etc.)
- Enable 3-way comparison: enhanced vs placebo vs recognition

## Common Commands

```bash
# Run factorial evaluation
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --repeats 3

# Rejudge with different model
node scripts/eval-cli.js rejudge <runId> --judge openrouter/anthropic/claude-sonnet-4.5

# Analyze inter-judge reliability (requires rejudged data)
node scripts/analyze-judge-reliability.js

# Export results
node scripts/eval-cli.js export <runId> --format csv
```
