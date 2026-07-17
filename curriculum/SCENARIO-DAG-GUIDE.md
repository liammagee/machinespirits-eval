# Scenario and Proof-DAG Authoring Guide

Use this guide when a curriculum module is turned into a staged reasoning
scenario, especially a `config/drama-derivation/world-*.yaml` world.

## Keep the three graphs distinct

1. The **curriculum prerequisite DAG** orders modules. An edge means the earlier
   module is genuinely required by the later one.
2. The **world adaptation contract** constrains tutor actions. It is compiled
   from a module and is not a proof or an evaluator.
3. The **scenario proof DAG** connects staged evidence, public inference rules,
   and the answer. It is authored only when a module becomes a derivation world.

The Curriculum Builder reports the first graph and compiles the second. It does
not invent the third. A proof DAG still needs deliberate domain authoring and
the catalog quality gate below.

## Authoring contract

### 1. Ask for the kind of answer the DAG produces

The public question, `question_pattern`, secret, and mirror must have the same
semantic type. Ask “which first implementation baseline?” if the answer is a
baseline; do not ask vaguely what “kind of system” it is.

### 2. Make every evidence surface support its exact fact

The learner-facing `surface` may be vivid, but it must warrant the formal fact
without an unstated leap. A parked vehicle does not prove its owner was present;
trimming a lamp does not prove using it; species identity does not prove a
strain match; access to a queue does not prove a particular file push.

Use the strongest evidence the story actually possesses: a recognized witness,
an exclusive-custody record, whole-genome typing, or an event log. Do not encode
a stronger formal fact than the surface establishes.

### 3. Make public rules valid in ordinary language

Every rule needs a `gloss`. The gloss should say why its premises warrant its
conclusion in the domain, not merely restate predicate names. Avoid rules that
infer an action from role, motive, opportunity, or access alone.

### 4. Keep the proof minimal; label evidence that serves another purpose

Every declared `proof_path` must be minimal: removing any one listed premise
must break entailment. Every other minimal route to the answer must also be
declared. Do not make the learner re-prove an intermediate already carried by a
later predicate.

Evidence may still be useful without being proof-critical. Mark that purpose so
the tutor and auditors do not mistake it for required reasoning:

```yaml
premises:
  - id: p_control_night
    evidence_role: corroboration
    fact: [sagPersistsWhenIdle, tallowStreet]
    surface: The chargers were off, and the street still browned out.

  - id: p_witness_a
    evidence_role: alternative_route
    alternative_group: tower_presence
    fact: [atTowerThatNight, senna, southStack]
    surface: The watch recognized Senna climbing the tower stair.
```

Supported roles are `proof`, `alternative_route`, `mirror`, `corroboration`,
`orientation`, and `texture`. Exact duplicate facts are allowed only as named
alternative routes. This preserves deliberately different witnesses or
decay/repair probes without padding the staged proof.

### 5. Give the mirror a real dead end

A near-miss should be tempting for public reasons, yet remain underivable as the
answer. State the secret/mirror incompatibility explicitly. If a decoy chain is
fully derivable, end it at a different predicate—such as accountability rather
than authorship—and make that distinction clear in its gloss.

### 6. Write in the world's own language

For contemporary or speculative production worlds, provide:

- `presentation.scene_ecology`;
- `presentation.narrative_diction`;
- `presentation.ledger_term`;
- `presentation.summary`.

Prefer the ordinary domain term over decorative or misleading language. Bread
that spends too long in flight arrives **cold**, not instantly “stale.” A
moderation audit should rely on authenticated device/session evidence, not a
shared router address.

### 7. Separate catalog visibility from explicit test access

Use an eligibility block for worlds that should not appear in the normal
scenario picker:

```yaml
eligibility:
  status: screen_pending # production | test_only | screen_pending | screen_rejected
  reason: Awaiting the required S-underivability screen.
```

Non-production worlds remain addressable by explicit id or path for smoke,
screen, and regression work.

## Validation sequence

```bash
# Exact release/entailment check for one world
npm run derivation:lint -- --world config/drama-derivation/world-NNN-name.yaml

# Catalog authoring gate: all worlds, all minimal paths, glosses, evidence roles,
# mirror incompatibilities, presentation, and eligibility
npm run derivation:quality

# Integration and presentation regressions
node --test \
  tests/dramaticDerivationWorlds.test.js \
  tests/derivationWorldPresentation.test.js \
  tests/derivationWorldQuality.test.js
```

The static gate cannot decide whether a scientific or legal claim is true. The
author must still review surface-to-fact alignment and each rule's domain
validity. The gate makes the structural parts reproducible and prevents those
human judgments from being buried under avoidable graph defects.
