---
id: scriptorium-ux-safety-net
title: Scriptorium UX safety net and smoke report
status: done
type: infra
priority: P0
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-24
verification: A no-spend Scriptorium UX smoke command checks core routes at
  desktop and mobile widths for HTTP render, console errors, horizontal
  overflow, unlabeled controls, duplicate landmarks, touch-target risks, and
  emits a compact report/screenshots.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
tags:
  - scriptorium
  - ux
  - qa
  - dashboard
branch: codex/ux-enhancements
milestone: desktop-app
---

Context: the UX audit found the app functionally healthy but missing a regression
gate for product quality. This item creates the test harness before the shell is
rewired, so current mobile/accessibility failures can be captured and then driven
to green.

Acceptance criteria:
- [x] Add an npm script such as `scriptorium:ux-smoke` or equivalent.
- [x] Probe `/`, `/browse`, `/derivation`, `/compose/live`, `/runs`, `/board`,
      `/chat/`, `/adjudication/`, and `/pilot-admin/` without paid calls.
- [x] Check desktop and 390x844 mobile viewports.
- [x] Fail on horizontal overflow, top-level console errors, unlabeled core form
      controls, and missing accessible names on primary actions.
- [x] Emit a small report under `outputs/` with screenshot paths and route
      findings.
