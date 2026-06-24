# D4 SEL Disposition-Gradient Replication

Generated: 2026-06-24T20:58:00.287Z
Run ID: `eval-2026-06-24-250c6251`
Database: `/Users/lmagee/.machinespirits-data/evaluations.db`

## Design

- Profiles: cells 40-45, dialectical ego plus divergent superego dispositions.
- Scenarios: all eight SEL scenarios from `content-test-sel/scenarios-sel.yaml`.
- Density: 6 profiles x 8 scenarios x 3 runs = 144 rows.
- Generator: Haiku 4.5 family as stored on the run rows.
- Judge: Sonnet CLI, stored as `claude-code/sonnet`.
- Primary metric: `tutor_first_turn_score`, recognition minus base within each disposition pair.
- Gate: pass only if all three deltas are positive and the effect-size ordering is suspicious > adversary > advocate.

## Score Audit

- Rows: 144; successful generations: 144; scored first turns: 144; unscored: 0.
- Judge models: claude-code/sonnet=144.
- Scoring note: the standard evaluator supplied the initial Sonnet scores; remaining first-turn rows were filled with `scripts/score-d4-first-turns.js`, which reuses the project v2.2 first-turn prompt builder and writes through `evaluationStore`.

## Primary Result

| Disposition | N base / recog | Mean base (SD) | Mean recog (SD) | Delta | Cohen d |
|---|---:|---:|---:|---:|---:|
| suspicious | 24 / 24 | 56.8 (20.1) | 73.9 (12.1) | 17.1 | 1.03 |
| adversary | 24 / 24 | 60.7 (11.1) | 68.0 (16.8) | 7.3 | 0.52 |
| advocate | 24 / 24 | 54.5 (17.7) | 69.8 (15.6) | 15.4 | 0.92 |

Delta ordering: suspicious 17.1; adversary 7.3; advocate 15.4.
Effect-size ordering: suspicious d=1.03; adversary d=0.52; advocate d=0.92.

Gate verdict: **scope-bound**.

D4 is scope-bound: all recognition deltas are positive, but the suspicious > adversary > advocate ordering does not hold monotonically.

## Scenario-Level Deltas

| Scenario | Susp delta | Adversary delta | Advocate delta |
|---|---:|---:|---:|
| feelings_confusion | 7.1 | 1.2 | 6.2 |
| interpersonal_conflict | 14.6 | 15.8 | -6.3 |
| new_sel_student_first_visit | 0.4 | 0.4 | 6.2 |
| returning_sel_student_mid_course | 19.2 | 13.8 | 17.5 |
| sel_frustration_to_breakthrough | 23.3 | 16.2 | 10.8 |
| sel_misconception_correction | 14.6 | 14.6 | 8.3 |
| sel_productive_deadlock | 34.2 | -16.2 | 36.7 |
| struggling_sel_student | 23.3 | 12.9 | 43.3 |

## Interpretation

The architecture-matched SEL replication supports a broad recognition benefit: every disposition pair improved under recognition prompting. It does not support the stronger monotone struggle-gradient claim on SEL, because advocate improved more than adversary. The paper should treat the earlier philosophy ordering as domain-sensitive rather than universal.

What D4 adds to Paper 2.0: it turns the earlier D4 gate from an unrun optional replication into direct SEL evidence. The collective claim is now sharper: recognition helps across hostile, adversarial, and advocate dispositions in SEL, but the exact suspicious > adversary > advocate ordering is not stable across domain.

