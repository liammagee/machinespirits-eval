# Machine Spirits Eval — Adaptation Design Session

This bundle contains working design artifacts reconstructed from the 9 August 2026 research discussion.

## Files

- `2026-08-09_living-research-log.md` — research log capturing hypotheses, distinctions, open questions, and the emerging normative/descriptive framing.
- `normative-adaptive-dialogue-architecture.md` — draft architecture specification translating the discussion into computational objects, instrumentation, evaluation, debugging, and an implementation sequence.

## Recommended first step in Codex

Do **not** implement the proposed architecture immediately.

First use the repository to perform the semantic audit described in the architecture document, with particular attention to:

1. the current Lesson DAG implementation;
2. recent adaptive ontology terminology;
3. existing trigger and evaluation machinery;
4. PR 617 and its negative-register/adaptive-mood work;
5. prior failed experiments documented in Paper 2.0.

Then revise these documents against the actual repository before writing runtime code.

## Current checkpoint — 10 August 2026

The semantic audit and first runtime sequence have now been completed. Shared
live/offline warrant logic, a repair-policy map, an `off|observe|active` live
gate, typed lifecycle contracts for all action families, a frozen study
harness, and deterministic blind scorer are implemented.

Three successive fresh annotation exercises prevented premature scale-up. The
latest 18-case contract-validation corpus failed its predeclared decision and
successor gate (precision 0.500, recall 0.286, accuracy 0.500, historical
successor score 0/4). A later source-trace audit found that its two
`close_inquiry` labels lacked release-availability context and are not valid
terminal-closure gold. The two persistent `answer_accountably` consensuses
remain valid evidence of a public-obligation defect.

The successor architecture is now implemented: precision-first public speech
acts, a persistent tutor-owned public-obligation ledger, a typed inquiry-
completion/terminal-transition object, separate prior-commitment and current-
candidate comparisons, target-specific response directives, and shared live,
resume, and offline replay reducers. In active mode typed completion also
vetoes a premature `close_inquiry` candidate and constrains the legacy closure
frame; observe remains inert. This is implementation evidence, not a validated
policy.

The mechanism runner is now launch-hardened before that validation: strict
digest-bound approval, clean-SHA/source/child-policy closure, sanitized pinned
environment, wrapper-plus-native Codex CLI fingerprint, a 64-call child cap,
sealed immutable resume/evidence collection, captured prompt-boundary canaries,
opaque globally shuffled blind IDs, and strict V3 reader envelopes. These are
integrity properties only; no model-backed mechanism run has yet been made.

The next stage is the all-turn mechanism-validation protocol in
`baseline-comparison-design.md`: two worlds, six learner profiles, observe and
active, one fresh seed per cell, and eight turns (24 dialogues). All 96 observe
decisions will receive two blind annotations with public-safe release-
availability context; active runs remain outside the gold corpus and supply
matched execution plus exact typed parity. No downstream causal comparison is
licensed unless every support, accuracy, closure-safety, and parity gate
passes. The live gate remains experimental and off by default.
