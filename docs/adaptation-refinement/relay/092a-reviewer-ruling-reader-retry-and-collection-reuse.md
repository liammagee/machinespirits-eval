# 092a — Reviewer ruling: reader retry allowance and collection reuse

**Date:** 13 August 2026. Rules on driver report 092 (`4f9de99c`).
Authority: 052a, 083d (standing resume authority), 088/088a
(transport-constant precedent and derived-digest re-pin precedent),
091a.

## Ruling: TECHNICAL. One transport failure; 271 paid responses safe.

The failed call is `decision-reader-a-batch-121`: the codex CLI turn
died before it returned a response. No semantic content was judged
and refused. The presence child was stopped mid-flight by the driver
to stop further spend; its last attempt also produced no response.
This is a transport failure, resumable under 083d. The driver's stop
and SIGINT were correct.

The reviewer confirmed in the code, zero-call, that a plain resume
CANNOT work, for two independent reasons. Both are run-management
transport defects, and both get a prospective repair before any new
call:

1. **Attempts-ceiling trap.** Each child refuses when attempts reach
   `maximum_calls` (semantic line 307, decision line 213), and
   failed attempts count. Both checkpoints now carry one paid
   attempt with no response (presence 152/151, decision 121/120), so
   each child would refuse ONE batch short — after paying for all
   the rest. The ceiling of 288 in the sealed authorization cannot
   change, because it feeds the approval digest.
2. **Rebuild breaks the resume binding.** The preparers refuse on
   non-empty output directories, and a rebuilt collection embeds the
   commit-stamped brittleness preflight in its authorization
   contract, which moves the approval digest, which makes both
   children refuse their own checkpoints. Any rebuild after a new
   commit orphans the paid responses. The collections on disk are
   the exact bytes the paid calls used and must be REUSED, not
   rebuilt.

## Tasks for the driver

1. **Parent: reuse the existing collections on resume.** In
   `scripts/run-adaptive-warrant-outcome-pilot.js`: when a collection
   directory already holds its collection manifest and authorization
   request AND the matching child checkpoint exists
   (`presence-readers/semantic-reader-run.json`,
   `decision-readers/decision-reader-run.json`), load and reuse them
   instead of calling the preparer. Before reuse, check integrity
   zero-call: the manifest file hash must equal
   `bindings.collection_manifest_sha256` inside the authorization
   request, and every packet and output-schema file listed in the
   manifest must exist with its recorded hash. Any mismatch refuses
   with a clear error. When the child checkpoint does NOT exist, the
   current behavior stays: empty directory prepares fresh; non-empty
   directory refuses (self-quarantine authority from 091a task 7
   still applies). The existing caps check runs on the reused
   manifest unchanged.
2. **Both children: failed-attempt allowance.** In
   `scripts/run-adaptive-warrant-semantic-readers.js` (line 307) and
   `scripts/run-adaptive-warrant-decision-readers.js` (line 213),
   change the refusal from
   `calls_attempted >= maximum_calls` to
   `calls_attempted >= maximum_calls + MAXIMUM_FAILED_ATTEMPT_ALLOWANCE`,
   with `MAXIMUM_FAILED_ATTEMPT_ALLOWANCE = 12` as a named module
   constant in each file. Keep the two changes byte-symmetric. This
   is a transport constant under the 028/045/088 precedent:
   completed calls stay structurally capped by the 288 batches; a
   failed attempt ends the child at once, so each gated resume can
   add at most one failure per channel; the allowance therefore
   bounds waste at 12 attempts per channel across at most 12
   reviewer-gated resumes.
3. **Re-pin the decision runner hash.** The decision-runner edit
   moves `decision_channel.digests.reader_runner_sha256` in
   `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json`.
   Re-pin it and record the equivalence proof in the report: the
   diff to each child is exactly the constant plus the one changed
   comparison, and nothing else. The semantic runner is not among
   the seven pinned checks, so it needs no re-pin. Touch no other
   pin, cap, service, or preparer.
4. **Tests.** Extend the outcome-pilot suite: a resumed parent with a
   complete collection and a child checkpoint reuses the collection
   and calls no preparer; an integrity mismatch refuses; the
   allowance lets a child with one failed attempt finish its full
   batch plan; the allowance boundary still refuses. Run the full
   suite the same way as report 092 (focused suites plus the direct
   root and tutor-core runs) and ESLint.
5. Commit with the usual no-hooks command and trailers.
6. Resume with the GO-note command plus `--resume`. Regenerate the
   two commit-stale zero-call artifacts in place as before,
   disclosed. Expect both children to skip every completed batch by
   hash, retry the one open batch each, and run out the remaining
   plan: about 137 presence and 168 decision calls.
7. **Counter.** The parent reserves the two full 288 blocks only at
   success, so reconcile the global counter from the CHILD
   checkpoints at completion: 4,198 settled + 495 generation + every
   reader attempt including failures. Show the arithmetic in the
   report.
8. Watch to completion and report — the number is **093**. Report
   per-channel attempted/completed/failed, the counter, and the
   observed endpoint values. Interpretation stays reserved to the
   reviewer.

NEVER push. Never touch paid artifacts — the response files, child
checkpoints, and the two packet collections are paid evidence now. A
substantive fail stays terminal.
