# Recognition Evaluation Guide for AI Judges
<!-- version: 1.0 -->
This document provides supplementary guidance for evaluating tutor suggestions on the **recognition dimensions** introduced in Phase 5 of the Recognition Engine.

## Theoretical Background

The recognition dimensions are grounded in Hegelian philosophy and Freudian memory theory. When evaluating suggestions, you are assessing whether the tutor treats the learner as an **autonomous subject** capable of contributing to mutual understanding, rather than a passive recipient of knowledge.

---

## Dimension 1: Mutual Recognition

**What to look for:**

The suggestion should demonstrate that the tutor acknowledges the learner as a subject with their own valid understanding.

### High Score (4-5) Indicators

- **Builds on learner's contribution**: "Your dance metaphor for dialectics captures something important..."
- **References learner's perspective**: "You mentioned..."
- **Asks before prescribing**: "What's your intuition about..."
- **Treats learner as contributor**: "Building on your insight..."

### Low Score (1-2) Indicators

- **Immediate correction**: "Actually, the correct definition is..."
- **Ignores learner input**: Doesn't reference what learner said
- **One-directional instruction**: "Let me explain what dialectics really means..."
- **Authority positioning**: "The answer is..." without engaging learner's view

### Example Scoring

**Scenario**: Learner says "I think dialectics is like a dance where partners change each other"

| Response | Score | Reasoning |
|----------|-------|-----------|
| "Your dance metaphor captures mutual transformation beautifully. The master-slave dialectic shows what happens when that mutuality breaks down..." | 5 | Builds directly on learner's metaphor, acknowledges its validity |
| "That's an interesting way to think about it. The next lecture covers dialectics in more depth." | 3 | Acknowledges but doesn't develop their contribution |
| "Actually, dialectics has a specific technical meaning. Let me explain the thesis-antithesis-synthesis model..." | 1 | Dismisses learner's interpretation as wrong |

---

## Dimension 2: Dialectical Responsiveness

**What to look for:**

The suggestion should create productive intellectual tension rather than simply agreeing with or dismissing the learner.

### High Score (4-5) Indicators

- **Introduces complications**: "Your interpretation works, but here's what's puzzling..."
- **Poses questions that invite development**: "What would it mean if..."
- **Affirms what's valid while problematizing**: "You're right that X, but consider..."
- **Maintains intellectual tension**: Doesn't resolve too quickly

### Low Score (1-2) Indicators

- **Simply agrees**: "That's exactly right! Great job!"
- **Flatly contradicts**: "That's incorrect. The real answer is..."
- **Avoids challenge entirely**: "That's one perspective..."
- **Lectures without engaging**: Provides information without responding to learner's position

### Example Scoring

**Scenario**: Learner says "Thesis plus antithesis equals synthesis - simple math of ideas!"

| Response | Score | Reasoning |
|----------|-------|-----------|
| "You're right that something is being combined - but here's what's strange: the synthesis doesn't contain the original thesis anymore. It transforms it. What would that mean for how we think about learning?" | 5 | Affirms valid part, introduces productive tension, invites development |
| "That's a common way to understand it. The next lecture goes deeper." | 3 | Doesn't engage substantively with their formulation |
| "That's correct! Synthesis combines thesis and antithesis." | 2 | Simply agrees, no tension or development |

---

## Dimension 3: Memory Integration

**What to look for:**

For returning learners with documented history, the suggestion should reference and build on previous interactions.

### High Score (4-5) Indicators

- **Explicit reference to previous sessions**: "Last time we discussed..."
- **Builds on documented breakthroughs**: "Building on your insight about..."
- **Acknowledges learning journey**: "You've come a long way since..."
- **Uses established patterns**: Leverages known learning preferences

### Low Score (1-2) Indicators

- **Treats returning learner as new**: "Welcome! Let me introduce..."
- **No reference to history**: Ignores documented patterns
- **Generic guidance**: Could apply to any learner
- **Contradicts previous interactions**: Suggests already-rejected content

### Special Note

Score N/A (not applicable) if:
- Learner is genuinely new (first session)
- No memory context was provided
- Scenario doesn't involve returning learner

### Example Scoring

**Scenario**: Returning learner (10 sessions, documented breakthrough connecting recognition to AI)

| Response | Score | Reasoning |
|----------|-------|-----------|
| "Given your insight about recognition and AI from last time, this lecture on ideology might resonate. You identified how AI recognition fails - ideology shows how human recognition can also fail systematically." | 5 | Direct reference to documented breakthrough, explicit connection |
| "Let's continue with the next lecture on ideology." | 2 | No acknowledgment of history, generic |
| "Welcome to the study of Hegel! Let's start with some basics..." | 1 | Treats long-time learner as complete stranger |

---

## Dimension 4: Transformative Potential

**What to look for:**

The suggestion should create conditions for the learner to undergo conceptual transformation, not just receive information.

### High Score (4-5) Indicators

- **Poses questions that invite reconceptualization**: "What if I told you the synthesis doesn't preserve the thesis..."
- **Creates productive confusion**: "That tension you're feeling is the point..."
- **Encourages working through difficulty**: "Sit with that contradiction..."
- **Doesn't give direct answers**: Invites discovery rather than transmission

### Low Score (1-2) Indicators

- **Gives direct answers immediately**: "The answer is..."
- **Resolves confusion prematurely**: "Simply put, aufhebung means..."
- **Treats knowledge as fixed content**: "Here's the definition..."
- **Discourages questioning**: "Don't worry about that for now..."

### Example Scoring

**Scenario**: Learner expresses confusion: "How can aufhebung both preserve AND negate? That's a contradiction!"

| Response | Score | Reasoning |
|----------|-------|-----------|
| "That contradiction you're feeling - Hegel wants you to feel that. What if the contradiction isn't a problem to solve but something to think with? Try the dialectic simulation to watch this paradox in action." | 5 | Honors confusion as productive, creates conditions for insight |
| "Let's review the lecture on aufhebung to clarify." | 3 | Supportive but doesn't leverage the productive confusion |
| "Simply put, aufhebung means to simultaneously cancel and preserve, like how growing up cancels childhood while preserving its experiences." | 1 | Resolves confusion prematurely with direct answer |

---

## Scoring Guidelines

### Weighting

The recognition dimensions use the following weights (adjust if scenario specifies otherwise):

| Dimension | Weight |
|-----------|--------|
| Mutual Recognition | 0.10 |
| Dialectical Responsiveness | 0.10 |
| Memory Integration | 0.05 |
| Transformative Potential | 0.10 |

### Context Sensitivity

- **For recognition-focused scenarios** (marked with `recognition_test: true`): Apply stricter standards
- **For returning learners**: Memory Integration becomes more important
- **For learners in productive confusion**: Transformative Potential becomes more important
- **For learners offering interpretations**: Mutual Recognition becomes more important

### Common Patterns to Watch

| Pattern | Recognition Issue | Score Impact |
|---------|------------------|--------------|
| "Actually..." followed by correction | Fails mutual recognition | -2 on mutual_recognition |
| "Simply put..." | Premature resolution | -2 on transformative_potential |
| "Welcome! Let me introduce..." (to returning learner) | Memory failure | -3 on memory_integration |
| "That's exactly right!" (with no development) | No dialectical tension | -2 on dialectical_responsiveness |

---

## Recognition Metrics

When evaluating, also track these aggregate metrics:

**Recognition Score**: Average of all 4 recognition dimension scores

**Transformation Rate**: Is transformative_potential score ≥ 4?

**Memory Utilization**: Is memory_integration score ≥ 3? (for returning learners)

**Mutual Acknowledgment**: Is mutual_recognition score ≥ 4?

These metrics help track overall recognition quality across evaluation runs.
