# Architecture Diagram Package

This directory contains visual summaries of the architecture that Paper 2.0
actually supports. The diagrams are meant to communicate the research result,
not just the implementation topology.

## Source Discipline

Primary source: `docs/research/paper-full-2.0.md`.

Load-bearing sections:

- Section 4: observable bilateral ego-superego architecture, trace labels,
  provenance, scoring, and factorial isolation.
- Sections 6.1-6.4: calibration, error correction, universal substitution,
  and model-dependent residuals.
- Section 6.3 and Section 7.9: adaptive responsiveness null and the scope
  of the slope proxy.
- Sections 6.8-6.9: adaptive runner, trap-scenario apparatus, dual scoring,
  and the conclusion that the apparatus is stronger than the rich-state
  elaborations.
- Section 6.13: dramatic derivation, conduct governance, pacing guards,
  proof debt, and the no-universal-single-channel boundary.
- Section 8.1: synthetic learner limitation and the human learning frontier.

## Files

- `architecture-overview.html` - self-contained HTML plus inline SVG overview.
- `architecture-overview.svg` - standalone SVG version of the overview.
- `01-runtime-observability.mmd` - bilateral tutor/learner runtime and scoring
  observability.
- `02-mechanism-findings.mmd` - supported mechanisms, nulls, and scope.
- `03-cell-runner-map.mmd` - config-driven dispatch from cells to standard,
  adaptive, and derivation harnesses.
- `04-conduct-governance-boundary.mmd` - proof-world guard architecture and
  geometry-dependent guard boundary.
- `gpt-image-2-frontispiece.png` - optional GPT Image 2 raster frontispiece,
  generated without text so it does not carry claims.
- `gpt-image-2-frontispiece-prompt.md` - optional raster frontispiece prompt;
  not a source of truth for labels or claims.

Rendered Mermaid review pages are generated next to the `.mmd` files with:

```bash
npm run mermaid:html -- docs/research/architecture-diagrams/01-runtime-observability.mmd
npm run mermaid:html -- docs/research/architecture-diagrams/02-mechanism-findings.mmd
npm run mermaid:html -- docs/research/architecture-diagrams/03-cell-runner-map.mmd
npm run mermaid:html -- docs/research/architecture-diagrams/04-conduct-governance-boundary.mmd
```

## Interpretation

The central architectural message is deliberately conservative:

1. Recognition acts first as prompt-level calibration.
2. The superego acts as error correction mainly when calibration is absent or
   the generation model is weak enough to leave residual failures.
3. Recognition plus multi-agent deliberation does not reliably create a higher
   within-dialogue adaptation rate under the paper's fixed-rubric slope proxy.
4. Rich learner-state machinery, bilateral ToM, validators, and policy graphs
   mostly return null, inverted, or channel-specific results.
5. The durable result is the apparatus: observable traces, public-only scoring,
   trap instruments, dual scoring, proof-world checkers, and criterial runtime
   guards.
6. The later derivation arc shows conduct can be governed when a checkable
   guard owns the point of action, but no single hidden or visible pacing signal
   is universal across proof geometries.
7. Human learning outcomes remain open; the synthetic architecture arc does not
   settle transfer, retention, or human-coded conceptual change.
