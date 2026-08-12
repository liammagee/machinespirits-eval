# 066 — Codex report: manifest-bound outcome-pilot harness complete

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`,
continued under direction 065. **Boundary:** zero-call harness implementation
complete; paid HOLD remains in force.

## Outcome

Direction 065 is implemented and committed at
`67c4cf6d73516940e75a30b687cc8064dff42236`.

The executable entry point is:

```text
scripts/run-adaptive-warrant-outcome-pilot.js
```

Its default invocation prints the frozen 18 + 288 + 288 = 594-call plan and
exits without creating a checkpoint or reserving a call. A paid invocation
requires all of `--go-note <relay-file>`, `--accept-charges`, `--out <dir>`,
and `--instrument-freeze <natural-freeze>`. It explicitly rejects consumed
GO note 063a. A future go note must be committed at HEAD, byte-identical on
disk, name this entry point, state GO, and retain the 594-call scope.

Before creating the run root or admitting any call, the harness verifies the
manifest schema and exact plan, menu JSON/text hashes and byte guard, all five
source pins, both world hashes, seeds and frozen assignment, the existing
`guardOutcomePilotPreparation()` result, the clean committed worktree, and
the frozen reader/preparer/handbook digests. It generates the source-bound
semantic brittleness preflight and a zero-call, byte-identical schema-
acceptance carryover before generation.

## Closed execution path

- Consumes the manifest's exact 18-row interleaved order and imports the three
  condition definitions from `score-adaptive-warrant-outcome-study.js`.
- Writes an atomic checkpoint after every dialogue. A resume skips only a
  sealed completed dialogue. Technical failures are recorded as quarantined
  dialogue rows with their child run-record path and the remaining dialogues
  continue.
- Counts every observed `model_call_budget_reserved` event into continuous
  per-phase actual/plan deltas. The ledger refuses reservation 595 and refuses
  reader launch unless the full registered reader budget remains.
- Extracts exactly 144 decision-turn cases, then runs the mandatory
  `annotationCaseFingerprint` count/duplicate/overlap guard before packet
  preparation or either reader launcher.
- Prepares one-case packets for two fresh presence readers and two fresh
  decision readers. Presence packet/response caps are fixed at 42,000/14,000.
  The two unchanged reader launchers run together, giving total concurrency
  two. Both assembly paths always receive their corresponding run-record path;
  scoring always receives the decision run-record path and therefore retains
  note 057a's completeness, response-hash, attestation, and prohibited-tool
  fail-closed guard.
- Emits deterministic outcome scores only after both reader assemblies pass.

## Freeze-form choice

The harness emits
`machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1`,
the representative/natural freeze form already accepted by both frozen reader
launchers. It fits because the outcome pilot is a naturally generated,
prevalence-role corpus rather than a targeted challenge corpus. The form binds
the new corpus and private key, the unchanged decision and semantic handbooks,
semantic predictions, protocol, study plan, preflight, and schema-acceptance
carryover. No third freeze form was introduced.

The frozen launcher files stayed byte-identical:

- semantic reader launcher SHA-256:
  `5a008b1cc923eb870f41311d063b9baf8147755c5569bc7e3bf18542bb3bfbb1`;
- decision reader launcher SHA-256:
  `1eb6be9d4cf2d802ff2bcb16394fdd0f99952d10a3ff62456ebc79ad42346116`
  (the manifest-pinned digest).

## Zero-call tests and checks

Six new direction-065 guards cover:

1. missing go-note refusal;
2. manifest/menu SHA mismatch refusal;
3. fingerprint failure blocking reader admission;
4. completed-dialogue checkpoint resume skip;
5. representative freeze-form validation;
6. 594-call overrun refusal.

Results:

- focused suite — new harness plus existing outcome scorer/menu tests:
  **24/24 passed**;
- widened suite — focused files plus annotation collection, semantic
  annotation, representative baseline, CLI help/parsing, and sealed auto-eval
  evidence: **111/111 passed**;
- ESLint on both touched JavaScript files: **passed**;
- `git diff --check`: **passed**.

Every test and preflight used mock, fixture, dry, or deterministic paths.

## Call and launch accounting

| Phase | Planned | Actual reserved | Delta |
|---|---:|---:|---:|
| Dialogue generation | 18 | 0 | -18 |
| Presence readers | 288 | 0 | -288 |
| Decision readers | 288 | 0 | -288 |
| **Total** | **594** | **0** | **-594** |

- Counter remains **3,523 / 11,337**.
- Seeds 515–517 remain unspent.
- Dialogues generated: **0 / 18**.
- Reader calls: **0 / 576**.
- GO note 063a remains consumed; no launch cited it.
- No model call, acceptance ping, pilot, reader run, or main block was launched.
- The branch was not pushed.

Direction 065 ends here. The committed harness now awaits two-sided review and
then a fresh reviewer go note naming the entry point before any paid call.
