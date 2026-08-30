---
id: shared-dramatic-dialogue-renderer-component
title: Shared dramatic-dialogue renderer component across transcript surfaces
status: done
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-29
updated: 2026-08-30
verification: "Passed: strict public interchange and
  single/shared-learner/parallel renderers; 84 focused Node tests; synchronized
  Techne fixture; stress-comparison CLI smoke; ESLint, Prettier, hermetic
  manifest, diff check; headless Chrome at 1440x1000 and 390x844 with no
  overflow, page errors, or unlabeled dialogue regions."
depends_on:
  - transcript-render-standard
links:
  prs:
    - 875
  items:
    - tutor-instrumentation-ab-harness
    - tutor-instrumentation-showcase
    - adaptive-tutor-instrumentation-contrast-gallery
    - adaptive-tutor-capability-showcase-brief
branch: codex/shared-dramatic-dialogue-renderer-component
---

# Shared dramatic-dialogue renderer component

The completed `transcript-render-standard` card established a stable row format
and a standalone comparison renderer. Subsequent surfaces now implement related
but separate presentation code: tutor-stub session HTML, frozen A/B swimlane
diffs, free-running showcase columns, and the Techne adaptive-tutor explainer.
This card owns the next extraction step, not a replacement renderer.

## Scope

- Define one public-turn interchange that preserves speaker, turn, arm,
  delivery, verdict, ruling, provenance, and optional plain-language gloss
  metadata without admitting private deliberation into the public transcript.
- Provide reusable layouts for one dialogue, a shared-learner N-arm contrast,
  and narrow/mobile rendering.
- Keep evidence selection and adjudication outside the UI component; the
  renderer must never infer a pass, causal effect, or canonical transcript.
- Migrate one fixture from each existing surface and prove byte-equivalent
  visible dialogue plus equivalent labels before removing local duplication.

## Out of scope

No redesign of the tutor engine, transcript projection, study artifacts, or
Techne visual identity. Do not delay current research reports on this refactor.

## Log

- 2026-08-30 — Linked the renderer contract into the adaptive-tutor capability
  brief and comparison documentation. The shared layouts now carry an explicit
  warning that presentation geometry does not determine causal status.
- 2026-08-30 — PR #875 merged as `bd580859`; the final PR tree is
  byte-identical to the merged `main` tree. The shared component is now the
  maintained rendering seam for the migrated transcript surfaces.
- 2026-08-30 — Added a strict public-only dialogue interchange and shared HTML
  renderer with single, shared-learner, and parallel layouts. Migrated the
  frozen instrumentation A/B, free-running showcase, stress-comparison
  generator, and the Techne crossed endgame fixture. Adapters preserve source
  learner/tutor strings and keep verdicts, standing rulings, guard labels,
  rubric versions, provenance, and plain-language glosses explicit.
- 2026-08-30 — Verification passed: 84 focused Node tests; synchronized Techne
  fixture; stress-comparison CLI smoke; targeted ESLint and Prettier; hermetic
  test-manifest and diff checks; headless Chrome at 1440×1000 and 390×844 with
  no overflow, page errors, or unlabeled dialogue regions. Visual inspection
  confirmed readable two-column and stacked-mobile Techne renderings.
