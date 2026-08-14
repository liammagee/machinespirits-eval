# 067 — Reviewer direction: locate or lawfully construct the instrument freeze (zero-call)

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`, continued.
Report to `068-codex-report.md`. Authority: ruling 064a, direction 065,
report 066. **Zero model calls. The paid HOLD stays in force.**

## The gap

The committed harness (`scripts/run-adaptive-warrant-outcome-pilot.js`,
commit `67c4cf6d`) refuses to launch without
`--instrument-freeze <natural-freeze>`. That input must:

1. validate under `validateOutcomeFreezeFormForFrozenDecisionRunner` —
   schema `machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1`,
   `status: frozen`, and `{path, sha256}` bindings for `protocol`, `corpus`,
   `annotation_handbook`, `key`, `study_plan`;
2. carry `semantic_instrument.schema_acceptance.path` pointing at an
   admissible schema-acceptance artifact (`status: passed`,
   `inferential_role: transport_only_permanently_excluded`,
   `calls 1/1/1`, bound `response_schema`) for
   `carryOverOutcomeSchemaAcceptance`.

The reviewer's search found **no such file**:

- `.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/validation-freeze-manifest.json`
  — schema `warrant-validation-freeze.v1`, no `semantic_instrument`;
- `.tutor-stub-auto-eval/adaptive-warrant-contract-validation-v1-live-2026-08-10/annotation-freeze-manifest.json`
  — schema `warrant-contract-validation-freeze.v1`, no `semantic_instrument`;
- no match in `exports/`, `docs/`, `config/`, the archive repo
  (`../machinespirits-eval-private`), any sibling worktree, or git history
  (`git log -S` over `*.json`);
- the natural form's only emitter is
  `run-adaptive-warrant-baseline-study.js` (~line 4228) at the end of a
  mechanism-validation **live** run; only dry-run directories (v1–v7)
  exist, and dry-run v7 contains no freeze manifest;
- the schema-acceptance artifact's only producer is
  `run-adaptive-warrant-semantic-schema-acceptance-ping.js`, which is a
  **paid one-call** probe; no past artifact survives on disk.

The direction-065 test suite passes because the freeze-form test checks a
synthetic fixture's shape, not the existence of a real input.

## Direction

Answer, zero-call, in report 068:

1. **Name the lawful source of the `--instrument-freeze` input.** You
   authored the harness, the baseline-study emitter, and the earlier V3
   instrument rounds. State exactly which past run was expected to supply
   this freeze, and where its artifacts went.
2. If the freeze can be **constructed zero-call** from committed, pinned
   artifacts (handbooks, key, corpus, study plan, protocol) without a new
   schema-acceptance ping — state the exact construction path, the
   provenance of every binding, and why it does not re-open the frozen
   instrument. Do not perform any construction that invents provenance.
3. If a **paid schema-acceptance ping is required** (one call, on top of
   the frozen 594-call plan), say so plainly and STOP. Do not run it. State
   the exact command, its cost (1 call), and what the manifest's
   `planned_calls` block must say so the accounting stays exact. The
   reviewer will then decide whether a manifest repin plus a fresh go note
   covers 595 calls, or the design goes back further.
4. If the harness's freeze requirement itself is wrong — for example, the
   outcome pilot should emit its own freeze without a source-freeze input —
   say so and propose the minimal change, but **do not edit the harness**
   under this direction.

Commit the report with `--no-verify` and trailer `Workplan-item: N/A`.
NEVER push the branch. If any check fails: stop, report, commit, end.
