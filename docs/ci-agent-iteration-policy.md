# Proportionate agent and CI iteration

The repository uses a fail-closed CI classifier so verification cost follows the
boundary a change can affect. Unknown or mixed changes always use full CI.

## Cost classification

| Cost | Class | Required when | Avoid when |
| --- | --- | --- | --- |
| Workplan source/link checks | Integrity-critical | Every PR or workplan source change | Never |
| Digest, provenance, and existing study validator | Integrity-critical | The bound authorization or research artifact changes | Unrelated docs or runtime work |
| Ref/version registry checks | Integrity-critical | Managed refs, archive refs, or their registry change | Ref impact is `N/A` |
| Root hermetic tests and risk coverage | Compatibility-critical | Runtime, database, evaluator, tutor/learner, test, or unknown paths change | Allowlisted authored metadata only |
| Node 22/24 matrix | Compatibility-critical | Runtime or dependency compatibility can change | Allowlisted authored metadata only |
| Real-browser tutor acceptance | Compatibility-critical | Browser driver, lockfile, runtime package metadata, or shared tutor surface changes | Root-only docs, workplan, and unrelated script metadata |
| New schema, validator, canary, or npm alias | Optional ceremony by default | A repeated failure exposes a missing durable contract | A one-off authorization or recovery already has a validator |
| Additional approval or authorization-only PR | Optional ceremony inside standing recovery authority | Recovery changes source, model, scope, seed/configuration, data, budget, or interpretation | A technical retry/resume stays inside the original envelope |

## Shortest defensible loop

1. Name the workplan item and classify the changed boundary once.
2. Reuse the existing focused validator and run only checks relevant to the diff.
3. Preserve failed and completed model attempts; recover only the failed unit into
   a fresh non-overwriting destination when standing authority applies.
4. Escalate to broader tests or a new approval only when evidence crosses a
   boundary, not merely because the task concerns research.
5. Stop when the card acceptance and selected checks pass. Record separate ideas
   as follow-up work rather than extending the current loop.

## Hosted CI profiles

`scripts/ci-change-policy.js` allows focused CI only for authored documentation,
agent-skill text, workplan source, the PR template, and named study-GO metadata.
The focused lane checks the diff, parses changed JSON, and runs the existing
study-GO authorization contract when that metadata changes. Other authorization
formats fail closed to full CI. Workplan validation remains independent, and
research-paper prose still selects the data-independent validation framework.

Everything else—including workflow files, package manifests and lockfiles,
ordinary configuration, source, tests, database/evaluator code, and
tutor/learner code—falls back to full CI. Manual dispatch also forces full CI.
The tutor-surface workflow uses `playwright-core` with the runner's installed
Chrome, so dependency installation does not download a second browser runtime.
