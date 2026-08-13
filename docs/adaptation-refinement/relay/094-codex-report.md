# 094 — Codex report: v4 reader completion, terminal assembly-contract failure

**Date:** 13 August 2026. **Authority:** rulings 092a as amended by 093a
and 093b. **GO note:** 083a. **Resume authority:** 083d. **Repair commit:**
`0128ba7dbe448c01918e141056a46d15056109cd`.

## Final status

- The amended repair was implemented and committed in one commit. The parent
  reused and hash-checked the paid packet collections, the original emitted
  freeze, the brittleness preflight, and the schema-acceptance carryover. It
  did not regenerate any of them.
- Both paid reader channels reached `complete`: each preserved 288 accepted
  responses after 290 attempts.
- The parent then stopped in deterministic assembly before emitting an outcome
  score. Exact error:

  `presence-reader-a-batch-71 case-aad700bb02c0ad2d5cdc216a event 2.requested_or_proposed_action target does not match its action object`

- The accepted reader-A response labels event 2 as a
  `learner_record_entry_request`, gives the event target as `learner_record`,
  and selects action object `natural-act-0f58c9b1bd43d2cf`. The frozen catalogue
  binds that action object to target `signal_lamp`. The JSON response satisfied
  its model-facing schema, but this cross-field mismatch failed the downstream
  deterministic contract.
- This is a substantive evidence-contract failure, not a missing-response
  transport failure. Per 093a/093b, it stays terminal. I did not edit a paid
  response, retry assembly, regenerate any artifact, or launch another run.
- The parent checkpoint remains at phase/status `readers` and no
  `outcome-pilot-score.json` exists. The 72-dialogue main block was not
  launched. Nothing was pushed.

## Exact calls and reconciled counter

| Channel | Attempted | Completed | Failed/no-response | Response files |
|---|---:|---:|---:|---:|
| Presence | 290 | 288 | 2 | 288 |
| Decision | 290 | 288 | 2 | 288 |
| **Readers total** | **580** | **576** | **4** | **576** |

- Presence has one recorded failed batch,
  `presence-reader-b-batch-30`, for sample
  `case-77aa29c02acdc439633161d4`, with error
  `codex CLI turn failed before producing an accepted response`. Its other
  no-response attempt is the SIGINT-preserved attempt from report 092.
- Decision retains the recorded report-092 failure at
  `decision-reader-a-batch-121`, sample
  `case-a82be9a3a0d29dd15d28bfd7`, with the same transport error. Its other
  no-response attempt is the sibling call interrupted after the new presence
  transport failure, before the second amended resume.
- Each completed checkpoint contains 288 `complete` batch rows, one recorded
  `failed` batch row, and the single unrecorded interrupted attempt implied by
  `calls_attempted - calls_completed = 2`.
- The authoritative checkpoint arithmetic is:

  `4,198 settled + 495 generation + 290 presence attempts + 290 decision attempts = 5,273 / 19,337`.

- Remaining ceiling room is **14,064** attempts.
- Relative to the amended opening counter, the continuation used
  `5,273 - 4,966 = 307` attempts: 305 remaining accepted responses plus the
  new presence transport failure and the interrupted decision sibling call.
- The parent checkpoint's call-budget block records 495 generation calls and
  288 completed calls per reader channel (`1,071` total); the child
  checkpoints supply the authoritative four additional no-response attempts.

## Resume chronology

1. The first resume at repair commit `0128ba7d…` passed the amended artifact,
   collection, freeze, clean-worktree, and launch-stamp guards. Presence
   advanced to 175 attempted / 173 completed, then stopped on the transport
   failure at `presence-reader-b-batch-30`. Decision was at 141 attempted / 139
   completed; I interrupted it and the parent to prevent an orphan paid call.
2. The failure was the already-authorized technical no-response class and both
   channels remained below the named 12-attempt allowance. After re-reading
   the current authority and verifying the clean worktree and frozen hashes, I
   issued the same GO-note command plus `--resume` at the same commit.
3. The second resume made no further failed calls. Presence completed at
   290/288, then remained complete and was not called again. Decision completed
   at 290/288. Both checkpoints record the repair commit exactly once in
   `resumed_at_commits`.
4. The parent then failed locally at the assembly-contract mismatch above.
   No model process remains running.

## Observed endpoint values

- **No outcome endpoint values were emitted.** The assembly failure occurred
  before `scoreAdaptiveWarrantOutcomeStudy()` could produce the score artifact.
- Presence consensus, decision consensus, condition comparisons, and every
  registered outcome-study endpoint are unavailable, not zero.
- The 576 accepted responses remain preserved as terminal, unassembled paid
  evidence. No partial endpoint is calculated or interpreted here.
- Interpretation remains reserved to the reviewer.

## Repair scope and bindings

Commit `0128ba7dbe448c01918e141056a46d15056109cd` changed exactly five files:

- `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`;
- `scripts/run-adaptive-warrant-decision-readers.js`;
- `scripts/run-adaptive-warrant-outcome-pilot.js`;
- `scripts/run-adaptive-warrant-semantic-readers.js`;
- `tests/adaptiveWarrantOutcomePilot.test.js`.

The parent repair:

- detects the paid-reader resume boundary from both child checkpoints;
- validates and reuses both collection manifests, both authorization requests,
  every bound packet and response schema, and the original freeze;
- validates and reuses the two launch-stamped zero-call artifacts against the
  hashes and launch commit frozen into the paid bindings;
- skips corpus, study-plan, freeze, collection, and zero-call-artifact
  regeneration at that boundary;
- preserves the existing HEAD-fresh behavior on every non-reader-resume path.

The decision runner was re-pinned to
`2253c184529f5cfb06bc05f3f1d8fe86960b96ef9363ac9de225639261ad8941`.
No other pin, cap, service, preparer, response schema, or handbook changed.

## Frozen artifact verification

The protected bindings remained byte-identical after the terminal stop:

| Protected artifact | SHA-256 |
|---|---|
| Original emitted freeze | `bde2028e06cfd3c24d18e0808f5898c4be8ba80651739a779d7e1f99d1f20d52` |
| Brittleness preflight | `743ee634b1b1ec00fb44844f049ec0554def63abe043b9bdf0676cbf2a5e6b1a` |
| Schema-acceptance carryover | `47efb49445a94980b563cb00a96714d4290d92da7f73501c160d3c2f43776111` |
| Presence collection manifest | `c90d1e3e0283b00d102bd5ac1119caf8de5a02492cba3e5598b1da3d27b42575` |
| Presence authorization request | `f97f2b4195f9bb7806a0f10a40a43eab60e05c27dadd615131e8c08a49d0a955` |
| Decision collection manifest | `a53d5a7f5ac4501fd87e03e23d72a46d7af091e8261fb27e029d9f8ce37bc59e` |
| Decision authorization request | `e3c36740c31945d359e6489d212d5c067c1de077f15ef817ca76740eac192d86` |

Final child-checkpoint hashes, after the authorized runners appended their
responses and completion records:

- presence: `729cbbad3fca9362012a179c8a6f767444352ffd9525bb764f4a8a4054a2da96`;
- decision: `588076f0f57c39acc399e4cbbb15c29393f3a5b01b5ac4a9da40634aa6159a03`.

No protected artifact was manually edited, deleted, replaced, or regenerated.

## Verification

- `node --test tests/adaptiveWarrantOutcomePilot.test.js`: **27/27 passed**,
  including old-launch-stamp resume acceptance and commit recording, fresh
  stale-stamp refusal, parent freeze-hash refusal, matching zero-call-artifact
  reuse without regeneration, byte-drift refusal, and fresh-path HEAD checks.
- Targeted ESLint over the two children, parent, and focused test: passed.
- The frozen real-run integrity helper passed all seven reader bindings and all
  newly reused freeze/collection/zero-call-artifact checks before launch.
- Direct in-housed tutor-core Vitest suite: **11 files, 137 tests passed**.
- `npm test` was run but refused before test execution because the pre-existing
  hermetic manifest omits five on-disk suites:
  `adaptiveWarrantFallbackPassClosure`,
  `adaptiveWarrantLearnerAnalysisCoverage`, `adaptiveWarrantOutcomePilot`,
  `adaptiveWarrantOutcomeStudy`, and `semanticReaderPresenceGate`.
- A supplemental all-files root Node invocation was also run. It was not green:
  the current branch has unrelated pre-existing hermetic/baseline manifest
  drift and QA/history fixture failures. A lifecycle inventory omission exposed
  for the outcome parent was not changed because that would exceed the exact
  093a/093b repair scope.
- Full `npm run lint` was run and reported one pre-existing error:
  `services/tutorStubPublicLearnerAnalysis.js:26:3`, unused
  `ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA`. The four repair/test files pass
  ESLint.
- `git diff --check` passed before the repair commit and before this report.

## Full child-runner diff — equivalence proof

The complete diff from the paid launch commit `f43bcc64…` to repair commit
`0128ba7d…` for both child runners follows. It contains the four authorized
logical elements only: allowance constant 12, allowance comparison,
resume-only HEAD-equality widening (including launch-stamped preflight
validation), and resume-commit recording.

```diff
diff --git a/scripts/run-adaptive-warrant-decision-readers.js b/scripts/run-adaptive-warrant-decision-readers.js
index 785f3299..47a2873e 100644
--- a/scripts/run-adaptive-warrant-decision-readers.js
+++ b/scripts/run-adaptive-warrant-decision-readers.js
@@ -20,0 +21 @@ export const ADAPTIVE_WARRANT_DECISION_READER_RUN_SCHEMA =
+const MAXIMUM_FAILED_ATTEMPT_ALLOWANCE = 12;
@@ -63 +64 @@ function exactFields(value, expected, label) {
-function validateFreeze({ freeze, manifest, repoRoot }) {
+function validateFreeze({ freeze, manifest, repoRoot, resume }) {
@@ -86 +87 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
-  if (commit !== sourceCommit || manifest.source_commit !== sourceCommit || status) {
+  if ((!resume && commit !== sourceCommit) || manifest.source_commit !== sourceCommit || status) {
@@ -93,4 +94,8 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
-  validateAdaptiveWarrantSemanticPreflightArtifact({
-    artifact: readJson(preflightBinding.path),
-    expectedSourceCommit: commit,
-  });
+  const preflight = readJson(preflightBinding.path);
+  if (resume) {
+    if (preflight.bindings?.source_commit !== sourceCommit) {
+      throw new Error('decision reader brittleness preflight launch stamp drift');
+    }
+  } else {
+    validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: commit });
+  }
@@ -114,0 +120 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
+  return { commit, sourceCommit };
@@ -156 +162 @@ export async function runAdaptiveWarrantDecisionReaders({
-  validateFreeze({ freeze, manifest, repoRoot });
+  const { commit } = validateFreeze({ freeze, manifest, repoRoot, resume });
@@ -197,0 +204 @@ export async function runAdaptiveWarrantDecisionReaders({
+  if (resume) run.resumed_at_commits = [...new Set([...(run.resumed_at_commits || []), commit])];
@@ -213 +220 @@ export async function runAdaptiveWarrantDecisionReaders({
-      if (run.calls_attempted >= request.call_budget.maximum_calls) {
+      if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
diff --git a/scripts/run-adaptive-warrant-semantic-readers.js b/scripts/run-adaptive-warrant-semantic-readers.js
index 18ea3157..a311e135 100644
--- a/scripts/run-adaptive-warrant-semantic-readers.js
+++ b/scripts/run-adaptive-warrant-semantic-readers.js
@@ -25,0 +26 @@ export const ADAPTIVE_WARRANT_SEMANTIC_READER_RUN_SCHEMA =
+const MAXIMUM_FAILED_ATTEMPT_ALLOWANCE = 12;
@@ -104 +105 @@ function validateAuthorization({ request, requestPath, manifest, approvedBy }) {
-function validateFreeze({ freeze, manifest, repoRoot }) {
+function validateFreeze({ freeze, manifest, repoRoot, resume }) {
@@ -129 +130 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
-  if (commit !== sourceCommit || status) {
+  if ((!resume && commit !== sourceCommit) || manifest.source_commit !== sourceCommit || status) {
@@ -136,4 +137,8 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
-  validateAdaptiveWarrantSemanticPreflightArtifact({
-    artifact: readJson(preflightBinding.path),
-    expectedSourceCommit: commit,
-  });
+  const preflight = readJson(preflightBinding.path);
+  if (resume) {
+    if (preflight.bindings?.source_commit !== sourceCommit) {
+      throw new Error('semantic reader brittleness preflight launch stamp drift');
+    }
+  } else {
+    validateAdaptiveWarrantSemanticPreflightArtifact({ artifact: preflight, expectedSourceCommit: commit });
+  }
@@ -151 +156 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
-    expectedSourceCommit: commit,
+    expectedSourceCommit: resume ? sourceCommit : commit,
@@ -173,0 +179 @@ function validateFreeze({ freeze, manifest, repoRoot }) {
+  return { commit, sourceCommit };
@@ -254 +260 @@ export async function runAdaptiveWarrantSemanticReaders({
-  validateFreeze({ freeze, manifest, repoRoot });
+  const { commit } = validateFreeze({ freeze, manifest, repoRoot, resume });
@@ -291,0 +298 @@ export async function runAdaptiveWarrantSemanticReaders({
+  if (resume) run.resumed_at_commits = [...new Set([...(run.resumed_at_commits || []), commit])];
@@ -307 +314 @@ export async function runAdaptiveWarrantSemanticReaders({
-      if (run.calls_attempted >= request.call_budget.maximum_calls) {
+      if (run.calls_attempted >= request.call_budget.maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE) {
```

## Handoff

The run is terminal at local assembly. The reviewer now has the complete paid
reader evidence, the exact failing contract tuple, the reconciled attempt
counter, the unchanged protected-artifact hashes, and the full child-diff proof.
Any repair, reassembly, exclusion, or interpretation requires a new ruling.
