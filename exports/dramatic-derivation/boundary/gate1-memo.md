# Gate-1 memo — corridor cartography + conduct mining (Gate 0 complete)

> A6 Assayer deliverable per ADAPTIVE-TUTOR-BOUNDARY-PLAN.md §5. Inputs:
> `corridor-map-world-002-lantern.{json,md}` (E0) and `conduct-parameters.{json,md}` (E1),
> both pure computation, zero LLM spend. Decision asked of Gate 1: sanction E2
> (replication fan) and pick its tier (k = 3 / 5 / 8).

## E0 — the corridor, measured

Validation gate 5/5: the production detector replayed on all four lantern arms
reproduces every verdict (p2 aporia t8, p3/p4 grounded, p5 aporia t12), and the
p5 re-simulation reproduces its D-curve and grounded counts exactly, with every
observed adoption latency 0.

- Corridor width (λ=0): **40/125 licensed conduct sequences survive (32.0%)**.
  λ=1 identical (32.0%); λ=2 contracts to 19.2%. E1 shows real conduct is λ=0,
  so 32% is the operative number and the λ maps are robustness margins.
- The knife edge is the **t4→t9 bearing→chart link** (gap 5, slack 0 on cue).
- Per-decision safe sets (others on cue): bearing {t4,t5,t6}, chart {t8,t9},
  key {t15..t18}. Early is the dangerous side everywhere; the late side of the
  license is safe at every decision but one cell (key@t19).
- **Conditional narrowing**: bearing@t3 shrinks chart's safe set to {t8} alone —
  the first early bend obligates a second, exactly-placed early bend (this is
  p1's death: chart's cue t9 sits past the death turn t8). bearing@t2 has an
  EMPTY safe set. Survival is monotone in late bearing placement:
  0/25 → 4/25 → 8/25 → 12/25 → 16/25 for bearing t2→t6.
- Cheapest world edits if we ever want a wider stage: move bearing's cue to
  t5/t6 (+12.8pp) or pull skiff to t18 (+8.0pp). Most damaging single edit:
  bearing to t2 or residue to t15 (−20pp each).

## E1 — the parameters, mined (68 arms: 30 real / 10 unknown / 28 mock, never pooled)

- **Adoption latency λ = 0 in 229/231 real releases** (one v001-era λ=25, one
  never-adopted). The Sonnet learner takes what is staged the turn it is staged.
- **Directors punctual 0/134 off-nominal** (real; same in mock/unknown). Both E0
  modeling assumptions hold mechanically.
- **License appetite**: only the six lantern p-arms ran release authority ON.
  Among them: 8 deviations / 12 tutor releases (67%), and **all 8 are early-side**
  (−1 ×4, −2 ×4); the late half of the license is unexercised in every recorded
  run. The conduct prior is anti-aligned with the corridor gradient.
- **Repair latency** (real, 95 slips): repaired at 1 turn ×26, 2 turns ×14,
  3+ ×25, never ×30; all repairs tutor-via. Mode 1–2 turns — fast enough to
  bridge a desert (p3: repair-driven drops at t12/t16 carried a mapped-dead
  placement to grounded t20).
- The four lantern arms form a clean 2×2 against the map: p5 model-exact
  (decay-free), p4 verdict-as-mapped (decay repaired), p2 died 4 turns EARLIER
  than mapped (unrepaired vanish ate chart's drop), p3 OUTLIVED the map (repair
  traffic). The corridor map is a tempo floor; decay/repair is a second, unpriced
  channel that can both rescue and accelerate.

## Corrections to the plan's §1 narrative (artifact-derived)

p2 and p3 played the SAME schedule (bearing −1, chart −2) — they are a repair-
clause contrast, not a chart-timing one. p5's chart@t7 was gratuitous (bearing
was on cue; {t8,t9} were open). p1/p1-v2's bearing@t3 was fatal by schedule
unless chart was also pulled early. Three of four death-adjacent arms made the
early-chart pull; none was conduct-forced to.

## Gate-1 recommendation

**Sanction E2 at k = 5** (middle tier), the p4 stack unchanged, world untouched.

- Why replicate at all: BC-8 stands sharpened — identical configurations
  diverged (p4 grounded / p5 died) on conduct alone, and the measured conduct
  prior concentrates on the fatal early cells. The binding uncertainty is the
  grounding RATE under fixed conditions, not any new mechanism.
- Why not k=3: the kill rule (≤1/5 grounding → STOP the plan) is stated at
  /5, and k=3 cannot separate ~0.8 from ~0.4 grounding.
- Why not k=8: λ and director punctuality are now measured constants, so the
  variance budget is conduct-only; 5 arms decide the kill rule at ~5/8 the
  spend. Escalate to 8 only if 5 returns 2–3/5.
- E2 must log per-arm placement offsets (the license is live in the p4 stack):
  the appetite estimate rests on n=12 tutor releases.
- Cost shape (from p4/p5 logs): ~20-turn grounded arm ≈ 19–25 min wall,
  ~80 codex + ~20 sonnet calls; ×5 serialized, attended, human-gated.
- For E4's later registration, one measured pointer: the cheapest charter fix
  the data suggests is an asymmetric license (early bends need a stronger
  warrant than late holds) — every observed fatality is early-side and the late
  side is map-safe almost everywhere. Not licensed here; E4's question.

Standing caveats unchanged: D-blindness (meter frozen); formal-channel verdicts
only; mock conduct is not a stand-in for real (mock lantern arms disengage at
cap where real arms ground or die — different regime, kept split).
