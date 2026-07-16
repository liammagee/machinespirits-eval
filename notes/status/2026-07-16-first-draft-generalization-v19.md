# First-draft generalization V19 result

## Verdict

**Failed acceptance.** The revised first-draft contract and distinct plain
recovery transferred cleanly to the Gazette and Foxtrot cells, but the matrix
missed its aggregate and per-cell first-draft gates. No unsafe candidate was
delivered.

The frozen plan is
`config/tutor-stub-campaigns/first-draft-generalization-v19.yaml`. It pins
implementation commit `9a1bfa8f`, four previously unused world/profile
pairings, and seeds `20260920`–`20260923`. Strict working seed `20260714`
passed before any V19 seed was consumed with 8/10 original candidates, two
model rewrites, no fallback, and every strict delivery gate passing.

## Results

| Cell | Turns | Result | Original accepted | Mechanical repair | Model rewrite | Fallback | Mean tutor generation |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Greyfen / answer seeking | 10 | fail; turn cap, no coverage | 0/10 | 2 | 6 | 2 | 19,584 ms |
| Larkspur / premature closure | 5 | fail; grounded closure, first-draft floor | 2/5 | 1 | 2 | 0 | 11,635 ms |
| Gazette / affective resistant | 9 | pass; grounded closure | 7/9 | 0 | 2 | 0 | 8,380 ms |
| Foxtrot / diligent | 5 | pass; grounded closure | 4/5 | 1 | 0 | 0 | 6,232 ms |
| **Total** | **29** | **2/4 cells passed** | **13/29 (44.83%)** | **4** | **10 (34.48%)** | **2** | **12,434 ms** |

The matrix passed complete-turn accounting, the aggregate deterministic
fallback ceiling, and every final-delivery safety check. It failed:

- aggregate original-candidate acceptance: 44.83%, below the 70% gate;
- aggregate model-rewrite delivery: 34.48%, above the 30% gate;
- Greyfen and Larkspur's 50% per-cell original-candidate floors;
- Greyfen's per-cell rewrite and fallback ceilings;
- Greyfen's host-visibility and configuration-realization gates; and
- the requirement that all four cells pass.

## Failure clusters

Greyfen dominates the failure. Its answer-seeking learner asked `What should I
write next?` every turn. Eight original candidates supplied a concrete
`Write: ...` line, but the response-composition auditor did not recognize that
narrow directive as a direct answer. Some of those candidates also genuinely
missed the selected advocate or counterpressure realization, but the repeated
uptake false negative made the observed 0/10 original rate substantially more
severe than the transcripts warrant.

Across original candidates, the leading hard issues were:

| Audit issue | Original candidates | Cells affected |
| --- | ---: | ---: |
| Learner contribution not visibly taken up | 8 | 1 |
| Selected actorial part not visible | 5 | 2 |
| Selected performance tactic not visible | 5 | 2 |
| Clue release opaque / exhibit action missing | 2 each | 1 |
| Missing clarification invitation | 1 | 1 |
| Unsupported evidence correspondence | 1 | 1 |
| Missing explicit dialogue close | 1 | 1 |

The recovery redesign itself worked. Trace provenance records the selected and
delivered configurations separately. Larkspur's terminal plain recovery moved
from a brisk, technical foreperson/evidentiary-boundary configuration to a
plain, grounded foreperson/unadorned-report configuration, avoided the policy
repair's unsupported claim, and closed safely.

Greyfen's two fallbacks were narrower auditor/prompt mismatches:

- a plain examiner recovery used `I point ...`, which the prompt and examiner
  audit allow but the unadorned-report tactic detector did not recognize; and
- another began `Write: ...` in direct response to `What should I write next?`,
  but the composition detector again treated it as missing uptake.

## Evidence

- Strict working prerequisite:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-realization/strict-working-i37-live/character-loop-result.json`
- Greyfen:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v19-live/greyfen_answer_seeking/`
- Larkspur:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v19-live/larkspur_premature_closure/`
- Gazette:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v19-live/gazette_affective_resistant/`
- Foxtrot:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v19-live/foxtrot_diligent/`

## Next iteration

V19's seeds are retired for acceptance after any implementation change. The
smallest coordinated next change should:

1. recognize the narrow pairing of a learner request for the next written line
   and a substantive `Write:`, `Record:`, or `Enter:` answer;
2. align unadorned-report detection with the examiner prompt by recognizing
   direct pointing, comparison, inspection, and marking actions;
3. add cross-domain natural advocate/counterpressure examples only where the
   wording genuinely makes and tests the strongest public case; and
4. pass strict working verification before a fresh V20 matrix with newly
   predeclared pairings and seeds.

V19 supports two narrower claims: first-draft enactment now transfers well in
some contemporary and archival worlds, and the simpler recovery strategy is
genuinely different. It does not yet support broad first-draft generalization
across repetitive answer-seeking behavior.
