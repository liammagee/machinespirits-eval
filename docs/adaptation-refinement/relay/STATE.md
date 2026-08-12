# Relay STATE — read this first, then the current direction. Nothing else is required.

**Maintained by the reviewer. Updated at every direction. History files
(001-…, audit) are evidence — read them only when this file points at them.**

## Now

- **Current direction:** `017-reviewer-direction-halt-threshold.md` —
  mid-run: analysis calls return responses but provenance says
  `structuredOutput=false`, so the fail-closed path drops them as
  unanalyzed. Measure the unanalyzed rate over completed turns NOW;
  ≥10% = halt at the dialogue boundary (seed-504 corpus burned),
  zero-call diagnosis of the flag source, fix + preflight extension,
  relaunch at reserve seed 505 (pre-authorized; ping carry-over per
  016). <10% = run to completion, state the rate in the report.
  Prior: `016-reviewer-direction-seed-lock.md` —
  replacement master seed 504 named (reserves 505, 506); the one-line
  seed-lock amendment is authorized; preflight at the amended commit;
  the passed ping carries over if the live schema digests are unchanged
  (else one fresh ping); then LAUNCH the matrix under 014's terms.
  Background: `014-reviewer-direction-rerun-authorized.md` —
  live-seat repair ACCEPTED (report 013: 137 failures = 7 parse + 130
  strict-validator rejections; root cause was the legacy schema-free
  parse mode on the live seat, fixed at `575801bc`). Human authorized
  (12 Aug, in chat): run the one-call acceptance ping from the frozen
  packet; on its pass, the fresh representative matrix (new seed, same
  frozen design, ~612 calls, 1,536 ceiling, attended, checkpointed).
  Ping fail = STOP and report. After the matrix: gate pass = stop before
  the outcome study (own prereg + human go); gate fail = stop for review
  (004 scope-cut options). Ruling 010's mechanism-typing fallback
  stands. The failed 36d2e63f matrix stays preserved, unscored, never
  pooled. Earlier results stand: supplement PASSED (5/2), five-cell
  layer certified, decision readers 0.833 binary.
- **Driver:** the session whose prompt quotes the lease token in 006c
  (currently DRIVER-LEASE-2026-08-12-D). Other sessions: read-only.
- **Instrument commit:** `225a7b07` ("Separate V3 structural and semantic
  gates"). The instrument is CLOSED — it reopens only for a transport,
  schema, provenance, or non-evaluability defect. Never for semantic
  misses, never for lexical patches.

## Certified / pending / burned

- **Certified (from the 225a7b07 24-case diagnostic, 21/24 hard
  consensus):** result requests (8), proposed tests (7), target/value
  partitions (11), tutor-selection requests (2).
- **Pending:** record-entry cell (1 of 2 minimum) — the supplement decides
  it, once.
- **Burned:** every case in the three earlier V3 diagnostic corpora
  (`3ba68de5`, `d2bf37c7`, `7df153d9`), all smoke corpora (excluded by
  class), and the `fcd944f0`/`efcca5f0`/`65d45700` smoke cases. Zero reuse,
  zero pooling. Freeze manifests carry the exclusion hashes.

## Standing rules (compressed; sources: 002, 004, 006)

1. **Gate separation.** Structure gate (hard): schema validity, catalog
   membership, unique literal span, provenance, size, no prohibited
   tools. Semantic quality is measured against consensus, never enforced
   by the validator. No lexical/word-overlap rejection of canonical IDs.
2. **Discriminator.** Reader disagreement is classified in the report:
   both-defensible under the written contract = contract ambiguity =
   blocks; violates a written rule = reader error = data.
3. **Validation economy.** Focused tests + 31-check preflight while
   working; full suite exactly once, at the freeze commit; never after
   report-only commits.
4. **Operational failures** (no artifact, no contract change): fix and
   retry without stopping; note in the report.
4b. **Frozen-constant conflicts** (016): if a direction conflicts with a
   frozen constant and the direction or a predeclared reserve list names
   the replacement value, amend the constant in place, record the
   amendment commit, and proceed — no stop. Stop only when the needed
   value or authority is genuinely absent from the written record.
5. **Pass path (pre-authorized):** preflight → acceptance ping → smoke →
   diagnostic/supplement freeze → readers → support gate → decision
   readers on the certified corpus. **Hard stops:** any contract-
   ambiguity finding, restated-measures sign-off on a supplement fail,
   and the representative matrix (HUMAN-authorized, never launch).
6. **Call ceilings:** ping 1, smoke 2, diagnostic reader run 8.
   Report calls spent every time.

## Key paths

- Scripts: `scripts/run-adaptive-warrant-semantic-brittleness-preflight.js`,
  `…-schema-acceptance-ping.js`, `…-schema-smoke.js`,
  `scripts/build-adaptive-warrant-v3-semantic-diagnostic.js`,
  `scripts/prepare-adaptive-warrant-semantic-annotations.js`,
  `scripts/run-adaptive-warrant-semantic-readers.js`.
- Contract/validator: `services/adaptiveWarrantSemanticAnnotation.js`,
  `services/adaptiveWarrantSemanticEvents.js`,
  `services/adaptiveWarrantSemanticPreflight.js`.
- Latest results: `/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/`.
- Deep background (only if needed): `2026-08-12_v3-instrument-audit.md`,
  `2026-08-12_outcome-study-design-draft.md`, numbered relay files.

## Reporting

Write `relay/NNN-codex-report.md` (next free number), commit with
`--no-verify` and a `Workplan-item: N/A` trailer plus the Co-Authored-By
convention visible in recent relay commits. State: boundary reached,
calls spent, hashes, classification of any disagreement, proceeding or
waiting.
