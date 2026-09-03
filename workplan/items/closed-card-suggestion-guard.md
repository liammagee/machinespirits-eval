---
id: closed-card-suggestion-guard
title: "Prevent stale suggestions from reopening closed workplan cards"
status: done
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-09-03
updated: 2026-09-03
verification: "Repository, workplan contract, and ms-workplan skill require a live exact-card status check and explicit user intent before reopening closed work."
tags: [workplan, agents, skills, stale-context]
---

# Guard closed cards from stale continuation suggestions

Historical task context can retain an intermediate next action after the
authoritative workplan item has reached a terminal state. Require every agent
and the conversational workplan route to refresh the exact item source before
offering continuation.

## Acceptance

- [x] Repository-wide instructions require a current exact-card read.
- [x] The workplan contract defines terminal-status suggestion behavior.
- [x] The `ms-workplan` skill suppresses stale next actions and requires an
  explicit user request to reopen a closed item.
- [x] The maintained Claude skill mirror is refreshed and skill/workplan
  validators pass.

## Log

- 2026-09-03: Added the closed-card suggestion guard after an intermediate
  assessment-recovery instruction resurfaced after its experiment card was
  already complete.
