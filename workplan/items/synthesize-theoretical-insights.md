---
id: synthesize-theoretical-insights
title: Synthesize the theory↔project relationship (Hegel/Freud/Weber/Aristotle) into a refreshable reference surface
status: done
type: content
priority: P2
owner: claude
source: manual
created: 2026-06-24
updated: 2026-06-24
verification: A theory-synthesis surface renders in the web app and (by construction) the Electron desktop; a regeneration script + npm alias refreshes it from the paper + codebase; the doc introduces no new empirical claims (inherits docs/research/paper-full-2.0.md).
claim_status: methods
links:
  paper: docs/research/paper-full-2.0.md
tags:
  - theory
  - synthesis
  - hegel
  - freud
  - weber
  - aristotle
  - web-surface
  - reference
---

Trawl the paper and codebase to synthesize how the project's theoretical lineages
map onto its architecture, mechanisms, and findings — then turn that into a single
refreshable reference surface for the web + desktop app and for future development.

Theoretical lineages in scope:

- **Hegel** — mutual recognition (Anerkennung), the master–slave dialectic, Geist;
  operationalized in the recognition prompts, the dialectical superego, and the
  recognition-lexicon analysis.
- **Freud** — the ego/superego/id topology; the bilateral ego–superego tutor/learner
  architecture and the id-director charisma family (cells 101–109).
- **Weber** — charisma and its routinization; the Weber-derived 8-dimension charisma
  rubric.
- **Aristotle** — Poetics (peripeteia, anagnorisis); the dramatic-recognition arc and
  the poetics rubric.
- Plus the supporting motifs the project actually leans on (Oedipus / contingent
  particular, Meno / derivability, etc.).

Deliverables:

- A synthesis document (theory ↔ mechanism ↔ finding) authored against the techne HTML
  framework so it renders in the web app and, by construction, the Electron desktop.
- A new read-only surface/route that mounts the document in the shared web stack (so the
  desktop inherits it automatically — one UI codebase).
- A regeneration script + npm alias (e.g. `theory:synthesize`) and a note in the relevant
  skill, so the doc can be refreshed as the paper/codebase evolve — mirroring the paper /
  `drama:showcase` refresh pattern.

Constraints:

- Inherits all empirical claims from `docs/research/paper-full-2.0.md`; introduces **no**
  new numbers or claims (re-presents existing framing through a theory lens — the same rule
  that governs paper spin-offs).
- Edit the web stack only; never fork UI into `desktop/`.
