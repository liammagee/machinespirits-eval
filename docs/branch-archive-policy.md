# Branch and Worktree Archive Policy

Use this policy when a branch contains unique historical work that should not
be merged into `main` as-is, but still has enough implementation, provenance,
or reproducibility value to preserve.

Archiving is distinct from merging, parking active work, and deleting stale
refs. An archived branch is a historical source that must be ported onto a
fresh branch if the work is ever reopened.

## Choose the outcome first

Before changing refs or removing a worktree, refresh `origin/main` and inspect:

- tracked, untracked, and ignored files;
- commits and patch equivalence relative to `origin/main`;
- detached-worktree reflogs for otherwise unnamed commits;
- associated pull requests and recent activity; and
- generated data, databases, traces, or model artifacts stored outside Git.

Classify the work as one of four outcomes:

1. **Merge or port** — the change is current, valid, and belongs on `main`.
2. **Keep active** — the work is still owned by an active thread or is an
   intentional long-lived worktree.
3. **Delete** — no unique commits or valuable local artifacts remain.
4. **Archive** — unique work remains, but merging it would regress current
   code, documentation, workplan state, or empirical claims.

Never use the archive path merely to avoid deciding whether live work should
merge.

## Canonical archive shape

For a slug such as `program-2-corpus-v2`, use the dated name:

```text
archive/program-2-corpus-v2-YYYY-MM-DD
```

Preserve the Git history twice:

- a remote `archive/...` branch, so the tree remains browsable; and
- an annotated tag with the same name, treated as the immutable commit anchor.

The tag message must state:

- that the branch must not be merged wholesale;
- why it was archived;
- how it may be revived;
- whether ignored/private artifacts exist; and
- the SHA-256 of each separately archived artifact bundle.

Do not open a pull request from an archive branch.

## Ignored and private artifacts

Git refs do not preserve ignored exports, databases, traces, adapters, model
weights, or corpora. Before deleting the worktree:

1. inventory those files explicitly;
2. exclude disposable dependencies, caches, locks, and empty databases;
3. package valuable files under `~/.machinespirits-data/archives/`;
4. compute and record a SHA-256 checksum; and
5. copy sensitive or irreplaceable bundles to private backup storage.

Do not add a private corpus or model artifact to the public repository or Git
LFS merely to make cleanup convenient.

## Verification and cleanup gate

Worktree and local-branch deletion is allowed only after all applicable checks
pass:

- the remote archive branch resolves to the intended commit;
- the annotated tag dereferences to the same commit;
- each private archive can be listed or opened successfully;
- its checksum matches the value recorded in the tag; and
- no uncommitted tracked work or unreviewed local artifact remains.

Then remove the worktree and local source branch. Keep the remote archive
branch and tag. A forced worktree removal is acceptable only when every
remaining ignored or untracked file was classified as disposable or backed up.

## Workplan and paper discipline

An archive is not a live work queue. Do not merge a stale workplan card from an
archive branch or move a completed card backward. If reopening the work creates
new live work, create or update a card on current `main` through the normal
workplan workflow.

Likewise, archived notes and manifests do not license empirical claims. Any
revived numeric or empirical result must first satisfy the current Paper 2.0
source-of-truth and provenance rules.

## Revival

Never resume development directly on the archive branch. Start a fresh branch
from current `origin/main`, restore only the required files or commits, restore
private artifacts from their verified bundle, and re-run current validation.
Document the archive ref as provenance in the new workplan card or pull request.
