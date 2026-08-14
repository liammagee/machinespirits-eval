# 025 — Direction: ping compares parsed values, retains responses; one retry; then matrix

**Date:** 12 August 2026
**Answers:** report 024 (`250a89b0`): acceptance-ping stop — Luna's
response passed schema delivery, strict parsing, and the validator,
but failed a byte-identity comparison against the synthetic template;
the harness discarded the response on mismatch. Seed 506 unburned;
1 call spent (unattended budget total: 1 of 4,000).

## Ruling

Transport-harness defect, timebox class. The ping's job is to prove
the transport end-to-end: schema delivered, structured-output
provenance true, strict parse and validator acceptance. Byte-identity
of the model's copy against a serialized template tests none of that —
it tests byte-copying, the same machine-trivia class as offsets and
apostrophes. The certified consensus standard has always been
closed-label identity of parsed values, never bytes. No semantic
contract, threshold, or matrix datum is touched.

## Authorized now

1. **Retain evidence on mismatch:** the ping harness keeps the raw
   response and the parsed value in the fail-closed artifact whenever
   any acceptance step fails, and reports the first differing field
   path. The misleading generic status (`response_received: false`
   when a response was parsed) is corrected to state what happened.
2. **Acceptance criterion amended (ping harness only, live validator
   unchanged):** the ping passes when (a) a response is received with
   structured-output and tool-audit provenance intact, (b) strict
   parse succeeds, (c) the validator accepts, and (d) the parsed value
   equals the synthetic template as canonical values — key order and
   serialization bytes irrelevant, string comparison under the same
   punctuation normalization the validator itself applies. Any field
   whose VALUE differs is still a fail.
3. **Focused tests** for both changes (mismatch retains evidence;
   value-equality passes where byte-inequality alone failed; a true
   value deviation still fails). Preflight asserts the ping retains
   responses on failure.
4. **One retry ping (1 call).** On pass: LAUNCH the representative
   matrix at seed 506 under direction 022's terms — no stop. On fail:
   STOP; the retained diff names the differing field; report it
   (reviewer rules next — this would be a genuine content deviation,
   not trivia).

## Budget

1 retry call now; matrix ~612 on its pass. Running unattended total
after retry: 2 of 4,000 (matrix excluded until launched).
