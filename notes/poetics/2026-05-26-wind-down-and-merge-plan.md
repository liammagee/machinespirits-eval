# Wind-Down And Merge Plan For Dramatic Recognition Branch

Date: 2026-05-26

Status: merge-prep note for `experiment/dramatic-recognition`.

## Decision

Wind down the broad generation/evaluation loop now.

The branch has enough evidence for a bounded mechanism story, and the most
recent D54-D57 anchor search is no longer the best use of time or tokens. The
D54-D57 preview is useful as a cheap rejection screen, not as a reason to keep
expanding the search space.

## Current Claim Boundary

Keep these claims:

1. **Public recognitive reframe works under clean controls.** Explicit public
   learner reframe remains the strongest recognitive-form result.
2. **Mechanism-level tutor adaptation is now real in the sidecar.** In the
   D42/D50/D53 clean-anchor replication, `peripeteia-only` reliably triggered
   branch-valid tutor adaptation while `routine` and `none` did not.
3. **Actional breakthrough is separate from recognitive closure.** A learner can
   perform a new device without narrating a full self-reframe.
4. **Recognitive closure remains downstream and critic-sensitive.** It should
   not be the main success criterion for tutor adaptation.
5. **Ending-shape constraints help but do not solve organic-control leakage.**
   The stratified ending-shape run shows stronger peripeteia arms but also
   organic recognition in controls.

Do not claim:

- that the sidecar is already a deployed mechanical adaptive tutor;
- that peripeteia normally produces robust recognitive self-reframe;
- that D54-D57 are improved clean anchors;
- that more broad generation is likely to clarify the current claim boundary.

## Stop Condition

The branch should stop before another five-critic spend unless a future run has
a hard-gated design that passes all cheap criteria first:

- routine and no-cue arms are flat under quality/origin screening;
- peripeteia-only is `peripeteia_induced` under cheap screening;
- no branch has quality warnings;
- the candidate adds something not already covered by D42/D50/D53.

The latest D54-D57 preview fails that standard. D54, D55, and D56 remain
boundary or leakage cases, and D57 needs a redesigned target mechanism.

## What To Preserve In The Merge

Preserve:

- source specs under `config/poetics-calibration/*.yaml`;
- phase design/finding/progress notes under `config/poetics-calibration/*.md`;
- corpus/source seed material under `config/poetics-calibration/corpus/` and
  `config/poetics-calibration/sources/`;
- poetics scoring, generation, report, ingest, browser, and cleanup scripts;
- tests for poetics generation, scoring, reporting, origin diagnostics, quote
  cleanup, and tutor-adaptation analysis;
- `notes/poetics/` synthesis and status notes;
- the HTML synthesis artifact, because it is the readable branch handoff.

Prune from Git before merge:

- generated `deliberation/` JSON;
- generated `transcripts/`;
- generated public `sample/` scripts;
- generated critic `scores/`;
- generated `structure-critic/` outputs;
- per-run `batch-plan.json`;
- per-run `key.yaml` and `key-*.yaml`;
- top-level generated `phase2-sample*`, `phase2-deliberation*`, and
  `phase2-d42-readable-projection-v1` artifact folders.

Ignored `exports/` reports may remain locally for inspection, but they should
not be merged unless a small curated report is explicitly promoted into
`notes/poetics/`.

## Merge-Ready Summary

After pruning raw bulk, the branch should merge as:

- mechanism tooling;
- deterministic diagnostics;
- critic/origin scoring support;
- reusable dramatic-generation sidecar;
- bounded theory/status notes;
- no committed raw transcript/deliberation/score archive.

The next phase should be distillation, not generation: mechanism specification,
state-action-outcome labels, curated exemplars, and eventual integration into a
real tutor control loop.
