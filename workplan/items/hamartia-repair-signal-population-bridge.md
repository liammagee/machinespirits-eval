---
id: hamartia-repair-signal-population-bridge
title: Build the durable-repair signal for the ontology population bridge
status: review
type: research
priority: P2
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Frozen public-text-v1 positive, negative, and ambiguous cases
  classify exactly as repaired, not_repaired, and indeterminate; every loop item
  emits the tri-state block without changing the gate; only repaired summaries
  populate HamartiaRepairStage; synthetic ontology closure derives scaffolded
  repair, self repair, and repair without recognition credit; legacy bridge
  output and the opt-in module boundary remain unchanged; focused offline tests
  and the workplan source check pass.
claim_status: methods
links:
  notes:
    - notes/poetics/2026-06-04-adaptation-correction-next-steps.md
    - services/ontology/adaptationAboxBridge.js
    - services/ontology/hamartiaRepairDetector.js
tags:
  - ontology
  - adaptation
  - codex-sol
  - effort-ultra
branch: codex/hamartia-repair-signal-population-bridge
---

The population bridge reproduces its three adaptation rules on 9 of 9 real
cells, but the whole correction axis is dead for want of one signal. The
bridge source says it plainly: there is no durable-repair signal in the gate,
so the repair keystone (repair without recognition credit) and the
scaffolded-versus-self repair origin fire only on a worked fixture.

The 2026-06-04 next-steps note gives three candidate definitions of durable
repair in rising ambition and names the exact plumbing: emit a repair block
from the item summarizer, extend the abox bridge to assert the repair stage,
add the axes to the reconcile script's derivable set. Build the least
ambitious definition (public-text rule) first; the stronger definitions stay
future options. Keep the module opt-in, and keep the framing generative — this
is scaffolding, not a measurement-improvement claim.

Suggested worker: Codex Sol at Ultra reasoning effort — one design pick, then
bounded plumbing with the detector and reconcile scripts already in place.

## Implementation evidence

- 2026-08-28: Added the deterministic `public-text-v1` tri-state detector. Its
  fixed rule requires a hamartia-specific old check, explicit rejection, and
  corrected-rule-distinct evidence in the replacement check. Missing, partial,
  uncertain, or mixed evidence remains `indeterminate`; explicit persistence or
  an unowned echo is `not_repaired`.
- 2026-08-28: Added a frozen seventeen-case corpus spanning two unrelated topics:
  five positive, two negative, and ten ambiguous cases. Boundary cases cover a
  replacement that repeats or explicitly negates the hamartia, affirmed
  alternatives, rejected corrected-rule anchors, mixed ownership, and an owned
  correction prefaced by attribution. The corpus is independent of the current
  D42/D50/D53 population and therefore does not reward a convenient hit on a
  live cell.
- 2026-08-28: Threaded the block through the adaptation-loop summary and ABox
  bridge without adding it to the loop pass/fail gate. Only a decisive positive
  asserts `HamartiaRepairStage`; negative and indeterminate summaries emit no
  repair RDF, and summaries without the new block retain byte-for-byte bridge
  behavior. The correction-origin rules remain mutually exclusive when a later
  recognition failure coexists with a successful mechanism shift.
- 2026-08-28: Extended reconciliation with a separate descriptive correction
  signal readout. It reports zero counts honestly and imposes no real-cell hit
  requirement. The adaptation ontology remains outside `DEFAULT_MODULES`.
- 2026-08-28: Preserved explicit registered repair inputs ahead of generic
  lesson fallbacks and made relative transcript ingestion report missing,
  unreadable, and unlabelled states separately; all remain non-gating and
  `indeterminate`.
- 2026-08-28: Verified entirely offline with focused detector, summarizer,
  bridge, ontology, and default-module tests plus formatting, syntax, lint, and
  workplan checks. No model-backed or paid calls were made.
