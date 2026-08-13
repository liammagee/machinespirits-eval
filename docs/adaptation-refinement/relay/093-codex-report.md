# 093 — Codex report: collection-reuse source-commit contradiction

**Date:** 13 August 2026. **Authority:** ruling 092a. **Boundary:**
structural stop before any repair edit, artifact regeneration, reader resume, or
new paid call.

## Outcome

The v4 outcome pilot was **not resumed**. Ruling 092a requires the paid packet
collections to be reused byte-for-byte, while the committed child readers
require those collections and the emitted freeze to name the exact current
clean Git commit. Those requirements cannot both hold after the ruling commit,
even before the directed repair commit is made.

No harness, child runner, manifest pin, zero-call artifact, paid response,
child checkpoint, or packet collection was changed. No tests or ESLint were
run because the stop precedes an authorized implementation. No model call was
made. Nothing was pushed.

## Blocking source-commit proof

1. Current clean HEAD is
   `d6a2e865b8bb9e2bcfe033b07c1cba9a53b61b4e`, the commit that added ruling
   092a and updated `STATE.md`.
2. Both paid packet collections are bound to source commit
   `f43bcc64eaf9e66567971787c7602674317b6b55`, the parent repair commit under
   which they were prepared and the readers ran:
   - the presence manifest, its brittleness-preflight binding, and its
     schema-acceptance binding all name `f43bcc64…`;
   - the decision manifest and its brittleness-preflight binding both name
     `f43bcc64…`;
   - the existing emitted natural freeze also names `f43bcc64…`.
3. The parent emits the resumed natural freeze with
   `sourceCommit: git(['rev-parse', 'HEAD'])`. After tasks 2–5 that would be the
   new repair commit, not `f43bcc64…`.
4. The semantic child rejects unless the emitted freeze source commit equals
   `manifest.source_commit`, then separately rejects unless that source commit
   equals the exact clean current HEAD. It also requires the collection's
   preflight and schema-acceptance hashes to equal the freeze bindings.
5. The decision child likewise rejects unless the emitted freeze source
   commit, `manifest.source_commit`, and exact clean current HEAD are all
   equal, and requires the collection's preflight hash to equal the freeze
   binding.
6. Task 6 requires regenerating the two commit-stale zero-call artifacts at the
   new repair HEAD. That necessarily changes their commit stamps and hashes,
   while the immutable paid collection manifests and authorization requests
   continue to bind the `f43bcc64…` artifacts.
7. Task 3 requires the diff to each child to be exactly the named allowance
   constant plus the one comparison change. Therefore no source-commit or
   preflight-binding exception is authorized in either child.

Reusing the collections as directed would thus make both children refuse
before their next call. Rebuilding or rebinding the collections is expressly
prohibited because it would move the approval digests and orphan the 271 paid
responses. Relaxing the source-commit/preflight guards, manufacturing an
alternate Git identity, or changing the emitted freeze semantics would exceed
ruling 092a and break the required equivalence proof. The driver stopped
instead of selecting an unregistered substitute.

## Paid evidence remains preserved

Run root:
`.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13`.

| Artifact | SHA-256 |
|---|---|
| Presence collection manifest | `c90d1e3e0283b00d102bd5ac1119caf8de5a02492cba3e5598b1da3d27b42575` |
| Presence authorization request | `f97f2b4195f9bb7806a0f10a40a43eab60e05c27dadd615131e8c08a49d0a955` |
| Decision collection manifest | `a53d5a7f5ac4501fd87e03e23d72a46d7af091e8261fb27e029d9f8ce37bc59e` |
| Decision authorization request | `e3c36740c31945d359e6489d212d5c067c1de077f15ef817ca76740eac192d86` |
| Presence child checkpoint | `cfb1727de2da5967178c26d435d8fde88c192ccb06819af0f0d39a38584f550c` |
| Decision child checkpoint | `1d1309b13112861a5ea561ecfaa423f1a51d9913ebc81e8aa483a9781c9ba01b` |
| Commit-stale semantic preflight | `743ee634b1b1ec00fb44844f049ec0554def63abe043b9bdf0676cbf2a5e6b1a` |
| Commit-stale schema-acceptance carryover | `47efb49445a94980b563cb00a96714d4290d92da7f73501c160d3c2f43776111` |

Response-file counts remain 151 presence plus 120 decision = **271 accepted
paid responses**.

## Checkpoint call reconciliation

The child checkpoints expose a second discrepancy in ruling 092a's opening
counter:

| Channel | Attempted | Completed | Failed/no-response |
|---|---:|---:|---:|
| Presence | 152 | 151 | 1 |
| Decision | 121 | 120 | 1 |
| **Readers total** | **273** | **271** | **2** |

Under task 7's stated rule to count every reader attempt including failures,
the current checkpoint-derived counter is:

`4,198 settled + 495 generation + 152 presence attempts + 121 decision attempts = 4,966 / 19,337`.

Ruling 092a and `STATE.md` say 272 reader attempts and 4,965, while also saying
that both child checkpoints carry one no-response attempt. The two checkpoint
values sum to 273. No checkpoint or global counter artifact was rewritten.

## Required ruling before continuation

Continuation needs a fresh reviewer direction that explicitly resolves both:

1. how an immutable `f43bcc64…` collection authorization may lawfully resume
   from a newer committed child runner and newer commit-stamped zero-call
   artifacts without weakening or falsifying the exact-commit provenance
   checks; and
2. whether the opening counter is corrected to **4,966** under task 7's
   checkpoint-attempt rule.

The existing GO note remains unexecuted by this report. The 72-dialogue main
block remains unauthorized. Interpretation remains reserved to the reviewer.
