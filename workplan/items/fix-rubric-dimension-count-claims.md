---
id: fix-rubric-dimension-count-claims
title: Fix the off-by-one in both v2.2 rubric dimension-count claims
status: review
type: maintenance
priority: P2
owner: claude
source: review
created: 2026-07-28
updated: 2026-07-28
verification: "`npm run paper:provable-discourse` reports 134 pass / 29 warn /
  0 fail with both claims at actual=8 and actual=5; a negative test (delete one
  dimension) now fails the claim where it previously passed;
  `npm run paper:provable-discourse:test` passes 69/69 (needs a writable
  LOGS_ROOT); `npm run lint` and `npm run refs:check` are clean."
links:
  items:
    - repoint-learner-deliberation-claim-fingerprint
tags:
  - provable-discourse
  - rubrics
  - paper-2
milestone: paper-2-evidence-cleanup
branch: worktree-rubric-dim-count-fix
---

Found by the `code_path` consumer-target audit that followed
[[repoint-learner-deliberation-claim-fingerprint]]. Both §5 rubric
dimension-count claims counted one match too many, and the surplus was enough
to make each claim unable to detect the drift it exists to detect.

`paper2.s5.rubric.tutor_v22_dims` greps `name:` in
`config/rubrics/v2.2/evaluation-rubric.yaml` and asserted `gte 8`. The file has
nine `name:` keys: the eight dimensions plus the rubric's own top-level
`name: "Pedagogical Quality Rubric (v2.2)"` at line 40. So a deleted dimension
left exactly 8 matches and still cleared the threshold.
`paper2.s5.rubric.learner_v22_dims` had the same defect (6 matches, floor 5).

Measured on a genuine single-dimension deletion:

| pattern | intact | one deleted | verdict |
| --- | --- | --- | --- |
| `name:` (old) | 9 | 8 | `gte 8` passes — the defect |
| `\n    name:` (new) | 8 | 7 | `eq 8` fails — correct |

Two changes per claim:

1. **Anchor the pattern at the dimension indentation** (`\n    name:`). Only
   dimensions carry a `name:` at four spaces, so the rubric's own top-level key
   stops counting. The newline is matched explicitly because `evaluateCodePath`
   compiles the pattern with the `g` flag only (`services/provableDiscourse.js`,
   `new RegExp(pattern, 'g')`) — without `m`, `^` cannot anchor to a line start.
2. **`gte` → `eq`.** v2.2 is a frozen rubric version, so an added dimension is
   drift too, and a floor can only ever see removals.

Snapshot entries in `notes/provable-discourse.snapshot.json` were hand-edited
for these two claims only (`match_count` 9→8 and 6→5, patterns updated).
`--refresh-snapshot` was deliberately NOT used — it re-baselines every claim and
would bless the 29 standing fingerprint warns owned by other arcs.

Incidental finding worth recording: **`min_matches` is documentation, not a
threshold.** `evaluateCodePath` destructures it only to echo it into `details`;
it appears nowhere else in `services/` or `scripts/`. The gate is
`assertion.expected`. A claim whose `min_matches` and `assertion.expected`
disagree will silently obey the assertion.

Remaining from the same audit, not addressed here:

- `paper2.s4.architecture.superego_follows_lookahead` binds to `superegoFollows`,
  a local variable inside `traceToSteps` (`services/transcriptProjection.js`).
  Extracting that loop into a helper is a pure refactor that would fail the claim
  while the behaviour is intact.
- `paper2.s4.architecture.two_file_storage` targets `services/evaluationRunner.js`,
  correct today but the same file that has already shed its path resolution to
  `evaluationDataPaths.js` and its trace projection to `adaptiveTraceProjection.js`.
  Needs a decision on whether the write path is expected to follow.
- §7's counter claims (`provable_discourse.claim_count` says 75, the mechanisms
  ledger alone has 92 `- id:` entries; `provenance.tests_passing` says 44/44 and
  counts 70 test declarations without checking any pass). These need a paper edit,
  not a fingerprint change.
