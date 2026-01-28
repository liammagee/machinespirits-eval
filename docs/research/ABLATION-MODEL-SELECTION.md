# Ablation Study: Model Selection

**Generated:** 2026-01-14T10:25:59.574Z

## Research Question

Does the choice of LLM model (for the Ego agent) affect tutor suggestion quality?

## Method

Analyzed evaluation scores grouped by the Ego model used in each profile.

## Results

### Descriptive Statistics

| Model | N | Mean | SD | 95% CI |
|-------|---|------|-----|--------|
| deepseek | 442 | 93.31 | 13.10 | [92.1, 94.5] |
| nemotron | 299 | 86.44 | 20.35 | [84.1, 88.7] |
| haiku | 29 | 84.20 | 21.58 | [76.3, 92.1] |
| gpt-5.2 | 1 | 97.50 | 0.00 | [97.5, 97.5] |
| sonnet | 1 | 97.50 | 0.00 | [97.5, 97.5] |

### One-Way ANOVA

- F(4, 767) = 8.729
- p < .05
- η² = 0.044 (Small effect)

### Model Ranking

1. **gpt-5.2**: M = 97.50 (n=1)
2. **sonnet**: M = 97.50 (n=1)
3. **deepseek**: M = 93.31 (n=442)
4. **nemotron**: M = 86.44 (n=299)
5. **haiku**: M = 84.20 (n=29)

## Interpretation

Model selection has a statistically significant effect on suggestion quality (F(4, 767) = 8.73, p < .05, η² = 0.044).

## Limitations

- Confounded with profile differences (prompts, dialogue settings)
- Unbalanced sample sizes across models
- No direct A/B comparison with identical prompts

## Implications

- gpt-5.2 shows the highest mean score but with n=1 observations
- deepseek offers good quality at minimal cost
- Consider running controlled experiments varying only the model
