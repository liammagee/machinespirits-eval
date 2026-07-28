---
id: refactor-tutor-stub-world-catalog-presentation
title: Refactor tutor-stub world catalogue presentation
status: done
type: maintenance
priority: P1
owner: codex
source: review
created: 2026-07-28
updated: 2026-07-28
verification: World catalogue output remains byte-identical while direct,
  canonical live-process, picker/quality, focused, hermetic, manifest, static,
  and source-only gates pass.
branch: codex/refactor-tutor-stub-world-catalog-presentation
claim_status: planned
depends_on:
  - refactor-tutor-stub-curriculum-catalog-presentation
links:
  prs:
    - 338
  notes:
    - docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md
  code:
    - services/tutorStubWorldPresentation.js
    - scripts/tutor-stub.js
    - tests/tutorStubWorldCatalogPresentation.test.js
    - tests/derivationWorldPresentation.test.js
    - tests/derivationWorldQuality.test.js
    - config/hermetic-test-manifest.json
  items:
    - codebase-refactoring-program
    - refactor-tutor-stub-curriculum-catalog-presentation
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
tags:
  - refactoring
  - tutor-stub
  - world
  - scenario
  - presentation
  - terminal
milestone: evaluation-infrastructure
---

Bounded R3 slice: move pure authorial world-presentation access, picker-summary
fallback, and deterministic catalogue line projection into one side-effect-free
owner while retaining world loading, production eligibility, family grouping,
picker behavior, command dispatch, terminal writes, runtime state, traces, and
model behavior in their current owners.

Out of scope:

- Changing catalogue wording, padding, tags, family notes, indentation, paths,
  summaries, ordering, eligibility, or newline behavior.
- Changing world YAML, scenario family grouping, the picker, completion,
  commands, runtime state, traces, prompts, or terminal ownership.
- Conflating authorial setting/diction presentation with tutor register,
  engagement stance, character, or learner controls.
- Extracting `/scenario` or other command handlers before the browser/Electron
  acceptance gate is executable.

Acceptance:

- Pure helpers preserve authored presentation object identity plus exact
  authored, setting-first-sentence, and question summary fallbacks.
- A side-effect-free projector returns frozen catalogue lines without mutating
  its grouped entry input.
- Direct fixtures pin base/variant padding, full/missing tags, family notes,
  relative paths, summaries, ordering, and empty input.
- The CLI retains loading, production filtering, family grouping, both picker
  call sites, terminal writes, and the existing catalogue command.
- The canonical world catalogue remains exactly 71 lines and 6,670 bytes with
  SHA-256
  `a7f97c026e1f19d18d56b3f061ecf51772a76c22fa2dc121df9a58d91dafd42c`.
- Focused/full hermetic, manifest, lint, formatting, cycle, source-only
  workplan, syntax, ref-status, and diff gates pass.

Log:

- 2026-07-28 — Activated from merged `origin/main` at `8dba3582` after PR #334.
  Command/runtime movement remains excluded behind the triaged browser/Electron
  acceptance gate.
- 2026-07-28 — Before production edits, the canonical production-world
  catalogue was pinned at 71 lines, 6,670 bytes, and SHA-256
  `a7f97c026e1f19d18d56b3f061ecf51772a76c22fa2dc121df9a58d91dafd42c`.
- 2026-07-28 — A 36-line side-effect-free presentation owner and 91-line
  direct/live test reduce `scripts/tutor-stub.js` from 25,131 to 25,107 lines.
  Authorial presentation access and picker-summary fallback now have one owner;
  loading, eligibility, family grouping, picker behavior, and terminal writes
  remain CLI-owned. The exact 6,670-byte live hash is unchanged.
- 2026-07-28 — Review parity is green: 27/27 focused world, quality, catalogue,
  and registry assertions, all 7,403 root tests across 540 manifest files, and
  137/137 tutor-core tests pass with zero skips. Manifest, 257-item source
  workplan, refs, lint, formatting, syntax, diff, and the zero-cycle ratchet
  across 418 files also pass.
- 2026-07-28 — Opened PR #338 with the source-only workplan link and no managed
  ref or version impact.
- 2026-07-28 — PR #338 merged through `30b59a24`; the exact catalogue parity
  and separation between world diction and register policy remain intact.
