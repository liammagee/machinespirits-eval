# V30 first-draft working screen: transient focused-test preflight failure

Date: 2026-07-17
Status: failed before any tutor-model call
Campaign: `first-draft-working-screens-v10`
Frozen HEAD: `c6aa265eebd255c7eb41377cb2a6c01b75a6fa6f`

V30's structural campaign validation passed with no blockers. Development
iteration 1 then stopped before the hard Tallow cell because the focused-test
preflight reported 536 of 537 tests passing and exited nonzero. The campaign
runner correctly serialized that terminal state: zero model calls, zero
generated candidates, zero completed candidates, zero completed turns, and
zero safety failures.

An immediate rerun of the identical focused-test command passed all 537 tests.
This means the failure did not reproduce. The durable failure envelope records
the exact command and exit status but does not include the subtest output, so it
cannot identify which test failed or why. V30 therefore records the event
conservatively as an **unclassified transient focused-test failure**. It is not
evidence of either a tutor-generation regression or a generation improvement.

The passing rerun is also not substituted for a campaign result. No tutor draw
occurred, and the V30 labels are retired unconsumed so the outer loop can move
forward without blurring the provenance boundary. No V31 campaign, screen, or
seed is predeclared in this result update.

## Preserved evidence

- Campaign validation:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v10/iteration-1/campaign-validation.json`
  - SHA-256: `9659bc19cb0ebd244d4945999768dc92afd7860de93c005d003d6c184cadb606`
- Serialized zero-call result:
  `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens-v10/iteration-1/working-screen-result.json`
  - SHA-256: `57cd95cd572766c8319c4a0bf8df4723b96c523083e85416ba55d9341a4bc52c`
- Frozen campaign config:
  `config/tutor-stub-campaigns/first-draft-working-screens-v10.yaml`
  - SHA-256: `649821ca63257c7514def5ded78cc2eb86ef031b825e59acff22ecc7b88ab419`

The serialized artifact's evidence gap is explicit: there is no durable rerun
artifact and no captured failed-subtest output. The observed rerun result was
537/537 with exit code 0; the original serialized run was 536/537 with exit
code 1.

All V30 development labels are retired unconsumed:

- `20262000` — Tallow / answer-seeking
- `20262001` — Ravensmark / affective-resistant
- `20262002` — Larkspur / premature-closure
- `20262003` — Foxtrot / diligent

V30 therefore contributes deterministic process evidence only: the new
preflight serializer worked, while the actual first-draft generation screen
was never entered.
