GO

# Frame-refuser refusal-narrowing P1 bounded recovery

Operator: Liam Magee
Date: 2026-08-30
Authorization source: Liam Magee's direct instruction, "GO — I authorize the
frame-refuser refusal-narrowing calibration for a maximum of 72 model
attempts," together with the standing bounded technical-recovery authority.
Recorded by: Codex

Design file:
`config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json`

Recovery launch commit:
`ed5b54c475e188fa32ab3b7cd9024bc0dc2944fe`

Study: `frame-refuser-narrowing-p1`

The first create-once destination is retained at
`artifacts/tutor-stub-live/frame-refuser-narrowing-p1-2026-08-30`. It sealed
after 11 reserved attempts: ten completed reader records and one technical
transport failure at `nrw_004/reader_b`. That failed assignment will not be
retried.

This note records exactly one missing-only continuation into a fresh
create-once destination. The recovery must revalidate and skip all ten
completed assignments and the failed assignment, then execute only the 61
never-attempted assignments. Its fail-before-call spend cap is `61` model
attempts, keeping the combined maximum across the two destinations at the
user-authorized `72` attempts. The sample, seed, public packets, reader routes,
effort, instrument, gates, and claim boundary remain unchanged.

There is no reader replacement, row replacement, resampling, retry of a
completed or failed assignment, interim outcome selection, or reuse of these
archived rows as confirmatory evidence. Any further transport failure seals
and stops the recovery for human review.

The calibration may establish only whether the refusal-narrowing instrument is
readable and shows enough exploratory spread to justify designing a fresh
study. It cannot establish a treatment effect, learning, or pedagogical
quality. It does not authorize a fresh confirmatory or powered run.

The recovery launch must use a clean detached checkout of the named merged
commit, the shared paid-study contract, the fresh private-archive destination,
and its append-only reservation ledger.

Authorized by: Liam Magee, via the direct GO above and standing bounded
technical-recovery authority.
Recorded: 2026-08-30.
