---
id: adaptive-causality-human-state-move-validation
title: "Independently validate adaptive learner-state and move-realization labels"
status: blocked
type: research
priority: P1
owner: human
source: review
created: 2026-08-29
updated: 2026-08-30
verification: "Two independent human coders complete a frozen, arm-blinded stratified packet from sealed adaptive-causality traces; agreement, disagreements, state confusion, and move-realization fidelity are reported overall and by arm; ambiguous or discordant cases remain indeterminate; the adaptive mechanism claim is either retained within those measured bounds or narrowed without post-hoc relabelling."
blocked_by: "Two independent human coders must complete and freeze the prepared packet before unblinding"
claim_status: planned
depends_on:
  - adaptive-causality-human-state-move-packet-prep
links:
  notes:
    - notes/2026-08-03-adaptive-causality-living-log.md
  paper:
    - docs/research/paper-full-2.0.md#624-the-four-locks-why-nothing-beat-the-bare-tutor-and-what-opened-when-each-was-removed-post-hoc-except-the-claim-gate-development-tier
  items:
    - adaptive-causality-crossed-effects
    - adaptive-causality-repertoire
    - adaptive-causality-human-state-move-packet-prep
    - consolidated-labelling-game-harness
    - rubric-v3-calibration-and-held-out-acceptance
    - superego-taxonomy-human-validation
tags:
  - adaptive-causality
  - human-validation
  - learner-state
  - treatment-fidelity
  - inter-rater-reliability
milestone: adaptive-tutor-evidence-v1
---

Preserve the publication-closeout requirement that the adaptive programme's
learner-state and move-realization labels be checked by people rather than only
by the same class of automated instruments used to establish the effect.

The packet must be frozen before coding and sampled from existing sealed
crossed-effects and repertoire evidence without new dialogue generation. Coders
remain blind to arm, automated verdict, and downstream outcome while labelling
the public learner state and whether the intended pedagogical move was visibly
realized. Automated-versus-human comparison happens only after both coder
artifacts are frozen.

This card does not re-code refusal narrowing, communicative impasse, the
superego taxonomy, or rubric v3.0; those constructs retain their existing cards
and coding surfaces. It makes no human-learning claim. Failure to reach the
predeclared agreement floor is a measurement bound, not a reason to tune labels
after seeing the disagreements.

2026-08-29 Codex: Captured from the comprehensive adaptive-tutor review. The
card records a missing publication-validity step and authorizes no model call,
new experiment, or claim expansion.

2026-08-30 Codex: Human-work review found that the external validity goal
remains central but the named frozen packet does not yet exist. Added the
zero-call packet-preparation dependency rather than treating this card as
immediately ready for coders. This card continues to own only the independent
human rulings and claim-bound comparison after that packet freezes.

2026-08-30 Codex: The preparation dependency is complete. The 24-case packet,
plain-language codebook, two independently ordered coder templates, separate
machine key, hash manifest, and fail-closed comparison tool are frozen under
`config/adaptive-causality-validation/`, with the organizer-only key under
`tests/fixtures/`. This card is now ready for external coding; its only remaining
blocker is the absence of two independent human coders. Do not provide the spec,
hash manifest, source traces, other coder's file, or machine key before both
submissions are frozen.
