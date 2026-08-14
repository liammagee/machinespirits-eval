# 054 — Reviewer ruling: presence-grain confirmation gate PASS

**Date:** 13 August 2026, ~01:00.
**Rules on:** report 053 (commit `47286724`), under the registration
at `v3-semantic-reader-presence-gate-registration.md` and the
overnight ruling (note 052a).

## Ruling

**PASS.** The one registered confirmation attempt met every floor on
clean, admissible data. The layer stands at the presence grain.

## Verification (zero-call, three independent scorings)

The reviewer re-scored all 93 case pairs straight from the raw
response files, with the reviewer's own code, not the A1 scorer. The
second session did the same independently. All three scorings — A1
scorer, second session, reviewer — match to the digit:

| Gate check | Floor | Confirmation | Result |
|---|---:|---:|---:|
| Result-request presence agreement | ≥ 0.80 | 86/93 = 0.925 | PASS |
| Proposed-test presence agreement | ≥ 0.80 | 89/93 = 0.957 | PASS |
| Ambiguity-flag agreement | ≥ 0.90 | 93/93 = 1.000 | PASS |
| Presence-grain consensus cases | ≥ 72 | 83/93 | PASS |
| Consensus non-ambiguous result-request cases | ≥ 4 | 17 | PASS |
| Consensus non-ambiguous proposed-test cases | ≥ 4 | 7 | PASS |

The flag agreement is not degenerate-by-construction: both readers
marked zero cases ambiguous, the same profile as the pilot. The
reported figures also match three ways: strict identity 26/93;
event-target-slot set 70/93; catalogue-binding set 79/93. One
convention note on the descriptive strict diff profile (no floor):
the A1 scorer counts a case as differing in a slot over ALL events,
including the unmatched tail when the two readers give different
event counts — that convention yields 61/35/36/15
(target/action/speech-act/count cases). A prefix-only tally gives
60/29/30/15 on the same data. Any paper use of these four numbers
must name the scorer's convention. The
reviewer confirmed the three provenance SHAs (manifest, reader run,
score file) byte-identical to report 053, the manifest bound to A1
commit `ed19be42`, planned calls 186 recorded, and all 186 batches
attested `codex` / `gpt-5.6-luna` on the exact bridge-echo basis.

## Admissibility

186/186 calls completed, zero reader failures, zero inadmissible
files, caps respected, all seven digest identities matched, nothing
from r47 or r49 admitted or pooled. This is a clean PASS, not a messy
one, under note 052a's classification.

## What this licenses

- Presence-level claims only: whether the learner asked the tutor for
  a result, whether the learner proposed a test, and the ambiguity
  flag, at two-reader agreement 0.93/0.96/1.00. The fine-grain
  encoding stays FAILED (ruling 051); strict identity 26/93 in the
  confirmation confirms that verdict out of sample.
- Budget: 3,523 attempts spent; ceiling 11,337 (note 052b);
  seed 515 unspent.

## Next

Per the relayed go-ahead (note 052e) and the clean PASS, the reviewer
proceeds to the outcome study: prospective registration first, then
the 6-dialogues-per-tutor-version go/no-go pilot, then the main run
only if the pilot is clean. Lease M is retired with thanks; the
outcome study runs under a new direction and lease.
