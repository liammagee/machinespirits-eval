# Ablation Study: Dialogue Rounds

**Generated:** 2026-01-14T10:23:56.877Z

## Research Question

Does increasing the number of Ego-Superego dialogue rounds improve tutor suggestion quality?

## Method

Compared evaluation scores across profiles with different `max_rounds` settings:
- **0 rounds**: Single-agent (no Superego review)
- **1 round**: Single critique-revise cycle
- **2 rounds**: Two critique-revise cycles (default)
- **3 rounds**: Three critique-revise cycles

## Results

### Descriptive Statistics

| Rounds | N | Mean | SD | 95% CI |
|--------|---|------|-----|--------|
| 0 | 483 | 91.58 | 15.75 | [90.2, 93.0] |
| 1 | 1 | 50.00 | 0.00 | [50.0, 50.0] |
| 2 | 247 | 88.05 | 19.77 | [85.6, 90.5] |
| 3 | 2 | 96.25 | 1.77 | [93.8, 98.7] |

### One-Way ANOVA

| Source | SS | df | MS | F | p | η² |
|--------|-----|-----|-----|-----|-----|-----|
| Between | 3738.46 | 3 | 1246.15 | 4.212 | 0.050 | 0.017 |
| Within | 215696.89 | 729 | 295.88 | | | |
| Total | 219435.35 | 732 | | | | |

## Interpretation

The effect of dialogue rounds on suggestion quality was not statistically significant (F(3, 729) = 4.21, p = 0.050, η² = 0.017).

Moving from single-agent (0 rounds) to multi-agent with 2 dialogue rounds shows a -3.9% improvement in mean score.

## Limitations

- Confounded with profile differences (model selection, prompts)
- Unbalanced sample sizes across conditions
- No randomized controlled comparison

## Implications for System Design

Based on these results:
- Dialogue rounds may have limited impact compared to other factors
- Consider whether additional API costs are justified
