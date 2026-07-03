# Strategy Ledger v2 — Pre-registration (mechanism trialling under binding conditions)

**Status:** pre-registered 2026-07-03, BEFORE any paid run of this design. Implementation under test: Strategy Ledger v2 (`LAYERED-DECISION-LOOPS-PLAN.md` Part 6 + implementation status note; gates 30/30, tests 19/19 at commit `cad94eed`).
**Tier:** pre-registered **pilot**. Results land in `docs/research/paper-full-2.0.md` as a bounded pilot claim regardless of direction; no stronger claim without a scaled confirmatory run.
**Prior null this design answers:** Phase 3 (`STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md`) — null with unexercised levers on schedule-solvable worlds with a compliant learner. v2 therefore runs ONLY under binding conditions, behind a headroom precondition gate.

## Question

When strategy is a **choice among adaptive mechanisms, revised by reviewing the history of what was actually tried** (the v2 trialling loop: mechanism menu, treatment-fidelity gate, effectiveness review, licensed departures), does tutor conduct or dialogue outcome improve over (a) no ledger and (b) the v1 conformance-only ledger — under conditions where the levers can bind?

## Binding conditions (constant across all arms)

`--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '{"seed":11,"rate":0.25}'` — the §6.13-proven stack that gives outcomes headroom: the tutor owns release timing inside guard windows, and seeded decay makes the learner's board lossy (repair work exists; the drama can move backward). Superego OFF, critic OFF, no acts. Decay visibility stays the default `told`.

## Arms (single-delta ladder; staged)

| Arm | Label | Delta on top of the binding base |
|---|---|---|
| A2 | `baseline` | — |
| B2 | `ledger-v1` | `--strategy-ledger '{"registerPalette":["modern"]}'` (conformance loop only) |
| C2 | `trialling` | `--strategy-ledger '{"trialling":true,"stancePalette":["charismatic_challenge","ironic_challenge"],"releaseIntent":true,"registerPalette":["modern"]}'` |
| D2 | `trialling-learner` | C2 + `--learner-ledger` — **staged: runs only if C2 vs B2 shows any signal** (the learner machinery is v1-unchanged and was null in Phase 3; it earns a re-test only under a live tutor-side effect) |

Contrasts: **V2a** (trialling) = C2 − B2 (the v2 delta proper). **V2b** (any ledger at all under binding conditions) = B2 − A2 (re-tests Phase 3's E1 where levers bind). D2 − C2 only if staged in.

Stance palette discipline: one positive (`charismatic_challenge`) + one negative (`ironic_challenge`, explicitly listed — never organically selectable); `sarcastic_challenge` and `face_threat_challenge` excluded from this pilot. Release intent runs under the tutor's existing release authority; the pacing guard keeps final authority (gate `L5-guards-untouched` pins this).

## Worlds and repeats

- `world-006-hethel` (cap 26, t_min 18) with `tutor-scripts/hethel-v001.md` — the decay/repair arc's canonical world.
- `world-005-marrick` (cap 28, t_min 20) with `tutor-scripts/marrick-v001.md` — AND-join depth past the forcing turn.

3 repeats per arm per world, interleaved (r1 all arms, r2 …) → 18 runs for A2/B2/C2 (n=6/arm pooled); +6 if D2 stages in.

## Backend (operator-directed: codex CLI)

`DERIVATION_PROVIDER=codex` for all drama roles (model: the CLI's configured default, recorded from the first run's diagnosis; `DERIVATION_CODEX_REASONING` unset). Constant across arms and worlds. Probed latency ≈ 6 s/call → ≈ 8–12 min/run; the matrix runs serialized as two attended world-blocks (≈ 1.5 h each), pausable between blocks (Max-plan-style quota is meterless — human checkpoints between blocks apply quota knowledge). A run hanging > 40 min is killed and re-run once under the same label; two failures exclude the label (reported).

## Headroom precondition gate (H0 — runs BEFORE the matrix; failure stops everything)

1. **Zero-paid:** every arm config runs end-to-end on the mock backend (pipeline validity).
2. **Paid probe:** 2 × A2 runs on hethel (codex). REQUIRE: (a) T\* varies across the two runs, or at least one run does not ground at the first post-forcing turn; AND (b) ≥ 1 decay event with the repair channel exercised (a repair or re-adoption on the record). If flat → stop, redesign worlds/conditions, no matrix. H0 runs are design probes and never enter the contrast data.

## Endpoints (programmatic only; frozen analysis extended from Phase 3's script)

Per run: `T*` = `assertedGroundedTurn` (imputed cap+1 when absent).

- **Primary (V2a and V2b):**
  1. `T*` (lower better)
  2. Grounded rate (higher better)
  3. **Repair latency** (lower better): mean turns from each decay event to the first repair/re-adoption of that premise (cap-end imputed when never repaired)
  4. Stall/aporia rate (lower better)
- **Conduct endpoints (descriptive for V2b, primary for V2a):** mechanism-switch-after-failure rate in C2 (do reviews answer failed trials?); faithful-rate on negative-stance scenes (assigned vs faithful); mode-flap rate.
- **Estimands (C2):** reported BOTH as assigned-arm (every C2 run) and faithful-arm (C2 restricted to scenes whose fidelity gate returned `faithful` or `not_applicable`) — the landed register-arc vocabulary.
- **Guardrails (violation blocks any positive reading):** leaks = 0; `invalid_person_attack` = 0; pacing-guard override count = 0; missed-release/discipline stats in ledger arms not worse than A2 per world; aporia-like verdicts ≤ A2 + 1 per world; commitment coverage ≥ 80%; review coverage ≥ 80% of openings-with-history (C2).

## Decision rules

Pilot tier: a **signal** = same direction in both worlds AND pooled |Δ| ≥ 0.5 pooled SD. Mann-Whitney U descriptive; no significance claims at n=6/arm. Nulls reported with equal prominence. The Phase-3 lesson stands pre-committed: if C2's levers again go unexercised (no faithful negative-stance scene, no switch decisions, no repair pressure), that is an instrument finding to report, not a reason to re-roll.

## Exclusions / retries

Transport/CLI failures: one re-run under the same label; two failures exclude the label (reported). Parse-misses are data (coverage). No outcome-driven rerolls (§5.12.6).

## Artifacts

- Specs: `config/drama-derivation/matrix-specs/ledger-v2-{hethel,marrick}.yaml`
- H0 probe runs: `exports/dramatic-derivation/strategy-ledger/h0-probe/`
- Matrix runs: `exports/dramatic-derivation/matrix/ledger-v2-<world>/<arm>/`
- Analysis: `scripts/analyze-strategy-ledger-contrasts.js` extended (arm map + repair-latency + faithful-arm split) BEFORE the paid matrix and frozen thereafter → `exports/dramatic-derivation/strategy-ledger/v2-contrasts-report.{json,md}`

---

## H0 addendum (2026-07-03): first gate FAILED — redesign recorded BEFORE re-probe

**H0 result (hethel, 2 × A2, codex):** criterion (b) PASS — decay live (2 and 4 slips; repairs 0 and 2; repair channel exercised). Criterion (a) **FAIL** — both runs `T* = 20 = firstForcedTurn` (grounding at the designed earliest forcing turn). Diagnosis from the artifacts: decays hit only pre-forcing, non-critical premises; the final proof-critical release lands at t20 (hethel's authored earliest forcing); the learner asserts the same turn it is forced. With an instant-asserting learner, T\* is pinned to the release calendar regardless of tutor conduct.

**Redesign (per the pre-registered failure action):**

1. **World swap:** `world-006-hethel` → `world-010-hethel-resistant` (same geometry: t_min 18, cap 26; authored resistant clerk — "quick, defensive, status-conscious, reluctant to concede") — assertion becomes a negotiated act rather than a reflex, and resistance opens dialogue blocks. `world-005-marrick` stays (AND-join depth is its own headroom mechanism).
2. **Decay strengthened to mutation mode:** `{"seed":11,"rate":0.35,"mutateShare":0.5,"maxConcurrent":3}` — misremembered premises create false beliefs, retraction/revision work, and wrong-assertion pressure past the forcing turn.
3. Everything else unchanged (arms, endpoints, guardrails, decision rules, backend).

**H0′ re-probe:** 2 × A2 on world-010 + 1 × A2 on marrick under the redesigned stack; same two criteria. A second flat result stops the design again (no third redesign without stepping back from the pilot).

H0/H0′ probe runs are design probes; none enter the contrast data.

## H0′ result (2026-07-03): PASS — matrix authorized

- `h0prime-resistant-r1`: **aporia** at t25, never forced; 6 decays, 4 repairs.
- `h0prime-resistant-r2`: **disengagement** at t25, never forced; 5 decays, 2 repairs.
- `h0prime-marrick-r1`: grounded at T\*=28 (= cap; zero slack); 9 decays (1 mutation), 8 repairs, 1 false-form retraction.

Criterion (a) PASS — T\* now varies over {never, never, 28} and the baseline can fail outright; criterion (b) PASS — decay heavy and the repair channel exercised in every run. Note recorded for the reading: on the resistant world the contrast measures **rescue capacity** (baseline fails; can strategy machinery recover the drama?), and a floor is possible (if no arm grounds there, grounded-rate is uninformative on that world and T\*/repair-latency/aporia-rate carry the contrast). Conformance fix applied at this point, before any matrix run: T\* and repair-latency imputation corrected from `turnsPlayed+1` to the pre-registered `cap+1` (stall-stopped runs end early and must not impute better than grounded-at-cap runs); world caps pinned in the analysis.

---

## Results addendum (2026-07-03, same day; frozen analysis unmodified after the matrix)

**Execution.** 18/18 runs (hethel-resistant + marrick × baseline/ledger-v1/trialling × 3 interleaved repeats), codex CLI, two attended blocks, zero API dollars. Report: `exports/dramatic-derivation/strategy-ledger/v2-contrasts-report.{json,md}`.

**Guardrails: 12/13.** One FAIL: `releases-marrick-trialling` (mean releases 7.33 vs baseline 8.67) — driven by early-terminating trialling runs on marrick (one aporia at t8; two runs ending in ungrounded assertions). Per the pre-registration this **blocks any positive reading of the trialling arm** (none exists). All V2b arms passed every guardrail.

**V2b (ledger-v1 vs baseline) — one clean pre-registered SIGNAL, improving.** Repair latency 8.06 vs 11.23 turns (Δ −3.17, direction consistent in BOTH worlds, U = 8/36); repairs covered 61% of slips vs baseline's 50%. Other endpoints null. This is Phase 3's E1 re-tested where the levers bind, and the persistence machinery now helps on exactly the endpoint the binding conditions made live: a held, audited scene commitment gets slipped premises re-staged faster. Pilot tier: n=6/arm, no significance claim.

**V2a (trialling vs ledger-v1) — no improvement; one SIGNAL in the WRONG direction.** Repair latency worsens (+4.23 turns, both worlds, U = 29.5/36), grounded rate dips (0.50 vs 0.67), block engagement halves (20 vs 43 block rows), D-AUC worsens (3.53 vs 3.05). The v2 machinery itself functioned exactly as designed — review coverage 1.00, switch-after-failure 1.00, 27 negative-stance scenes with 19 faithful (70%), zero invalid person attacks, zero guard overrides — so this is not instrument failure. Two mechanisms are visible in the artifacts: (1) **opportunity cost** — strategy work (history review, stance performance, intent planning) competes with repair work at a fixed turn budget, and the repair benefit v1 buys is spent back; (2) **provocation side-effect** — on marrick, two of three trialling runs ended in `lucky_leap_only`: the ironic-challenge stance, faithfully performed against a resistant learner, provoked ungrounded assertions of S. The stance was instantiated correctly and its measurable consequence was premature closure.

**D2 (trialling-learner): not staged in.** The pre-registered gate ("only if C2 vs B2 shows any signal") is a permission gate, not a mandate; the only V2a signal is a worsening, and extending a net-negative arm answers no pre-registered question cleanly. Recorded as a decision, reversible by the operator.

**Bounded conclusions (pilot tier, single model family, simulated learner):**

1. Under binding conditions (resistant learner or mutation-decay, release authority + pacing guard), the **v1 commit/audit ledger improves repair latency** — the arc's first positive strategy-ledger signal, on the endpoint the conditions made live.
2. The **full trialling superstructure adds no measurable value over v1 and plausibly costs**: repair slows back past baseline, engagement with pressing episodes halves, and a faithfully-performed negative stance can provoke premature closure in a resistant learner. The house adaptivity finding extends by one clause: held commitments with audits are new signal that helps; an elaborate in-run review-and-trial apparatus on top re-encodes deliberation the model already does, and at fixed turn budget it **crowds out** the work that was helping.
3. The two-gate discipline (fidelity before effectiveness) worked end-to-end on live data and is worth keeping wherever mechanism menus exist.
