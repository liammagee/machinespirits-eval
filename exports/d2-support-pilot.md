# D2 Path 1 — Peer Support Coaching: Cross-Application Adjacency Pilot

Generated: 2026-04-17T14:40:53.810Z

Tests whether the recognition main effect transfers to a domain where the skill being coached is itself de-pedagogical (listener presence, sitting with distress, declining to fix). Haiku 4.5 generation × Sonnet 4.6 judge, matched to the A6 single-prompt-mode contrasts.

## Primary result

| Contrast | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|----------|--------|---------|----------------|-----------------|---|------------------|
| D2 Path 1: Peer support coaching (cells 1/5, single-prompt mode) | 15 | 15 | 52.25 (9.63) | 69.92 (12.73) | 17.67 | **1.57** |

Magnitude: very large under Cohen's conventions.

## Comparison against A6 domains

| Contrast | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|----------|--------|---------|----------------|-----------------|---|------------------|
| D2 Path 1: Peer support coaching (cells 1/5, single-prompt mode) | 15 | 15 | 52.25 (9.63) | 69.92 (12.73) | 17.67 | **1.57** |
| A6 SEL (cells 1/5, single-prompt mode) | 15 | 15 | 55.25 (9.31) | 76.33 (13.52) | 21.08 | 1.82 |
| A6 Programming (cells 1/5, single-prompt mode) | 15 | 15 | 47.75 (9.10) | 70.42 (10.30) | 22.67 | 2.33 |
| A6 Philosophy anchor (cells 80/84, messages mode) | 18 | 18 | 43.61 (11.68) | 74.10 (10.81) | 30.49 | 2.71 |

Δd vs closest A6 domain (SEL): -0.25.

## Interpretation

Recognition produces a very large positive effect (d = 1.57) on tutor-side quality when the domain being coached is peer support listening rather than traditional knowledge transfer. The directional claim — that recognition-enhanced tutoring helps the tutor coach even a de-pedagogical skill — replicates. This is an *adjacency* test, not a full cross-application test (the tutor prompt still frames the LLM as a tutor); the stronger claim requires role-reframed prompts, deferred to D2 Path 2.

## Confounds and caveats

- **Structurally still tutoring**: the LLM is prompted as a tutor coaching a trainee, not as a peer support listener directly. A true cross-application test requires role-reframed prompts (D2 Path 2, deferred).
- **Single application**: one application does not support a cross-application generalization claim. The pilot shows whether recognition *can* help in at least one non-philosophical-tutoring-like domain, not whether it helps across applications broadly.
- **Same generation and judge as A6**: Haiku 4.5 generation, Sonnet 4.6 judge, held constant. Cross-judge validation on D2 was not run for this pilot (Sonnet-only).
- **Scenario counts match A6**: 4 core + 1 mood = 5 scenarios × 3 runs = n=15 per cell, matching the A6 per-domain sample size.
