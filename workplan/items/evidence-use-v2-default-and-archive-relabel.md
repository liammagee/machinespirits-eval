---
id: evidence-use-v2-default-and-archive-relabel
title: Make v2_bridge_voiced the default evidence_use rubric and relabel the archive under it
status: active
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

Measured directly, not estimated: the archive at `~/.machinespirits-data/program-2/`
holds **2,363** classifier calls (`type === 'model_call'`,
`role === 'tutor_stub_learner_analysis'`) across four phases, from a **single**
judge family (`codex/gpt-5.6-terra`, one draw each), covering **1,135** turns
where `warrant_skip` fired. Stored v1 label distribution: `omits_warrant` 614,
`overleaps_evidence` 521, `cites_public_evidence` 454, `links_evidence_to_rule`
452, `none` 131, `revises_from_evidence` 70, `distorts_public_evidence` 62,
`repeats_setup` 41.

The relabel is single-substitution surgery, not state re-derivation. The v1
precedence line appears in `request.prompt` exactly once in all 2,363 records
(zero in `systemPrompt`, zero absent, zero duplicated — checked). Swap that one
line for v2's five, re-issue to the same provider and model, and everything else
is held identical by construction because it is replayed from the stored record.
The tool asserts exactly-one-occurrence before substituting and refuses the
record otherwise, so a drifted prompt fails loudly instead of being relabelled
under a false premise.

Runs on shared Max-plan quota, so: stratified slice with real calls first,
measured per-call latency, then a resumable full sweep with checkpointing.

## What the relabel does to the distillation pipeline

Worked through in `notes/program-2/2026-07-26-v2-relabel-distill-path.md`. Three
findings that constrain the next step:

- The frozen corpora survive. `general-sft.jsonl` (865 rows) and `kto.jsonl`
  (1,676 rows) key on deterministic guard accounting with no classifier in the
  path, so they do not move. Only `taskA-sft.jsonl` and `eval-moments.jsonl`
  change, and only in membership. Re-deriving that membership is a zero-call
  recomputation, since `assignedTrigger()` is pure and `poa.inputs` stores its
  arguments verbatim.
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
two-family consensus target. The archive is single-family, so a consensus target
requires a second judge pass (4,726 calls plus adjudication on disagreements)
and that is a separate decision about what the labels are for. Within-model
majority voting on the disagreeing subset answers the label-stability question
at roughly a third of the price.
