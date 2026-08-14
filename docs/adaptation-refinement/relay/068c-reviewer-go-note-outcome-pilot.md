# 068c — Reviewer GO note: outcome-study pilot block

**Date:** 13 August 2026. Authority: ruling 068b (retraction + guard fix),
report 068 (lawful freeze found), report 066 (two-sided harness review
PASS), ruling 064a, Amendment 1, the frozen pilot manifest. GO notes 063a
and 068a are consumed/void and stay so.

**GO** for the pilot block only:

- Executable entry point: `scripts/run-adaptive-warrant-outcome-pilot.js`
  at commit `e746cc55` (harness `67c4cf6d` plus the one-line menu
  byte-guard fix; verified at that commit: harness tests 7/7,
  adaptive-warrant suites 190/190, ESLint pass).
- Instrument freeze input (three-way verified, backed up to the archive
  repo):
  `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json`
- Launch command, verbatim:

  ```
  node scripts/run-adaptive-warrant-outcome-pilot.js \
    --go-note docs/adaptation-refinement/relay/068c-reviewer-go-note-outcome-pilot.md \
    --accept-charges \
    --out .tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v1-live-2026-08-13 \
    --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
  ```

- Scope: 18 dialogues (6 bare / 6 gated / 6 standing-permission), seeds
  515–517, frozen manifest order, 144 expected cases, 2+2 fresh readers
  per case. Plan: 18 + 288 + 288 = **594** calls; counter 3,523 → 4,117
  of 11,337. NO schema-acceptance ping; the carried-over acceptance
  artifact stands with `new_calls: 0`.
- The post-generation `annotationCaseFingerprint` guard is mandatory
  before any reader call.
- Analyses cite the consensus value, never a single reader's value.
- The 72-dialogue main block stays UNAUTHORIZED; it needs its own go note
  after the pilot ruling.

If any launch guard refuses: stop, report, commit, end — amend nothing.
Report file: 069.
