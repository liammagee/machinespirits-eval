# Relay STATE — read this first, then the current direction. Nothing else is required.

**Maintained by the reviewer. Updated at every direction. History files
(001-…, audit) are evidence — read them only when this file points at them.**

## Now

- **UNATTENDED MODE ACTIVE** (human authorized 12 Aug ~14:20): see
  `023-reviewer-note-unattended-mode.md` — reviewer may re-invoke the
  idle driver headless; driver envelope: timebox repairs, ≤48-call
  probes on burned turns, reserve-seed relaunches (507-510) at
  predicted discard ≤15%, matrix gate ruling. Reviewer-gated (no
  human): prereg freeze → pilot → main block. Hard stops for the
  human: seeds exhausted, semantic-contract changes, missing
  value/authority, 4,000-call budget, contamination. Ends when the
  human says so; minimum goal = matrix gate PASS.
- **HARD STOP — WAITING ON THE HUMAN** (16:40; report
  `029-codex-report.md`, merged at `40022061`). Seed 509
  coverage-halted at 25/128 = 19.53% unanalyzed; ZERO cap blocks (the
  028 repair worked). All losses are the analysis seat breaking
  written rules: missing catalogue targets, forbidden value/component
  sets, non-public identifiers, non-literal spans, non-atomic
  overlaps — reader/model error, not contract ambiguity. Three
  disjoint paid probe blocks over the burned returned analyses:
  8/48, 12/48, 7/35 — none inside the 15% relaunch line; pooled
  20.61%. Seed 510 unburned and FROZEN. Calls spent 1,085/4,000.
  Driver exited cleanly; DO NOT relaunch until the human chooses:
  (1) redesign/cut the live semantic-typing layer prospectively;
  (2) a different analysis seat or an openly registered new
  coverage/relaunch criterion; (3) stop the matrix programme here.
  Reviewer note: reviewer direction 029 (freeze + zero-call
  diagnosis) crossed with the driver's own equivalent work — its
  concentration-by-profile split remains undone and is the first
  zero-cost input to the human decision.
- Prior reviewer position on the seed-509 relaunch (15:50, from the live
  log; the driver's report is still pending): seed 507 crashed on a
  transport defect (parent finalization validated a partial reader
  catalog mid-run) with coverage INSIDE the line (8.93%); seed 508
  coverage-halted at 22.9% (10 frozen-validator discards + 1 cap
  block); the driver applied the 028 cap repair plus the finalization
  and parity repairs and relaunched at seed 509. ACCEPTED, on this
  arithmetic: pooled live discard across 507+508 is 13/101 ≈ 12.9%,
  inside the 15% relaunch line; the 47-call probe's 27.7% predates the
  byte-identical probe/live parity proof and measured a rewritten
  prompt, so it overestimates. The driver's report must state this
  pooling explicitly and give per-seed cause splits. **TRIPWIRE: if
  seed 509 coverage-halts, the pooled prediction is above the line —
  seed 510 must NOT be spent without a fresh reviewer ruling. A 509
  halt is a stop-and-report boundary.**
- **Defect ledger:** `DEFECT-LEDGER.md` — every systematic harness
  defect and its regression guard, plus the standing policy (human,
  12 Aug): systematic transport defects are WARNINGS inside the
  registered coverage line; restart only on a failed gate; never patch
  a live run; never waive a failed gate post hoc. Keep it current —
  new systematic defects get an entry with their guard test.
- **Contingency on file:** `028-reviewer-direction-prompt-cap-contingency.md` —
  applies ONLY if the seed-507 matrix coverage-halts or fails its gate
  with prompt-audit overflow as a cause (turn-8 analysis prompts
  exceed the 42,000-char audit cap; loss is systematic on late turns).
  Pre-declared replacements: maxChars 56,000, maxApproxTokens 14,000;
  plus a zero-call probe/live prompt-parity preflight assertion;
  relaunch at seed 508; never patch a live run. Every matrix report
  must split unanalyzed turns into audit-overflow vs model-residual
  classes and the gate ruling quotes both.
- **Current direction:** `027-reviewer-direction-template-projection.md` —
  answers report 026 (025's retry ping failed on a missing value at
  `$.semantic_events.extraction_status`, evidence retained). Ruling:
  ping-template defect — the enforced response schema
  (`additionalProperties: false`, single property `events`) makes the
  template's harness-derived envelope fields (extraction_status,
  schema, source_turn, source_text_sha256) unreturnable; the model's
  `{"events":[]}` was the maximal correct copy. Orders: (1) the
  compared template must be the provider-schema view (for
  semantic_events exactly `{"events": []}`); packet and expected value
  identical, schema-shaped; (2) zero-call closure: focused test +
  preflight assertion that the synthetic template VALIDATES against
  the enforced response schema; (3) ONE more retry ping (running
  budget 3 of 4,000 when spent) — pass = launch the matrix at seed
  506 under 022's terms, no stop; fail = STOP with the retained diff,
  no further calls.
  Prior: `025-reviewer-direction-ping-criterion.md` —
  answers report 024 (seed-506 launch stopped at the acceptance ping:
  Luna's response passed schema + strict parse + validator but failed
  a byte-identity comparison against the synthetic template; the
  harness discarded the response). Ruling: transport-harness defect,
  timebox class. Orders: (1) ping harness retains raw + parsed
  response and the first differing field path on any acceptance
  failure, and reports status truthfully; (2) ping acceptance =
  provenance + strict parse + validator + CANONICAL-VALUE equality to
  the template (key order/bytes irrelevant, strings compared under the
  validator's own punctuation normalization; any differing VALUE still
  fails) — ping harness only, live validator untouched; (3) focused
  tests + preflight assertion; (4) ONE retry ping — pass = launch the
  matrix at seed 506 under 022's terms with no stop; fail = STOP with
  the retained diff. Unattended budget spent: 1 of 4,000 (retry makes
  2; matrix ~612 on pass).
  Prior: `022-reviewer-direction-luna-coverage-note.md` —
  021 ran to its hard stop: Luna + handbook_v1 probe 5/48 = 10.42%
  (fail by one call); Sonnet upgrade probe 25/48 = 52.08% (17/48 =
  35.4% after the apostrophe finding below — still fail; Sonnet
  breaks the value/component rule 19 vs Luna's 3). Reviewer probe
  audit: 8 Sonnet "not_literal" discards were byte-matching on
  typographic vs ASCII apostrophes, a harness defect; the fix rescues
  nothing on Luna (its one quote failure is a real misquote). Human
  decision (12 Aug chat): (1) seat back to `codex.gpt-5.6-luna` +
  `handbook_v1` (revert 39757d4e's model pin, keep its guards); (2)
  punctuation-normalized quote matching both seats, mechanical,
  prospective, preflight-asserted; (3) coverage self-halt 10% → 15%
  (first-call gate stays), grounds registered: probe-measured expected
  unanalyzed 10.4% ±~4; per-turn strictness unchanged; matrix report
  must state achieved coverage and the gate ruling must quote it; (4)
  RELAUNCH at reserve seed 506 under the standing authorization.
  After the matrix: gate pass = stop before outcome study (freeze
  prereg from `2026-08-12_outcome-study-design-draft.md`, human go);
  gate fail = stop for review (004 options); ruling 010 fallback
  stands. Reserve seeds 507-510 unchanged. Burned: seed-503, -504,
  -505 corpora + both 021 probe artifact sets.
  Prior: `021-reviewer-direction-prompt-parity.md` — prompt parity
  (handbook rules ported into the live prompt) + pre-authorized
  Sonnet seat try; both probe gates failed; report `5923b99e`.
  Prior: `019-reviewer-direction-offset-derivation.md` — mechanical
  offset derivation both seats (model gives unique literal quote,
  harness derives offsets + overlap), landed at `84e3dcbb`, 126/126
  focused tests, preflight 36/36 `instrument_ready`;
  `017-reviewer-direction-halt-threshold.md` (halt threshold +
  guards), `016-reviewer-direction-seed-lock.md` —
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
