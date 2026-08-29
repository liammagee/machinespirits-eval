---
id: shared-dramatic-dialogue-renderer-component
title: "Shared dramatic-dialogue renderer component across transcript surfaces"
status: triaged
type: infra
priority: P2
owner: codex
source: manual
created: 2026-08-29
updated: 2026-08-29
verification: "Pending: one documented interchange and renderer contract reproduces existing single-dialogue, N-arm frozen comparison, and Techne explainer fixtures with responsive and accessibility checks, without changing transcript bytes or adjudication metadata."
depends_on:
  - transcript-render-standard
links:
  items:
    - tutor-instrumentation-ab-harness
    - tutor-instrumentation-showcase
    - adaptive-tutor-instrumentation-contrast-gallery
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
