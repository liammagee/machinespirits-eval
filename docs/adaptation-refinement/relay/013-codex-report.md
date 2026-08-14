# 013 — Codex report: live extraction seat repaired; rerun remains human-gated

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-D`

**Failed matrix source:** `36d2e63f134c631305ec7216870f36a5bb1af473`

**Repair freeze commit:** `575801bc92d9c6c31afcd49690f88014c32da224`

**Branch at report:** `adaptation-refinement`

**Status:** diagnosis and prospective repair complete; zero-call preflight passed;
acceptance ping prepared but not launched; representative rerun not launched

## Failure taxonomy from the preserved matrix

I re-read the 24 detailed trace files under
`/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f/jobs`. The mutually
exclusive primary classification accounts for all 137 failed learner-analysis
calls:

| Primary failure class | Calls | Worked example or disposition |
| --- | ---: | --- |
| Provider schema rejection | 0 | No instance. The failed live seat was using interactive/schema-free parsing, so no provider output schema was sent for the provider to reject. |
| Response parse failure | 7 | `world_022_foxtrot_jukebox-answer_seeking-intervening-r1-s503`, turn 2, trace sequence 66: invalid JSON at position 2815 (`Expected ',' or '}' after property value`). |
| Runtime semantic-validator rejection | 130 | The same job, turn 1, trace sequence 30: the learner asked, “What exactly should I write next—what public exhibit should I examine?” The response emitted a second `tutor_selection_request` with `target={"state":"none"}` and was rejected by `events[1].target:required_for_speech_act`. |
| Timeout | 0 | No instance in the 137 failed calls. |
| Other | 0 | No residual failures after parse and validator classifications. |
| **Total** | **137** | Complete partition. |

The validator-rule counts below are incidence counts, not another partition:
one rejected response can violate more than one rule.

| Runtime rule incidence | Count |
| --- | ---: |
| Event 0 evidence span not literal | 49 |
| Event 0 value/component sets forbidden for a non-request | 43 |
| Event 1 evidence span not literal | 42 |
| Event 1 value/component sets forbidden for a non-request | 28 |
| Event 1 target required for speech act | 25 |
| Event 0 target forbidden for speech act | 11 |
| Event 0 action incompatible with speech act | 8 |
| Event 1 action incompatible with speech act | 8 |
| Event 1 invalid evidence-span offsets | 7 |
| Event 0 invalid uncertainty array | 7 |
| Event 0 target required for speech act | 7 |
| Event 0 request executor equals speaker | 6 |
| Source-text hash mismatch | 6 |
| Event 1 request executor equals speaker | 5 |
| Event 1 invalid uncertainty array | 4 |
| Event 0 invalid public-identifier array | 4 |
| Event 0 invalid component array | 4 |
| Event 1 target forbidden for speech act | 3 |
| Event 0 invalid evidence-span offsets | 3 |
| Event 1 action forbidden for speech act | 2 |
| Event 1 invalid component array | 2 |
| Event 2 evidence span not literal | 2 |
| Event 2 target required for speech act | 2 |
| Six remaining one-off rule incidences | 6 |

The root cause is therefore specific: the deterministic validator was already
enforcing the certified act contracts, but the live V3 call still selected the
legacy `interactive` parse mode. That path sent no provider schema and asked for
sparse free JSON. The model could return shapes that the stricter runtime then
correctly rejected. The 7 malformed JSON responses are the same boundary in its
parse form; the 130 typed rejections are its semantic form.

The failed matrix remains preserved, unscored, and excluded from pooling. The
single `world_028` delivery rejection remains unchanged because that gate was
working as intended.

## Prospective repair

Commit `575801bc` makes the following bounded changes without changing the
reader instrument, rubric, thresholds, or representative sampling design:

1. The V3 live learner-analysis seat now uses strict structured output in the
   existing per-turn analysis call. It sends the provider schema and retains the
   certified runtime validator; it does not add a model call.
2. Local and provider semantic-event schemas are generated from one shared,
   act-discriminated schema and the same
   `ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS` table. All 15 speech acts
   have total target/action fields, explicit `none` branches where permitted,
   and closed executor/mode/action domains.
3. Any analysis failure produces
   `machinespirits.tutor-stub.learner-analysis-no-signal.v1`, with
   `analysis_status=unanalyzed` and `signal.state=none`. The marker is excluded
   from tutor prompt projection. The technical trace separately records a
   `learner_analysis_unanalyzed` coverage hit and the failure code/message.
4. The zero-call preflight now audits both live schemas for totality,
   act-contract equivalence, disjoint unions, supported provider keywords, and
   nesting depth, and statically rejects the old fallback sentinel on all named
   prompt-assembly paths.
5. The one-call schema-acceptance harness now binds the full live analysis
   envelope (`classification`, `learner_record`, `semantic_events`) rather than
   the independent-reader response schema. Its synthetic case remains
   permanently excluded from research evidence.

Focused validation passed 73/73 tests before the freeze. The full hermetic suite
then passed at the exact repair commit:

- root Node suite: 8,503/8,503 passed;
- in-housed tutor-core suite: 137/137 passed;
- total: 8,640 passed, 0 failed, 0 skipped.

## Preflight and acceptance-ping status

The repair was checked from the clean detached worktree
`/private/tmp/ms-adaptation-refinement-575801bc`.

The zero-call preflight passed 33/33 checks with verdict `instrument_ready`:

- artifact:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-preflight-575801bc.json`;
- SHA-256:
  `904decbbf8f91be98d42516e07f043070cd551798af002e69586a894e780cf7f`;
- both live schemas: total, provider-compatible, pairwise-disjoint,
  act-contract-equivalent, and depth 5 against the maximum 10;
- fallback sentinel leak paths: zero.

The acceptance ping is frozen and locally validated, but it was **not run** and
made **zero provider calls**:

- freeze:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-acceptance-575801bc/schema-acceptance-freeze.json`
  (`a01385d67fa18d567a2cab18ba9c64d85f634f652f0a733a084c9327deffa7fe`);
- response schema:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-acceptance-575801bc/response.schema.json`
  (`cee65bd05c9d374e6803bd79caf2f6d47e605c247e3b8e8b38cd2b95f6700b43`);
- packet:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-acceptance-575801bc/schema-acceptance.packet.json`
  (`b5e2078d05b63eae4a86fcbcaf3287796bc71e98044e9427f405021ef2d2f62d`);
- authorization request:
  `/private/tmp/adaptive-warrant-v3-live-seat-repair-acceptance-575801bc/schema-acceptance-authorization-request.json`
  (`99ac30a3fabd8213ff547f60e9e5a84c6cc3aa210447980cc4ccb2869e822314`);
- approval digest:
  `c28df586a105cf1c846fe4f065a43328a9494a91215aa67ef8fdfb02a79f93cc`.

Local inspection confirmed that the frozen response schema has the live root
fields and all 15 semantic act branches, and that its supplied response template
passes the real strict parser. No fresh semantic smoke, reader run, representative
matrix, or outcome run was launched.

## Quota-window reading and stop boundary

The local route reports `codex-cli 0.147.0` and `Logged in using ChatGPT`. The
CLI exposes no numeric remaining-quota reading, so exact headroom is unavailable
without spending a probe call. The previous failed matrix used 612 calls; a
fresh matrix retains the same approximately 612-call expectation and 1,536-call
ceiling, plus one permanently excluded acceptance-ping call before launch.

The repository repair and zero-call prerequisites are complete. The next
provider action is the one-call live-schema acceptance ping, followed—only if it
passes and the human authorizes the rerun—by a wholly fresh representative
matrix with a new seed under the unchanged frozen design. Per relay 012 and the
human instruction, this report stops before both actions.
