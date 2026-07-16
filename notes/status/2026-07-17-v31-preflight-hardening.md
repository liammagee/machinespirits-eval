# V31 deterministic preflight hardening

Date: 2026-07-17
Status: implementation in progress; no V31 campaign call admitted

V30 stopped before every model call when its monolithic focused-test preflight
reported 536/537 tests. The failure artifact preserved the command and exit
status but not the failed TAP record. The same command then passed 537/537 in
five diagnostic reruns (the immediate rerun plus four independent repetitions),
so the original failed subtest is irrecoverable and the failure remains
unclassified. The likely risk is load-sensitive contention between the default
parallel Node test runner and subprocess-heavy interactive and clean-room tests.

V31 therefore replaces the monolithic runtime preflight with ordered named test
suites while preserving exact test-file set equality with V30. Each suite runs
once with test concurrency 1 and no retry. Full stdout and stderr are streamed
and stored outside Git with byte counts and SHA-256 hashes; a preflight execution
artifact records argv, timing, TAP totals, exact failed test names, and zero
model-call accounting. Exit zero with zero discovered tests must fail closed.

## Integration-fixture incident

During implementation, the first failure-capture fixture put its generated test
under a hidden temporary directory. Node accepted the explicit hidden path with
exit code 0 but reported zero tests. Because the implementation did not yet
reject that state, the temporary campaign advanced to one real tutor draw before
its hard-cell gate stopped.

- Model: `gpt-5.6-terra`, effort `low`
- Frozen prefix: Tallow / answer-seeking / turn 5
- Development seed label: `20261900` (already retired after V29)
- Draws completed: 1 of a requested 4
- V31 labels consumed: none; V31 was not yet predeclared
- Durable campaign artifact: none; the temporary root was removed by test cleanup
- Source mutation: none; the frozen trace was read-only

The incident is development-process contamination only. It is not evidence for
V30 or V31 acceptance and will not enter any campaign result. The replacement
fixture must be run directly first and prove exactly one discovered failing test
before another campaign-level test is allowed. The runner must treat zero-test
TAP as a deterministic preflight failure even when Node exits successfully.
