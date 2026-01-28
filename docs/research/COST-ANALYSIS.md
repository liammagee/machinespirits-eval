# Evaluation Cost Analysis

**Generated:** 2026-01-14T21:05:05.980Z

## Overview

This document provides token usage and cost analysis for evaluation runs, supporting reproducibility and cost planning.

## Model Pricing

| Model | Input ($/M) | Output ($/M) | Provider |
|-------|-------------|--------------|----------|
| Nemotron 3 Nano 30B | $0.00 | $0.00 | OpenRouter (free) |
| Claude Sonnet 4.5 | $3.00 | $15.00 | OpenRouter |
| Claude Haiku 4.5 | $0.80 | $4.00 | OpenRouter |

## Battery Scenario Results

| Scenario | Turns | Tutor Tokens | Learner Tokens | Total Cost | Score |
|----------|-------|--------------|----------------|------------|-------|
| Battery: Cognitive Learner + Quality Tutor | 9 | 34,053 | 2,473 | $0.1177 | N/A |
| Battery: Dialectical Learner + Budget Tutor | 7 | 19,288 | 2,485 | $0.0823 | N/A |
| Battery: Ego/Superego Learner + Recognition Tutor | 9 | 45,826 | 2,099 | $0.1450 | N/A |
| Battery: Extended Multi-Turn Dialogue | 17 | 94,487 | 3,981 | $0.2663 | N/A |
| Battery: Psychodynamic Learner + Recognition Plus Tutor | 9 | 48,571 | 2,825 | $0.1534 | N/A |
| Battery: Unified Learner + Baseline Tutor | 7 | 25,058 | 1,653 | $0.0941 | N/A |
| **TOTAL** | 58 | 267,283 | 15,516 | **$0.8587** | |

## Cost by Component

| Component | Model | Tokens | Cost |
|-----------|-------|--------|------|
| Tutor (Ego+Superego) | Nemotron 3 Nano 30B | 267,283 | $0.0000 |
| Learner (Ego+Superego) | Nemotron 3 Nano 30B | 15,522 | $0.0000 |
| Judge | Claude Sonnet 4.5 | 202,591 | $0.8587 |

## Hypothetical: All Claude Sonnet 4.5

| Configuration | Total Cost | Multiplier |
|---------------|------------|------------|
| Current (Nemotron + Sonnet Judge) | $0.8587 | 1.0x |
| All Sonnet 4.5 | $2.9763 | 3.5x |

## Reproducibility

To regenerate this analysis:

```bash
node scripts/analyze-eval-costs.js
```

To get JSON output for programmatic use:

```bash
node scripts/analyze-eval-costs.js --json
```
