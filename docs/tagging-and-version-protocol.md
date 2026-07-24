# Tagging and Version Protocol

This repository has several independent things that change at different rates:
the evaluation software, the canonical paper, experiment execution lineages,
and historical branches that must remain reproducible without being merged.
They must not share one undifferentiated `v*` tag sequence.

The generated [Ref and Version Status](ref-status.md) page records the current
declared versions and every known archive ref. Refresh it after fetching refs:

```bash
git fetch --all --tags --prune
npm run refs:render
npm run refs:check
```

`docs/ref-status.md` is an inventory, not a work queue. Live work remains in
`workplan/items/`.

## Pull-request and merge discipline

Every pull request classifies its ref/version impact as `N/A`, repository
release, paper checkpoint, experiment checkpoint, or archive snapshot. The PR
template records that classification, `CONTRIBUTING.md` includes the local
check, and CI fetches the managed refs and runs `npm run refs:check`.

A pull request may update declared version files, release notes, policy, or the
generated registry. It must not create a managed tag. After merge, re-fetch
`origin/main`, identify the exact intended main commit, run the tag family's
required validation, and only then create and push the tag. This keeps the tag
anchored to reviewed history rather than an unmerged feature-branch commit.

## Managed tag families

All new managed tags are annotated and immutable. Use lower-case kebab-case
for slugs and an ISO date where the family requires one.

| Purpose | Tag shape | Example |
| --- | --- | --- |
| Repository/application release | `release/vMAJOR.MINOR.PATCH` | `release/v0.6.0` |
| Canonical Paper 2.0 checkpoint | `paper/vMAJOR.MINOR.PATCH` | `paper/v3.0.228` |
| Experiment execution checkpoint | `experiment/<programme>/<phase>/<state>-YYYY-MM-DD` | `experiment/program-2/phase5d/results-2026-07-22` |
| Immutable anchor for an archived branch | `archive-snapshot/<slug>-YYYY-MM-DD` | `archive-snapshot/program-2-corpus-v2-2026-07-18` |

Experiment state is one of `freeze`, `results`, or `retired`. If a corrected
experiment tag is unavoidable, keep the original and append `-r2`, `-r3`, and
so on to the successor. Never move the original tag.

Archive branches remain under `archive/<slug>-YYYY-MM-DD`. The tag uses the
different `archive-snapshot/` namespace deliberately: using the identical
short name for a branch and tag makes commands such as `git show archive/foo`
ambiguous.

Historical `v*`, `paper-v*`, `checkpoint-*`, and `archive/*` tags are
grandfathered. Do not delete, move, or rename them, because external notes and
manifests may cite them. Do not add new tags to those legacy namespaces.

Do not use an unconstrained `git describe --tags` as an application version:
the nearest historical tag may be a paper or archive checkpoint. Constrain the
namespace instead:

```bash
git describe --tags --match 'release/v*'
git describe --tags --match 'paper/v*'
```

## Repository releases

The repository release version is the `version` in `package.json`. It follows
Semantic Versioning while the project remains pre-1.0:

- **patch** — compatible fixes, tests, documentation, and internal maintenance;
- **minor** — a coherent new CLI, API, evaluation, desktop, or data-contract
  capability; and
- **major** — the first stable contract or a later intentionally incompatible
  release boundary.

A repository release tag is warranted when the version describes a useful,
reproducible integrated state—not for every merged pull request. Before tagging:

1. update `package.json` and `package-lock.json` together;
2. update release notes or a release workplan closeout;
3. ensure the target is the intended commit on `origin/main`;
4. run the hermetic tests plus risk-proportionate validators; and
5. confirm `npm run refs:check` passes after rendering.

Tag message template:

```text
Machine Spirits Eval release vX.Y.Z

Scope: <integrated milestone>
Validation: <commands and result>
Paper compatibility: <paper version or "independent">
Artifacts: <release URL, manifest, or "none">
```

Create and publish the annotated tag explicitly:

```bash
git tag -a release/vX.Y.Z <main-commit> -F /path/to/tag-message.txt
git push origin refs/tags/release/vX.Y.Z
```

Do not use `npm version` as an implicit tagging command; version-file changes
should be reviewed in a normal commit before the release tag is created.

## Paper checkpoints

The paper version is the `version` field in
`docs/research/paper-full-2.0.md`. Paper numbering is independent of the
repository release number. A paper tag marks a built and validated canonical
manuscript checkpoint, not every prose edit.

Before tagging, confirm the paper build, manifest validation, and provable
discourse checks appropriate to the changed claims. The tag message records
the paper title/version, validation commands, generated artifact location, and
whether empirical claims changed.

```bash
git tag -a paper/vX.Y.Z <main-commit> -F /path/to/paper-tag-message.txt
git push origin refs/tags/paper/vX.Y.Z
```

## Experiment checkpoints

Experiment tags are selective provenance anchors. Use them only when an exact
Git commit is necessary to interpret a preregistration, sealed run, manifest,
or retirement decision. Ordinary exploratory commits do not need tags.

The annotation must name the preregistration or workplan item, run IDs or
artifact manifests, relevant private archive location, and the validation or
decision state. Experiment tags do not license paper claims by themselves;
the Paper 2.0 source-of-truth rules still apply.

## Archive snapshots

Archive snapshots follow [Branch and Worktree Archive Policy](branch-archive-policy.md).
Each new archive has both:

- a browsable remote branch `archive/<slug>-YYYY-MM-DD`; and
- an immutable annotated tag `archive-snapshot/<slug>-YYYY-MM-DD`.

Both must resolve to the same commit. The generated registry treats a mismatch,
a lightweight managed tag, a local-only archive branch, or either half of a
new archive pair as a blocking error. Older tag-only archives remain visible as
grandfathered history rather than being silently mistaken for live branches.

## Immutability and corrections

Never force-update a managed tag. If a tag points at the wrong commit:

- repository release: issue the next patch version;
- paper checkpoint: increment the paper version;
- experiment: create an `-r2` successor and document the correction; or
- archive: create a newly dated archive pair and record what it supersedes.

Deleting a published managed tag requires an explicit repository-maintenance
decision and a migration note for every known reference. It is not routine
branch cleanup.

## Baseline recommendation

The current declared versions are repository/package `0.5.0` and canonical
paper `3.0.228`, while the newest legacy plain `v*` tag is a paper checkpoint.
After this protocol lands, the next deliberate baseline should be:

1. review the accumulated post-`0.5.0` software changes and bump the package to
   `0.6.0` in a dedicated release commit, then tag `release/v0.6.0`; and
2. after confirming the current paper build and claim validators, tag the same
   or a later main commit as `paper/v3.0.228`.

These are separate tags even if they initially point to the same commit.
