---
id: paid-study-endpoint-runtime-preflight
title: Fail closed when a paid study cannot measure its registered endpoints
status: done
type: infra
priority: P1
owner: codex
source: review
created: 2026-08-17
updated: 2026-08-17
verification: Before any paid model call, the exact production path passes a
  synthetic full-scale preflight that maps every registered primary endpoint to
  an enabled scorer or reader, proves its required events are emitted, keeps
  frozen packets within their limits, preserves denominator and pairing rules
  through sharding, and assembles the complete corpus; negative regressions
  prove that each mismatch stops launch before provider initialization.
links:
  paper: §6.26
  items:
    - guarded-learner-outcome-study
    - edged-register-outcome-study
tags:
  - registration
  - paid-study
  - preflight
  - fail-closed
  - scoring
branch: codex/paid-study-endpoint-runtime-preflight-implementation
---

Paper §6.26 records the defect this prevents: the guarded-learner registration
named P3 as its primary endpoint, but the main reader phase disabled the
presence-reader channel P3 required. The completed corpus therefore could not
answer its registered primary question until a separately registered late read.
The frozen presence packets also exceeded their byte cap at the registered
scale. Neither mismatch was detected at seal or launch time.

This is an infrastructure repair, not another guarded-learner run. It must land
before the next paid study. PR #650's GO-note hardening remains complementary:
that check proves the launch authorization is a signed GO note; this card proves
the authorized run can actually measure what its registration promises.

Acceptance:

- Define a machine-readable endpoint contract that binds each registered
  primary endpoint to its enabled scorer or reader, required runner events,
  denominator, pairing/sharding rule, packet builder, and result assembler.
- Run the exact production packet-building and assembly path on a synthetic
  corpus at the registered full scale before provider initialization or any
  paid call.
- Fail closed when a required scorer or reader is disabled, a required event is
  absent, a packet exceeds its frozen limit, sharding changes the denominator or
  pairing, or assembly does not cover the synthetic corpus exactly.
- Make reader removal or endpoint demotion invalidate every dependent endpoint
  automatically rather than relying on prose review.
- Record the endpoint-to-code mapping and preflight digest in the committed GO
  certificate so the reviewer can verify the executable contract.
- Add focused positive and negative regressions for every failure class above,
  with zero model calls and no production artifact writes.

Boundary: the late P3 result and its disclosed-amendment label remain unchanged.
This card prevents recurrence; it does not retrospectively convert §6.26 into a
clean pre-registered result or authorize any new paid run.

2026-08-17 — Implemented the reusable endpoint/runtime contract validator and
the first production adapter on adaptive register-switching Stage 2. The
machine-readable contract binds the registered primary and secondary measures
to their enabled scorer/reader channels, emitted events, exact denominators,
scenario-preserving shards, packet cap, and production result assembler. The
zero-call preflight sends all 105 synthetic dialogues through the same five
scenario packets and assembler used by the real report, records zero model
calls and zero production writes, and is checked before launch authorization.
The committed endpoint-GO certificate pins the contract and deterministic
preflight digests without independently authorizing a paid run. Focused
regressions fail closed for a disabled reader, missing event, packet overflow,
split pairing group, incomplete assembly, primary-endpoint demotion, and GO
digest drift.
