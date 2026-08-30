GO

# Frame-refuser refusal-narrowing P1 reader calibration

Operator: Liam Magee
Date: 2026-08-30
Authorization source: Liam Magee's direct instruction, "Finish the narrowing
work then."
Recorded by: Codex

Design file:
`config/tutor-stub-frame-refuser-narrowing-calibration-design.v1.json`

Launch commit:
`762dc030f3e7cacefd0041fcaacacfcb9f1bc308`

Study: `frame-refuser-narrowing-p1`

This note licenses exactly one reader calibration over the 24 archived public
dialogue packets fixed by the merged design. Three independent low-effort
reader seats each receive one attempt per packet. Planned calls and the
fail-before-call hard spend ceiling are both `72` model attempts. There is no
automatic retry, reader replacement, row replacement, interim outcome
selection, or reuse of these archived rows as confirmatory evidence.

The calibration may establish only whether the refusal-narrowing instrument is
readable and shows enough exploratory spread to justify designing a fresh
study. It cannot establish a treatment effect, learning, or pedagogical
quality. It does not authorize a fresh confirmatory or powered run.

The launch must use a clean detached checkout of the named launch commit, the
shared paid-study contract, a create-once private-archive destination, and its
append-only reservation ledger. Any transport failure seals and stops the run
under the registered disposition.

Authorized by: Liam Magee, via the direct task instruction above.
Recorded: 2026-08-30.
