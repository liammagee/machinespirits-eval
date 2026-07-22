---
id: version-symmetric-trace-transformation-pipeline
title: Version and restore the symmetric trace-transformation pipeline
status: triaged
type: maintenance
priority: P1
owner: unassigned
source: review
created: 2026-07-22
updated: 2026-07-22
verification: Newly generated learner traces emit the canonical initial,
  review, revision, and final labels; legacy logs remain readable; active-rubric
  analyzers reject non-finite inputs and pass fixture-to-output regressions.
claim_status: planned
depends_on: []
links:
  code:
    - services/evaluationRunner.js
    - services/learnerTutorInteractionEngine.js
    - services/turnComparisonAnalyzer.js
    - services/dialogueTraceAnalyzer.js
tags:
  - tutor-learner-symmetry
  - traces
  - transformation
  - rubric-versioning
milestone: evaluation-infrastructure
---

Learner deliberation records preserve initial/revision stages internally, but
trace emission collapses both into `learner_ego`; downstream rejudging expects
the canonical `learner_ego_initial` and `learner_ego_revision` labels. The
transformation analyzers also hard-code pre-v2.2 dimensions, look for the old
`superego/revise` action instead of canonical `superego/review`, and admit
undefined scores that can become `NaN`. Injected learner calls additionally
drop message history, so test and production paths can diverge in messages
mode.

Acceptance:

- Emit the exact symmetric learner sequence while readers continue accepting
  historical labels.
- Resolve analyzer dimensions from the recorded rubric version and accept both
  documented legacy and canonical trace actions deliberately.
- Reject or explicitly represent missing/non-finite scores; never aggregate
  them into `NaN`.
- Pass message history through injected learner calls just as production calls
  do.
- Add generated-trace, legacy-fixture, v2.2-dimension, missing-score, and
  injected-messages regression tests.
