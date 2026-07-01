---
id: lean-semantic-web-proof-dag-validation
title: Evaluate Lean certificates and Semantic Web exports for proof DAGs
status: blocked
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-24
updated: 2026-07-01
verification: A small Lantern or Nocturne slice exports an authored Lean proof check and RDF/PROV graphs that pass SHACL validation without changing the live JS proof gate.
blocked_by: Lean/Lake is not installed locally, so generated Lean certificates cannot be checked yet.
claim_status: future
links:
  notes: notes/2026-06-24-lean-semantic-web-proof-dag-analysis.md
tags:
  - proof-dag
  - lean
  - semantic-web
  - provenance
  - shacl
milestone: poetics-followups
---

Future-work topic captured from the proof-DAG formalism discussion.

Question: should dramatic derivation DAGs gain external formal/export layers
beyond the current JS forward chainer?

Working split:

- Keep the current Horn-rule forward chainer as the live learner-entitlement
  gate.
- Add an optional Lean certificate exporter for authored proof DAGs.
- Add RDF/JSON-LD + PROV export for authored, learner, and tutor-model DAGs.
- Use SHACL to validate graph artifact shape and redaction boundaries.

Acceptance criteria:

- [x] Pick a small Lantern or Nocturne world as the fixture.
- [ ] Generate a Lean file that checks the authored positive proof.
- [ ] Generate RDF/JSON-LD + PROV for authored DAG, learner proxy DAG, and
      tutor learner-DAG model.
- [ ] Add SHACL shapes that validate required graph structure and forbid hidden
      authored identifiers in learner/tutor projections.
- [ ] Document why non-entailment/prefix-safety remains with the JS chainer
      unless the finite closure algorithm is formalized in Lean.

2026-07-01 Codex: Triage pass selected `world_001_nocturne` as the smallest
Nocturne fixture because it already has authored proof paths, rule applications,
mirror fuel, and a release schedule. Local tooling check: `lean` and `lake` are
not on PATH, while the Node `n3` RDF package is available and `jsonld` is not.
Do not change the live JS proof gate for this item; the next unblock is a
pinned Lean/Lake toolchain, then an optional exporter/checker slice.
