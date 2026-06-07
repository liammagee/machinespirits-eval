# Public Causal Bridge Criterion

Date: 2026-06-05

Source run: `exports/discursive-replay-loops/discursive-replay-loop-heldout-stratified-fixed-20260605`

## Boundary

This note formalizes a pre-generation criterion for future counterfactual replay loops. It does not claim that the original tutor adapted online. It asks what public evidence is needed before a rewritten transcript should be sent to a blind panel as a candidate for peripeteia-induced adaptation rather than recognitive form alone.

## Contrast

The fixed held-out replay produced 9/9 final recognition-majority outcomes but only 7/9 strict origin passes. The two capped failures therefore isolate the missing mechanism boundary: public recognition can be repaired without making critics attribute the learner's reframe to a tutor peripeteia-linked strategic move.

Strict passes shared a visible bridge:

| Source item | Arm | Final origin | Public bridge pattern |
| --- | --- | ---: | --- |
| `20260527T044802Z-i01 / peripeteia-only / T15` | `peripeteia-only` | 5/5 | Public obstruction makes the old checklist/number-look insufficient; tutor introduces a release/hold check; learner uses release only after all fields are visible. |
| `20260529T023023Z-i01 / peripeteia-only / T18` | `peripeteia-only` | 4/5 | Covered/rotated arrows expose a failure of arrow-direction naming; tutor changes the public test to actor-plus-force sentence; learner uses that representation. |
| `20260527T105617Z-i03 / peripeteia-only / T24` | `peripeteia-only` | 3/5 | Tempo is blocked as the settling check; tutor changes the device to the lower-number/tile unit test; learner applies the unit check. |
| `20260527T044802Z-i01 / none / T15` | `none` | 5/5 | Covered tile positions make number appearance insufficient; tutor shifts the task to slot/field visibility; learner contrasts number-look with position. |
| `20260527T044802Z-i02 / none / T24` | `none` | 3/5 | Speed-card testing fails to decide meter; tutor swaps to box/note-value checking; learner says speed did not settle signature and uses the box check. |
| `20260527T044802Z-i02 / routine / T18` | `routine` | 5/5 | Motion cue is moved away from the arrows; tutor turns the moved cue into a contact-source test; learner identifies the force by the changed public relation. |
| `20260527T044802Z-i02 / routine / T24` | `routine` | 3/5 | Blank tempo slip is separated from the 3/4 boxes; tutor makes placement rather than tempo the check; learner says no tempo mark belongs. |

The two failures reached recognitive form but lacked the same causal bridge:

| Source item | Arm | Final origin | Failure pattern |
| --- | --- | ---: | --- |
| `20260527T044802Z-i02 / none / T18` | `none` | 1/5 | The tutor prompts the learner to say what stayed usable after a cue moved, but the move reads as a reminder or smoothing prompt. The learner's reframe is public, but critics can read it as organic drift because the tutor has not visibly changed the public test enough. |
| `20260527T044802Z-i01 / routine / T15` | `routine` | 0/5 | The tutor asks the learner to read the field/window first, but this stays too close to ordinary continuation of the same task. The learner's reframe is good recognitive form, but the tutor move does not become an event that makes the old warrant fail. |

## Criterion

A transcript may be treated as a peripeteia-origin candidate only when the public transcript contains all six bridge components:

1. Public obstruction: a visible event, constraint, or learner pressure makes the old warrant/check unusable or insufficient.
2. Old-check blockage: the transcript names why the old check no longer settles the case.
3. Tutor mechanism change: the tutor responds by changing the public task, device, test, representation, or material arrangement, not merely by reminding, restating, or smoothing the same check.
4. Learner use of changed test: the learner then uses that changed public test and connects it to the final self-reframe.
5. Device specificity: the changed test is publicly necessitated by the obstruction, not merely a useful generic scaffold the tutor could have introduced at any time.
6. Old-warrant misclassification: the old public warrant visibly misclassifies, wrongly predicts, or contradicts at least one public case before the tutor's new relation becomes available.

Recognition without this bridge is not origin evidence. It remains recognitive-form evidence and should be labelled as organic or ambiguous until the bridge is repaired.

## Implementation Rule

Future replay generations should include a `public_causal_bridge` ledger object for each candidate move:

```json
{
  "public_obstruction": "public event/quote that makes the old check fail or become insufficient",
  "old_check_blocked_by": "what public constraint blocks the old warrant",
  "tutor_mechanism_change": "new public task/device/test/representation the tutor introduces or changes",
  "learner_uses_changed_test": "public learner action or utterance using the changed test",
  "device_specificity": {
    "obstruction_specific_constraint": "what this obstruction makes unavailable that a generic scaffold would not address",
    "why_this_device_not_generic": "why this changed test/device is forced by this obstruction rather than merely helpful",
    "critic_visible_link": "public text that lets a blind critic see the necessity link"
  },
  "old_warrant_misclassification": {
    "old_public_rule": "the public rule/check the learner was relying on",
    "counterexample": "the public case/event that exposes the old rule as wrong or contradictory",
    "wrong_prediction_or_contradiction": "what the old rule would misclassify or fail to predict",
    "new_relation_required": "the new relation/test required to resolve the counterexample",
    "learner_acknowledges_rule_failure": "public learner utterance/action that owns the old rule's failure"
  },
  "bridge_failure_risk": "none|low|medium|high"
}
```

The local checker should score both `public_causal_bridge` and `device_specificity` before panel escalation. Low bridge or specificity scores should return `revise_again`, not `panel_survivor`, because the repair is still cheap and local.

## Ontology Status

The discursive-game ontology now represents this as `ms:PublicCausalBridgeEvidence`. `ms:PeripeteiaOriginSurvivor` requires recognitive form, blind origin attribution, public causal bridge evidence, non-generic device-specificity evidence, and old-warrant misclassification evidence. This prevents the ontology from treating recognitive form plus critic origin votes as sufficient when the public mechanism is merely a useful scaffold or stock domain relation.

## Next Generation Rule

Before generating again, update prompts or policy memory so Codex/Claude/Gemini rewrites are instructed to create a public obstruction and changed test rather than a smoother tutor reminder, and to show why the changed test is forced by that obstruction rather than generically helpful. For hard-negative items such as `none / T18`, the redesign additionally requires a public counterexample where the old warrant makes the wrong call. The two final failures should be rerun only after this bridge, specificity, and old-warrant misclassification gate is active.
