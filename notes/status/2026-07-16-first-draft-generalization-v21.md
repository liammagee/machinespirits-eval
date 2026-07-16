# First-draft generalization V21

Date: 2026-07-16  
Status: failed at the predeclared hard first cell; remaining seeds unconsumed

## Frozen run

- Campaign: `first-draft-generalization-v21`
- Frozen commit: `2302ebda1065dc01761ec6cebdf84d4b3587fad2`
- Frozen config SHA-256: `c7957e8eb4f3cfc8514cc90eee5a149c14f502a0dc7df0ceb801d22b77bff93c`
- Hard first cell: `world_027_gazette_recall` / `answer_seeking`
- Seed: `20260950` (consumed and retired)
- Report: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v21-live/gazette_answer_seeking/auto-eval-2026-07-16T08-41-51-353Z.json`
- Campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v21-live/campaign-result.json`

The hard cell completed all 10 turns. The campaign then stopped as required, without launching or consuming the other three cells.

## Result

| Measure | Observed | Gate |
| --- | ---: | --- |
| Original candidates accepted | 6/10 (60%) | pass |
| Mechanical repairs | 1 | recorded separately |
| Model rewrites | 3 | pass (at most 4) |
| Deterministic fallbacks | 0 | pass |
| Final safety failures | 0 | pass |
| Duplicate-clue delivery turns | 0 | pass |
| Host visibility | 100% | pass |
| Mean configuration realization | 80% | **fail** (at least 90%) |
| Distinct host parts | 5 | pass |
| Mean original tutor latency | 7,716 ms | descriptive |
| Mean total tutor latency | 13,002 ms | descriptive |

The campaign therefore failed honestly on configuration realization. The aggregate four-cell gates are not evaluable because only the required hard cell ran.

The unstarted seeds remain unconsumed:

- `20260941` — Emberwick / premature closure
- `20260942` — Larkspur / low-trust skeptic
- `20260943` — Clockwork / diligent

## Failure clusters

Across original and recovery candidates, the deterministic audits recorded:

- `missing_selected_performance_tactic`: 3 occurrences on turns 4 and 7;
- `missing_selected_actorial_part`: 1 occurrence on turn 6;
- `missing_clarification_invitation`: 1 occurrence on turn 1;
- `verbatim_learner_echo`: 1 occurrence on turn 3.

Safety remained intact and no duplicate clue was delivered. The dominant remaining problem is therefore first-pass and recovery realization of the selected dramatic performance, not evidence leakage or clue transaction integrity.

## Semantic-recognition boundary

Before V21, two valid constructions found in saved Greyfen candidates were added as structural recognizers and tested with paraphrase families plus nearby negative controls:

1. a learner-facing option to ask, clarify, or unpack a clue, connection, term, word, or meaning;
2. dramatic counterpressure that combines a ready/easy/obvious judgment, a judgment object, a breaking/challenging action, and concrete scene evidence, independently of word order.

The already-generated candidates were then re-audited model-free. That result was correctly labelled an **audit-recognition improvement**, not a generation improvement.

These recognizers are less brittle than exact sentence whitelists, but they remain lexical. Adding scenario nouns or isolated phrasings whenever a held-out candidate fails would overfit the auditor and blur the difference between better generation and more permissive recognition. The next iteration should first inspect whether the selected performance is semantically present in the two failed delivered turns. If it is present, prefer a typed or compositional realization signal over another expanding regex. If it is absent, change the speaking/recovery contract and validate with frozen replay. Strict delivery and safety gates should remain unchanged.

## Claim boundary

V21 supports the duplicate-clue fix under one new held-out world/profile trajectory: 10/10 delivered turns were safe and 0/10 duplicated a due clue. It does not support broad first-draft generalization, because the hard cell failed the predeclared configuration-realization gate and the other three cells were deliberately not run.
