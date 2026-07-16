# First-draft generalization V22

Date: 2026-07-16  
Status: failed at the predeclared hard first cell; remaining seeds unconsumed

## Frozen run

- Campaign: `first-draft-generalization-v22`
- Frozen commit: `42febc6058599c20480fb838e618eaeb7a7e8f91`
- Implementation commit: `5a14c3a3`
- Frozen config SHA-256: `2a9bec38b4fce234db2ef50075a03b2a3ad9843af718b4d55631e8cfb7e3ab07`
- Hard first cell: `world_001_nocturne` / `answer_seeking`
- Seed: `20260960` (consumed and retired)
- Report: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v22-live/nocturne_answer_seeking/auto-eval-2026-07-16T09-40-35-475Z.json`
- Campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v22-live/campaign-result.json`

The hard cell completed all ten turns under the frozen V22 code and config.
Because it failed one required per-cell gate, the campaign stopped as
predeclared. No other cell was launched, so there was no safe remaining work to
parallelize.

## Result

| Measure | Observed | Gate |
| --- | ---: | --- |
| Original candidates accepted | 6/10 (60%) | pass (at least 60%) |
| Mechanical repairs | 1 | recorded separately |
| Model rewrites | 3 | pass (at most 4) |
| Deterministic fallbacks | 0 | pass |
| Final safety failures | 0 | pass |
| Duplicate-clue delivery turns | 0 | pass |
| Host visibility | 100% | pass |
| Mean configuration realization | 78.3% | **fail** (at least 90%) |
| Distinct host parts | 4 | pass |
| Mean original tutor latency | 7,687 ms | descriptive |
| Mean total tutor latency | 10,951 ms | descriptive |

The aggregate four-cell gates are not evaluable because only the required hard
cell ran. The unstarted seeds remain unconsumed:

- `20260961` — Sealhouse / premature closure
- `20260962` — Emberwick / low-trust skeptic
- `20260963` — AI Syllabus / diligent

## What improved

The hard answer-seeking cell reached the exact original-candidate threshold:
six original drafts were accepted, including all five final turns. No response
used deterministic fallback, crossed the private evidence boundary in final
delivery, duplicated a clue, broke source perspective, or exposed role-play
machinery. The typed pressure contract was visibly realized by the accepted
charismatic advocate turns.

This is a meaningful improvement over V21's Gazette trajectory, but it does not
pass V22 because original acceptance is only one of the frozen gates.

## Why the cell failed

Four early original candidates required intervention:

- turn 2 missed the selected dramatic-counterpressure tactic;
- turn 3 did not visibly perform the selected evidence-examiner part;
- turn 4 triggered the evidence guard on the public words `beside` and
  `corrections`, which weakly overlapped a future premise even though
  corrections were already present in the opening and learner question;
- turn 5 missed the selected shared-scene-invitation tactic.

The delivered responses remained safe, but their complete six-axis
configuration was not consistently visible. In particular:

- turns 4 and 5 realized 4/6 axes;
- turns 7 and 9 realized 3/6 axes;
- turn 10 realized 4/6 axes;
- turns 7, 9, and 10 passed the actorial check but missed audience-register or
  lexical-accessibility thresholds, and turn 7 also missed the selected action
  family.

The result therefore identifies two distinct remaining problems rather than a
single character-tactic failure:

1. early first drafts still sometimes omit the selected part or tactic; and
2. the all-axis realization measure is pulled down by audience, language, and
   action visibility even when the character performance succeeds.

The turn-4 evidence-guard hit should also be audited separately as a possible
recognition false positive. It must not be counted as generation improvement
unless a model-free re-audit establishes that the candidate used only already
public meaning.

## Claim boundary

V22 supports a narrower conclusion: under a fresh, difficult Nocturne /
answer-seeking trajectory, the typed speaking contract reached 6/10 accepted
originals while preserving perfect final safety and avoiding fallback. It does
not support broad first-draft generalization because the hard cell failed the
predeclared configuration-realization gate and the other three cells were
correctly left unrun.
