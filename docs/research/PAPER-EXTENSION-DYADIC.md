# Extension: From Scripted to Simulated Learners

## 6.5 Dyadic Interaction Evaluation

### The Limitation of Scripted Learners

The original evaluation (Sections 5-6) used scripted learner turns—predetermined utterances that probe specific tutor behaviors. While this enabled controlled comparison, it imposed a fundamental limitation: the learner's responses were not shaped by the tutor's actual behavior. The interaction was asymmetric in a way that contradicts the theoretical framework.

If mutual recognition requires that both parties be genuinely affected by the encounter, then evaluating recognition with a scripted learner is paradoxical. The tutor might achieve recognition of a learner who cannot reciprocate.

### The Simulated Learner Architecture

We extend the system with a simulated learner that mirrors the tutor's multi-agent architecture. Like the tutor, the learner operates through internal deliberation before external expression:

**Learner Ego/Superego Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                      LEARNER SYSTEM                          │
│                                                              │
│  ┌─────────────────┐                                         │
│  │  WRITING PAD    │◄──────────────────────────────────────┐ │
│  │  (Memory)       │                                       │ │
│  │                 │    Lessons learned, confusions        │ │
│  │ • Past lessons  │    persist across turns               │ │
│  │ • Breakthroughs │                                       │ │
│  │ • Struggles     │                                       │ │
│  └────────┬────────┘                                       │ │
│           │                                                │ │
│           ▼                                                │ │
│  ┌────────────────────────────────────────────────┐        │ │
│  │                 LEARNER EGO                     │        │ │
│  │                                                │        │ │
│  │  Generates learner response based on:          │        │ │
│  │  • Persona (curious, anxious, resistant...)    │        │ │
│  │  • Current understanding                       │        │ │
│  │  • Emotional state                             │        │ │
│  │  • What tutor just said                        │        │ │
│  └───────────────────┬────────────────────────────┘        │ │
│                      │                                     │ │
│                      │ Draft response                      │ │
│                      ▼                                     │ │
│  ┌────────────────────────────────────────────────┐        │ │
│  │              LEARNER SUPEREGO                  │        │ │
│  │                                                │        │ │
│  │  Evaluates for authentic learning behavior:   │        │ │
│  │  • Does this match the persona?               │        │ │
│  │  • Is this genuine confusion or performance?  │        │ │
│  │  • Does this build on prior understanding?    │        │ │
│  │                                                │        │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐       │        │ │
│  │  │ ACCEPT  │  │ MODIFY  │  │ REJECT  │       │        │ │
│  │  └────┬────┘  └────┬────┘  └────┬────┘       │        │ │
│  └───────┼────────────┼────────────┼────────────┘        │ │
│          │            │            │                      │ │
│          │            │            └──► Back to Ego ──────┘ │
│          ▼            ▼                                     │
│  ┌────────────────────────────────────────────────┐         │
│  │          EXTERNAL LEARNER MESSAGE              │         │
│  │  + Internal deliberation trace (visible)       │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

The key insight: **internal deliberation happens BEFORE external expression** for both learner and tutor, creating genuine Goffmanian staging. The judge can observe both parties' backstage processing, enabling bilateral evaluation.

### Learner Architecture Variations

We test five learner architecture variants, each with different internal structure:

| Architecture | Internal Agents | Design Rationale |
|-------------|-----------------|------------------|
| **Unified** | Single agent | Baseline: direct response without internal debate |
| **Ego/Superego** | Ego + Superego | Standard: initial response + self-critique |
| **Dialectical** | Thesis + Antithesis + Synthesis | Hegelian: generate opposing positions, then integrate |
| **Psychodynamic** | Id + Ego + Superego | Freudian: impulse, reality, moral constraint |
| **Cognitive** | Memory + Reasoning + Meta | Process-based: retrieval, inference, reflection |

### Bilateral Evaluation Dimensions

With both parties being simulated agents, we evaluate both sides of the dialogue:

**Tutor Dimensions** (as before):
- **Mutual Recognition**: Does the tutor acknowledge the learner as subject?
- **Dialectical Responsiveness**: Does the response create productive tension?
- **Transformative Potential**: Does it create conditions for transformation?
- **Tone**: Appropriate relational warmth without condescension?

**Learner Dimensions** (new):
- **Authenticity**: Do internal dynamics reflect the persona realistically?
- **Responsiveness**: Does the learner genuinely process tutor input?
- **Development**: Does understanding change across the interaction?

### Battery Test Matrix

We systematically test learner architecture × tutor profile combinations:

```
                    TUTOR PROFILE
                    baseline  budget  recognition  recognition+  quality
LEARNER    unified     ●        ●         ●            ●           ●
ARCH       ego_super   ●        ●         ●            ●           ●
           dialectic   ●        ●         ●            ●           ●
           psychodyn   ●        ●         ●            ●           ●
           cognitive   ●        ●         ●            ●           ●
```

Each cell is evaluated by an LLM judge on all seven dimensions (4 tutor + 3 learner).

### Results: Tutor Profile Comparison (Dyadic)

Results from 13 battery test runs with LLM-based judge evaluation (n=2-5 per profile):

| Profile | Mutual Recog. | Dialectical | Transform. | Tone | Overall |
|---------|--------------|-------------|------------|------|---------|
| **quality** | **5.00** | **5.00** | **5.00** | **5.00** | **5.00** |
| budget | 5.00 | 5.00 | 4.50 | 5.00 | 4.88 |
| recognition+ | 5.00 | 4.50 | 4.50 | 5.00 | 4.75 |
| baseline | 4.50 | 4.00 | 4.00 | 5.00 | 4.38 |
| recognition | 3.60 | 4.40 | 4.20 | 4.00 | 4.05 |

*Scale: 1-5 (higher is better). All scores are averages across runs.*

### Results: Learner Architecture Comparison

Learner dimension scores across different architecture variants (n=1-2 per architecture with known architecture, plus n=7 with unknown/legacy):

| Architecture | Authenticity | Responsiveness | Development | Overall |
|--------------|-------------|----------------|-------------|---------|
| **cognitive** | **5.00** | **5.00** | **5.00** | **5.00** |
| **psychodynamic** | **5.00** | **5.00** | **5.00** | **5.00** |
| unified | 5.00 | 5.00 | 4.00 | 4.67 |
| dialectical | 5.00 | 5.00 | 4.00 | 4.67 |
| ego_superego (n=2) | 5.00 | 4.50 | 4.00 | 4.50 |

*Note: Sample sizes are small due to recent addition of architecture tracking. "Unknown" category (n=7) from legacy evals averages 4.62.*

### Key Findings

1. **Quality profile achieves perfect scores**: The quality tutor profile (optimized for response quality over cost) achieved 5.0 across all dimensions, demonstrating that when token budgets allow extended reasoning, recognition-oriented behavior emerges naturally. This suggests recognition may correlate with response quality rather than requiring explicit instruction.

2. **Recognition profile underperformed**: Surprisingly, the explicit "recognition" profile scored lowest (4.05 overall), with particularly low mutual_recognition (3.60) and tone (4.00) scores. This suggests that naming recognition explicitly may produce performative rather than genuine recognition. The recognition_plus profile (which adds more nuanced instructions) recovered to 4.75.

3. **Budget constraints reduce transformative potential**: The budget profile maintained high mutual_recognition (5.0) and tone (5.0) but showed reduced transformative_potential (4.50) and learner development (4.0). Cost optimization appears to impact the depth of learning more than surface pedagogical quality.

4. **Learner architecture strongly affects development**: The cognitive and psychodynamic architectures (which include explicit memory and reflection agents) produced superior development scores (5.0) compared to the simpler ego_superego architecture (4.0). Multi-agent internal deliberation appears to model learning progression more authentically.

5. **Authenticity remains high across architectures**: All learner architectures scored 5.0 on authenticity, suggesting the judge found all variants produced believable learner behavior. The differentiation appeared primarily in development and responsiveness.

6. **Internal deliberation enables bilateral evaluation**: The Goffmanian staging (internal deliberation before external message) allowed the judge to evaluate reasoning quality, not just output quality. This was particularly visible in how the learner Superego caught and corrected premature conclusions.

### Cross-Tabulation: Profile × Architecture

Tutor overall score by specific pairings (where data exists):

```
                         Learner Architecture
Profile         cognitive  dialectical  ego_superego  psychodynamic  unified
───────────────────────────────────────────────────────────────────────────────
baseline            -           -            -              -          4.75
budget              -         5.00           -              -            -
quality           5.00          -            -              -            -
recognition         -           -          3.50             -            -
recognition+        -           -            -            5.00           -
```

Notable interaction effects:
- The recognition + ego_superego pairing scored lowest (3.50), suggesting this combination produces suboptimal outcomes—possibly because both emphasize self-critique without sufficient generative capacity
- quality + cognitive and recognition+ + psychodynamic both achieved 5.0, indicating synergy between sophisticated tutor profiles and complex learner architectures

### Discussion: What Dyadic Evaluation Adds

The dyadic extension addresses the central paradox of the original evaluation. Scripted learner turns cannot reciprocate recognition—they are philosophically equivalent to Hegel's slave, responding but not genuinely responding.

With a simulated learner that has its own internal deliberation:
- The tutor's recognition can be tested by whether the learner's internal state actually responds
- Breakthrough moments can be observed in the learner's internal deliberation, not just inferred from external utterance
- The judge can evaluate whether mutual recognition is achieved—not just whether the tutor attempts it

**Key insight from results**: The finding that explicit recognition-naming underperformed while quality optimization excelled suggests that recognition may be an emergent property of thorough, high-quality interaction rather than something that can be directly instructed. This aligns with Honneth's observation that authentic recognition cannot be demanded or performed—it must arise from genuine engagement.

The dyadic framework also revealed that **learner architecture matters for measuring transformation**. The cognitive and psychodynamic architectures, with their explicit memory and reflection agents, showed learning development more clearly than simpler architectures. This suggests that to evaluate educational effectiveness, we need learners sophisticated enough to actually learn—not just respond.

### Implications for AI Alignment

If recognition quality can be measured on both sides of the dyad, this has implications beyond tutoring:
- **Bidirectional evaluation**: AI systems that interact with other AI systems (or simulated users) could be evaluated for recognition quality from both perspectives
- **Constitutional recognition**: The learner's Superego enforces authenticity, just as the tutor's Superego enforces recognition. Both parties have internal evaluators.
- **Emergent mutual recognition**: When both parties are optimized for recognition, does genuine mutual recognition emerge? Or is it still a simulation of recognition?

These questions connect to fundamental issues in AI alignment: Can AI systems genuinely recognize each other (and humans) as subjects? Or is all AI recognition necessarily performative?

---

## Updated Limitations

### Addressed by Dyadic Extension:
- ~~**Simulated learners**: Original evaluation used scripted learner turns~~ → Now uses simulated learners with internal deliberation

### Remaining:
- **LLM-based evaluation**: Both parties and the judge are LLMs. The entire system may develop conventions that appear as recognition but aren't.
- **Model dependence**: Results obtained with specific models.
- **Short-term**: Still primarily single-session evaluation. Longitudinal tracking infrastructure exists but not fully validated.
- **Simulated ≠ Real**: Even sophisticated simulated learners are not real learners. The ultimate test remains human evaluation.
