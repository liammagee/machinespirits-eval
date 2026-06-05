# Recursive Tutor-Learning Replay Rescore

Date: 2026-06-05

## Boundary

This is a replay-mechanism augmentation and one-item rescore. It does not claim online tutor adaptation, human learning, or reliable peripeteia-origin attribution.

The purpose was to test the reframe:

> The learner is the environment that teaches the tutor what teaching now requires.

So the replay gate now records learner-outcome evidence and a parallel recursive tutor-learning signal.

## Implementation

Updated replay harness:

- `scripts/replay-discursive-transcript.js`

New rescore script:

- `scripts/rescore-discursive-replay-tutor-learning.js`

The generator/checker prompts now ask for a `tutor_learning_ledger` with:

- tutor prior strategy;
- learner resistance as feedback;
- diagnosis of why the prior strategy failed;
- rejected continuation;
- revised strategy/device/test;
- strategic timing; and
- later learner feedback that updates the tutor's next commitment.

The local checker now emits recursive tutor-learning scores:

| Field | Meaning |
| --- | --- |
| `tutor_learning_signal` | Whether the tutor's prior route, breakdown, and revised policy are inspectable. |
| `resistance_diagnosis` | Whether public learner resistance teaches the tutor something specific. |
| `strategy_revision_accountability` | Whether the tutor rejects a plausible continuation and chooses a different strategy because of the learner signal. |
| `strategic_timing` | Whether the revised strategy appears after the learner resistance/failure, not before it as scene furniture. |
| `recursive_dyadic_update` | Whether later learner uptake/contest changes what the tutor is now committed to doing next. |

The recursive tutor-learning gate is opt-in:

- `--recursive-tutor-learning-gate`

Existing replay gates still record the new scores when present, but they do not block on them unless the gate is enabled.

## Rescore

Replay root:

- `exports/discursive-replay-loops/discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605`

Command:

```bash
node scripts/rescore-discursive-replay-tutor-learning.js \
  --replay-dir exports/discursive-replay-loops/discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605 \
  --checker adversarial \
  --force
```

Because the original replay generator was Codex, `--checker adversarial` used Claude.

Output summary:

- `exports/discursive-replay-loops/discursive-replay-loop-t24-option-a-v2-delayed-rail-20260605/recursive-learning-summary.json`

## Result

| Item | Recursive status | Tutor learning | Resistance diagnosis | Strategy revision | Strategic timing | Recursive update |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `routine / T24` delayed rail | `survivor` | 0.70 | 0.75 | 0.75 | 0.85 | 0.70 |

Advisory warning:

- `recursive_dyadic_update`: the final tutor move follows the learner repair but does not visibly update the tutor's next commitment beyond scene closure.

The existing blind-panel result remains:

| Recognition | Peripeteia-origin | Status |
| ---: | ---: | --- |
| 4/5 | 0/5 | `panel_origin_fail` |

## Interpretation

The recursive layer is useful but not sufficient as a single-transcript gate.

For T24 delayed rail, Claude can identify a plausible tutor-learning arc:

- the learner's four-tile proposal teaches the tutor that the issue is count-warrant misreading;
- the tutor rejects preemptive beat-unit explanation;
- the tutor selects a rail placement test after the learner proposal; and
- the learner uses the failed fourth tile to reframe count versus unit.

But the blind panel still attributed the recognitive form to organic transcript movement. This means recursive tutor-learning survival does not, by itself, solve origin attribution.

The failure now localizes more sharply:

> A single transcript can show tutor learning and learner repair, while still leaving blind critics free to treat the relation between them as organic.

## Next Design Requirement

Use the recursive tutor-learning gate as a precondition, then test contrastive timing pairs.

Required pair shape:

1. Same domain.
2. Same learner resistance.
3. Same apparatus or representational resources.
4. Different tutor timing:
   - adaptive arm: tutor revises strategy only after public learner resistance makes the old route fail;
   - control arm: tutor uses the same apparatus before the learner resistance becomes accountable, or uses it as scene-initial generic support.

Panel question:

> Do critics attribute origin differently when the same apparatus is strategically timed after learner resistance?

If both arms score organic, apparatus/transcript drift is doing the work. If only the adaptive-timing arm scores peripeteia-origin, we have stronger evidence that learner resistance taught the tutor to revise its teaching strategy.

## Stop Rule

Do not run more single-transcript broken-rail panels. The next paid panel should require:

- learner-outcome local gate pass;
- recursive tutor-learning local gate pass; and
- contrastive timing pair packaging.
