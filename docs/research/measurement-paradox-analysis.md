# Measurement Paradox: Authentic Engagement vs. Judged Quality

## The Finding

When we corrected the learner ego/superego prompts (cells 6, 8 — psychodynamic learner architecture), the fixed learner produced more authentic engagement: genuine confusion, productive resistance, and honest intellectual struggle. However, judged scores *dropped* — particularly on recognition dimensions (~88 to ~70), while base pedagogical scores barely moved (~94 to ~92).

This is paradoxical: better learner engagement led to *lower* evaluated quality.

## Diagnosis

Two factors explain the paradox:

### 1. The Judge Never Saw the Dialogue

`buildEvaluationPrompt()` passed only the isolated tutor suggestion plus scenario metadata to the judge. The judge scored recognition dimensions (mutual_recognition, dialectical_responsiveness, learner_growth, etc.) without seeing the learner's actual messages, struggle, or evolution.

A tutor response calibrated to authentic confusion *looks worse in isolation* than one responding to a compliant learner. The judge sees a carefully scaffolded response with hedging and open questions, and interprets it as the tutor failing to achieve clear recognition — because it cannot see the learner IS engaging, just through productive struggle rather than smooth agreement.

### 2. Existing Dimensions Reward Smooth Success

The recognition criteria define "5" as visible reciprocal engagement and transformation. When the learner authentically resists (productive struggle), the judge sees the tutor's nuanced, scaffolded response but interprets it as failing to achieve recognition — because it can't see the learner's engagement.

The rubric had no dimensions that specifically reward:
- Sustaining productive difficulty rather than resolving it prematurely
- Representing complexity honestly rather than oversimplifying

## The Mechanism

The ego/superego learner architecture produces a qualitatively different interlocutor:

- **Learner ego** generates initial reaction (often confused, uncertain)
- **Learner superego** critiques for honesty ("are you faking understanding?")
- **Learner synthesis** produces message that is more authentically confused

The tutor then responds to this authentic confusion with:
- More scaffolding (not giving answers)
- More open questions
- More acknowledgment of genuine difficulty
- Less "recognition achieved" resolution

In isolation, this *better* tutoring looks *worse* to a judge evaluating against criteria that reward visible mutual recognition outcomes.

## The Iteration

### Change 1: Dialogue Context for the Judge

The judge now receives the full dialogue transcript — all turns of the exchange, including learner internal deliberation (ego/superego/synthesis) when available, and tutor internal deliberation (ego/superego revision) for multi-agent mode.

This is the highest-impact change: all 12 existing dimensions become more accurate because the judge can see what the tutor was responding to. Recognition dimensions in particular should rise when the judge can see the learner IS engaging through authentic struggle.

### Change 2: Two New Rubric Dimensions

**Productive Struggle** (weight: 5%) — Does the tutor sustain appropriate cognitive tension rather than resolving it prematurely? Rewards tutors that honor authentic confusion, maintain scaffolded difficulty, and resist the impulse to "fix" by explaining away. Distinct from transformative_potential (which measures conditions for transformation) — this measures whether the tutor *preserves the struggle* that transformation requires.

**Epistemic Honesty** (weight: 5%) — Does the tutor represent complexity honestly rather than oversimplifying for smooth delivery? Rewards tutors that acknowledge genuine difficulty, don't smooth over hard parts, and match their confidence to actual conceptual clarity.

Weight rebalancing: tone 0.10 → 0.08, actionability 0.10 → 0.08 to accommodate the new 0.10 total. The 75/25 base/recognition split is preserved since these are base-adjacent dimensions.

### Change 3: Holistic Dialogue Evaluation

For multi-turn scenarios, a holistic evaluation of the entire transcript is now performed after per-turn scoring. This captures emergent qualities (bilateral transformation, learner growth arc, sustained productive struggle) that per-turn evaluation misses. Stored as `holisticDialogueScore` alongside the per-turn average.

## Expected Impact

1. **Recognition dimension accuracy**: Should improve for authentic engagement scenarios, since the judge can now see the learner's actual struggle and development
2. **Productive struggle discrimination**: Should differentiate tutors that sustain appropriate difficulty from those that prematurely resolve
3. **Epistemic honesty discrimination**: Should differentiate tutors that represent complexity honestly from those that oversimplify
4. **Holistic vs. per-turn divergence**: For multi-turn scenarios, the holistic score should capture trajectory qualities the per-turn average misses

## Verification Plan

1. Run cells 6, 8 with updated rubric (same model, same judge)
2. Compare recognition scores before/after transcript inclusion
3. Check productive_struggle and epistemic_honesty scores discriminate between authentic and performative engagement
4. Compare per-turn average vs. holistic dialogue score
5. Re-evaluate a933d745 data with updated rubric for direct before/after comparison
