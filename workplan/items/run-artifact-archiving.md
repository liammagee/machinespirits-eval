---
id: run-artifact-archiving
title: Copy run artifacts out of exports/ so they stop vanishing
status: done
type: infra
priority: P1
owner: claude
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: >-
  DONE 2026-08-09. `scripts/archive-run-artifacts.js` copies a run's reports
  and results.jsonl as-is and packs each traces directory into one tarball,
  writing into the private archive repo and never outside it; re-running copies
  only what is new. Six tests pin the behaviour. The 25 tutor-stub runs on this
  machine are archived (284M, committed there as `167f2004`). The contract
  outcome pilot runner copies its own light layer when a run ends, so the
  transcripts no longer depend on anyone remembering.
claim_status: settled
links:
  code:
    - scripts/archive-run-artifacts.js
    - scripts/run-contract-outcome-pilot.js
    - tests/archiveRunArtifacts.test.js
  items:
    - phase-b-rerun-under-flipped-policy
    - strict-policy-null-sweep
tags:
  - infra
  - tutor-stub
  - provenance
---

## Why

The first Phase-B run's transcripts are gone. Not misplaced — searched for
across every checkout, every worktree and the archive repo on 2026-08-09, and
absent from all of them. What survives of that run is the numbers other people
wrote down: 22/33 against 20/29 in the pre-registration card, a 62% template
rate in the guard catalog. Nobody can read a turn of it again.

The cause is plain. `exports/` is in `.gitignore`, so git has never tracked it
and a checkout being cleaned takes it. The archive repo next door does hold
run artifacts, but copying into it is a hand step and the last tutor-stub
batch anyone copied was July 2026. The August runs fell in the gap.

This matters beyond one lost run. The template-rate census reads traces, so a
run without traces cannot be stamped, and `strict-policy-null-sweep` runs into
exactly that — of everything under `exports/` today, 42,052 recorded turns
carry the advisory stamp and 132 the strict one, because the strict runs are
the old ones and the old ones are the ones that went.

## What it does

Two layers, because they differ by a factor of a thousand in size.

The light layer — `results.jsonl`, `report.json`, `report.md`, run manifests,
driver logs — is copied as-is, so it stays greppable without unpacking. Tens
of kilobytes per block. Each `traces/` directory is packed into one
`traces.tgz` beside where it sat, at about 13% of the raw size.

A finished contract-outcome pilot run now copies its own light layer, catching
every failure so a broken archive can never cost a finished run. Traces wait
for `npm run archive:runs`, since they are hundreds of megabytes and that
should be a decision. `npm run archive:check` lists what is missing and exits
1, so it can gate a loop.

## What was archived

25 tutor-stub runs, 1.9G of traces down to 276M packed, 284M in total,
committed in the archive repo as `167f2004`. Worth recording: most of these
runs write no `results.jsonl` at all, so their traces hold the only copy of
what was said, and packing them is not an optimisation but the whole point.

## What this does not do

It does not bring the first Phase-B run back, and no backup of it exists.

It does not reach the other runners. The contract-outcome pilot writes the
tutor-stub runs, which is where the loss happened, but anything else writing
into `exports/` still needs the command run by hand. Adding more callers is a
one-line change each and can wait for a runner that matters.

Nothing enforces this in CI, and nothing can. `exports/` is untracked and
per-machine, so a build server cannot see what a laptop failed to copy.

## Log

- 2026-08-09 — filed and done in one pass, off the discovery that the first
  Phase-B run's transcripts are unrecoverable. The user ruled out a backup.
