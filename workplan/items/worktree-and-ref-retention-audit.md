---
id: worktree-and-ref-retention-audit
title: Classify and safely retire stale worktrees and branch refs
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-09-04
updated: 2026-09-04
branch: codex/worktree-ref-retention-done-20260905
verification: >-
  Every registered worktree and candidate local or remote branch has a recorded
  merge, keep, delete, archive, or hold disposition; valuable ignored/private
  artifacts and unique historical commits are preserved and checksum-verified
  before exact allowlisted cleanup; active worktrees and current origin/main
  remain unchanged; and before/after counts, disk use, retained exclusions,
  ref verification, workplan source checks, and archive registry checks pass.
links:
  items:
    - workflow-repository-optimization
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/1022
  notes:
    - docs/branch-archive-policy.md
    - docs/ref-status.md
tags:
  - repository-hygiene
  - worktrees
  - git
  - provenance
  - artifact-lifecycle
---

The earlier optimization programme safely retired one bounded set of merged
worktrees. A later repository audit found a new accumulation of temporary,
managed, dirty, artifact-bearing, and non-ancestor worktrees plus hundreds of
local and remote branch refs. Review the population systematically instead of
treating merge ancestry alone as evidence that a research ref is disposable.

## Acceptance criteria

- Freeze and record current `origin/main`, every worktree HEAD, repository dirt,
  ignored files, disk use, locks, active process ownership, associated PRs, and
  local/remote refs before changing a target.
- Distinguish exact ancestry from patch equivalence and inspect every commit not
  contained in the frozen base.
- Classify each worktree as merge/port, keep active, delete, archive, or hold;
  never reopen a closed workplan item merely because its historical worktree
  remains.
- Exclude reproducible dependencies, caches, coverage, bytecode, empty fixture
  databases, and generated workplan views from preservation only after their
  contents are verified.
- Preserve sealed results, non-empty databases, traces, reports, exports, model
  outputs, corpora, and other irreplaceable local artifacts byte-for-byte in a
  private create-once archive with source and per-file SHA-256 manifests.
- For unique historical work that must not merge wholesale, create and verify
  the policy-required remote `archive/...` branch and matching annotated
  `archive-snapshot/...` tag before removing its source worktree or branch.
- Delete worktrees and refs only from exact reviewed allowlists, in bounded
  batches, then independently verify target absence, retained exclusions,
  archive integrity, current refs, and reclaimed disk space.

## Running log

- 2026-09-04 — Authorized after the end-to-end audit closeout and a conservative
  first prune. Began from an isolated audit worktree at frozen `origin/main`
  `357b412e1063`; no model calls were in scope.
- 2026-09-04 — Re-inventoried from frozen `origin/main` `201e96c8d0fb`, inspected
  ancestry and patch equivalence for every candidate, reviewed tracked,
  untracked, and ignored files, semantically audited SQLite fixtures, checked
  PR/workplan ownership and active process state, and froze a checksum-sealed
  22-entry archive allowlist covering 4,080 patch-unique commits.
- 2026-09-04 — Preserved three artifact-bearing histories in private create-once
  archives: 22,412 files and 7,568,118,865 source bytes, each with per-file and
  archive SHA-256 evidence. The local-Qwen archive records 362 paths already
  unavailable before preservation rather than silently treating them as saved.
- 2026-09-04 — Audited the 303-commit, 806-blob, 30.18 MB union that the archive
  refs newly disclose. No credentials, participant data, unexpected binaries,
  LFS objects, databases, or unlicensed third-party assets were found; the user
  explicitly accepted the remaining research and operational disclosure risk.
- 2026-09-04 — Atomically published and independently verified 22 remote
  `archive/...` branches plus 22 annotated `archive-snapshot/...` tags. The
  publication record SHA-256 is
  `cf8cd8df0d76bbc507ded87af8af7159f94f8cb69dfb0d2d650d0dd1ae24d78e`.
- 2026-09-04 — Rechecked every live archived source file against its manifest,
  rechecked ignored-path and disposable-database drift, then removed exactly 22
  source worktrees, 21 local source branches, and 7 remote source branches.
  Worktree count fell from 43 to 21 and the removed footprint was 13,353,660
  KiB (about 12.7 GiB). All non-target worktrees remained registered.
- 2026-09-04 — The checksum-sealed cleanup record
  `2997a0757c72b78714fda6ed13f16b54358a5d36bbef245d581a0c3eb9e37b89`
  passed an independent live-remote check: no source path/ref remained, all 22
  archive pairs still resolved to their planned commits, and the canonical and
  audit worktrees were retained. Regenerated `docs/ref-status.md` reports 36
  archives, 29 paired, 7 grandfathered tag-only, and 0 validation errors.
- 2026-09-04 — PR #1022 merged as `468f4a95232d` after ref governance,
  workplan validation, lint, risk coverage, PTY/loopback checks, the validation
  framework, and all eight Node 22/24 test shards passed. Its head commit and
  the original audit head are both contained in current `origin/main`.
- 2026-09-04 — Retired the merged PR and original audit worktrees plus their two
  local branches after confirming no active process, remote source ref, unique
  commit, or unpreserved artifact remained. All 23 unrelated registered
  worktrees were retained. Acceptance is complete and the item is closed.
