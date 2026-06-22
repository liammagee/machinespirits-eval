# Curriculum Drama Model-Routing Runs

Date: 2026-06-20
Status: ancillary engineering note
Scope: AI Foundations first-lesson rhetorical light-drama generation, `D_AF1_CURRICULUM_ADAPTIVE`

## Question

Can cheaper or less capable models carry selected drama-generation subroles while Codex or Sonnet preserve supervisory quality?

The concrete probe was:

- `director = Codex`
- `tutor_ego = GLM-5.2 via OpenRouter`
- `tutor_superego = Codex`
- `learner_ego = GLM-5.2 via OpenRouter`
- `learner_superego = Codex`

This was compared against the existing first-lesson Codex-only run and the previous all-GLM retry run.

## Artifacts

| Run | Artifact directory | Notes |
| --- | --- | --- |
| Codex only | `exports/curriculum-light-drama/ai-foundations-first-lesson-rhetorical/codex-split-full/` | Existing baseline; 40 Codex calls. |
| GLM only | `exports/curriculum-light-drama/ai-foundations-first-lesson-rhetorical/glm5_2-api-split-full-retry/` | Existing completed retry; 40 OpenRouter API calls. |
| GLM ego + Codex superego/director | `exports/curriculum-light-drama/ai-foundations-first-lesson-rhetorical/glm5_2-ego-codex-superego-split-full/` | New mixed-role run. |
| Mixed HTML render | `exports/curriculum-light-drama/ai-foundations-first-lesson-rhetorical/glm5_2-ego-codex-superego-split-full/dialog.html` | Public-readable render of the mixed run. |

The mixed run used:

```bash
--role-map "director=codex,tutor_ego=api:glm5_2,tutor_superego=codex,learner_ego=api:glm5_2,learner_superego=codex"
```

## Telemetry Summary

| Run | Calls | Backend split | Telemetry latency | Metered API tokens | Metered API cost |
| --- | ---: | --- | ---: | ---: | ---: |
| Codex only | 40 | 40 Codex | 12.20 min | unavailable | unavailable |
| GLM ego + Codex superego/director | 40 | 26 API, 14 Codex | 25.80 min | 187,666 | $0.389746 |
| GLM only retry | 40 | 40 API | 40.54 min | 289,575 | $0.598107 |

The mixed run finished in about 29.0 minutes elapsed wall time. Its telemetry latency was 25.80 minutes because telemetry sums individual LLM call durations and excludes some harness overhead.

## Role-Level Pattern

The mixed run did reduce API volume relative to all-GLM, but it was not faster than Codex-only.

Mixed-run role details:

| Role | Calls | Backend | Total latency | Mean | Median | Max | API cost |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| director | 1 | Codex | 0.51 min | 30.5s | 30.5s | 30.5s | unavailable |
| learner_ego | 14 | GLM API | 7.93 min | 34.0s | 34.5s | 98.0s | $0.148662 |
| learner_superego | 7 | Codex | 2.16 min | 18.5s | 18.2s | 21.8s | unavailable |
| tutor_ego | 12 | GLM API | 12.86 min | 64.3s | 28.1s | 245.3s | $0.241084 |
| tutor_superego | 6 | Codex | 2.35 min | 23.5s | 24.2s | 27.0s | unavailable |

The main problem was GLM tail latency on large ego prompts, especially tutor ego. During the mixed run there were two OpenRouter empty-body retries, one on `learner_ego` and one on `tutor_ego`. The worst GLM API call took 245.3 seconds.

## Quality Check

Both Codex-only and mixed-role outputs were scored with Sonnet as a non-authoring critic using `scripts/score-poetics-phase2.js`.

| Run | Form | Recon | Stated insight | Rupture | Coherence | Action | Mechanism | Quality |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Codex only | recognition | 75 | 75 | 75 | 100 | 100 | 75 | 75 |
| GLM ego + Codex superego/director | recognition | 100 | 50 | 75 | 100 | 100 | 75 | 75 |

The mixed run did not show an obvious quality collapse in this one-item score. It scored lower on stated-insight salience and higher on structural recontextualization, which is potentially desirable, but this is still a single transcript and should not be treated as a result.

## Interpretation

This is a useful diagnostic, not a paper-level empirical finding.

What it supports:

- Role routing now works technically for mixed Codex/API model assignments.
- GLM-5.2 can carry ego roles without immediate rubric failure in this AF1 sample.
- Routing superego/director to Codex reduces GLM API cost compared with all-GLM.

What it does not support:

- It does not show a speed gain over Codex-only.
- It does not prove GLM is interchangeable with Codex or Sonnet for ego roles.
- It does not establish stable quality because `n = 1`, same lesson, same seed, and one non-authoring critic.
- It does not provide learner-outcome evidence.

The best current use of GLM-5.2 is therefore not "fast replacement backend." It is a candidate for narrower or prompt-slimmed ego subroles where cost matters and tail latency can be tolerated or amortized. For the current large curriculum-drama prompts, Codex-only remains the faster path among the compared completed runs.

## Paper Placement

Recommendation: keep this as an ancillary note for now.

Do not add the numbers to the full paper as empirical results. They are formative engineering measurements from a single diagnostic comparison and would overstate the evidence if reported alongside the main evaluation tables.

Possible future paper use:

- A short methods footnote or appendix note could mention that mixed-role routing was instrumented and used as an engineering control during curriculum-drama development.
- A paper-level claim would require a small controlled routing ablation first: at minimum AF1 and AF11, two or more seeds, fixed prompt mode, fixed scorer, recorded retry/failure rates, and quality scoring by a non-authoring critic.
- If that ablation is added to the paper, the claim should be modest: model routing affects generation cost and latency, while quality remains an independently scored outcome. It should not be framed as evidence for learner learning or for the main adaptive-tutelage hypotheses.

## Next Practical Step

If we continue this line, do not rerun large full prompts first. Implement or test prompt slimming/context compression, then repeat the same three-way comparison:

1. Codex-only.
2. GLM ego + Codex superego/director.
3. All-GLM API.

Hold lesson, seed, max turns, opening speaker, director policy, prompt mode, and scorer fixed. Record retries and tail latency explicitly.
