---
id: structured-resistance-literature-triage
title: "Beyond Sycophancy: Structured Resistance and Compliance in LLM Moral
  Reasoning"
status: done
type: research
priority: P2
owner: codex
source: daily-routine
created: 2026-07-27
updated: 2026-08-04
verification: The arXiv source and roundup note were reviewed against the linked
  project work; the consolidation decision is recorded and no duplicate
  experiment, implementation, or claim was created.
branch: codex/consolidate-workplan-inbox
claim_status: methods
links:
  notes:
    - notes/daily-notes/2026-07-27-research-roundup.html
  items:
    - recode-superego-incorporation-as-a-framing-trajectory
    - negative-register-effect-estimation-grid
tags:
  - literature
  - superego
  - resistance
milestone: literature-triage
---

arXiv:2607.21558 [UNBLOCK] — surfaced by the daily routine (2026-07-27-research-roundup.html).

Directly relevant to the divergent-superego cells (22-33, `config/tutor-agents.yaml`), which manipulate the superego's critique register (suspicious/adversary/advocate) and depend on the ego resisting or incorporating that critique in a principled way rather than simply yielding to it. This paper's three-dimensional resistance-compliance framework — distance, source attribution, coalition — is a candidate lens for `services/dialogueTraceAnalyzer.js`'s superego-feedback-incorporation analysis: rather than a single incorporation-rate number, ego revisions could be classified by *why* the ego moved (was the superego's critique close to the ego's own position? was it framed as the ego's own prior reasoning reflected back? did the "advocate" vs "adversary" register function like a coalition size manipulation?).

Decision, 2026-08-04: The planned framing-trajectory recoding already asks why an ego revision moved, while the active register grid measures stance-fidelity effects. The resistance-compliance taxonomy can inform those analyses without creating another overlapping coding programme.
