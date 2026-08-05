# A6 — Domain Generalization: Multi-Domain Recognition Replication

Generated: 2026-04-17T13:47:32.859Z

All contrasts use Haiku 4.5 generation and Sonnet 4.6 judge. Domain varies across five content packages. Conversation mode is single-prompt for the four non-philosophy contrasts and messages for the philosophy contrast (a known confound).

## Recognition main effect by domain

| Domain | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|--------|--------|---------|----------------|-----------------|---|------------------|
| Programming (cells 1/5, single-prompt mode) | 15 | 15 | 47.75 (9.10) | 70.42 (10.30) | 22.67 | **2.33** |
| Elementary math (cells 1/5, single-prompt mode) | 15 | 15 | 43.83 (8.00) | 58.67 (12.00) | 14.83 | **1.45** |
| Creative writing (cells 1/5, single-prompt mode) | 15 | 15 | 52.08 (6.40) | 72.42 (13.17) | 20.33 | **1.96** |
| Social-emotional learning (cells 1/5, single-prompt mode) | 15 | 15 | 55.25 (9.31) | 76.33 (13.52) | 21.08 | **1.82** |
| Philosophy (cells 80/84, messages mode) | 18 | 18 | 43.61 (11.68) | 74.10 (10.81) | 30.49 | **2.71** |

## Magnitude and direction summary

- Direction: all 5 domains show recognition > base.
- Magnitude range across domains: d = 1.45 – 2.71.
- All domains classified as: very large.

## Domain × recognition interaction (vs philosophy anchor)

Philosophy anchor: d = **2.71** (mode: messages).

| Non-philosophy domain | d | Δd vs philosophy | Interpretation |
|-----------------------|---|------------------|----------------|
| Programming | 2.33 | -0.38 | moderate interaction |
| Elementary math | 1.45 | -1.25 | large interaction |
| Creative writing | 1.96 | -0.75 | large interaction |
| Social-emotional learning | 1.82 | -0.89 | large interaction |

Conversation mode differs between the non-philosophy contrasts (single-prompt) and the philosophy anchor (messages). The Δd values therefore conflate domain effects with a known mode effect (§6.3, §6.5).

## Interpretation

Recognition produces a positive effect on tutor quality in all 5 tested domains under matched Haiku × Sonnet generation × judge. Effect magnitudes span 1.45–2.71, all within the "very large" to "very large" range under Cohen's conventions.

The A6 question --- whether the recognition mechanism generalizes across content domains --- answers **yes on the directional criterion** across philosophy, programming, elementary math, creative writing, and social-emotional learning. The mechanism language in §6.1 / §6.2 is defensible across this five-domain range. Quantitative comparison across domains is constrained by the mode confound (single-prompt vs messages) and by scenario-count / scenario-type differences.

## Confounds and caveats

- **Conversation mode**: the four non-philosophy contrasts use single-prompt-mode cells (1, 5); the philosophy anchor uses messages-mode cells (80, 84). Mode is a known moderator of effect magnitude.
- **Scenario counts and types**: each non-philosophy domain is 5 single-turn scenarios (4 core + 1 mood), 3 runs, $n = 15$ per cell; philosophy is 9 messages-mode scenarios × 2 runs, $n = 18$ per cell. Scenario content is domain-specific and not pairwise-matched across domains.
- **Same generation model and judge**: Haiku 4.5 generation, Sonnet 4.6 judge, held constant across all five contrasts.
- **Cross-judge validation**: the philosophy row replicates across Sonnet 4.6, Gemini 3.1 Pro, and GPT-5.4 (§6.4). Cross-judge validation on the four new domains was not run for this closure.
