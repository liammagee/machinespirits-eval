# Adaptive tutor evidence manifests

This directory contains small, tracked pointers to locally archived adaptive
tutor runs. Bulk archives live under ignored `artifacts/adaptive-tutor-runs/`.

Each manifest records the immutable run-plan, event-stream, inventory, seal,
and archive hashes; its claim status; explicit exclusions; and restore/verify
commands. A manifest is evidence provenance, not an efficacy claim.

Current bounded fixture:

- [`phase0-mock-qa-evidence-v1-61ceb224bb43.manifest.json`](./phase0-mock-qa-evidence-v1-61ceb224bb43.manifest.json)
  points to a local fake-CLI QA archive that was packaged and
  checksum-verified in a fresh directory. It tests orchestration,
  role-provenance wiring, seeded draws, semantic nested lineage/seals,
  packaging, restore, and read-only report regeneration; it contains no
  model-quality, state-validity, policy-effect, learning, or provider-attestation
  evidence.

The two bounded formal learner-state instruments can be exported and analyzed
without model calls:

```bash
npm run adaptive:export-formal-state-benchmark -- --out <benchmark-dir>
npm run adaptive:analyze-state-validity -- --benchmark-dir <benchmark-dir>
```

Their A21 and DAG-dropout families are synthetic instruments only; neither is
an estimate of human learning or a general cognitive learner model.

Create one only from a sealed run:

```bash
node scripts/package-adaptive-run.js --run-dir <run-dir> --claim-status methods
```

Restore and verify in a fresh directory:

```bash
node scripts/restore-adaptive-run.js --archive <archive.jsonl.gz> --manifest <run.manifest.json> --out <fresh-dir>
node scripts/verify-experiment-run.js --run-dir <fresh-dir>
```
