---
id: character-variety-literature-triage
title: "CASPER in the Machine: Insights into Character Variety in LLM-Generated
  Stories"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-02
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: future
links:
  notes:
    - notes/daily-notes/2026-07-02-research-roundup.html
  items:
    - scenario-presentation-variety
    - character-development-capacity
    - arcane-do-role-playing-language-agents-stay-in-character-at
tags:
  - literature
  - poetics
  - character
milestone: literature-triage
---

arXiv:2606.22454 [UNBLOCK] — surfaced by the daily routine (2026-07-02-research-roundup.html).

Directly actionable for scripts/drama-generator.js and the poetics rubric. The "tidier arcs / completed storylines" finding is a plausible mechanism behind the phase-2 transfer failure (weighted κ ≈ 0.04) noted in DRAMATIC-RECOGNITION-PLAN.md : if generated tutoring dramas systematically over-resolve character arcs relative to human-authored drama, critics trained on real dramatic form would diverge from critics scoring generated transcripts for exactly the reason CASPER documents. The CASPER category-pairs (stylized/natural, coherent, complex, dynamic, closed, etc.) are also a ready-made secondary coding scheme to cross-tabulate against config/evaluation-rubric-poetics.yaml 's peripeteia/anagnorisis dimensions.

Decision, 2026-08-04: Scenario variety, character-development capacity, and phase-conditioned character evaluation have already been implemented or explicitly assessed. CASPER is useful interpretation for over-tidy generated arcs, but the historical transfer failure alone does not license a new coding scheme or poetics-rubric change.
