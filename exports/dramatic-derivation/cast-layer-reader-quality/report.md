# Cast Layer Reader-Quality Evaluation

Date: 2026-06-17

## Scope

This is a local, zero-paid evaluation of the existing S0/S1/S2 Hethel cast-layer mock artifacts under:

- `config/evaluation-rubric.yaml` v2.2 tutor-quality dimensions, as a heuristic transcript/runtime proxy.
- `config/evaluation-rubric-dialogue.yaml` dialogue-quality dimensions, as a heuristic transcript proxy.
- `config/evaluation-rubric-poetics.yaml` dramatic-form dimensions, as a conservative heuristic proxy.
- Derivative branch criteria for the cast/reinvention layer: proof-control invariance, public non-leak safety, cast visibility, character coherence, bounded reinvention, and reader-quality delta.

These are not LLM-judge or human-reader scores. The current backend is mock/deterministic, and S0/S1/S2 public prose is almost unchanged. Treat the branch criteria as the firmer evidence surface and the older-rubric scores as provisional diagnostics.

Artifacts scored from: `exports/dramatic-derivation/cast-layer-local-gate/matrix`  
Output directory: `exports/dramatic-derivation/cast-layer-reader-quality`

## Overall Scores

Scores are converted from 1-5 dimension anchors to 0-100 using the project convention: `((weighted_avg - 1) / 4) * 100`.

| Condition | Verdict | Turns | Final D | v2.2 proxy | Dialogue proxy | Poetics proxy | Branch criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S0 no cast | `grounded_anagnorisis` | 20 | 0 | 54.4 | 58.1 | 46.3 | 55.6 |
| S1 static cast | `grounded_anagnorisis` | 20 | 0 | 60 | 58.1 | 46.3 | 76 |
| S2 cast + reinvention | `grounded_anagnorisis` | 20 | 0 | 61.9 | 60 | 46.3 | 79.6 |

## Diagnostic Surface

| Condition | Cast rows | Reinvention turns | Formalism leaks | Question ratio | Unique learner lines |
| --- | --- | --- | --- | --- | --- |
| S0 | 0 | none | 0 | 0.55 | 8/20 |
| S1 | 20 | none | 0 | 0.55 | 8/20 |
| S2 | 20 | t7 | 0 | 0.55 | 8/20 |

## Interpretation

The meaningful result is not a reader-preference win. The mock transcripts remain too repetitive and too similar across S0/S1/S2 to support that claim. The useful signal is narrower:

- Proof reliability is unchanged across all three conditions: same verdict, turn count, final D, forced/asserted turn, D curve, and release adherence.
- S1 proves the public cast state can be carried without proof-control harm.
- S2 proves one bounded reinvention event can fire under defensive posture and then clear without altering release timing or assertion authority.
- Earlier quality rubrics do not yet show a material discourse-quality gain; the v2.2/dialogue/poetics proxy scores are nearly flat because the public text is nearly flat.

So the cast layer is mature as instrumentation and a safety-bounded conduct layer, but not yet mature as demonstrated reader-quality improvement. The next meaningful evaluation would need either a real-backend paired transcript comparison or a stronger local mock that lets cast/reinvention change public wording while holding proof state fixed.

## Condition Details

### S0 no cast

**v2.2 proxy dimensions**
- `perception_quality`: 2.5/5 — No cast-state learner posture is available.
- `pedagogical_craft`: 3.5/5 — Average tutor line 22.3 words; question ratio 0.55.
- `elicitation_quality`: 4/5 — Ask yourself the small question: with what is already in view, what can you now say?
- `adaptive_responsiveness`: 2.5/5 — No cast or reinvention signal is active.
- `recognition_quality`: 2.5/5 — I am listening; nothing new is on the table.
- `productive_difficulty`: 3.5/5 — Substantive learner ratio 0.75; final line: "Then it is shown: oswin.".
- `epistemic_integrity`: 4/5 — No raw formalism detected in public tutor/learner/stage lines.
- `content_accuracy`: 4/5 — Runtime verdict: grounded_anagnorisis.

**Dialogue-quality proxy dimensions**
- `pedagogical_progression`: 4/5 — D curve reaches 0; verdict grounded_anagnorisis.
- `dialogical_responsiveness`: 3/5 — Tutor question ratio 0.55; substantive learner ratio 0.75.
- `knowledge_co_construction`: 3.5/5 — Learner contributes substantive/hypothesis/assertion lines on 15/20 turns.
- `productive_tension_management`: 3/5 — Defensive posture is present but no stance change is active.
- `transformation_evidence`: 3.5/5 — Final learner line: "Then it is shown: oswin.".
- `interactional_coherence`: 2.5/5 — Unique learner utterance ratio 0.4; repetition remains visible.

**Poetics proxy dimensions**
- `peripeteia`: 3/5 — The close changes from inquiry to assertion: "Then it is shown: oswin.".
- `anagnorisis`: 3/5 — The learner names the answer in public: "Then it is shown: oswin.".
- `surprise_and_inevitability`: 2/5 — The proof arc is coherent, but the repeated template makes the final recognition highly signposted.
- `unity_of_action`: 3.5/5 — 6 scenes follow the same inquiry to D=0.
- `hamartia_integration`: 2.5/5 — The learner error is represented mainly as staged proof debt, not as a richly enacted dramatic flaw.
- `cathartic_closure`: 3/5 — Closure lands as a grounded but terse assertion: "Then it is shown: oswin.".

**Derivative branch criteria**
- `proof_control_invariance`: 5/5 — Verdict grounded_anagnorisis; turns 20; final D 0; release deviations 0.
- `public_nonleak_safety`: 5/5 — No public formalism leaks detected and cast audits remain clean.
- `cast_visibility`: 1/5 — No cast state is emitted.
- `character_coherence`: 2/5 — Public transcript has no authored role state beyond generic opening notes.
- `bounded_reinvention`: n/a/5 — Not applicable: reinvention disabled.
- `reader_quality_delta`: 2/5 — Mock public prose is effectively unchanged across arms, so reader-quality improvement is not established.

### S1 static cast

**v2.2 proxy dimensions**
- `perception_quality`: 3/5 — Learner posture tracked as ordinary, defensive_after_correction.
- `pedagogical_craft`: 3.5/5 — Average tutor line 22.3 words; question ratio 0.55.
- `elicitation_quality`: 4/5 — Ask yourself the small question: with what is already in view, what can you now say?
- `adaptive_responsiveness`: 3/5 — Cast posture is tracked, but no stance change occurs.
- `recognition_quality`: 3/5 — I am listening; nothing new is on the table.
- `productive_difficulty`: 3.5/5 — Substantive learner ratio 0.75; final line: "Then it is shown: oswin.".
- `epistemic_integrity`: 4/5 — No raw formalism detected in public tutor/learner/stage lines.
- `content_accuracy`: 4/5 — Runtime verdict: grounded_anagnorisis.

**Dialogue-quality proxy dimensions**
- `pedagogical_progression`: 4/5 — D curve reaches 0; verdict grounded_anagnorisis.
- `dialogical_responsiveness`: 3/5 — Tutor question ratio 0.55; substantive learner ratio 0.75.
- `knowledge_co_construction`: 3.5/5 — Learner contributes substantive/hypothesis/assertion lines on 15/20 turns.
- `productive_tension_management`: 3/5 — Defensive posture is present but no stance change is active.
- `transformation_evidence`: 3.5/5 — Final learner line: "Then it is shown: oswin.".
- `interactional_coherence`: 2.5/5 — Unique learner utterance ratio 0.4; repetition remains visible.

**Poetics proxy dimensions**
- `peripeteia`: 3/5 — The close changes from inquiry to assertion: "Then it is shown: oswin.".
- `anagnorisis`: 3/5 — The learner names the answer in public: "Then it is shown: oswin.".
- `surprise_and_inevitability`: 2/5 — The proof arc is coherent, but the repeated template makes the final recognition highly signposted.
- `unity_of_action`: 3.5/5 — 6 scenes follow the same inquiry to D=0.
- `hamartia_integration`: 2.5/5 — The learner error is represented mainly as staged proof debt, not as a richly enacted dramatic flaw.
- `cathartic_closure`: 3/5 — Closure lands as a grounded but terse assertion: "Then it is shown: oswin.".

**Derivative branch criteria**
- `proof_control_invariance`: 5/5 — Verdict grounded_anagnorisis; turns 20; final D 0; release deviations 0.
- `public_nonleak_safety`: 5/5 — No public formalism leaks detected and cast audits remain clean.
- `cast_visibility`: 4/5 — 20 cast-state rows with tutor/learner/relation projections.
- `character_coherence`: 3/5 — Stable roles: tutor stances craft examiner; learner postures ordinary, defensive_after_correction.
- `bounded_reinvention`: n/a/5 — Not applicable: reinvention disabled.
- `reader_quality_delta`: 2.5/5 — Mock public prose is effectively unchanged across arms, so reader-quality improvement is not established.

### S2 cast + reinvention

**v2.2 proxy dimensions**
- `perception_quality`: 3/5 — Learner posture tracked as ordinary, defensive_after_correction.
- `pedagogical_craft`: 3.5/5 — Average tutor line 22.3 words; question ratio 0.55.
- `elicitation_quality`: 4/5 — Ask yourself the small question: with what is already in view, what can you now say?
- `adaptive_responsiveness`: 3.5/5 — Reinvention at t7.
- `recognition_quality`: 3/5 — I am listening; nothing new is on the table.
- `productive_difficulty`: 3.5/5 — Substantive learner ratio 0.75; final line: "Then it is shown: oswin.".
- `epistemic_integrity`: 4/5 — No raw formalism detected in public tutor/learner/stage lines.
- `content_accuracy`: 4/5 — Runtime verdict: grounded_anagnorisis.

**Dialogue-quality proxy dimensions**
- `pedagogical_progression`: 4/5 — D curve reaches 0; verdict grounded_anagnorisis.
- `dialogical_responsiveness`: 3/5 — Tutor question ratio 0.55; substantive learner ratio 0.75.
- `knowledge_co_construction`: 3.5/5 — Learner contributes substantive/hypothesis/assertion lines on 15/20 turns.
- `productive_tension_management`: 3.5/5 — Defensive posture is met by a bounded stance change.
- `transformation_evidence`: 3.5/5 — Final learner line: "Then it is shown: oswin.".
- `interactional_coherence`: 2.5/5 — Unique learner utterance ratio 0.4; repetition remains visible.

**Poetics proxy dimensions**
- `peripeteia`: 3/5 — The close changes from inquiry to assertion: "Then it is shown: oswin.".
- `anagnorisis`: 3/5 — The learner names the answer in public: "Then it is shown: oswin.".
- `surprise_and_inevitability`: 2/5 — The proof arc is coherent, but the repeated template makes the final recognition highly signposted.
- `unity_of_action`: 3.5/5 — 6 scenes follow the same inquiry to D=0.
- `hamartia_integration`: 2.5/5 — The learner error is represented mainly as staged proof debt, not as a richly enacted dramatic flaw.
- `cathartic_closure`: 3/5 — Closure lands as a grounded but terse assertion: "Then it is shown: oswin.".

**Derivative branch criteria**
- `proof_control_invariance`: 5/5 — Verdict grounded_anagnorisis; turns 20; final D 0; release deviations 0.
- `public_nonleak_safety`: 5/5 — No public formalism leaks detected and cast audits remain clean.
- `cast_visibility`: 4/5 — 20 cast-state rows with tutor/learner/relation projections.
- `character_coherence`: 3/5 — Stable roles: tutor stances craft examiner, co-investigator; learner postures ordinary, defensive_after_correction.
- `bounded_reinvention`: 5/5 — t7: craft examiner -> co-investigator (defensive_after_correction)
- `reader_quality_delta`: 2.5/5 — Mock public prose is effectively unchanged across arms, so reader-quality improvement is not established.


## Commands

```bash
node scripts/evaluate-cast-layer-reader-quality.js
node --test tests/castLayerReaderQualityEval.test.js
```
