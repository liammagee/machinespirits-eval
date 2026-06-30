---
id: character-dag-drama-transfer-specificity-controls
title: Tighten Character-DAG transfer specificity controls
status: done
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-30
updated: 2026-07-01
verification: "Focused framework tests pass; expanded mock family/control screen passes; bounded real base/state_dependent_transfer screen passes with compressed-state below full and zero label/process leaks."
branch: codex/dag-resistance-adaptation-framework
claim_status: exploratory
links:
  notes:
    - docs/next-steps/character-dag-drama-framework-plan.md
  exports:
    - exports/character-dag-drama-framework-family-controls-real-v2-base/robustness-report.md
    - exports/character-dag-drama-framework-family-controls-real-v2-base/claim-audit.md
    - exports/character-dag-drama-framework-transfer-specificity-mock/robustness-report.md
    - exports/character-dag-drama-framework-transfer-specificity-mock/claim-audit.md
    - exports/character-dag-drama-framework-transfer-specificity-real-base/robustness-report.md
    - exports/character-dag-drama-framework-transfer-specificity-real-base/claim-audit.md
  items:
    - character-dag-drama-framework-synthetic-contrast
tags:
  - dag-resistance
  - character-state
  - transfer
  - negative-control
  - synthetic-learner
milestone: paper-2-evidence-cleanup
---

Follow-up from the 2026-06-30 stronger-control screen. The patched real run
separated full Character-DAG drama from policy-only, shuffled, stale,
overconfident, and state-without-proof controls, but not from compressed state.
`compressed_character_state` tied full on first-response and transfer success
because the current transfer observer accepts generic "some condition must hold"
reasoning.

Next implementation should make transfer evidence specific to the public prior
state:

- Add a transfer-specific evidence label or sub-contract for naming the concrete
  prior condition/check, not just saying that a condition exists.
- Preserve the existing leak guards and target-label ban.
- Make matched public state carry enough public-safe detail to answer the
  specific transfer check.
- Keep compressed state intentionally unable to recover that detail.
- Rerun mock expanded-family controls, then a bounded real
  `state_dependent_transfer` screen before any larger real matrix or paper note.

2026-07-01 Codex: Implemented transfer-specificity contracts. Transfer scenes
now carry a public-safe `transfer_contract`; matched state exposes the concrete
prior check, compressed/stale state withholds it, and the observer requires the
learner's own response to name the relevant prior check for transfer success.
Expanded mock screen passed across four fixture families and four strict
perturbations. Bounded real screen on `base/state_dependent_transfer` passed all
stronger gates: full 7/8 first-response and 3/3 transfer; compressed 5/8
first-response and 1/3 transfer with two transfer-specificity misses; no target
label or public theory/process leaks. Next escalation is a larger real
state-dependent-transfer matrix before any paper update.
