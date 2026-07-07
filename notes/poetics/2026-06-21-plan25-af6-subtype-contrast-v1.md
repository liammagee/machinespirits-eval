# Plan 2.5 AF6 subtype contrast v1

Date: 2026-06-21

## Purpose

This is the next experimental move after the AF6 two-gate replay negative.

The old question was too coarse:

> Does the adaptive two-gate tutor move cause recognition?

The next question is narrower:

> Can the apparatus keep three origin mechanisms separate under the same frozen learner pressure?

Those mechanisms are:

- `evidence_route`: the tutor supplies a public route that causes the learner to compute and replace the old claim.
- `organic_evidence_route`: the learner self-generates the route from the frozen pressure without a tutor mechanism.
- `refusal_authority_ownership`: the tutor withholds substantive repair and the learner reframes ownership of the bad submitted claim.

## Tracked preflight packet

- `config/poetics-calibration/plan25-af6-subtype-contrast-v1/frozen-prefix-T04-through-learner-pressure.txt`
- `config/poetics-calibration/plan25-af6-subtype-contrast-v1/branch-spec.yaml`

The prefix is the same AF6 source pressure used in the replay demarcation:

- source battery: `full-sonnet-low-protocol-control-battery-mt3-head69fc-20260620`
- seed: `2026062011`
- source item: `T04`

## Branches

`evidence_route_reframe_gate` is a repaired evidence-route arm. It keeps the two-gate AF6 route but requires the learner to answer in old-claim / Gate A / Gate B / replacement-claim order. This tests whether the evidence route can produce re-reading rather than only actional calculation.

`organic_cold_deferral_control` is a no-mechanism arm. It provides no evidence route, no ownership demand, and no refusal-authority hook. If recognition appears here, it is evidence that the frozen learner pressure alone can still produce organic recognition.

`refusal_authority_ownership_probe` is no longer pretending to be an inert control. It deliberately tests whether authority/refusal pressure creates its own ownership mechanism without providing any AF6 metric route.

## Promotion rule

Run order:

1. Mock replay, zero cost, to verify transcript rendering and forbidden-term audits.
2. Cheap live replay with the existing prefix harness.
3. Only if the cheap live replay separates subtypes cleanly, consider a paid fresh battery.

Stop before paid spend if:

- the evidence-route arm is only `evidence_route_action_only`;
- either non-evidence branch leaks metric-repair vocabulary;
- cold deferral produces tutor-induced attribution;
- refusal-authority collapses into evidence-route attribution.

This remains diagnostic sidecar work, not a canonical-paper effect estimate.

## Execution notes

Mock preflight:

```bash
node scripts/replay-plan25-prefix-branches.js \
  --design config/poetics-calibration/plan25-af6-subtype-contrast-v1/branch-spec.yaml \
  --out-dir exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-subtype-contrast-v1/mock-replay \
  --mock --score-mock --force
```

Result: pass. All three transcripts render, the Phase-2 mock scorer accepts them, and the forbidden-term audit applies at the intended scope:

- `evidence_route_reframe_gate`: no forbidden audit.
- `organic_cold_deferral_control`: tutor-only forbidden audit.
- `refusal_authority_ownership_probe`: full suffix forbidden audit.

Cheap live replay first attempt:

```bash
node scripts/replay-plan25-prefix-branches.js \
  --design config/poetics-calibration/plan25-af6-subtype-contrast-v1/branch-spec.yaml \
  --out-dir exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-subtype-contrast-v1/live-replay-codex-learner-codex-critic-20260621 \
  --live-learner --learner-model codex --score --score-model codex --score-concurrency 1 --force
```

Result:

| Branch | Form | Origin | Subtype | Reading |
|---|---:|---:|---:|---|
| `evidence_route_reframe_gate` | flat | none | `evidence_route_action_only` | The learner follows the route but does not recohere the earlier self-position strongly enough. |
| `organic_cold_deferral_control` | flat | none | `evidence_route_action_only` | The learner organically regenerates the metric worry, but the critic does not score recognition. |
| `refusal_authority_ownership_probe` | recognition | organic | `refusal_authority_ownership` | The learner withdraws/owns the claim, but tutor-mechanism scores stay below induced-origin threshold. |

The first live replay also exposed a harness/spec problem: `organic_cold_deferral_control` must allow learner-side organic metric repair, while `refusal_authority_ownership_probe` must still forbid metric-route leakage. The harness now supports `forbidden_audit_scope: tutor|learner|suffix`, and the subtype classifier recognizes withdrawal/packet-ownership language.

Diagnostic redress replay:

```bash
node scripts/replay-plan25-prefix-branches.js \
  --design config/poetics-calibration/plan25-af6-subtype-contrast-v1/branch-spec.yaml \
  --out-dir exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-subtype-contrast-v1/live-replay-codex-learner-codex-critic-redress1-20260621 \
  --live-learner --learner-model codex --score --score-model codex --score-concurrency 1 \
  --allow-forbidden-suffix --force
```

Result:

| Branch | Form | Origin | Subtype | Forbidden audit |
|---|---:|---:|---:|---|
| `evidence_route_reframe_gate` | flat | none | `evidence_route_action_only` | none |
| `organic_cold_deferral_control` | flat | none | `evidence_route_action_only` | none under tutor-only audit |
| `refusal_authority_ownership_probe` | flat | none | none | `class distribution`, `baseline` |

Interpretation:

- The repaired evidence-route tutor move repeatedly produces actional calculation/claim-bounding without recognized self-reframe.
- The frozen learner pressure repeatedly regenerates metric concern even under cold deferral, but the cheap Codex critic does not treat these as recognitive closure.
- The refusal-authority branch is unstable as a clean subtype probe: when it moves ownership, it tends to import metric-route language; when hardened, it can remain flat.

Stop rule outcome:

Do not promote this to a paid full-fidelity battery. The cheap screen failed the required separation: the evidence-route arm did not clear `evidence_route`, and the refusal-authority probe is not cleanly separable from metric-route leakage. The next substantive design would need a different prefix, likely one where the visible table contains enough concrete counts for an evidence-route learner action to complete rather than remain hypothetical.
