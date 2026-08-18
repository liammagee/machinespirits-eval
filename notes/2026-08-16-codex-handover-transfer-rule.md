# Handover to Codex: write the cross-harness claim-transfer rule

**Date:** 16 August 2026. **From:** the harness-reconciliation survey
line. **Card to work:** `tutor-stub-cell-reconciliation` (this task
completes it). **Branch:** `design/harness-reconciliation` in the
worktree `../ms-harness-reconciliation`.

## Ruling context

The human ruled for the staged path from the survey note
(`notes/2026-08-16-harness-reconciliation-survey.md`): state the
transfer rule now; extract the warrant layer only after the live
warrant line closes; build a cell wrapper only if a concrete question
needs it. The import-boundary half is already done
(`docs/warrant-stub-dependency-rule.md` plus
`tests/warrantStubDependencyBoundary.test.js`). This task is the
claim-transfer half.

## Read first (in this order)

1. `notes/2026-08-16-harness-reconciliation-brief.md` — the question.
2. `notes/2026-08-16-harness-reconciliation-survey.md` — the map;
   section 4 (score) carries the reason the rule is needed.
3. `docs/warrant-stub-dependency-rule.md` — the sibling rule; match
   its shape and length.
4. `workplan/items/tutor-stub-cell-reconciliation.md` — the card.

## Deliverable

One doc: `docs/harness-claim-transfer-rule.md`. It must state:

1. **The rule.** A claim born in one harness does not hold in the
   other by default. It transfers only through one of two doors:
   - **Re-scoring:** the finding is re-run under the other world's
     score of record — LLM judges under the versioned rubric for the
     cell world; deterministic readers, predeclared gates, or blind
     human readers for the stub world.
   - **Caveat:** the claim is quoted with an explicit caveat naming
     its home world and score channel, and makes no stronger claim in
     the new world.
2. **The precedent.** The edge-timing register overlay: born in the
   cell-side switching study, carried into the stub as a frozen,
   opt-in timing map with an explicit "no learning-benefit claim"
   caveat (`docs/tutor-stub-cli.md`, "Resistance-timed edge" section).
3. **Where the rule binds.** The paper (`docs/research/
   paper-full-2.0.md`) quotes only transferred or caveated claims;
   workplan cards that move a finding across worlds must name which
   door it used.
4. **What the rule does not do.** It does not merge the harnesses,
   does not rank the two score channels, and does not license any
   code change.

Then update the card: add a log line to
`workplan/items/tutor-stub-cell-reconciliation.md` naming the survey
note, the boundary rule, and the transfer doc; set the card
`status: done` only if the human confirms in review — otherwise leave
it active with the log line.

## Rules for the work

- Design and documentation only. No code changes, no paid model calls,
  no runs.
- Do not touch anything the live warrant line fingerprints: no edits
  under `services/adaptiveWarrant*`, `services/tutorStub*`, or the
  study scripts. Adding the new doc file is safe.
- Do not edit `docs/adaptation-refinement/**` — that directory belongs
  to the live warrant line.
- After changing the card, run `node scripts/workplan.js render` and
  `node scripts/workplan.js validate`, then restore
  `workplan/BOARD.md` and `workplan/board.json` — board views are
  never committed on this branch.
- Commit on `design/harness-reconciliation` with the trailer
  `Workplan-item: tutor-stub-cell-reconciliation`. Small,
  single-purpose commands; hooks on (no `--no-verify`). Pushing this
  branch is authorized; opening or merging a PR is not — that is a
  human ruling.
- Plain language per `.claude/style-rule.md`: short words, short
  sentences, no coined compounds.

## Verification

- The doc exists, states the two doors, the precedent, where it binds,
  and what it does not do, in roughly one page.
- `node scripts/workplan.js validate` passes.
- `npm test` is not needed (no code changed), but if run it must stay
  green.

## Stop conditions

Stop and ask the human if: the rule seems to need a code change or a
test to be real; the paper already contains an uncaveated cross-world
claim (report it, do not fix it); or the warrant line's owner objects
to any wording about the stub score channel.
