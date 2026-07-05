# D2 Role-Transfer Analysis

Source: `exports/d2-role-transfer-v1-scored.jsonl`
Study: `d2_role_transfer_v1`
Run IDs: `d2_role_transfer_v1-real-2026-06-24T22:30:10.460Z`
Generated rows: 36
Observations: 108
Mock observations: 0
Generator models: `anthropic/claude-haiku-4.5`

## Judges

| Judge label | Model(s) | n | mean | SD |
|---|---|---:|---:|---:|
| gemini | `google/gemini-3.1-pro-preview` | 36 | 97.29 | 11.33 |
| gpt | `openai/gpt-5.2` | 36 | 96.56 | 3.50 |
| sonnet | `anthropic/claude-sonnet-4.6` | 36 | 95.21 | 7.85 |

## Arm Means

| Arm | n | mean | SD |
|---|---:|---:|---:|
| transmission | 54 | 96.13 | 9.02 |
| intersubjective | 54 | 96.57 | 7.32 |

## Metered Cost

Generation: $0.0410
Judging: $0.7290
Total: $0.7700

## Primary Gate

Cohen d >= 1.0 for intersubjective_vs_transmission on at least two of the three core applications.

Verdict: **fail_or_scope_bound** (0/3 applications with d >= 1.0)

| Application | n transmission | n intersubjective | mean transmission | mean intersubjective | delta | d |
|---|---:|---:|---:|---:|---:|---:|
| peer_support | 18 | 18 | 91.39 | 93.40 | 2.01 | 0.15 |
| customer_service | 18 | 18 | 98.06 | 97.92 | -0.14 | -0.06 |
| code_review | 18 | 18 | 98.96 | 98.40 | -0.56 | -0.21 |
