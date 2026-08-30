---
id: local-qwen-resistant-learner-mvp
title: "Use local abliterated Qwen as a configurable resistant learner"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-30
updated: 2026-08-30
branch: codex/local-qwen-resistant-learner-mvp
verification: "A bounded one-dialogue smoke uses the existing dramatic-detective tutor on Codex Luna and the loopback MLX Qwen route for the automated learner; the saved configuration separately exposes behavior profile, character, and tone; the technical trace proves the actual role routes and call ceiling; the public learner turns are reviewed for sustained, non-meta, evidence-bounded resistance before any claim is made."
claim_status: scope-bound
links:
  config:
    - config/tutor-stub-local-learners/qwen-abliterated-frame-defiant.v1.yaml
  code:
    - scripts/run-local-qwen-resistant-learner.js
    - services/tutorStubLabs.js
    - tutor-core/services/unifiedAIProviderService.js
  items:
    - learner-profile-world-deconfound
    - adaptive-learner-substrate-transport-recovery
tags:
  - tutor-stub
  - learner-profiles
  - local-model
  - qwen
  - resistant-learner
---

# Local Qwen resistant-learner MVP

The prospective learner-profile/world deconfound closed below its 80% gates:
persona recovery was 13/20 (65%) and world recovery was 15/20 (75%). That
negative result remains sealed. The later world-independent learner-substrate
proposal was dropped as a near-term route because it would require scarce
independent human authoring.

This card tests a narrower engineering question: can the locally hosted,
abliterated Qwen model sustain a resistant learner's public part when the
behavior profile, character, and tone are explicit and the tutor remains an
existing Luna-backed dramatic-detective instance?

The first smoke uses one neutral Marrick world, four learner turns, and a hard
ten-call ceiling. Learner output is not classified or repaired by another
model, so apparent role fidelity belongs to the local learner generation rather
than to a post-hoc correction loop. The tutor retains its ordinary public-safety
guards. Success means the learner produces concise, in-scene, evidence-bounded
resistance across the short dialogue. Tutor persuasion, final-case grounding,
cross-world transportability, tutoring effectiveness, and human-learning
validity are all out of scope.

## Log

- 2026-08-30 — Opened from current `origin/main` in an isolated worktree.
  Reused the existing automated-learner seam and added a loopback MLX provider,
  a metered learner-role smoke lab, and a YAML learner spec with separate
  behavior, character, and tone fields. No model calls had run at this point.
- 2026-08-30 — Preserved the first live attempt rather than overwriting it. It
  used 8/10 admitted calls (four Qwen learner calls and four Luna tutor calls),
  but only Qwen's first public turn was genuine. On turns two through four the
  local model spent its 900-token allowance in private reasoning and returned
  empty public content; the existing session fallback filled those turns. This
  was a transport defect, not evidence about role performance.
- 2026-08-30 — Corrected the transport by explicitly disabling thinking on the
  MLX request and making an empty local completion a visible technical error.
  The replacement run completed four learner and four tutor calls under its
  10-call ceiling. All four learner turns came directly from the configured
  abliterated Qwen model: no classifier, profile repair, deterministic fallback,
  or human intervention was used.
- 2026-08-30 — The one-dialogue feasibility question passed narrowly. Qwen
  stayed in scene, contested the tutor's standing rather than becoming merely
  rude or confused, used only public evidence, and proposed a bounded test. It
  nevertheless converged after turn two on nearly the same `known good`
  objection, despite the tone brief's variation rule. The MVP therefore shows
  that this local model can play the resistant part, but not yet that it can
  sustain varied, developing resistance across worlds or longer dialogues.
  The earlier 65% persona/75% world transport result remains closed and is not
  changed by this smoke.
