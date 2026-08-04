---
id: private-public-agent-divergence-literature-triage
title: "What LLM Agents Say When No One Is Watching: Social Structure and Latent
  Objective Emergence in Multi-Agent De"
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
    - version-symmetric-trace-transformation-pipeline
tags:
  - literature
  - deliberation
  - public-private
milestone: literature-triage
---

arXiv:2607.02507 [UNBLOCK] — surfaced by the daily routine (2026-07-05-research-roundup.html).

Structurally close to the bilateral ego-superego architecture, which already separates private deliberation ( ego/generate , superego/review ) from public output ( tutor/final_output ) and persists both to tutor_deliberation_* columns. The paper's public-vs-OTR divergence metric is a directly reusable audit: a new analysis script could compare what the superego critiques privately against what the ego's revision actually outputs, to check whether social framing (recognition-mode language, dialectical_suspicious's adversarial framing) induces the same kind of public/private split this paper finds in undirected multi-agent debate — relevant to both cells 22-33 and the divergence the paper documents rising specifically under alignment-inducing conditions.

Decision, 2026-08-04: The framing-trajectory card already asks whether private superego critique causes a genuine public ego reframe rather than a restatement, using the symmetric trace substrate. That is the executable form of this capture, so a second divergence script would be duplicate work.
