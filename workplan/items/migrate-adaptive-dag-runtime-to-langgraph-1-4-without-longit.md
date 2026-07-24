---
id: migrate-adaptive-dag-runtime-to-langgraph-1-4-without-longit
title: Migrate adaptive DAG runtime to LangGraph 1.4 without longitudinal drift
status: triaged
type: maintenance
priority: P2
owner: unassigned
source: review
created: 2026-07-24
updated: 2026-07-24
verification: "LangGraph 1.4 or newer passes the DAG longitudinal contract, the full hermetic suite, and a production audit with no LangGraph/UUID advisory"
---

The 0.6.0 release audit tested LangGraph 1.4.8. It changed the key mock
longitudinal DAG result from six rows to four, failing
`tests/dagResistanceCharacterDevelopment.test.js`. Restoring and exactly
pinning 1.2.9 recovered the six-row contract, but leaves two moderate
LangGraph/UUID production advisories.

## Acceptance criteria

- Identify the LangGraph 1.4 lifecycle or persistence change that drops two
  longitudinal rows.
- Adapt the runtime without weakening the existing six-row regression
  contract or altering historical evaluation semantics.
- Upgrade LangGraph and its UUID dependency to non-advisory versions.
- Pass focused adaptive/DAG tests, the full hermetic suite, risk coverage, and
  the production dependency audit.

## Log

- 2026-07-24: 1.4.8 failed the isolated longitudinal test; 1.2.9 passed and was
  pinned for the 0.6.0 release.
