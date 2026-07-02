# Strategy Ledger Phase 3 — Pre-registration (E1 / E2 / E3)

**Status:** pre-registered 2026-07-03, BEFORE any paid run. Implementation under test: Strategy Ledger v1 (`LAYERED-DECISION-LOOPS-PLAN.md` Phases 0–2, branch `worktree-strategy-ledger`, gates 22/22).
**Tier:** pre-registered **pilot** (small n). Whatever the direction, results enter `docs/research/paper-full-2.0.md` as a bounded pilot claim; no promotion beyond that without a scaled confirmatory run.

## Question

Does giving the agents scene-scoped strategy commitments that are held and audited (the commit/audit loop) change dialogue conduct and outcomes, relative to the same per-turn advisory machinery without persistence?

## Arms (single-delta ladder; everything else identical)

| Arm | Label | Flags on top of base |
|---|---|---|
| A | `baseline` | — |
| B | `ledger` | `--strategy-ledger '{"registerPalette":["modern"]}'` (persistence machinery, no register choice: palette of one) |
| C | `ledger-palette` | `--strategy-ledger '{"registerPalette":["modern","period"]}'` (register becomes a scene-scoped decision) |
| D | `ledger-learner` | arm B + `--learner-ledger` (the learner's own scene intents + act carries) |

Base (all arms): `--scene-mode --didactic-mode --register modern`, superego OFF, critic OFF, free dramaturgy, no decay, no acts (scene scope is the unit under test; act-scope machinery was validated separately in §6.13's plot/throughline arc).

**Contrasts:** E1 (persistence) = B − A. E2 (register-as-decision) = C − B. E3 (learner mirror) = D − B.

## Worlds and repeats

- `world-003-bitterwell` (turn cap 20, t_min 13) with `tutor-scripts/bitterwell-v001.md`
- `world-009-ravensmark` (turn cap 24, t_min 10) with `tutor-scripts/ravensmark-v001.md`

Chosen for: real (non-smoke) authored worlds, the two shortest with paired scripts, different proof geometry and pacing windows. **3 repeats per arm per world** → 24 runs, n=6 per arm pooled. Repeats interleave (r1 all arms, r2 all arms, …) so an interrupted matrix stays balanced.

## Model / backend policy (decided by probe, constant across arms)

OpenRouter account balance at pre-registration: **≈ $5.89 remaining** (probed 2026-07-03) — a hard external ceiling. Policy:

1. Probe run (1 × arm C, bitterwell) on `openrouter` / `gemini-flash` (the engine's default alias). If **commitment coverage ≥ 80%** (strategy_commit events / scene openings) and JSON discipline holds, the full matrix runs on gemini-flash (projected ≈ $3–4 total, inside the ceiling).
2. If coverage < 80% (instrument-limited on the extra JSON field), fall back to the **claude CLI bridge** (`DERIVATION_PROVIDER=claude`, model `sonnet`; Max-plan quota, serialized, attended) at the same design.
3. The chosen backend is a constant across all arms and both worlds; mixing backends across arms voids the contrast.

Hard abort: stop and check in if projected API spend exceeds **$5.00** or the balance probe between world blocks shows < $1.00 headroom.

## Endpoints (all computed programmatically from `result.json` — no LLM judge anywhere in the primary chain)

Per run: let `T*` = `assertedGroundedTurn`, imputed `turn_cap + 1` when null (never asserted).

- **E1 primary (B vs A):**
  1. **Mode-flap rate** = (# consecutive didactic-mode row pairs with different `recommendedMode`) / (rows − 1). Computable identically in both arms (the didactic dial is on everywhere).
  2. **Time-to-recognition** = `T*` (lower is better).
  3. **Grounded rate** = share of runs with verdict `grounded_anagnorisis`.
- **E1 secondary (descriptive only):** D-AUC = mean of `trajectory[].D`; block clearance rate and commitment-audit kept/drift mix (ledger arms only — own-bookkeeping, never a contrast endpoint).
- **E2 primary (C vs B):** the same three endpoints. **E2 descriptive:** register-switch count, share of scenes committed off-base, drift rate of the register clause.
- **E3 primary (D vs B):** `T*`; voiced-derivation count (`inference.voiced.length`); overreach count (`inference.overreaches.length`); hypothesis count.
- **Guardrails (every contrast; violation blocks any positive reading):**
  1. `leak` events = 0 in all arms.
  2. Release discipline: missed scheduled releases in ledger arms ≤ baseline arm (per world).
  3. Aporia/disengagement verdicts in ledger arms ≤ baseline + 1 run (per world).
  4. Instrument validity: commitment coverage ≥ 80% of scene openings (arms B/C/D); learner intent coverage ≥ 80% (arm D).

## Decision rules (pilot tier)

- A **signal** = same direction in BOTH worlds AND pooled |Δ| ≥ 0.5 pooled SD for that endpoint. Anything else is a null or "insufficient at pilot n".
- Mann-Whitney U reported descriptively; **no significance claims at n=6/arm**.
- Negative or null results are reported with the same prominence as positive ones.
- No paper claim above "pre-registered pilot, methods-validated" without a scaled confirmatory run (pre-registered separately).

## Exclusions / retries

- A run that dies on a transport/provider error is re-run once under the same label; two failures excludes that label (reported).
- Parse-misses on commitment fields are DATA (visible uncommitted scenes count against coverage), never exclusions.
- No other exclusions; no outcome-driven rerolls (§5.12.6 discipline).

## Artifacts

- Specs: `config/drama-derivation/matrix-specs/ledger-phase3-{bitterwell,ravensmark}.yaml`
- Runs: `exports/dramatic-derivation/matrix/ledger-phase3-<world>/<arm>/`
- Analysis: `scripts/analyze-strategy-ledger-contrasts.js` → `exports/dramatic-derivation/strategy-ledger/phase3-contrasts-report.{json,md}`
- The analysis script is validated end-to-end on a zero-paid mock matrix BEFORE the paid matrix runs, and is not modified after the paid data lands (any post-hoc analysis is labeled post-hoc).

---

## Results addendum (2026-07-03, same day; analysis script unmodified)

**Execution.** 24/24 runs completed on `openrouter`/`gemini-flash` (one matrix interruption mid-block; the five remaining labels re-ran under the pre-registered retry path, interleaving kept arms balanced throughout). Probe + matrix total spend ≈ **$1.97** (balance $5.89 → $3.92). Report: `exports/dramatic-derivation/strategy-ledger/phase3-contrasts-report.{json,md}`.

**Guardrails: 15/15 PASS.** Zero leaks; release counts identical to baseline in every arm×world (7.00 bitterwell, 5.00 ravensmark); zero aporia-like verdicts anywhere; commitment coverage 1.00; learner-intent coverage 1.00.

**Pre-registered outcome: NULL on all three contrasts.** No endpoint met the signal rule (consistent per-world direction AND |Δ| ≥ 0.5 pooled SD):

- E1 persistence: flap 0.12 vs 0.10 (Δ +0.02, direction inconsistent); time-to-recognition 15.33 vs 15.00; grounded 1.00 vs 1.00.
- E2 register-as-decision: flap 0.14 vs 0.12; T* 15.17 vs 15.33; grounded 1.00 vs 1.00.
- E3 learner mirror: T* 15.17 vs 15.33; voiced 1.50 vs 1.83; overreach 0 vs 0; hypotheses 13.33 vs 13.83.

**Two instrument-limiting conditions, visible in the data (not post-hoc excuses — both are measurable in the artifacts):**

1. **Outcome ceiling.** Every run in every arm reached `grounded_anagnorisis`, almost all at the first post-forcing turn (T* ≈ 15 in both worlds). The outcome endpoints had no headroom; these worlds under this model are solved by the schedule alone.
2. **The distinctive levers went unexercised.** The tutor chose the base register in **every scene of every palette run** (0 switches / 24 opportunities — offered the choice, it declines the costume); dialogue blocks barely opened (1–3 per arm across 6 runs — the flash learner rarely gets confused/resistant in these worlds), so the hold/escalation machinery ran idle; baseline flap was already low (0.10–0.12), leaving little flap to remove.

**Descriptive color:** the commitments were real decisions (varied didactic defaults, hold→consolidate posture shifts, budgets 1–3) and the audits did real work (~35–40% of clauses drift rather than rubber-stamp kept). Conduct changed visibly at the commitment layer; outcomes did not move.

**Bounded conclusion (pilot tier).** At pilot scale, on schedule-solvable worlds with a compliant learner, adding held-and-audited scene commitments (tutor or learner) neither helps nor harms: conduct machinery engages fully, proof conduct is untouched (guardrails), and no pre-registered endpoint moves. This is consistent with the repository's standing adaptivity finding — gains come from new signal, not from re-encoding decisions the model already makes acceptably. A signal, if one exists, requires conditions where the levers bind: worlds with genuine confusion/resistance pressure (blocks), register pressure (a reason to switch), and outcome headroom (no forcing-turn ceiling). Any such follow-up is a separate pre-registration; this pilot's null stands as recorded.
