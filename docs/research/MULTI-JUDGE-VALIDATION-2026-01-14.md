# Multi-Judge Validation Results

**Date:** 2026-01-14
**Status:** Preliminary (n=12 responses, 2 judges)

---

## 1. Executive Summary

Multi-judge validation reveals **significant inter-rater disagreement** between Gemini and GPT judges on the same tutor responses. This has important implications for evaluation validity.

**Key Findings:**
- **ICC(2,1) = 0.000** - No meaningful agreement between judges
- **Gemini shows severe acquiescence bias** - Mean 100.0, SD 0.0 (always perfect scores)
- **GPT is more discriminating** - Mean 73.9, SD 10.5 (realistic variance)
- **Mean Absolute Difference = 24.58 points** - Substantial disagreement

---

## 2. Results

### Inter-Rater Reliability

| Metric | Value | Interpretation |
|--------|-------|----------------|
| ICC(2,1) Overall | 0.000 | Poor - no systematic agreement |
| ICC(2,1) Relevance | 0.000 | Poor |
| ICC(2,1) Specificity | 0.000 | Poor |
| ICC(2,1) Pedagogical | 0.000 | Poor |
| ICC(2,1) Personalization | 0.000 | Poor |
| ICC(2,1) Actionability | 0.000 | Poor |
| ICC(2,1) Tone | 0.000 | Poor |

### Judge Characteristics

| Judge | N | Mean Score | SD | Interpretation |
|-------|---|------------|-----|----------------|
| Gemini (gemini-3-pro-preview) | 8 | 100.0 | 0.0 | Severe acquiescence bias - no discrimination |
| GPT (gpt-5.2) | 12 | 73.9 | 10.5 | Appropriate discrimination, realistic variance |

### Systematic Bias

- **Gemini vs GPT MAD:** 24.58 points
- **Direction:** Gemini systematically higher than GPT
- **Pattern:** Gemini gives uniformly positive evaluations regardless of response quality

---

## 3. Implications

### 3.1 For This Research

1. **Current evaluations used OpenRouter/Claude Sonnet** - Need to verify it shows appropriate discrimination
2. **Gemini should NOT be used as primary judge** - Lacks discriminant validity
3. **GPT shows promising characteristics** - Reasonable mean and variance

### 3.2 For Evaluation Design

1. **Single-judge evaluations are risky** - Different judges produce dramatically different results
2. **Judge selection matters significantly** - Not all LLMs are suitable as evaluators
3. **Need to test for acquiescence bias** - Check if judge gives high scores regardless of content

### 3.3 For Paper Claims

The finding that ICC = 0.000 raises questions about:
- Whether our reported effect sizes are judge-dependent
- Whether the dimension scores reflect actual quality differences
- Whether another judge might reverse our conclusions

---

## 4. Recommendations

### Short-term (For Current Paper)

1. **Document judge selection** - Explicitly state which model was used as judge
2. **Report judge characteristics** - Mean, SD, discrimination pattern
3. **Acknowledge limitation** - Single-judge evaluation is a methodological limitation
4. **Test primary judge** - Run our Sonnet judge against GPT to check agreement

### Medium-term (For Robust Publication)

1. **Establish multi-judge consensus** - Use 2-3 judges and aggregate scores
2. **Human validation** - Compare LLM judges against human ratings
3. **Adversarial scenarios** - Test whether judges can detect quality differences
4. **Report ICC** - Include inter-rater reliability as standard metric

---

## 5. Next Steps

1. **[ ] Run Claude Sonnet vs GPT comparison** - Need to check if our primary judge agrees with GPT
2. **[ ] Add adversarial test cases** - Create clearly good/bad responses to test discrimination
3. **[ ] Human validation sample** - Get human ratings on 50 responses
4. **[ ] Update paper methodology** - Document judge selection and validation

---

## 6. Technical Details

### Judges Tested

| Judge | Provider | Model ID | API Status |
|-------|----------|----------|------------|
| Claude | Anthropic | claude-sonnet-4-5 | Credit balance insufficient |
| GPT | OpenAI | gpt-5.2 | Working |
| Gemini | Google | gemini-3-pro-preview | Working (but acquiescent) |

### Sample

- **Source:** eval-2026-01-14-81c83366 (factorial evaluation)
- **N:** 12 tutor responses
- **Profiles:** single_baseline, single_recognition, baseline, recognition
- **Scenarios:** recognition_seeking_learner, resistant_learner, productive_struggle_arc

### ICC Calculation

Using ICC(2,1): Two-way random effects, absolute agreement, single measures

```
ICC = (MSR - MSE) / (MSR + (k-1)*MSE + k*(MSC-MSE)/n)

Where:
  MSR = Mean square rows (between items)
  MSC = Mean square columns (between raters)
  MSE = Mean square error (residual)
  n = number of items
  k = number of raters
```

---

## Appendix: Raw Data

```json
{
  "timestamp": "2026-01-14T...",
  "judges": ["gemini", "gpt"],
  "itemCount": 8,
  "overallICC": {
    "icc": 0,
    "interpretation": "poor",
    "n": 8,
    "k": 2
  }
}
```
