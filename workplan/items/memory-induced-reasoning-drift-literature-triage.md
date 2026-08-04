---
id: memory-induced-reasoning-drift-literature-triage
title: "DRIFTLENS: Measuring Memory-Induced Reasoning Drift in Personalized
  Language Models"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-05
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: methods
links:
  notes:
    - notes/daily-notes/2026-07-05-research-roundup.html
  items:
    - recode-superego-incorporation-as-a-framing-trajectory
    - longitudinal-drift-adaptation
tags:
  - literature
  - prompt-erosion
  - drift
milestone: literature-triage
---

arXiv:2607.02374 [UNBLOCK] — surfaced by the daily routine (2026-07-05-research-roundup.html).

A ready-made methodology for cells 48-49 (prompt erosion) and cell 21 (dynamic prompt rewriting / Writing Pad): both mechanisms accumulate injected context into the tutor's prompt turn over turn, which is exactly DRIFTLENS's "memory-injected trajectory" setup. Its divergence metric — reasoning-step value-category shift relative to a no-memory baseline — is a more principled complement to the existing text-proxy erosion measures, and could plug into services/evalSignature.js 's prompt_content_hash drift detection to distinguish benign rephrasing from actual reasoning-path drift as the Writing Pad accumulates.

Decision, 2026-08-04: The existing framing-trajectory card already targets cells 21 and 48-49 with a read-only re-analysis, and the longitudinal drift card records the bounded memory experiment. DRIFTLENS can inform that coding decision, but it does not require a parallel analysis card.
