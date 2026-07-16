# Tutor-stub character generalization V17

## Outcome

V17 passed every predeclared strict gate in all four cells. The matrix was
declared in `config/tutor-stub-campaigns/character-generalization-v17.yaml`
before any model call. All cells ran the fixed configuration at functional
commit `c4772b9e`, with one job per cell, separate output directories, and no
code or setting changes between cells. At most three cells ran concurrently.

Strict working verification i26 also passed all eight character-loop gates:

`../../.tutor-stub-auto-eval/character-adaptation-loop/strict-working-primary-i26-2026-07-15T23-40-16-466Z/character-loop-result.md`

## Matrix results

| Cell | Turns | Stop | Proof-path coverage | Fallbacks | Delivery failures | Host visibility | Mean realization | Parts | Result |
|---|---:|---|---:|---:|---:|---:|---:|---:|---|
| Foxtrot / false memory | 6 | grounded closure | 1.000 | 0 | 0 | 1.000 | 0.916 | 3 | pass |
| AI syllabus / fast | 10 | turn cap | 1.000 | 0 | 0 | 1.000 | 0.950 | 3 | pass |
| Sealhouse / slow | 10 | turn cap | 0.667 | 1 | 0 | 1.000 | 1.000 | 2 | pass |
| Hethel resistant / low agency | 10 | turn cap | 0.200 | 1 | 0 | 1.000 | 0.967 | 3 | pass |

Every cell also recorded zero errors, quarantines, meta-performance turns,
role-stage-direction turns, source-replacement turns, and duplicate clue
deliveries. The lower proof-path coverage in the slow and low-agency cells is
an outcome measure, not a failed V17 safety or realization gate: those profiles
deliberately slow or delegate progress, and the fixed horizon was ten turns.

Generated reports:

- `../../.tutor-stub-auto-eval/character-adaptation-generalization-v17/foxtrot_false_memory/auto-eval-2026-07-15T23-54-45-819Z.html`
- `../../.tutor-stub-auto-eval/character-adaptation-generalization-v17/ai_syllabus_fast/auto-eval-2026-07-15T23-55-34-438Z.html`
- `../../.tutor-stub-auto-eval/character-adaptation-generalization-v17/sealhouse_slow/auto-eval-2026-07-15T23-56-42-000Z.html`
- `../../.tutor-stub-auto-eval/character-adaptation-generalization-v17/hethel_resistant_low_agency/auto-eval-2026-07-16T00-01-33-805Z.html`

## Residual candidate-level clusters

These counts describe rejected or repaired candidates, not unsafe messages
shown to the learner:

| Cluster | Occurrences | Cells |
|---|---:|---:|
| Selected performance tactic not visible enough | 13 | 3 |
| Selected actorial part not visible enough | 9 | 4 |
| Learner contribution not acknowledged before development | 7 | 3 |
| Missing clarification invitation | 6 | 2 |
| Exhibit not visibly handled | 3 | 1 |
| New clue stated too abstractly | 2 | 1 |

The remaining common weakness is therefore first-draft realization, especially
performance tactics and actorial parts. The delivery boundary is doing its job:
all such candidates were repaired or replaced before delivery. Two one-off
evidence-boundary failures also occurred in the held-out Hethel-resistant cell
and were blocked before delivery. Sealhouse and Hethel-resistant each needed
one deterministic fallback, within the declared cap; the other cells needed
none.

## Claim boundary

This is evidence that the host-part repair and response guards transfer across
four new simulated world/profile pairings, including a non-detective
curriculum and a previously unused resistant scenario. It is not evidence of
population-wide generalization or human learning effectiveness. The next
improvement target, if pursued, should be first-draft instruction adherence so
the same safe behavior depends less on repair, not a relaxation of the strict
delivery gates.
