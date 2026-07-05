# Proof DAG Formalism Plan

Date: 2026-06-24
Status: implementation plan, partially landed on `codex/proof-dag-assessment`

## Purpose

Make dramatic derivation proof DAGs human readable while preserving mechanical
checkability and keeping assessment external to the learner. The authored DAG is
the proof authority; the learner DAG is a reconstructed proof sketch derived
from learner-visible evidence, voiced derivations, hypotheses, and assertions.

## SOTA Position

The strongest pattern is a layered proof and learner-state architecture:

1. Authored proof graph: premises, public rules, admissible proof paths, and
   release schedule.
2. Machine-checkable derivation certificate: a verifier determines whether the
   target claim is entailed under the released facts and rules.
3. Learner proof sketch: a learner-state graph reconstructed from visible
   actions, claims, hypotheses, adopted facts, and retractions.
4. External graph-alignment assessment: compare learner DAG against authored
   DAG after or around play without giving the learner access to authored
   proof paths.

This is closer to model tracing, example tracing, truth maintenance, and proof
certificate practice than to a pure visualization feature.

## Relevant Formalisms

- Natural deduction and sequent proof trees with shared subproofs: human
  friendly, explanation-oriented, and good for pedagogical rendering.
- Resolution proof DAGs: standard in automated theorem proving and SAT, with
  formulas or clauses as nodes and inference dependencies as edges.
- SAT proof logs such as DRAT, LRAT, and FRAT: industrial proof certificates
  for unsatisfiability, useful as a checkability model but too low-level for
  drama-facing display.
- SMT proof certificates such as Alethe, LFSC, and CPC: structured proof
  formats used by SMT solvers, with independent checking and reconstruction.
- TPTP/TSTP derivations: a close conceptual match because derivations are
  explicitly DAGs whose leaves are inputs, interior nodes are inferred
  formulae, and roots are final derived formulae.
- Proof nets: graphical proof theory, especially for linear logic; useful if
  resource sensitivity becomes central, but not the default fit here.
- Truth-maintenance and justification graphs: highly relevant for learner DAGs
  because they track beliefs, assumptions, justifications, retractions, and
  inconsistent contexts.
- W3C PROV provenance DAGs: useful for audit trails across entity, activity,
  agent, derivation, and responsibility, but not sufficient as proof validity.
- Argumentation frameworks: useful if a drama shifts from strict derivation to
  attacks, supports, counterarguments, and dialectical acceptability.

## Recommended Internal Shape

Represent the proof as a bipartite proof hypergraph:

```text
fact nodes -> rule-application nodes -> derived fact nodes
```

This is more precise than plain binary edges because most proof steps depend on
multiple premises. Render it as a human-readable DAG:

```text
premise p1 + premise p2 --R1--> intermediate claim
intermediate claim + p3 --R2--> secret S
```

Keep two graph authorities separate:

- `authoredDag`: the world-spec proof authority.
- `learnerDag`: the learner-visible reconstructed proof sketch.

Assessment compares the two. It does not replace the proof gate and does not
grant the learner access to authored proof paths.

## Assessment Metrics

Core graph-alignment metrics:

- Authored path coverage by turn.
- Complete path ids.
- First complete path turn.
- First secret-entailed turn.
- Final secret entailed.
- Asserted secret.
- Asserted mirror.
- Unsupported assertion count.
- Missing premises on best path.
- Missing-premise bucket: unreleased, released-but-not-held, unscheduled.
- Bottleneck class: release or pacing gap, learner integration gap, assertion
  gap, premature assertion, grounded asserted secret.

## Proposed Schema Direction

```json
{
  "facts": [],
  "ruleApplications": [],
  "edges": [],
  "proofPaths": [],
  "learnerStateByTurn": [],
  "assessment": {
    "pathCoverage": [],
    "firstCompletePathTurn": null,
    "firstSecretEntailedTurn": null,
    "unsupportedClaims": [],
    "missingPremises": [],
    "bottleneck": "release_or_pacing_gap"
  }
}
```

## Implementation Steps

1. Keep the current authored DAG profile as the human-readable world-spec
   layer.
2. Convert inference edges to explicit rule-application nodes where a rule has
   multiple premises.
3. Preserve `learnerDag` as a learner-visible reconstruction from board state
   or transcript metadata.
4. Add graph-alignment batch diagnostics as a local report over existing
   derivation runs.
5. Optionally add a PROV-style export later for provenance/audit tooling.
6. Avoid importing SAT/SMT formats directly unless the project needs external
   checker interoperability; use their authority/checkability pattern instead.

## Implementation Update

Landed in the proof-DAG assessment branch:

- Authored DAG profile renders the world-spec proof paths and now carries a
  bipartite hypergraph representation: fact nodes, rule-application nodes, and
  typed input/output edges.
- Learner DAG remains learner-visible: it is reconstructed from board facts,
  voiced derivations, hypotheses, and assertions, not from authored
  `proof_paths`.
- Learner DAG snapshots now represent voiced/asserted inferences as explicit
  rule-application nodes instead of only collapsed inference edges.
- Per-run learner assessment now owns the graph-alignment bottleneck class and
  missing-premise buckets.
- Batch diagnostics consume the canonical per-run assessment and write local
  reports over existing derivation runs.

## Operative Follow-On Steps

Implemented in the follow-on slice:

1. `--learner-proxy-dag` adds a leak-safe learner proxy-DAG memory payload to
   the learner view: grounded surface facts, learner-voiced derived facts,
   hypotheses, candidate conclusions, and answer candidates derivable from the
   learner board. It does not include authored proof paths, unreleased facts,
   premise ids, missing-premise ids, rule ids, release schedule, or fact arrays.
2. `--proxy-dag-pacing` adds an advisory proxy-DAG pacing signal for the
   director/tutor. It classifies the current learner DAG bottleneck into
   `hold_until_evidence_due`, `release_evidence`, `repair_uptake`,
   `prompt_intermediate_inference`, `prompt_assertion`, `complete`, or
   `continue`, without granting release or assertion authority.
3. `scripts/run-learner-proxy-dag-ab.js` runs the same world/script as control
   and proxy-memory treatment, then feeds both labels into the learner-DAG batch
   diagnostic. The first mock A/B report is:
   `exports/dramatic-derivation/learner-proxy-dag-ab/proxy-dag-ab-20260624/report.md`.

Mock A/B note: the deterministic mock learner does not read prompt prose as a
behavioral policy, so the first local A/B verifies plumbing and artifact shape
rather than estimating a behavioral effect. A real LLM A/B is the meaningful
next measurement.

## Real A/B Closeout

Real Lantern A/B run, 2026-06-24:

- Control label: `lantern-proxy-dag-real-20260624-control`.
- Proxy label: `lantern-proxy-dag-real-20260624-proxy`.
- Report:
  `exports/dramatic-derivation/learner-proxy-dag-ab/lantern-proxy-dag-real-20260624/report.md`.

Result:

- Both arms reached `grounded_anagnorisis` in 20 turns.
- Both arms had complete authored-path coverage, final secret entailed, and
  grounded assertion at turn 20.
- Both arms also produced one premature `lucky_leap` at turn 17, immediately
  after `p_key` but before `p_skiff`.
- The proxy arm recorded 40 proxy-DAG pacing rows: 30
  `hold_until_evidence_due` and 10 `repair_uptake`.

Interpretation:

- The learner proxy DAG works as a leak-safe, human-readable memory and
  inspection surface.
- Proxy memory plus advisory pacing does not by itself change the learner's
  assertion policy. The learner can still infer "key-holder equals lighter"
  before the presence premise lands.
- The missing mechanism is assertion discipline over the learner-visible
  closure, not a richer authored-DAG leak to the learner.

Gated follow-up:

- Label: `lantern-proxy-dag-gated-real-20260624`.
- Flags: `--learner-proxy-dag --proxy-dag-pacing
  --same-turn-assertion-affordance`.
- Three-run report:
  `exports/dramatic-derivation/learner-proxy-dag-ab/lantern-proxy-dag-real-20260624-with-gate/report.md`.
- Outcome: `grounded_anagnorisis` in 20 turns, no `lucky_leap`, no release
  deviations, and assertion only at turn 20 after `p_skiff` made the secret
  learner-visible and entailed.

Operational conclusion:

- Keep the learner proxy DAG as the learner's own public-record memory.
- Treat final-answer assertions as gated by the learner-visible closure when
  the proxy DAG is part of the treatment.
- Future proxy-DAG behavioral runs should include the explicit gated arm via
  `scripts/run-learner-proxy-dag-ab.js --include-gated-proxy`, while the
  two-arm control/proxy comparison should remain available for isolating the
  effect of memory/pacing alone.

## Tutor Learner-DAG Model Test

Follow-up test, 2026-06-24:

- Label: `lantern-tutor-learner-dag-real-20260624`.
- Flags: `--learner-proxy-dag --proxy-dag-pacing --tutor-learner-dag
  --same-turn-assertion-affordance`.

Result:

- The run reached `grounded_anagnorisis` in 20 turns.
- It had no `lucky_leap`, no release deviations, no missed releases, and no
  unscheduled releases.
- Cost was about `$0.1017` for 60 real calls.
- The result artifact contains 20 `tutorLearnerDagModel` rows.
- At turn 17, after the key premise entered the arc but before the presence
  premise landed, the tutor-side model reported coverage `0.6`, no answer
  candidate, no final entailment, and missing proof material by bucket only.

Interpretation:

- The tutor can receive a reconstructed model of the learner-owned DAG without
  receiving authored proof paths, path ids, rule ids, fact arrays, release
  schedule, or missing-premise ids.
- This model is useful as a teaching instrument: it tells the tutor what the
  learner currently owns and where the learner is short, while preserving the
  authored DAG as the external authority.
- The behavioral safeguard remains the assertion gate. The tutor model did not
  replace the learner's own proxy DAG or the mechanical proof gate.

## References

- TPTP derivations: https://tptp.org/UserDocs/QuickGuide/Derivations.html
- DRAT-trim: https://github.com/marijnheule/drat-trim
- FRAT: https://arxiv.org/html/2109.09665v3
- cvc5 Alethe: https://cvc5.github.io/docs/cvc5-1.0.0/proofs/output_alethe.html
- cvc5 LFSC: https://cvc5.github.io/docs/cvc5-1.0.0/proofs/output_lfsc.html
- cvc5 proof production: https://cvc5.github.io/docs/cvc5-1.0.0/proofs/proofs.html
- Natural deduction: https://plato.stanford.edu/entries/natural-deduction/
- W3C PROV-DM: https://www.w3.org/TR/prov-dm/
- Knowledge tracing: https://link.springer.com/article/10.1007/BF01099821
- Graph-based knowledge tracing: https://rlgm.github.io/papers/70.pdf
- CTAT example tracing:
  https://learnlab.org/example-tracing-tutors-intelligent-tutor-development-for-non-programmers/
