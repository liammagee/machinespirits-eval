---
id: from-prompts-to-context-an-ontology-driven-framework-for-hum
title: "From Prompts to Context: An Ontology-Driven Framework for
  Human-Generative AI Collaboration"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-06-22
updated: 2026-06-24
verification: ArXiv source record and roundup note reviewed; decision appended;
  no provenance-ontology implementation task spawned.
links:
  notes: notes/daily-notes/2026-06-11-research-roundup.html
milestone: literature-triage
branch: codex/workplan-board-triage
claim_status: methods
---

arXiv:2605.29675 [UNBLOCK] — surfaced by the daily routine (2026-06-11-research-roundup.html).

This is a near-exact formal treatment of what services/evalSignature.js does informally via config_hash / dialogue_content_hash / prompt_content_hash . CCAI could serve as a reference ontology for formalising the eval pipeline's provenance columns — and as a vocabulary for describing the ego/superego role split in Paper 2.0's architecture section. The SPARQL-query model also suggests a path toward querying the evaluation DB with ontology-grounded filters rather than raw SQL (relevant to /ms-query-db ).

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-06-24 Codex: Source triage: CCAI maps well to eval provenance vocabulary, but the repo already has concrete config/dialogue/prompt hashes. Treat this as optional language for future provenance documentation, not current implementation debt.
