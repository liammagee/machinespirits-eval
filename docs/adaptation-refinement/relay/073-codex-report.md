# 073 — Codex report: standing-permission prompt-audit repair complete

**Date:** 13 August 2026. **Authority:** ruling 071a and direction 072.
**Boundary:** zero-paid-call harness repair only; no pilot, reader, or main-block
run was launched.

## Outcome

Direction 072 is implemented at
`4f3508cd7b42c845fffbb3cf28d11a649dd2f1c3`.

The standing-permission base prompt now uses the dedicated bounded surface
`tutor_system_standing` at 24,000 characters / 6,000 approximate tokens. The
plain `tutor_system` surface remains unchanged at 16,000 / 4,000 for bare and
gated conditions.

Duplicate-line auditing now removes the delimited menu from the surrounding
prompt audit and checks the outer prompt separately from each mutually
exclusive conditional menu branch. This exempts only the lawful menu-to-prompt
twins and the frozen sentence shared by two mutually exclusive branches. A
duplicate within one branch or outside the menu still fails closed.

The outcome-pilot launcher now performs a zero-call tutor-CLI dry render for
both frozen worlds under all three conditions before creating a call-budget
checkpoint or allowing generation. It writes
`prompt-audit-preflight.json`, including each render's size, surface, budget,
duplicate rows, violations, result, and prompt digest. Any failed audit writes
the failed artifact and refuses the launch before a paid call.

## Real frozen render preflight

The preflight used the unchanged real menu text and both unchanged real world
files. Every render passed with zero violations:

| World | Condition | Surface | Characters | Approx. tokens | Budget | Result |
|---|---|---|---:|---:|---:|---|
| `world_101_kestrel_signal_lamp` | bare | `tutor_system` | 9,401 | 2,351 | 16,000 / 4,000 | PASS |
| `world_101_kestrel_signal_lamp` | gated | `tutor_system` | 9,401 | 2,351 | 16,000 / 4,000 | PASS |
| `world_101_kestrel_signal_lamp` | standing permission | `tutor_system_standing` | 21,883 | 5,471 | 24,000 / 6,000 | PASS |
| `world_102_marigold_archive_box` | bare | `tutor_system` | 9,436 | 2,359 | 16,000 / 4,000 | PASS |
| `world_102_marigold_archive_box` | gated | `tutor_system` | 9,436 | 2,359 | 16,000 / 4,000 | PASS |
| `world_102_marigold_archive_box` | standing permission | `tutor_system_standing` | 21,918 | 5,480 | 24,000 / 6,000 | PASS |

The standing surface therefore retains 2,082 characters and 520 approximate
tokens of margin at the larger real render. Regression mutations prove that a
genuine duplicate outside the menu, a duplicate within one conditional menu
branch, and an oversized standing prompt all still fail.

## Plan re-pin

The 1,116-call plan shape is unchanged: 540 generation + 288 presence-reader
+ 288 decision-reader calls, with the 30-call per-dialogue cap unchanged. The
manifest literal and its exact guard/test are re-pinned to:

- `counter_before`: **3,613**;
- `counter_after_if_completed`: **4,729**;
- `remaining_after_if_completed`: **6,608**;
- ceiling: **11,337** unchanged.

## Verification

- adaptive-warrant widened suite plus prompt-audit regressions: **212/212
  passed**;
- ESLint on all four modified JavaScript/test files: **passed**;
- `git diff --check`: **passed**;
- real frozen render preflight: **6/6 passed**, zero model calls.

## Boundaries and accounting

- Paid/model calls: **0**.
- Dialogues launched: **0**.
- Reader calls: **0**.
- Counter remains **3,613 / 11,337**.
- No `.tutor-stub-auto-eval/**` artifact, freeze manifest, standing-permission
  menu file, world file, or reader was modified.
- GO note 069b remains consumed. No fresh GO note exists and no relaunch was
  attempted.
- The branch was not pushed.

Direction 072 ends here. Relaunch remains blocked pending reviewer zero-call
verification, one second-session final-gate review, and a fresh committed GO
note naming the v3 output directory.
