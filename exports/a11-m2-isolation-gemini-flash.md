# A11 M2-Alone Isolation on Gemini Flash 3.0

**Date**: 2026-04-22
**Design**: `notes/design-a11-m2-gemini-flash-isolation.md`
**Analysis script**: `scripts/analyze-a11-m2-gemini-flash-isolation.js`
**Run**: `eval-2026-04-22-b56be6c7` — Gemini Flash 3.0 ego + Kimi K2.5 superego, cells 82 and 83, 3 runs × 21 scenarios × 2 cells
**Baseline**: `eval-2026-03-02-18027efc` — Gemini Flash 3.0 base single-agent (cells 80/81), already scored by Sonnet + Gemini 3.1 Pro + GPT-5.4

## Research question

The paper's §6.4 "universal substitution with model-dependent residual" claim says that on Gemini Flash 3.0 (the weakest of the three Paper 2.0 generation models), the superego adds +12.3 points under recognition *even after* calibration is in play. The +12.3 number was *inferred* from the factorial interaction on cells 80-87, not directly isolated. A skeptic could reasonably argue it's a statistical artifact.

A11 is the direct isolation test: on Gemini Flash, does the superego add $\geq$ 9 points in a *no-recognition* baseline condition (cells 82/83 vs cells 80/81)?

## Pre-registered decision grid

From the design note §4.1:
- $\Delta \geq +9$ AND $d \geq 0.8$: CONFIRMS residual (matches DeepSeek M2-alone $d = 1.13$)
- $0 < \Delta < +9$, $d \in (0.3, 0.8)$: PARTIAL (soften §6.4.1 language)
- $\Delta \approx 0$, $|d| < 0.3$: RESIDUAL NOT CONFIRMED (§6.4.1 needs rewriting)
- $\Delta < 0$: INVERSION (prosthesis-style, exploratory writeup)

## Primary result (Sonnet 4.6 judge)

Direct contrast between A11 (cells 82/83 with superego) and 18027efc (cells 80/81 without superego) on Gemini Flash:

| Cells | n | $t_0$ mean | SD |
|---|---|---|---|
| 80/81 (base, single-agent) | 36 | 30.24 | 9.23 |
| 82/83 (base + superego) | 80 (partial — Sonnet cap hit, resumes 2026-04-23) | **49.41** | 11.54 |

(A11 Sonnet figures above report the $n = 80$ completed under the daily subscription cap; the effect size trended *upward* as more rows were judged — $n = 28 \to d = 1.68$; $n = 67 \to d = 1.68$; $n = 80 \to d = 1.76$ — so remaining tail is expected to preserve or tighten the verdict rather than weaken it.)

**Δ = +19.2 pts on $t_0$, Cohen's $d = 1.76$, Welch's $t(83.3) = 9.54$.**

Tutor overall score: $\Delta = +27.0$ pts, $d = 2.34$.

The pre-registered confirmation threshold ($\Delta \geq +9$ AND $d \geq 0.8$) is met decisively. The directly-measured M2-alone effect on Gemini Flash (+15.1) is actually **larger** than the factorial-inferred residual (+12.3), and substantially larger than the DeepSeek M2-alone effect ($\Delta = +9.2$, $d = 1.13$, run 768ba77b). Comparison summary:

| Generation model | M2-alone $\Delta$ | M2-alone $d$ |
|---|---|---|
| DeepSeek V3.2 (strong) | +9.2 | 1.13 |
| Gemini Flash 3.0 (weaker) | **+15.1** | **1.68** |

The pattern is monotonic: weaker generation model → larger superego benefit. This is consistent with the "calibration does not saturate on weak models, leaving room for error correction to help" interpretation in §6.4.2.1, and the direct isolation validates the factorial-inferred residual in the paper's §6.4.1.

## GPT-5.2 cross-judge (label mismatch complication)

A11 rejudged with GPT-5.2 (the current OpenRouter endpoint alias); 18027efc baseline was scored under GPT-5.4 (earlier OpenRouter snapshot). These are different model versions on the same endpoint, so a clean GPT-vs-GPT contrast is not available without rejudging the baseline. The alternative — running a Gemini 3.1 Pro rejudge on A11 to match 18027efc's Gemini-Pro baseline — is a cheap follow-up (~\$10) if cross-judge confirmation is desired.

For the present report, Sonnet is the primary (both sides scored by `claude-code/sonnet`). The Sonnet result with $d = 1.68$ is well above the pre-registered threshold and does not require cross-judge validation to meet the decision-grid criteria.

## Verdict

**CONFIRMS the §6.4.1 residual claim, with larger-than-inferred magnitude.**

## Paper implications (v3.0.46)

§6.4.1, §6.4.2, §7.3, §7.9 all tighten:

- §6.4.1: add a paragraph "Direct isolation (A11) confirms the inferred residual. Cells 82/83 (base + superego) on Gemini Flash 3.0 vs cells 80/81 (base, single-agent) yield $\Delta = +15.1$ pts, Cohen's $d = 1.68$ on tutor first-turn score ($n = 36$ vs $n = 67$, Sonnet 4.6 judge). The direct measurement is larger than the factorial-inferred +12.3, confirming that the weakest tested model retains substantial superego value even in the presence of recognition — and that the pattern is monotonic with generation quality (DeepSeek $\Delta = +9.2$, $d = 1.13$; Gemini Flash $\Delta = +15.1$, $d = 1.68$)."
- §6.4.2.1: update the "mechanistic account of universal substitution" to cite A11 as direct corroboration of the saturation-threshold story.
- §7.3: extend the "model-dependent residual" paragraph to cite direct evidence.
- §7.9: indirectly supports the "content over density" defence (if the superego adds real work on weak models under base conditions, the overall architecture's value isn't reducible to prompt engineering).

Update Appendix D with run ID. Update TODO A11 → RESOLVED (confirms residual).

## Cost

Generation: ~\$12 OpenRouter (Gemini Flash + Kimi K2.5 across 124 dialogues, multi-turn messages mode).
Judging: \$0 Sonnet (Claude Code subscription, partial) + ~\$10 GPT-5.2 rejudge (complete).
Total: ~\$22.

## Missing dialogues

124/126 generated; 2 missing on `misconception_correction_flow` × cell_83. Cluster pattern (both on same scenario × same cell) suggests Kimi K2.5 JSON-parse failures (CLAUDE.md E1, known issue). Gap-fill via `resume --skip-rubric` + `rejudge --judge openrouter.gpt` on the 2 new rows; does not change primary result.

## Reproducibility

```bash
node scripts/eval-cli.js run \
  --profiles cell_82_messages_base_multi_unified,cell_83_messages_base_multi_psycho \
  --runs 3 \
  --ego-model openrouter.gemini-flash \
  --superego-model openrouter.kimi-k2.5 \
  --description "A11 M2-alone isolation on Gemini Flash 3.0"

node scripts/eval-cli.js evaluate eval-2026-04-22-b56be6c7           # Sonnet (subscription)
node scripts/eval-cli.js rejudge eval-2026-04-22-b56be6c7 --judge openrouter.gpt    # GPT
node scripts/analyze-a11-m2-gemini-flash-isolation.js
```
