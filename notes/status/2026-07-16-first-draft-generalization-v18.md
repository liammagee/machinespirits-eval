# First-draft generalization V18 result

## Verdict

**Failed acceptance.** The compact first-draft tutor contract transferred
cleanly to two held-out world/profile pairings, but not broadly enough to meet
the predeclared matrix gates. No unsafe candidate was delivered.

The frozen plan is
`config/tutor-stub-campaigns/first-draft-generalization-v18.yaml`. It tests
commit `28bdb897` with four fresh world/profile pairings and seeds that were not
used by the earlier V2-V17 campaigns. The strict working prerequisite passed
before any held-out seed was consumed.

## Results

| Cell | Turns | Result | Original accepted | Mechanical repair | Model rewrite | Fallback | Mean tutor generation |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Ravensmark / affective resistant | 6 | pass; grounded closure | 6/6 | 0 | 0 | 0 | 6,492 ms |
| Hethel / premature closure | 10 | pass; grounded closure | 5/10 | 2 | 3 | 0 | 10,205 ms |
| Emberwick / contradiction keeper | 9 | fail at terminal recovery | 5/9 | 2 | 2 | 0 | 10,135 ms |
| Skyway / answer seeking | 7 | fail at terminal recovery | 2/7 | 4 | 4 | 2 | 13,223 ms |
| **Total** | **32** | **2/4 cells passed** | **18/32 (56.25%)** | **8** | **9 (28.13%)** | **2** | **10,149 ms** |

The matrix passed its complete-turn accounting, aggregate model-rewrite, and
aggregate fallback ceilings. It failed:

- aggregate original-candidate acceptance: 56.25%, below the 70% gate;
- the Skyway per-cell first-draft floor: 28.57%, below the 50% gate;
- Skyway's per-cell fallback ceiling: two, above the maximum of one; and
- the requirement that all four strict cells complete successfully.

Ravensmark is the strongest transfer result: every original candidate passed,
the dialogue reached a grounded closure in six turns, and no repair or fallback
was used. Hethel met the exact 50% per-cell first-draft floor and closed safely.

## Failure clusters

Across all rejected candidates, the leading clusters were:

| Audit issue | All candidates | Original candidates | Recovery candidates | Cells affected |
| --- | ---: | ---: | ---: | ---: |
| Selected performance tactic not visible | 12 | 7 | 5 | 4 |
| Selected actorial part not visible | 11 | 8 | 3 | 3 |
| Learner contribution not visibly taken up | 4 | 3 | 1 | 3 |
| Generic learner uptake | 3 | 0 | 3 | 1 |
| Unreleased premise content | 1 | 1 | 0 | 1 |
| Verbatim learner echo | 1 | 1 | 0 | 1 |

The failures are therefore not a safety-gate regression. They are principally
a realization and recovery problem: the model often omitted the selected
character action, and Skyway's repair candidates repeated the same omissions
rather than moving into a simpler safe form.

Skyway stopped on turn seven after original, policy-repair, composition-repair,
plain-recovery, and deterministic fallback attempts could not produce a reply
that both answered the learner concretely and satisfied the selected shared
scene tactic. The final fallback was rejected for generic learner uptake.

Emberwick stopped on turn nine after the learner had stated the correct final
answer. Its fallback was rejected because it echoed the learner verbatim and
did not enact the selected performance tactic. This is a distinct terminal
acknowledgement/closure defect, although it shares the broader realization
cluster.

## Evidence

- Strict working prerequisite:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-realization/strict-working-i36/character-loop-result.json`
- Ravensmark:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v18-live/ravensmark_affective_resistant/auto-eval-2026-07-16T04-48-59-412Z.json`
- Hethel:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v18-live/hethel_dogmatic_premature_closure/auto-eval-2026-07-16T04-57-50-848Z.json`
- Emberwick:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v18-live/emberwick_contradiction_keeper/auto-eval-2026-07-16T04-51-58-062Z.json`
- Skyway:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v18-live/skyway_answer_seeking/auto-eval-2026-07-16T04-49-58-006Z.json`

## Next iteration

Do not reuse V18's held-out seeds after changing the implementation. The next
coordinated change should:

1. make the selected part and tactic executable in the original contract rather
   than merely named;
2. give recovery a deliberately simpler contract that cannot repeat the failed
   original realization strategy;
3. add dedicated answer-seeking and correct-answer closure tests; and
4. pass the strict working trajectory before a new V19 matrix with newly
   predeclared pairings and seeds.

This result supports a narrower claim: first-draft realization can be excellent
in some held-out trajectories, but the improvement has not yet generalized
reliably across learner interaction patterns.
