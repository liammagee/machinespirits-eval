---
id: qwen-invested-rival-theorist
title: "Test Qwen as an invested rival theorist"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-31
updated: 2026-09-03
branch: codex/local-qwen-resistant-learner-mvp
verification: "The sealed completion records both eight-exchange arms and all eight logical Opus assessments complete at 49/50 aggregate attempts; the final recovery reused every valid dialogue, assessment and split packet, accepted only the missing B quality-turns packet, and sealed the run complete."
claim_status: exploratory
links:
  notes:
    - notes/qwen-invested-rival-theorist-v1-design.md
  runs:
    - qwen-invested-rival-theorist-v1-generation-recovery-v9
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/925
  items:
    - qwen-refusal-continuity-retest
tags: [qwen, local-model, rival-theorist, learner-profiles, tutor-stub]
---

# An adversarial learner who wants the answer

Replace repair-handoff refusal with an invested rival explanation: Alex starts
from the shower account, tests weak inferences, concedes points defeated by
public evidence and may close naturally. Compare normal and abliterated Qwen
with Sol, no superegos, using one fresh dialogue per arm.

## Acceptance

- [x] Character goal, belief, stake, tone, revisability and exit are surfaced in
  configuration without refuser-specific wrapper instructions.
- [x] Sol remains proof-directed while answering the live rival explanation.
- [x] Two-arm generation, eight independent assessments and bounded same-packet
  technical recovery completed within the prospectively amended 50-attempt
  aggregate ceiling.
- [x] Prompt/world audits, focused tests, judge-packet inspection and a visibly
  synthetic private Techne/swimlane preview pass with zero model calls.
- [x] Paid launch admission uses the shared standing contract: merged design,
  clean detached launch commit, committed GO note, create-once destination and
  a study-wide 48-attempt ceiling.

## Log

- 2026-09-01: Draft promoted for implementation after the user said to
  continue. Model activity remains inactive; no launch is authorized.
- 2026-09-01: Preparation complete. The 30-test continuity suite, 37-test
  prompt/world/benchmark suite, 35-world quality audit and 576-item workplan
  check pass. Eight synthetic judge packets and the Techne/swimlane preview were
  checked at 1280 px in light and dark modes with no overflow or remote assets.
  Attempt use remains 0/48.
- 2026-09-01: The user said “commit and GO.” The draft was promoted to a
  registered design and the launcher adopted the shared paid-study contract.
  The accumulated Qwen suites, CLI bridge and launch-contract tests, prompt/world
  gates, manifest check, 35-world audit and 576-item workplan check pass. The
  design still has to reach `main` before the clean detached launch can begin;
  no model attempt has been dispatched.
- 2026-09-01: The merged study launched from `75356f762`, but normal Qwen's
  first reply paired usable public speech with one paraphrased private-ledger
  quotation. The strict parser stopped before accepting a turn; 1/48 attempts
  was preserved and no Sol or Opus call ran. After a fresh user GO, a local
  recovery correction now drops and traces only unsupported private-ledger
  rows, preserves the original public speech unchanged, reuses that response
  without another call, and leaves every other envelope failure strict. The
  same private-ledger rule applies symmetrically to both speakers and study
  arms during recovery. Focused recovery and shared-ceiling tests pass; the
  recovery itself has not launched.
- 2026-09-01: The original failed ledger remains immutable. Recovery accounting
  uses a separate linked study id with an enforced 47-attempt ceiling, records
  the preserved 1-attempt predecessor in the fresh run ledger and reports the
  aggregate 48-attempt count. This avoids retroactive seal changes while still
  making the original failure plus all possible recovery calls fail closed at
  the authorized ceiling.
- 2026-09-01: The linked recovery completed all eight normal-Qwen exchanges,
  then stopped before the first abliterated-Qwen call because the server reports
  that local checkpoint by its absolute configured path while the arm metadata
  uses a repository-relative label. The 16/48 aggregate attempts and completed
  arm remain immutable. The correction validates the server against the exact
  service target and admits a second linked recovery with only the remaining
  32-attempt ceiling, reusing arm A without regenerating it.
- 2026-09-01: The second linked recovery reached the first abliterated-Qwen
  request, then received HTTP 400 before any output because the request sent the
  arm's relative metadata label instead of the already-loaded absolute service
  target; the server attempted a nonexistent Hugging Face repository lookup.
  That failed request is preserved and charged at 17/48. The request correction
  uses the exact loaded target, and a third linked recovery reuses arm A, starts
  arm B from its empty first turn and exposes only the remaining 31 attempts.
- 2026-09-01: The third linked recovery completed the eight-exchange
  abliterated arm, giving two complete dialogues at 33/48 attempts. The local
  server stopped before judging; A tutor, learner and dialogue assessments then
  completed. The A quality packet returned no valid structured output and
  stopped the run at 37/48. Its transport contains only a 2,048-byte diagnostic
  prefix of an 11,271-byte malformed tool input, so none of that partial
  judgment is accepted. The linked assessment-recovery correction reuses both
  dialogues and all three valid scores, retries only the five unresolved
  packets, preserves the failed attempt and enforces the remaining 11-attempt
  ceiling.
- 2026-09-01: The exact A quality packet failed a second time through Claude's
  structured-output tool and stopped at 38/48. The prompt and schema hashes were
  unchanged. The first attempt produced malformed tool JSON; the second added
  one forbidden top-level field, so neither is accepted. The next correction is
  transport-only: quality packets keep the same prompt, schema, rubric, Opus
  route and single-response rule, but return plain JSON for strict local schema
  validation. Tutor, learner and dialogue assessments retain the existing
  provider schema tool. A fifth linked ledger preserves all 38 attempts and
  exposes only the remaining 10.
- 2026-09-01: The third A quality attempt used the registered plain-JSON route
  and produced one successful, tool-free Opus response, but the archived result
  ended at exactly 13,000 characters before the JSON object closed. It remains
  failed evidence, taking the study to 39/48; no visible score or annotation in
  that incomplete object is accepted. The prospective amendment splits only
  the oversized quality transport into a summary packet and a per-turn packet,
  validates both separately, then mechanically checks their union against the
  original schema. The remaining plan is seven calls under a nine-attempt cap,
  with no rerun of either dialogue or the three accepted assessments.

- 2026-09-01: Board reconciliation keeps this card active rather than falsely
  closing it. Both dialogues and three assessments are preserved, but five
  original assessments remain unresolved; after the merged split-packet
  correction they require seven planned calls and cannot exceed the nine
  attempts left under the unchanged study ceiling. Conflict resolution made no
  model call. The card stops when the five original assessments resolve through
  validated packet unions or the recovery encounters its first new substantive
  or technical failure.
- 2026-09-01: The first split A quality-summary call returned a complete
  5,771-character provider result, but it appended Markdown commentary and a
  second JSON object after the requested object. The packet remains failed and
  no apparent content is accepted, taking the immutable chain to 40/48. The
  next correction keeps the smaller split prompts and schemas unchanged but
  sends those two packet types through the existing schema-bound output tool.
  Seven missing calls fit under the eight attempts left; full completion would
  end at 47/48 without rerunning a dialogue or accepted assessment.
- 2026-09-01: The structured split recovery completed A quality plus B tutor,
  learner and dialogue, leaving seven of eight assessments valid. B
  quality-summary then added the forbidden top-level field
  `reasoning_effort`; the schema tool rejected it and the run stopped at
  46/48 without accepting its content. At the user's explicit direction, a
  terminal recovery may reattempt only that unchanged summary and, if it
  validates, run B quality-turns. Those two calls exhaust the ceiling; either
  failure ends the study incomplete with no further recovery.
- 2026-09-01: The terminal recovery accepted B quality-summary, then B
  quality-turns supplied every registered field plus the surplus root field
  `turns`; the provider schema rejected the packet and sealed the chain at
  48/48. The user directed actual completion before the broader failure audit.
  A prospective transport-only amendment therefore exposes the one missing
  packet under at most two new Opus attempts and a 50-attempt aggregate cap.
  The provider may return surplus root fields; the runner projects only the
  four registered fields and validates them against the unchanged strict
  schema. It never changes registered values, reuses no rejected content, and
  never resamples a locally returned candidate.
- 2026-09-03: The final missing-packet recovery completed B quality-turns on its
  first new attempt and sealed the full study at 49/50 aggregate attempts, with
  both eight-exchange dialogues and all eight logical assessments complete.
  The ordinary learner and dialogue rubrics favoured the abliterated arm in
  this single pair, while the stricter quality assessment found both arms
  repetitive and scored normal Qwen slightly higher on character adherence.
  This remains descriptive engineering evidence from one free-running dialogue
  per checkpoint, not a model ranking or a causal effect of abliteration.
  Private artifact hashes: completed
  `c6dd1b6bc1f9b0fa4065a999f667d54b661cb921e3f6a4aae9e6b08fbddb8ce8`;
  report data
  `f5c72e167a26fbef114c931c38f6ef1ce4bfcab3e39f8dcfe97c4ae2de9bf6f0`;
  public interchange
  `5a1b086491898118d4feb6138ba35ab383cf91a6e47216eaa75699ddf79ebe68`;
  score archive
  `08402fac4181e3eda6e71548b03a65a4cf5c1a515fc4e7f0e59ec63079c85f8e`.
