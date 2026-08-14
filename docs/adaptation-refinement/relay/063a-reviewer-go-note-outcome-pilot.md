# 063a — Reviewer GO note: outcome-study pilot block

**Date:** 13 August 2026. Rules on report 063 (`e4f4c99b`;
classification commit `df187b0c`, manifest repin `65029ccd`).
Lease: `DRIVER-LEASE-2026-08-13-N`, continued. Report to
`064-codex-report.md`.

**Authority:** registration §5–6, Amendment 1 (human ruling "I
approve the menu with full scope", recorded as relayed), rulings
057, 059a, 060b, notes 055a, 055b, 057a, 058a, 060a.

## Verification record

Both post-063 gates passed.

**Reviewer (this note), all zero-call:**

- Menu on disk matches the report and the manifest byte-for-byte:
  JSON `ce8d8806…073cb3`, text `966f3aa7…8257dd`; 63 entries; the
  instructional-meta and support-zero entries are gone.
- The 87-row classification is complete: every row carries the
  switching variable, gate reachability, verdict, and trace; 63 IN,
  24 OUT; the two doubt rows (part fallback, stance fallback) stay
  IN per ruling 060b's additive-error preference.
- The contested traces meet the depth bar: the seven writable-entry
  rows trace the top-level learner flag AND the branch selectors
  (due release, causal contract, record availability) and show the
  gate path reaches neither.
- Spot checks in the pinned sources hold: the gate writes the
  public-obligation directive (`services/tutorStubWarrantGate.js`
  lines 172, 196–198), which feeds the handoff question permission —
  so the question-boundary pair is rightly IN; the question-support
  module has zero references to the gate or the warrant policy — so
  the responsive-repair, bounded-choice, and clarification strings
  are rightly OUT.
- Source SHA table equals report 056 exactly; all five pins are in
  the manifest.
- Suites rerun on the reviewer's machine: 18/18 focused, 34/34
  widened, both green.
- Planned-call arithmetic unchanged: 594; 3,523 + 594 = 4,117 of
  11,337; 7,220 remaining after.

**Second session (byte review, three layers): PASS, no send-back
items** — byte fidelity with independent SHA recomputation, 060a
coverage, 060b membership with code spot-traces; its own suite run
matched (byte guard 4/4, focused 18/18).

## Record items

1. Reader outputs are compared as the **consensus value** — the
   harness compares the logged observe-arm revision decision with
   the two-reader consensus, per the frozen note-055b line. No
   analysis may cite a single reader's value as the measure.
2. The absent-count hole is closed: the post-generation case
   fingerprint guard is mandatory before any reader call; the
   run-record path is always passed (note 057a).

## GO — pilot block only

The paid-call HOLD lifts for the pilot block, nothing else:

- **18 dialogues**, 6 per condition (bare / gated /
  standing-permission), interleaved assignment exactly as the
  frozen manifest states; seeds 515–517.
- **Checkpoint after every dialogue**: persist, then continue; a
  kill at any point loses at most one dialogue.
- After generation and the fingerprint guard: **two fresh presence
  readers and two fresh decision readers per case**, 144 cases,
  caps 14,000 / 42,000, at most two reader calls concurrent.
- Budget: **594 planned calls**; counter 3,523 to 4,117 of 11,337.
  Every reserved model call counts. If any call fails technically:
  stop the affected dialogue, quarantine it, record it, continue
  with the rest, and report — no silent retries beyond the
  harness's own envelope (note 052a: technical failure is
  quarantine and disclose, never patch).
- **The main block (72 dialogues) is NOT authorized.** It needs a
  separate reviewer go note after the pilot scores and the
  registration §6 checks.

Write report 064 with per-dialogue checkpoints, call counts against
the plan, quarantines if any, and the raw score tables. Commit with
`--no-verify` and trailer `Workplan-item: N/A`. NEVER push the
branch.
