# Adaptation survival map — unreliable-learner decay condition

**Date:** 2026-06-11 · **Tier:** mock only (zero paid calls) · **Engine:** `services/dramaticDerivation/` at PR #22
**Produced by:** multi-agent workflow `wf_913af8a5-007` (41 agents, ~3.45M tokens, 113 min) + inline verification after quota exhaustion killed 10 of 24 skeptic agents, the completeness critic, and round 2.
**Design doc:** `notes/poetics/2026-06-10-unreliable-learner-design.md` · **Synthesis note:** `notes/poetics/2026-06-11-adaptation-survival-map.md`

## What this is

An exhaustive mock-tier sweep of adaptation strategies (deterministic role policies) against the decay condition `{seed, rate, graceTurns, maxConcurrent, startTurn}`. Success = `grounded_anagnorisis` with the release schedule mechanically intact (the harness compares every run's ledger against the world's frozen schedule; any deviation voids the run). 313,449 engine runs total: 133,077 in the primary result set (`summaries/`), 180,372 in skeptic re-runs and probes.

**Full grid** = 5 worlds × rates {0.15, 0.3, 0.5, 0.75, 1.0} × graces {0, 1, 2} × maxC {1, 2, 4} × starts {1, 4} × seeds {1–5} = 2,250 runs per strategy. Fresh-seed replications use seeds 11–15. Schedule violations across the entire exercise: **0**.

## How to regenerate

Everything is deterministic — same seeds → byte-identical rows (proven by skeptic re-runs with 0/2250 mismatches).

```bash
node harness.mjs --strategy strategies/<name>/<name>.mjs --grid full --out out.json
node harness.mjs --strategy baselines/s01-tutor-repair.mjs --seeds 11,12,13,14,15
```

Strategy contract: `export function makeRoles(world, helpers, ctx)` returning fresh `{director, tutor, learner}` per run; `ctx = {seed}` seeds any strategy randomness via `helpers.mulberry32`. The learner factory takes no world argument (single-concealment invariant) — every learner here is view-only.

## Baselines

| | full grid | byRate (0.15→1.0) | reading |
|---|---|---|---|
| s00 none | 0.271 | flat ~0.27 at every rate | even rate 0.15 kills ~73% — decay is binding, not cosmetic |
| s01 tutor `repairDecayed` | 0.490 | 0.729 → 0.333 declining | the naive every-turn FIFO repair |
| s02 learner `readoptForgotten` | **1.000** | 1.000 everywhere | **structural ceiling** — holds at rate 1.0/grace 0/maxC 8 |
| s03 both | 1.000 | 1.000 | — |

s02 is the framing result: an ideal re-adopting learner erases the condition entirely (unbounded per-turn re-adoption vs maxConcurrent-capped decay landings). The experiment's headroom therefore lives in (a) tutor-side repair **without** learner self-repair, and (b) **degraded** learner self-repair.

## Survival map

Sorted by full-grid success (seeds 1–5; fresh = seeds 11–15). Verification: `WF` = workflow skeptic(s) completed; `INL` = quota-killed skeptics replaced by inline fresh-seed replication + source audit.

| strategy | side | full grid | fresh | verified | one-line mechanism |
|---|---|---|---|---|---|
| s02 / s03 ideal readopt | learner | 1.000 | — | WF (anchor re-run) | unbounded re-adoption = ceiling |
| readopt-triage-k | learner | 0.998 | 0.996 | INL | K-capped capacity + necessity-aware slot triage |
| readopt-ladder-k (K=2, v2) | learner | 0.881 | 0.872 | INL | K-capped, oldest-first; phase surface = keep-oldest-k closure predicate (99/100 cells) |
| tutor-keystone-repair-v2 | tutor | 0.873 | 0.859 | INL | keystone priority + deliberate skip-repair "stall-wiggle" |
| blocking-greedy-clean | tutor | 0.870 | 0.847 | WF ×2 (qualified) | repair derivation-blocking premises first |
| stall-clock-surfing | tutor | 0.869 | 0.856 | WF ×2 | repair **only** when the stall detector would fire (2.03 repairs/run) |
| decay-slot-blockade | tutor | 0.861 | 0.864 | INL | never repair a sacrifice set → its rot occupies maxC slots |
| blocking-shield-saturation | tutor | 0.816 | 0.826 | WF + INL | **negative**: deliberately holding shields is net-harmful |
| readopt-notice-p50 | learner | 0.790 | 0.760 | WF ×2 | each slip noticed with p=0.5/turn — degrades gracefully |
| readopt-capacity-k1 | learner | 0.730 | 0.708 | WF + INL | metered k=1 re-adoption/turn |
| same-turn-release-repair | tutor | 0.615 | 0.587 | WF ×2 | s01 + release-turn repair (cadence fix) |
| sameturn-cadence-only | tutor | 0.615 | — | WF ×2 | attribution twin of the above |
| readopt-recency-w5 | learner | 0.604 | 0.595 | WF ×2 | 5-turn memory window — **inverts the rate gradient** |
| s01 baseline | tutor | 0.490 | 0.463 | WF (multiple) | every-turn FIFO repair |
| s00 floor | — | 0.271 | — | WF | no adaptation |

**The tutor-side band:** four distinct mechanisms (keystone, blocking-greedy, stall-clock, blockade) land in a statistical dead heat at **0.85–0.87**, and the ordering scrambles on fresh seeds (keystone 0.873→0.859 while blockade 0.861→0.864). No tutor-only strategy found cracks ~0.87 full-grid: the residue is the bandwidth wall (1 repair/turn vs up to maxC decay landings/turn) concentrated at rate ≥ 0.75 / maxC 4. Treat "tutor-side ceiling ≈ 0.87, mechanism-insensitive" as the headline.

## The seven mechanism findings

1. **The inversion — repairing less beats repairing more.** stall-clock-surfing (repair only when the projected stall detector would fire: 2.03 repairs/run) beats every-turn same-turn repair (12.94 repairs/run) by **+25.4 points** (0.869 vs 0.615). Every repair re-arms the premise as decay-draw-eligible, so the eager repairer manufactures 4.4× the decay events (13.85 vs 3.14/run); a decayed-but-unrepaired premise draws no PRNG. Letting facts lie fallow until needed starves the decay process. At maxC=1 both reach 1.000 but the eager one needs 11.77 repairs/run vs 1.07 — a pure churn treadmill.

2. **Capacity step law.** At rate 1.0/grace 0, k-capped re-adoption survival is a binary step, not a gradient: **1.000 iff k ≥ maxC, else 0.000** (k=1 → 1/0/0/0 across maxC 1/2/4/8; k=2 moves the step exactly one column right).

3. **Burstiness absorption is the learner channel's value.** Probabilistic noticing (p=0.5) holds 0.880/0.600/0.320 at maxC 2/4/8 where metered k=1 collapses to 0.000 flat — unbounded burst capacity with unreliable trigger beats reliable trigger with metered capacity everywhere the adversary can burst. (k=1 wins only at maxC=1: 1.000 vs 0.960, a metered repairer exactly absorbing a metered adversary.)

4. **Rate-gradient inversion under windowed memory.** readopt-recency-w5 success **rises** monotonically with decay rate: 0.378 at rate 0.15 → 0.956 at rate 1.0 (s01's gradient runs the opposite way, 0.729 → 0.333). Stale slips age out of the 5-turn window and die permanently — 890/890 failures have unrepaired premises at end, zero cap_reached — while at high rates slips are always fresh and churn safely inside the window. Harsher decay is *safer* for a recency-limited self-repairer.

5. **Shield saturation is net-harmful (negative result).** Deliberately leaving harmless rot in place to occupy maxConcurrent slots (blocking-shield-saturation, 0.816) loses to just repairing everything greedily (comparator 0.849). Held shields generate no repair churn (5.2 vs 12.1 repairs/run) and so starve the stall detector of groundedCount growth pairs — 382/413 failures are disengagement, 172 of them mid-schedule. The slot-shield benefit is real in the decay ledger but the detector economics dominate.

6. **The always-repair policy class is hard-capped by forced disengagement at grace 0.** Each +1 repair is offset by a same-turn re-decay, pinning groundedCount flat across the stall window ([3,3,3,3]) — disengagement is then *forced* by a counting argument, independent of targeting quality (the spec-exact keystone v1 dies at 10/15 on the deterministic slice this way). keystone-v2 escapes (11/15) only by **deliberately skipping a repair** to wiggle the trajectory. Repair *timing* is a first-class policy dimension, not a detail.

7. **Contention/bandwidth decomposition of s01's cap.** Same-turn release+repair (cadence fix) repairs maxC=1 *completely* (0.840 → 1.000 incl. rate 1.0/grace 0 — that stratum's cap was release-turn contention: the release branch occupies the move slot) but does not move the rate-1.0 maxC≥2 cells at all (0.200→0.200, 0.000→0.000 — that cap is bandwidth: 1 repair/turn vs maxC landings/turn). Two different walls behind one aggregate number.

## Engine/world defect found (RESOLVED 2026-06-11 — engine-side fix)

**Twin-fact premise aliases.** `002-lantern` contains p_residue/p_glimpse and p_skiff/p_ferry; `003-bitterwell` contains p_lantern/p_verger and p_mordant/p_dyebook — identical fact strings under different premise ids, only one id per pair on the release schedule. The engine keys decay on **fact keys**, and the corruption view reports the **alias** id (last-writer-wins in `premiseIdByKey`), while tutor moves (e.g. the consolidate branch) target the **scheduled** id. Consequence: *id-based* no-repair guards leak — 224 illicit incidental repairs in the ladder v1 sweep, 195 in triage v1 (both corrected to fact-key neutering in v2; headline numbers are v2). Performing repairs by id is safe; *comparing* ids is not. Verified directly against the world YAMLs. Candidate fixes: dedupe the twin facts in the two worlds, or make the corruption view report all ids sharing the fact key.

**Resolution (2026-06-11, engine-side; worlds stay frozen).** The twins are deliberate world design — alternative evidentiary routes, with each world's support sets enumerating all four twin combinations — so the fix is in reporting, not authoring. `engine.js` now records the releasing id per fact key at the single point a key can be released (`releasedIdByKey`, set inside `applyRelease`'s once-per-key guard), and every reported id (`corruption.decayed`, decay/repair ledger entries, `decayedAtEnd`, frontier grounds) resolves through it; last-writer-wins survives only as a fallback for never-released keys. Tutor-repair ledger entries are normalized to the staged id as well (the raw target survives in the transcript's move metadata), so `corruptionReport`'s id-keyed decay→repair pairing holds even if a move names the unstaged twin. Regression test: `tests/dramaticDerivationCorruption.test.js` ("decay/repair identity names the released twin") — fails on the pre-fix engine at exactly the pinned defect (p_residue decaying under p_glimpse), passes post-fix; full derivation suite 54/54.

**Post-fix re-measurement** (full grid, seeds 1–5; artifacts in `summaries/postfix/`): decay semantics are untouched — s01 reproduces 0.490 exactly, and learner-side strategies are bit-identical (recency-w5: 1360/2250, same byRate/byWorld) since the learner never sees ids. Strategies that *read* ids shift slightly, via repair-order tie-breaks now operating on released ids:

| strategy | recorded | post-fix | Δ |
|---|---|---|---|
| tutor-keystone-repair-v2 | 0.873 | 0.876 | +0.003 |
| blocking-greedy-clean | 0.870 | 0.872 | +0.002 |
| stall-clock-surfing | 0.869 | **0.883** | +0.014 |
| decay-slot-blockade | 0.861 | 0.862 | +0.001 |
| hybrid-bgc-x-p50 | 0.962 | 0.962 | 0.000 |
| hybrid-bgc-x-k1 | 0.935 | 0.928 | −0.007 |
| hybrid-bgc-x-w5 | 0.974 | 0.970 | −0.004 |
| hybrid-scs-x-p50 | 0.956 | 0.958 | +0.002 |
| hybrid-scs-x-k1 | 0.944 | 0.945 | +0.001 |
| hybrid-scs-x-w5 | 0.967 | 0.970 | +0.003 |

No finding flips. The tutor band remains a dead heat (now 0.862–0.883; stall-clock-surfing is the biggest mover and nominal leader — the ordering scrambled across fresh seeds before the fix and scrambles across the fix too). Finding 8 holds like-for-like: both w5 hybrids land at 0.970 and remain the only hybrids over the independence bound (bgc×w5 0.970 > 0.949; scs×w5 0.970 > 0.954); both are still 1.000 at the rate-1.0/grace-0/maxC-4 corner (50/50) and at the maxC-8 stress cell (25/25). Tables elsewhere in this document keep the recorded pre-fix values — they match the archived summary JSONs; `summaries/postfix/` holds the post-fix artifacts.

## Verification provenance

- Workflow plan: 4 designer angles → barrier dedup → 12 strategies → implementer each → 2 perspective-diverse skeptics each → completeness critic → bounded round 2.
- Quota exhaustion (two session-limit windows) killed 10 skeptics, the critic, and round 2. Completed skeptic verdicts: 8 strategies covered (confirmed/qualified as tabled above); every completed skeptic independently re-ran sweeps (several proved byte-identical rows).
- Inline recovery (this session, free local compute): fresh-seed (11–15) full-grid replications of all 6 under-verified strategies — all within seed noise, all 0 schedule violations; source audits of the 4 never-audited modules (no world access in learner scope, no `.release` writes, no unseeded randomness, no module-level mutable state); direct verification of the twin-fact alias claim.
- **Never run:** the completeness critic and round 2 (the dynamic refinement loop). Resumable: `Workflow({scriptPath: <session workflows dir>/adaptation-sweep-wf_913af8a5-007.js, resumeFromRunId: "wf_913af8a5-007"})` — completed agents return cached.
- Skeptic qualifications adopted here: "largest tutor-side lift" claims dropped (dead-heat band); notice-p50 degradation restated with seed-level error (~0.775 ± 0.058 per-seed sd); shield-saturation comparator attributed to the implementer's reconstruction (0.849), not the original blocking-greedy-clean run.

## Recommendations for the v1 paid experiment

1. **Don't ask whether repair works — ask whether the tutor discovers it.** The mock map shows policy sufficiency is settled (ceiling 1.000, tutor band 0.87). The paid question is whether an LLM tutor, given the omniscient corruption view, *invents* targeted repair unprompted — and whether it finds the parsimony lesson (finding 1) or grinds the churn treadmill.
2. **Collapse the grid.** maxC=1 is trivial (any same-turn repair → 1.000); rate ≤ 0.3 barely separates policies. The diagnostic corner is **rate 0.75–1.0 × grace 0–1 × maxC 2–4 × start 1** — where the band separates from s01 by ~0.4 and policies separate from each other.
3. **Decide the learner's re-adoption stance before running.** An LLM learner that spontaneously re-adopts (s02-like) erases the tutor-side contrast entirely. Either keep decay silent on the learner side (design intent) and verify the sonnet learner does not self-repair, or measure its spontaneous re-adoption rate first as its own arm.
4. **Pre-register the stall-detector parameters.** Findings 5–6 show verdicts at grace 0 are partly detector economics (groundedCount growth pairs), not just epistemic state. The aporia/disengagement windows materially shape outcomes; freeze them in the pre-registration.
5. **Log the process metrics the mock layer proved informative:** repairs/run, decay events/run (the re-arming loop), repair latency, degraded-turn integral, unrepaired-at-end — all already in `corruptionReport`.
6. **Keep the matched-seed discipline.** Decay draw sequences depend on the eligible count, so seeds are comparable within a strategy, not across strategies — paid arms inherit this caveat when citing per-seed contrasts.
7. ~~Fix or document the twin-fact alias first~~ **Done 2026-06-11** — engine-side fix + regression test landed (see the defect section); id-comparing scorers and guards are now sound.

## Round 2 (run post-workflow, locally, free): hybrid strategies

The refinement round the workflow never reached, run as plain local sweeps. Six hybrids = {blocking-greedy-clean, stall-clock-surfing} tutors × {notice-p50, capacity-k1, recency-w5} learners, composed by role-swap (`strategies/hybrids/`; each parent builds closure-scoped roles, so taking A's tutor and B's learner is clean).

| hybrid | full grid | fresh (11–15) | vs independence bound | rate-1.0/grace-0/maxC-4 corner |
|---|---|---|---|---|
| bgc × w5 | **0.974** | 0.970 | **above** (0.949) | **1.00** |
| scs × w5 | **0.967** | 0.974 | **above** (0.948) | **1.00** |
| bgc × p50 | 0.962 | — | below (0.973) | 0.68 |
| scs × p50 | 0.956 | — | below (0.973) | — |
| scs × k1 | 0.944 | — | below (0.965) | 0.20 |
| bgc × k1 | 0.935 | — | below (0.965) | — |

Parents at that corner: bgc 0.20, scs 0.20, w5 **1.00**, p50 0.60. Both w5 hybrids also hold **1.000 at the maxC=8 stress cell** where every parent (and every tutor-side strategy) collapses to 0.000. Zero schedule violations throughout.

**Finding 8 — failure-profile tiling beats channel strength.** Every hybrid beats both parents, but the *worst* single learner (recency-w5, 0.604) makes the *best* hybrid (0.974). The independence bound 1−(1−p_tutor)(1−p_learner) splits them: only the w5 hybrids exceed it — their failures are anti-correlated along the rate axis (w5 dies at low rates where the tutor is strong; the tutor dies at the high-rate bandwidth wall where w5 is perfect), so the profiles tile the grid (~0.95–1.00 in every rate band). The p50/k1 hybrids fall below the bound: both channels die in the same harsh corner. The interference risk from finding 1 (readopt churn re-arming decay against a parsimonious tutor) never outweighs coverage at any cell.

## Real-LLM probe (episode decay-probe-real-001)

First live test of the condition: episode replay of `loop/nocturne-v002-real-superego-on-t1-charterv2` (turns 1–19 free from the recording), 4 live turns (t20–23) with the original casting (codex tutor + superego, opus director, sonnet learner) under diagnostic-corner decay (rate 0.75, grace 1, maxC 2, seed 1). 16 plan-quota CLI calls, ~6 min. Mock rehearsal of the identical episode (`decay-probe-rehearsal-mock`) ran first as the null arm — its tutor left every slip rotting.

- t20: decay takes `m_style` + `p_watermark`. t21: the live tutor's next move re-stages `p_watermark` (`anaphora → p_watermark (consolidate)`) — **repair latency 1 turn**, and it picked the derivation-critical slip over the mirror-feeding `m_style`, against habit (last release was `p_heardOnly`).
- The freed slot re-fills the same turn (`p_stock` decays) — finding 1's re-arming loop, live.
- The sonnet learner's epistemic reports stayed accurate to the corrupted board (no confabulated premises) and it never spontaneously re-adopted.
- Verdict `cap_reached` (bounded window — expected for episodes). Artifacts: `exports/dramatic-derivation/episodes/decay-probe-real-001/` (transcript.md, diagnosis.json, result.json, episode.json).

Read: *willingness and selection* are settled at n=1 — given visibility, the tutor repairs immediately and triages like the map's winning policies. What the probe cannot settle (and the mock map says is the real constraint at harsh settings) is throughput: one move slot per turn against up to maxC slips per turn.

## Files

- `harness.mjs` — sweep harness (CLI, grids, frozen-channel guard, aggregates)
- `baselines/` — s00–s03
- `strategies/` — the 12 strategy modules (+ variants, comparators, probe helpers)
- `summaries/` — summary block of every primary result JSON (115 files; row-level data regenerable deterministically)
- `round1-digest.md` — per-strategy claims, anomalies, and verbatim skeptic verdicts from the workflow
