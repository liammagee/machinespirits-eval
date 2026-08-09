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
