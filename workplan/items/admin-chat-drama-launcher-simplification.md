---
id: admin-chat-drama-launcher-simplification
title: Admin chat drama launcher simplification
status: review
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-02
updated: 2026-07-02
verification: npm test plus localhost browser smoke at /admin/chat/
claim_status: planned
tags:
  - admin-chat
  - drama-machine
  - ux
milestone: admin-chat
---

Restructure `/admin/chat/` around the primary admin task: stage and launch a
pedagogical drama with either a human or AI learner, while keeping all existing
architecture, model, curriculum, director, and research controls reachable.

Implementation scope follows `ADMIN-CHAT-SIMPLIFICATION-PLAN.md`: Stage / Fine
controls / Dossier information architecture, dry-run-capable drama concierge,
manual-cell/chip synchronization, resolver alternatives, local restore/export,
and focused tests.
