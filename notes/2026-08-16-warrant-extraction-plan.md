# Plan: extract the warrant layer as a neutral service

**Date:** 16 August 2026.
**Card:** `tutor-stub-cell-reconciliation`.
**State:** design only; extraction is blocked.
**Source check:** re-derived from the code at
`9ea57fb40b78f0afceba3910758b0dc390c09e82`.

## Block

The warrant validation card
`adaptive-warrant-public-obligation-ledger-and-inquiry-termin` is
`active`. No extraction step may start until that card closes, or its
owner gives a new written ruling that ends the block.

This note adds no runtime code. It does not change a study script, a
test, any `services/adaptiveWarrant*.js` file, any
`services/tutorStub*.js` file, or anything under
`docs/adaptation-refinement/`.

## Imports that exist now

The allowlist in `tests/warrantStubDependencyBoundary.test.js` names
two back-imports. A new scan of every static and dynamic import in the
two file families found the same two warrant-to-stub edges:

- `adaptiveWarrantDeliveryContract.js` imports
  `buildTutorStubSimplifiedRecoveryConfiguration` from
  `tutorStubGuardRecovery.js`.
- `adaptiveWarrantDeliveryContract.js` imports
  `buildTutorStubSpeakingResponseConfiguration` from
  `tutorStubPerformanceObligationContract.js`.

The reverse direction is larger. Four stub files have twelve import
edges into eight warrant modules:

- `tutorStubPublicLearnerAnalysis.js` imports from
  `adaptiveWarrantSemanticEvents.js`:
  `ADAPTIVE_WARRANT_SEMANTIC_ACTION_EXECUTORS`,
  `ADAPTIVE_WARRANT_SEMANTIC_ACTION_MODES`,
  `ADAPTIVE_WARRANT_SEMANTIC_ACTIONS`,
  `ADAPTIVE_WARRANT_SEMANTIC_CONFIDENCE`,
  `ADAPTIVE_WARRANT_SEMANTIC_SENTINEL_RULE`,
  `ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACT_CONTRACTS`,
  `ADAPTIVE_WARRANT_SEMANTIC_SPEECH_ACTS`,
  `ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS`,
  `ADAPTIVE_WARRANT_SEMANTIC_UNCERTAINTY_REASONS`,
  `ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES`, and
  `validateAdaptiveWarrantSemanticExtraction`.
- `tutorStubResponseConfigurationSelectionRuntime.js` imports
  `projectAdaptiveWarrantEvidenceAvailability` from
  `adaptiveWarrantInquiryCompletion.js`, plus
  `applyAdaptiveWarrantSourcePatch` and
  `buildAdaptiveWarrantSelectorApplicationAudit` from
  `adaptiveWarrantDeliveryContract.js`.
- `tutorStubTurnProgressionContract.js` imports
  `auditAdaptiveWarrantPublicObligationDelivery` from
  `adaptiveWarrantPublicObligationLedger.js`.
- `tutorStubWarrantGate.js` imports
  `classifyLearnerSignal`, `buildAdaptiveWarrantDecisionInputSnapshot`,
  `evaluateWarrant`, `isAdaptiveWarrantCommitmentTransition`, and
  `REPETITION_DEFEATER_THRESHOLD` from
  `adaptiveWarrantGateCore.js`; `projectAdaptiveWarrantDivergence` from
  `adaptiveWarrantDivergence.js`; `hashAdaptiveWarrantJson` from
  `adaptiveWarrantDeliveryContract.js`;
  `createAdaptiveWarrantActionContractTracker` and
  `getAdaptiveWarrantActionContract` from
  `adaptiveWarrantActionContracts.js`;
  `assessAdaptiveWarrantInquiryCompletion` and
  `projectAdaptiveWarrantEvidenceAvailability` from
  `adaptiveWarrantInquiryCompletion.js`;
  `buildAdaptiveWarrantObligationDirective` from
  `adaptiveWarrantPolicy.js`;
  `createAdaptiveWarrantPublicObligationLedger` from
  `adaptiveWarrantPublicObligationLedger.js`; and
  `compileAdaptiveWarrantSemanticSignal` from
  `adaptiveWarrantSemanticEvents.js`.

No dynamic import or `export ... from` edge adds to this list. The
survey's older claim that four warrant files import stub files is no
longer true. The live code and the ratchet both show one warrant file
with two back-imports.

## Neutral module

Use one public entry point, provisionally
`services/adaptiveWarrant/index.js`. Files inside that directory may
split the work by concern, but callers import only the public entry
point. The neutral code must not import `tutorStub*`, `adaptiveTutor/`,
the evaluation store, a model bridge, or a study script.

The public entry point should expose one stateful engine:

```js
const engine = createAdaptiveWarrantEngine({
  actionContracts,
  challengeResistanceSelectable,
});

engine.assessTurn(normalizedDecisionInput);
engine.recordOutcome(normalizedOutcome);
engine.snapshot();
```

`normalizedDecisionInput` carries the turn, the public learner text or
semantic events, a host-made progress observation, the held and proposed
action families, evidence availability, closure facts, and the prior
public outcome. `normalizedOutcome` carries the delivered action family,
public tutor text, released evidence, pacing, and a list of host-made
defeaters. The neutral engine does not read a proof-DAG object, a stub
response configuration, or an adaptive-runner state object.

The decision returns the warrant basis, decision kind, contract state,
public-obligation state, inquiry state, recommended action family,
stance hint, directive, input snapshot, and digest. It does not apply a
response patch or generate text. Each host keeps that authority.

### Exports that move

All public exports from `adaptiveWarrantGateCore.js` move behind the
neutral entry point:

- `ADAPTIVE_WARRANT_CORE_SCHEMA`,
  `ADAPTIVE_WARRANT_DECISION_INPUT_SCHEMA`,
  `REPETITION_DEFEATER_THRESHOLD`,
  `ACCUMULATED_TROUBLE_THRESHOLD`,
  `REGISTER_ESCALATION_THRESHOLD`, `CONCEPTUAL_STALL_TURNS`,
  `isAdaptiveWarrantCommitmentTransition`,
  `buildAdaptiveWarrantDecisionInputSnapshot`,
  `classifyLearnerSignal`, and `evaluateWarrant`.

All public exports from `adaptiveWarrantActionContracts.js` move:

- `ADAPTIVE_WARRANT_ACTION_CONTRACT_SCHEMA`,
  `ADAPTIVE_WARRANT_ACTION_CONTRACT_OUTCOME_SCHEMA`,
  `ADAPTIVE_WARRANT_ACTION_CONTRACT_TRACKER_SCHEMA`,
  `ADAPTIVE_WARRANT_EVIDENCE_REQUEST_SCHEMA`,
  `ADAPTIVE_WARRANT_ACTION_FAMILY_CONTRACTS`,
  `getAdaptiveWarrantActionContract`,
  `classifyAdaptiveWarrantEvidenceRequest`, and
  `createAdaptiveWarrantActionContractTracker`.

All public exports from `adaptiveWarrantPublicObligationLedger.js`
move:

- `ADAPTIVE_WARRANT_PUBLIC_SPEECH_ACT_SCHEMA`,
  `ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_SCHEMA`,
  `ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_LEDGER_SCHEMA`,
  `ADAPTIVE_WARRANT_PUBLIC_OBLIGATION_DELIVERY_SCHEMA`,
  `classifyAdaptiveWarrantPublicSpeechAct`,
  `auditAdaptiveWarrantPublicObligationDelivery`, and
  `createAdaptiveWarrantPublicObligationLedger`.

The pure runtime support also moves: divergence projection, inquiry
completion, semantic-event validation and compilation, the obligation
directive, and repair-policy selection. Repair-policy selection must
take its options as arguments. The neutral module must not read the
stub-only `TUTOR_STUB_WARRANT_CHALLENGE_RESISTANCE` setting.

During the move, the old module paths can re-export the neutral exports.
Those files are short-lived compatibility shells, not a second source
of policy.

### Code that stays with a host

Every public export of `tutorStubWarrantGate.js` stays on the stub side.
Its mode setting, session attachment, turn restoration, final-authority
rule, response-configuration projection, and outcome recording are stub
work. `createTutorStubWarrantGate` becomes a wrapper around the neutral
engine but keeps its public API.

All exports now in `adaptiveWarrantDeliveryContract.js` stay with the
stub delivery path and move under a `tutorStub*` file name. They audit
stub selector patches, stub response configurations, speaking
transitions, and simplified recovery. This is where the two current
back-imports belong. The two builders remain in
`tutorStubGuardRecovery.js` and
`tutorStubPerformanceObligationContract.js`.

The reader, retake, semantic preflight, semantic annotation, and study
integrity modules stay outside the neutral runtime. They test or run a
study; they do not decide a turn.

`services/adaptiveTutor/tutorStubActionAdapter.js` also stays a host
adapter. It knows the adaptive runner's action registry, task fields,
register fields, and support levels. It must not move those ideas into
the neutral service.

## Calls from each host

The stub wrapper converts its proof-DAG and release state into the
normalized progress and closure fields. It calls `assessTurn`, then
uses the existing `off | observe | active` rule. Only the stub wrapper
may apply a response-configuration patch, enforce final authority, or
run the speaking and recovery audits. After delivery it converts its
uptake, repetition, guard, and pacing audits into `recordOutcome`.

The adaptive runner converts its external learner state and selected
pedagogical action through an adapter beside
`tutorStubActionAdapter.js`. It calls the same `assessTurn` and
`recordOutcome` methods. It then maps the returned family to its own
typed action. It does not call a stub response builder or a stub delivery
audit.

The existing adapter is only a shape precedent. It maps twenty adaptive
actions into five move families. The warrant contract catalogue has
thirteen different action families. A human-approved map between those
sets is needed before the adaptive runner can call the neutral engine.
The migration must not treat equal-looking names as equal policy.

## Migration steps after the block closes

Each numbered step is one small commit and can be reverted on its own.

1. Recheck that the blocking card has closed. Record a clean source SHA,
   the source-closure hash, and green baseline checks. Stop if any one
   differs from the warrant line's closeout record.
2. Add the neutral directory, public entry point, and an import-boundary
   check. Copy no caller yet. The new boundary rejects imports from
   `tutorStub*`, `adaptiveTutor/`, model bridges, stores, and scripts.
3. Move semantic-event code behind the entry point. Keep the old path as
   a re-export. Add old-path versus new-path fixture checks.
4. Move inquiry-completion code in the same way. Check every projected
   availability and completion record byte for byte.
5. Move the public-obligation ledger. Keep the old path as a re-export
   and check every ledger snapshot byte for byte.
6. Move the action contracts. Keep the old path as a re-export and check
   every tracker outcome byte for byte.
7. Move policy and divergence. Make the challenge-resistance option
   explicit. Keep the old paths as re-exports.
8. Move gate-core code. Keep the old path as a re-export and check every
   decision field and digest.
9. Add `createAdaptiveWarrantEngine`. Feed the same frozen inputs to the
   old stub gate and the new engine. Do not switch a live caller until
   decision, ledger, contract, and snapshot parity are exact.
10. Switch the offline replay to the neutral entry point. Keep the live
   stub on the old wrapper for this step. Exact live/offline parity must
   remain zero-mismatch.
11. Change `tutorStubWarrantGate.js` into the host wrapper described
   above. Switch the other stub imports to the neutral entry point.
   Leave delivery and final authority on the stub side.
12. Add the human-approved adaptive action-family map and a small adaptive
   runner adapter. Switch only that caller. Keep the existing default
   behavior and activation rules unchanged.
13. Add a stub-named delivery-audit module. Switch the stub runtime,
    offline study, and their tests to it. Leave
    `adaptiveWarrantDeliveryContract.js` unchanged and unused for one
    step so the current ratchet stays green.
14. Last, delete the unused delivery-contract file and change
    `ALLOWED_BACK_IMPORTS` to an empty object in
    `tests/warrantStubDependencyBoundary.test.js`. Extend that test to
    scan the new neutral directory. This one commit removes both allowed
    back-imports and proves that the ratchet has reached zero.

## Checks at every migration step

Run all three groups after every step:

1. `npm run test:hermetic` — the whole isolated suite, with no production
   database or log writes.
2. `node --test tests/warrantStubDependencyBoundary.test.js` — no new
   back-import and no stale allowlist row.
3. `node --test tests/adaptiveWarrantGate.test.js tests/adaptiveWarrantBaselineStudy.test.js`
   — this includes the live/offline public-obligation, structured replay,
   resume, input-digest, ledger, and delivery-application parity checks.

The adaptive-runner step also runs
`node --test tests/tutorStubTypedActionAdapter.test.js`. No paid call,
study run, database migration, or historical artifact rewrite belongs in
this migration.

## Why no live file changes now

The current task adds this note only. The future steps that edit warrant,
stub, adapter, test, or study files begin after the block check in step 1.
Until then, the current source paths, hashes, import graph, ratchet
allowlist, and study entrypoints stay byte-for-byte unchanged.

## Open questions for the human

1. Is a closed card enough to unlock extraction, or must the warrant
   owner also name the sealed closeout SHA?
2. Should the neutral entry point stay in this repo, or move into the
   in-housed `tutor-core` module after the first extraction?
3. What is the approved map from the adaptive runner's twenty action
   types and five move families to the warrant catalogue's thirteen
   action families?
4. Does the neutral service own semantic-event compilation, or accept
   only an already compiled public signal from each host?
5. Which host owns the challenge-resistance setting after the neutral
   policy stops reading the `TUTOR_STUB_*` environment variable?
6. Do the current warrant schema names stay stable through the move, or
   does the neutral entry point need a new schema version with explicit
   compatibility readers?
7. How long should the old import paths remain as compatibility
   re-exports after both hosts use the neutral entry point?
