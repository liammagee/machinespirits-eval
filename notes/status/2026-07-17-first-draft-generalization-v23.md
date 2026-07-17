# First-draft generalization V23

Date: 2026-07-17  
Status: failed at the predeclared hard cell; remaining held-out seeds unconsumed

## Frozen acceptance

- Campaign: `first-draft-generalization-v23`
- Frozen Git commit: `735f4010e3d5d43a028c1c2008364fb571368c58`
- Frozen config SHA-256:
  `bbc016d14d2956516f24298be0e945cf6ac343c403f6efb0c730a649aa147b30`
- Hard cell: `world_005_marrick` / `answer_seeking`
- Consumed seed: `20261120` (failed and retired)
- Unconsumed seeds: `20261121`, `20261122`, `20261123`
- Campaign result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v23-live/campaign-result.json`
- Hard-cell report:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v23-live/marrick_answer_seeking/auto-eval-2026-07-16T14-34-17-161Z.json`

The runner completed Marrick before assessing it, then stopped without launching
Fengate, Lantern, or Bitterwell because the required hard cell failed. No code,
configuration, or gate changed after the held-out call began.

## Result

| Measure | Observed | Gate | Result |
| --- | ---: | ---: | --- |
| Fully accounted turns | 10/10 | 10/10 | pass |
| Strict originals | 8/10 | at least 6/10 | pass |
| Ordinary originals delivered | 9/10 | reported separately | — |
| Mechanical-repair turns | 1 | reported separately | — |
| Model-rewrite turns | 1 | at most 4 | pass |
| Deterministic fallbacks | 0 | at most 1 | pass |
| Final safety failures | 0 | 0 | pass |
| Quarantines / errors | 0 / 0 | 0 / 0 | pass |
| Host visibility | 1.000 | at least 1.000 | pass |
| Distinct host parts | 4 | at least 2 | pass |
| Mean six-axis configuration realization | 0.833 | at least 0.900 | **fail** |
| Mean original latency | 8,185 ms | descriptive | — |
| Mean total tutor latency | 9,117 ms | descriptive | — |

All strict delivery gates passed except configuration realization. V23
therefore failed, and its aggregate status is also failed because all four
predeclared cells were required.

## What changed before this run

- **Speaking generation:** the ordered public-only `OPEN -> DEVELOP -> END`
  contract and counterpressure boundary from `0c14c320` were unchanged during
  acceptance.
- **Recovery:** the one-call plain public-only recovery plus deterministic
  fallback remained unchanged. V23 used one plain model recovery, followed by
  one mechanical composition repair on the same turn; it used no fallback.
- **Audit recognition/accounting:** `fae0411d` changed measurement only. It
  enforced the declared 10/10 accounting gate and separated ordinary original
  delivery from a strict original that also realizes the selected part and
  tactic. It did not alter the tutor response or weaken a delivery check.

## Failure clusters

The hard cell showed three candidate-level failure families:

- missing selected performance tactic: two turns; one remained an advisory
  delivered original and one coincided with a hard clue-enactment failure;
- role-label/stage-direction clue delivery: one original candidate;
- missing first-person in-scene enactment: the same original candidate.

The turn with the hard clue-enactment failure was recovered safely. The final
delivered transcript contained no meta-performance, role-stage-direction,
source-replacement, duplicate-clue, quarantine, or final-audit failure.

The failed trajectory gate was broader than those recovery events. Final
per-axis visibility was:

| Axis | Visibility |
| --- | ---: |
| Engagement stance | 0.90 |
| Action family | 0.90 |
| Audience register | 0.80 |
| Lexical accessibility | 0.60 |
| Scene immersion | 1.00 |
| Actorial part and tactic | 0.80 |

Lexical accessibility was the dominant miss, followed by audience register and
actorial realization. Pairwise visible-difference rate was 1.00, so the problem
was not that all turns looked identical; several selected configurations were
only partly realized, especially when `plain` or `adult_novice` was selected.

## Interpretation

This is meaningful progress over V22's hard-cell failure. On a fresh difficult
Marrick trajectory, the revised speaker produced eight strict originals, used
recovery on only one turn, never fell back, and remained safe. That supports a
narrow claim that first-draft uptake and actorial generation improved on this
held-out cell.

It does **not** establish matrix-wide generalization. The predeclared 0.90
six-axis gate failed, so the other three pairings correctly remain untested and
their seeds remain unconsumed. The next development target is transcript-visible
realization of plain language, audience level, and the selected actorial tactic;
the strict gate should not be loosened or reclassified to convert V23 into a
pass.
