# C3 — Domain Generalization: Programming vs Philosophy

Generated: 2026-04-17T03:27:55.094Z

Both contrasts use Haiku 4.5 generation and Sonnet 4.6 judge. Domain differs (programming vs philosophy); conversation mode also differs as a known confound (single-prompt vs messages).

## Recognition main effect by domain

| Domain | N base | N recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|--------|--------|---------|----------------|-----------------|---|------------------|
| Programming (cells 1/5, single-prompt mode) | 15 | 15 | 47.75 (9.10) | 70.42 (10.30) | 22.67 | **2.33** |
| Philosophy (cells 80/84, messages mode) | 18 | 18 | 43.61 (11.68) | 74.10 (10.81) | 30.49 | **2.71** |

## Domain × recognition interaction

- Programming recognition d: **2.33**
- Philosophy recognition d: **2.71**
- Difference (prog − phil): **-0.38**

The domain × recognition interaction is moderate — recognition effect differs in magnitude by domain, but replicates in direction.

## Interpretation

Recognition produces a very large positive effect on programming content (d = 2.33), replicating the directional pattern from philosophy. Under Cohen's conventions, d > 0.8 is "large" and d > 1.3 is "very large."

The central C3 question --- whether recognition generalizes across domains --- answers **yes on the directional criterion**: the main effect is very large and positive in both domains under the same generation × judge configuration. The magnitude is comparable (within 0.38 d-units of philosophy), supporting the "mechanism" language for the two supported mechanisms (calibration, error correction) across a philosophy $\to$ programming domain shift.

## Confounds and caveats

- **Conversation mode**: programming used single-prompt-mode cells (1, 5); the closest Sonnet-judged Haiku philosophy contrast is on messages-mode cells (80, 84). Mode is a known moderator. The interaction test below should therefore be read as "domain + mode" combined, not domain alone.
- **Scenarios**: 5 single-turn programming scenarios vs 9 messages-mode philosophy scenarios. Different scenario counts and types; philosophy scenarios are the established pilot-era set.
- **N**: programming $n = 15$ per cell (3 runs × 5 scenarios), philosophy $n = 18$ per cell (2 runs × 9 scenarios) — both adequate for the Cohen's d estimates reported here.
- **Other domains**: elementary math, creative writing, and SEL content packages exist in the repository but were not evaluated in this closure.
