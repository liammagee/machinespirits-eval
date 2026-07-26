# Program-2 stall corpus and auditability gate

Status: `NO_GO_CORPUS_FLOOR`.

This is the zero-call Phase 0/1 gate for the proposed `stagnant_repeat`
specialist. It is an operational feasibility result, not a training or live
effect claim.

## Frozen audit

A source turn passes only when the archived detector assignment and compliance
record agree, the detector inputs replay the four-action stagnant-repeat rule,
the final delivered tutor text passes the recorded guards, and the response
contains exactly one question so the established Program-2 protected-span
contract can be reused.

The move itself must take one of two paths:

- a due premise exists, and the tutor releases at least one premise through
  `stage_next_step`; or
- no premise is due, the tutor releases none, and it changes from the repeated
  family to `reanchor_public_evidence` or `ground_in_material`.

## Result

The four frozen archive families contain 140 planned dialogues and 139 sealed
dialogues. They yield 101 raw `stagnant_repeat` assignments, of which 49 pass
the strict audit against the preregistered floor of 100. Passing paths comprise
48 due-premise releases and one public reanchor. Ninety rows retain the
exactly-one-question span shape.

The primary failure is not merely missing instrumentation: 50 rows fail the
actual break-path condition, 11 fail the one-question span condition, and one
fails the recorded final-delivery guards. Because the strict eligible corpus is
49/100, dataset construction and training remain unlicensed.

The result does not permanently kill the move family. Future sealed runs can
grow the corpus, after which the same command can be rerun without changing the
audit:

```bash
npm run program2:stall-audit
```

Machine-readable provenance and archive hashes are frozen in
`config/adaptive-tutor-evidence/program-2-stall-phase0-1.manifest.json`.
