# Negative-Register Effect Estimation Preregistration

## Decision question

Do irony, sarcasm, or simulated face-threat produce different local simulated
learner outcomes after separating register assignment from verified treatment
fidelity?

This is a simulated-system comparison. It is not evidence that a negative
register is safe, acceptable, or effective with human learners.

## Frozen minimum design

- Arms: cells 196 (irony), 197 (sarcasm), and 198 (simulated face-threat).
- Targets: boredom, frustration, irrelevance, question flood, and rote
  parroting from `config/charisma-recognition-desire-scenarios.yaml`.
- Repeats: three per arm-target cell.
- Planned rows: exactly 3 x 5 x 3 = 45 successful generation attempts in the
  primary grid.
- Generation stack: `codex.gpt-5.5` for both tutor and learner, matching the
  post-repair canary family.
- Tutor scoring: tutor-only rubric v2.2 using the Claude CLI with `sonnet-5`.
- Register scoring: the generic register rubric using
  `claude-code.sonnet-5`. The earlier GPT-mini register scores are not
  admissible for this grid.

The executable plan and its SHA-256 are produced by:

```bash
npm run negative-register:grid -- --dry-run
```

Dry-run makes no model calls and does not open the evaluation database. A paid
generation launch additionally requires `--launch-approved` and the exact SHA
of a clean checkout. The launcher bounds the primary design to 45 result rows;
it does not claim an exact model-call count because the standard dialogue runner
may make a variable number of internal calls per row.

## Estimands

Report both, without substituting one for the other:

1. **Assigned-arm estimand:** all rows assigned to each negative-register arm,
   including treatment noncompliance and invalid guardrail outcomes.
2. **Faithful-arm estimand:** only rows the stance-fidelity gate classifies as
   valid evidence that the assigned register was instantiated.

For each arm and each target-by-arm cell, report:

- positive local breakthrough count and rate;
- mean tutor-only v2.2 score;
- mean register-rubric score;
- faithful-row count;
- treatment-noncompliance exclusions; and
- invalid person-attack violations.

`weak_or_warm_in_costume` and `not_instantiated` are treatment-noncompliance
exclusions from the faithful estimand. `invalid_person_attack` is an invalid
guardrail outcome, not successful face-threat or sarcasm.

The effect-grid reporter fails closed unless all 15 arm-target cells contain
three rows and every row has tutor-only v2.2, register-rubric, and
stance-fidelity measurements.

## Interpretation boundary

With only three repeats per arm-target cell, arm means are exploratory system
estimates, not precise causal effects. Any empirical result must first be added
to the canonical `docs/research/paper-full-2.0.md`, remain explicitly
simulated-only and non-human-facing, and undergo the paper claim audit before a
spin-off artifact can inherit it.

No model-consuming grid was run while preparing this preregistration.
