---
id: superego-critique-causal-link-followup
title: Separate superego critique influence from revision-pass and semantic effects
status: review
type: research
priority: P2
owner: codex
source: manual
created: 2026-09-04
updated: 2026-09-04
verification: A zero-call aggregate sensitivity report and outcome-blind semantic
  review packet expose the complete critique and public revision channels, while
  a focused test suite proves deterministic selection, permutation, and fail-closed
  handling without modifying historical evidence.
branch: codex/superego-causal-link-followup
claim_status: exploratory
links:
  items:
    - discovering-efficient-and-explainable-communication-topologi
  exports:
    - notes/2026-09-04-superego-critique-causal-followup.md
    - notes/2026-09-04-superego-critique-causal-followup.json
  code:
    - services/superegoCritiqueCausalFollowupAnalyzer.js
    - scripts/analyze-superego-critique-causal-followup.js
    - tests/superegoCritiqueCausalFollowupAnalyzer.test.js
---

PR #1017 established a narrow per-link exact-word result. This follow-up asks
what that result cannot: whether critique-linked signal exists at corpus level,
which critique and revision channels the original instrument omitted, and what
frozen evidence can be prepared before any causal intervention is authorized.

Acceptance boundary:

- Preserve PR #1017 and all historical traces unchanged.
- Treat lexical analysis as auxiliary; semantic ambiguity remains indeterminate.
- Report aggregate association as exploratory and non-causal.
- Generate a deterministic, outcome-blind local review packet from complete
  draft, critique, structured-change, and public-revision fields.
- Specify the randomized replay needed to distinguish critique content from an
  extra revision pass, but make no provider calls and choose no paid route or
  spend ceiling.

2026-09-04 Codex: Started from merged PR #1017 in a separate worktree. Model-call
ceiling is zero; no historical rescoring or mutation is permitted.

2026-09-04 Codex: Packaged the zero-call follow-up. All 319/319 source traces
matched the merged ledger. Across the 304 originally testable links, actual
critique→revision uptake averaged 0.041 versus 0.021 under 20,000 matched
broken-link draws (1.94×; 0 null draws reached the observed mean). The
parser-clean and complete-critique sensitivity checks remained positive. The
audit also records 1,105 structured critiques, 948 explicit revision lists, and
637 changed action targets across 1,202 eligible links. These are exploratory
association and channel-coverage results, not causal or quality effects.

The CLI generated a 48-item outcome-blind semantic calibration packet across
all 12 profiles and a separate identity ledger under ignored `exports/`, then
reproduced both byte-identically. The committed protocol seed separates the
draft-only, generic-revision, actual-critique, and matched-wrong-critique arms
but remains explicitly unauthorized and incomplete until routes, sample size,
seed, endpoints, dispositions, and attempt/spend ceilings are chosen.

Verification: focused service/CLI tests 6/6; all 319 source hashes; two
byte-identical report/packet reruns; ESLint and Prettier clean; analysis registry
113/113; hermetic test manifest synchronized; workplan 611/611; diff check
clean. Model/provider calls: 0 completed, 0 failed, 0 reserved, hard ceiling 0.
