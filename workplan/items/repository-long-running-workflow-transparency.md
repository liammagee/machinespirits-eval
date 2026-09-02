---
id: repository-long-running-workflow-transparency
title: Make long-running workflow phases and handoffs transparent
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-09-02
updated: 2026-09-02
verification: Focused status, action-outcome, reporter, atomic-recovery, skill, formatting, manifest, and source-workplan checks pass without model/provider calls or sealed-artifact mutation.
branch: codex/long-running-workflow-transparency
links:
  code:
    - AGENTS.md
    - services/longRunningWorkflowStatus.js
    - services/actionOutcomeCollectionWorkflowStatus.js
    - scripts/report-long-running-workflow-status.js
    - scripts/report-tutor-stub-study-status.js
    - scripts/run-tutor-stub-action-outcome-collection-pilot.js
    - scripts/audit-tutor-stub-action-outcome-collection.js
    - scripts/action-outcome-review-packet.js
    - .agents/skills/ms-long-running-workflow/SKILL.md
  items:
    - tutor-stub-long-running-study-transparency
    - tutor-stub-study-status-skill
    - adaptive-curriculum-memory-controller
  prs:
    - 950
tags:
  - observability
  - workflow
  - tutor-stub
  - status
  - zero-call
milestone: evaluation-infrastructure
---

Add a repository-wide, human-readable contract for long workflows so phase
completion, handoff gaps, model activity, unit/call accounting, ETA evidence,
repairs, and true terminal state survive coordinator interruption.

Acceptance:

- Root agent rules and one canonical `.agents/skills` entry require a complete
  phase plan, 60–90 second reporting, explicit handoffs, evidence-based ETA,
  and repair disclosure before a repair branch or PR.
- One versioned atomic and recoverable status record covers phases, units,
  calls, timing, blockers, next action, human-action state, model activity, and
  repair/recovery history.
- The action-outcome generation → extraction → audit → packet path is the first
  adopter and cannot report whole-workflow completion at generation seal.
- Tutor-study status defaults to the requested concise prose headings; JSON is
  explicit and ETA is inferred only from defensible timestamp evidence.
- Focused regression and repository checks pass with no provider/model calls,
  experiment execution, or sealed-data changes.

Out of scope:

- Migrating every historical runner in this PR, changing any study design,
  scientific threshold, call ceiling, model route, authorization artifact, or
  existing result, and launching or recovering any experiment.

Log:

- 2026-09-02 — Started from current `origin/main` at `e6515b85a` in the clean
  isolated `codex/long-running-workflow-transparency` worktree. The canonical
  checkout's unrelated edits remain untouched. This is zero-call engineering;
  model activity is inactive and no experiment launch, resume, retry, or
  recovery is in scope.
- 2026-09-02 — Implemented the versioned atomic status contract, generic prose
  reporter, canonical long-workflow skill, strengthened agent rules, and the
  action-outcome generation/extraction/audit/packet adoption without changing
  any design or sealed artifact. Generation now seals to `HANDOFF_PENDING` with
  model activity inactive; only successful packet completion reaches
  `WORKFLOW_COMPLETE`.
- 2026-09-02 — Verification passed: 49 focused status, action-outcome, packet,
  and tutor-reporter tests; 6 skill-sync and static-cycle tests; full
  `lint:all`; synchronized hermetic manifest; canonical skill validation and
  permission checks; Prettier and diff checks; and 591/591 source workplan
  items. The optional skill-creator Python validator could not start because
  the host lacks PyYAML; the repository's authoritative skill validator passed.
  No provider/model call, experiment execution, or sealed-data write occurred.
- 2026-09-02 — Opened review-ready PR #950 from commit `32beae352`; hosted CI
  started and the PR remains unmerged.
