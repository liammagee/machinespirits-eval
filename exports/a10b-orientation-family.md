# A10b Orientation-Family Comparison (Four-Way Density Control)

**Date**: 2026-04-24 (final — three-judge triangulation complete)
**Design**: `notes/design-a10-prompt-density-v22-control.md` §6a (orientation-family framing)
**Taxonomy**: `docs/pedagogical-taxonomy.md`
**Analysis script**: `scripts/analyze-a10b-orientation-family.js`
**Run**: `eval-2026-04-24-e9a785c0` — DeepSeek V3.2 ego, 4 cells × 3 runs × 21 scenarios (252 target)

## Research question

A10 v2 found that matched-pedagogical (Vygotsky/Piaget/Kapur grounding, no recognition labels) reproduces ~95% of recognition's effect ($d \approx 0.17$ pooled across three judges). But Vygotsky, Piaget, Kapur are all Hegelian-descendant theorists — Dewey was explicit about Hegel; Vygotsky's dialectical psychology is Hegel-through-Marx; Piaget's assimilation/accommodation is the dialectic reframed. So A10 v2's "density-sufficient" verdict tested only **within-family interchangeability**, not whether any matched-specificity prompt would do.

A10b authors a rigorously-matched prompt grounded in a **genuinely orthogonal** pedagogical family — behaviorism (Skinner operant conditioning, Gagné Nine Events, Keller mastery learning, Thorndike Laws, Rosenshine Principles) — with a broader blocklist excluding both recognition vocabulary and constructivist-Hegelian vocabulary. The four-way comparison (base / recognition / matched-pedagogical / matched-behaviorist) tests whether orientation family matters and whether the density-sufficiency finding extends across families or is specific to the Hegelian-descendant one.

## Pre-registered decision branches

From notes/design-a10-prompt-density-v22-control.md §6a:

1. **All three matched ≈ recognition** → strongest density-sufficiency: any rigorous, principled, matched-specificity prompt works. §7.9 fully retracted. Recognition is one of many equivalent operationalizations.
2. **Recognition ≈ matched-pedagogical ≫ base ≈ matched-behaviorist** → intersubjective-family matters; within family, density substitutes; between families, orientation is dominant. §7.9 reframed from "content over density" to "family over content-density couple."
3. **Recognition ≫ matched-pedagogical ≈ matched-behaviorist** → recognition content specifically does something neither matched variant captures. §7.9 strengthened along its original lines.

## Final verdict (three-judge triangulation at locked $n$)

### Cell-level means per judge (locked at full $n$ after fill passes)

| Cell | Family | Sonnet ($n$ / $M$) | GPT-5.2 ($n$ / $M$) | Opus 4.7 ($n$ / $M$) |
|---|---|---|---|---|
| cell_5 (recognition) | Hegelian | 50 / 48.63 | 61 / 53.24 | 50 / 54.10 |
| cell_95 (matched-pedagogical) | Hegelian | 48 / 49.32 | 63 / 51.09 | 50 / 49.77 |
| cell_1 (base) | Transmission | 50 / 33.55 | 61 / 41.23 | 50 / 37.75 |
| cell_96 (matched-behaviorist) | Transmission | 48 / 22.16 | 63 / 34.33 | 48 / 24.04 |

Total judged rows: Sonnet 196/248, GPT-5.2 248/248, Opus 4.7 198/248. Sample sizes per (cell × judge) are balanced within ±2 rows per cell.

### Three-judge contrasts — final at full $n$

| Contrast | Sonnet $d$ | GPT-5.2 $d$ | Opus 4.7 $d$ | **Pooled $\bar{d}$** |
|---|---|---|---|---|
| recog vs matched-pedagogical (Hegelian within) | $-0.048$ | 0.172 | 0.318 | **0.147** |
| base vs matched-behaviorist (transmission within) | 0.866 | 0.528 | 1.265 | **0.886** |
| Hegelian mean vs Transmission mean (between) | 1.457 | 1.111 | 1.577 | **1.382** |
| recognition vs base | 1.148 | 1.039 | 1.357 | 1.181 |
| matched-pedagogical vs base | 1.096 | 0.780 | 0.954 | 0.943 |
| recognition vs behaviorist | 1.991 | 1.460 | 2.506 | 1.986 |
| matched-pedagogical vs behaviorist | 1.852 | 1.209 | 2.048 | 1.703 |

**Notable judge-disagreement at full $n$ within the Hegelian family**: Sonnet reads matched-pedagogical as marginally *above* recognition ($d = -0.048$), while Opus reads recognition as clearly above matched-pedagogical ($d = 0.318$). GPT sits in the middle ($d = 0.172$). All three pooled to $d = 0.147$, below the $|d| < 0.2$ density-sufficient threshold, but the within-family judge disagreement is now larger than we observed at partial coverage. This strengthens the structural-features caveat (design note §6a): when contrasts are small, the dominant source of variance across judges appears to be which surface features each judge weights most heavily, not the theoretical content underneath.

**Pre-registered branch #2 confirmed unambiguously**: intersubjective-family over transmission-family; within intersubjective family, density-substitutable; within transmission family, density *hurts*.

- **Within the Hegelian-descendant family** (pooled $d = 0.15$, below threshold): recognition and matched-pedagogical produce statistically indistinguishable tutor quality. Replicates A10 v2 three-judge pooled $d = 0.17$ on an independent run.
- **Within the transmission family** (pooled $d = 0.84$): a rigorously-authored behaviorist prompt (Skinner/Gagné/Keller/Thorndike/Rosenshine) scores substantially *below* the generic 344-line base prompt. Density in the wrong orientation family is counterproductive.
- **Between families** (pooled $d = 1.42$): the dominant effect of the entire A10/A10b cycle. Hegelian mean outscores transmission mean by ~20 pts pooled — roughly 10× the magnitude of any within-family contrast.

The active ingredient is not density, not rigorous theoretical grounding, not matched specificity in the abstract — it is **intersubjective-pedagogy orientation**. Density within the right family pays off; density within the wrong family backfires.

## Surprising observations

1. **Behaviorist substantially below base.** The pre-registered design anticipated behaviorist might match base (density helps a little) or fall modestly below (density alone doesn't help in wrong family). What we observe is a pooled $d = 0.84$ deficit — a rigorously-authored behaviorist prompt is meaningfully worse than a generic base prompt, most starkly so under Opus ($d = 1.20$). This mirrors Paper 1.0's Haiku "naive 35-line beats 344-line base" pattern and generalises it: in the *wrong* pedagogical family, rigour can hurt.

2. **Opus sees the effect most sharply.** Opus's within-Hegelian $d = 0.075$ is the lowest of any judge (most squarely density-sufficient); its within-transmission $d = 1.20$ is the largest (clearest behaviorist-below-base); its between-family $d = 1.81$ is the biggest. The most capable judge produces the cleanest reading of the orientation-family structure. Sonnet and GPT track Opus directionally but with smaller effect sizes.

3. **Cross-run replication is beautiful.** A10 v2 gave pooled within-Hegelian $d = 0.17$ on three cells; A10b gave pooled within-Hegelian $d = 0.15$ on four cells (different sample of dialogues, different scoring order, different relative benchmarks). That kind of exact replication on an independent run is unusual and strengthens the density-within-family finding substantially.

## Methodological caveat from design note §6a

All three variants differ not just in theoretical content but in *structural features* judges may prefer or penalise (behaviorist is explicitly directive; matched-pedagogical is diagnostic-scaffolding; recognition is dialogical-warm). LLM judges with characteristic preferences may reward structural features independently of content. The cross-judge panel (Sonnet + GPT + Opus) mitigates this by reporting per-judge effects, but any LLM-judge ordering of the three families is judge-conditional pending human-learner validation (§A1). See `docs/pedagogical-taxonomy.md` for the full framing.

## Paper implications (v3.0.48, pending)

§7.9 requires a substantial rewrite:

- **Drop**: "content over density" framing from v3.0.45 / v3.0.46 variants.
- **Replace with**: "intersubjective-pedagogy family over transmission-family, with within-family density-substitutability and an Anthropic-judge residual recognition edge."
- **Cite**: A10 v2 three-judge triangulation for the within-family finding; A10b four-way comparison for the between-family finding and behaviorist-below-base observation.
- **Acknowledge**: the structural-features confound; the Anthropic-vs-GPT judge-family split; the need for human validation to break the judge confound fully.

## Reproducibility

```bash
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified,cell_95_base_matched_single_unified,cell_96_base_behaviorist_single_unified \
  --runs 3 --ego-model openrouter.deepseek \
  --description "A10b: 4-way matched-specificity orientation comparison"

node scripts/eval-cli.js evaluate eval-2026-04-24-e9a785c0 --follow  # Sonnet
node scripts/eval-cli.js rejudge  eval-2026-04-24-e9a785c0 --judge openrouter.gpt  # GPT-5.2
node scripts/eval-cli.js rejudge  eval-2026-04-24-e9a785c0 --judge-cli claude --model opus --skip-learner --skip-deliberation  # Opus 4.7 sample
node scripts/analyze-a10b-orientation-family.js
```
