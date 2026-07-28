---
id: rubric-v3-prospective-measurement-suite
title: Build the prospective rubric v3.0 measurement suite
status: done
type: infra
priority: P1
owner: codex
source: manual
created: 2026-07-27
updated: 2026-07-27
verification: "Passed on refreshed origin/main: targeted rubric/store/runner suite 234/234, including explicit medium-effort judge provenance; broader focused rubric/store/symmetry/canonical suite 197/197; tutor-core hermetic 137/137; npm run lint; npm run format:check; npm run lint:cycles; npm run test:manifest; npm run wp:source-check; eval-cli validate-config; sensitivity audit on the two v2.2 PCA source runs. The pre-refresh root hermetic shards reached 7191/7194: one proof-command snapshot failure reproduces in the untouched source checkout, and two tests cannot import rdf-validate-shacl/@modelcontextprotocol/sdk from the shared local node_modules. Live v3.0 model calibration and held-out human acceptance remain intentionally deferred."
branch: codex/rubric-v3-measurement-suite
depends_on:
  - d5-rubric-v3-0-pca-informed-consolidation
links:
  items:
    - tutor-pr-benchmark-calibration-harness
  notes:
    - docs/rubric-v3-measurement-suite.md
    - notes/design-d5-rubric-v3-pca-consolidation.md
tags:
  - rubric
  - calibration
  - qa
  - human-labelling
milestone: adaptive-tutor-evidence-v1
---

Implement the deferred D5 design as a prospective, opt-in v3.0 measurement
epoch. Preserve active v2.2 and its Paper 2.0 comparisons, consolidate tutor
turn scoring to the empirically supported general-quality plus content-accuracy
structure, and keep tutor trajectory, learner change, encounter quality, hidden
deliberation, and reliability as explicitly separate evidence levels.

The suite must be runnable through `--rubric-version 3.0`, retain raw component
scores, support same-response rejudging by both local CLI families, expose a
zero-call sensitivity/reliability report, and document a development-to-held-out
calibration path that can proceed independently of generation and other human
labelling work.

Live model scoring, human anchors, threshold approval, and promotion to the
active rubric are deliberately outside this implementation slice.
