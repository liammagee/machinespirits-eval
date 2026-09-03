GO

# Invested-rival learner replication v1: unused-headroom recovery

Operator: Liam Magee

Date: 2026-09-02

Authorization source: after the linked assessment continuation stopped at 363
of 396 aggregate attempts, Liam Magee was told that completion required
reassigning unused dialogue-generation headroom to response-free Opus retries
without changing the hard ceiling. He replied, "GO."

Design file used by the launch contract:
`notes/invested-rival-learner-replication-v1.md`

Machine-readable study configuration:
`config/tutor-stub-local-learners/invested-rival-learner-replication.v1.yaml`

Launch commit:
`27f431b8f936bfd1f11cbe3c9fbd7b15abcf0109`

Study: `invested-rival-learner-replication-v1-linked-completion-v1`

The hard ceiling remains 396 aggregate model-attempt reservations. The sealed
archive contains all 18 dialogues, 73 of 90 valid assessment packets, 19
response-free failures and 363 reservations. Dialogue generation used 271 of
its 288 maximum, so its 17 unused slots may supplement the original transport
reserve. The remaining allowance is exactly 33 attempts: the 17 missing Opus
packets plus at most 16 further response-free transport failures.

This prospective operational amendment does not authorize new or regenerated
dialogues, rejudging valid packets, substantive retries, selection among
outputs, changed models or prompts, changed rubrics or thresholds, or attempt
397. All valid and failed attempts remain preserved in the linked ledger and
the continuation uses a fresh create-once private destination.

Authorized by: Liam Magee, through the direct GO above.

Recorded: 2026-09-02.
