# Comprehensive Replication Plan

## Study: "The Drama Machine in Education"

**Paper**: PAPER-FULL-2026-02-04.md (v1.5)
**Original**: 14 key runs, N=1,010 scored, N=3,800+ in full database
**Estimated replication cost**: ~$65–$90 USD (ego generation + Opus judging + GPT-5.2 cross-judge)
**Estimated wall-clock time**: ~48–72 hours (with parallelism=2, accounting for API rate limits)

---

## 1. Prerequisites

### 1.1 Software Dependencies

| Component | Version | Source |
|-----------|---------|--------|
| Node.js | >= 18.0.0 | nodejs.org |
| `@machinespirits/tutor-core` | 0.3.1 | Linked locally (`../machinespirits-tutor-core`) |
| `better-sqlite3` | 12.5.0 | npm |
| `dotenv` | 17.2.3 | npm |
| `express` | 4.19.2 | npm |
| `jsonrepair` | 3.13.2 | npm |
| `yaml` | 2.8.2 | npm |

**Setup**:
```bash
cd /Users/lmagee/Dev/machinespirits-eval
npm install
```

### 1.2 External Content Packages

| Package | Location | Purpose |
|---------|----------|---------|
| `machinespirits-content-philosophy` | `../machinespirits-content-philosophy` | Primary domain (Hegel, graduate philosophy) |
| `content-test-elementary` | `./content-test-elementary/` | Domain generalizability (4th-grade fractions) |

Both are present in the current environment. A replicator needs access to these repositories.

### 1.3 API Keys (in `.env`)

| Provider | Models Used | Estimated Cost Fraction |
|----------|-------------|------------------------|
| **OpenRouter** | Kimi K2.5 (free-tier ego), Nemotron 3 Nano 30B (free-tier ego) | ~$5 (superego calls only; ego is free) |
| **Anthropic** | Claude Opus (judge via Claude Code CLI) | ~$40–55 (primary judge, largest cost) |
| **OpenAI (via OpenRouter)** | GPT-5.2 (cross-judge validation) | ~$18–25 (rejudge only) |

**Critical**: The primary judge uses Claude Code CLI which invokes Opus directly via the Anthropic API. OpenRouter is used for ego/superego models and for GPT-5.2 rejudging.

### 1.4 Model Availability Risk

| Model | Risk | Mitigation |
|-------|------|------------|
| Kimi K2.5 (OpenRouter free) | May be retired/updated | Pin model ID in providers.yaml; document exact version |
| Nemotron 3 Nano 30B (OpenRouter free) | May be retired | Same; only needed for A×B interaction and domain gen |
| Claude Opus | Stable (Anthropic tier) | Low risk |
| GPT-5.2 | Stable (OpenAI) | Low risk |

### 1.5 Database

- **Fresh start**: Back up existing `data/evaluations.db`, then either use a fresh DB or prefix run IDs to distinguish replication from original.
- **Recommended**: Use a separate database file (e.g., `data/evaluations-replication.db`) by modifying the DB path in evaluationStore.js, OR simply run the replication and use run IDs to distinguish.

---

## 2. Replication Phases

The study comprises 9 distinct experimental phases (producing 14 runs). We recommend executing them in dependency order. **Phases 1–5 are independent and can run in parallel if API rate limits allow.**

### Phase 1: Recognition Validation (Section 6.1)
**Purpose**: 3-way comparison — base vs enhanced vs recognition
**Original run**: `eval-2026-02-03-86b159cd` (N=36 scored)
**Design**: 3 profiles × 4 scenarios × 3 replications

```bash
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_9_enhanced_single_unified,cell_5_recog_single_unified \
  --scenarios struggling_learner,concept_confusion,mood_frustrated_explicit,high_performer \
  --runs 3 \
  --description "Replication: Recognition validation (Section 6.1)"
```

**Expected output**: N=36 scored responses
**Key metrics to verify**:
- Recognition > Enhanced > Base ordering
- One-way ANOVA F(2,33) significant
- Recognition vs Enhanced gap ≈ +8.7 pts (original)
- Recognition vs Base gap ≈ +20.1 pts (original)

**Analysis**:
```bash
node scripts/eval-cli.js report <run-id>
node scripts/analyze-eval-results.js <run-id>
```

---

### Phase 2: Full 2×2×2 Factorial (Section 6.3)
**Purpose**: Main factorial design — Recognition × Architecture × Learner
**Original runs**: `eval-2026-02-03-f5d4dd93` (cells 1–5,7, N=262) + `eval-2026-02-06-a933d745` (cells 6,8, N=88)
**Design**: 8 cells × 15 scenarios × 3 replications = 360 planned, expect ~350 scored

**Important**: The original ran as two separate runs because cells 6 and 8 needed re-running with corrected learner prompts. For replication, all 8 cells can run together since the prompts are now correct.

```bash
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_2_base_single_psycho,cell_3_base_multi_unified,cell_4_base_multi_psycho,cell_5_recog_single_unified,cell_6_recog_single_psycho,cell_7_recog_multi_unified,cell_8_recog_multi_psycho \
  --runs 3 \
  --description "Replication: Full 2x2x2 factorial (Section 6.3)"
```

**Expected output**: ~350 scored responses (8 × 15 × 3 = 360 attempted)
**Key metrics to verify**:
- Recognition main effect: +10.2 pts, F(1,342)≈71, p<.001, η²≈.16
- Architecture main effect: ~+0.9, n.s.
- A×C Interaction (Recognition × Learner): F≈22, p<.001
  - Unified learner: recognition +15.5 pts
  - Psychodynamic learner: recognition +4.8 pts
- Cell means ordering: 5≈7 > 6≈8 > 4≈2 > 1≈3

**Analysis**:
```bash
node scripts/analyze-eval-results.js <run-id>
# This will compute the full ANOVA table
```

---

### Phase 3: Memory Isolation 2×2 (Section 6.2)
**Purpose**: Disentangle recognition from memory
**Original runs**: `eval-2026-02-06-81f2d5a1` (N=60) + `eval-2026-02-06-ac9ea8f5` (N=62)
**Design**: 4 cells × 15 scenarios × 1 rep per run, 2 independent runs

The memory isolation uses cells 19–20 (memory isolation profiles). Check `config/tutor-agents.yaml` for the exact profile names.

```bash
# Run 1
node scripts/eval-cli.js run \
  --profiles cell_19_base_nomem,cell_19_base_mem,cell_20_recog_nomem,cell_20_recog_mem \
  --runs 1 \
  --description "Replication: Memory isolation run 1 (Section 6.2)"

# Run 2 (independent replication)
node scripts/eval-cli.js run \
  --profiles cell_19_base_nomem,cell_19_base_mem,cell_20_recog_nomem,cell_20_recog_mem \
  --runs 1 \
  --description "Replication: Memory isolation run 2 (Section 6.2)"
```

**NOTE**: Verify the exact profile names in `config/tutor-agents.yaml` — the memory isolation profiles may use different naming conventions (e.g., `mem_iso_base_nomem`, `mem_iso_recog_mem`, etc.). The paper states N=30 per cell across two runs, suggesting each run has ~15 per cell (4 cells × 15 scenarios × 1 rep = 60 per run).

**Expected output**: N=120 across both runs (30 per cell)
**Key metrics to verify**:
- Recognition effect: d≈1.71, +15.2 pts without memory
- Memory effect: d≈0.46, +4.8 pts, p≈.08
- Interaction: -4.2 (negative — ceiling effect)
- Condition ordering: Recog+Mem ≥ Recog Only >> Mem Only > Base

---

### Phase 4: Active Control (Section 6.2)
**Purpose**: Test whether generic pedagogical elaboration accounts for recognition gains
**Original run**: `eval-2026-02-06-a9ae06ee` (N=118 scored)
**Design**: Cells 15–18 (placebo control profiles)

**MODEL NOTE**: The original used Nemotron as ego (not Kimi). This is a known confound documented in the paper. For a fair replication, you should run both:
1. The active control on Nemotron (replicating the original)
2. Optionally, the active control on Kimi (resolving the model confound)

```bash
# Active control with Nemotron (replicating original)
node scripts/eval-cli.js run \
  --profiles cell_15_placebo_single_unified,cell_16_placebo_single_psycho,cell_17_placebo_multi_unified,cell_18_placebo_multi_psycho \
  --runs 3 \
  --description "Replication: Active control / placebo (Section 6.2)"
```

**Expected output**: ~118 scored
**Key metrics to verify**:
- Overall mean ≈ 66.5 (Nemotron)
- Same-model comparison: +9 pts above Nemotron base, below recognition (~73)

---

### Phase 5: A×B Interaction (Section 6.4)
**Purpose**: Test whether multi-agent synergy requires recognition prompts
**Original runs**: `eval-2026-02-04-948e04b3` (Nemotron, N=17) + `eval-2026-02-05-10b344fb` (Kimi, N=60)

#### 5a: Nemotron A×B test
```bash
# This requires configuring Nemotron as the ego model
# Check if there are specific Nemotron profile overrides
node scripts/eval-cli.js run \
  --profiles cell_5_recog_single_unified,cell_7_recog_multi_unified,cell_9_enhanced_single_unified,cell_11_enhanced_multi_unified \
  --scenarios struggling_learner,concept_confusion,mood_frustrated_explicit \
  --runs 3 \
  --description "Replication: A×B interaction Nemotron (Section 6.4)"
```

**NOTE**: The original Nemotron run had only N=17 scored (small sample). The profile may need model override to use Nemotron instead of the default Kimi. Check whether there are Nemotron-specific profiles or if the CLI supports model overrides.

#### 5b: Kimi A×B replication
```bash
node scripts/eval-cli.js run \
  --profiles cell_5_recog_single_unified,cell_7_recog_multi_unified,cell_9_enhanced_single_unified,cell_11_enhanced_multi_unified \
  --runs 3 \
  --description "Replication: A×B replication Kimi (Section 6.4)"
```

**Expected output**: N≈60
**Key metrics to verify**:
- Kimi: A×B interaction ≈ +1.35 (negligible, confirming non-replication of Nemotron finding)
- Recognition cells ≈ 90.6 regardless of architecture
- Enhanced cells ≈ 80.6

---

### Phase 6: Domain Generalizability (Section 6.5)
**Purpose**: Test recognition effects on elementary math content
**Original runs**: `eval-2026-02-04-79b633ca` (Nemotron, N=47) + `eval-2026-02-05-e87f452d` (Kimi, N=60)

#### 6a: Kimi elementary replication
```bash
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --runs 3 \
  --description "Replication: Domain gen Kimi elementary (Section 6.5)"
```

#### 6b: Nemotron elementary (if Nemotron profiles available)
```bash
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --runs 1 \
  --description "Replication: Domain gen Nemotron elementary (Section 6.5)"
```

**Expected output**: N≈60 (Kimi), N≈47 (Nemotron)
**Key metrics to verify**:
- Kimi: Recognition +9.9 pts (d≈0.61)
- Scenario-dependent: frustrated_student +23.8, neutral scenarios ~0

---

### Phase 7: Bilateral Transformation (Section 6.11)
**Purpose**: Multi-turn dialogues measuring tutor adaptation and learner growth
**Original run**: `eval-2026-02-07-b6d75e87` (N=118 scored, 3 multi-turn scenarios)

```bash
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_2_base_single_psycho,cell_3_base_multi_unified,cell_4_base_multi_psycho,cell_5_recog_single_unified,cell_6_recog_single_psycho,cell_7_recog_multi_unified,cell_8_recog_multi_psycho \
  --scenarios misconception_correction_flow,mood_frustration_to_breakthrough,mutual_transformation_journey \
  --runs 1 \
  --description "Replication: Bilateral transformation multi-turn (Section 6.11)"
```

**Expected output**: ~118 scored dialogues
**Key metrics to verify**:
- Tutor Adaptation Index: base≈0.332, recognition≈0.418 (+26%)
- Learner Growth Index: base≈0.242, recognition≈0.210 (lower — reversal)
- Misconception correction: largest adaptation gap (+0.175)

---

### Phase 8: Dynamic Rewrite Evolution (Section 6.13)
**Purpose**: Track cell 21 (dynamic rewrite + Writing Pad) vs cell 7 (static)
**Original runs**: `daf60f79`, `49bb2017`, `12aebedb` (N=82 total across 3 iterative runs)

**REPLICATION CHALLENGE**: The original three runs represent iterative development — each run was executed at a different git commit with evolving code. This cannot be cleanly replicated because:
1. The code has since evolved past those commits
2. The progression was part of development, not a controlled experiment

**Recommended approach**: Run cell 21 vs cell 7 at the current codebase state (equivalent to run 3, which had the Writing Pad activated):

```bash
node scripts/eval-cli.js run \
  --profiles cell_7_recog_multi_unified,cell_21_recog_multi_unified_rewrite \
  --scenarios misconception_correction_flow,mood_frustration_to_breakthrough,mutual_transformation_journey \
  --runs 5 \
  --description "Replication: Dynamic rewrite cell 21 vs cell 7 (Section 6.13)"
```

**Expected output**: ~30 scored responses
**Key metric**: Cell 21 should lead cell 7 by ~+5.5 pts (reflecting run 3 state)

**For full iterative replication**: Would require checking out specific git commits (e3843ee, b2265c7, e673c4b) and running at each — document as a limitation of replication.

---

### Phase 9: Cross-Judge Replication (Section 6.14)
**Purpose**: Re-score all key run responses with GPT-5.2 as independent judge
**Depends on**: Phases 1–7 completing (uses their run IDs)

For each key run from Phases 1–7:
```bash
# Rejudge each completed run with GPT-5.2
node scripts/eval-cli.js rejudge <phase1-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <phase2-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <phase3a-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <phase3b-run-id> --judge openrouter.gpt
# ... etc for all runs
```

**CAUTION**: Rejudge creates new rows by default. If run twice, it creates duplicates. Use `--overwrite` to replace, or track carefully.

**Expected output**: Matched response pairs (same tutor response, two judge scores)
**Key metrics to verify**:
- Inter-judge r = 0.49–0.64 across runs
- GPT-5.2 finds ~58% of Claude's effect magnitudes
- Recognition main effect d≈1.0 under GPT-5.2
- Same condition ordering, no rank reversals in memory isolation
- Recognition vs enhanced: may not reach significance (+1.3, p=.60)

**Analysis**:
```bash
node scripts/analyze-judge-reliability.js
```

---

## 3. Verification Checklist

### 3.1 Primary Findings to Replicate

| # | Finding | Section | Key Statistic | Priority |
|---|---------|---------|---------------|----------|
| 1 | Recognition main effect | 6.3 | +10.2 pts, F=71.36, p<.001, d=0.80 | **Critical** |
| 2 | Memory isolation: recognition dominance | 6.2 | d=1.71, +15.2 pts | **Critical** |
| 3 | Memory isolation: memory modest | 6.2 | d=0.46, +4.8, p≈.08 | **Critical** |
| 4 | Memory isolation: negative interaction | 6.2 | -4.2 (ceiling) | **Critical** |
| 5 | A×C Interaction (Recog × Learner) | 6.3 | F=21.85, p<.001 | **High** |
| 6 | A×B null (architecture doesn't matter) | 6.3–6.4 | F=0.26, n.s. | **High** |
| 7 | Active control partial benefit | 6.2 | +9 pts vs +15 pts recognition | **High** |
| 8 | Domain generalizability | 6.5 | +9.9 pts Kimi elementary | **Medium** |
| 9 | Bilateral transformation asymmetry | 6.11 | Tutor +26%, learner -13% | **Medium** |
| 10 | Recognition vs enhanced gap | 6.1 | +8.7 pts | **Medium** |
| 11 | Cross-judge robustness | 6.14 | r=0.49–0.64, same direction | **High** |
| 12 | Dynamic rewrite improvement | 6.13 | Cell 21 leads by +5.5 | **Low** |

### 3.2 Expected Replication Tolerances

Given LLM stochasticity (temperature=0.6 for ego, 0.2 for judge), expect:
- **Effect directions**: Should replicate consistently (same sign)
- **Effect magnitudes**: ±3–5 points on means; ±0.2 on Cohen's d
- **Statistical significance**: Large effects (d>0.8) should remain significant; marginal effects (p≈.08) may flip
- **Cell ordering**: Should be preserved (no rank reversals on primary comparisons)
- **Interaction patterns**: A×C should replicate; A×B null should hold

### 3.3 Red Flags (Suggesting Implementation Issues)

- Recognition main effect < +5 pts or not significant → check prompt loading
- Condition ordering reversed → check profile-to-prompt mapping
- All scores clustered >90 → ceiling effect / rubric calibration issue
- All scores <60 → model API issue or wrong model being called
- Memory isolation shows positive interaction → verify cell configurations
- Cross-judge r < 0.3 → check rejudge is matching correct responses

---

## 4. Cost Estimation

| Phase | Attempts | Ego Cost | Judge Cost (Opus) | GPT-5.2 Rejudge | Subtotal |
|-------|----------|----------|-------------------|------------------|----------|
| 1: Recognition validation | 36 | ~$0.40 | ~$1.50 | ~$0.70 | ~$2.60 |
| 2: Full factorial | 360 | ~$5.00 | ~$15.00 | ~$7.00 | ~$27.00 |
| 3: Memory isolation (×2) | 120 | ~$1.50 | ~$5.00 | ~$2.50 | ~$9.00 |
| 4: Active control | 120 | ~$1.30 | ~$5.00 | ~$2.50 | ~$8.80 |
| 5: A×B interaction | 78 | ~$1.00 | ~$3.00 | ~$1.50 | ~$5.50 |
| 6: Domain gen | 107 | ~$1.20 | ~$4.00 | ~$2.00 | ~$7.20 |
| 7: Bilateral transformation | 120 | ~$2.00 | ~$5.00 | ~$2.50 | ~$9.50 |
| 8: Dynamic rewrite | 30 | ~$0.80 | ~$1.50 | ~$0.60 | ~$2.90 |
| **Total** | **~971** | **~$13.20** | **~$40.00** | **~$19.30** | **~$72.50** |

**Notes**:
- Ego costs are low because Kimi K2.5 and Nemotron are free-tier on OpenRouter; costs come from superego calls (Kimi K2.5)
- Judge costs dominate — Claude Opus via Claude Code CLI
- GPT-5.2 rejudge adds ~27% to total cost
- Multi-turn scenarios (phases 7, 8) cost more per evaluation due to multiple turns

---

## 5. Execution Order and Timeline

### Day 1: Independent Phases (Parallel)

| Time | Phase | Duration | Notes |
|------|-------|----------|-------|
| Morning | Phase 1 (validation) | ~2 hrs | Quick, small N |
| Morning | Phase 5b (A×B Kimi) | ~3 hrs | Small N |
| Morning | Phase 6a (Domain gen Kimi) | ~3 hrs | Small N |
| Afternoon | Phase 3 run 1 (Memory isolation) | ~6 hrs | |
| Afternoon | Phase 4 (Active control) | ~7 hrs | |

### Day 2: Main Factorial + Bilateral

| Time | Phase | Duration | Notes |
|------|-------|----------|-------|
| All day | Phase 2 (Full factorial) | ~24 hrs | Largest run, 360 evals |
| All day | Phase 3 run 2 (Memory isolation) | ~6 hrs | Independent replication |
| Evening | Phase 7 (Bilateral) | ~14 hrs | Multi-turn, slower |

### Day 3: Specialized + Cross-Judge

| Time | Phase | Duration | Notes |
|------|-------|----------|-------|
| Morning | Phase 5a (A×B Nemotron) | ~3 hrs | If Nemotron profiles exist |
| Morning | Phase 6b (Domain gen Nemotron) | ~3 hrs | Optional |
| Morning | Phase 8 (Dynamic rewrite) | ~5 hrs | |
| Afternoon | Phase 9 (Cross-judge) | ~8 hrs | Rejudge all completed runs |

### Day 4: Analysis and Verification

| Task | Tool |
|------|------|
| Generate reports for all runs | `eval-cli.js report <run-id>` |
| Compute ANOVA tables | `analyze-eval-results.js` |
| Inter-judge reliability | `analyze-judge-reliability.js` |
| Bilateral transformation metrics | `analyze-interaction-evals.js` |
| Compare replication vs original | Side-by-side comparison of key statistics |

---

## 6. Known Issues and Workarounds

### 6.1 Profile Name Verification

Before running, verify all profile names exist in `config/tutor-agents.yaml`:
```bash
grep -E "^  cell_" config/tutor-agents.yaml | head -30
```

Profiles referenced in the paper:
- `cell_1` through `cell_8` (main factorial)
- `cell_9` through `cell_12` (enhanced prompts)
- `cell_15` through `cell_18` (placebo/active control)
- `cell_19`, `cell_20` (memory isolation)
- `cell_21` (dynamic rewrite)

### 6.2 Nemotron Model Configuration

The paper uses Nemotron for several analyses (A×B interaction, domain gen, active control). Check whether the default profiles use Kimi or Nemotron:
- If all profiles default to Kimi, you may need to create Nemotron variants or use a model override mechanism
- The original Nemotron runs may have used different profile names or env var overrides

### 6.3 Rejudge Deduplication

GPT-5.2 rejudge can create duplicate rows. After rejudging, verify:
```sql
SELECT run_id, judge_model, COUNT(*) as n
FROM evaluation_results
WHERE judge_model = 'openrouter/openai/gpt-5.2'
GROUP BY run_id
ORDER BY n DESC;
```

If duplicates exist, use ROW_NUMBER() window function to deduplicate.

### 6.4 Scenario Availability

Verify all 15 scenarios exist:
```bash
grep "^  [a-z]" config/suggestion-scenarios.yaml | head -20
```

The 3 multi-turn scenarios need special handling:
- `misconception_correction_flow` (3.2 avg rounds)
- `mood_frustration_to_breakthrough` (3.0 avg rounds)
- `mutual_transformation_journey` (4.1 avg rounds)

### 6.5 Content Isolation (Critical — from feedback item #31)

The paper reports that Nemotron hallucinated philosophy content on elementary math tasks. Verify that content paths are properly isolated:
- When running elementary tests, ensure `EVAL_CONTENT_PATH` points to `./content-test-elementary`
- Check that the contentResolver does not leak cross-domain lecture IDs
- This is flagged in the reviewer feedback as a potential data isolation bug to investigate

### 6.6 Evaluate vs Rejudge

- `evaluate --force`: Only processes rows with NULL base_score (won't re-score existing)
- `rejudge`: Creates new rows with a different judge_model
- To re-score with Opus: null out scores first, then `evaluate --force`
- **Never** use `rejudge` without `--judge` flag — defaults to Sonnet 4.5, not Opus

---

## 7. Statistical Analysis Pipeline

After all phases complete, run the full analysis:

```bash
# 1. Per-run reports
for run_id in <all-replication-run-ids>; do
  node scripts/eval-cli.js report $run_id
done

# 2. Factorial ANOVA (Phase 2)
node scripts/analyze-eval-results.js <factorial-run-id>

# 3. Memory isolation analysis (Phase 3)
# Compare 4 cells: base-nomem, base-mem, recog-nomem, recog-mem
node scripts/analyze-eval-results.js <mem-iso-run1-id>
node scripts/analyze-eval-results.js <mem-iso-run2-id>

# 4. Inter-judge reliability (Phase 9)
node scripts/analyze-judge-reliability.js

# 5. Bilateral transformation (Phase 7)
node scripts/analyze-interaction-evals.js <bilateral-run-id>

# 6. Export all results
node scripts/eval-cli.js export <run-id> --format csv
```

### 7.1 Key Comparisons

| Comparison | Original | Replication | Match? |
|------------|----------|-------------|--------|
| Recognition main effect (d) | 0.80 | | |
| Memory isolation recognition (d) | 1.71 | | |
| Memory isolation memory (d) | 0.46 | | |
| A×C interaction (F) | 21.85 | | |
| Bilateral adaptation Δ | +0.086 | | |
| Cross-judge r (factorial) | 0.64 | | |
| Cross-judge r (memory iso) | 0.63 | | |

---

## 8. What Exact Replication Cannot Cover

Some aspects of the original study are inherently non-replicable:

1. **Iterative development trajectory** (Section 6.13): The three dynamic rewrite runs tracked code evolution across commits. Running at the current codebase state tests the final configuration but not the developmental trajectory.

2. **Historical Nemotron data** (Section 6.2 active control): The "same-model comparison" for the active control draws on historical Nemotron data across multiple runs (N=467 base, N=545 recognition). This accumulated data is in the existing database but would require extensive separate runs to reproduce.

3. **Exact LLM outputs**: LLMs are stochastic. The same prompt will produce different text, leading to different judge scores. Replication verifies *statistical patterns* (effect directions, magnitudes, significance), not identical outputs.

4. **Model version drift**: Free-tier models (Kimi, Nemotron) on OpenRouter may have been updated since the original runs. Pin exact model IDs from `config/providers.yaml` and document any version changes.

5. **Pooled multi-turn results** (Section 6.10, Table 13): The N=161/277/165 pooled across all development runs cannot be replicated from scratch — they represent the accumulated database. The dedicated bilateral run (Phase 7) provides the controlled comparison.

---

## 9. Minimum Viable Replication

If cost or time constraints require a reduced replication, prioritize these phases:

| Priority | Phase | N | Cost | Finding |
|----------|-------|---|------|---------|
| 1 | Phase 2: Full factorial | 360 | ~$27 | Main effects + A×C interaction |
| 2 | Phase 3: Memory isolation | 120 | ~$9 | Recognition as primary driver |
| 3 | Phase 9: Cross-judge (on phases 2+3) | 480 | ~$10 | Judge robustness |
| **Subtotal** | | **~960** | **~$46** | **Covers findings 1–6, 11** |

This covers the three most important claims: recognition dominance, memory isolation, and cross-judge robustness. Phases 1, 4–8 provide supporting evidence but are less critical for the core argument.

---

## 10. Reviewer Feedback Integration

The `feedback-2026-02-07.md` file contains 38 items from reviewers. Several are directly relevant to replication:

| # | Feedback | Replication Implication |
|---|----------|----------------------|
| 7 | Clarify base/enhanced/active variants | Ensure profile names match paper descriptions |
| 26 | Model confound sounds defensive | Consider running active control on Kimi too |
| 28 | Rename unified/psycho to Single/Multi | Check if profile names have been updated |
| 29 | Verify cells 6,8 scores with latest evals | Compare replication cells 6,8 to paper values |
| 31 | **Content isolation may be compromised** | **Critical: verify no cross-domain data leaks** |
| 35 | Models not "trained" on content | Verify course data isolation in contentResolver |

**Recommendation**: Before starting replication, run Phase 6 (domain gen) first with logging enabled to verify content isolation (feedback items 31, 35). If the elementary scenarios reference philosophy lecture IDs, there is a data isolation bug that must be fixed before proceeding.
