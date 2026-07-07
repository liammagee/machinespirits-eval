# Character-DAG drama evidence manifest

Date: 2026-07-01

This manifest packages the Character-DAG drama transfer-specificity family
closeout while preserving the repository artifact boundary: raw generated
transcripts, traces, and robustness summaries stay under ignored `exports/`,
while source, scripts, paper prose, and this scoped evidence manifest are
tracked.

## Scope

Intentional source/config/script surface:

- `config/character-dag-drama-framework.yaml`
- `scripts/run-character-dag-drama-framework.js`
- `scripts/run-character-dag-drama-robustness.js`
- `services/adaptiveTutor/outcomeObserver.js`
- `docs/next-steps/character-dag-drama-framework-plan.md`
- `docs/research/paper-full-2.0.md`

Local evidence package:

- Path: `exports/character-dag-drama-framework-transfer-specificity-real-family/`
- Status: ignored by `.gitignore`, retained locally when the run is present.
- Canonical reports:
  - `robustness-report.md`
  - `robustness-summary.json`
  - `claim-audit.md`

## Reproduction command

```bash
NODE_OPTIONS='-r dotenv/config' npm run adaptation:character-dag-drama-robustness -- \
  --llm real \
  --learner-mode llm \
  --seeds 2 \
  --expanded-families \
  --arms policy_only,full_character_dag_drama,shuffled_character_state,stale_character_state,overconfident_character_state,compressed_character_state,state_without_proof_policy \
  --perturbations state_dependent_transfer \
  --checkpoint \
  --out-dir exports/character-dag-drama-framework-transfer-specificity-real-family
```

## Claim summary

This is an exploratory synthetic apparatus result. It is not a main-harness
effect estimate, not human-learning evidence, not deployed tutor reliability,
and not evidence of real learner interior character development.

All four family runs pass acceptance gates under `character-dag-drama-observer.v0.5`.

- Fixture families: `base`, `ratio_series`, `definition_boundary`, and
  `causal_identification`.
- Matrix: real generated learner, two seeds, eight scenes, seven arms, one
  `state_dependent_transfer` perturbation per family.
- `full_character_dag_drama` first-response success: 15/16, 14/16, 14/16,
  and 13/16.
- `policy_only` first-response success: 6/16, 3/16, 5/16, and 4/16.
- `shuffled_character_state` first-response success: 7/16, 6/16, 6/16,
  and 5/16.
- Full transfer closure: 6/6, 5/6, 6/6, and 5/6.
- Policy-only and shuffled-state transfer closure: 0/6 in all families.
- Stale, overconfident, and compressed controls: 0/6 transfer closure in the
  three non-base families.
- Target-label leaks: 0.
- Public theory/process leaks: 0.

The licensed paper claim is therefore narrow: matched public character state
helps route transfer scenes in this synthetic Character-DAG drama benchmark,
under a stricter observer that requires naming the concrete public prior check.
