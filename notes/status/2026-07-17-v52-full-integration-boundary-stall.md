# V52 full integration boundary: test-runner stall

Date: 2026-07-17  
Status: initial runner stall resolved by an equivalent compact-reporter boundary
Command: `npm test`

The full hermetic repository suite did not reach a terminal TAP summary. It ran
for 25 minutes before the bounded validation was stopped. The Node test parent
continued to use approximately one CPU core after its child processes had
finished and produced no further TAP output for several minutes. A process
sample located the activity in repeated buffer search, typed-array allocation,
and garbage collection inside the Node test runner. Graceful termination was
ignored, so the validation process group was force-stopped after the declared
cutoff.

One failure from the recorded unrelated baseline was visible before the stall:
`tests/tutorStubMultiPremiseAdvance.test.js` failed through the known
`verbatim_learner_echo` deterministic-fallback path. No failure in the compact
speaker compiler, Codex transport instrumentation, typed advocate operation,
or canonical realization audit was observed. Because the runner emitted no
final totals, this run is neither a repository-wide pass nor evidence that
there were no additional failures.

The affected focused boundary remains green at 224/224 tests, and
`npm run derivation:quality` remains green at 29/29 checks. Those narrower
results do not replace the required full integration boundary.

Consequences:

- V52 remains an honestly recorded 2/2 non-held-out ordinary-Codex development
  pass.
- No strict working configuration was frozen and no strict model calls were
  made.
- No held-out or acceptance seed was consumed.
- Strict confirmation remains blocked until the full-suite runner can produce
  a terminal result comparable with the recorded eight unrelated baseline
  failures.
- The Codex `model_instructions_file` override remains development-only and
  acceptance-ineligible; it did not affect this test run.

## Terminal follow-up boundary

The same hermetic inventory was then run through `npm test` with every test file
listed explicitly, test concurrency bounded at four, and Node's `dot` reporter.
The reporter change affects output volume only; it does not change assertions,
the hermetic environment, test selection, or pass criteria. This run terminated
normally in approximately 90 seconds and reproduced seven failures from the
recorded unrelated baseline, with no new compact-speaker or canonical-audit
failure:

1. `tests/tutorStubGuardAccounting.test.js`: the plain peer-level fixture still
   expects `guarded_original_accepted` rather than the current advisory-bearing
   accepted disposition.
2. `tests/tutorStubMultiPremiseAdvance.test.js`: the known deterministic
   fallback `verbatim_learner_echo` failure.
3. `tests/tutorStubReleasePacing.test.js`: a stale prompt-surface expectation
   for the former tutor-only first-draft contract marker.
4. `tests/tutorStubTypedActionAdapter.test.js`: four baseline runtime/resume
   fixtures fail through the same deterministic fallback
   `verbatim_learner_echo` path.

This terminal result satisfies the V52 integration-boundary comparison against
the recorded unrelated baseline. It supersedes only the temporary strict-run
block stated above; it does not alter the historical stalled process record.
Strict working confirmation may now be freshly predeclared. Held-out acceptance
remains prohibited until every strict working cell passes.
