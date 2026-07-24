# Proof-DAG Semantic Web Artifacts

This optional tooling exports the dramatic-derivation proof layers as RDF,
JSON-LD, and PROV-O. It complements the Lean positive certificates and does
not replace `services/dramaticDerivation/chainer.js` as the live learner
entitlement gate.

The deterministic Nocturne fixture contains three authority-separated graphs:

- `authored`: the private world DAG, including premise/rule/path identifiers
  and the positive proof applications that reach the secret;
- `learner-proxy`: the learner's public-only grounded, voiced, hypothetical,
  and candidate record; and
- `tutor-model`: the tutor's advisory projection of that public learner record,
  plus aggregate coverage and bottleneck information.

Generate the checked-in fixture:

```bash
npm run derivation:semantic-web
```

Verify that the generated files are current and all three graphs conform to
their SHACL shapes:

```bash
npm run derivation:semantic-web:check
```

`shapes/authored.ttl` checks the authored proof structure and PROV links.
`shapes/public-projections.ttl` checks the learner/tutor contracts and rejects
authored premise, rule, path, secret, fact-array, or release-schedule fields.
The exporter also audits the source objects before RDF serialization, so an
internal identifier cannot be hidden inside a public text value.

`Generated/World001Nocturne/` is a reproducible fixture, not evaluation
evidence and not a new paper claim. Its validation report is deterministic and
contains no paid-model output or timestamps.

For the complete verification matrix, raw-artifact inspection order, and the
in-session tutor-stub `/proof` commands, see
[`docs/proof-dag-verification-and-inspection.md`](../../docs/proof-dag-verification-and-inspection.md).
