# 005 — Codex report: V3 diagnostic stops on record-entry support

**Date:** 12 August 2026

**Source commit:** `225a7b073eb0521df05481bc7d54b6a451afc1ef`

**Branch:** `adaptation-refinement`

**Status:** diagnostic support stop; no decision-reader or representative-matrix call

## Prospective amendment and validation

Commit `225a7b07` implements directions 002 and 004 by separating structural
instrument validity from semantic extraction quality. Canonical IDs are still
checked for catalog membership, but lexical word overlap and surface-executor
inference no longer reject a structurally valid event. Smoke and diagnostic
reports now carry the disagreement discriminator.

Validation at the freeze commit:

- focused warrant/semantic tests: 90/90 passed;
- zero-call preflight: 31/31 passed at
  `/private/tmp/adaptive-warrant-v3-preflight-225a7b07/preflight.json`;
- derivation quality: 35/35 worlds passed;
- required prompt/world audit: 22/22 tests passed;
- full hermetic suite, run once at the freeze commit: 8,502/8,502 root and
  137/137 tutor-core tests passed;
- clean detached worktree:
  `/private/tmp/ms-adaptation-refinement-225a7b07`.

The first schema-acceptance attempt ended in a transient process failure before
an accepted response. Its exact operational retry passed with one completed
Luna call and zero prohibited tools at
`/private/tmp/adaptive-warrant-v3-schema-acceptance-225a7b07-retry1/schema-acceptance-result.json`.

## Fresh structural smoke

The wholly fresh smoke passed at
`/private/tmp/adaptive-warrant-v3-semantic-smoke-225a7b07-run/semantic-schema-smoke-result.json`:

- 2/2 Luna calls completed under the two-call ceiling;
- both responses assembled without repair or prohibited tools;
- all three cases had hard cross-reader consensus;
- no both-defensible contract ambiguity was found.

The earlier `65d45700` smoke had exposed a leftover surface-executor lexical
check. It produced no usable semantic result, was repaired within the single
prospective amendment, and its cases remain burned.

## Diagnostic freeze and run

The fresh 24-case diagnostic was frozen from the clean source commit at
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/diagnostic-freeze-manifest.json`.
Its blinded corpus hash is
`9eec0174af26564d44fc6dfbb4f95179f281b7163540ad28c3667a0011c87df5`.
The manifest verifies zero case overlap with all three earlier V3 diagnostic
corpora. Maximum batch prompt size was 36,348/42,000 bytes and the response
schema was 10,265/10,500 bytes.

Both independent readers completed all three batches: 6/6 Luna calls, against
an eight-call ceiling, with zero prohibited tools. The bound run is at
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/semantic-reader-run/semantic-reader-run.json`.
Both 24-case assemblies validate under the declared literal-span/event-order
normalization in the adjacent `semantic-assembled` directory.

## Diagnostic result

The preregistered support artifact is
`/private/tmp/adaptive-warrant-v3-semantic-diagnostic-225a7b07/semantic-support.json`.
Readers reached hard consensus on 21/24 cases, for raw structural agreement of
0.875. Four of five support cells passed:

| Cell | Observed | Minimum | Result |
| --- | ---: | ---: | --- |
| Result requests | 8 | 4 | supported |
| Proposed tests | 7 | 4 | supported |
| Target/value partitions | 11 | 4 | supported |
| Record-entry requests | 1 | 2 | **insufficient** |
| Tutor-selection requests | 2 | 2 | supported |

The automatic discriminator conservatively marked two cases as
`both_defensible_contract_ambiguity` because neither full encoding exactly
matched the private key. A clause-by-clause adjudication against the frozen
handbook finds that neither is genuine contract ambiguity:

1. `v3-semantic-06c6010a389e67fdb74b01e2`: reader A supplied
   `bounded_finding` without that category surface in the request span; reader
   B omitted `record_text` despite the literal request “record”. Each encoding
   violates an explicit closed rule.
2. `v3-semantic-7515385bbc6848d62493d40e`: reader A collapsed an analytic
   clause and a record request into one event, violating the general
   multiplicity/minimal-clause rule; reader B again omitted `record_text`
   despite “record”. These are reader errors under written rules.
3. `v3-semantic-cc433e1a4601a4bb605c9d66`: reader A matches the registered
   two-event identity; reader B omitted the separately licensed explicit
   low-agency deferral. This is the automatic classifier's one direct
   `reader_error` case.

Final discriminator classification: three reader-miss cases, zero
both-defensible contract ambiguities. The diagnostic therefore did not reveal
another instrument-definition defect. It revealed insufficient reader-model
support for the record-entry cell under the preregistered hard-consensus floor.

## Boundary and requested direction

Per ruling 004, the contract is not reopened for these semantic misses. Because
the diagnostic did not reach sufficient support, the pre-authorized pass path
does not extend to decision readers. No decision-reader, representative-matrix,
or outcome call has been launched.

The next decision is a human-authorized scope cut or a prospective study
redesign that treats the record-entry field as unproven. Either choice is
outside the automatic pass path. The representative 192-call matrix remains a
separate authorization boundary in all cases.
