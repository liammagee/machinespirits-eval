---
id: registration-endpoint-channel-map
title: Fail zero-call endpoint preflight when a required channel is unfielded
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-08-27
updated: 2026-08-28
verification: Before provider initialization or production writes, the shared
  deterministic endpoint preflight compares every enabled endpoint's existing
  required_channels with an independent prospective adapter fielding list and
  refuses a mismatch; focused regressions prove the negative and valid paths
  remain zero-call; existing closed runs and artifacts remain untouched.
claim_status: methods
links:
  prs:
    - 837
  notes:
    - docs/adaptation-refinement/relay/DEFECT-LEDGER.md
tags:
  - tutor-stub
  - registration
  - fail-closed
  - codex-sol
  - effort-ultra
branch: codex/registration-endpoint-channel-map
---

Defect 27 in the relay defect ledger: a registered primary endpoint (P3) named
a reader channel the run shape did not field, so the run finished with its
primary endpoint unmeasurable. The repository already expresses the binding as
`endpoints[].required_channels`; this card makes the prospective adapter
honour that declaration before any model or production activity.

## Acceptance

- Reuse the shared deterministic `required_channels` validation and an
  independent prospective adapter fielding list; add no endpoint map or schema.
- Fail zero-call preflight with the endpoint and missing fielded channel named.
- Cover an unfielded required channel and a valid fielded set with focused
  regressions that establish zero model calls and zero production writes.
- Leave existing closed runs, registrations, checkpoints, scores, and relay
  artifacts untouched.
- Retain a close-time assertion only if it detects actual post-preflight channel
  drift that the launch check cannot detect; otherwise omit it as duplicate.

This work adds no endpoint certificate, digest binding, approval schema,
re-signing step, HOLD packet, or other authorization machinery.

## Log

- 2026-08-27: Reshaped around the existing `required_channels` contract and
  activated on `codex/registration-endpoint-channel-map`; implementation and
  verification are zero-call only.
- 2026-08-27: Added optional independent fielding comparison to the shared
  validator and wired the production Stage-2 endpoint preflight to its own
  five-channel fielding list. The focused regression accepts that valid list
  and refuses an enabled `shadow_reader` required by the primary endpoint but
  absent from the adapter before packet building or assembly. The existing
  valid endpoint/GO fixture remains green without regeneration.
- 2026-08-27: Verification passed: focused hermetic root lane 15/15 across
  `adaptiveRegisterSwitchingStage2` and the legacy optional-caller canary;
  targeted ESLint and Prettier; workplan source check 539/539. No close-time
  assertion was added because fielding is immutable after preflight and
  existing child/assembly failures already stop completion. No model call,
  production write, registration, run artifact, certificate, digest, or
  approval file was created or changed.
- 2026-08-28: PR #837 merged with all hosted checks complete and no failed or
  pending checks; the zero-call preflight acceptance evidence above is final.
