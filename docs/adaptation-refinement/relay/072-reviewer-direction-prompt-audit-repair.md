# 072 — Reviewer direction: repair the standing-permission prompt-audit conflict

**Date:** 13 August 2026. Authority: ruling 071a. **Zero paid model
calls.** This is harness repair only: no run artifact may be touched,
no frozen instrument surface amended, no launch performed.

## The defect

`services/tutorStubSessionApplicationContext.js` (~lines 139–173)
appends the registered standing-permission menu (12,399 chars, inside
`[Standing permission menu — conditional branches] … [End standing
permission menu]` delimiters) to the tutor base system prompt, then
audits the result as surface `tutor_system` and throws on violation.
The audit fails deterministically three ways:
`character_budget_exceeded` (cap 16,000 chars),
`approximate_token_budget_exceeded` (cap 4,000), and
`duplicate_instruction_lines` (the menu quotes the rendered layer by
design — ruling 059a). Evidence: v2 dialogue 3 child log
(`[standing-permission] menu injected: 12399 chars` then the fatal).

## Required repair — four parts

1. **Sized budget for the menu-bearing surface.** Give the tutor base
   prompt with an injected standing menu its own audit budget — either
   a new surface name (for example `tutor_system_standing`) or an
   explicit allowance added when a menu is present. Size it from the
   real render: base prompt + the frozen 12,399-char menu + delimiters,
   with a modest fixed margin (same spirit as the direction-028
   `learner_analysis` raise). Do not raise the plain `tutor_system`
   cap — bare and gated dialogues must keep the old budget.
2. **Scoped duplicate-line exemption.** Compute the
   duplicate-instruction-line audit with the delimited menu block
   stripped from the text first. Duplicates between the menu block and
   the surrounding prompt are by construction and lawful; genuine
   duplicates outside the block (or inside it against itself) must
   still fail. Precedent for duplicate-only tolerance:
   `services/tutorStubTutorAttemptRuntime.js:124` and
   `services/tutorStubPromptTransport.js:125`; do NOT copy the
   blanket-tolerance pattern — the exemption must be scoped to the
   delimited block.
3. **Zero-call launch preflight.** Add to
   `scripts/run-adaptive-warrant-outcome-pilot.js` a pre-call guard
   that renders the tutor base system prompt for **all three
   conditions** (bare, gated, standing permission) with the real
   frozen inputs and runs the audit on each, refusing before any paid
   call on any violation. Write the rendered sizes and audit results
   into the preflight artifact.
4. **Regression tests on the real frozen files.** Tests must use the
   real menu file
   (`docs/adaptation-refinement/outcome-study-a1/standing-permission-menu.txt`)
   and real world files, not synthetic strings: (a) the
   standing-permission render passes the new audit; (b) bare/gated
   renders still pass under the unchanged `tutor_system` budget; (c) a
   genuine duplicate outside the menu block still fails; (d) an
   oversized prompt on the new surface still fails.

## Counter re-pin

The frozen plan object pins `counter_before: 3556` /
`counter_after_if_completed: 4672`. A fresh take starts from the
ruling-071a counter. Update the plan literal and its tests:
`counter_before: 3613`, `counter_after_if_completed: 4729`,
`remaining_after: 6608`, ceiling 11,337 unchanged. The 1116-call plan
shape (540 + 288 + 288, 30-call per-dialogue cap) is unchanged.

## Boundaries

- Zero paid calls. `ADAPTIVE_TUTOR_LLM`-style mock paths and pure
  renders only.
- Never touch `.tutor-stub-auto-eval/**` (v1 and v2 artifacts are
  quarantine-preserved), the freeze manifest, the menu file, the world
  files, or the readers.
- ESLint + the adaptive-warrant test suites must pass.
- Commit with the standard trailer discipline; **never push**.
- Report to `docs/adaptation-refinement/relay/073-codex-report.md`:
  what changed, rendered sizes per condition, audit results, test
  counts, commit SHA. Make no launch; the relaunch needs a fresh GO
  note after both-session review.
