# A5 — Writing Pad Controlled Ablation

Generated: 2026-04-19T22:05:21.609Z
Run ID: eval-2026-04-17-f1e851c3
Judge: claude-code/sonnet

Tests whether the Freudian Writing Pad (three-layer tutor memory) is necessary for the recognition effect, or whether recognition transfers without it. 2×2 factorial: recognition (base/recog) × Writing Pad (on/off). All cells share nemotron ego + kimi-k2.5 superego, dialectical prompts, suspicious superego disposition.

## Cell means (tutor first-turn score, 0-100)

| | Writing Pad ON (cells 40/41) | Writing Pad OFF (cells 93/94) | Row mean |
|---|---|---|---|
| Base | 36.01 (SD=12.68, n=63) | 37.76 (SD=12.90, n=63) | 36.88 (n=126) |
| Recog | 42.94 (SD=11.89, n=63) | 47.60 (SD=13.59, n=63) | 45.27 (n=126) |
| Col mean | 39.47 (n=126) | 42.68 (n=126) | **41.08** (N=252) |

## Main effects and interaction (2-way ANOVA, Type I)

| Effect | SS | df | F | p | η² |
|---|---|---|---|---|---|
| Recognition (A) | 4427.2 | 1 | 27.10 | < .001 | 0.097 |
| Writing Pad (B) | 646.9 | 1 | 3.96 | 0.048 | 0.014 |
| A × B interaction | 134.0 | 1 | 0.82 | 0.366 | 0.003 |
| Within (error) | 40514.0 | 248 | — | — | — |
| Total | 45722.1 | 251 | — | — | — |

## Simple contrasts (Cohen's d, pooled SD)

| Contrast | d |
|---|---|
| Recog − Base (Writing Pad ON) | 0.56 |
| Recog − Base (Writing Pad OFF) | 0.74 |
| Pad ON − Pad OFF (Base) | -0.14 |
| Pad ON − Pad OFF (Recog) | -0.37 |

## Interpretation

- **Recognition main effect**: Δ = 8.38 (recog − base). Significant.
- **Writing Pad main effect**: Δ = -3.20 (pad ON − pad OFF). Significant. Pad OFF scores **higher** (against Writing Pad necessity).
- **Interaction**: n.s. — recognition effect is similar with or without Writing Pad.

### What this means for the paper

The Writing Pad is **not load-bearing** for the recognition effect. Recognition raises scores in both pad-on (d=0.56) and pad-off (d=0.74) conditions, with no significant interaction (F=0.82, p=0.366). Disabling the three-layer memory scaffolding actually scores slightly **higher** without the pad overall (main effect p=0.048, d=-0.37 within recog condition). This refutes the "Writing Pad is necessary" hypothesis and suggests recognition operates at the prompt level, not via the memory architecture.

## Caveats

- Single domain (philosophy). A cross-domain replication would strengthen the generalization.
- Single ego/superego model pair (nemotron × kimi-k2.5). Effect may differ with other model combinations.
- Judge: Sonnet 4.6 (single judge). Cross-judge validation would reduce judge-specific variance.
- Writing Pad is only one of several memory/reflection mechanisms. Disabling it may not cleanly isolate memory architecture from other features.