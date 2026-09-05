---
id: superego-critique-causal-replay
title: Register and implement the prospective four-arm superego critique replay
status: blocked
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-09-04
updated: 2026-09-05
verification: Reproduce the frozen-unit plan without calls; verify runner ceilings, blinding, durable missing-only recovery and focused regressions; review design and hosted CI before explicit GO and separate launch authority.
branch: codex/superego-critique-causal-replay-format-repair
blocked_by: superego-critique-measurement-calibration
claim_status: planned
links:
  items:
    - superego-critique-causal-link-followup
  notes:
    - notes/superego-critique-causal-replay-design.md
    - notes/2026-09-04-superego-critique-causal-replay-go.md
    - notes/2026-09-05-superego-critique-causal-replay-launch.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/1018
    - https://github.com/liammagee/machinespirits-eval/pull/1021
    - https://github.com/liammagee/machinespirits-eval/pull/1028
---

New prospective study arising from merged PRs #1017/#1018. Historical source
items, results and traces remain unchanged. Design-phase authority covered
implementation, zero-call verification, commit, push, PR and CI monitoring.
The user has now approved the study and authorized recording the GO note.
Separate launch authority remains required; no provider calls or calibration
packet labeling are authorized by this recording step.

Acceptance: one unversioned executable design; a deterministic frozen sample
and donor schedule; separate semantic and blind-quality lanes; explicit
indeterminate and missing dispositions; bounded durable runner using the shared
launch contract; focused regression evidence; compact review table and proposed
GO text. After GO, record the user's note, but await separate launch authority.

2026-09-04 Codex: Verified #1018 merged at 166fa927 and branched from fresh
origin/main c4607dc8 in an isolated worktree. The final zero-call plan retains
194 independent first-draft units (all four arms), verifies all 319 historical
traces and both original calibration-packet hashes, and reproduces exactly.
No historical source or result changed. The standalone runner adopts shared
launch admission and durable accounting, with 3,686 planned calls plus 190
technical-recovery attempts and a $300 ceiling. The confidence/fulfillment,
material-change and quality fields remain separate; no learner evidence is
created. Full-request capture limitations and unvalidated semantic judgment are
explicit scientific risks.

Verification: 44/44 focused tests across the new runner and shared launch,
launcher-inventory and historical follow-up boundaries; 52/52 structural
ratchets; full lint:all; workplan source check; manifest/inventory checks;
byte-identical 194-unit plan reproduction. Provider calls: 0. Local evidence:
exports/superego-critique-causal-replay-final-plan/. Hosted CI passed on the
design implementation commit 33bd6251: 18 successful checks and 3 skipped.

2026-09-04 Codex: The user replied "Go" to the review-ready design and proposed
note. Recorded that exact approval in
notes/2026-09-04-superego-critique-causal-replay-go.md: 3,686 planned calls,
190 recovery attempts, 3,876 total attempts and US $300 maximum. The study
design and runtime are unchanged. PR #1021 remains open; the design must be
merged before launch. No model calls, semantic labels or launch occurred.
Await a separate explicit launch instruction.

2026-09-05 Codex: PR #1021 is merged. The user's subsequent separate "Go"
authorized launch under the unchanged design and $300/3,876-attempt ceilings.
Zero-call preflight reproduced the frozen plan and verified all source traces.
The first request returned HTTP 405: DeepInfra does not support `json_object`
for the pinned Nemotron model. The runner stopped and sealed recovery disabled.
One attempt remains reserved ($0.001408 worst-case reservation; actual cost
unreported), with zero valid generations or judgments. No retry or scientific
conclusion is authorized by this failure. See the launch note for accounting,
claim boundaries and the exact evidence paths. The study remains blocked.

Archival: all ten run artifact files (1,513,445 bytes) verified byte-for-byte
against the private copy; maintained archive check reports zero missing.
Committed and pushed as private archive commit
`9ee055463abb540b2e1eba6e8f391189b7add88b` on
`codex/superego-critique-causal-replay-archive`. The canonical shared study
ledger and both original repository checkouts were preserved. This is a
technical launch failure, with no causal or semantic result.

2026-09-05 Codex: The user asked to fix the incompatibility. The proposed repair
omits the unsupported JSON-mode API option for the Nemotron generator, while
retaining the existing prompt, strict response validation and judge JSON mode.
The shared contract can recognize the first and only dispatched request as an
explicit, durably recorded no-output JSON-mode rejection; recovery removes only
that rejected field and preserves the original attempt, seal and ceilings.
The design is amended in place to make that narrow recovery exception explicit.
No approval note or historical evidence is rewritten, and no provider call is
made during repair. Paid recovery awaits review and GO for the changed stopping
rule; completing the planned jobs would use 3,687 total attempts within 3,876.

Repair verification: 43/43 focused replay/shared-contract/inventory tests;
52/52 structural ratchets; full lint and workplan source checks. Read-only
reconstruction from the actual archived rejection reproduces the frozen
194-unit plan and changes only the rejected response-format field. Regression
tests preserve original bytes and cumulative accounting, reject changes to
messages/routes/decoding/limits, exclude error envelopes containing answers or
usage, and prohibit a third attempt after a repeated failure. Provider calls
during repair: zero.

2026-09-05 Codex: #1032 is merged. Following the user's request to validate and
reconsider, measurement review now precedes restart. See
`superego-critique-measurement-calibration` and the in-place design section for
the complete-input packet, a proposed $15 diagnostic calibration and the
independent human-reference requirement. The original attempt, GO notes and
results remain unchanged; no additional provider call has been made.
