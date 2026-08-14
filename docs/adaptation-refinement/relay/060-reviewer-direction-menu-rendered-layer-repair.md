# 060 — Reviewer direction: rendered-layer menu + zero-call repair

**Lease:** `DRIVER-LEASE-2026-08-13-N`, continued. Report to
`061-codex-report.md`. Authority: ruling 059a, Amendment 1,
direction 058, notes 055a/055b/057a/058a. Zero model calls; the
HOLD stands until the reviewer's go note.

## 1. Repair pass (deterministic fixtures only)

1. Fix the unused variable `omitted` at
   `scripts/prepare-adaptive-warrant-outcome-study.js:448`
   (underscore-prefix or drop it).
2. Update the CLI-help digest fixture in
   `tests/tutorStubCliHelp.test.js` from
   `5aa4abcab2ffb919b06d300a50c36d0dbe07ceafe6d9bd074448c4e734163c07`
   to
   `bd0669e50c730ef0d5f591d5745e9039c08442a007fbe5916b3aa78c5e59ed2c`.
   The change is authorized: the new `--standing-instructions-file`
   flag documenting itself is the intended help change, per ruling
   059a. Touch nothing else in that test.

## 2. Rebuild the menu on the rendered layer (ruling 059a)

1. Regenerate the standing-permission menu from the compact strings
   the live speaking prompt renders downstream of a gate decision,
   all from the SHA-pinned
   `services/tutorStubFirstDraftContract.js`: every uptake branch
   string; every compact part cue plus the inline scene-partner
   string; every tactic execution cue used by the compact tactic
   builder plus every support-level string; every compact stance
   cue; every handoff branch string and every compact action cue.
   Sweep all stances and action families mechanically; no
   reachability pruning.
2. Remove entries a live speaking prompt never carries. List each
   removed entry and the reason in report 061.
3. Template strings: quote the fixed template text byte-for-byte
   with placeholders shown as named slots; the prefix sentence says
   the gate fills the slots from the public contract; the drift
   guard checks the fixed segments byte-for-byte. State this
   handling in the manifest's enumeration rule.
4. Trace whether the question-support instruction strings render
   into the live speaking prompt verbatim. State the finding:
   include if live, drop with the stated reason if not.
5. Prefix rule unchanged (Amendment 1 §3): one descriptive sentence
   per string, no imperative advice beyond the quoted string.
6. Update the drift-guard fixtures (passing menu, single altered
   byte, missing branch) for the new menu.
7. Note 058a holds: the source SHA table in report 061 must equal
   report 056 exactly; the manifest states the full enumeration
   rule.

## 3. Rerun the whole boundary, then the manifest

1. Rerun the focused outcome-study suite, the widened focused
   suite from direction 058 §5, and ESLint on every touched file.
   Any failure: stop, report, commit, end.
2. On a clean pass ONLY: write the pilot manifest with every
   element direction 058 §4 lists (planned generation and reader
   calls, extraction rule and expected count, the note-055b path-1
   line verbatim, the note-057a run-record rule, all seven presence
   digests plus caps, the three decision digests, condition
   assignment, seeds, the A1 commit hash) and the planned-call
   arithmetic from 3,523 (ceiling 11,337).
3. Commit with `--no-verify` and trailer `Workplan-item: N/A`,
   write report 061, commit, end.

## Hard rules

Zero model calls; no paid call before the reviewer's go note;
never patch a live run; NEVER push the branch. If any check fails,
stop, report, commit, end.
