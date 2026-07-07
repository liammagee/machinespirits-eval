# E4a detector-split dry report

Frozen-artifact classification only. Registered run verdicts stand; this report labels what kind of non-grounding the existing mechanical trace most resembles.

| arm | verdict | guard | failure mode | split class | key evidence |
|---|---|---|---|---|---|
| `marrick-real-r1` | disengagement t21 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-real-r2` | disengagement t21 | `unguarded` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-real-r3` | aporia t12 | `unguarded` | `decay_seating_death` | `decay_starved_lucky_leap` | 2 unrepaired dropped premise(s) at end; 0 lucky leap(s), 1 overreach event(s); terminal learner text names dropped premise(s): m_caster, p_crucible |
| `marrick-real-r4` | aporia t8 | `unguarded` | `decay_seating_death` | `decay_starved_stall` | 2 unrepaired dropped premise(s) at end |
| `marrick-real-r5` | disengagement t21 | `unguarded` | `decay_seating_death` | `decay_starved_lucky_leap` | 2 unrepaired dropped premise(s) at end; 0 lucky leap(s), 1 overreach event(s); terminal learner text names dropped premise(s): p_caster |
| `marrick-guard-r1` | grounded_anagnorisis t22 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `marrick-guard-r2` | grounded_anagnorisis t22 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `marrick-guard-r3` | grounded_anagnorisis t22 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `marrick-guard-r4` | grounded_anagnorisis t22 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `marrick-guard-r5` | grounded_anagnorisis t22 | `pacing` | `grounded` | `grounded_control` | grounded verdict; no detector split applied |
| `marrick-visible-r1` | disengagement t21 | `visible` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_flaw@t12, p_graver@t16 |
| `marrick-visible-r2` | disengagement t21 | `visible` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_flaw@t12, p_graver@t16 |
| `marrick-visible-r3` | disengagement t21 | `visible` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-visible-r4` | disengagement t21 | `visible` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_graver@t16 |
| `marrick-visible-r5` | disengagement t21 | `visible` | `early_pull_death` | `tempo_starved_house` | tempo-insolvent tutor release(s): p_graver@t16 |

## Guard × failure-mode contingency

Counts over 15 classifiable arm(s). Keyed on mechanism, not terminal verdict shape.

| guard state | grounded | early_pull_death | decay_seating_death | n |
|---|---|---|---|---|
| `unguarded` | 0 | 2 | 3 | 5 |
| `pacing` | 5 | 0 | 0 | 5 |
| `visible` | 0 | 5 | 0 | 5 |
| **all** | **5** | **7** | **3** | **15** |

## Interpretation

Public failure modes (coarse, mechanism-keyed):

- `grounded`: recognition earned; the board carried the learner to the secret.
- `early_pull_death`: an exhibit was released before it was tempo-solvent (the house ran ahead of the board).
- `decay_seating_death`: an already-seated exhibit decayed unrepaired and the learner lost the thread.
- `aporia`: no licensed tutor-supply window existed when the dialogue stalled.
- `unresolved`: non-grounding with no registered split trigger.

Detailed split classes (the forensic axis the modes project from):

- `grounded_control`: negative-control survivor; no detector split applied.
- `tempo_starved_house`: a licensed tutor release was tempo-insolvent under the production D/stall arithmetic.
- `decay_starved_stall`: unrepaired decay left the board short, without repeated final overreach.
- `decay_starved_lucky_leap`: unrepaired decay left the board short while the learner kept asserting or deriving ahead of the board.
- `supply_starved_stall`: no licensed tutor-supply window existed in the terminal detector span.

