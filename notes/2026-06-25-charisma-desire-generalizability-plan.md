# Charisma Desire Generalizability Plan

Status: frozen preliminary plan for extending the cell 169 local pass into a
generalizability study. No new paid evaluation is authorized by this note.

## Current Claim Boundary

Cell 169 (`cell_169_id_director_charisma_accountable_bid_clean_floor_verified`)
is currently a clean local design pass, not a generalizable effect. The licensed
claim is:

> accountable-bid charisma is the first clean local pass under simulated
> authority refusal.

The unlicensed claims remain:

- charismatic tutoring works generally;
- real learners recognize the tutor's authority;
- charismatic authority improves human learning;
- cell 169 is better than the prior id-director family across curricula,
  judges, or model pairings.

This branch should remain separate from the Paper 2.0 main-mechanism claims
unless a later multi-scenario, multi-judge, model-robust, and human-facing gate
promotes it.

## Existing Evidence

Reconstructed from `data/evaluations.db` on 2026-06-25. Query source:

```sql
SELECT
  r.run_id,
  r.scenario_id,
  r.profile_name,
  printf('%.2f', r.tutor_first_turn_score) AS v22_first_turn,
  CASE
    WHEN r.tutor_charisma_overall_score IS NULL
      OR r.tutor_charisma_overall_score = 0
    THEN 'not retained'
    ELSE printf('%.2f', r.tutor_charisma_overall_score)
  END AS charisma,
  r.passes_required,
  r.passes_forbidden,
  r.required_missing,
  r.forbidden_found,
  r.judge_model,
  r.tutor_charisma_judge_model,
  json_extract(run.metadata, '$.egoModelOverride') AS ego_model,
  json_extract(run.metadata, '$.superegoModelOverride') AS id_model,
  json_extract(run.metadata, '$.judgeCli') AS judge_cli,
  json_extract(run.metadata, '$.gitCommit') AS git_commit
FROM evaluation_results r
JOIN evaluation_runs run ON run.id = r.run_id
WHERE r.run_id IN (
  'eval-2026-06-25-b9608606',
  'eval-2026-06-25-428ccd8f',
  'eval-2026-06-25-19ee106a',
  'eval-2026-06-25-63e98149',
  'eval-2026-06-25-0acee3fb'
);
```

| Run | Scenario | Profile | v2.2 first-turn | Charisma | Required | Forbidden | Required missing | Forbidden found | v2.2 judge | Charisma judge | Ego | Id |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|---|
| `eval-2026-06-25-b9608606` | `charisma_desire_authority_withheld` | `cell_163_id_director_charisma_agency_return_warm_floor_verified` | 95.42 | 90.00 | 1 | 1 | `["one of: test, try, refuse, push back, where it fails"]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-428ccd8f` | `charisma_desire_status_challenge` | `cell_163_id_director_charisma_agency_return_warm_floor_verified` | 78.13 | 75.00 | 1 | 1 | `["one of: one, criterion, check, if it helps"]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-19ee106a` | `charisma_desire_status_challenge` | `cell_168_id_director_charisma_accountable_bid_floor_verified` | 88.75 | not retained | 1 | 0 | `[]` | `["profound"]` | `codex-cli/auto` |  | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-63e98149` | `charisma_desire_authority_withheld` | `cell_169_id_director_charisma_accountable_bid_clean_floor_verified` | 88.75 | 78.75 | 1 | 1 | `[]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |
| `eval-2026-06-25-0acee3fb` | `charisma_desire_status_challenge` | `cell_169_id_director_charisma_accountable_bid_clean_floor_verified` | 87.50 | 78.75 | 1 | 1 | `[]` | `[]` | `codex-cli/auto` | `claude-code.sonnet-4-6` | `codex.gpt-5.5` | `claude-code.sonnet-4-6` |

Interpretation:

- Cell 163 can produce the strongest authority performance, but status-challenge
  is weaker and audit metadata still records unmet optional handback phrase
  groups.
- Cell 168 repairs the status-challenge v2.2 score but fails the forbidden-word
  guard by repeating `profound`.
- Cell 169 is the first clean local pass across both decision scenarios.

## Frozen Scenario Taxonomy

Primary decision scenarios:

- `charisma_desire_authority_withheld`
- `charisma_desire_status_challenge`

Robustness scenarios to add or freeze before paid runs:

- `charisma_desire_partial_uptake`: keep out of the primary decision rule because
  it confounds recognition theory, Hayles/AI-cognition content, and learner
  uptake of a tutor phrase.
- Ordinary conceptual check: same curriculum, no explicit authority challenge,
  to test whether `accountable_bid_clean` overcorrects into unnecessary
  self-limitation.
- Vulnerability/persona-shift check: reuse or adapt prior persona-shift logic
  where the learner disclosure resists easy sympathy.
- Non-Hegelian curriculum transfer: use a curriculum outside EPOL 479 so the
  result is not carried by recognition-theory vocabulary.
- Optional plain-language stress test: learner requests direct, low-register
  instruction to test whether charisma survives simplification.

The first pilot matrix should use six scenario types total: the two primary
scenarios plus four robustness scenarios selected from the list above. The
exact scenario ids must be frozen in `config/charisma-recognition-desire-scenarios.yaml`
before any paid run.

## Frozen Comparator Set

Use exactly four profile families for the pilot matrix:

1. `cell_169_id_director_charisma_accountable_bid_clean_floor_verified`
   - Target design.
2. `cell_163_id_director_charisma_agency_return_warm_floor_verified`
   - Strong prior agency-return comparator.
3. `cell_104_recog_id_director_charisma_register`
   - Prior id-director recognition/register generalist comparator.
4. `cell_107_id_director_witness_exemplars`
   - Prior witness-exemplar generalist comparator.

The default `budget` tutor should be run only as a floor check if cost permits
or if the pilot results are ambiguous. Do not replace one of the four core
profiles with `budget` unless the matrix is explicitly resized.

## Judge and Model Matrix

Primary high-powered stack, matching the local pass where feasible:

- Ego: `codex.gpt-5.5`
- Id / superego slot: `claude-code.sonnet-4-6`
- v2.2 judge: Codex CLI (`codex-cli/auto`)
- Charisma judge: Claude Code Sonnet 4.6

Robustness requirements before a generalizability claim:

- Add at least one second v2.2 judge.
- Add at least one second charisma judge.
- Rerun a reduced matrix with at least one non-Codex ego or non-Claude id pairing.
- Record all judge labels and model overrides from `evaluation_runs.metadata`.

## Evaluation Stages

Stage 0 - no paid calls:

- Clean accidental or stale runs.
- Confirm all profile names resolve with `node scripts/eval-cli.js validate-config`.
- Confirm the scenario override parses with:

```bash
EVAL_SCENARIOS_FILE=config/charisma-recognition-desire-scenarios.yaml \
  node scripts/eval-cli.js validate-config
```

- Rebuild the workplan board after saving this plan.

Stage 1 - pilot matrix:

- Six scenario types x four profiles x three runs = 72 rows.
- Use the primary high-powered stack if budget allows.
- Do not tune prompts or validation phrases during the pilot.

Stage 2 - promotion matrix:

- Increase to at least ten repeats per profile-scenario if Stage 1 shows cell
  169 remains clean and meaningfully competitive.
- Increase to 24 repeats only if variance remains material or if the result is
  intended for a publication claim.

Stage 3 - robustness:

- Second v2.2 judge.
- Second charisma judge.
- Reduced alternate model-pair matrix.
- Human-coded or human-learner subset.

## Promotion Rules

Cell 169 can be promoted from "local pass" to "generalizes across tested
simulated authority-refusal scenarios" only if all are true:

- Required and forbidden validation pass on both primary scenarios across the
  pilot matrix.
- No repeated forbidden status-display term appears in any primary scenario row.
- v2.2 and charisma means remain competitive with cells 163, 104, and 107.
- The result survives at least one judge robustness check or one model-pair
  robustness check.
- Human-facing evidence, if collected, does not classify the tutor's authority
  as manipulative, merely polished, or coercive.

If any primary criterion fails, stop and record the failure mode. Do not iterate
inside the same matrix without freezing a new versioned plan.

## Stop Rules

- Stop immediately if `cell_169` fails forbidden-word validation in either
  primary scenario.
- Stop after Stage 1 if `cell_169` only wins by style scores while losing the
  authority-defeasibility interpretation.
- Stop if `partial_uptake` becomes the only positive signal; that scenario is
  robustness evidence, not the decision-maker.
- Stop if the alternate model-pair matrix reverses the result; treat
  `accountable_bid_clean` as stack-specific.
- Stop before any human-learning claim unless real learner or human-coded data
  exists.

## Preliminary Cleanup Completed

The accidental interrupted run `eval-2026-06-25-87a4bef6` was removed from the
database on 2026-06-25 with:

```bash
node scripts/eval-cli.js delete-runs --run-id eval-2026-06-25-87a4bef6 --force
```

The command deleted one run and 96 partial evaluation rows. The generated
progress log `logs/eval-progress/eval-2026-06-25-87a4bef6.jsonl` was also
removed.
