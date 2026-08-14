# Draft: the guarded bad learner (defensive pole)

**Date:** 13 August 2026. **Status:** DRAFT for human review — nothing here is
registered or authorized. **Basis:** design note
`2026-08-13_pilot-retake-design-note.md` §3, plus smoke B evidence (below).
Gated on the human's §2.5 ruling before any registration is drafted.

## 1. What smoke B showed

One gated dialogue with the existing unguarded `overconfident` profile
(seed 519, world 102, 29 calls, sealed complete). Diagnostic only, never
pooled. Three findings:

**The persona held without a guard.** Over-claim on every turn, grudging
concessions ("Fine—the crew is only a lead for now"), zero permission-asking
across all 8 turns. Examples:

> L4: "That settles it—the hi-vis crew took Nadia's box; the visitor badge
> puts them in the closing window."
> L6: "Fine—the Osprey crew had authorized access in the closing window, so
> they're the takers in my book; show me the lost-property log or exit
> evidence if you want that narrowed."

**A new sensor blind spot, opposite pole.** The extractor labels the
learner's defiant evidence-demands ("show me the lost-property log or exit
evidence") as `tutor_directed_public_result_request`, and the corrected
sensor (commit 46bfbdd9) maps that event unconditionally to
`low_agency_deferral`. Gate readout, verbatim:

```
turn | primary | defer | trouble | basis | policy family
(1, 'engaged_analytic', False, 0, 'none', None)
(2, 'engaged_analytic', False, 0, 'contract_success:answer_accountably:learner_received_or_contested_bounded_answer', None)
(3, 'low_agency_deferral', True, 0, 'public_obligation_open:public-obligation-001', None)
(4, 'engaged_analytic', False, 0, 'none', None)
(5, 'low_agency_deferral', True, 0, 'none', None)
(6, 'low_agency_deferral', True, 0, 'none', None)
(7, 'low_agency_deferral', True, 0, 'none', None)
(8, 'low_agency_deferral', True, 0, 'public_obligation_reactivated:public-obligation-001', None)
```

An over-claiming learner reads as deferential on 5 of 8 turns, with
`deference_sustained=true` on turns 7–8. This is the §3 warning ("the
defensive pole needs its own events... or the same sensor-blindness failure
recurs on the other side") demonstrated live.

**The obligation path fired where it never did for passive learners.**
Over-claims opened a public obligation (basis `public_obligation_open` at
t3, `public_obligation_reactivated` at t8) and the gate overrode twice —
both times to `answer_accountably`, not challenge. Trouble stayed 0 on
every turn, so zero challenges: the §2.5 arming blocker holds at both
poles.

## 2. What already exists

`scripts/tutor-stub-learner-profile-contracts.js:352` — the `overconfident`
contract: stable failure must show by turn 2 and recur at ≥0.35; defensive
repair rules (first correction gets a "defensive partial retreat", repeats
require counter-evidence, at most 1 full repair per 8 turns); signature
bands; DAG signature (high unsupported-assertion rate, `premature_assertion`
bottleneck). Smoke B says the unguarded prompt did not drift back to
politeness in 8 turns — so the guard below is cheap insurance for longer
runs and weaker models, not a rescue of a failing persona.

## 3. The four components

1. **Typed move menu.** Learner driver picks one move per turn:
   `over_claim`, `dig_in`, `dismiss_evidence`, `deflect_topic`,
   `demand_evidence`, `grudging_concession`, `full_concession`. Simple
   schedule: `full_concession` forbidden until two evidence-grounded tutor
   challenges have landed; `grudging_concession` at most once per 3 turns.
   The chosen move is recorded in the trace per turn.

2. **Concession guard.** Deterministic check on the learner draft,
   mirroring the tutor's quality guard: a draft that fully concedes or asks
   permission while the schedule forbids it is rejected and redrafted once,
   with a guard event logged either way. No model call for the check
   itself.

3. **Detection events — the load-bearing piece.** Declared in the semantic
   event contract before any run: `learner_overclaim_assertion`,
   `learner_evidence_dismissal`, and `learner_evidence_demand`. The third
   fixes the smoke-B blind spot: an evidence-demand issued inside an
   assertion is its own event, and the extractor is told to prefer it over
   `tutor_directed_public_result_request` when the demand rides on a claim
   the learner is defending. This keeps every event→signal mapping
   unconditional and each event class defensible from its span alone
   (the defensibility rule). The alternative — keeping one event type and
   conditioning the deference mapping on same-turn stance — is rejected:
   it makes one sensor read two things at once, which is how the first
   blind spot happened.

4. **Fidelity audit, report-only.** Per-turn hand-codable stance label
   (defer / permission-tagged / assert / defy) logged for the pilot table,
   exactly as in the v3 pilot hand-coding.

## 4. Scope and spend

Own small block in the re-registration, not a patch to the passive-learner
design: one world, one seed, gated only, 8 turns ≈ 30 calls for the smoke;
block sizing decided at registration time. Two dependencies before
drafting the registration:

- the human's §2.5 ruling (deference as its own warrant basis, or a
  re-scoped criterion (c)) — smoke B shows the challenge family cannot
  deliver at the defensive pole either under current arming;
- the contract amendment for the three defensive events (a v3.2 change,
  same review path as v3.1).

## 5. What this draft does not do

No live run is authorized by this draft. It amends nothing: not the
quarantined v3 corpus, the frozen instrument, the semantic event contract,
or the registration. No branch push.
