---
id: pin-the-last-two-repo-state-inputs-to-the-page-byte-contract
title: Pin the last two repo-state inputs to the page byte contracts
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-17
updated: 2026-08-17
verification: "The derivation page byte contracts no longer move when exports/
  has local content: the recent proof runs and replay bundles that ride in the
  command palette are read through env-overridable paths, the contract test pins
  both to a fixed location, and a developer with local runs on disk sees the
  same digests as CI."
---

Context. Link out for detail; do not copy.

The command palette rides in the rail on every page, so whatever it lists sits
inside the derivation page byte contracts. The board half was pinned by the
earlier card. Two artifact inputs were left: recent proof runs
(`exports/dramatic-derivation/loop`) and recent replay bundles
(`exports/discursive-replays`).

## Log

- 2026-08-17 — CORRECTION to the note left on
  `derivation-byte-contracts-board-refresh`: that card said `exports/` is
  gitignored so CI never sees these. Wrong for the proof-run half. `exports/`
  is ignored by default but carries force-added exceptions, and 207 files under
  `dramatic-derivation/loop` are tracked. The pinned digests therefore already
  had eight tracked proof runs baked in, identical in CI and in a fresh
  checkout. The exposure is the opposite of what was written: a developer who
  runs the derivation loop locally ADDS untracked runs on top of that tracked
  baseline and breaks the contract, and committing a new run breaks it too.
  The replay half was as described — the directory is ignored and absent, so
  any local replay run causes drift.
- 2026-08-17 — Both directories are now read per call through an override
  (`DERIVATION_LOOP_DIR`, `POETICS_REPLAYS_DIR`), matching the `WORKPLAN_DIR`
  pattern. Read paths only, nothing writes, so no desktop relocation. The
  contract test pins both at fixtures holding ONE artifact each rather than at
  an empty location — an empty pin would agree with a bare checkout but would
  drop the populated palette path out of the contract. Six digests recomputed
  once. `assertArtifactRecentsArePinned()` counts exactly one entry of each
  kind, so both too many (real exports read) and none (seam broken) fail by
  name.
- 2026-08-17 — The traversal guard on `/derivation/<label>` resolves the root
  ONCE per call now; resolving twice would let an env change between the two
  reads satisfy the prefix check against a root the path is not under.
  `tests/derivationLoopDirOverride.test.js` covers the override (absolute,
  relative, per-call) and re-runs the nine rejected label shapes under each.
- 2026-08-17 — Proved by writing an untracked run and an untracked bundle into
  the real `exports/` and re-running: 4/4 pass. Under the old code both would
  have entered the palette and moved the bytes.
- 2026-08-17 — Closed. PR #649 merged as `8a6ba5e0`, and main's own refresh
  commit `1669540b` then landed on top. Both tests pass against that state
  (7/7). All three live palette inputs — board, proof runs, replay bundles —
  are now pinned, so the page byte contracts answer to the renderer alone.
