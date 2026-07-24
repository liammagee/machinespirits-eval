# Proof-DAG verification and inspection

The Nocturne proof-DAG fixture has two optional external checks. They complement
the live JavaScript forward chainer; neither changes the evidence a learner is
entitled to use during a tutor session.

## What we verify

| Check | Invocation | What a pass means | What it does not mean |
| --- | --- | --- | --- |
| Lean positive certificate | `npm run derivation:lean-cert:check` | Every authored Nocturne proof path generates a Lean theorem that type-checks from its declared premises and ground rule applications to the authored conclusion. | It does not prove prefix non-entailment, underivability, or equivalence with the JavaScript closure algorithm. |
| Semantic-web projections | `npm run derivation:semantic-web:check` | The checked-in RDF/JSON-LD/PROV fixture is current; authored, learner, and tutor graphs conform to SHACL; public source objects pass the pre-serialization hidden-identifier audit. | It does not prove the tutor's live entitlement decision or validate an arbitrary saved session. |
| Adversarial redaction regression | `node --test tests/dramaticDerivationProxyDagMemory.test.js` | Injecting an authored identifier such as `p_hand` makes the public SHACL and source-object checks fail. The positive fixture also contains substantive public learner facts. | It is a bounded regression test, not a general information-flow proof. |

Run both external checks before reviewing or publishing the fixture:

```bash
npm run derivation:lean-cert:check
npm run derivation:semantic-web:check
```

The semantic check is intentionally a stale-artifact check. If the source
projection changes, refresh it explicitly with `npm run derivation:semantic-web`
and review the diff before running the check again.

## Use it inside tutor-stub

Launch the normal tutor-stub, then use `/proof` without leaving the session:

```text
/proof
/proof check lean
/proof check semantic
/proof inspect authored
/proof inspect learner
/proof inspect tutor
/proof paths
/proof export
```

`/proof` runs both external checks. `inspect` first reruns the semantic check,
then shows the selected graph's authority level, quad count, SHACL result,
content counts, and raw artifact path. `export` is the only semantic-web form
that refreshes generated files. The Lean checker rewrites its deterministic
generated certificate before checking it, so `/proof` is conservatively
classified as a file-writing command.

The command always names its scope: it examines the deterministic
`world_001_nocturne` fixture, even when the active tutor session uses another
world. Use `/analysis technical` to inspect the current session's live learner
DAG and tutor advisory model. This separation prevents a fixture certificate
from being mistaken for evidence about the live conversation.

## Inspect the raw artifacts

The generated files live under
`tools/proof-dag-semantic-web/Generated/World001Nocturne/`:

- `authored.ttl` and `authored.jsonld` contain the private authored truth,
  premise/rule/path identifiers, and PROV rule applications;
- `learner-proxy.ttl` and `learner-proxy.jsonld` contain only the learner's
  public grounded, voiced, hypothetical, and candidate record;
- `tutor-model.ttl` and `tutor-model.jsonld` contain the public-only advisory
  tutor projection and aggregate coverage/bottleneck fields;
- `proof-dags.trig` contains all three named graphs for graph-aware tools; and
- `validation-report.json` records deterministic SHACL results and quad counts.

Start with `validation-report.json`, then compare the learner and tutor files
against `authored.ttl`. Authored identifiers and the secret are expected in the
authored graph and forbidden in both public projections. The governing shapes
are `tools/proof-dag-semantic-web/shapes/authored.ttl` and
`tools/proof-dag-semantic-web/shapes/public-projections.ttl`.

The generated Lean source is
`tools/proof-dag-lean/ProofDag/Generated/World001Nocturne.lean`. Its theorem
names correspond to the four authored proof paths printed by the checker.

## Runtime boundary

The source of truth for live learner entitlement remains
`services/dramaticDerivation/chainer.js`. A stronger formal claim would require
formalizing the finite Horn-rule closure procedure and proving the JavaScript
implementation equivalent to it. Until then, describe the Lean layer as a
positive authored certificate and the RDF/SHACL layer as an export, structure,
provenance, and redaction check.
