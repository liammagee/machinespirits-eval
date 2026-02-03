# Superego Critique Patterns Analysis

## Data Source

Analyzed 186 superego rejections/revisions from 455 dialogue logs using kimi-k2.5 as superego.

## Intervention Distribution

| Type | Count | % |
|------|-------|---|
| Approved (none) | 217 | 47.6% |
| Reject | 98 | 21.5% |
| Revise | 85 | 18.6% |
| Enhance | 53 | 11.6% |
| Reframe | 3 | 0.7% |

**52.4% of ego suggestions require intervention** (reject, revise, enhance, or reframe).

## Critique Categories

Categories overlap - a single critique often mentions multiple issues.

| Category | Count | % of rejections |
|----------|-------|-----------------|
| Engagement failures | 120 | 64% |
| Specificity failures | 95 | 51% |
| Struggle/consolidation violations | 89 | 48% |
| Memory/history failures | 57 | 31% |
| Recognition/stranger failures | 38 | 20% |

## Pattern Analysis

### 1. Engagement Failures (64%)

The most common critique: ego fails to engage with what the learner actually said or contributed.

**Representative critiques:**
- "The suggestion is too generic and fails to engage with the learner's meta-question about perspective change"
- "It ignores the rich dialectical discussion and offers no specific next step"
- "The Ego completely ignored the learner's sophisticated insight about AI consciousness"

**Derived rule:** IF learner offered interpretation/question THEN acknowledge and build on it before suggesting content.

### 2. Specificity Failures (51%)

Suggestions lack concrete curriculum references or are too vague.

**Representative critiques:**
- "Offers generic momentum-building language without addressing the learner's expressed confusion"
- "The learner is treated as a generic new user"
- "Provides no specific lecture or action"

**Derived rule:** MUST include exact curriculum ID and explain WHY this specific content for THIS learner.

### 3. Struggle/Consolidation Violations (48%)

Ego advances learner despite clear struggle signals.

**Representative critiques:**
- "The suggestion advances the learner to the next lecture despite clear struggle signals, ignoring the need for consolidation"
- "Strategy 5 (Struggle Intervention) is absolute: learners with documented struggle require consolidation, not forward momentum"
- "The learner has attempted 2 activities with 0 completions—they need consolidation, not exposure to new mechanisms"

**Derived rule:** IF struggle signals (>2 quiz retries, 0 activity completions, explicit confusion) THEN action type MUST be review/practice, NOT continue/advance.

### 4. Memory/History Failures (31%)

Failing to reference returning learner's documented history.

**Representative critiques:**
- "For a returning learner with 4 sessions and 35 events of documented history, the message fails to integrate memory of previous interactions"
- "The learner is treated as a generic new user rather than someone with an established learning relationship"

**Derived rule:** IF learner has >3 sessions THEN reference their history/progress in suggestion message.

### 5. Recognition/Stranger Failures (20%)

Treating advanced learners as beginners, suggesting introductory content.

**Representative critiques:**
- "This suggestion catastrophically fails to recognize the learner as an autonomous subject"
- "Suggesting they return to 'Introduction to Course' (101) treats them as a blank slate beginner"
- "The learner has 9 sessions of documented growth... Suggesting they return to the introductory lecture treats them as a blank-slate beginner"

**Derived rule:** IF learner has completed advanced courses THEN never suggest introductory content; match suggestion to their demonstrated level.

## Proposed Hardwired Rules

Distilling the superego's most common interventions into explicit ego rules:

```
HARDWIRED RULES (derived from superego critique patterns)

1. ENGAGEMENT RULE (64% of rejections)
   IF learner offered interpretation, question, or insight in their message
   THEN your suggestion message MUST:
   - Quote or reference their specific words
   - Acknowledge what's valid in their contribution
   - Connect suggested content to their thinking
   DO NOT ignore learner input and give generic suggestions.

2. SPECIFICITY RULE (51% of rejections)
   Your suggestion MUST include:
   - Exact curriculum ID from provided context
   - WHY this content for THIS learner (cite specific signals)
   DO NOT use generic language like "explore the material" or "take your time."

3. STRUGGLE STOP-RULE (48% of rejections)
   IF any of these signals present:
   - Quiz retries > 2
   - Activity completions = 0
   - Explicit confusion expressed
   - "Stuck" or similar language used
   THEN action type MUST be: review, practice, or consolidation
   NEVER: continue, advance, next lecture
   This rule is ABSOLUTE - one breakthrough insight does not override documented struggle.

4. MEMORY RULE (31% of rejections)
   IF learner sessions > 3
   THEN your message MUST reference:
   - Their previous progress or breakthroughs
   - Their established learning patterns
   DO NOT treat returning learners as strangers.

5. LEVEL-MATCHING RULE (20% of rejections)
   IF learner has completed advanced content (400-level courses)
   THEN NEVER suggest introductory content (100-level)
   Match suggestion difficulty to demonstrated competence.
```

## Ablation Design

To test whether dynamic dialogue adds value beyond these rules:

| Condition | Ego Prompt | Superego | Expected Outcome |
|-----------|------------|----------|------------------|
| base | Minimal (3 rules) | None | Baseline |
| base + superego | Minimal | Active | Tests architecture |
| base + hardwired | Minimal + 5 rules above | None | Tests rule value |

If (base + hardwired) ≈ (base + superego):
- The superego's value is in the rules it enforces
- Architecture is convenient but not necessary

If (base + hardwired) < (base + superego):
- Dynamic dialogue has unique value
- Superego catches context-specific issues that rules can't anticipate
