---
id: claude-skill-permission-hardening
title: Remove blanket tool preapproval from repository skills
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-27
updated: 2026-07-27
verification: No repository-local SKILL.md declares allowed-tools; a dependency-free
  policy check rejects future skill-local preapprovals in CI, and configured skill
  mirrors remain synchronized.
links:
  code:
    - scripts/sync-agent-skills.js
    - tests/skillSync.test.js
    - config/agent-skill-sync.json
    - .github/workflows/test.yml
  notes: https://github.com/liammagee/machinespirits-eval/issues/74
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/297
    - https://github.com/liammagee/machinespirits-eval/pull/300
tags:
  - agent-skills
  - permissions
  - security
milestone: evaluation-infrastructure
branch: codex/claude-skill-permission-hardening
---

Repository-local skills declared bare `Bash` in `allowed-tools`. Claude
interprets that field as permission to use the listed tools without asking
while a skill is active, so a bare shell entry created a much broader authority
boundary than the skill's documented workflow required.

Acceptance:

- Remove `allowed-tools` from every repository-local skill root without
  changing skill instructions or intended capabilities.
- Preserve normal interactive permission checks for shell, write, network, and
  provider actions rather than moving those approvals into skill metadata.
- Add a dependency-free repository check that reports the skill, root, file,
  and line for any future `allowed-tools` declaration.
- Run the policy check in CI and cover both rejection and clean-repository paths
  in the existing skill-sync test surface.
- Keep machine-local Claude allowlists and credential cleanup outside this
  source branch; report them as a separate operator action.

Implementation:

- Removed all 55 `allowed-tools` declarations across the Claude, shared-agent,
  and Codex skill roots. No skill instructions or supporting assets changed.
- Added `skills:permissions:check`, which scans every configured skill root and
  fails with root, skill, file, and line diagnostics when a declaration is
  present.
- Added positive and negative regression coverage to the existing skill-sync
  tests and made the dependency-free policy check part of the CI test contract.

Verification completed 2026-07-27:

- `npm run skills:permissions:check` passes with zero declarations;
- `npm run skills:check` reports all configured mirrors synchronized;
- `node --test tests/skillSync.test.js` passes both tests;
- workplan source and schema validation, hermetic manifest synchronization,
  lint, formatting, and diff checks pass.

Post-merge follow-up 2026-07-27:

- PR #294 concurrently added `ms-big-picture` with another `allowed-tools`
  declaration after the original audit branch was prepared. The new main-branch
  CI policy caught it immediately; the follow-up repair removes that 56th
  declaration without changing the skill instructions.
