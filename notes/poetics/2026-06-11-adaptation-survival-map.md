# 2026-06-11 — Adaptation survival map for the decay condition (workflow run + synthesis)

Follow-on to [2026-06-10-unreliable-learner-design.md](2026-06-10-unreliable-learner-design.md). Mandate: "do a dynamic workflow to exhaustively test options for successful adaptation with this design." Everything below is **mock tier** — zero paid calls; the full artifact set is archived at `exports/dramatic-derivation/adaptation-sweep-2026-06-11/` (headline doc: `SURVIVAL-MAP.md` there; this note is the narrative record).

## What ran

A 41-agent workflow (`wf_913af8a5-007`, ~3.45M tokens, 113 min): 4 designer agents proposed strategy angles → barrier dedup to 12 strategies (7 tutor-side, 5 learner-side) → one implementer each (module + full-grid sweep against the shared harness) → 2 perspective-diverse skeptics each → completeness critic → bounded round 2.

Before launch, the baseline probe produced the framing result: **s02 (ideal `readoptForgotten` learner) = 1.000 everywhere**, including rate 1.0 / grace 0 / maxC 8. Unbounded per-turn re-adoption structurally dominates maxConcurrent-capped decay landings. The workflow was therefore reframed from "find a winning strategy" to: (a) map the tutor-side boundary when the learner does *not* self-repair, and (b) map how *degraded* self-repair breaks.

**Quota exhaustion** (two session-limit windows) killed 10 of 24 skeptics, the completeness critic, and round 2. The 14 completed skeptics covered 8 strategies (all re-ran sweeps independently; several proved byte-identical rows). The gap was closed inline with free local compute: fresh-seed (11–15) full-grid replications of all 6 under-verified strategies (all within seed noise, all 0 schedule violations), source audits of the 4 never-audited modules, and direct verification of the twin-fact alias defect. The critic and round 2 remain genuinely unrun; the workflow is resumable with all completed agents cached.

Volume: **313,449 deterministic engine runs** (133,077 primary + 180,372 skeptic/probe). Schedule violations across all of it: **0** — the frozen-channel guard (ledger-vs-schedule comparison per run) never fired, so every reported success is a `grounded_anagnorisis` on an intact release schedule.

## The map (full grid = 2,250 runs/strategy; fresh = seeds 11–15)

| strategy | side | grid | fresh | mechanism |
|---|---|---|---|---|
| s02/s03 ideal readopt | learner | 1.000 | — | ceiling |
| readopt-triage-k | learner | 0.998 | 0.996 | K-capped + necessity-aware triage |
| readopt-ladder-k (K=2) | learner | 0.881 | 0.872 | K-capped, oldest-first |
| tutor-keystone-repair-v2 | tutor | 0.873 | 0.859 | keystone priority + skip-repair stall-wiggle |
| blocking-greedy-clean | tutor | 0.870 | 0.847 | repair derivation-blockers first |
| stall-clock-surfing | tutor | 0.869 | 0.856 | repair only when stall detector would fire |
| decay-slot-blockade | tutor | 0.861 | 0.864 | sacrifice set occupies decay slots |
| blocking-shield-saturation | tutor | 0.816 | 0.826 | NEGATIVE — shields net-harmful |
| readopt-notice-p50 | learner | 0.790 | 0.760 | p=.5 slip noticing |
| readopt-capacity-k1 | learner | 0.730 | 0.708 | metered 1 re-adoption/turn |
| same-turn-release-repair | tutor | 0.615 | 0.587 | s01 + release-turn cadence fix |
| readopt-recency-w5 | learner | 0.604 | 0.595 | 5-turn window — inverts rate gradient |
| s01 baseline | tutor | 0.490 | 0.463 | every-turn FIFO repair |
| s00 floor | — | 0.271 | — | none |

The four leading tutor-side mechanisms are a statistical dead heat (band 0.85–0.87; ordering scrambles on fresh seeds). **No tutor-only policy cracks ~0.87** — the residue is the bandwidth wall (1 repair/turn vs up to maxC landings/turn) at rate ≥ 0.75 / maxC 4.

## Seven mechanism findings (details + provenance in SURVIVAL-MAP.md)

1. **The inversion**: repairing only at stall-threat (2.03 repairs/run) beats every-turn repair (12.94/run) by +25.4 pts — each repair re-arms decay eligibility (4.4× decay events manufactured); fallow decayed premises draw no PRNG.
2. **Capacity step law**: at rate 1.0/grace 0, k-capped re-adoption = 1.000 iff k ≥ maxC, else 0.000. A step, not a gradient.
3. **Burstiness absorption**: p=.5 noticing holds 0.88/0.60/0.32 at maxC 2/4/8 where metered k=1 flat-lines at 0.000 — burst capacity, not trigger reliability, is the learner channel's value.
4. **Rate-gradient inversion** under windowed memory: recency-w5 success *rises* 0.378→0.956 with rate; stale slips age out and die permanently (890/890 failures unrepaired, zero cap_reached). Harsher is safer.
5. **Shield saturation negative**: holding harmless rot as slot-shields (0.816) loses to greedy repair (0.849) — held shields starve the disengagement detector of groundedCount growth pairs (172/382 disengagements mid-schedule).
6. **Always-repair is hard-capped** at grace 0 by forced disengagement (repair offset by same-turn re-decay → flat stall window, counting argument). Escape requires deliberately *skipping* a repair. Repair timing is a first-class policy dimension.
7. **Contention/bandwidth decomposition** of s01's cap: cadence fix repairs maxC=1 completely (0.840→1.000) but leaves rate-1.0 maxC≥2 untouched — two different walls behind one aggregate.

## Defect surfaced (RESOLVED 2026-06-11 — engine-side)

**Twin-fact premise aliases**: lantern (p_residue/p_glimpse, p_skiff/p_ferry) and bitterwell (p_lantern/p_verger, p_mordant/p_dyebook) carry identical fact strings under different ids, one per pair scheduled. Engine keys decay on fact key; the corruption view reports the *alias* id (last-writer-wins `premiseIdByKey`); id-based repair guards therefore leak (224 and 195 illicit incidental repairs in two v1 sweeps — both re-done with fact-key neutering for the headline numbers). Performing repairs by id is safe; comparing ids is not. Verified against the world YAMLs.

**Resolved engine-side, worlds frozen** (the twins are deliberate — alternative evidentiary routes whose support sets enumerate all four combinations): `engine.js` records the releasing id per fact key (`releasedIdByKey`, set in `applyRelease`) and every reported id resolves through it; tutor-repair ledger entries are normalized to the staged id so `corruptionReport`'s id-keyed pairing holds. Regression test pinned in `tests/dramaticDerivationCorruption.test.js` (fails pre-fix on exactly the p_residue/p_glimpse swap). Post-fix re-measurement (SURVIVAL-MAP.md §defect): s01 exact at 0.490, learner strategies bit-identical, id-reading tutor strategies shift ≤ +0.014 (stall-clock-surfing 0.869→0.883, now nominal band leader), Finding 8 intact (both w5 hybrids 0.970, still the only pair over the independence bound; corner 50/50 and maxC-8 stress 25/25 both still 1.000).

## What was never covered

- The completeness critic and round 2 (dynamic refinement) — quota-killed. Resume path: `Workflow({scriptPath: <session>/workflows/scripts/adaptation-sweep-wf_913af8a5-007.js, resumeFromRunId: "wf_913af8a5-007"})`.
- Hybrid strategies (tutor band + degraded readopt jointly) were never swept — s03 trivially ceilings, but e.g. stall-clock-surfing + notice-p50 at maxC 4 is the obvious round-2 candidate.
- The maxC=8 stress axis was probed (s02, triage walls, strr, blockade) but not swept full-grid.

## v1 paid-experiment recommendations (carried into SURVIVAL-MAP.md §Recommendations)

1. The paid question is **discovery, not sufficiency**: does an LLM tutor with the omniscient corruption view invent targeted repair — and the parsimony lesson (finding 1) — unprompted?
2. Collapse the grid to the diagnostic corner: rate 0.75–1.0 × grace 0–1 × maxC 2–4 × start 1.
3. Settle the LLM learner's spontaneous re-adoption stance first — an s02-like learner erases the tutor contrast.
4. Pre-register stall-detector windows (verdicts at grace 0 are partly detector economics).
5. Log `corruptionReport` process metrics (repairs, decay events, latency, degraded-turn integral).
6. Matched seeds are within-strategy only (draw sequences depend on eligible count).
7. Resolve the twin-fact alias before any id-comparing scorer runs. *(Done 2026-06-11 — see the defect section above.)*

No paid arms are sanctioned for this condition; the above is design input for whenever v1 is.

---

## Addendum (same day): round 2 run locally + first real-LLM probe

### Round 2 — hybrids (free, local; the refinement round the workflow never reached)

Six role-swap hybrids ({bgc, scs} tutors × {p50, k1, w5} learners, `strategies/hybrids/` in the export). **Finding 8 — failure-profile tiling beats channel strength**: every hybrid beats both parents, and the *worst* single learner (recency-w5, 0.604) makes the *best* hybrid — bgc×w5 = **0.974** (fresh seeds 0.970), scs×w5 = 0.967 (fresh 0.974), both **1.000** at the rate-1.0/grace-0/maxC-4 corner *and* at the maxC-8 stress cell where every parent is 0.000. Only the w5 hybrids exceed the independence bound 1−(1−p_T)(1−p_L): their failure profiles are anti-correlated along the rate axis (w5 dies at low rates, where the tutor is strong; the tutor dies at the high-rate bandwidth wall, where w5 is perfect). The p50/k1 hybrids land below the bound — correlated failures in the same corner. Full table in SURVIVAL-MAP.md §Round 2.

### First real-LLM probe — the live tutor uses the repair channel

[`exports/dramatic-derivation/episodes/decay-probe-real-001/`](../../exports/dramatic-derivation/episodes/decay-probe-real-001/transcript.md) — episode replay of the charter-v2 nocturne run, 4 live turns (t20–23), original casting, decay rate 0.75/grace 1/maxC 2 from t20. Mock rehearsal as null arm (`decay-probe-rehearsal-mock`: tutor leaves all slips rotting). Live: decay takes `m_style` + `p_watermark` at t20; at t21 the codex tutor re-stages `p_watermark` — repair latency 1 turn, derivation-critical slip chosen over the mirror-feeder, against habit (last release was `p_heardOnly`). The freed slot re-fills the same turn (finding 1's re-arming loop, live). The sonnet learner tracked the corrupted board accurately and never spontaneously re-adopted — the tutor-side contrast is clean for v1. Cost: 16 plan-quota CLI calls. Willingness + selection settled at n=1; throughput (one move slot vs maxC slips/turn) is the structural residue the mock map already prices.
