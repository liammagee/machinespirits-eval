---
id: scenario-presentation-variety
title: Scenario presentation variety — de-medievalize the derivation-world roster
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-07-12
updated: 2026-07-26
verification: Generic tutor-stub prompts carry no unconditional assay vocabulary
  (period worlds opt in via presentation metadata); the world picker groups
  controlled variants by family; the featured set mixes
  period/contemporary/speculative; audit-world-variety reports family-normalized
  distributions; at least four non-period base worlds lint PASS.
claim_status: methods
links:
  items:
    - tutor-stub-headroom-contrast
tags:
  - tutor-stub
  - derivation-worlds
  - presentation
  - authoring
branch: codex/scenario-presentation-variety
---

The derivation-world roster read as uniformly mock-antiquated: tutor-stub
began as the Marrick assay and its vocabulary ("trial-book", "keep the
medieval flavour") was never generalized when the scenario picker arrived,
while controlled variants (7 hethel + 3 marrick files) presented as ten
independent scenarios. Diagnosis by Codex 2026-07-12; implementation same
day.

Design rule (from the diagnosis, kept deliberately): the new axis is
PRESENTATION — authorial scenario ecology and narrative diction — and is not
register (which controls speech), engagement stance (speaker-hearer
relation), or audience (witnessing position).

Landed:

- `presentation:` metadata block on every world (family, variant_of,
  temporal_frame, scene_ecology, narrative_diction, ledger_term, summary),
  passed through `services/dramaticDerivation/world.js` as authorial data the
  engine never reads. Backfill is behavior-preserving: untagged costume
  fields default to the legacy assay vocabulary, so frozen worlds keep their
  learner-visible conditions.
- tutor-stub generic prompts/fallbacks parameterized on
  `worldLedgerTerm`/`worldFlavourPhrase`; the marrick-specific
  intermediate-conclusion leak checks now apply only to worlds whose rules
  carry those predicates.
- Picker + `--list-worlds` group controlled variants by family (28 files ->
  20 families); featured Subject Explorer set now mixes period,
  contemporary, speculative, and the reflexive capstone.
- `scripts/audit-world-variety.js`: family-normalized distribution report
  (2026-07-12 baseline: 65% period families, 25% contemporary, 10%
  speculative).
- Five new lint-PASS worlds in new ecologies and literary styles:
  world-023 greyfen lab (clinical deadpan), world-024 emberwick forum (forum
  vernacular), world-025 tallow street (council minutes), world-026 skyway
  bakery (tall-tale whimsy), world-027 gazette recall (newsroom noir,
  variant_of world_006_hethel — the literary re-costume pattern that leaves
  frozen originals untouched).

Remaining:

- Run outcome-bearing live dialogues for worlds 029-031 only if a later
  experiment needs them. Their current role is authoring and presentation
  coverage, so deterministic tutor-stub dry-runs are the appropriate gate.
- EXCLUDED: the marrick family — its costume remains pinned by user directive
  (2026-07-12): the assay language suits those scenarios; do not re-costume
  them or author diction variants of them.

2026-07-22 Codex: Parked in triage. The presentation metadata, generic prompt
parameterization, grouped picker, audit, and five lint-clean worlds have landed.
Live smokes, legacy-metadata enrichment, and additional worlds are optional
content expansion rather than an active implementation stream.

2026-07-25 Codex: Re-audited current main before extending the roster. All 29
existing worlds already carried `scene_ecology`, `narrative_diction`, and
`summary`; worlds 023-027 also had live dialogue evidence, so the two remaining
notes above were stale. Added three requested contemporary base worlds:
world-029 Riverside Clinic (clinic process attribution), world-030 Rowan Flat
(domestic repair decision), and world-031 Tideway Makerspace (collaborative
construction review). Each has an independent three-premise proof path, lints
clean, appears in the tutor-stub picker, and dry-runs through the public prompt
boundary without legacy assay diction. Family-normalized variety now covers 32
files / 24 families: 54% period, 38% contemporary, and 8% speculative, with no
metadata backfill candidates. The new dry-runs are authoring/prompt-boundary
verification, not claims about live learner outcomes.
