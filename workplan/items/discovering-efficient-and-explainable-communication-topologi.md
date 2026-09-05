---
id: discovering-efficient-and-explainable-communication-topologi
title: Discovering Efficient and Explainable Communication Topologies for
  LLM-based Multi-Agent Systems via Causal In
status: done
type: research
priority: P3
owner: codex
source: daily-routine
created: 2026-08-17
updated: 2026-09-04
verification: Trace-only analysis reports, per deliberation link, whether the
  superego critique measurably changes the ego revision, with a stated null and
  no paid calls.
branch: codex/communication-topology-trace-analysis
claim_status: exploratory
links:
  notes:
    - notes/daily-notes/2026-08-17-research-roundup.html
  exports:
    - notes/2026-09-04-communication-topology-link-analysis.md
    - notes/2026-09-04-communication-topology-link-analysis.json
  code:
    - services/communicationTopologyTraceAnalyzer.js
    - scripts/analyze-communication-topology-links.js
    - tests/communicationTopologyTraceAnalyzer.test.js
---

arXiv:2608.12921 [WATCH] — surfaced by the daily routine (2026-08-17-research-roundup.html).

A causal lens on a question this project answers by convention: the ego-superego-(id) links in `tutor-core/`, the divergent-superego cells (22-33), and the id-director cells (101-109) are all fixed, hand-designed communication paths. This paper's method — test each link's causal effect on the final output rather than assume it matters — is a candidate way to check whether, say, the superego's critique measurably changes the ego's revision in `dialogueTraceAnalyzer.js`'s traces, or whether some deliberation turns are along for the ride.

Triage: promote to a research item (link the paper §) or drop with a reason.

2026-08-28 Claude: Promoted. The checkable question is one this project can answer from traces it already has and with no paid calls: does the superego critique measurably change the ego's revision, or are some deliberation links along for the ride? `services/dialogueTraceAnalyzer.js` already reads the incorporation of superego feedback, so the paper's method (test each link's effect rather than assume it) has an existing home. Kept at P3: it is a methods check, not a study.

2026-09-04 Codex: Started the trace-only analysis from current `origin/main` on `codex/communication-topology-trace-analysis`; paid/model-call ceiling is zero.

2026-09-04 Codex: Closed after the deterministic audit mapped 1,859 stored superego checks across 319/319 available divergent-superego dialogue traces to 1,202 eligible immediate critique→revision links. The predeclared broken-link comparison held each draft/revision fixed and substituted a same-scenario, same-route, same-ordinal critique from another dialogue. Of 1,202 links, 304 had at least 19 matched null comparators: 182 had positive raw lexical uptake, but 0/304 survived the 5% false-discovery-rate rule; 898 later/sparser links remain indeterminate rather than negative. This is an exploratory per-link lexical-association null, not evidence that critique is causally inert or semantically unincorporated. The report and JSON ledger preserve trace SHA-256 provenance, database/rubric missingness, and the separate id-director topology boundary. No model calls or historical rescoring occurred. Focused analyzer, CLI, registry, legacy trace, formatting, lint, manifest, and workplan checks passed; two full report reruns were byte-identical.
