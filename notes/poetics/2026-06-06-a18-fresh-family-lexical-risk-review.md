# A18.19 Fresh Protocol-v1 Family Lexical-Risk Review

Date: 2026-06-06

Status: zero-API fixture authoring and lexical-risk review complete. No replay
generation, policy fill, local ablation, or contrastive panel was run.

## Question

A18.19 asked for a fresh protocol-v1 family after the `hinge_shadow_priority`
failure. The design requirement was stricter than A18.17: the selected repair
should depend on a relation not named in ordinary public vocabulary in the setup,
so S0 is less likely to improvise the same repair neighborhood without policy
memory.

## Fresh Family

Config:

`config/recursive-tutor-learning/a18.19-fresh-family-low-lexical.yaml`

Family: `sidepair_bracket_priority`

Selected repair: `bracket_complement_test`

Public setup vocabulary:

- visible repeated tokens
- pigment match
- nearness
- lane continuity
- small side flecks before/after tokens

Held-out policy vocabulary:

- bracket complement
- missing mate
- side-pair
- partner side
- complementary fleck

The public stage names the visible marks, but it does not name the selected
repair's governing relation. This is the main distinction from
`hinge_shadow_priority`, where ordinary hinge/fold/smudge language gave S0 a
nearby repair route.

## Static Validation

Frozen protocol validation:

```bash
npm run poetics:recursive-tutor-protocol -- \
  --config config/recursive-tutor-learning/a18.19-fresh-family-low-lexical.yaml
```

Result: `pass` for 1 family, 0 errors, 0 warnings.

Benchmark fixture validation:

```bash
npm run poetics:recursive-tutor-learning -- \
  --config config/recursive-tutor-learning/a18.19-fresh-family-low-lexical.yaml \
  --out-dir exports/recursive-tutor-learning/a18.19-fresh-family-local \
  --dry-run
```

Result: valid, 0 issues, 1 family `ready_for_attempt1`.

## Manual Lexical-Risk Review

Public-field search was run over:

- `public_setup`
- `learner_resistance`
- `baseline_tutor_attempt`
- `learner_followup`

Search terms:

- `bracket complement`
- `missing mate`
- `side-pair`
- `partner side`
- `complementary fleck`
- `missing-partner`
- `bracket`
- `complement`

Result:

```json
{
  "public_field_hits": []
}
```

This does not prove S0 cannot infer the relation. The visible side flecks remain
available to both arms, and a strong generator might still invent an opposite-
side or pairing repair. But the selected-policy vocabulary is not lexicalized in
the public setup, which addresses the specific A18.17 failure mode.

## Decision

`sidepair_bracket_priority` is a valid A18.20 candidate under protocol v1.

Next step should be local only:

1. materialize the attempt-chain fixture;
2. run attempt-1 replay;
3. fill policy only if attempt 1 survives;
4. run S0/S1 bounded local screens;
5. do not run a contrastive panel unless both held-out siblings become local
   candidates under the frozen gate.
