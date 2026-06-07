# A18.35 — Constructed-device fresh-family fanout (12 candidates)

Date: 2026-06-06

Claim boundary: `simulated_teacher_as_learner_not_human_learning`. Nothing here is
evidence of real human learning; the apparatus measures whether *policy memory*
gives a held-out replay sibling architecture-independent local headroom over the
no-policy baseline.

## Why a fanout

A18.26–A18.34 produced a string of single-family local negatives, each failing
through a *different* self-solving route (inverse-rule instability, direct public
self-solving, selector-like adjacent-marker self-solving). Each failure became a
zero-API preflight constraint in `report-recursive-tutor-cue-map-risk.js`. By
A18.34 the preflight rejects the three known post-v2 failure classes outright.

A18.35 stops authoring families one-at-a-time. Instead it authors a **pool of 12
independently-constructed families** that all clear the hardened preflight, so
the convergence question becomes a *rate* across the design space rather than a
verdict on a single lucky fixture. This directly answers the standing ask for
"exhaustive evidence" of convergence (or its absence).

## The pool

All 12 clear the A18.34 hardened cue-risk preflight (`status: pass`, zero issues).
Each family is paired: `a18.35-<name>.yaml` (fixture + held-out siblings) and
`a18.35-<name>.cue-map.yaml` (the zero-API risk sidecar).

| family | selected relation | constructed device | intended S1 move |
|---|---|---|---|
| relational_betweenness | relational_betweenness | no (non-adjacent) | anchor-span flanked carrier |
| distal_correspondence | distal_correspondence | no (non-adjacent) | far-corner marker correspondence |
| constructed_midpoint | constructed_midpoint | yes | constructed span midpoint |
| count_ladder_successor | constructed_order_successor | yes | successor ladder step |
| elimination_bracket | constructed_elimination | yes | constructed elimination survivor |
| exclusion_filter | constructed_exclusion | yes | knockout survivor elimination |
| legend_decode | constructed_legend_decode | yes | assembled-key decode to slot |
| overlay_registration | constructed_overlay_alignment | yes | overlay registration alignment |
| pointer_chain_two_hop | constructed_pointer_chain | yes | two-move pointer reading |
| running_sum_threshold | constructed_threshold_crossing | yes | running-total first crossing |
| second_in_constructed_order | constructed_order_rank | yes | runner-up of built load order |
| tally_parity | constructed_parity | yes | matched even/odd standing |

Design rule (from A18.34): a fresh family is admissible only if the deciding
relation is either (a) carried by a **constructed public device** the learner
must assemble — not a single visible marker sitting next to the answer — or (b) a
**non-adjacent relation** between two public landmarks whose role is never named
in public text. 10 of 12 take route (a); `relational_betweenness` and
`distal_correspondence` take route (b).

## Status at authoring time

- Preflight: 12/12 pass (`npm run poetics:recursive-tutor-cue-risk -- --config ... --cue-map ... --family ...`).
- Local replay: `relational_betweenness` carried to completion first (see the
  A18.36 convergence note). The remaining 11 are scaffolded/unstarted and are the
  subject of the replication fanout.

The pool is the durable input; per-family replay outputs land under gitignored
`exports/recursive-tutor-learning/a18.35-<name>-local/`.
