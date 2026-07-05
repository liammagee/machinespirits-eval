# Proof-DAG Lean Certificates

This is an optional Lean/Lake project for checking authored dramatic-derivation
proof-DAG certificates. It is deliberately separate from the live JavaScript
forward chainer in `services/dramaticDerivation/chainer.js`.

Current scope:

- Lean version pinned in `lean-toolchain`.
- No Mathlib dependency.
- Generated Nocturne fixture certificate:
  `ProofDag/Generated/World001Nocturne.lean`.
- Checked from the repo root with:

```bash
npm run derivation:lean-cert:check
```

What this proves:

- Each authored Nocturne proof path has a Lean-checkable positive proof skeleton
  from its listed premise facts and ground rule applications to the secret.
- Generated proof steps type-check under Lean, so malformed certificate wiring
  fails before publication.

What this does not prove:

- It does not replace the runtime JS entitlement gate.
- It does not prove prefix non-entailment or underivability.
- It does not prove the JS closure algorithm complete. That would require a
  separate formalization of the finite Horn-rule closure procedure.
