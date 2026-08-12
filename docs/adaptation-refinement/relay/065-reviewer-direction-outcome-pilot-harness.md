# 065 — Reviewer direction: build the manifest-bound pilot harness (zero-call)

**Lease:** `DRIVER-LEASE-2026-08-13-N`, continued. Report to
`066-codex-report.md`. Authority: ruling 064a, report 064, GO note
063a (consumed — cited for scope only), the frozen manifest, and
notes 055a/055b/057a. Zero model calls; the paid HOLD is restored
until a fresh go note.

Build one committed script (suggested:
`scripts/run-adaptive-warrant-outcome-pilot.js`) that closes the
whole authorized path. Requirements:

## 1. Fail-closed launch guards

- Refuses to run without an explicit `--go-note <relay-file>` flag
  naming a committed reviewer go note, plus an
  `--accept-charges` flag. Default invocation prints the plan and
  exits without reserving a call.
- Before anything else: verify the manifest's menu JSON/text SHAs
  and all five source pins against the files on disk; verify the
  prepared-run identity guard (the existing
  `guardOutcomePilotPreparation`); any mismatch = refuse, exit
  nonzero, no call.

## 2. Generation

- Consume the frozen manifest only: 18 dialogues in the exact
  frozen order (world, seed, condition), 6/6/6, seeds 515–517.
- Condition templates come from the committed zero-call scorer's
  three definitions — import them, do not restate them.
- Checkpoint persisted after every dialogue; relaunch skips
  completed checkpoints (resume-safe), so a kill costs at most one
  dialogue.
- A technical call failure: mark that dialogue quarantined with the
  run record, continue the rest — never patch, never silent-retry
  outside the harness envelope.

## 3. Post-generation gate

- Mandatory `annotationCaseFingerprint` guard over the extracted
  cases (expected 144 = one decision-turn case per completed turn)
  BEFORE any reader call; failure = stop, no reader calls.

## 4. Readers

- **Pinned by ruling 064a: emit one of the two freeze forms the
  frozen decision-reader runner already accepts.** The reader
  launchers and their pinned digests stay byte-identical. Record in
  the report which form was chosen and why it fits.
- Two fresh presence readers + two fresh decision readers per case;
  caps 14,000 / 42,000; at most two reader calls concurrent;
  run-record path always passed (note 057a).

## 5. Accounting

- Count every `model_call_budget_reserved` event against the
  594-call plan; refuse to exceed it; write per-phase actual/plan
  deltas into the checkpoint file continuously.

## 6. Tests, then report

Add fail-closed tests: no go-note flag = refuse; manifest/menu SHA
mismatch = refuse; fingerprint-guard failure blocks readers;
checkpoint resume skips completed dialogues; the emitted freeze
form validates against the frozen decision runner's validator;
budget overrun refuses. Use mock/dry paths only — the test suite
must stay zero-call. Rerun the focused suite, the widened suite,
and ESLint on touched files. Commit with `--no-verify` and trailer
`Workplan-item: N/A`, write report 066 with the entry-point name,
the freeze-form choice, test counts, and zero-call confirmation.
Commit, end. NEVER push the branch. If any check fails: stop,
report, commit, end.
