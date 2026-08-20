# Stale-code disposition after repository optimization

Date: 2026-08-20

Baseline: `41a683f0e33d4239d20be991e15ffa69e787e98d` (PR #717 merge)

This audit closes the high-confidence source-code candidates identified during
the workflow/repository optimization programme. It distinguishes dead
executable surfaces from retained evidence and public or historical contracts;
it does not authorize artifact deletion, an external store, or a history
rewrite.

## Removed executable surfaces

The five removed files total 193,804 bytes and 4,325 lines at the baseline:

| Paths | Why removal is safe |
|---|---|
| `.codex-tmp/feature-tracker/{build-feature-tracker,run-smoke-tests}.mjs` | Temporary one-shot builders with no package, workflow, test, or source caller. The workbook builder depends on undeclared `@oai/artifact-tool`; only a historical audit note names it. The generated tracker evidence remains tracked under `outputs/feature-user-story-tracker/`. |
| `scripts/analyze-validation-failures.js` | Hard-coded to a February 2026 run and a missing `config/scenarios.yaml`; no caller or registry entry exists. |
| `scripts/audit-claims.js` | An unregistered formatter for `/tmp/pd-final.json`; the maintained provable-discourse CLI and package commands now produce and review the audit directly. |
| `scripts/generate-branch-status.js` | A branch-specific narrative generator with no caller or registry entry and a default output in a sibling content repository. Its narrative is embedded in the source and is not a current status surface. |

Git history remains the recovery boundary for these source files. No generated
tracker output, database, local artifact, cache, worktree, or archive is
removed by this tranche.

## Retained surfaces

- `outputs/feature-user-story-tracker/` was retained by Wave 4A as historical
  evidence rather than dead source code. Wave 4B later moved its exact 27-file
  payload to the checksummed Syncthing-backed private archive under explicit
  approval, retained a public restore manifest, and untracked the repository
  copies only after a clean-room restore passed.
- `scripts/archive/oneoff/` remains a deliberate frozen provenance archive.
  Several entries are bound by `config/evaluation-store-boundary-inventory.json`
  or `config/model-cli-launch-manifest.json`; they are not live tools, but
  deleting them would weaken an existing inventory contract.
- `PLAN_2_0/adaptation-policy-evaluation.json` and
  `config/adaptation-discrimination-scenarios.yaml` remain closed Plan 2.x
  evidence/design artifacts. They are not live runtime inputs and should move
  only through a checksummed artifact/archive decision.
- `tutor-core/services/recognitionOrchestrator.js` remains exported, tested,
  covered, and cited by paper/provenance material. Its lack of a direct runtime
  caller is insufficient to remove a public API and historical mechanism
  boundary.

## Repository split conclusion

The audit does not support splitting active runtime code into another
repository. The strongest separable material is historical evidence and
one-shot output, while active tutor/evaluation services have cross-boundary
imports or public contracts. Any later split should therefore target a
checksummed evidence/history archive with a verified fetch/restore path, not
the active `tutor-core` or dramatic-derivation runtime.
