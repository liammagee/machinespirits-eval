---
id: scriptorium-static-tools-desktop-quality
title: Scriptorium static-tool and desktop quality pass
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Chat, adjudication, pilot-admin, and Electron desktop parity pass
  the same shell, responsive, accessibility, and no-console gates as the
  server-rendered Scriptorium routes.
links:
  notes: notes/poetics/2026-06-23-scriptorium-dashboard-ux-audit-plan.md
  items:
    - scriptorium-responsive-shell-navigation
    - scriptorium-ux-safety-net
tags:
  - scriptorium
  - ux
  - desktop
  - static-surfaces
branch: codex/ux-enhancements
---

Context: folded-in static tools use the shared rail through `rail-inject.js`, but
they still feel like separate products and inherit shell overflow. Electron
route parity exists; product-quality parity needs the same gate as the web app.

Acceptance criteria:
- [x] Define a shared static-surface shell contract for page title, local toolbar,
      rail/drawer, loading/error states, and control sizing.
- [x] Bring `/chat/`, `/adjudication/`, and `/pilot-admin/` into that contract.
- [x] Either redesign `/chat/` for mobile or explicitly gate it as desktop-only
      with a clear in-product message.
- [x] Extend Electron smoke coverage to include shell state and visual route
      evidence, not route parity alone.
