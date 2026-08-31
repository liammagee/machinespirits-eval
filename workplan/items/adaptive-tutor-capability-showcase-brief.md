---
id: adaptive-tutor-capability-showcase-brief
title: "Adaptive tutor capability showcase and marketing brief"
status: done
type: content
priority: P1
owner: codex
source: manual
created: 2026-08-30
updated: 2026-08-31
verification: "A claim-audited brief identifies the investor audience, commercial wedge, customer, call to action, business model, defensibility thesis, traction and economics gaps, milestone-based funding ask, and supporting demo; maps every public-facing capability to canonical evidence; demonstrates at least three transcript-level affordances; separates controlled frozen-turn evidence from free-running illustration; and makes the simulated-conduct and human-learning boundaries unavoidable."
branch: codex/adaptive-tutor-showcase-brief
claim_status: scope-bound
depends_on:
  - adaptive-tutor-architecture-explainer
  - adaptive-tutor-instrumentation-contrast-gallery
  - shared-dramatic-dialogue-renderer-component
  - tutor-instrumentation-ab-harness
  - tutor-instrumentation-showcase
links:
  notes:
    - notes/marketing/2026-08-30-adaptive-tutor-capability-showcase-brief.md
    - notes/poetics/2026-08-29-adaptive-tutor-from-null-to-control.html
    - docs/dramatic-dialogue-renderer.md
  items:
    - adaptive-tutor-canonical-kernel-contract
    - adaptive-causality-crossed-effects
    - adaptive-causality-repertoire
    - shared-dramatic-dialogue-renderer-component
tags:
  - adaptive-tutor
  - marketing
  - instrumentation
  - showcase
---

# Adaptive tutor capability showcase

Turn the recent transcript-led explainer and the prior months of tutor
instrumentation work into an externally legible capability story. The brief
should make the system's new affordances visible in the tutor's conduct, not
sell instrumentation as an undifferentiated stack or turn simulated evidence
into a human-learning claim.

## Acceptance

- Lead with the shift from a fluent prompt to an inspectable control loop.
- Let readers see the same learner moment with and without one instrument, and
  a matched versus deliberately mismatched move at the same planted state.
- Show the complete measurement chain: public state, detector, selected move,
  draft, delivered turn, and outcome.
- Distinguish controlled frozen-turn next-turn effects, causal crossed-action
  contrasts, free-running demonstrations, and editorial glosses at the point
  where each appears.
- Reuse the shared dramatic-dialogue interchange across the brief, explainer,
  showcase, and future deck/demo captures; keep layout separate from evidence
  status.
- Carry an evidence ledger and a do-not-claim boundary into every derivative
  format.
- Separate technical proof from customer traction, market evidence, business
  model, unit economics, and human-outcome validation.
- Pair the investor deck with a product demonstration, and name the customer,
  commercial wedge, defensibility hypothesis, round milestones, and evidence
  still required before the pitch is investor-ready.

## Initial log

- 2026-08-30 Codex: Opened an isolated worktree from `origin/main` at
  `7581fe003` and seeded the discovery brief. No model calls or new empirical
  analysis.
- 2026-08-30 Codex: Added the investor translation, deck spine, diligence gaps,
  investor-safe language, and milestone-based funding frame. No market-size,
  traction, human-learning, or unit-economics result is claimed; commercial
  wedge, business-model, and defensibility statements are labelled hypotheses.
- 2026-08-30 Codex: Fast-forwarded the isolated branch to current `origin/main`
  after PR #875 and integrated its shared dialogue interchange into the
  renderer guide, frozen A/B and free-running showcase docs, Techne explainer,
  and this brief. Layout is now explicitly separated from causal status.
- 2026-08-30 Codex: Claim audit caught and corrected one delivery-status term:
  frozen A/B outputs are generated candidate tutor replies, not delivered turns.
- 2026-08-31 Claude: DONE on operator review instruction. PR #888 merged
  2026-08-30 with the brief at
  `notes/marketing/2026-08-30-adaptive-tutor-capability-showcase-brief.md`.
  Reviewed against the verification list: the investor audience, commercial
  wedge, customer, call to action, business model, defensibility thesis,
  traction and economics gaps, and the milestone-based ask are all present
  (Investor translation onward); the hero demonstration plus the four-piece
  supporting set cover more than three transcript-level affordances; pillar 6
  separates controlled frozen-turn evidence from free-running illustration;
  the investor-safe language section carries the simulated-conduct and
  human-learning boundaries. Commercial-shape, wedge and defensibility
  statements remain labelled hypotheses, not results — the card closes as a
  brief, not as evidence of traction.
