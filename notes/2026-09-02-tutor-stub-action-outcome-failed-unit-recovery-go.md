GO

# Tutor-stub action-outcome failed-unit recovery

Operator: Liam Magee
Date: 2026-09-02

Design file:
`config/tutor-stub-action-outcome-failed-unit-recovery.v1.json`

This records Liam Magee's direct authorization to continue exactly three
technically incomplete dialogues under the unchanged action-outcome collection:
`aocv2_skyway_bakery_r01`, `aocv2_larkspur_fridge_r04`, and
`aocv2_larkspur_fridge_r08`.

All model-backed roles remain `codex.gpt-5.6-luna` at low effort. The worlds,
learner profile, prompts, seeds, typed-action assignment, eight-turn horizon,
measurement rules, and claim boundary remain unchanged. The 57 valid dialogues
must not be rerun. Each continuation starts from its latest durable accepted
turn or accepted pending learner output and writes to a fresh destination.

Recovery segment hard ceiling: `100` new paid model-attempt reservations.
Nominal aggregate effective ceiling: `4,960` reservations. Unused historical
per-dialogue capacity allocations are not consumed attempts. Preserve all old
artifacts and every new failed attempt. Stop on completion, a repeated
substantive or technical failure, configuration drift, or before reservation
101.

After generation, perform only zero-call trace reconciliation, quality audit,
and fresh coder-packet preparation. Do not infer or manufacture human codes.

Authorized by: Liam Magee, via direct instruction in this thread.
