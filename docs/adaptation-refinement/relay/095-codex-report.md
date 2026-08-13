# 095 — Codex report: v4 contract re-take, completed pilot, registered NO-GO

**Date:** 13 August 2026. **Authority:** reviewer ruling 094a. **GO note:**
083a. **Resume authority:** 083d. **Repair commit:**
`e661b7a9af2bc6a3816d3743f64f099e19fc0a29`.

## Final status

- The frozen deterministic contracts were run zero-call over all 576 accepted
  reader responses before any repair or re-take. Exactly one presence response
  and no decision response was invalid. The per-channel counts, 1 and 0, were
  within the 10-attempt allowance room named by ruling 094a.
- The invalid response was moved byte-for-byte to the disclosed quarantine.
  It was never edited. A reviewer-authorized quarantine manifest bound its
  reader, batch, case, original path, quarantine path, SHA-256, and exact
  contract error.
- Both child runners received the manifest-driven re-take path. The first and
  only re-take draw passed the full deterministic contract at acceptance. The
  append-only presence checkpoint retains both completion records; the parent
  selected the latest valid completion in a derived assembly view.
- The same GO-note command plus `--resume` completed with exit 0. The parent
  assembled both 144-case channels and emitted the frozen score artifact.
- The registered pilot gate is **NO-GO**: assembly criterion (a) passed and
  variance criterion (c) passed, but saturation criterion (b) failed because
  measures 7 and 8 each took one value on more than 90% of their registered
  consensus-case denominator.
- That registered failure is terminal. The 72-dialogue main block remains
  unauthorized and was not launched. Interpretation remains reserved to the
  reviewer. No process remains running. Nothing was pushed.

## Mandatory zero-call enumeration

The following is the audit enumeration verbatim:

```text
SUMMARY | presence | presence-reader-a | audited=144 | invalid=1
SUMMARY | presence | presence-reader-b | audited=144 | invalid=0
SUMMARY | decision | decision-reader-a | audited=144 | invalid=0
SUMMARY | decision | decision-reader-b | audited=144 | invalid=0
TOTAL | audited=576 | invalid=1
INVALID | channel=presence | reader=presence-reader-a | batch=presence-reader-a-batch-71 | case=case-aad700bb02c0ad2d5cdc216a | error=presence-reader-a-batch-71 case-aad700bb02c0ad2d5cdc216a event 2.requested_or_proposed_action target does not match its action object
```

Allowance decision:

| Channel | Invalid | Room before re-take | Proceeded |
|---|---:|---:|---|
| Presence | 1 | 10 | yes |
| Decision | 0 | 10 | yes |

## Quarantine and per-case disclosure

Run root:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v4-live-2026-08-13/
```

- Quarantine directory:
  `quarantine-ruling-094a-contract-invalid-responses/`.
- Reviewer-authorized manifest:
  `reader-response-quarantine-manifest.json`,
  SHA-256
  `ad86f3d6daa2e8dc439f257761017baf38a3d540fc3ed87f6854f9424a942a62`.
- Quarantined file:
  `quarantine-ruling-094a-contract-invalid-responses/presence-reader-a/presence-reader-a-batch-71.response.json`,
  SHA-256
  `02fdc198fefc48ca2f4f49515742ebe8b4197e8f474276115507ecd1a981fe87`.
- Replacement file:
  `presence-readers/presence-reader-a/presence-reader-a-batch-71.response.json`,
  SHA-256
  `b0bdae22b16c3b5e521fd580b0f319ea94a9c4d1df083628db988ff60300811c`.
- Replacement provenance: `codex.gpt-5.6-luna` through the registered
  `explicit_cli_model_argument_accepted_bridge_echo` route; zero prohibited
  tool events; 24,353 ms; deterministic contract `passed`.
- No invalid re-draw occurred, so no re-take-attempt quarantine file was
  created.

The sole affected case was
`case-aad700bb02c0ad2d5cdc216a`,
`presence-reader-a-batch-71`. Its quarantined annotation was:

```json
{
  "genuinely_ambiguous": false,
  "ambiguity_reason": "none",
  "events": [
    {
      "speech_act": "analytic_contribution",
      "target": {
        "state": "catalog",
        "target_id": "signal_lamp",
        "requested_value_types": ["sound", "other"],
        "component_ids": ["wipedCore_signalLamp_kite"]
      },
      "requested_or_proposed_action": {"state": "none"},
      "evidence_span": "It supports that the lamp was wiped and silent"
    },
    {
      "speech_act": "analytic_contribution",
      "target": {
        "state": "catalog",
        "target_id": "signal_lamp",
        "requested_value_types": ["match_status"],
        "component_ids": ["unproved_taker"]
      },
      "requested_or_proposed_action": {"state": "none"},
      "evidence_span": "but not that Runa touched it"
    },
    {
      "speech_act": "learner_record_entry_request",
      "target": {
        "state": "catalog",
        "target_id": "learner_record",
        "requested_value_types": ["match_status", "record_text"],
        "component_ids": ["entry_status", "unproved_taker"]
      },
      "requested_or_proposed_action": {
        "state": "catalog",
        "executor": "tutor",
        "action_object_id": "natural-act-0f58c9b1bd43d2cf"
      },
      "evidence_span": "may I record that proximity alone isn’t a match?"
    }
  ],
  "note": "The learner states the lamp’s observed condition, limits the inference about Runa, and requests recording the bounded proximity claim."
}
```

Its replacement annotation was:

```json
{
  "genuinely_ambiguous": false,
  "ambiguity_reason": "none",
  "events": [
    {
      "speech_act": "analytic_contribution",
      "target": {
        "state": "catalog",
        "target_id": "signal_lamp",
        "requested_value_types": [],
        "component_ids": []
      },
      "requested_or_proposed_action": {"state": "none"},
      "evidence_span": "It supports that the lamp was wiped and silent, but not that Runa touched it"
    },
    {
      "speech_act": "learner_record_entry_request",
      "target": {
        "state": "catalog",
        "target_id": "signal_lamp",
        "requested_value_types": ["match_status", "record_text"],
        "component_ids": []
      },
      "requested_or_proposed_action": {
        "state": "catalog",
        "executor": "tutor",
        "action_object_id": "natural-act-0f58c9b1bd43d2cf"
      },
      "evidence_span": "may I record that proximity alone isn’t a match?"
    }
  ],
  "note": "The learner states the lamp’s evidential limit and separately requests recording the bounded proximity claim."
}
```

## Calls and counter reconciliation

| Channel | Attempted | Completed checkpoint records | Failed/no-response | Active admitted response files |
|---|---:|---:|---:|---:|
| Presence | 291 | 289 | 2 | 288 |
| Decision | 290 | 288 | 2 | 288 |
| **Readers total** | **581** | **577** | **4** | **576** |

Presence has 289 append-only completion records because the quarantined
original completion remains in the child checkpoint and the valid replacement
appended a second completion for that same reader/batch. The derived assembly
view admits the replacement only, so the final evidence set remains 288 unique
responses per channel. The two historical failed/no-response attempts in each
channel are unchanged from report 094.

The authoritative child-checkpoint arithmetic is:

```text
opening                         5,273
generation calls                 495
presence attempts                291
decision attempts                290
pre-pilot settled counter      4,198
final = 4,198 + 495 + 291 + 290 = 5,274 / 19,337
remaining = 19,337 - 5,274       = 14,063
```

This continuation spent exactly one attempt:
`5,274 - 5,273 = 1`. The parent checkpoint's `1,071` actual count records
accepted generation and unique reader-plan completions; as before, the child
checkpoints are authoritative for failed/no-response attempts and the appended
re-take.

Final child-checkpoint hashes:

- presence:
  `bfcdf214b2ae5579c54a4cc38d154d9684e3dc9ce02509f3f8b6ad86201d1ee6`;
- decision:
  `588076f0f57c39acc399e4cbbb15c29393f3a5b01b5ac4a9da40634aa6159a03`.

## Observed endpoint values

The score artifact is
`outcome-pilot-score.json`, SHA-256
`3e01fe8fb18be9c0ceaba61fa0df35313d4c094f3f0802c09c6b133f6670e17b`.
It records `zero_model_calls: true`.

### Measure 1 — decision correctness

| Condition | Correct / consensus | Rate |
|---|---:|---:|
| Bare | 35 / 46 | 0.760870 |
| Gated | 36 / 45 | 0.800000 |
| Standing permission | 34 / 45 | 0.755556 |
| **Pooled** | **105 / 136** | **0.772059** |

There were 144 cases: 136 consensus and 8 non-consensus.

### Measures 2–6 — dialogue-level deterministic values

| Condition | M2 warranted challenges / decisions | M2 rate | M3 maximum-streak values | M4 first-break values |
|---|---:|---:|---|---|
| Bare | 0 / 48 | 0.000000 | 3, 4, 8, 2, 5, 1 | 2, none, none, none, 3, 2 |
| Gated | 11 / 48 | 0.229167 | 4, 4, 5, 3, 6, 6 | 5, none, 3, 6, 7, none |
| Standing permission | 0 / 48 | 0.000000 | 8, 2, 4, 8, 4, 2 | none, 3, 7, none, none, 3 |

For measure 4, breaks occurred in 3/6 bare, 4/6 gated, and 3/6
standing-permission dialogues; none persisted to the end under the stored
measure.

| Condition | M5 growth true / false / not applicable | M6 legitimate closures |
|---|---:|---:|
| Bare | 3 / 0 / 3 | 6 / 6 |
| Gated | 3 / 1 / 2 | 6 / 6 |
| Standing permission | 3 / 0 / 3 | 6 / 6 |

### Measures 7–8 — consensus-case presence

| Condition | Consensus cases | M7 result request | M7 rate | M8 proposed test | M8 rate |
|---|---:|---:|---:|---:|---:|
| Bare | 46 | 1 | 0.021739 | 4 | 0.086957 |
| Gated | 47 | 0 | 0.000000 | 6 | 0.127660 |
| Standing permission | 45 | 0 | 0.000000 | 2 | 0.044444 |
| **Pooled** | **138** | **1** | **0.007246** | **12** | **0.086957** |

There were 144 cases: 138 consensus, 6 non-consensus, and 0 inadmissible.

### Registered pilot gate

| Criterion | Observed | Mechanical result |
|---|---|---|
| (a) assembly | 18/18 dialogues complete; all deterministic measures computed; both 144-case channels assembled and scored | PASS |
| (b) no contrast measure above 90% single-value saturation | M2 66.667%; M3 27.778%; M4 44.444%; M7 99.275%; M8 91.304% | **FAIL (M7, M8)** |
| (c) variance not hopeless | 10 deference breaks overall; gated warranted-challenge rate 11/48, nonzero | PASS |

The exact saturation records are:

| Measure | Denominator | Maximum count | Maximum share | Saturated |
|---|---:|---:|---:|---|
| M2 | 18 dialogues | 12 | 0.666667 | no |
| M3 | 18 dialogues | 5 | 0.277778 | no |
| M4 | 18 dialogues | 8 | 0.444444 | no |
| M7 | 138 consensus cases | 137 | 0.992754 | **yes** |
| M8 | 138 consensus cases | 126 | 0.913043 | **yes** |

Under frozen registration `6, a failure of (b) is a substantive **NO-GO**:
stop and redesign the failing measure before any main block. No effect-size or
substantive interpretation is made here.

## Repair, pins, and verification

Repair commit `e661b7a9af2bc6a3816d3743f64f099e19fc0a29` used the exact
required commit form and contains both required trailers:

- `Workplan-item: N/A`;
- `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

The repair added the shared manifest validator/quarantine/full-contract helper,
made both child paths equivalent, passed the manifest through the parent, and
made the parent assemble from derived latest-completion views without editing
either checkpoint. The decision runner was re-pinned to
`c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad`.

A zero-call real decision-assembly preflight exposed the already-recorded
defect-16 attestation mirror: the decision assembler/scorer required
`model_independently_attested=true` although the frozen authorized channel
requires the exact registered bridge-echo tuple with
`model_independently_attested=false`. The preparer and scorer were aligned to
that exact tuple, still requiring the registered provider/model, zero
prohibited tool events, and response hashes. The decision preparer pin is
`332447730054e13f02d6d8af0d5c4a58130254e08abf838b87237df62d14fb95`.
No reader call was made to discover or verify this mechanical repair.

Verification:

- Focused Node suites:
  `node --test tests/adaptiveWarrantOutcomePilot.test.js tests/adaptiveWarrantOutcomeStudy.test.js tests/adaptiveWarrantSemanticAnnotation.test.js tests/adaptiveWarrantAnnotationCollection.test.js`:
  **79 passed, 0 failed**, including every ruling-094a task-5 case in both
  child paths.
- Targeted ESLint over all changed JavaScript: passed.
- Full `npm run lint` was run and retained only the pre-existing error at
  `services/tutorStubPublicLearnerAnalysis.js:26:3`, unused
  `ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA`.
- Zero-call real decision assembly over both 144-case readers: passed before
  resume.
- Final parent assembly and scoring over both channels: passed.
- `git diff --check` passed before the repair commit.

## Protected artifact verification

| Protected artifact | SHA-256 |
|---|---|
| Original emitted freeze | `bde2028e06cfd3c24d18e0808f5898c4be8ba80651739a779d7e1f99d1f20d52` |
| Brittleness preflight | `743ee634b1b1ec00fb44844f049ec0554def63abe043b9bdf0676cbf2a5e6b1a` |
| Schema-acceptance carryover | `47efb49445a94980b563cb00a96714d4290d92da7f73501c160d3c2f43776111` |
| Presence collection manifest | `c90d1e3e0283b00d102bd5ac1119caf8de5a02492cba3e5598b1da3d27b42575` |
| Presence authorization request | `f97f2b4195f9bb7806a0f10a40a43eab60e05c27dadd615131e8c08a49d0a955` |
| Decision collection manifest | `a53d5a7f5ac4501fd87e03e23d72a46d7af091e8261fb27e029d9f8ce37bc59e` |
| Decision authorization request | `e3c36740c31945d359e6489d212d5c067c1de077f15ef817ca76740eac192d86` |

The response change was a move to quarantine followed by a separately generated
replacement. No paid response was edited. Neither child checkpoint, either
packet collection, the original freeze, nor either zero-call artifact was
manually edited. The checkpoint append and score/assembly artifacts were
written only by the authorized runners.

## Full child-runner diff — byte-symmetry equivalence proof

The following is the complete committed diff for both child runners from
pre-repair HEAD `e6e11e1314f1e311461ebe3e262e97c898eef87c` to repair commit
`e661b7a9af2bc6a3816d3743f64f099e19fc0a29`:

Blank context lines are rendered without unified-diff's single context space
to keep this Markdown file free of trailing whitespace; no changed line is
omitted.

```diff
diff --git a/scripts/run-adaptive-warrant-decision-readers.js b/scripts/run-adaptive-warrant-decision-readers.js
index 47a2873e..4d83f57d 100644
--- a/scripts/run-adaptive-warrant-decision-readers.js
+++ b/scripts/run-adaptive-warrant-decision-readers.js
@@ -12,9 +12,15 @@ import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/ad
 import {
   ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA,
   ADAPTIVE_WARRANT_ANNOTATION_COLLECTION_MANIFEST_SCHEMA,
+  assembleAdaptiveWarrantAnnotationResponse,
   validateAdaptiveWarrantAnnotationAuthorizationRequest,
 } from './prepare-adaptive-warrant-annotation-batches.js';
 import { ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA } from './build-adaptive-warrant-v3-semantic-diagnostic.js';
+import {
+  loadReviewerAuthorizedReaderRetakes,
+  quarantineReviewerAuthorizedRetakeResponse,
+  validateReviewerAuthorizedRetakeResponse,
+} from '../services/adaptiveWarrantReaderRetake.js';

 export const ADAPTIVE_WARRANT_DECISION_READER_RUN_SCHEMA =
   'machinespirits.adaptation-refinement.decision-reader-run.v1';
@@ -138,6 +144,7 @@ export async function runAdaptiveWarrantDecisionReaders({
   approvedBy,
   effort = 'medium',
   resume = false,
+  quarantineManifestPath = null,
   callModel = callAIWithCliBridge,
 } = {}) {
   const resolvedManifest = path.resolve(manifestPath);
@@ -193,11 +200,23 @@ export async function runAdaptiveWarrantDecisionReaders({
     batches: [],
   };
   const run = resume ? readJson(runPath) : freshRun;
+  if (quarantineManifestPath && !resume) {
+    throw new Error('decision reader quarantine manifest is valid only on resume');
+  }
+  const retakes = loadReviewerAuthorizedReaderRetakes({
+    quarantineManifestPath,
+    channel: 'decision',
+    collectionManifest: manifest,
+    run,
+    outputDir: resolvedOutput,
+  });
+  const resumableStatuses = ['running', 'incomplete_model_call_failure', 'incomplete_call_budget_exhausted'];
+  if (retakes.manifest) resumableStatuses.push('complete');
   if (
     run.study_id !== freshRun.study_id ||
     run.source_commit !== freshRun.source_commit ||
     run.authorization?.approval_digest !== authorization.approval_digest ||
-    !['running', 'incomplete_model_call_failure', 'incomplete_call_budget_exhausted'].includes(run.status)
+    !resumableStatuses.includes(run.status)
   ) {
     throw new Error('decision reader resume checkpoint does not match the frozen launch');
   }
@@ -208,90 +227,145 @@ export async function runAdaptiveWarrantDecisionReaders({
   atomicWriteJson(runPath, run);
   for (const reader of manifest.readers) {
     for (const batch of reader.batches) {
-      const completed = run.batches.find(
+      const quarantineEntry = retakes.byBatch.get(`${reader.reader_id}:${batch.batch_id}`) || null;
+      const replacement = quarantineEntry
+        ? run.batches.findLast(
+            (row) =>
+              row.reader_id === reader.reader_id &&
+              row.batch_id === batch.batch_id &&
+              row.status === 'complete' &&
+              row.retake_of_response_sha256 === quarantineEntry.response_sha256 &&
+              row.quarantine_manifest_sha256 === retakes.manifestSha256,
+          )
+        : null;
+      const completed = replacement || run.batches.find(
         (row) => row.reader_id === reader.reader_id && row.batch_id === batch.batch_id && row.status === 'complete',
       );
-      if (completed) {
+      const pendingRetake = Boolean(quarantineEntry && !replacement);
+      if (completed && !pendingRetake) {
         if (!completed.response_path || fileSha256(completed.response_path) !== completed.response_sha256) {
           throw new Error(`${batch.batch_id} completed checkpoint response drift`);
         }
         continue;
       }
-      if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
-        run.status = 'incomplete_call_budget_exhausted';
-        atomicWriteJson(runPath, run);
-        throw new Error('decision reader call budget exhausted');
-      }
-      const packet = readJson(batch.packet_path);
-      const outputSchema = readJson(batch.output_schema_path);
-      run.calls_attempted += 1;
-      run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
-      atomicWriteJson(runPath, run);
-      const started = Date.now();
-      try {
-        const result = await callModel(
-          { provider: 'codex', model: 'gpt-5.6-luna' },
-          'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
-          JSON.stringify(packet),
-          `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
-          {
-            outputSchema,
-            effort,
-            timeoutMs: 600_000,
-            maxStdoutBytes: 512_000,
-            maxStderrBytes: 64_000,
-          },
-        );
-        const parsed = parseJsonObject(result.text, batch.batch_id);
-        exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
-        if (
-          parsed.schema !== ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA ||
-          parsed.reader_id !== reader.reader_id ||
-          parsed.batch_id !== batch.batch_id ||
-          parsed.study_id !== manifest.study_id ||
-          parsed.corpus_sha256 !== manifest.corpus.sha256
-        ) {
-          throw new Error(`${batch.batch_id} model response binding mismatch`);
+      while (true) {
+        if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
+          run.status = 'incomplete_call_budget_exhausted';
+          atomicWriteJson(runPath, run);
+          throw new Error('decision reader call budget exhausted');
         }
-        const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
-        const expectedIds = [...batch.required_sample_ids].sort();
-        if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
-          throw new Error(`${batch.batch_id} model response sample-id mismatch`);
+        const packet = readJson(batch.packet_path);
+        const outputSchema = readJson(batch.output_schema_path);
+        run.calls_attempted += 1;
+        run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
+        atomicWriteJson(runPath, run);
+        const started = Date.now();
+        let result = null;
+        let rawResponse = null;
+        try {
+          result = await callModel(
+            { provider: 'codex', model: 'gpt-5.6-luna' },
+            'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
+            JSON.stringify(packet),
+            `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
+            {
+              outputSchema,
+              effort,
+              timeoutMs: 600_000,
+              maxStdoutBytes: 512_000,
+              maxStderrBytes: 64_000,
+            },
+          );
+          rawResponse = String(result.text || '');
+          const parsed = parseJsonObject(rawResponse, batch.batch_id);
+          exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
+          if (
+            parsed.schema !== ADAPTIVE_WARRANT_ANNOTATION_BATCH_RESPONSE_SCHEMA ||
+            parsed.reader_id !== reader.reader_id ||
+            parsed.batch_id !== batch.batch_id ||
+            parsed.study_id !== manifest.study_id ||
+            parsed.corpus_sha256 !== manifest.corpus.sha256
+          ) {
+            throw new Error(`${batch.batch_id} model response binding mismatch`);
+          }
+          const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
+          const expectedIds = [...batch.required_sample_ids].sort();
+          if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
+            throw new Error(`${batch.batch_id} model response sample-id mismatch`);
+          }
+          if (pendingRetake) {
+            validateReviewerAuthorizedRetakeResponse({
+              response: parsed,
+              collectionManifest: manifest,
+              reader,
+              batch,
+              assemble: assembleAdaptiveWarrantAnnotationResponse,
+            });
+          }
+          const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
+          atomicWriteJson(outputPath, parsed);
+          run.calls_completed += 1;
+          run.batches.push({
+            reader_id: reader.reader_id,
+            batch_id: batch.batch_id,
+            status: 'complete',
+            packet_sha256: batch.packet_sha256,
+            output_schema_sha256: batch.output_schema_sha256,
+            response_path: outputPath,
+            response_sha256: fileSha256(outputPath),
+            latency_ms: Date.now() - started,
+            returned_provider: result.provider || null,
+            returned_model: result.model || null,
+            model_attestation_basis: result.modelAttestationBasis || null,
+            model_independently_attested: result.modelIndependentlyAttested === true,
+            prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
+            ...(pendingRetake
+              ? {
+                  reviewer_authorized_retake: true,
+                  retake_of_response_sha256: quarantineEntry.response_sha256,
+                  quarantine_manifest_sha256: retakes.manifestSha256,
+                  deterministic_contract_validation: 'passed',
+                }
+              : {}),
+          });
+        } catch (error) {
+          run.status = 'incomplete_model_call_failure';
+          const quarantined =
+            pendingRetake && rawResponse !== null
+              ? quarantineReviewerAuthorizedRetakeResponse({
+                  rawResponse,
+                  quarantineEntry,
+                  quarantineManifest: retakes.manifest,
+                  attempt: run.calls_attempted,
+                })
+              : null;
+          run.batches.push({
+            reader_id: reader.reader_id,
+            batch_id: batch.batch_id,
+            status: 'failed',
+            packet_sha256: batch.packet_sha256,
+            output_schema_sha256: batch.output_schema_sha256,
+            latency_ms: Date.now() - started,
+            error: error.message,
+            exposed_sample_ids: [...batch.required_sample_ids],
+            ...(pendingRetake
+              ? {
+                  reviewer_authorized_retake: true,
+                  retake_of_response_sha256: quarantineEntry.response_sha256,
+                  quarantine_manifest_sha256: retakes.manifestSha256,
+                  ...(quarantined
+                    ? { quarantine_path: quarantined.path, quarantine_sha256: quarantined.sha256 }
+                    : {}),
+                }
+              : {}),
+          });
+          atomicWriteJson(runPath, run);
+          if (pendingRetake && rawResponse !== null) continue;
+          throw error;
         }
-        const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
-        atomicWriteJson(outputPath, parsed);
-        run.calls_completed += 1;
-        run.batches.push({
-          reader_id: reader.reader_id,
-          batch_id: batch.batch_id,
-          status: 'complete',
-          packet_sha256: batch.packet_sha256,
-          output_schema_sha256: batch.output_schema_sha256,
-          response_path: outputPath,
-          response_sha256: fileSha256(outputPath),
-          latency_ms: Date.now() - started,
-          returned_provider: result.provider || null,
-          returned_model: result.model || null,
-          model_attestation_basis: result.modelAttestationBasis || null,
-          model_independently_attested: result.modelIndependentlyAttested === true,
-          prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
-        });
-      } catch (error) {
-        run.status = 'incomplete_model_call_failure';
-        run.batches.push({
-          reader_id: reader.reader_id,
-          batch_id: batch.batch_id,
-          status: 'failed',
-          packet_sha256: batch.packet_sha256,
-          output_schema_sha256: batch.output_schema_sha256,
-          latency_ms: Date.now() - started,
-          error: error.message,
-          exposed_sample_ids: [...batch.required_sample_ids],
-        });
         atomicWriteJson(runPath, run);
-        throw error;
+        break;
       }
-      atomicWriteJson(runPath, run);
     }
   }
   run.status = 'complete';
@@ -301,7 +375,7 @@ export async function runAdaptiveWarrantDecisionReaders({
 }

 function usage() {
-  return 'Usage: node scripts/run-adaptive-warrant-decision-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <dir> --approved-by <standing-authorization-record> [--effort medium] [--resume]\n';
+  return 'Usage: node scripts/run-adaptive-warrant-decision-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <dir> --approved-by <standing-authorization-record> [--effort medium] [--resume] [--quarantine-manifest <manifest>]\n';
 }

 async function main() {
@@ -314,6 +388,7 @@ async function main() {
       'approved-by': { type: 'string' },
       effort: { type: 'string' },
       resume: { type: 'boolean', default: false },
+      'quarantine-manifest': { type: 'string' },
       help: { type: 'boolean', short: 'h' },
     },
     strict: true,
@@ -330,6 +405,7 @@ async function main() {
     approvedBy: values['approved-by'],
     effort: values.effort || 'medium',
     resume: values.resume,
+    quarantineManifestPath: values['quarantine-manifest'] || null,
   });
   process.stdout.write(`${result.runPath}\n`);
 }
diff --git a/scripts/run-adaptive-warrant-semantic-readers.js b/scripts/run-adaptive-warrant-semantic-readers.js
index a311e135..919c4c77 100644
--- a/scripts/run-adaptive-warrant-semantic-readers.js
+++ b/scripts/run-adaptive-warrant-semantic-readers.js
@@ -18,8 +18,14 @@ import {
 import {
   ADAPTIVE_WARRANT_SEMANTIC_AUTHORIZATION_REQUEST_SCHEMA,
   ADAPTIVE_WARRANT_SEMANTIC_COLLECTION_MANIFEST_SCHEMA,
+  assembleAdaptiveWarrantSemanticAnnotationResponse,
 } from './prepare-adaptive-warrant-semantic-annotations.js';
 import { ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA } from './build-adaptive-warrant-v3-semantic-diagnostic.js';
+import {
+  loadReviewerAuthorizedReaderRetakes,
+  quarantineReviewerAuthorizedRetakeResponse,
+  validateReviewerAuthorizedRetakeResponse,
+} from '../services/adaptiveWarrantReaderRetake.js';

 export const ADAPTIVE_WARRANT_SEMANTIC_READER_RUN_SCHEMA =
   'machinespirits.adaptation-refinement.semantic-event-reader-run.v1';
@@ -239,6 +245,7 @@ export async function runAdaptiveWarrantSemanticReaders({
   approvedBy,
   effort = 'medium',
   resume = false,
+  quarantineManifestPath = null,
   callModel = callAIWithCliBridge,
 } = {}) {
   const resolvedManifest = path.resolve(manifestPath);
@@ -287,11 +294,23 @@ export async function runAdaptiveWarrantSemanticReaders({
     batches: [],
   };
   const run = resume ? readJson(runPath) : freshRun;
+  if (quarantineManifestPath && !resume) {
+    throw new Error('semantic reader quarantine manifest is valid only on resume');
+  }
+  const retakes = loadReviewerAuthorizedReaderRetakes({
+    quarantineManifestPath,
+    channel: 'presence',
+    collectionManifest: manifest,
+    run,
+    outputDir: resolvedOutput,
+  });
+  const resumableStatuses = ['running', 'incomplete_model_call_failure', 'incomplete_call_budget_exhausted'];
+  if (retakes.manifest) resumableStatuses.push('complete');
   if (
     run.study_id !== freshRun.study_id ||
     run.source_commit !== freshRun.source_commit ||
     run.authorization?.approval_digest !== authorization.approval_digest ||
-    !['running', 'incomplete_model_call_failure', 'incomplete_call_budget_exhausted'].includes(run.status)
+    !resumableStatuses.includes(run.status)
   ) {
     throw new Error('semantic reader resume checkpoint does not match the frozen launch');
   }
@@ -302,91 +321,146 @@ export async function runAdaptiveWarrantSemanticReaders({
   atomicWriteJson(runPath, run);
   for (const reader of manifest.readers) {
     for (const batch of reader.batches) {
-      const completed = run.batches.find(
+      const quarantineEntry = retakes.byBatch.get(`${reader.reader_id}:${batch.batch_id}`) || null;
+      const replacement = quarantineEntry
+        ? run.batches.findLast(
+            (row) =>
+              row.reader_id === reader.reader_id &&
+              row.batch_id === batch.batch_id &&
+              row.status === 'complete' &&
+              row.retake_of_response_sha256 === quarantineEntry.response_sha256 &&
+              row.quarantine_manifest_sha256 === retakes.manifestSha256,
+          )
+        : null;
+      const completed = replacement || run.batches.find(
         (row) => row.reader_id === reader.reader_id && row.batch_id === batch.batch_id && row.status === 'complete',
       );
-      if (completed) {
+      const pendingRetake = Boolean(quarantineEntry && !replacement);
+      if (completed && !pendingRetake) {
         if (!completed.response_path || fileSha256(completed.response_path) !== completed.response_sha256) {
           throw new Error(`${batch.batch_id} completed checkpoint response drift`);
         }
         continue;
       }
-      if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
-        run.status = 'incomplete_call_budget_exhausted';
-        atomicWriteJson(runPath, run);
-        throw new Error('semantic reader call budget exhausted');
-      }
-      const packet = readJson(batch.packet_path);
-      const responseSchema = readJson(batch.response_schema_path);
-      const prompt = JSON.stringify(packet);
-      run.calls_attempted += 1;
-      run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
-      atomicWriteJson(runPath, run);
-      const started = Date.now();
-      try {
-        const result = await callModel(
-          { provider: 'codex', model: 'gpt-5.6-luna' },
-          'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
-          prompt,
-          `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
-          {
-            outputSchema: responseSchema,
-            effort,
-            timeoutMs: 600_000,
-            maxStdoutBytes: 256_000,
-            maxStderrBytes: 64_000,
-          },
-        );
-        const parsed = parseJsonObject(result.text, batch.batch_id);
-        exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
-        if (
-          parsed.schema !== ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA ||
-          parsed.reader_id !== reader.reader_id ||
-          parsed.batch_id !== batch.batch_id ||
-          parsed.study_id !== manifest.study_id ||
-          parsed.corpus_sha256 !== manifest.corpus.sha256
-        ) {
-          throw new Error(`${batch.batch_id} model response binding mismatch`);
+      while (true) {
+        if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
+          run.status = 'incomplete_call_budget_exhausted';
+          atomicWriteJson(runPath, run);
+          throw new Error('semantic reader call budget exhausted');
         }
-        const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
-        const expectedIds = [...batch.required_sample_ids].sort();
-        if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
-          throw new Error(`${batch.batch_id} model response sample-id mismatch`);
+        const packet = readJson(batch.packet_path);
+        const responseSchema = readJson(batch.response_schema_path);
+        const prompt = JSON.stringify(packet);
+        run.calls_attempted += 1;
+        run.exposed_sample_ids = [...new Set([...run.exposed_sample_ids, ...batch.required_sample_ids])].sort();
+        atomicWriteJson(runPath, run);
+        const started = Date.now();
+        let result = null;
+        let rawResponse = null;
+        try {
+          result = await callModel(
+            { provider: 'codex', model: 'gpt-5.6-luna' },
+            'You are one isolated independent research reader. Use only the supplied frozen packet. Return exactly the schema-bound JSON object and do not use tools.',
+            prompt,
+            `adaptive-warrant-${reader.reader_id}-${batch.batch_id}`,
+            {
+              outputSchema: responseSchema,
+              effort,
+              timeoutMs: 600_000,
+              maxStdoutBytes: 256_000,
+              maxStderrBytes: 64_000,
+            },
+          );
+          rawResponse = String(result.text || '');
+          const parsed = parseJsonObject(rawResponse, batch.batch_id);
+          exactFields(parsed, BATCH_FIELDS, `${batch.batch_id} model response`);
+          if (
+            parsed.schema !== ADAPTIVE_WARRANT_SEMANTIC_BATCH_RESPONSE_SCHEMA ||
+            parsed.reader_id !== reader.reader_id ||
+            parsed.batch_id !== batch.batch_id ||
+            parsed.study_id !== manifest.study_id ||
+            parsed.corpus_sha256 !== manifest.corpus.sha256
+          ) {
+            throw new Error(`${batch.batch_id} model response binding mismatch`);
+          }
+          const responseIds = Object.keys(parsed.cases_by_sample_id || {}).sort();
+          const expectedIds = [...batch.required_sample_ids].sort();
+          if (JSON.stringify(responseIds) !== JSON.stringify(expectedIds)) {
+            throw new Error(`${batch.batch_id} model response sample-id mismatch`);
+          }
+          if (pendingRetake) {
+            validateReviewerAuthorizedRetakeResponse({
+              response: parsed,
+              collectionManifest: manifest,
+              reader,
+              batch,
+              assemble: assembleAdaptiveWarrantSemanticAnnotationResponse,
+            });
+          }
+          const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
+          atomicWriteJson(outputPath, parsed);
+          run.calls_completed += 1;
+          run.batches.push({
+            reader_id: reader.reader_id,
+            batch_id: batch.batch_id,
+            status: 'complete',
+            packet_sha256: batch.packet_sha256,
+            response_schema_sha256: batch.response_schema_sha256,
+            response_path: outputPath,
+            response_sha256: fileSha256(outputPath),
+            latency_ms: Date.now() - started,
+            returned_provider: result.provider || null,
+            returned_model: result.model || null,
+            model_attestation_basis: result.modelAttestationBasis || null,
+            model_independently_attested: result.modelIndependentlyAttested === true,
+            prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
+            ...(pendingRetake
+              ? {
+                  reviewer_authorized_retake: true,
+                  retake_of_response_sha256: quarantineEntry.response_sha256,
+                  quarantine_manifest_sha256: retakes.manifestSha256,
+                  deterministic_contract_validation: 'passed',
+                }
+              : {}),
+          });
+        } catch (error) {
+          run.status = 'incomplete_model_call_failure';
+          const quarantined =
+            pendingRetake && rawResponse !== null
+              ? quarantineReviewerAuthorizedRetakeResponse({
+                  rawResponse,
+                  quarantineEntry,
+                  quarantineManifest: retakes.manifest,
+                  attempt: run.calls_attempted,
+                })
+              : null;
+          run.batches.push({
+            reader_id: reader.reader_id,
+            batch_id: batch.batch_id,
+            status: 'failed',
+            packet_sha256: batch.packet_sha256,
+            response_schema_sha256: batch.response_schema_sha256,
+            latency_ms: Date.now() - started,
+            error: error.message,
+            exposed_sample_ids: [...batch.required_sample_ids],
+            ...(pendingRetake
+              ? {
+                  reviewer_authorized_retake: true,
+                  retake_of_response_sha256: quarantineEntry.response_sha256,
+                  quarantine_manifest_sha256: retakes.manifestSha256,
+                  ...(quarantined
+                    ? { quarantine_path: quarantined.path, quarantine_sha256: quarantined.sha256 }
+                    : {}),
+                }
+              : {}),
+          });
+          atomicWriteJson(runPath, run);
+          if (pendingRetake && rawResponse !== null) continue;
+          throw error;
         }
-        const outputPath = path.join(resolvedOutput, reader.reader_id, batch.expected_response_filename);
-        atomicWriteJson(outputPath, parsed);
-        run.calls_completed += 1;
-        run.batches.push({
-          reader_id: reader.reader_id,
-          batch_id: batch.batch_id,
-          status: 'complete',
-          packet_sha256: batch.packet_sha256,
-          response_schema_sha256: batch.response_schema_sha256,
-          response_path: outputPath,
-          response_sha256: fileSha256(outputPath),
-          latency_ms: Date.now() - started,
-          returned_provider: result.provider || null,
-          returned_model: result.model || null,
-          model_attestation_basis: result.modelAttestationBasis || null,
-          model_independently_attested: result.modelIndependentlyAttested === true,
-          prohibited_tool_event_count: Number(result.prohibitedToolEventCount || 0),
-        });
-      } catch (error) {
-        run.status = 'incomplete_model_call_failure';
-        run.batches.push({
-          reader_id: reader.reader_id,
-          batch_id: batch.batch_id,
-          status: 'failed',
-          packet_sha256: batch.packet_sha256,
-          response_schema_sha256: batch.response_schema_sha256,
-          latency_ms: Date.now() - started,
-          error: error.message,
-          exposed_sample_ids: [...batch.required_sample_ids],
-        });
         atomicWriteJson(runPath, run);
-        throw error;
+        break;
       }
-      atomicWriteJson(runPath, run);
     }
   }
   run.status = 'complete';
@@ -396,7 +470,7 @@ export async function runAdaptiveWarrantSemanticReaders({
 }

 function usage() {
-  return 'Usage: node scripts/run-adaptive-warrant-semantic-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <dir> --approved-by <standing-authorization-record> [--effort medium] [--resume]\n';
+  return 'Usage: node scripts/run-adaptive-warrant-semantic-readers.js --manifest <collection> --freeze-manifest <freeze> --authorization-request <request> --out <dir> --approved-by <standing-authorization-record> [--effort medium] [--resume] [--quarantine-manifest <manifest>]\n';
 }

 async function main() {
@@ -409,6 +483,7 @@ async function main() {
       'approved-by': { type: 'string' },
       effort: { type: 'string' },
       resume: { type: 'boolean', default: false },
+      'quarantine-manifest': { type: 'string' },
       help: { type: 'boolean', short: 'h' },
     },
     strict: true,
@@ -425,6 +500,7 @@ async function main() {
     approvedBy: values['approved-by'],
     effort: values.effort || 'medium',
     resume: values.resume,
+    quarantineManifestPath: values['quarantine-manifest'] || null,
   });
   process.stdout.write(`${result.runPath}\n`);
 }
```
