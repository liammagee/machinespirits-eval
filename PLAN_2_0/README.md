# Plan 2.x Documentation Map

This directory is an evidence and planning archive for the Plan 2.x adaptation
line. It is not the live todo board. Live work belongs in `workplan/items/`;
`workplan/BOARD.md` and `workplan/board.json` are generated from those item
files.

Use this file as the entry point before opening individual Plan 2.x notes.

## Current Source-Of-Truth Order

1. `docs/research/paper-full-2.0.md` is the canonical source for empirical
   claims, numbers, and paper-ready interpretations.
2. `workplan/items/` is the canonical source for live todos and follow-up
   ownership.
3. `PLAN_2_0/` preserves Plan 2.x designs, preregistrations, closeout notes,
   and evidence-routing context.
4. Root-level `*-PLAN.md` files are active or historical planning ledgers for
   broader adaptive-tutor and derivation work. They do not become live todos
   unless a matching workplan item exists.

## Start Here

| Need | Read |
|---|---|
| Current active adaptive-tutor posture | `../ADAPTIVE-TUTOR-ACTIVE-PLAN.md` |
| Current Paper 2.0 claim boundary | `../docs/research/paper-full-2.0.md` |
| Live project board | `../workplan/README.md`, then `../workplan/items/` |
| Plan 2.x cleanup status | `latest_paper_status_next_steps.md` |
| Plan 2.x general adaptation evidence boundary | `plan2-general-adaptation-closeout.md` |
| Plan 2.1 evidence-bearing closeout | `plan2-1-evidence-bearing-closeout.md` |
| Real-generation M0 validation runbook | `M0-BASELINE-VALIDATION-RUNBOOK.md` |
| Yoked-contingency paper-bearing claim boundary | `yoked-contingency-main-claim-readiness.md` |

## File Groups

### Gate And Validation Documents

These are the notes to check before changing Plan 2.x machinery, interpreting
completed validation rows, or running a new adaptive-tutor validation:

- `M0-BASELINE-VALIDATION-RUNBOOK.md`
- `yoked-contingency-model-invariance-plan.md`
- `yoked-contingency-model-invariance-evaluation-note.md`

### Closeout And Evidence Ledgers

These should usually be linked, not edited, unless correcting provenance or a
paper reference:

- `plan2-quality-repeat-contextual-closeout.md`
- `plan2-general-adaptation-closeout.md`
- `branch-progress-since-inception.md`
- `plan2-1-belief-closure-closeout.md`
- `plan2-1-evidence-bearing-closeout.md`
- `yoked-contingency-main-claim-readiness.md`

### Technical Plans And Design Notes

These preserve the design path. Treat them as rationale unless a workplan item
explicitly reopens the work:

- `GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md`
- `general-adaptation-evidence-plan.md`
- `plan-2-1-adaptation-technical-plan.md`
- `plan2-1-belief-closure-technical-plan.md`
- `plan2_4-world-adaptation-spec-note.md`
- `plan2_5-rhetorical-dramatic-curriculum-compiler-plan.md`
- `adaptation-extension-deep-research.md`
- `adaptation-literature-review.md`
- `adaptation-policy-evaluation.md`

### Preregistrations

The yoked-contingency preregistrations are historical guardrails and evidence
context. Keep their frozen criteria intact:

- `yoked-contingency-g0-paid-smoke-preregistration.md`
- `yoked-contingency-g0-visible-affect-preregistration.md`
- `yoked-contingency-g1-paid-smoke-preregistration.md`
- `yoked-contingency-g1-scaled-preregistration.md`
- `yoked-contingency-g2-independent-outcome-preregistration.md`
- `yoked-contingency-g2-scaled-preregistration.md`
- `yoked-contingency-g2-calibrated-novice-preregistration.md`
- `yoked-contingency-g2-calibrated-novice-scaled-preregistration.md`
- `yoked-contingency-g2-hard-transfer-preregistration.md`
- `yoked-contingency-g2-hard-transfer-scaled-preregistration.md`
- `yoked-contingency-g2-rule-transfer-preregistration.md`
- `yoked-contingency-g2-rule-transfer-scaled-preregistration.md`

### Machine-Readable Or Checksum Artifacts

- `adaptation-policy-evaluation.json`
- `genuine-adaptation-artifacts.sha256`

## Cleanup Rules

- Do not add new live todos to this directory. Add or update a
  `workplan/items/<id>.md` card instead.
- Do not report a new empirical claim only in a plan note. Add it to
  `docs/research/paper-full-2.0.md` first, then let the plan note link to it.
- Do not delete closeout notes just because the work is closed. They are
  provenance for the paper and for future no-reopen decisions.
- If a root-level plan and a `PLAN_2_0/` plan look related, check both before
  consolidating. For example, `../GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md`
  and `GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md` are related but not
  identical.
- When board items change, run:

```bash
node scripts/workplan.js render
node scripts/workplan.js validate
npm run wp:check
```
