---
id: evidence-use-v2-default-and-archive-relabel
title: Make v2_bridge_voiced the default evidence_use rubric and relabel the archive under it
status: done
type: infra
priority: P2
owner: unassigned
source: manual
created: 2026-07-26
updated: 2026-07-26
verification: New Program 2 plans stamp v2_bridge_voiced and carry no rubric
  flag; naming v1 recovers the pre-change command set token-for-token and the
  pre-change classifier prompt byte-for-byte; a plan file with no stamp fails
  validation rather than being resolved against the current default; the relabel
  pass proves exactly one v1 precedence line per archived prompt before
  substituting, holds provider/model/history identical, and reports the
  label-migration matrix against the stored v1 labels.
claim_status: exploratory
depends_on:
  - evidence-use-bridge-rubric-v2
links:
  code:
    - services/tutorStubPublicLearnerAnalysis.js
    - services/tutorStubPointOfActionCoaching.js
    - scripts/run-program2-live-pilot.js
  items:
    - evidence-use-bridge-rubric-v2
    - program-2-context-vs-weights-finetune
  notes:
    - notes/program-2/2026-07-26-v2-relabel-distill-path.md
    - notes/program-2/2026-07-26-relabel-sample-result.md
tags:
  - tutor-stub
  - classifier
  - program-2
  - instrument
  - fine-tune
---

The parent item versioned the `evidence_use` rubric and left `v1` as the
default, which is what made it safe to land mid-arc. This item spends that
option. Two things happen: new runs measure the construct we can state, and the
archived classifier calls are re-asked under it so they can serve as labels.

## Why flip

`omits_warrant` reproduced across judge families 26.2% of the time; the
one-clause repair ("the bridge must be voiced in this turn") lifted that to
78.6%, weighted κ 0.583. Keeping a near-coin-flip label as the default because
it is the incumbent only widens the span of runs that have to be discarded
later. The classifier seat's output is not decorative: `evidence_use` is the sole
input to `warrant_skip`, which decides whether the tutor speaks at all.

The cost is stated rather than absorbed. Absolute compliance rates computed after
the flip run about 1.1 points below the published Phase 5/5b/5c figures for
identical tutor behaviour, because the repaired rubric quiets the turn family
that limits its own inference (n=195 of 1,281 graded turns, 34.4% vs the bare-
conclusion family's 27.3%, pooled 28.4%) and so drops the easiest 15.2% of the
denominator. Between-arm gaps (+0.236 Phase 5b, +0.202 Phase 5c) survive, since
both arms lose the same turns. Absolute levels across versions must never be
pooled, and the per-run stamp is what makes that a check rather than a memory.

Flipping the default creates one hazard the parent item did not have: plan files
already on disk carry no stamp. Resolving an absent stamp against the *current*
default would silently relabel that history as v2. So `v1` is pinned as
`TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY`, unstamped plans resolve to it, and they
then fail validation on purpose — re-running one has to name its rubric.

## Correction carried from the parent item

The parent card and PR #270 describe `overleaps_evidence` as a within-prompt
control. It is not one. `warrant_skip` fires on **two** labels —
`omits_warrant` and `overleaps_evidence` (`services/tutorStubPointOfActionCoaching.js`)
— so `overleaps_evidence` sits inside the causal path under study, and because
the labels are one mutually-exclusive choice, redefining the `omits_warrant`
boundary can move mass across it. Only `distorts_public_evidence` is clean: its
wording is byte-identical across versions and it never routes. Byte-identity
still bounds the textual claim (the edit touched only the clause it advertises);
it does not bound the behavioural one.

## Relabelling the archive

**Two archives, and the training one is the sibling.** Checked against
`datasets/v1/extraction-report.json` rather than assumed: the entire v1 training
corpus was extracted from `~/.machinespirits-data/step4-claim-runs-2026-07/` (80
dialogues, 2,076 turns, 645 trigger moments, all 141 Task A rows).
`~/.machinespirits-data/program-2/` holds the live-phase archive (5, 5b, 5c, 5d),
which is eval and monitoring data. Relabelling only the second would hand
monitoring a v2 denominator while leaving the training corpus at v1 — the exact
cross-version mixing this item exists to prevent. Measured directly:

| archive | classifier calls | relabellable | role |
|---|---|---|---|
| `step4-claim-runs-2026-07/` | 2,585 | 2,555 | the training corpus |
| `program-2/` (phases 5–5d) | 2,363 | 2,345 | live-phase eval and monitoring |
| total | 4,948 | 4,900 | |

Both are `type === 'model_call'`, `role === 'tutor_stub_learner_analysis'`, from a
**single** judge family (`codex/gpt-5.6-terra`, one draw each). The live-phase
archive covers **1,135** turns where `warrant_skip` fired; stored v1 label
distribution there: `omits_warrant` 614, `overleaps_evidence` 521,
`cites_public_evidence` 454, `links_evidence_to_rule` 452, `none` 131,
`revises_from_evidence` 70, `distorts_public_evidence` 62, `repeats_setup` 41.

The relabel is single-substitution surgery, not state re-derivation. The v1
precedence line appears in `request.prompt` exactly once in every relabellable
record in both archives (zero in `systemPrompt`, zero duplicated — checked via
`--plan`). Swap that one line for v2's five, re-issue to the same provider and
model, and everything else is held identical by construction because it is
replayed from the stored record. The tool asserts exactly-one-occurrence before
substituting and refuses the record otherwise, so a drifted prompt fails loudly
instead of being relabelled under a false premise. It reaches the step4 archive
with `--archive`, no code change.

Runs on shared Max-plan quota, so: stratified slice with real calls first,
measured per-call latency, then a resumable full sweep with checkpointing. The
16-record pilot ran 16/16 with zero failures at 7.0s/call, concurrency 2, which
puts the two full sweeps at ≈149 minutes (step4) and ≈136 minutes (live phase).
Run step4 first — it is the corpus that feeds training.

## What the relabel does to the distillation pipeline

Worked through in `notes/program-2/2026-07-26-v2-relabel-distill-path.md`. Four
findings that constrain the next step:

- The relabel has to cover both archives, and the one that matters for training
  is the step4 sibling, not `program-2/` (see above). This is the finding that
  changes the plan; everything else is downstream of it.
- The frozen corpora survive. `general-sft.jsonl` (865 rows) and `kto.jsonl`
  (1,676 rows) key on deterministic guard accounting with no classifier in the
  path, so they do not move. Only `taskA-sft.jsonl` and `eval-moments.jsonl`
  change, and only in membership. Re-deriving that membership is a zero-call
  recomputation, since `assignedTrigger()` is pure and `poa.inputs` stores its
  arguments verbatim. Task A is small — 141 rows split 105/21/15, with 61
  held-out eval moments — so a membership shift that would round to nothing on
  the general corpus is not negligible there.
- Turns that were silent under v1 and fire under v2 are a counterfactual
  population: the recorded reply was produced without the side-coach block, so
  they cannot be Task A positives and their historical compliance is not a
  like-for-like baseline. Excluding them is the defensible default.
- The pilot slice was stratified uniform (12.5% per label against an archive
  that runs 26.2%/22.2% on the firing pair), so its gate-firing share is 25.0%
  against the archive's 48.4%. Its rate went *up*, the denominator analysis
  predicts *down*. The pilot cannot settle the direction and must not be cited
  as confirming or refuting the ~1.1 point figure — only the full sweep can.

Two ideas were checked and dropped: collapsing the target to the binary the gate
consumes does not absorb the label noise (5 of 6 pilot changes crossed the
boundary, 0 stayed inside the firing pair — 31.3% vs 37.5%), and
`distorts_public_evidence` is a textual control only (byte-identical clause, both
pilot cases still moved into the firing pair).

Deliberately not in scope: distilling the local writer model against a
two-family consensus target. Both archives are single-family, so a consensus
target requires a second judge pass over all 4,900 records (9,800 calls before
any training, plus adjudication on disagreements) and that is a separate
decision about what the labels are for. Cross-family agreement measures the
instrument; within-model majority voting on the disagreeing subset measures the
label, and buys the second question at a fraction of the price.

Also not in scope here: choosing which of the two seats gets trained. The
relabelled corpus is training data for the classifier seat (which decides *when*
the tutor speaks) and only a denominator change for the writer seat (which
decides *what it says*, and owns the +0.236/+0.202 Phase 5b/5c gaps). The
existing `PROGRAM-2-FINETUNE-PLAN.md` Tasks A and B are entirely writer-seat, so
a local classifier is a new task rather than a continuation of that plan. Both
options need the full sweep's numbers before either can be pre-registered.

## Outcome: the flip landed, the full sweep is declined

The default flip shipped in PR #272. The archive relabel was then run as a
proportionate slice instead of a full sweep, and the slice closed the question
against it. Full numbers in
`notes/program-2/2026-07-26-relabel-sample-result.md`; 400 records drawn
uniformly from the step4 training archive with the new `--sample`, 398 usable,
23 minutes.

The result is that the instrument's own re-draw variance swamps the edit. Records
whose stored label was *not* `omits_warrant` — where the v2 clause cannot apply —
changed 39.4% of the time (111/282), against 45.7% (53/116) where it does apply.
41 records moved *into* `omits_warrant` from byte-identical clauses, a direction a
tightening edit cannot produce, against 53 moving out. `cites_public_evidence`
retains 32.9% of itself. The gate-level shift was −3.27 points, SE 2.42, 1.35 SE
from zero: right direction, not separable from nothing at this n.

So the earlier bullet above — "only the full sweep can" settle the direction — is
retired rather than satisfied. The full sweep at n=4,900 would reach SE ≈ 0.9 and
could resolve a 3-point shift, but that number is denominator bookkeeping, and the
corpus is unusable as labels either way: a per-turn target that is roughly 60%
stable to a re-ask cannot be trained against, and majority-of-k over three draws
that noisy is not the repair it looks like.

This closes the classifier seat on this instrument. It does not touch the v2 flip,
which rests on a different measurement (cross-family agreement on a defined
held-out set, 26.2% → 78.6%, weighted κ 0.583) asking a different question. It
does not touch the writer seat. The next piece of work for a local *when to
intervene* model is not labels at all — nothing currently grades the gate's
decisions, so a local gate could not be scored against the frontier one even with
a perfect corpus.

Reusable residue: `--sample` in `scripts/relabel-program2-evidence-use.js`. The
tool shipped with two selectors that are both deliberately biased (`--limit` takes
directory order, which is one phase and its earliest dialogues; `--stratify`
balances the rare labels on purpose), so neither can produce a rate that stands
for the archive.
