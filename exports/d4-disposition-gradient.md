# D4 — Disposition Gradient Replication on SEL

Generated: 2026-04-17T19:03:22.467Z
D4 run ID: eval-2026-04-17-4a9b765a

Tests whether the disposition gradient documented on philosophy (hostile > moderate > cooperative superegos benefit from recognition in that order) replicates on social-emotional learning (SEL). Paper §3.4 Prediction 3 cites cells 40-45 on philosophy with gradient susp > adv > advocate.

## Primary result: D4 SEL (cells 22-27, Haiku 4.5 × Sonnet 4.6)

### SEL

| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|-------------|----------------|----------------|-----------------|---|------------------|
| suspicious | 24 / 24 | 50.7 (21.8) | 75.1 (17.0) | 24.4 | **1.25** |
| adversary | 22 / 23 | 54.4 (25.5) | 66.6 (20.1) | 12.1 | **0.53** |
| advocate | 24 / 24 | 50.2 (19.4) | 71.0 (18.9) | 20.9 | **1.09** |

Gradient direction on SEL: susp Δ=24.4 vs adv Δ=12.1 vs advocate Δ=20.9. **Predicted gradient does NOT reproduce.**

## Philosophy baselines

Two existing-DB baselines for comparison. Both are Opus 4.6-judged (the D4 SEL run is Sonnet 4.6-judged, so judge-model differs — flagged as confound below).

### Philosophy, cells 22-27 (standard ego + divergent superego, Haiku × Opus) — matched cells

| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|-------------|----------------|----------------|-----------------|---|------------------|
| suspicious | 10 / 10 | 62.4 (6.7) | 62.4 (10.3) | -0.1 | **-0.01** |
| adversary | 10 / 10 | 55.8 (11.6) | 65.2 (7.1) | 9.3 | **0.97** |
| advocate | 9 / 5 | 56.1 (9.1) | 69.7 (5.1) | 13.6 | **1.70** |

### Philosophy, cells 40-45 (dialectical ego + divergent superego, Haiku × Opus) — paper-cited gradient

| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Δ | d (recog − base) |
|-------------|----------------|----------------|-----------------|---|------------------|
| suspicious | 18 / 17 | 80.4 (13.2) | 90.2 (9.4) | 9.7 | **0.85** |
| adversary | 18 / 18 | 83.2 (13.3) | 90.2 (8.8) | 7.0 | **0.62** |
| advocate | 17 / 17 | 83.2 (11.5) | 88.9 (10.4) | 5.6 | **0.51** |

## Comparison

| Domain | Cells | Generator | Judge | susp Δ | adv Δ | advocate Δ | Gradient |
|--------|-------|-----------|-------|--------|-------|------------|----------|
| **SEL (D4)** | 22-27 | Haiku 4.5 | Sonnet 4.6 | 24.4 | 12.1 | 20.9 | 24.4 > 12.1 < 20.9 |
| Philosophy | 22-27 | Haiku 4.5 | Opus 4.6 | -0.1 | 9.3 | 13.6 | -0.1 < 9.3 < 13.6 |
| Philosophy | 40-45 | Haiku 4.5 | Opus 4.6 | 9.7 | 7.0 | 5.6 | 9.7 > 7.0 > 5.6 |

## Interpretation

The disposition gradient **does NOT replicate directionally on SEL**. This would suggest that Prediction 3 (recognition emerges from struggle) is philosophy-specific and does not generalize to SEL. Interpretation requires care — single replication does not foreclose the effect, but it does bound domain-general claims.

## Confounds and caveats

- **Judge-model differs**: D4 SEL uses Sonnet 4.6; philosophy baselines are Opus 4.6. Sonnet and Opus produce different absolute magnitudes (see §6.4 cross-judge validation). Direction-of-gradient should replicate across judges, but Δ magnitudes are not directly comparable. A matched-judge replication would rejudge either side.
- **Cells 22-27 vs 40-45**: D4 uses standard ego + divergent superego (cells 22-27); the paper-cited gradient uses dialectical ego + divergent superego (cells 40-45). The two contrasts differ in ego architecture; the gradient is expected to replicate in both under the same theoretical account, but the precise magnitudes will differ.
- **Single-domain replication**: this extends the gradient from 1 to 2 domains. A cross-application generalization claim would require additional domains.
- **Learner-side test deferred**: the D4 scope also includes testing whether recognition rescues hostile learner-side superegos. This requires new cells (learner-side disposition variants) and is out of scope for the current pass.
