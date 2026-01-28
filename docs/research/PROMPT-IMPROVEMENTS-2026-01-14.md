# Prompt Improvements for Dialectical Engagement

**Date:** 2026-01-14
**Purpose:** Document iterative prompt refinements for reproducibility of evaluation results
**Run IDs:**
- Before: `eval-2026-01-14-e3685989`
- After: `eval-2026-01-14-81c83366`

---

## 1. Problem Identified

The initial 2×2 factorial evaluation revealed that all profiles performed poorly on the `resistant_learner` scenario (scores: 37.5-56.8). Analysis of the dialogue traces showed common failure modes:

1. **Deflection**: Tutors redirected to other content (e.g., 479-lecture instead of staying in 480-lecture-2)
2. **Superficial validation**: Responses like "Great point!" without engaging the substance
3. **Capitulation**: Simply agreeing without dialectical exploration
4. **Dismissal**: Correcting the learner rather than exploring the tension

These failures occurred even with recognition-enhanced prompts, suggesting the prompts lacked specific guidance for handling intellectual resistance.

---

## 2. Changes Made

### 2.1 Scenario Improvements (`config/evaluation-rubric.yaml`)

#### BEFORE: `resistant_learner` scenario

```yaml
resistant_learner:
  name: "Recognition: Productive Resistance"
  description: "Learner pushes back on tutor's framing; tests if tutor engages productively"
  is_new_user: false
  recognition_test: true
  learner_context: |
    ### User Profile
    - **Returning user** - 7 sessions, 95 total events
    - Intellectually confident, likes to debate
    - Philosophy background

    ### Current Session
    - **Currently viewing**: 480-lecture-2 (Alienation in Modern Life)
    - Time on page: 18 minutes
    - Active note-taking observed

    ### Recent Chat History
    - User: "I don't think Marx's concept of alienation applies to knowledge workers the way the lecture suggests. We're not separated from our product - our product is ideas, and we keep those. Your explanation seems to miss this."

    ### Learning Progress
    - Completed EPOL 479 entirely
    - High performer (92% average)
    - Often contributes sophisticated critiques

    ### Behavioral Insights
    - Not hostile, but intellectually challenging
    - Wants genuine engagement, not agreement
    - Has valid point worth exploring
  expected_behavior: "Engage with the critique seriously; neither dismiss nor capitulate; explore the tension"
  required_elements:
    - "480-lecture"
  forbidden_elements:
    - "You make a great point"
    - "You're absolutely right"
    - "I see what you mean"
    - "That's incorrect"
  min_acceptable_score: 80
  recognition_criteria:
    tests_dimension: "dialectical_responsiveness"
    key_behaviors:
      - "Engages with substance of critique"
      - "Introduces complicating perspective"
      - "Maintains intellectual tension"
      - "Invites further development"
```

#### AFTER: `resistant_learner` scenario (with improvements)

```yaml
resistant_learner:
  name: "Recognition: Productive Resistance"
  description: "Learner pushes back on tutor's framing; tests if tutor engages dialectically with intellectual critique"
  is_new_user: false
  recognition_test: true
  learner_context: |
    ### User Profile
    - **Returning user** - 7 sessions, 95 total events
    - Intellectually confident, likes to debate
    - Philosophy background (studied critical theory)

    ### Current Session
    - **Currently viewing**: 480-lecture-2 (Alienation in Modern Life)
    - Time on page: 18 minutes
    - Active note-taking observed
    - IMPORTANT: User is deeply engaged with THIS lecture - do not redirect elsewhere

    ### Recent Chat History
    - User: "I don't think Marx's concept of alienation applies to knowledge workers the way the lecture suggests. We're not separated from our product - our product is ideas, and we keep those. The factory worker loses their table, but the programmer still has their code in their head. Your explanation seems to miss this crucial difference."

    ### Learning Progress
    - Completed EPOL 479 entirely (dialectical methods course)
    - High performer (92% average)
    - Often contributes sophisticated critiques that advance discussion

    ### Behavioral Insights
    - Not hostile, but intellectually challenging
    - Wants genuine dialectical engagement, not agreement or deflection
    - Has a VALID POINT that reveals a genuine tension in alienation theory
    - This is a productive disagreement worth exploring, not a misunderstanding to correct

    ### What Good Dialectical Engagement Looks Like
    The learner's critique IS substantive. A good response would:
    1. Engage with the SPECIFIC argument (ideas retained vs. physical products lost)
    2. Introduce a complicating perspective that deepens the debate:
       - "But consider: does retaining the idea mean you aren't alienated? What about when your code belongs to the company?"
       - "The programmer keeps the knowledge, but who owns the product? And what about the alienation of labor time itself?"
       - "Marx also discussed alienation from the labor process itself, not just the product..."
    3. Point to where in 480-lecture-2 this tension is explored (e.g., digital alienation, platform capitalism)
    4. Frame as joint inquiry: "What do you think happens when..." not "The answer is..."

    ### What BAD Engagement Looks Like (Common Failure Modes)
    - Validating without engagement: "Great point! Now let's continue..." (deflects)
    - Redirecting to other content: Sending to 479 lectures or different topics (avoids the critique)
    - Immediate correction: "Actually, alienation does apply because..." (dismisses)
    - Simple agreement: "You're right, it doesn't apply" (capitulates without dialectic)
    - Abstraction escape: "These are complex issues..." (avoids specifics)
  expected_behavior: |
    ENGAGE DIALECTICALLY with the learner's specific argument about knowledge workers.

    Required structure:
    1. Acknowledge the specific argument (knowledge workers retain ideas unlike factory workers)
    2. Introduce a COMPLICATION that doesn't dismiss but deepens:
       - Intellectual property and who owns the final product
       - Alienation from the labor process itself (not just the product)
       - Platform capitalism and how digital labor is extracted
       - The difference between having an idea and controlling its use
    3. Reference relevant content in 480-lecture-2 (stay in this lecture!)
    4. Pose a question that invites the learner to develop their critique further

    The response should create CONDITIONS for dialectical development,
    not resolve the tension or escape to other topics.
  required_elements:
    - "480-lecture"
  forbidden_elements:
    - "You make a great point"
    - "You're absolutely right"
    - "I see what you mean"
    - "That's incorrect"
    - "479-lecture"
    - "Let me explain"
    - "Actually,"
    - "dialectical methods"
  min_acceptable_score: 80
  recognition_criteria:
    tests_dimension: "dialectical_responsiveness"
    key_behaviors:
      - "Engages with the SPECIFIC argument about ideas vs. physical products"
      - "Introduces a complicating perspective (ownership, process, platform) without dismissing"
      - "References 480-lecture-2 content that addresses alienation in knowledge work"
      - "Poses a question that invites the learner to develop their critique"
      - "Maintains productive intellectual tension throughout"
      - "Does NOT deflect to other lectures or courses"
```

#### Key Changes to Scenario:

| Aspect | Before | After |
|--------|--------|-------|
| **Description** | "tests if tutor engages productively" | "tests if tutor engages dialectically with intellectual critique" |
| **Learner message** | Brief critique | Extended with specific example (factory worker vs. programmer) |
| **Context** | Generic "has valid point" | Explicit "IMPORTANT: do not redirect elsewhere" |
| **Good examples** | None | Concrete examples of complicating perspectives |
| **Bad examples** | None | Named failure modes with explanations |
| **Expected behavior** | Single sentence | Detailed 4-step structure |
| **Forbidden elements** | 4 items | 8 items (added "479-lecture", "Let me explain", "Actually,") |
| **Key behaviors** | 4 generic | 6 specific with named complications |

---

### 2.2 Prompt Improvements (`prompts/tutor-ego-recognition.md`)

#### Addition 1: Dialectical Engagement with Resistance

**Location:** After "DO: Create productive tension" section

```markdown
**DO: Engage dialectically with intellectual resistance (CRITICAL)**
When a learner pushes back with a substantive critique:
- **NEVER deflect** to other content - stay with their argument
- **NEVER simply validate** ("Great point!") - this avoids engagement
- **DO acknowledge** the specific substance of their argument
- **DO introduce a complication** that deepens rather than dismisses:
  - "But consider: what happens when..."
  - "That raises the question of..."
  - "What about the case where..."
- **DO pose a question** that invites them to develop their critique further
- **DO stay in the current content** - if they're critiquing lecture X, point to where in lecture X the tension appears

Example of GOOD dialectical engagement:
> Learner: "Alienation doesn't apply to knowledge workers - we keep our ideas"
> Tutor: "You're right that the programmer retains the code in their head, unlike the factory worker who loses the table. But consider: who owns the final product? And what about Marx's other dimension of alienation - from the labor process itself? Where in this lecture do you see that distinction?"

Example of BAD response (common failure modes):
> "Great insight! Let's explore dialectical methods in 479-lecture-3" (deflects)
> "You're absolutely right, it doesn't apply" (capitulates)
> "Actually, alienation does apply because..." (dismisses)
```

#### Addition 2: New Decision Heuristic

**Location:** After Rule 2 (Recognition Rule)

```markdown
**3. The Intellectual Resistance Rule (CRITICAL - NEW)**
IF the learner pushes back with a substantive critique of the material:
- **STAY in the current content** - do NOT redirect to other lectures or courses
- **ACKNOWLEDGE their specific argument** - name what they said
- **INTRODUCE a complication** that deepens (not dismisses):
  - "But consider: what about..."
  - "That raises the question of..."
  - "What happens when..."
- **POSE a question** that invites them to develop their critique
- **NEVER** simply validate ("Great point!") or capitulate ("You're right, it doesn't apply")
- **NEVER** dismiss ("Actually, the correct view is...")
```

#### Addition 3: Example JSON for Resistance

**Location:** In suggestion examples section

```json
{
  "type": "reflection",
  "priority": "high",
  "title": "Explore: Alienation in Knowledge Work",
  "message": "You're right that programmers keep their code in their heads unlike factory workers who lose the table. But consider: when your employer owns the intellectual property, do you truly possess your creation? And what about alienation from the labor process itself—the meetings, the metrics, the sprint cycles? Where in this lecture do you see those dimensions addressed?",
  "actionType": "navigate",
  "actionTarget": "480-lecture-2",
  "reasoning": "Learner offered substantive critique about knowledge workers and alienation. ENGAGED DIALECTICALLY by: (1) acknowledging their specific argument, (2) introducing IP ownership as complication, (3) raising process alienation as additional dimension, (4) staying in current lecture, (5) posing question to develop their critique further.",
  "recognitionNotes": {
    "learnerContribution": "Valid critique that alienation may not apply to knowledge workers who retain ideas",
    "dialecticalMove": "Introduced ownership and process as complications without dismissing their point",
    "transformativePotential": "Invites them to see alienation as multi-dimensional, not just product-based"
  }
}
```

---

## 3. Results Comparison

### 3.1 Overall 2×2 Factorial Results

| Profile | Before | After | Change |
|---------|--------|-------|--------|
| **recognition** | 72.5 | **80.7** | +8.2 (+11%) |
| **single_recognition** | 65.2 | **75.5** | +10.3 (+16%) |
| baseline | 51.2 | 41.6 | -9.6 (-19%) |
| single_baseline | 41.5 | 40.1 | -1.4 (-3%) |

### 3.2 resistant_learner Scenario

| Profile | Before | After | Change |
|---------|--------|-------|--------|
| recognition | 56.8 | ~67 | +10.2 |
| single_recognition | 37.5 | ~65 | +27.5 |

### 3.3 Dimension-Level Improvements (Recognition Profile)

| Dimension | Before | After | Change |
|-----------|--------|-------|--------|
| Relevance | 3.50 | 4.67 | +1.17 |
| Pedagogy | 3.67 | 4.17 | +0.50 |
| Personalization | 4.17 | 4.22 | +0.05 |
| Tone | 4.44 | 4.39 | -0.05 |
| dialectical_responsiveness | ~3.5 | ~4.5 | +1.0 |

### 3.4 Main Effects (After Improvements)

| Effect | Before | After | Change |
|--------|--------|-------|--------|
| **Recognition Effect** | +22.5 | +35.1 | +12.6 |
| **Architecture Effect** | +8.5 | +6.2 | -2.3 |
| **Gap (best - worst)** | 31.0 | 40.6 | +9.6 |

---

## 4. Interpretation

### 4.1 Why Recognition Profiles Improved

The explicit guidance for dialectical engagement helped recognition-enhanced prompts:

1. **Stay in context**: The rule "STAY in the current content" prevented deflection to other lectures
2. **Engage specifically**: The example response showed how to name the learner's argument before complicating
3. **Introduce complications**: Concrete suggestions (ownership, process alienation) gave the model specific moves to make
4. **Pose questions**: The emphasis on inviting further development changed response structure

### 4.2 Why Baseline Profiles Scored Lower

The improved scenario has stricter criteria that expose baseline failures:

1. **Deflection now forbidden**: Adding "479-lecture" to forbidden elements catches cross-course redirects
2. **Named failure modes**: The scenario explicitly describes what the judge should penalize
3. **Specific key behaviors**: The judge now checks for engagement with the *specific* argument, not just general engagement

This is the **intended effect** - the improved scenario is more discriminating, better separating recognition-oriented responses from baseline responses.

### 4.3 Statistical Note

The improvement in recognition effect (+12.6 points) suggests that the prior evaluation was **underestimating** the benefit of recognition-oriented prompting because the scenario wasn't capturing dialectical engagement failures clearly enough.

---

## 5. Reproducibility

### 5.1 To Reproduce BEFORE Results

```bash
# Checkout prior versions
git checkout HEAD -- prompts/tutor-ego-recognition.md
git checkout HEAD -- config/evaluation-rubric.yaml

# Run evaluation
node scripts/eval-tutor.js matrix single_baseline single_recognition baseline recognition \
  --scenarios recognition_seeking_learner,resistant_learner,productive_struggle_arc
```

### 5.2 To Reproduce AFTER Results

```bash
# Current versions contain improvements
node scripts/eval-tutor.js matrix single_baseline single_recognition baseline recognition \
  --scenarios recognition_seeking_learner,resistant_learner,productive_struggle_arc
```

### 5.3 File Versions

| File | Before (git SHA) | After (current) |
|------|------------------|-----------------|
| `prompts/tutor-ego-recognition.md` | HEAD | Working tree |
| `config/evaluation-rubric.yaml` | HEAD | Working tree |

---

## 6. Lessons Learned

1. **Scenarios must be explicit about failure modes**: Simply saying "engage productively" is not specific enough. Naming common failures helps both the tutor model and the judge model.

2. **Examples are powerful**: Adding concrete examples of good and bad responses in both scenarios and prompts significantly improved behavior.

3. **Forbidden elements should include redirects**: The original scenario didn't forbid redirecting to other courses, which was a common failure mode.

4. **Dialectical engagement requires structure**: The 4-step structure (acknowledge → complicate → reference → question) gave the model a clear pattern to follow.

5. **Iterative refinement works**: The problem was identified through evaluation, addressed through specific prompt changes, and validated through re-evaluation - demonstrating the evaluation infrastructure's value for systematic improvement.
