# 052 — Reviewer direction: presence-grain gate registered; run the confirmation

**Date:** 13 August 2026.
**Authority:** the human's ruling ("register the coarse gate and buy
the confirmation run"), relayed by the second session and recorded in
the registration; ruling 051 option 3, narrow form. Spend authority is
the 8,000-call ceiling the human set directly in the reviewer session
(3,337 spent; 186 planned; 3,523 end state). A relayed ceiling renewal
is on record but not relied on.

**Lease:** `DRIVER-LEASE-2026-08-13-M`. Report to
`053-codex-report.md`.

**Registration (authoritative for every scoring rule):**
`docs/adaptation-refinement/v3-semantic-reader-presence-gate-registration.md`,
committed before this direction. Read it in full first. The r49
responses are design pilot only — never score them under the new gate,
never pool them.

## A1 — Presence-gate scorer (zero-call)

1. Write `scripts/score-semantic-reader-presence-gate.js`
   implementing the registration exactly: presence and flag
   extraction per §2, floors per §3, reported-not-gating metrics per
   §4 (both object-set extractions, pinned separately, plus strict
   canonical identity with the diff profile and catalogue-binding
   failure counts). Output one JSON report plus a human-readable
   summary; every floor check fail-closed.
2. Guards, committed with the scorer:
   (a) synthetic reader pair agreeing on flags + both presences
   scores as consensus;
   (b) presence disagreement on either speech act scores
   non-consensus;
   (c) a schema-invalid or missing response file scores all its cases
   non-consensus (fail-closed), not a crash;
   (d) a case failing catalogue binding still scores at the presence
   grain;
   (e) floor arithmetic: a synthetic 71/93 consensus set FAILS, 72/93
   with the other floors met PASSES;
   (f) the two object-set extractions are computed from different
   slots (a fixture where they differ must report different sets).
3. Preflight: digest-identity on all seven §1 registration constants
   (corpus, extraction schema, provider schema, one-case response
   schema + byte count, packet, preparer SHA, reader digest) plus
   both caps. Any mismatch = hard stop, report, end.
4. Focused suites + preflight green, zero-call. Commit.

## A2 — Confirmation run (paid)

5. Prepare the confirmation reader collection from the unchanged
   frozen corpus at the one-case partition, bound to the A1 commit.
   Record the planned call count (93 × 2 = 186) in the manifest
   BEFORE any call.
6. Run readers A and B from scratch. Parallel two-wide is allowed
   (bridge calls are atomic and stateless); do not exceed two
   concurrent calls. Nothing from r47 or r49 is admitted or pooled.
7. Score with the A1 scorer, zero-call. The scorer's verdict is the
   gate outcome — the reviewer rules on it from report 053.

## Report 053 must carry

- The registration pointer and a one-paragraph pilot disclosure (r49
  used only to set floors; floors fixed before any confirmation
  call).
- The full floor table with confirmation values beside pilot values.
- The reported-not-gating metrics (§4), including BOTH object-set
  figures labelled by extraction slot.
- Budget arithmetic from 3,337/8,000 (every
  `model_call_budget_reserved` event = one attempt).
- The drop log and 93/2/3 disclosure carried forward; both coverage
  rates quoted (checkpoint 139/144 = 96.53%; final 187/192 = 97.40%).
- Run SHA and collection manifest SHA.

## Unchanged

Never patch a live run; never waive a failed gate post hoc; a FAIL on
any floor is terminal for this layer (one attempt — see registration
§3); the two dropped cases stay excluded forever; seed 515 unspent;
human hard stops per direction 038 (contamination, the 8,000 ceiling,
unexplained coverage loss); commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention; NEVER
push.
