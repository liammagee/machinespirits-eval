# Synthetic Character-DAG Drama Framework

## Summary

Build a synthetic-only benchmark that joins the drama-machine/peripeteia arc with
the existing adaptive DAG/resistance character-state harness. The first version
extends the current adaptive runner rather than creating a separate orchestration
system: proof-DAG state, resistance routing, staged evidence contracts,
character-state updates, and poetics-style peripeteia checks remain explicit and
auditable.

The claim boundary is strict. The benchmark tests dramaturgical form and
synthetic learner development inside the harness. It does not claim human
learning, real interior change, deployed tutoring quality, or model-weight
adaptation.

## Build Shape

Add a config-driven runner exposed as:

```bash
npm run adaptation:character-dag-drama-framework -- \
  --fixture config/character-dag-drama-framework.yaml \
  --llm mock \
  --learner-mode scripted \
  --seeds 3 \
  --out-dir exports/character-dag-drama-framework
```

Supported options:

- `--fixture config/character-dag-drama-framework.yaml`
- `--llm mock|real`
- `--learner-mode scripted|llm`
- `--seeds N`
- `--arms policy_only,drama_only,character_only,full_character_dag_drama,shuffled_character_state,scripted_oracle`
- `--out-dir exports/character-dag-drama-framework`

The fixture defines:

- `world_spec`: proof-DAG task structure and forbidden moves.
- `arc`: ordered phases `setup`, `pressure`, `peripeteia`, `consolidation`, `transfer`.
- `scenes`: each scene has `id`, `phase`, `opening`, `resistance_signal`, `proof_contract`,
  `dramatic_contract`, `character_axis_targets`, and `transfer`.
- `arms`: toggles for proof policy, drama/peripeteia pressure, character-state routing,
  shuffled-state routing, and oracle scripting.

## Architecture

The loop is coordinated as six roles:

- Deterministic Drama Director: compiles phase/scene cards from the fixture.
- Tutor Ego: proposes the next pedagogical move through the existing adaptive runner.
- Tutor Superego / Policy Critic: enforces proof-DAG, resistance, staged-contract,
  and no-leak rules through the closed-loop graph.
- Learner Ego: generates the public reply.
- Learner Character Interior: revises only from public-safe character state and prior summaries.
- Observer + Archivist: scores evidence, peripeteia validity, and updates character state
  from public evidence only.

The decisive arms are:

- `policy_only`: proof-DAG + resistance repair, no character or drama routing.
- `drama_only`: dramatic/peripeteia pressure without proof-DAG policy.
- `character_only`: character-state routing without staged v2 proof policy.
- `full_character_dag_drama`: proof-DAG + resistance + peripeteia + character state.
- `shuffled_character_state`: full policy with wrong prior state, negative control.
- `scripted_oracle`: upper-bound sanity check.

## Artifacts

Each run writes:

- `summary.json`: full run data, arm aggregates, per-scene evidence, character axes, and boundary metadata.
- `report.md`: human-readable comparison table and interpretation.
- `scenario-fixture.yaml`: frozen fixture copy.
- `trace.ndjson`: per-scene role/action/observer events for audit.

## Acceptance Gates

- No target evidence labels are visible to the learner.
- No public theory/process leakage appears in tutor or learner text.
- `full_character_dag_drama` beats `policy_only` and `shuffled_character_state`
  on first-response success and lower staged-or-unresolved remediation burden.
  Raw staged-followup counts are still reported separately; unresolved failures
  are included in the gate so a control is not rewarded for failing before repair.
- `full_character_dag_drama` has stronger transfer first-response success than `policy_only`.
- Peripeteia is detected only where the fixture requires it.
- Any character-development score above flat controls has transcript evidence and no gullibility flags.

## Test Plan

Run:

```bash
node --test \
  tests/character-state.test.js \
  tests/dagResistanceCharacterDevelopment.test.js \
  tests/poeticsTutorAdaptationAnalyzer.test.js \
  tests/dramaticDerivationCharacterArc.test.js \
  tests/characterDagDramaFramework.test.js

npm run format:check
npm run wp:check
```

Mock benchmark:

```bash
npm run adaptation:character-dag-drama-framework -- --llm mock --learner-mode scripted --seeds 3
npm run adaptation:character-dag-drama-framework -- --llm mock --learner-mode llm --seeds 3
```

Real synthetic contrast, only after mock gates pass:

```bash
npm run adaptation:character-dag-drama-framework -- \
  --llm real \
  --learner-mode llm \
  --seeds 2 \
  --arms policy_only,full_character_dag_drama,shuffled_character_state
```

Paper/workplan updates happen only if the real synthetic contrast passes the gates.
