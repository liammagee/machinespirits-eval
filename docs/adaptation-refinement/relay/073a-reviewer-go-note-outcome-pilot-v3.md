# 073a — Reviewer GO note: outcome-study pilot, third take (v3)

**Date:** 13 August 2026. Authority: ruling 071a (technical stop under
052a), direction 072, driver report 073 (`c72cf50f`), the reviewer's
zero-call verification (diff read in full; suites 212/212; ESLint
pass; manifest re-pin checked), and the second-session final-gate
review (PASS, zero calls: budgets, scoped duplicate audit, dry-run
escape unreachable live, counter re-pin in all three places, frozen
files untouched). Human approval of the 1116-call budget stands from
13 August, verbatim: **"prepare it now, I approve in advance"**, plus
the standing instruction **"launch when the review passes"**. GO notes
063a, 068a, 068c, and **069b are CONSUMED/VOID** and stay so.

**GO** for the corrected pilot block only:

- Executable entry point: `scripts/run-adaptive-warrant-outcome-pilot.js`
  at commit `4f3508cd` (prompt-audit repair on top of corrected-plan
  `8ad749ec`: sized `tutor_system_standing` surface 24,000/6,000;
  duplicate audit scoped to the delimited menu block; zero-call
  three-condition render preflight writes
  `prompt-audit-preflight.json` and refuses before any paid call; all
  six real frozen renders PASS with ~2k chars margin).
- Instrument freeze input (unchanged, three-way verified, archived):
  `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json`
- Launch command, verbatim:

  ```
  node scripts/run-adaptive-warrant-outcome-pilot.js \
    --go-note docs/adaptation-refinement/relay/073a-reviewer-go-note-outcome-pilot-v3.md \
    --accept-charges \
    --out .tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13 \
    --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
  ```

- Scope: 18 dialogues (6 bare / 6 gated / 6 standing-permission),
  seeds 515–517, frozen manifest order, 144 expected cases, 2+2 fresh
  readers per case. Plan: (18 × 30 cap) + 288 + 288 = **1116** calls;
  counter 3,613 → at most 4,729 of 11,337 (remaining 6,608). NO
  schema-acceptance ping; the carried-over acceptance artifact stands
  with `new_calls: 0`.
- Fresh output directory (above). v1 and v2 artifacts stay preserved
  and untouched; v2 dialogues 1–2 are NOT reused; v2 dialogues 3–4
  stay quarantined. All 18 dialogues generate fresh.
- The post-generation `annotationCaseFingerprint` guard is mandatory
  before any reader call.
- Analyses cite the consensus value, never a single reader's value.
- The 72-dialogue main block stays UNAUTHORIZED; it needs its own go
  note after the pilot ruling.

If any launch guard refuses: stop, report, commit, end — amend nothing.
Report file: 074.
