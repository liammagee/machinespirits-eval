# Resistance–Action–Register Conservation Protocol

Status: active integration guard, 2026-08-19.
Workplan item: `resistance-action-register-integration`.

This protocol protects the established tutor-stub results while resistance
profiles, pedagogical actions, and tonal registers are consolidated. It does
not make a new empirical claim and it authorizes no model call.

## Frozen public baseline

The immutable pre-integration public checkpoint is the annotated tag
`experiment/resistance-action-register/pre-integration/freeze-2026-08-18`,
which dereferences to commit `45985541188bc935a4ef9a4893d9b65451f0fa61`.
The tag is a restoration point, not a substitute for the paper or the sealed
private evidence.

The guarded learner executable lineage was reconciled locally through merge
commit `5fa2e50e`. Its source tip remains
`8d5991248f6f81b609a71c9e925a2b4fc4440d66`. Intermittent HTTPS transport could
not upload that full 72-commit lineage as a Git pack, so the remote integration
branch uses an explicitly labelled second-parent snapshot at `730ee1ed`: its
tree is byte-identical to the source tip, and remote merge `2ef74ed5` has the
same tree as the validated local merge. This is transport provenance, not a
claim that the snapshot reproduces the source commit history. The original
branch and worktree remain protected until the full lineage is archived under
the branch archive policy.

## Protected result contracts

The following are conservation constraints, not targets to improve in place:

| Contract | Canonical surface | Protected reading |
| --- | --- | --- |
| Normative/descriptive warrant mechanism | Paper §6.25; `adaptive-warrant-outcome-study` | Typed public events feed descriptive state; the gate compares that state with normative obligations and licenses a typed tutor action. In the low-agency main block, deference breaks were 19/24 gated, 10/24 bare, and 11/24 standing-permission; decision correctness was 87.5%, 64.8%, and 68.3%. The registered causal path for the break result failed: always-on steering, not the timed challenge, carried it. The challenge family was nevertheless load-bearing for correctness in the decomposition, 83.80% versus 71.84% steering-only. |
| Low-agency resistant learner | Profile ID `low_agency`; Paper §6.25 | Preserve the permission-seeking contract, the three-condition arm meanings, the failure and attribution statements, the development-tier boundary, and the no-human-learning boundary. |
| Overconfident resistant learner | Profile ID `overconfident`; Paper §6.26; `guarded-learner-outcome-study` | Preserve the 72-dialogue / 575-case provenance. The warranted-shift result is post-hoc and remains 40.8% gated, 31.2% standing-permission, and 17.8% bare. P3 remains 7/66 delivered versus 13/152 shadow and must always be called a *late-scored registered endpoint, disclosed instrument amendment*. Its two-point margin is directional only: no effect-size, significance, stronger causal, or human-learning claim. |

The profile IDs and their meanings are stable compatibility keys. New profiles
such as bored and frame-defiant extend the registry; they do not rename,
generalize away, or silently alter either established profile.

## Authority order

When sources appear to disagree, use this order:

1. Paper §§6.25–6.26 and the two closed workplan cards delimit what may be
   claimed.
2. Sealed registrations, reviewer rulings, manifests, and scorers delimit how
   each number was produced.
3. The frozen public baseline and merged Git ancestry restore executable code
   and public provenance.
4. The private archive restores raw dialogues, reader material, and score
   artifacts. It must not be replaced by a reconstructed result.

At the integration checkpoint the local private repository is intact at
`b3c81dc9c3ba1e9aead49a9cd284e063c7601e52`, including guarded evidence closure
commit `3ecc8fb6af58e955f255fecd90dbcd59dfe69ba3`. Its normal remote branch is
still behind because HTTPS timed out on the historical binary pack, and the
private release endpoint accepted provenance JSON but stalled on binary
payloads. The private draft release is explicitly marked `PENDING`; it is not a
completed backup. Therefore the private checkout, the guarded source worktree,
and their source branches must not be deleted until an independently verified
remote binary backup exists.

## Change protocol

Every refactor that touches resistance detection, learner profiles, warrant
logic, action selection, or register realization follows these gates:

1. Add characterization coverage before changing an established path.
2. Introduce the shared typed `PedagogicalMove` boundary alongside the existing
   outputs. Register remains a downstream realization choice, never the action
   or the warrant itself.
3. Run old and new projections in shadow on the established fixtures. Record
   mismatches; do not overwrite the old trace during comparison.
4. Require parity on profile identity, arm assignment, warrant basis, selected
   action family, and protected result labels before switching a consumer.
5. Keep backward readers for historical trace labels and schemas.
6. Remove an old path only after parity is committed, the full regression gate
   passes, and the workplan records the deletion decision.
7. Never re-run, re-score, or rewrite an established result to make it fit the
   new abstraction. A changed instrument or outcome requires a new registration
   and a new result surface.

The Phase 3 live observer is inside these bounds. It runs the typed projection
before register normalization, then records the final legacy action/register
pair and its public audit. It cannot select or replace either value, and any
later action-family override is preserved as an explicit mismatch rather than
being backfilled into the earlier move. The `low_agency` and `overconfident`
fixtures remain the conservation authority; the held-out bored and frame-
defiant axes add prospective shadow warrants without changing those fixtures.

## Required local gate

No paid call is involved in this gate:

```bash
npm run refs:check
npm run wp:source-check
node scripts/generate-baseline-manifest.js --check
node --test tests/resistanceActionRegisterConservation.test.js
npm run test:hermetic -- --suite root --test-concurrency 4
npm run test:core
```

Any missing profile, changed protected number, dropped qualifier, non-portable
guarded evidence binding, managed-ref failure, or unexplained shadow mismatch
blocks the integration. A future empirical run additionally needs its own
registration, executable endpoint preflight, budget, committed GO note, and
explicit human approval.
