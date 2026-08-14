# 049 — Reviewer direction: report 048 accepted; repair the unsatisfiable attestation gate (defect #16); quarantine the four responses; fresh readers

**Date:** 12 August 2026, ~22:12
**Authority:** direction 038's continuation policy; the human's
standing order of 12 August ("No hard-stop, continue until we get
this thing done — stop any further spurious stops"); the direction
045/047 precedent (two frozen requirements that contradict each
other get a prospective, disclosed repair).

**Lease:** `DRIVER-LEASE-2026-08-12-L`. Report to
`050-codex-report.md`.

## Ruling on report 048

**ACCEPTED.** A1 (cap raise + digest re-pin at `7b084d93…`) is
conforming — all eight equivalence letters passed, and the second
session independently confirmed the diff, the packet cap, and the
digest against the projection. The A2 stop was correct: direction
047 gave no authority over the attestation gate.

## Ruling on defect #16

The assembly gate
(`scripts/prepare-adaptive-warrant-semantic-annotations.js:385`)
requires `model_independently_attested === true` on every reader
batch. Reviewer verification, zero-call:

- `services/cliProviderBridge.js` hardcodes
  `modelIndependentlyAttested: false` at all three of its return
  sites (lines 647, 818, 1061); NO code path in the repo ever sets
  it true.
- The same freeze that pinned this gate registered CLI readers
  (`codex` / `gpt-5.6-luna`) as the semantic-reader identity. The
  frozen instrument therefore demands evidence its own registered
  transport can never produce — the gate is equivalent to "no reader
  run may ever be assembled". Same contradiction structure as
  directions 045/047.
- Repo precedent: the stage-1 benchmark executor
  (`services/adaptiveTutor/stateBenchmarkStage1Executor.js:327-333`)
  registers the bridge-echo basis WITH `independently_attested:
  false` as the expected, enforced state for CLI runs and fails
  closed on anything else. That tuple is this repo's provenance
  standard for CLI transports.
- The old gate never checked `provider` or `model` at all — only the
  unsatisfiable flag. The replacement below is stronger on that
  axis, not weaker.

**Replacement gate (semantic preparer only).** A batch is admissible
when the existing status/path/sha/prohibited-tool conditions hold
AND either:

1. `model_independently_attested === true` (kept, for any future
   attesting provider); OR
2. ALL of: `model_attestation_basis ===
   'explicit_cli_model_argument_accepted_bridge_echo'`; the batch's
   `provider` and `model` are exactly the collection's registered
   reader identity for that reader; `model_independently_attested
   === false`.

The basis `cli_default_not_independently_attested` (no explicit
model argument) stays inadmissible. Everything else in the gate
stays. The decision-batch preparer
(`prepare-adaptive-warrant-annotation-batches.js:717`) carries the
same latent defect but is NOT on the live path — do NOT edit it; add
a deferred note to ledger #16 instead.

**The four collected responses are NOT admitted.** The repair is
written after their metadata was seen; admitting them would shape
the gate to fit collected data. Quarantine the r47 reader-run
directory and all four response files (move, never delete; keep the
recorded SHA-256 values). Their 5 reserved attempts stay counted.
The registered plan re-runs fresh — bridge calls are atomic per
call, so re-reading the 5 exposed sample ids with stateless fresh
calls has no contamination path.

## Ordered actions

### A1 — Gate repair, equivalence proof, re-pin (zero-call, ledger #16)

1. Apply the replacement gate in the semantic preparer only. Project
   the post-edit preparer source SHA-256 and reader schema digest
   zero-call BEFORE committing; record both in the ledger entry and
   the commit message; the re-pin is at that projection.
2. Equivalence proof at the repair commit, every letter fail-closed:
   (a) the preparer diff is exactly the gate lines;
   (b) recomputed reader digest equals the projection;
   (c) extraction schema digest still
   `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`;
   (d) provider response schema byte-identical at `44b4807e…`;
   (e) one-case response schema bytes still `f944b9b8…` (10,930);
   (f) one-case packet still `237c0784…`;
   (g) response cap still 14,000; packet cap still 42,000.
   Any mismatch = stop and report, no further edits.
3. Guards, committed with the change:
   (a) a synthetic run batch with `model_independently_attested:
   true` passes;
   (b) a synthetic batch with the exact bridge-echo basis, matching
   registered provider/model, attested false, passes;
   (c) basis `cli_default_not_independently_attested` fails closed;
   (d) provider or model differing from the registered reader
   identity fails closed;
   (e) nonzero prohibited tool events still fails;
   (f) response sha mismatch still fails.
4. DEFECT-LEDGER #16: the unsatisfiable gate, the repair, the
   quarantine, the re-pin, and the deferred decision-preparer note.
   Focused suites + preflight green, zero-call.

### A2 — Fresh readers, support gate, report 050 (paid)

5. Quarantine the r47 run and responses as ruled above. Re-prepare
   the reader collection from the unchanged frozen 93-case corpus at
   the one-case partition, bound to the repair commit. Before any
   call, record the planned call count (**93 × 2 = 186 calls**) in
   the new collection manifest.
6. Run BOTH semantic readers from scratch under the registered
   protocol — nothing from the r47 attempt is admitted or pooled.
   Score the support gate.
7. Report 050 with: the defect-#16 disclosure (old gate, new gate,
   quarantine, both digests old/new), the cap-raise and 045/047
   re-pin history in one provenance paragraph, the drop-and-log and
   93/2/3 disclosures carried forward with the full drop log, calls
   spent from **3,151/8,000** (report-031 convention: every
   `model_call_budget_reserved` event = one attempt), reader
   results, support-gate arithmetic, and BOTH coverage rates
   (checkpoint 139/144 = 96.53%; final 187/192 = 97.40%). The
   reviewer rules on the matrix gate from report 050.

## Unchanged

Never patch a live run; never waive a failed gate post hoc; the two
dropped cases stay excluded forever; seed 515 unspent; human hard
stops per direction 038 (contamination, the 8,000 ceiling,
unexplained coverage loss); commit `--no-verify` with the
`Workplan-item: N/A` trailer and the Co-Authored-By convention;
NEVER push.
