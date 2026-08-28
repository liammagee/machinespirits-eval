---
id: learning-to-persuade-exposes-how-easily-llms-abandon-correct
title: Learning to Persuade Exposes How Easily LLMs Abandon Correct Beliefs
status: triaged
type: research
priority: P3
owner: unassigned
source: daily-routine
created: 2026-08-17
updated: 2026-08-28
verification: The suspicious-superego and trap-suite analysis carries a named
  tactic checklist (fabricated citation, false authority, confident hollow
  argument), and a trace pass reports how often each appears and whether the
  superego catches it.
links:
  notes: notes/daily-notes/2026-08-17-research-roundup.html
---

arXiv:2608.11624 [UNBLOCK] — surfaced by the daily routine (2026-08-17-research-roundup.html).

Names a failure mode the trap-scenario suite (cells 110-125) is built to probe from the other side: can a learner talk a tutor out of a correct position, or a tutor talk a learner into a wrong one, through confident-sounding but hollow argument rather than evidence? The paper's tactic taxonomy (fabricated citations, false authority) is a ready checklist for `services/dialogueTraceAnalyzer.js` and the `dialectical_suspicious` superego (cells 22-33, 93-100), whose whole job is to catch exactly this kind of unearned confidence in the ego's draft before it reaches the learner.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-08-28 Claude: Promoted. The tactic taxonomy is directly usable as a named checklist for the `dialectical_suspicious` superego (cells 22-33, 93-100), whose job is exactly to catch confident but unearned argument before it reaches the learner. Distinct from the settled persuadability card (`a-model-of-multi-turn-human-persuadability-using-probabilist`), which is about tracing a learner's belief state; this one is about the tutor abandoning a correct position under pressure. Kept at P3 pending an owner.
