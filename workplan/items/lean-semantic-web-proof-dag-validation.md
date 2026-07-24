---
id: lean-semantic-web-proof-dag-validation
title: Evaluate Lean certificates and Semantic Web exports for proof DAGs
status: review
type: research
priority: P2
owner: codex
source: manual
created: 2026-06-24
updated: 2026-07-25
branch: codex/lean-semantic-web-proof-dag-validation
verification: A small Lantern or Nocturne slice exports an authored Lean proof check and RDF/PROV graphs that pass SHACL validation without changing the live JS proof gate.
claim_status: future
links:
  notes: notes/2026-06-24-lean-semantic-web-proof-dag-analysis.md
  code:
    - services/dramaticDerivation/semanticWebProofDag.js
    - services/dramaticDerivation/semanticWebValidation.js
    - scripts/export-proof-dag-semantic-web.js
    - scripts/tutor-stub.js
    - services/tutorStubCommandRegistry.js
    - tools/proof-dag-semantic-web/
    - docs/proof-dag-verification-and-inspection.md
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
- [x] Generate a Lean file that checks the authored positive proof.
- [x] Generate RDF/JSON-LD + PROV for authored DAG, learner proxy DAG, and
      tutor learner-DAG model.
- [x] Add SHACL shapes that validate required graph structure and forbid hidden
      authored identifiers in learner/tutor projections.
- [x] Document why non-entailment/prefix-safety remains with the JS chainer
      unless the finite closure algorithm is formalized in Lean.

2026-07-01 Codex: Triage pass selected `world_001_nocturne` as the smallest
Nocturne fixture because it already has authored proof paths, rule applications,
mirror fuel, and a release schedule. Local tooling check: `lean` and `lake` are
not on PATH, while the Node `n3` RDF package is available and `jsonld` is not.
Do not change the live JS proof gate for this item; the next unblock is a
pinned Lean/Lake toolchain, then an optional exporter/checker slice.

2026-07-02 Codex: Lean/Lake is now locally available under `~/.elan/bin`.
Added the pinned, dependency-free Lake project `tools/proof-dag-lean/`, a
Nocturne generated certificate at
`tools/proof-dag-lean/ProofDag/Generated/World001Nocturne.lean`, and
`scripts/check-proof-dag-lean.js` / `npm run derivation:lean-cert:check`. The
check passes for all four authored `world_001_nocturne` proof paths. This
does not replace the JS runtime chainer; the Lean slice is an authored positive
certificate only. Remaining work is the RDF/JSON-LD + PROV export and SHACL
redaction/shape validation.

2026-07-22 Codex: Parked in triage. The Lean certificate slice is complete;
the RDF/PROV exporter and SHACL boundary checks remain coherent future work,
but no active branch or near-term paper dependency currently owns them.

2026-07-25 Codex: Reactivated after explicit user confirmation from current
`main` at `768d46b9`. The bounded implementation slice is the optional
RDF/JSON-LD + PROV export and SHACL validation layer for Nocturne. The live
JavaScript proof-entitlement gate and paid-model paths remain out of scope.

2026-07-25 Codex: Implemented three authority-separated RDF/JSON-LD + PROV
exports, authored/public SHACL shapes, pre-serialization identifier audits, a
deterministic checked-in Nocturne fixture, and positive/negative regressions.
`npm run derivation:semantic-web:check` passes at 534 authored, 93 learner,
and 103 tutor quads; `npm run derivation:lean-cert:check`, lint, formatting,
source-only workplan validation, and the full hermetic suite also pass. No
model calls were made and the live JavaScript proof gate was not changed.

2026-07-25 Codex: Added the operator-facing verification and inspection guide
and the in-session `/proof` command. `/proof` runs both external checks;
targeted forms check Lean or semantic-web layers, inspect each authority
projection, list raw paths, or explicitly refresh the generated graph fixture.
The command names the fixed Nocturne scope and routes live-session inspection
to `/analysis technical`. While making the learner graph inspectable, fixed a
fixture ledger lookup that had produced a structurally valid but empty grounded
record; regressions now require six public grounded facts, three voiced
conclusions, 0.857 best-path coverage, and one unreleased missing premise.
