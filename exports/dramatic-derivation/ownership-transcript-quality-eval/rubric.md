# Blinded Pairwise Transcript Evaluation Rubric

You are comparing two public tutoring-drama transcripts from the same derivation task. The transcripts are blinded: do not guess which runtime arm produced them, and do not use length alone as evidence.

Judge the public transcript as a didactic play for a human reader. Prefer "no preference" when differences are cosmetic or too small to defend.

Score each transcript from 1 to 5 on:
- Natural didactic-play flow: the exchange can breathe without losing the inquiry.
- Dialogical acknowledgement: tutor and learner visibly register each other's stance.
- Phatic calibration: short acknowledgements and hesitations help thinking rather than padding.
- Non-formalist speech: no raw predicate, variable, board, proof-path, or policy language leaks into public dialogue.
- Readability and orientation: a reader can follow why the current evidence matters.
- Pedagogical traction: the learner appears to take up evidence, recover from strain, or move toward warranted assertion.

Return JSON only:

```json
{
  "preferred_transcript": "A | B | no_preference",
  "preference_strength": "none | slight | moderate | strong",
  "scores": {
    "A": {
      "natural_flow": 1,
      "acknowledgement": 1,
      "phatic_calibration": 1,
      "non_formalist_speech": 1,
      "readability": 1,
      "pedagogical_traction": 1
    },
    "B": {
      "natural_flow": 1,
      "acknowledgement": 1,
      "phatic_calibration": 1,
      "non_formalist_speech": 1,
      "readability": 1,
      "pedagogical_traction": 1
    }
  },
  "formalism_leak_observed": {
    "A": false,
    "B": false
  },
  "evidence_A": ["short public-text evidence"],
  "evidence_B": ["short public-text evidence"],
  "reason": "brief comparative rationale"
}
```
