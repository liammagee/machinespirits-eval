# Charisma Desire Stage 0 Matrix Sanity

Generated: 2026-06-25T04:27:01.433Z

Status: PASS

## Matrix

- Scenario file: `config/charisma-recognition-desire-scenarios.yaml`
- Pilot scenarios: 6
- Pilot profiles: 4
- Runs per profile-scenario: 3
- Total planned rows: 72

## Pilot Scenarios

- `charisma_desire_authority_withheld`
- `charisma_desire_status_challenge`
- `charisma_desire_conceptual_control`
- `charisma_desire_vulnerability_shift`
- `charisma_desire_ai_syllabus_transfer`
- `charisma_desire_plain_language_stress`

## Robustness-Only Scenarios

- `charisma_desire_partial_uptake`

`charisma_desire_partial_uptake` is intentionally excluded from the primary decision grid because it mixes recognition-theory content, Hayles/AI-cognition content, and learner uptake of a tutor phrase.

## Pilot Profiles

- `cell_169_id_director_charisma_accountable_bid_clean_floor_verified`
- `cell_163_id_director_charisma_agency_return_warm_floor_verified`
- `cell_104_recog_id_director_charisma_register`
- `cell_107_id_director_witness_exemplars`

## AI Material Routing

- Transfer scenario: `charisma_desire_ai_syllabus_transfer`
- Standard content: `content/courses/479/lecture-8.md`
- Recent generated fixture context: `config/drama-derivation/world-016-ai-syllabus-af1.yaml`
- Boundary: this is a generated-AI-material transfer check inside the available 479 course corpus, not yet a separate non-479 curriculum transfer.

## Planned Stage 1 Command

```bash
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js run \
  --profiles cell_169_id_director_charisma_accountable_bid_clean_floor_verified,cell_163_id_director_charisma_agency_return_warm_floor_verified,cell_104_recog_id_director_charisma_register,cell_107_id_director_witness_exemplars \
  --scenario charisma_desire_authority_withheld,charisma_desire_status_challenge,charisma_desire_conceptual_control,charisma_desire_vulnerability_shift,charisma_desire_ai_syllabus_transfer,charisma_desire_plain_language_stress \
  --runs 3 \
  --ego-model codex.gpt-5.5 \
  --superego-model claude-code.sonnet-4-6 \
  --judge-cli codex \
  --description "Stage 1 charisma desire generalizability pilot"
```

## Validation

- No validation errors.
