# CI change-classifier regression-escape audit

**Workplan item:** `ci-change-classifier-escape-audit`
**Audit date:** 2026-08-27
**Starting main:** `bd2e04922a963008180b70bf958f48d441cc5e5b`
**Final branch base:** `973e1f2f3d17429bc9087bf103918d560b9004db`
**Activity boundary:** offline source inspection and deterministic tests only;
zero paid, API, or model-backed evaluation calls.

## Scope and lane topology

The audit traced `scripts/ci-change-policy.js` through both hosted workflows and
the automatic local-CI mirror.

| Classification | Selected `test.yml` work | Deliberately skipped |
|---|---|---|
| `full` | always-on test contract; lint/ref/format; Node 22/24 root shards and core tests; PTY/lifecycle; risk coverage | focused and validator-only jobs |
| `focused` | always-on test contract; changed-set/path/whitespace/JSON checks; research validation when selected | full lint, root/core shards, PTY/lifecycle, risk coverage |
| `validator-only` | always-on test contract; the registered test itself; lint and format on its changed path | focused job and all full lanes |

`.github/workflows/validate.yml` independently runs the content and
provable-discourse smoke checks when `validation_required=true`. The
workplan workflow independently checks every PR's item schema, deterministic
renderability, generated-view discipline, unit contract, and PR link.

The always-on test contract now also runs the classifier and local-parity test
files. This closes the ordinary bootstrap case in which a regression in the
head revision of the classifier could classify its own change as focused and
skip its tests.

## Rule-by-rule adversarial matrix

| Rule / concrete changed-file set | Baseline result | Audit disposition |
|---|---:|---|
| Manual dispatch; empty list; invalid/non-canonical path; missing range | full | Safe fail-closed paths retained. |
| `{services/evaluationStore.js}`, `{config/tutor-agents.yaml}`, `{.github/workflows/test.yml}`, `{package-lock.json}`, `{tests/ciChangePolicy.test.js}` | full | Runtime, config, workflow, dependency, and test changes already select full. |
| `{workplan/items/example.md, services/evaluationStore.js}` | full | Mixed sets already widen to full. |
| `{AGENTS.md}` and the other root instruction/template exact paths | focused | Safe relative to skipped runtime lanes; `README.md` was removed from this set because a skipped packaging test reads it. |
| `{.agents/skills/ms-workplan/SKILL.md}` and provider skill-root peers | focused | Agent-authored metadata only in the current tree; skill permission preapprovals are checked in the always-on contract. |
| `{docs/local-ci.md}` | focused | Ordinary authored documentation remains focused. Machine-coupled documentation is now protected by exact paths or the adaptation-refinement prefix below. |
| `{docs/research/methods-paper.md}` | focused plus validation | Ordinary research prose retains the validation framework. The canonical paper is now full because skipped ref and conservation contracts consume it. |
| `{workplan/inbox/...md}`, `{workplan/items/example.md}`, `{workplan/playbook/quality.md}` | focused | Dedicated workplan CI covers the generic source contract. Three cards read by the skipped conservation test are now exact full-CI paths. |
| `{tests/tutorStubResistantProfileStudyGoRequest.test.js}` | validator-only | Safe: the changed test is the test executed and linted. |
| `{scripts/check-tutor-stub-resistant-profile-study-go-request.js}` | validator-only | **Escape fixed:** the shared checker has multiple root-test consumers, so checker changes now select full. |
| `{config/*study-go-request*.json}` | focused with one generic authorization test | **Escape fixed:** these historical files feed distinct runtime and test contracts; every matching request now selects full. |
| `{docs/adaptation-refinement/...}` | focused | **Escape fixed:** manifests, worlds, menus, and reviewer notes are runtime/test inputs; the whole subtree now selects full. |
| `{README.md}`, canonical paper, pedagogical contract, ref status, human-coding codebook, or the three conservation cards | focused | **Escape fixed:** exact full-CI protections now cover each known skipped-lane consumer. |
| Delete `tests/deleted.test.js` | full | Planted Git deletion retains the old path and selects full; the always-on manifest check is an additional inventory guard. |
| Rename `services/runtime.js` to `docs/runtime.md` | focused because Git reported only the destination | **Escape fixed:** hosted and local range/staged collection use `--no-renames`, exposing both deletion and addition; the planted rename selects full. |

## Defects and repairs

1. **Rename-origin elision.** Git rename folding reduced a runtime-to-doc rename
   to its focused destination. Both hosted and local collectors now request
   delete/add path pairs with `--no-renames`. Planted committed and staged
   renames assert that `services/runtime.js` remains visible and forces full CI.

2. **Machine inputs under an authored prefix.** The broad `docs/` rule covered
   live manifests, worlds, standing-permission text, reviewer notes, the
   canonical paper, ref registry, and codebook. The adaptation-refinement tree
   and the exact machine-coupled files now override the broad focused rule.

3. **Study-request wildcard selected the wrong test.** Thirty-plus historical
   request JSON files share a filename pattern but not a single test/runtime
   consumer. The wildcard no longer grants focused CI; request changes run the
   full root shards. This removes a stale shortcut without adding authorization
   machinery.

4. **Incomplete validator-only closure.** The allowlisted checker is imported
   by three root tests, but validator-only ran one. Checker changes now run full;
   only the self-running paired test retains validator-only treatment.

5. **Missing-output green path.** The result jobs previously accepted
   `skipped` for every conditional lane without proving which lane the
   classifier selected. `test.yml` now accepts only the three exact state
   vectors (`full:true:false`, `focused:false:false`, and
   `validator-only:false:true`) and requires the corresponding jobs to be
   exactly `success` or `skipped`. `validate.yml` likewise accepts only
   `true:success` or `false:skipped`. Manual dispatch explicitly supplies the
   validator flag needed by the full state vector.

6. **Classifier bootstrap.** The classifier/local-parity cohort now runs in the
   unconditional test-contract job, before any profile-dependent lane.

## Regression evidence

- `node --test tests/ciChangePolicy.test.js tests/localCiRunner.test.js`
  exercises the path truth table, protected metadata, committed/staged rename
  plants, deletion behavior, hosted/local parity, and workflow-selection
  wiring.
- `npm run wp:source-check` validates the authored workplan source and branch
  linkage fields.
- Final branch verification runs repository lint, static-import-cycle and
  format checks; test-manifest, skill-permission, workplan-source, YAML-parse,
  and Git diff checks also pass. Hosted full CI remains authoritative for the
  Node-version matrix, PTY/lifecycle lane, coverage floor, and managed-ref
  fetch.

## Residual trust boundaries

- The PR classifier correctly uses a triple-dot merge-base range. A divergent
  force-push to `main` could omit paths that existed only on the replaced main
  tip; protection therefore assumes the repository's no-force-push policy.
  Event-specific range modes would be a separate workflow redesign.
- The browser-surface classifier has its own rename collector. It is adjacent
  but separate from the full/focused/validator policy audited here; this patch
  does not broaden into that surface.
- No workflow can defend against a coordinated edit that deliberately removes
  its own required bootstrap job and assertions. Branch protection and review
  remain the authority boundary for intentionally changing that contract.
- Provider skill YAML and mirror drift are not checked by the skipped full
  lanes either, so they are not a classifier escape. `skills:check` remains a
  separate repository-discipline check.

No empirical claim or evaluation result is created by this audit.
