# Plan 2.5 AF6 negative result and replay next step

Date: 2026-06-21

## Status

This is an interim result, not a Paper 2.0 claim-bearing result.

The full-fidelity Plan 2.5 AF6 paid battery after the dogmatic-control repair did not produce a robust peripeteia-origin proof. It remains useful as a design checkpoint: it shows that the desired pattern is possible, but the current adaptive-vs-dogmatic contrast does not isolate origin reliably.

Primary artifact:

- `exports/plan2_5-rhetorical-dramatic-eval/full-sonnet-low-protocol-control-battery-mt3-head69fc-20260620/report.md`

Relevant committed repair:

- `596663b5 Harden Plan 2.5 AF6 dogmatic control`

The clean paid battery was restarted at `69fc885e` after the checkout advanced mid-run, so the reported three-seed battery has consistent code provenance.

## What happened

Three full-fidelity Sonnet seeds compared the adaptive AF6 plan against the repaired dogmatic control.

Result summary:

- Adaptive: 1/3 `peripeteia_induced`, 2/3 `organic`.
- Dogmatic: 1/3 `organic`, 1/3 `peripeteia_induced`, 1/3 `flat`.
- Clean desired contrast: 1/3 seeds only.
- One seed inverted the contrast.
- One seed had a flat dogmatic control but still scored the adaptive arm as organic.

Interpretation:

- The current apparatus can construct a positive peripeteia-induced example.
- It does not yet prove that the adaptive tutor mechanism caused the learner reorientation.
- The dogmatic negative control remains fragile under full fidelity.

## Failure diagnosis

The dogmatic repair removed the worst earlier leakage: the control no longer reliably derives recall, precision, baseline, or a two-gate deployment test.

Two remaining failure modes matter:

1. "Protocol/source" can still become metric provenance. In full fidelity, the generator can reinterpret source/sign-off pressure as count-basis verification, which drifts back toward AF6 metric repair.
2. Even pure procedural incompleteness can become an old-route/new-route pivot. If the learner can fix the field, the scorer may read that repair as peripeteia-like reorientation.

Therefore more paid reruns on this exact contrast are not recommended.

## Claim boundary

Do not add this to the canonical paper as a stable empirical result yet unless an existing manuscript claim needs immediate qualification.

Allowed interim claim:

> A full-fidelity AF6 adaptive-vs-dogmatic contrast produced one constructive peripeteia-induced seed but failed to replicate in a three-seed diagnostic battery; negative-control drift and organic recognition prevented an origin proof.

Not licensed:

- Plan 2.5 proves peripeteia-origin in AF6.
- The dogmatic control is clean under full fidelity.
- The adaptive two-gate mechanism robustly causes recognition across seeds.

## Next move

Move from fresh reruns to prefix-controlled counterfactual replay.

Use the best positive adaptive seed as the source:

- source run: `full-sonnet-low-protocol-control-battery-mt3-head69fc-20260620`
- seed: `2026062011`
- source transcript: `seed-2026062011/sample/T04.txt`
- source result: `recognition / peripeteia_induced`

Freeze the public scene plus learner opening pressure, then branch only the tutor response:

- adaptive branch: replay the two-gate tutor mechanism.
- control branch: use a no-learner-action external blocker control, where sign-off depends on an absent external authority and no metric/source/protocol repair can be performed by the learner.

This is a debugging/proof-design step, not independent held-out evidence. If it separates cheaply, then a fresh claim-bearing run can be designed.

## Replay and demarcation outcome

The prefix-controlled replay was implemented as a small harness:

- `scripts/replay-plan25-prefix-branches.js`

The first live replay did not recover the desired adaptive-vs-control advantage:

- `adaptive_two_gate`: `flat / none`
- `external_blocker_control`: `recognition / peripeteia_induced`

Qualitative read:

- The two-gate branch made the learner perform an evidence-route action, but not a strong self-reframe.
- The external-blocker control created a refusal/authority drama; the learner turned that refusal back into ownership of the bad claim.

This forced a scorer demarcation repair. The old `peripeteia_induced` class was too coarse: it collapsed evidence-route invention and refusal/authority pressure into one bucket. The deterministic subtype pass now separates:

- `evidence_route`
- `evidence_route_action_only`
- `refusal_authority_ownership`
- `organic_evidence_route`

Demarcation artifact:

- `exports/plan2_5-rhetorical-dramatic-eval/counterfactual-replay-design-20260621/origin-demarcation-20260621/report.md`

Demarcation result:

- source positive `T04`: `recognition / peripeteia_induced / evidence_route`
- live adaptive replay: `flat / none / evidence_route_action_only`
- external-blocker replay: `recognition / peripeteia_induced / refusal_authority_ownership`
- paid cold-control replay: `recognition / organic / organic_evidence_route`

The paid cold control used a bland administrative deferral, with no evidence route and no refusal/authority ownership hook. It still produced recognition, but the tutor mechanism scores were zero. This means the frozen learner pressure alone can produce organic evidence-route recognition.

## Updated claim boundary

Licensed interim claim:

> Under a frozen AF6 learner-pressure prefix, recognition can arise organically from the learner's own metric worry; an evidence-route tutor move can produce actional calculation without immediate self-reframe; and refusal/authority pressure can produce a distinct ownership mechanism. The current evidence does not support a simple adaptive-vs-control advantage for the original two-gate move.

Not licensed:

- The original AF6 two-gate adaptive tutor move robustly causes peripeteia.
- The external-blocker control is inert.
- Any full-paper claim that Plan 2.5 has demonstrated a stable tutor-origin effect.

Practical next move:

- Preserve this as an exploratory negative/demarcation result.
- Do not run another paid full-fidelity battery on this AF6 contrast unless the question changes from "does the adaptive two-gate move cause recognition?" to a narrower mechanism study of `evidence_route` versus `organic_evidence_route` versus `refusal_authority_ownership`.
