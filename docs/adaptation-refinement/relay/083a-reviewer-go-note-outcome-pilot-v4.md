# 083a — Reviewer GO note: outcome-study pilot, fourth take (v4)

**Date:** 13 August 2026. Authority: registration 079 (human-approved
option 1), directions 080 + 082, driver report 083 (build at
`4a0129a4`), the reviewer's zero-call verification (full diff read;
211/211; ESLint pass; observe-mode never intervenes), the
second-session final-gate review (PASS, zero calls: scope match,
arming slot and basis exact, policy consumes the new basis, replay
table matched independently), and the counter re-pin at `856251d1`
(4,198 settled after the Sol re-take sealed; both sessions computed
4,198 independently). Human authority: the 1,116-call budget
("prepare it now, I approve in advance"), the raised ceiling 19,337
(052c), and the standing instruction **"launch when the review
passes, keep me posted"**. On 13 August 2026 the human added, in the
reviewer session: **"Go, approve if needed. Do everything unattended,
only report back completion or failure"**, after asking that control
be handed to a codex session with the reviewer reading results only.
This lifts the quota hold relayed by the second session and delegates
the launch and watch to the codex driver (direction 083c). GO notes
063a, 068a, 068c, 069b, and 073a are CONSUMED/VOID and stay so.

**GO** for the re-registered pilot block only:

- Executable entry point: `scripts/run-adaptive-warrant-outcome-pilot.js`
  at commit `856251d1` (v4 build `4a0129a4` + settled counter pin:
  sustained-deference warrant basis `sustained_deference:3_turns`;
  observe-mode signals in bare and standing-permission; coverage
  guard from `48bf2e97`; ceiling 19,337). The entry-point script is
  unchanged since `856251d1`; the pilot manifest carries the
  fingerprint re-pin from commit `148621f3` (note 083b — the second
  launch attempt refused on a stale extraction-schema fingerprint,
  zero calls spent; the registered sensor change `46bfbdd9` moved it).
- Instrument freeze input (unchanged, digest verified `6a64b31f…`):
  `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json`
- Launch command, verbatim:

  ```
  node scripts/run-adaptive-warrant-outcome-pilot.js \
    --go-note docs/adaptation-refinement/relay/083a-reviewer-go-note-outcome-pilot-v4.md \
    --accept-charges \
    --out .tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13 \
    --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
  ```

- Scope: 18 dialogues (6 bare / 6 gated / 6 standing-permission),
  seeds 515–517, same learner stack as v3 (registered — prediction P1
  depends on it), frozen manifest order, 144 expected cases with the
  analyzer-retry recovery path, 2+2 fresh readers per case. Plan:
  (18 × 30 cap) + 288 + 288 = **1116** calls; counter 4,198 → at
  most 5,314 of 19,337 (remaining 14,023). (First launch attempt
  refused here: the guard wants the bare literal 1116, and this note
  wrote it with a comma. Note corrected and recommitted; zero calls
  were spent.)
- Expected and not a defect: under persistent deference the gate can
  re-arm the turn after a delivered challenge — the streak does not
  clear on delivery — so back-to-back challenge turns are within the
  registered design (risk R1, report-only).
- Fresh output directory (above). v1–v3 artifacts stay preserved,
  quarantined, and untouched. All 18 dialogues generate fresh.
- The post-generation case-fingerprint guard and the
  learner-analysis coverage guard are both mandatory before any
  reader call.
- Analyses cite the consensus value, never a single reader's value.
- The 72-dialogue main block stays UNAUTHORIZED; it needs its own GO
  note after the pilot ruling.

If any launch guard refuses: stop, report, commit, end — amend
nothing. Report file: 084.
