---
id: scriptorium-static-tools-desktop-quality
title: Scriptorium static-tool and desktop quality pass
status: triaged
type: infra
priority: P1
owner: unassigned
source: manual
created: 2026-06-23
updated: 2026-06-23
verification: Chat, adjudication, pilot-admin, and Electron desktop parity pass the same shell, responsive, accessibility, and no-console gates as the server-rendered Scriptorium routes.
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
---

Context: folded-in static tools use the shared rail through `rail-inject.js`, but
they still feel like separate products and inherit shell overflow. Electron
route parity exists; product-quality parity needs the same gate as the web app.

Acceptance criteria:
- [ ] Define a shared static-surface shell contract for page title, local toolbar,
      rail/drawer, loading/error states, and control sizing.
- [ ] Bring `/chat/`, `/adjudication/`, and `/pilot-admin/` into that contract.
- [ ] Either redesign `/chat/` for mobile or explicitly gate it as desktop-only
      with a clear in-product message.
- [ ] Extend Electron smoke coverage to include shell state and visual route
      evidence, not route parity alone.
