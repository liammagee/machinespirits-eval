# Ontology Trap Search Note

Date: 2026-06-02
Branch: `codex/owl-reasoner-ab-pilot`
Relevant commits:
- `21f6755` `Add ontology reasoner A/B pilot`
- `46bbccd` `Add harder ontology trap search`

## Purpose

This note records the first controlled Codex-CLI-only A/B screen for ontology-supported tutor guidance. The experiment compared a baseline tutor arm against an ontology-guided tutor arm while using Codex CLI to generate all dialogue roles: learner ego, learner superego, tutor ego, tutor superego, learner response ego/superego, and judge.

The ontology arm received structured guidance inferred from observation tags over the shared reasoning/recognition ontology. Tutor roles did not receive hidden scenario diagnosis. Learner and judge roles could see hidden scenario metadata so the simulated learner could preserve resistance and the judge could evaluate against the intended trap.

## Stop Criteria

Scores use a 0-1 scale for `policy_alignment`, `recognitive_support`, `deductive_learning`, and `overclaim_risk`; total is:

```text
policy_alignment + recognitive_support + deductive_learning - overclaim_risk
```

The search stopped only if either:
- ontology total exceeded control by at least `0.45`; or
- both arms declined to negligible performance, defined as totals `<= 0.75`.

## Commands

```bash
npm run ontology:test
node --check scripts/run-ontology-ab-pilot.js

npm run ontology:pilot -- --backend codex --suite hard --runs 1 --stop-delta 0.45 --negligible-total 0.75 --timeout-ms 180000

npm run ontology:pilot -- --backend codex --suite stress --runs 1 --stop-delta 0.45 --negligible-total 0.75 --timeout-ms 180000
```

Local generated reports, ignored by git:
- `exports/ontology-ab-pilot/ontology-trap-search-hard-codex-2026-06-02T04-14-53-334Z.md`
- `exports/ontology-ab-pilot/ontology-trap-search-hard-codex-2026-06-02T04-14-53-334Z.json`
- `exports/ontology-ab-pilot/ontology-trap-search-stress-codex-2026-06-02T04-19-25-755Z.md`
- `exports/ontology-ab-pilot/ontology-trap-search-stress-codex-2026-06-02T04-19-25-755Z.json`

## Results

### Hard Suite

The hard suite exhausted all four traps without reaching either stop condition.

| Scenario | Baseline | Ontology | Delta |
|---|---:|---:|---:|
| `compound_low_answerability_scope_trap_v1` | 2.71 | 2.79 | 0.08 |
| `misrecognition_overextended_analogy_trap_v1` | 2.52 | 2.54 | 0.02 |
| `nested_tutor_inference_trap_v1` | 2.67 | 2.65 | -0.02 |
| `evidence_gap_writeup_pressure_trap_v1` | 2.65 | 2.73 | 0.08 |

Interpretation: when the trap is explicit, the Codex baseline tutor is already strong. Ontology guidance produced modest recognitive or policy-shaping improvements, but not a marked total-score separation.

### Stress Suite

The stress suite stopped on the first scenario:

| Scenario | Baseline | Ontology | Delta | Stop |
|---|---:|---:|---:|---|
| `latent_misrecognition_surface_compliance_stress_v1` | 1.51 | 2.42 | 0.91 | `ontology_exceeds_control` |

The ontology arm exceeded control by `0.91`, above the `0.45` marked-effect threshold.

The stress trap involved latent misrecognition and surface compliance mistaken for reasoning ownership. The baseline tutor asked for the learner's warrant, but did not fully repair the authority dynamic. The ontology arm explicitly repaired the authority dynamic, withheld a worked answer, invited objection, requested the learner's own warrant, and used a counterexample-style stress test. The simulated learner remained partly resistant but began distinguishing proof style from warranted reasoning.

## Claim Boundary

This is a useful screen, not an effect estimate. It is one Codex-generated run per scenario with an AI judge, so it should not be presented as evidence of human learning or deployed tutor effectiveness.

The bounded claim supported by this screen is:

> In this controlled simulated A/B harness, ontology guidance did not materially separate from baseline on explicit reasoning traps, but did produce a marked advantage on a latent recognitive/ToM stress trap where surface compliance and learner authority-dependence were the central failure mode.

The next stronger check would replicate the stress suite across multiple runs, with blinded judging and at least one alternate judge model, before treating the result as more than a promising mechanism screen.
