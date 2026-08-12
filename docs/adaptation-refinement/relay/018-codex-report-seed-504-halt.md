# 018 — Codex report: seed-504 coverage halt and diagnosis

**Date:** 12 August 2026  
**Driver lease:** `DRIVER-LEASE-2026-08-12-D`  
**Boundary:** relay 017 halt and zero-call diagnosis complete; repair/relaunch continues under the standing authorization

## Halt result

The live seed-504 representative matrix crossed relay 017's predeclared
10% no-signal threshold. At the first measurement, 34 of 34 completed
learner-analysis turns were recorded as unanalyzed (100%). The coordinator
was paused before it could admit another dialogue. Its six already-running
dialogues were allowed to finish and seal, after which only the paused
coordinator was terminated.

The preserved boundary is:

- source commit: `d72931bff3b72357b52f5a4e65f1ff41f5c713eb`;
- root: `/private/tmp/adaptive-warrant-v3-matrix-live-d72931bf-s504`;
- six sealed dialogues, 48 completed learner-analysis turns;
- 48 `learner_analysis_unanalyzed` markers: **48/48 = 100%**;
- 151 completed model calls in the sealed children: 48 learner, 48 learner
  analysis, 48 tutor, two opening, and five tutor-recovery calls;
- all 48 no-signal markers have failure code
  `invalid_strict_call_provenance`;
- study-plan SHA-256:
  `a0947085ceac09e4c04c310a6ec8578a6cc9aa57a5bf207d2564299e24ca404a`;
- accepted-authorization SHA-256:
  `c3580cfe77a0195e15b4d0e71178d70c53c889028ded46d8799e067be5af31d6`;
- ordered run-seal-list SHA-256:
  `ed9fceca57fb98c39a56b445a49726f06b5e7356690a445a26ba5ac192a064ff`.

No child was killed mid-dialogue. No seventh dialogue started. The partial
seed-504 corpus is burned, will not be scored or pooled, and must be added to
the representative matrix's explicit exclusion set.

## Zero-call diagnosis

Relay 017 hypothesis **(a)** is confirmed: the live learner-analysis call did
not send the provider schema. This was not a false provenance flag on a
schema-enforced response.

At frozen commit `d72931bf`, the strict extractor correctly constructed an
`outputSchema`, but the injected live transport destructured no such field.
Its CLI call at `services/tutorStubPromptTransport.js:190-196` forwarded only
message history, the ambient CLI effort, event callback, and signal. It then
copied the response at lines 197-214 without the bridge's structured-output
or tool-audit provenance.

The Codex bridge's actual flag source is
`services/cliProviderBridge.js:1057`: `structuredOutput` is true exactly when
that bridge received a schema. Because the live call omitted the schema, the
flag was correctly false. The fail-closed consumer at
`services/tutorStubPublicLearnerAnalysis.js:2378-2405` then correctly rejected
each otherwise JSON-shaped response.

The acceptance ping did not expose this because it called the CLI bridge
directly with its schema, bypassing the live prompt transport. The repair
therefore belongs only to request transport and provenance preservation, plus
the relay-017b runner guards. It does not change the semantic contract,
schema, reader task, thresholds, or frozen design.

## Proceeding

The next commit will:

1. route both the acceptance ping and live seat through one shared CLI request
   constructor/dispatcher;
2. forward the strict schema and preserve the bridge's structured-output and
   tool-audit provenance;
3. add the relay-017b first-call and 10%-coverage self-halt guards with a typed
   `coverage_halt` study status;
4. add focused regressions and zero-call preflight checks for both the shared
   path and guards;
5. freeze seed 505 with the burned seed-504 corpus excluded, then run the
   authorized preflight, applicable ping rule, and relaunch.

No model calls were made during diagnosis.
