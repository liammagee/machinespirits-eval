---
id: repoint-learner-deliberation-claim-fingerprint
title: Re-point the learner-deliberation claim fingerprint at the trace-schema module
status: done
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-07-27
updated: 2026-07-28
verification: "`npm run paper:provable-discourse` reports 0 fail (was 1),
  `npm run paper:provable-discourse:test` passes 69/69, `node --test
  tests/traceSchema.test.js tests/adaptiveTraceProjection.test.js` passes, and
  `npm run lint` / `npm run refs:check` are clean."
links:
  items:
    - refactor-adaptive-trace-projection
tags:
  - provable-discourse
  - traces
  - refactoring
  - paper-2
milestone: paper-2-evidence-cleanup
branch: claude/wizardly-vaughan-9b35e0
---

Found while tagging `paper/v3.0.230` (PR #290). `npm run paper:provable-discourse`
reported one failing claim, `paper2.s4.architecture.learner_deliberation`, whose
`code_path` fingerprint expected 3 matches of
`learner_ego_initial|learner_superego|learner_ego_revision` in
`services/evaluationRunner.js` and found 2.

The claim's prose in `docs/research/paper-full-2.0.md` §4.3 is unchanged and
still true — the three-stage learner pipeline exists, the fingerprint was
pointing at the wrong file. Two commits moved it:

- `0f373fc6` (2026-07-23, "version symmetric trace transformation") introduced
  `services/traceSchema.js` as the canonical emitter/reader label vocabulary.
- `31341370` (2026-07-24, "consolidate adaptive trace projections") moved the
  consumer `extractLearnerTurnsFromTrace` out of `services/evaluationRunner.js`
  into `services/adaptiveTraceProjection.js`. Its own card
  (`refactor-adaptive-trace-projection`) states "Do not change ... learner trace
  labels", so the architecture never moved — only the plumbing.

What was left in `evaluationRunner.js` was a single comment
(`services/evaluationRunner.js:3577`), which still matched twice. `code_path`
evidence counts global regex occurrences in the file's raw text, so comments
count and a stale mention is indistinguishable from live code.

Fix: re-point the fingerprint at `services/traceSchema.js` — the definition site
rather than a consumer. It carries 10 matches against `min_matches: 3`, is
imported by `evaluationRunner.js`, `transcriptProjection.js`, and
`transcriptFormatter.js`, and is what must change if the pipeline shape itself
changes. `min_matches`/`expected` stay at 3 (the semantic count: three stages),
not the incidental 10.

The snapshot entry in `notes/provable-discourse.snapshot.json` was hand-edited
for this claim only. `--refresh-snapshot` was deliberately NOT used: it
re-baselines every claim and would have blessed the 23 standing fingerprint
warns owned by other concurrent arcs.

Rule for future `code_path` claims: target the module that must change if the
architecture changes, and keep `min_matches` at the semantic count. Pointing at
a consumer is what made this claim break under a pure refactor.
