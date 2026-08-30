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
verification: "Three bounded four-turn dialogues compare direct Qwen, progression-prompted Qwen, and progression-prompted Qwen with a private Luna superego; configuration separately exposes behavior, character, tone, system-prompt style, deliberation mode, superego model/style/effort, and model-call ceiling; traces prove final public authority remained with Qwen and no learner repair or fallback altered its performance."
claim_status: scope-bound
links:
  config:
    - config/tutor-stub-local-learners/qwen-abliterated-frame-defiant.v1.yaml
    - config/tutor-stub-local-learners/qwen-abliterated-frame-defiant-progressive.v1.yaml
    - config/tutor-stub-local-learners/qwen-abliterated-frame-defiant-luna-superego.v1.yaml
  code:
    - scripts/run-local-qwen-resistant-learner.js
    - services/tutorStubLearnerDeliberation.js
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
- 2026-08-30 — Reopened locally to test whether a progression-aware learner
  system prompt and an authenticity-preserving Luna superego can reduce the
  semantic repetition seen in the direct-Qwen baseline. The superego is
  advisory and private: it may diagnose stasis and name a next kind of move,
  but it may not draft learner speech; Qwen retains final public authority.
  The two new four-turn arms admit 24 planned model calls under an aggregate
  26-call ceiling. This remains an engineering ladder, not a causal or
  transportability study.
- 2026-08-30 — Completed both new arms without resampling. The progression-only
  arm used 8/10 admitted calls (four Qwen learner calls and four Luna tutor
  calls). It produced a stronger opening and one useful clarification question,
  but turns three and four returned to nearly the same town-license/metal-mark
  objection. A system-prompt instruction against repetition was therefore not
  enough by itself.
- 2026-08-30 — The Luna-superego arm used 16/18 admitted calls: four Qwen
  drafts, four private Luna critiques, four Qwen revisions, and four Luna tutor
  replies. Luna correctly identified the repeated objection on turns two
  through four and never drafted public learner speech. Qwen's turn-two
  revision made a genuine new move by performing the touchstone comparison and
  stating its evidentiary limit. Turns three and four nevertheless repeated
  that same limit. The mechanism therefore improves participation beyond mere
  refusal, but does not yet sustain four turns of developing resistance.
- 2026-08-30 — Across the two new arms, 24/24 planned calls completed under the
  aggregate 26-call ceiling with no model-call error, learner profile repair,
  deterministic learner fallback, human intervention, or private-review
  leakage. The tutor response checker recorded non-blocking presentation
  findings on later tutor turns; it neither added model calls nor altered the
  Qwen learner outputs. Technical traces and transcripts remain in the private,
  ignored `.tutor-stub-traces/` archive. This closes the local engineering MVP
  with a narrow positive result and an explicit remaining limitation, not a
  learner-transport or tutoring-effectiveness claim.
