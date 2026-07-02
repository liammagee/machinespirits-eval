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
