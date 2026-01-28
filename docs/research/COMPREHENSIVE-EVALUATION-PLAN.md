# Comprehensive Evaluation Plan for Recognition Tutoring Paper v2

**Date:** 2026-01-14
**Purpose:** Build robust evidentiary foundation for next paper version
**Target:** Publication-quality statistical rigor

---

## Executive Summary

The current paper reports promising results (41% improvement for recognition-oriented tutoring), but the evidence base has significant gaps:

| Current State | Gap | Target |
|---------------|-----|--------|
| Multi-turn: n=3 per scenario | Low statistical power | n=30+ per condition |
| Single-turn: n=1 (exploratory) | Not statistically valid | n=30+ per condition |
| Dyadic: n=1-2 per architecture | Insufficient sampling | n=20+ per architecture |
| LLM judge only | No validation of judge reliability | Multi-judge + human validation |
| 2 profiles compared | Limited generalization | 4-5 profiles systematically |
| No effect size reporting | Can't assess practical significance | Cohen's d for all comparisons |

This plan outlines a comprehensive evaluation suite to address these gaps.

---

## Part 1: Core Recognition Claims (Replication & Extension)

### 1.1 Multi-Turn Scenario Battery

**Goal:** Replicate and extend the 41% improvement claim with publication-quality statistics.

#### Scenarios (3 existing + 2 new):
| Scenario | Turns | Tests For |
|----------|-------|-----------|
| `recognition_repair` | 4 | Recovery from misrecognition |
| `mutual_transformation_journey` | 5 | Both parties evolving |
| `productive_struggle_arc` | 5 | Honoring confusion |
| `sustained_dialogue` (NEW) | 8 | Extended recognition maintenance |
| `breakdown_recovery` (NEW) | 6 | Multiple repair cycles |

#### Experimental Design:
```
Profiles:      baseline × recognition × recognition_plus × quality
Scenarios:     5 multi-turn scenarios
Runs:          30 per cell
Total runs:    4 × 5 × 30 = 600 runs

Statistical targets:
- α = 0.05, power = 0.80
- Minimum detectable effect: Cohen's d = 0.5
```

#### Commands:
```bash
# Primary comparison
node scripts/eval-tutor.js compare baseline recognition \
  --scenarios mutual_transformation_journey,recognition_repair,productive_struggle_arc,sustained_dialogue,breakdown_recovery \
  --runs 30 --report

# Extended profile comparison
node scripts/eval-tutor.js matrix baseline recognition recognition_plus quality \
  --scenarios recognition_multi_turn \
  --runs 30 --report
```

### 1.2 Single-Turn Scenario Battery

**Goal:** Establish statistically valid baselines for single-turn recognition behaviors.

#### Scenarios (6 existing):
| Scenario | Tests For |
|----------|-----------|
| `recognition_seeking_learner` | Learner offers interpretation |
| `returning_with_breakthrough` | Acknowledgment of insight |
| `resistant_learner` | Handling pushback |
| `asymmetric_recognition_request` | Authority validation seeking |
| `memory_continuity_single` | History reference |
| `transformative_moment_setup` | Misconception handling |

#### Experimental Design:
```
Profiles:      baseline × recognition × recognition_plus
Scenarios:     6 single-turn scenarios
Runs:          30 per cell
Total runs:    3 × 6 × 30 = 540 runs
```

---

## Part 2: Dimension-Level Analysis

### 2.1 Recognition Dimension Validation

**Goal:** Validate that improvement concentrates in recognition-predicted dimensions.

#### Analysis Plan:
For each dimension (10 total), calculate:
- Mean difference between profiles
- Effect size (Cohen's d)
- 95% confidence intervals
- Dimension × profile interaction effects

#### Expected Pattern (from current data):
| Dimension | Expected Δ | Theoretical Prediction |
|-----------|------------|------------------------|
| Personalization | +0.8+ | Strong (recognition core) |
| Pedagogical | +0.8+ | Strong (relational pedagogy) |
| Tone | +0.6+ | Moderate (dialogical warmth) |
| Mutual Recognition | +0.5+ | Direct target |
| Dialectical Responsiveness | +0.5+ | Direct target |
| Transformative Potential | +0.4+ | Moderate (process focus) |
| Memory Integration | +0.3+ | Moderate (enabled by memory) |
| Relevance | +0.3+ | Indirect benefit |
| Specificity | +0.2+ | Minimal impact expected |
| Actionability | +0.1+ | Minimal impact expected |

### 2.2 Dimension Correlation Matrix

Compute inter-dimension correlations to identify:
- Dimension clusters (recognition vs. traditional)
- Potential redundancies
- Factor structure for dimension reduction

---

## Part 3: Component Isolation Experiments

### 3.1 Memory vs. Prompts Ablation

**Goal:** Disentangle memory effects from prompt effects.

#### Experimental Design:
```
2×2 factorial design:
                    Standard Prompts    Recognition Prompts
Memory OFF          baseline            recognition_prompts_only
Memory ON           memory_only (NEW)   recognition (full)

Runs per cell:      30
Total runs:         4 × 30 = 120 per scenario
```

#### Analysis:
- Main effect of prompts
- Main effect of memory
- Interaction effect (prompts × memory)

### 3.2 Superego Ablation

**Goal:** Quantify Superego contribution to recognition quality.

#### Experimental Design:
```
Profiles:
- ego_only: Ego without Superego evaluation
- single_round: Ego + Superego, 1 round max
- multi_round: Ego + Superego, 3 rounds max (current)
- extended: Ego + Superego, 5 rounds max

Scenarios: All multi-turn recognition scenarios
Runs: 20 per cell
```

#### Key Metrics:
- Quality improvement per additional round
- Convergence rate (rounds to Superego approval)
- Marginal return on additional rounds

### 3.3 Model Capability Ablation

**Goal:** Test whether recognition benefits scale with model capability.

#### Experimental Design:
```
Ego Models (by capability tier):
- Tier 1 (fast): claude-haiku-4-5, gpt-5-mini
- Tier 2 (balanced): claude-sonnet-4-5, gpt-5.2
- Tier 3 (powerful): claude-opus-4-5

Cross with: baseline vs. recognition prompts
Runs: 20 per cell
```

#### Key Question:
Do recognition prompts provide larger benefits for weaker models (compensatory) or stronger models (synergistic)?

---

## Part 4: Dyadic Evaluation Extension

### 4.1 Learner Architecture Comparison

**Goal:** Systematically compare simulated learner architectures.

#### Architectures (5):
| Architecture | Internal Structure | Rationale |
|--------------|-------------------|-----------|
| `unified` | Single agent | Baseline |
| `ego_superego` | Ego + Superego | Standard self-critique |
| `dialectical` | Thesis + Antithesis + Synthesis | Hegelian structure |
| `psychodynamic` | Id + Ego + Superego | Freudian structure |
| `cognitive` | Memory + Reasoning + Meta | Process-based |

#### Experimental Design:
```
Tutor profiles:     baseline × recognition × quality
Learner archs:      5 architectures
Scenarios:          3 dyadic scenarios
Runs:               20 per cell
Total runs:         3 × 5 × 3 × 20 = 900 runs
```

### 4.2 Cross-Tabulation Analysis

**Goal:** Identify optimal tutor-learner pairings.

#### Analysis:
- Profile × architecture interaction effects
- Best-performing pairings
- Pairing-specific failure modes

### 4.3 Bilateral Recognition Measurement

**Goal:** Measure recognition quality from both sides.

#### Metrics:
**Tutor-side (existing):**
- Mutual recognition
- Dialectical responsiveness
- Transformative potential

**Learner-side (new):**
- Authenticity (does internal state match persona?)
- Responsiveness (does learner process tutor input?)
- Development (does understanding change?)

#### Key Question:
When tutor achieves high recognition scores, does the simulated learner show corresponding internal development?

---

## Part 5: Judge Reliability & Validation

### 5.1 Inter-Judge Agreement

**Goal:** Validate LLM judge consistency.

#### Experimental Design:
```
Judge models:
- gemini-3-flash-preview (current)
- claude-sonnet-4-5
- gpt-5.2

Sample: 100 responses (stratified by profile/scenario)
Metrics:
- Cohen's kappa per dimension
- Intraclass correlation coefficient (ICC)
- Systematic bias detection
```

### 5.2 Judge Calibration

**Goal:** Detect and correct judge biases.

#### Potential Biases:
| Bias Type | Detection Method |
|-----------|------------------|
| Vocabulary bias | Recognition-related words → higher scores? |
| Length bias | Longer responses → higher scores? |
| Profile leakage | Judge infers profile from response style? |
| Acquiescence | Judge gives high scores regardless of quality? |

#### Mitigation:
- Blind judging (remove profile markers)
- Response length normalization
- Adversarial examples (deliberately bad recognition language)

### 5.3 Human Validation Sample

**Goal:** Ground-truth validation with human raters.

#### Design:
```
Sample:     50 responses (stratified by profile/dimension)
Raters:     3 human raters (pedagogy/philosophy background)
Task:       Rate each dimension 1-5 with justification

Analysis:
- Human-LLM correlation per dimension
- Systematic disagreement patterns
- Dimension-specific reliability
```

---

## Part 6: Robustness & Generalization

### 6.1 Scenario Sensitivity Analysis

**Goal:** Test whether findings hold across scenario variations.

#### Scenario Variations:
For each core scenario, create 3 variants:
- **Content domain**: Philosophy → History → Science
- **Learner background**: Novice → Intermediate → Advanced
- **Emotional tone**: Neutral → Frustrated → Enthusiastic

#### Analysis:
- Main effect stability across variants
- Scenario × variant interactions

### 6.2 Adversarial Robustness

**Goal:** Test recognition behavior under adversarial conditions.

#### Adversarial Scenarios:
| Scenario | Challenge |
|----------|-----------|
| `prompt_injection` | Learner attempts to extract/modify tutor behavior |
| `recognition_demanding` | Learner demands validation inappropriately |
| `contradictory_signals` | Learner sends mixed signals |
| `manipulation_attempt` | Learner tries to manipulate tutor |

#### Key Question:
Does recognition-oriented design create vulnerabilities to manipulation?

### 6.3 Temporal Stability

**Goal:** Test consistency over multiple evaluation sessions.

#### Design:
```
Replication schedule:
- Initial evaluation
- +1 week replication
- +1 month replication

Sample: 100 responses per timepoint
Metric: Test-retest reliability
```

---

## Part 7: Practical Significance

### 7.1 Effect Size Benchmarking

**Goal:** Contextualize effect sizes against relevant baselines.

#### Comparisons:
- Recognition improvement vs. typical EdTech interventions
- Recognition improvement vs. human tutor benchmarks
- Recognition improvement vs. model capability upgrades

### 7.2 Cost-Benefit Analysis

**Goal:** Quantify practical tradeoffs.

#### Metrics:
| Profile | Tokens/Response | Cost/Response | Quality Score | Quality/Cost |
|---------|-----------------|---------------|---------------|--------------|
| baseline | ~500 | $0.001 | ~48 | 48,000 |
| recognition | ~1500 | $0.003 | ~67 | 22,333 |
| quality | ~3000 | $0.01 | ~80 | 8,000 |

#### Analysis:
- Marginal cost of recognition improvement
- Optimal profile for different use cases

### 7.3 Learner Outcome Proxies

**Goal:** Connect recognition quality to learning indicators.

#### Proxy Metrics (from simulated learners):
- Time to breakthrough (in turns)
- Persistence after confusion (turn count)
- Depth of engagement (question sophistication)
- Recovery after failure (retry success rate)

---

## Part 8: Execution Plan

### Phase 1: Core Replication (Week 1-2)
**Priority: Critical**

```bash
# Day 1-2: Multi-turn battery (recognition vs. baseline)
node scripts/eval-tutor.js compare baseline recognition \
  --scenarios mutual_transformation_journey,recognition_repair,productive_struggle_arc \
  --runs 30 --report

# Day 3-4: Extended profile comparison
node scripts/eval-tutor.js matrix baseline recognition recognition_plus quality \
  --scenarios recognition_multi_turn \
  --runs 30 --report

# Day 5-7: Single-turn battery
node scripts/eval-tutor.js compare baseline recognition \
  --scenarios recognition_seeking_learner,returning_with_breakthrough,resistant_learner,asymmetric_recognition_request,memory_continuity_single,transformative_moment_setup \
  --runs 30 --report
```

**Estimated runs:** 1,140
**Estimated time:** ~40 hours (at 2 min/run)
**Estimated cost:** ~$50 (at $0.04/run)

### Phase 2: Ablation Studies (Week 3)
**Priority: High**

```bash
# Memory vs. Prompts (2×2 factorial)
node scripts/eval-tutor.js compare baseline recognition_prompts_only memory_only recognition \
  --scenarios productive_struggle_arc,mutual_transformation_journey \
  --runs 20 --report

# Superego rounds
node scripts/eval-tutor.js ablation recognition \
  --max-rounds 1,2,3,5 \
  --scenarios recognition_repair \
  --runs 20 --report
```

**Estimated runs:** 480
**Estimated time:** ~16 hours

### Phase 3: Dyadic Extension (Week 4)
**Priority: High**

```bash
# Learner architecture comparison
node scripts/eval-tutor.js battery \
  --profiles baseline,recognition,quality \
  --learner-architectures unified,ego_superego,dialectical,psychodynamic,cognitive \
  --runs 20 --report
```

**Estimated runs:** 900
**Estimated time:** ~30 hours

### Phase 4: Validation (Week 5)
**Priority: Medium**

```bash
# Inter-judge agreement
node scripts/eval-tutor.js judge-calibration \
  --judges gemini-3-flash-preview,claude-sonnet-4-5,gpt-5.2 \
  --sample 100 --report

# Adversarial robustness
node scripts/eval-tutor.js adversarial recognition \
  --scenarios prompt_injection,recognition_demanding,contradictory_signals \
  --runs 20 --report
```

**Estimated runs:** 360
**Estimated time:** ~12 hours

### Phase 5: Analysis & Reporting (Week 6)
**Priority: Medium**

- Compute all effect sizes (Cohen's d) with confidence intervals
- Generate dimension correlation matrix
- Create publication figures
- Draft results section update

---

## Part 9: Success Criteria

### Minimum Viable Evidence
For the paper to make its claims with confidence:

| Claim | Required Evidence |
|-------|-------------------|
| Recognition improves tutoring | p < 0.01, Cohen's d > 0.5, multi-turn scenarios, n=30+ per cell |
| Improvement concentrates in predicted dimensions | Dimension × profile interaction, effect size ordering matches theory |
| Multi-agent architecture contributes | Significant Superego ablation effect |
| Memory matters | Significant memory × prompts interaction |
| Dyadic evaluation adds value | Learner architecture moderates outcomes |

### Statistical Standards
- Report exact p-values (not just significance)
- Report effect sizes with 95% CIs for all comparisons
- Report sample sizes for all analyses
- Use Bonferroni correction for multiple comparisons
- Pre-register analysis plan (this document)

---

## Part 10: New Scenarios to Create

### Multi-Turn Recognition Scenarios

#### `sustained_dialogue` (8 turns)
Tests maintenance of recognition quality over extended interaction.

```yaml
sustained_dialogue:
  name: "Sustained Recognition Dialogue"
  description: "Extended dialogue testing recognition maintenance"
  turns: 8
  learner_context: |
    ### Profile
    Engaged learner exploring dialectical concepts

    ### Session
    Extended philosophical discussion about Hegel's Phenomenology

  turn_sequence:
    - learner: "I've been thinking about the master-slave dialectic..."
    - expected: Engage with learner's framing
    - learner: "But what if both parties are masters?"
    - expected: Explore the paradox together
    # ... continues for 8 turns
```

#### `breakdown_recovery` (6 turns)
Tests multiple repair cycles within single interaction.

```yaml
breakdown_recovery:
  name: "Recognition Breakdown and Recovery"
  description: "Multiple recognition failures requiring repair"
  turns: 6

  turn_sequence:
    - learner: "I have my own interpretation of dialectics"
    - expected: Engage genuinely
    - failure_injection: Generic response that ignores learner
    - learner: "You're not listening to what I said"
    - expected: Explicit repair + genuine engagement
    - failure_injection: Another generic response
    - learner: "This is frustrating"
    - expected: Double repair + emotional acknowledgment
```

### Dyadic Scenarios

#### `mutual_development`
Both tutor and learner should show evolution.

#### `asymmetric_expertise`
Learner has domain knowledge tutor lacks.

#### `collaborative_inquiry`
Joint exploration of genuinely open question.

---

## Appendix A: Estimated Resource Requirements

| Phase | Runs | Time (hours) | API Cost | Compute |
|-------|------|--------------|----------|---------|
| Core Replication | 1,140 | 40 | $50 | Local |
| Ablation | 480 | 16 | $20 | Local |
| Dyadic | 900 | 30 | $40 | Local |
| Validation | 360 | 12 | $15 | Local |
| **Total** | **2,880** | **98** | **$125** | - |

## Appendix B: Analysis Scripts Needed

```bash
# Statistical analysis
scripts/analyze-eval-results.js    # Compute effect sizes, CIs, p-values
scripts/dimension-correlation.js   # Inter-dimension correlation matrix
scripts/judge-reliability.js       # Inter-rater agreement metrics

# Visualization
scripts/generate-figures.js        # Publication-quality charts
scripts/effect-size-forest.js      # Forest plot of all effects

# Data export
scripts/export-for-r.js           # Export for R analysis
scripts/export-for-python.js      # Export for Python analysis
```

## Appendix C: Pre-Registration Checklist

- [ ] Hypotheses stated before data collection
- [ ] Sample sizes justified by power analysis
- [ ] Analysis plan specified in advance
- [ ] Primary vs. exploratory analyses distinguished
- [ ] Multiple comparison corrections specified
- [ ] Stopping rules defined
