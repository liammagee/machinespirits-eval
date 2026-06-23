---
id: scriptorium-responsive-shell-navigation
title: Scriptorium responsive shell and navigation model
status: done
type: infra
priority: P0
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Core Scriptorium and injected static routes have no horizontal
  overflow at 390x844 or 768x1024, the mobile shell uses a compact app
  bar/drawer, and route parity/browser tests still pass.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items: scriptorium-ux-safety-net
tags:
  - scriptorium
  - ux
  - navigation
  - mobile
branch: codex/ux-enhancements
---

Context: the audit measured 1,000-1,350px document widths on mobile routes. The
shared rail is a good single source of truth, but its responsive rule only hides
the subtitle; it does not become a mobile navigation model.

Acceptance criteria:
- [x] Refactor `railHtml()` into desktop rail plus mobile app bar/drawer.
- [x] Group navigation into Observe, Create, Review, Reference, and Admin.
- [x] Keep current route visible without opening the drawer.
- [x] Raise mobile/touch targets to at least 40px, preferably 44px.
- [x] Preserve `rail-inject.js` parity for `/chat/`, `/adjudication/`, and
      `/pilot-admin/`.
- [x] Pass route parity, poetics browser tests, and the UX smoke gate.
