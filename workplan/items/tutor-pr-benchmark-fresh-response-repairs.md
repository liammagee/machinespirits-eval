---
id: tutor-pr-benchmark-fresh-response-repairs
title: Repair the four fresh tutor PR benchmark response failures
status: review
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-08-05
updated: 2026-08-05
branch: codex/tutor-pr-benchmark-four-failure-repair
verification: Frozen replay refreshes the current standing tutor rules without changing its public prefix; exact regressions preserve declarative handoff ownership, public-only exhibit correspondence, and bounded advocate realization; focused, static, zero-skip hermetic, and fresh six-call strong tutor PR benchmark gates pass.
depends_on: []
links:
  items:
    - tutor-pr-frozen-prefix-benchmark
    - tutor-pr-benchmark-calibration-harness
    - guard-ladder-ships-canned-text-on-most-turns
  code:
    - services/tutorStubEvidenceAssertion.js
    - services/tutorStubFrozenReplay.js
    - services/tutorStubPromptBlocks.js
    - services/tutorStubFirstDraftContract.js
    - services/tutorStubResponseConfiguration.js
    - tests/tutorStubFrozenReplay.test.js
    - tests/tutorStubFirstDraftContract.test.js
    - services/__tests__/tutorStubResponseConfiguration.test.js
    - services/__tests__/tutorStubEvidenceAssertion.test.js
    - tests/tutorStubV27ConfirmationRegression.test.js
tags:
  - tutor-stub
  - first-draft
  - benchmark
  - guards
milestone: evaluation-infrastructure
---

The strong tutor PR benchmark run on merged-terminal-runtime commit `c0b908bd`
produced four failed jobs across its six fresh model calls. Same-response
re-audit showed no audit-code regression, but inspection found three bounded
current defects rather than four unrelated failures:

1. Three Claude responses asked questions despite a declarative handoff. Frozen
   replay recompiles the current host plan but retains the fixture's older
   standing system prompt, whose higher-priority generic rule still requests a
   final question. The live prompt has already made question preference
   conditional on the compiled handoff.
2. The period-source examiner response described stock-book dates as physically
   matching the watermark. Its public inference was licensed, but that enacted
   comparison asserted an unsupported exhibit correspondence.
3. The counterpressure response began `My case is`, named the public support,
   and bounded what it did not establish, yet the advocate recognizer rejected
   it because the declarative boundary lacked a narrow challenge/test token.

Keep the benchmark's frozen public prefix, no-repair, and no-fallback invariants.
Do not weaken the leak, question-support, or turn-progression audits to make the
saved failures pass. Refresh only current standing prompt rules, make the
examiner's cross-exhibit boundary explicit, and recognize only the bounded
first-person advocate construction evidenced by the failed response.

Log:

- 2026-08-05 — Activated after PR #498 merged and its full CI matrix passed.
  Started an isolated worktree from `origin/main` at `2e01727d`. The source
  benchmark report is the pre-push strong run for `c0b908bd`: 2/6 fresh jobs
  passed, with four failed jobs and six hard findings; the saved-response
  re-audit had 0 regressions.
- 2026-08-05 — Implemented three bounded repairs without weakening an audit:
  frozen request refresh now migrates only the three exact legacy standing
  question lines; examiner instructions forbid unstated cross-exhibit matches;
  and the advocate recognizer accepts a concrete first-person case only when it
  names both public support and an evidentiary limit. Updated the pinned V27
  audit expectation for that same recognition correction while preserving its
  unrelated hard failures.
- 2026-08-05 — Deterministic validation passed: focused repair tests 202/202;
  prompt/world boundary tests 62/62; derivation quality 35/35; root hermetic
  7,813/7,813 with zero skips; tutor-core hermetic 137/137 with zero skips;
  lint, formatting, import-cycle, workplan-source, hermetic-manifest, and
  baseline-manifest checks all green. The fresh strong benchmark remains
  pending explicit authorization to send six frozen prompt payloads to the
  external Codex and Claude CLI services.
- 2026-08-05 — With explicit authorization, ran the six-call strong benchmark:
  5/6 fresh jobs passed, 0 blocked. All three former forbidden-question jobs
  and the former unsupported-correspondence job passed. The sole miss was a
  Claude advocate response that stated `My case is`, public support, and an
  explicit `supports only ..., not the period ... not who` limit; the narrow
  recognizer did not yet admit that grammatical form.
- 2026-08-05 — Added the support-only/not-the advocate form while retaining the
  unbounded-case negative control. The exact saved fresh response then
  re-audited 6/6 with no hard or safety findings, and the expanded focused
  suite passed 204/204. The original fresh report remains unchanged at 5/6 so
  its chronology is honest; a wholly fresh post-fix six-call gate remains
  pending separate authorization rather than being treated as a retry.
- 2026-08-05 — Final post-repair root hermetic sweep passed 7,814/7,814
  across 597 files with zero skips.
- 2026-08-05 — Rebased the uncommitted repair diff without conflict onto
  `origin/main` at `b12295dd`. Post-rebase preflight passed derivation quality
  35/35, prompt/world tests 21/21, and the focused repair suite 204/204.
- 2026-08-05 — Ran the separately authorized wholly fresh strong benchmark:
  all six calls completed, 5/6 passed, and 0 were blocked. The sole Codex miss
  said `I trace the entry: it dates the nocturne to that span`; the watermark,
  stock-book period, and public dating rule license that conclusion, but the
  evidence-correspondence regex incorrectly carried `trace` across the colon
  to the later `to` and classified it as an invented exhibit match. Report:
  `/private/tmp/tutor-pr-benchmark-four-failure-repair-postfix-fresh/report.md`.
- 2026-08-05 — Made colon a correspondence-clause boundary and added the exact
  positive case plus a post-colon invented-match negative control. The exact
  six fresh responses now re-audit 6/6 with 1 improved and 0 regressed using
  zero additional model calls. This preserves the original 5/6 report and the
  chronology; another wholly fresh final-code run is not claimed or spent
  without separate authorization.
- 2026-08-05 — Final validation after that calibration passed: expanded focused
  suite 220/220; root hermetic 7,831/7,831 across 599 files with zero skips;
  tutor-core hermetic 137/137 with zero skips; lint, formatting, import-cycle,
  workplan-source, hermetic-manifest, baseline-manifest, and diff checks green.
- 2026-08-05 — Committed the repair at `b7c39664` and ran the authorized strong
  benchmark from that clean committed tree through the pre-push hook. All six
  fresh jobs passed, with 0 failed and 0 blocked; no repair, fallback, retry,
  learner regeneration, or dialogue continuation ran. The Git-local report is
  `.git/machinespirits-reports/tutor-pr-benchmark/hook/b7c39664db28a37d8654ae3045a6318ae2265953/report.md`.
  Moved the item to review for PR handoff.
