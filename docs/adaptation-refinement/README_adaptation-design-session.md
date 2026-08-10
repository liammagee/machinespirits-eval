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

The mechanism runner is launch-hardened for validation: strict
digest-bound approval, clean-SHA/source/child-policy closure, sanitized pinned
environment, wrapper-plus-native Codex CLI fingerprint, a 64-call child cap,
sealed immutable resume/evidence collection, captured prompt-boundary canaries,
opaque globally shuffled blind IDs, and strict reader envelopes. These are
integrity properties only.

Six authorized mechanism packets have now been run and burned without being
promoted to decision evidence. The sixth reached 22/24 valid sealed children,
176/176 exact structured parity, and five delivery-audit misses. Two invalid
children shared a false tutor-owned obligation created from a learner's modal
request to record a public finding. The five valid-row misses were bounded
realization-audit false negatives: four declarative `record closes` forms and
one explicitly named missing evidential link. Prospective exact-surface repairs
cover both classes without changing the six-axis divergence projector.

The central divergence layer is now explicit rather than implicit in separate
gate inputs. Gate V5 and shadow V0.3 share a six-dimensional projection across
conceptual, interactional, engagement, pacing, epistemic, and strategy-
exhaustion state. The V4 blind protocol independently labels interpretation,
magnitude, and persistence for every dimension and requires per-dimension
consensus, support, macro-F1, component accuracy, and joint accuracy.

The next stage is the all-turn mechanism-validation protocol in
`baseline-comparison-design.md`: two worlds, six learner profiles, observe and
active, one fresh seed per cell, and eight turns (24 dialogues). All 96 observe
decisions from the next fully valid seventh packet will receive two blind
annotations
with public-safe release, contract, trajectory, audit, pacing, and epistemic
context; active runs remain outside the gold corpus and supply matched
execution plus exact typed parity. No downstream causal comparison is licensed
unless every delivery, support, divergence, accuracy, closure-safety, and
parity gate passes. The live gate remains experimental and off by default.

## Current checkpoint — 11 August 2026, after the seventh V4 read

The seventh execution finally passed the complete runtime boundary: 24/24
valid dialogues, 192/192 learner-analysis calls, exact 192/192 live/replay
parity, and zero delivery-application mismatch. Its two independent Luna
readers completed all 96 observe decisions, but the frozen measurement gate
failed. Agreement was 0.698, recall 0.567, overall accuracy 0.731, and request/
proposal macro-F1 0.143. Only pacing passed every six-dimensional gate; rare
obligation, completion, conceptual, and epistemic states lacked support.

The architecture is therefore integrated but not generally validated. Bounded
prospective repairs now cover the observed speech-act misses, conceptual
flatness overreach, and same-turn interactional timing error. Annotation
collection is deterministic and keyed by exact opaque IDs, with substantive
note validation and auditable canonicalization.

The next validation uses two separately frozen surfaces: a fresh all-turn
natural corpus for prevalence and false positives, and an authored challenge
corpus for guaranteed lifecycle, completion, and non-aligned support. The
challenge rows may test accuracy but may never be pooled into natural-rate
estimates. Both must pass before an active-versus-observe outcome study is
licensed. The seventh corpus remains a disclosed failed calibration artifact,
not a dataset to tune and rescore into passage.
