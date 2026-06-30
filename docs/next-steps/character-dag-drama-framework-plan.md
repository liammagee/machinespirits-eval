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

The robustness runner also supports fixture-family and stronger-control screens:

- Fixture families: `base`, `ratio_series`, `definition_boundary`,
  `causal_identification`.
- Stronger controls: `stale_character_state`, `overconfident_character_state`,
  `compressed_character_state`, and `state_without_proof_policy`.
- `--expanded-families` selects all fixture families.
- Robustness artifacts include `claim-audit.md` and
  `human-pilot-hypotheses.md` in addition to the machine summary and report.

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
- `full_character_dag_drama` has stronger transfer first-response success than `policy_only`;
  if `policy_only` is already at transfer ceiling, full must match that ceiling and
  the robustness layer must still show aggregate transfer margin across strict perturbations.
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

Strict robustness screen:

```bash
NODE_OPTIONS='-r dotenv/config' npm run adaptation:character-dag-drama-robustness -- \
  --llm real \
  --learner-mode llm \
  --seeds 3 \
  --arms policy_only,full_character_dag_drama,shuffled_character_state \
  --perturbations baseline,noisy_openings,harder_transfer,state_dependent_transfer \
  --checkpoint \
  --reanalyze-existing \
  --out-dir exports/character-dag-drama-framework-robustness-policy-repair-real
```

Paper/workplan updates happen only if the real synthetic contrast passes the gates.

## Strict Robustness Result

Completed on 2026-06-30 with real generated learners, three seeds, three decisive
arms, and four strict perturbations. The robustness screen passed. `full_character_dag_drama`
reached 21/24 first-response successes in every perturbation; `policy_only` reached
16/24, 12/24, 17/24, and 11/24; `shuffled_character_state` reached 14/24, 11/24,
9/24, and 9/24. Transfer first-response closure was full 9/9, 8/9, 9/9, 9/9;
policy-only 8/9, 5/9, 9/9, 1/9; shuffled 4/9, 4/9, 3/9, 2/9.

The accepted interpretation remains synthetic and apparatus-level: the harness
can coordinate proof-DAG transitions, resistance routing, peripeteia pressure,
and matched character-state routing as one adaptation policy layer. It does not
establish human learning, deployed tutoring reliability, or real interior
character development.

## Expanded Family and Control Result

Completed on 2026-06-30 as a stronger synthetic robustness development pass.
The runner now generates three additional fixture families, four stronger
state/control arms, a claim-audit artifact, and human-pilot hypothesis notes.

Expanded mock screen:

```bash
npm run adaptation:character-dag-drama-robustness -- \
  --llm mock \
  --learner-mode llm \
  --seeds 2 \
  --expanded-families \
  --arms policy_only,full_character_dag_drama,shuffled_character_state,stale_character_state,overconfident_character_state,compressed_character_state,state_without_proof_policy \
  --perturbations baseline,noisy_openings,harder_transfer,state_dependent_transfer \
  --out-dir exports/character-dag-drama-framework-family-controls-mock-v2
```

Result: PASS across 16 family/perturbation runs. Artifacts:

- `exports/character-dag-drama-framework-family-controls-mock-v2/robustness-report.md`
- `exports/character-dag-drama-framework-family-controls-mock-v2/claim-audit.md`
- `exports/character-dag-drama-framework-family-controls-mock-v2/human-pilot-hypotheses.md`

Real generated-learner stronger-control screen:

```bash
NODE_OPTIONS='-r dotenv/config' npm run adaptation:character-dag-drama-robustness -- \
  --llm real \
  --learner-mode llm \
  --seeds 1 \
  --families base \
  --arms policy_only,full_character_dag_drama,shuffled_character_state,stale_character_state,overconfident_character_state,compressed_character_state,state_without_proof_policy \
  --perturbations state_dependent_transfer \
  --checkpoint \
  --out-dir exports/character-dag-drama-framework-family-controls-real-v2-base
```

Result: scenario acceptance PASS but stronger robustness FAIL. The leak guards
passed and `full_character_dag_drama` separated from policy-only, shuffled,
stale, overconfident, and state-without-proof controls. It did not separate from
`compressed_character_state`: both full and compressed scored 8/8 first-response
success and 3/3 transfer first-response success, with zero remediation burden.

Interpretation: the current transfer observer accepts generic "some condition
must hold" reasoning as a sufficient transfer check. That is too weak for the
compressed-state control. The next development should add a task-specific
transfer evidence contract that requires the learner to name the relevant prior
condition/check from public state, while compressed state should remain unable to
recover that detail. Until that passes, the stronger claim is not supported; the
prior three-arm apparatus claim remains synthetic and exploratory.

## Transfer-Specificity Repair Result

Completed on 2026-07-01 local time. The harness now adds a public-safe
`transfer_contract` to transfer scenes. Matched character state exposes a
specific prior check such as `validity condition`, `ratio criterion`,
`definition clause`, or `identifying condition`; compressed and stale controls
mark that detail unavailable. The observer now requires the learner's own
transfer response to name the scene's required public term in addition to the
existing rationale and task-reorientation evidence.

Expanded mock screen:

```bash
npm run adaptation:character-dag-drama-robustness -- \
  --llm mock \
  --learner-mode llm \
  --seeds 2 \
  --expanded-families \
  --arms policy_only,full_character_dag_drama,shuffled_character_state,stale_character_state,overconfident_character_state,compressed_character_state,state_without_proof_policy \
  --perturbations baseline,noisy_openings,harder_transfer,state_dependent_transfer \
  --out-dir exports/character-dag-drama-framework-transfer-specificity-mock
```

Result: PASS across 16 family/perturbation runs.

Bounded real generated-learner screen:

```bash
NODE_OPTIONS='-r dotenv/config' npm run adaptation:character-dag-drama-robustness -- \
  --llm real \
  --learner-mode llm \
  --seeds 1 \
  --families base \
  --arms policy_only,full_character_dag_drama,shuffled_character_state,stale_character_state,overconfident_character_state,compressed_character_state,state_without_proof_policy \
  --perturbations state_dependent_transfer \
  --checkpoint \
  --out-dir exports/character-dag-drama-framework-transfer-specificity-real-base
```

Result: PASS. `full_character_dag_drama` reached 7/8 first-response success and
3/3 transfer first-response success. `compressed_character_state` dropped to
5/8 first-response success and 1/3 transfer first-response success, with two
transfer-specificity misses. All target-label and public theory/process leak
guards passed.

Interpretation: the compressed-state negative control behaves as intended in the
bounded real screen. This supports the synthetic apparatus claim at the
benchmark-design level, but it is still not a human-learning or deployed-tutor
claim. The larger real state-dependent-transfer matrix below is the completed
escalation that justified the exploratory Paper 2.0 note.

## Expanded Real Family Transfer Result

Completed on 2026-07-01 local time. The larger real generated-learner matrix ran
two seeds across four fixture families, seven arms, and eight scenes per
family:

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

Result: PASS. All four family runs pass the acceptance gates under
`character-dag-drama-observer.v0.5`. `full_character_dag_drama` reached
first-response success of 15/16, 14/16, 14/16, and 13/16 across `base`,
`ratio_series`, `definition_boundary`, and `causal_identification`. `policy_only`
reached 6/16, 3/16, 5/16, and 4/16; `shuffled_character_state` reached 7/16,
6/16, 6/16, and 5/16. Full transfer closure was 6/6, 5/6, 6/6, and 5/6, while
policy-only and shuffled-state transfer stayed 0/6 in all families. Compressed
state stayed at 0/6 transfer outside the earlier bounded base screen. Target-label
and public theory/process leak guards remained clean.

Artifacts:

- `exports/character-dag-drama-framework-transfer-specificity-real-family/robustness-report.md`
- `exports/character-dag-drama-framework-transfer-specificity-real-family/robustness-summary.json`
- `exports/character-dag-drama-framework-transfer-specificity-real-family/claim-audit.md`

Paper status: Paper 2.0 §6.8.9 now carries this as an exploratory synthetic
apparatus note. The boundary remains strict: the result supports coordination of
proof-DAG policy, resistance routing, peripeteia pressure, and evidence-derived
character state inside the synthetic harness. It does not establish human
learning, deployed reliability, model-weight adaptation, or real interior
character development.
