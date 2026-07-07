# Lean, Semantic Web, and Proof-DAG Validation

Date: 2026-06-24
Status: design note / future-work seed

## Context

The dramatic derivation proof-DAG work now distinguishes three graph layers:

1. Authored proof DAG: the world-level proof authority.
2. Learner proxy DAG: the learner-visible record of adopted facts, voiced
   derivations, hypotheses, and assertions.
3. Tutor model of the learner DAG: a redacted teaching instrument that
   summarizes what the learner appears to own without leaking authored proof
   paths or hidden premise identifiers.

The live proof gate is currently a deterministic forward chainer over finite
Horn-style rules. For each turn, the engine asks whether the closure of the
learner's current facts under public rules contains the secret fact.

```text
closure(learner_facts, public_rules) contains secret?
```

This note records how Lean and Semantic Web tooling compare as possible
future layers around that proof system.

## Lean

Lean is best understood here as a proof-certificate layer, not as the first
replacement for the runtime proof gate.

Useful roles:

- Certify authored proof DAGs: generated Lean theorems check whether the
  scheduled premises and rules really imply the target conclusion.
- Validate authored proof steps: each rule application can become a checked
  theorem or lemma application.
- Strengthen world authoring: decompose larger targets into smaller lemmas,
  closer to a blueprint or proof-assistant workflow.
- Prevent silent rule bugs: invalid authored inferences fail at Lean
  elaboration/checking time.

Main costs:

- Lean is not currently installed on this checkout's PATH.
- Node should call Lean as a subprocess, usually via `lake env lean`.
- A useful integration needs a small Lake project, a pinned `lean-toolchain`,
  generated `.lean` files, timeout/error handling, and error mapping back to
  DAG nodes.
- Positive proof validation is straightforward; non-entailment checks such as
  "the prefix does not yet prove the secret" are harder unless the finite
  closure algorithm itself is formalized and proved complete.

Best first step:

```text
authored DAG -> generated Lean theorem -> Lean checks it
```

Keep the live learner-entitlement gate in the current JS chainer until a Lean
backend proves it adds value without disrupting the turn-by-turn loop.

## Semantic Web

Semantic Web standards are a better fit for graph publication, query,
interchange, and provenance than for kernel-checked proof certification.

Useful roles:

- RDF / JSON-LD: publish proof DAG nodes, edges, turns, agents, claims, and
  artifacts as interoperable graph data.
- PROV: model provenance for releases, adoptions, derivations, assertions,
  assessments, and generated artifacts.
- SHACL: validate graph shape, for example that a proof-step node has inputs,
  output, rule reference, turn, and source.
- OWL/RDFS: represent stable domain ontology and class/property vocabulary
  when we want broader graph-level semantics.
- SPARQL: query learning trajectories, missing-proof-material patterns,
  assertion timing, and tutor interventions across runs.

Main costs:

- OWL's open-world orientation is awkward for the central runtime question:
  "the learner does not yet have enough to assert the answer."
- Semantic Web reasoners do not give the same proof-certificate story as Lean.
- Custom dramatic proof rules can drift into SPARQL rules, SHACL rules, N3, or
  Datalog-like layers unless we keep a strict boundary.

Best first step:

```text
result.json / learnerDag / tutorLearnerDagModel
  -> RDF/JSON-LD + PROV export
  -> SHACL validation
  -> optional SPARQL reports
```

## Recommended Split

Do not choose Lean or Semantic Web as a single universal replacement. Use each
where it is strongest:

```text
runtime proof gate:
  current Horn-rule forward chainer

authored proof certification:
  optional Lean export/check

graph publication and audit:
  RDF/JSON-LD + PROV

artifact shape validation:
  SHACL
```

Short version:

```text
Lean for truth.
Semantic Web for meaning, provenance, interoperability, and query.
Current chainer for fast live learner entitlement.
```

## Future Work Shape

A practical future slice should avoid replacing the runtime proof engine. It
should instead build two optional exporters:

1. Lean certificate exporter for authored DAGs.
2. RDF/PROV/SHACL exporter for authored, learner, and tutor-model DAGs.

The acceptance test should use a small Lantern/Nocturne world and demonstrate:

- generated Lean passes for the authored full proof;
- generated RDF/PROV validates against SHACL shapes;
- the exported learner/tutor graphs preserve redaction boundaries;
- the existing JS runtime gate remains the source of live turn-by-turn
  entitlement.
