# A3 — Capability Threshold for Cognitive Prosthesis

Generated: 2026-04-21T00:11:01.504Z

Tests the hypothesis: does cell_66 (superego-routed bidirectional profiling, "cognitive prosthesis") help low-capability models more than high-capability ones? Design: 6 ego models × 2 cells (cell_5 base vs cell_66 prosthesis). All cells share kimi-k2.5 superego, recognition-mode prompts. Judge is selected per model: within-judge (matched) when both cells share a judge with n≥20, else dominant-judge per cell (cross-judge, flagged ⚠). Models are ordered by baseline capability (cell_5 mean). Dry-run mock judges are excluded.

## Per-model means and prosthesis effect (tutor first-turn score, 0-100)

| Ego Model | Judge | Baseline (cell_5) | Prosthesis (cell_66) | Δ | 95% CI | Cohen's d |
|---|---|---|---|---|---|---|
| Qwen 3.5 | claude-code/sonnet | 65.65 (SD=13.20, n=63) | 66.33 (SD=13.93, n=59) | +0.68 | [-4.14, 5.50] | 0.05 |
| Nemotron | claude-opus-4.6 | 66.38 (SD=14.28, n=84) | 48.28 (SD=13.42, n=30) | -18.11 | [-23.80, -12.42] | -1.29 |
| GLM-4.7 | claude-opus-4.6 / claude-code/sonnet ⚠ | 83.96 (SD=9.64, n=30) | 58.91 (SD=13.60, n=63) | -25.05 | [-29.87, -20.24] | -2.01 |
| DeepSeek V3.2 | claude-opus-4.6 / claude-code/sonnet ⚠ | 84.20 (SD=11.72, n=30) | 53.92 (SD=14.75, n=43) | -30.27 | [-36.36, -24.19] | -2.23 |
| Kimi K2.5 | claude-opus-4.6 / claude-code/sonnet ⚠ | 89.93 (SD=8.60, n=219) | 64.55 (SD=14.45, n=44) | -25.38 | [-29.80, -20.96] | -2.59 |
| Haiku 4.5 | claude-opus-4.6 / claude-code/sonnet ⚠ | 91.25 (SD=7.02, n=107) | 69.14 (SD=13.75, n=48) | -22.10 | [-26.22, -17.99] | -2.30 |

⚠ = cross-judge comparison (baseline and prosthesis scored by different judges). Within-judge rows are directly comparable; cross-judge rows carry judge-stringency confound.

## Capability threshold test (linear regression of Δ on baseline)

- **Slope**: -0.713 (change in Δ per 1-point increase in baseline)
- **Intercept**: 37.13
- **Pearson r**: -0.744
- **R²**: 0.553

Interpretation: as baseline capability increases by 1 point, the prosthesis effect becomes 0.713 points more negative.

## Interpretation

Using 95% CIs on Δ: 5/6 models show significant harm, 1 show null effect, 0 show significant benefit.

**Within-judge (matched, n=2)**: Nemotron Δ=-18.11 (d=-1.29); Qwen 3.5 Δ=0.68 (d=0.05).

**Regression**: Δ ~ baseline slope = -0.713 (r=-0.744, R²=0.553). Stronger baseline ⇒ larger harm, but note the relationship is driven partly by the one null-effect model (Qwen) sitting at the lowest baseline.

### What this means for the paper

The capability-threshold hypothesis predicted prosthesis would *help* weaker models (compensating for ego-reasoning limits) and *hurt* stronger ones (disrupting already-competent reasoning). The data partially inform this story but do not confirm it:

- Of the two within-judge matched comparisons, one model (Qwen 3.5, baseline 65.7) shows **null** effect, the other (Nemotron, baseline 66.4) shows **substantial harm** (d=-1.29). Two low-capability models, opposite outcomes — so capability alone does not predict prosthesis response.
- For the four higher-capability models, cross-judge comparisons consistently show large harm (d ≤ -2.0). These are confounded with the fact that baseline uses opus-4.6 and prosthesis uses code/sonnet, which likely differs in stringency. The directional signal is robust; the magnitude estimates are inflated.
- The regression slope (Δ on baseline, r=-0.744) is not a clean capability-threshold signal in the Nagel sense. A sharper question is: what about Qwen's response pattern makes prosthesis neutral where it's harmful for Nemotron? Early candidates: response-length norms, dialectical synthesis tolerance, or architectural affinity for the bidirectional profiling schema.

Headline for paper §6.6.x: prosthesis is **not uniformly beneficial on weaker models and not uniformly harmful on stronger ones**; the architectural cost is model-dependent and motivates the authentic-learner/no-prosthesis variants already reported in cells 78-79. The capability-threshold hypothesis, as originally framed, is not supported.

## Caveats

- **Judge confound (primary)**: only 2/6 model(s) have matched within-judge comparison. For the rest, baseline and prosthesis are scored by different judges; the Δ reflects both the architectural effect and judge-stringency drift. The matched comparisons (if any) are the cleanest evidence.
- Single superego (kimi-k2.5). A different superego may alter the prosthesis signal.
- Single domain (philosophy). Cross-domain replication would strengthen the generalization.
- Only one prosthesis variant (descriptive). Prescriptive (cell_67) and adversary (cell_68) are not tested here.
- Effective n below 63 for several prosthesis cells due to OpenRouter credit exhaustion mid-run. The smallest (Nemotron n=30, DeepSeek n=43) still support clear directional inference within the available judge.