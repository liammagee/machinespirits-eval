# Plan-Mode Stock-Take — Pre-registration

**Status:** **FROZEN 2026-07-04 at this commit** (operator go received). Implementation gated 34/34 incl. L7; tests 21/21; the plan-mode analysis design entry and both matrix specs were added and zero-paid validated (24-run mock matrix, 0 guardrail failures) BEFORE this freeze. No design, endpoint, or analysis change past this point.
**Line:** `workplan/items/plan-mode-stocktake.md` — a NEW hypothesis, mechanistically distinct from the closed strategy-ledger commitment line (see "What this is not," below).
**Operator articulation being tested (2026-07-04):** the outer loop as a *stock-take* — an inner monologue between ego and superego with a different functional question than the turn-based exchange ("is the current course still the right one?"), asking for course correction and planning; the equivalent of a plan mode.

## Question

Does a **dialogic, diagnostic, off-the-clock, reorienting** outer loop — a between-scene stock-take in which the tutor's second voice diagnoses the sealed scene from public evidence and demands course corrections, answered by the ego as a revised *working orientation* that replaces its strategy frame — improve dialogue outcomes over no outer loop, under binding conditions?

## What this is and is not (the four deltas from the closed line)

| Dimension | Closed commitment line (killed) | Plan mode (this test) |
|---|---|---|
| Voice | Monologic (fields in the ego's own call) | **Dialogic** (a separate stock-take call under its own diagnostic charter, then the ego's answer) |
| Question | "Did you keep your plan?" (conformance) / "which mechanism next?" (selection) | **"Is the course still right?"** (situation appraisal) |
| Clock | On the dialogue's turn budget | **Off it** (one extra superego-side call per scene boundary; zero stage turns) |
| Channel | Held commitment + audit binding the next opening (course-holding) | **Frame replacement** (the reorientation rewrites the working orientation; no audit, no drift-grading, nothing held against the tutor) — the load-bearing channel from the adversarial-superego result |

Precedent for: the adversarial-superego v3 result (advisory 20 ≪ adversarial 85; prompt-rewrite channel load-bearing) and the confirmatory V2b failure pattern (the ledger arm's losses were stalls/disengagements — dramas needing a course *change* that the held plan suppressed). Precedent against: four instruments showing open-ended reflective judgment redundant with the model's own in-context reads. The design gives the second voice what the winners had — an evidence-anchored charter and frame-level authority — and withholds what the losers had — conformance pressure and stage-clock cost.

## Implementation under test (landed; opt-in; conduct-only)

`--strategy-ledger '{"planMode":true}'` — mutually exclusive with `trialling`; suppresses ALL commitment machinery (no scene commitments, no conformance audits) while keeping the ledger's bookkeeping (blocks, clearance, counters, sealed-scene summaries) as the stock-take's **evidence**. At each scene opening with a sealed scene: one `tutor_superego` call under the stock-take charter (public record + ledger evidence + current orientation; output `{assessment, correction|null}`), then the ego's opening-turn call answers in `reorientation` (2–4 sentences), which **replaces** the standing "YOUR WORKING ORIENTATION" prompt section. Proof control untouched (gate L7-fingerprint: byte-identical on/off). Validation: gates 34/34; tests 21/21; no commitment/audit events under plan mode; every demanded correction answered in mock.

## Arms (two)

| Arm | Label | Delta |
|---|---|---|
| A | `baseline` | — |
| B | `plan-mode` | `--strategy-ledger '{"planMode":true}'` |

Binding base (identical to the V2b confirmatory, both arms): `--scene-mode --didactic-mode --register modern --release-authority --pacing-guard --decay '<per-repeat seeds>'`. Superego (turn-watch) OFF in both arms — the stock-take is the only second voice, so the contrast isolates it.

## Worlds, repeats, seeds

`world-010-hethel-resistant` + `world-005-marrick` (headroom established by the V2b confirmatory under these exact conditions — baseline grounded 0.50, failures common; no new headroom gate). 6 repeats per arm per world, interleaved, decay seeds **31, 37, 41, 43, 47, 53** shared within repeat pairs (fresh primes — no reuse of the confirmatory's seeds, so this is an independent draw of decay schedules). 24 runs, n = 12/arm pooled.

## Backend and execution (parallelized — amended 2026-07-04, pre-freeze)

`DERIVATION_PROVIDER=codex`, all roles, CLI default (recorded from the first diagnosis). **Concurrency 3 within each world block** (probed 2026-07-04: three concurrent `codex exec` sessions complete in ~12s vs ~19s serialized — the CLI genuinely multiplexes); blocks run sequentially with the usual checkpoint between them (projected wall-clock ≈ 1.5–2 h total vs ≈ 5 h serialized). Two fairness safeguards, pre-committed:

1. **Symmetric quota exposure.** The arm list stays pair-interleaved (`baseline-rN`, `plan-mode-rN`, …), so the concurrency pool keeps both arms in flight together — any provider throttling or quota-window degradation lands on both arms at once rather than biasing the contrast toward whichever arm ran in the cheaper hour. Total quota consumption is unchanged by parallelism; only the rate compresses, which raises the chance of hitting a rolling window cap mid-matrix — acceptable because:
2. **The interruption discipline is the mitigation** (proven twice in this arc): any stalled/killed runs resume via trimmed same-label specs, and pair-matched seeds keep a partially-complete matrix balanced and analyzable. Hang > 40 min → kill, one same-label retry; two failures exclude the label (reported).

## Endpoints (outcome-primary — the bar any strategic apparatus must now clear here is "no negative transfer")

Per run: `T*` = `assertedGroundedTurn`, cap+1 imputed (the frozen extractor).

- **PRIMARY (sole confirmatory endpoint): `T*`** (lower better) — the outcome composite (failures impute to cap+1), chosen over repair latency deliberately: the closed line improved a conduct channel while losing outcomes; this line is accountable to outcomes from the start.
- **Promotion bar (all three):** (1) direction consistent both worlds; (2) pooled one-sided Mann–Whitney U ≤ 42 at 12/12 (p < 0.05, calculation shown in the addendum); (3) all guardrails clean in the plan-mode arm — leaks 0, releases ≥ baseline − 0.5 per world, aporia-like ≤ baseline + 1 per world, guard overrides 0, stock-take coverage ≥ 0.8 of eligible openings.
- **Secondary (descriptive):** grounded rate, aporia-like rate, repair latency and repair share, reorientation rate (corrections demanded / answered), mode-flap, orientation length/character (qualitative color only).
- Analysis: the frozen `analyze-strategy-ledger-contrasts.js` `--design v2` extractors carry every endpoint (plan-mode arm maps to the `ledger-v1` label slot via the arm regex — the matrix labels will use `plan-mode-rN` and the analysis gains a one-line `plan-mode` design entry BEFORE the freeze; zero-paid validated first, as always).

## Outcomes and recorded consequences

- **Confirmed:** the dialogic/diagnostic/off-clock/reorienting cell of the outer-loop design space works where the monologic/conformance/on-clock cell failed — §6.13.16 gains the contrast as its closing turn, and a scaled or mechanism-localizing follow-up may be pre-registered.
- **Not confirmed:** the outer-loop line in this stack closes whole — both the course-holding and course-changing variants recorded as non-promotable; §6.13.16 records it with equal prominence; no third variant without stepping back from the engine itself.
- No re-rolls, no endpoint swaps, no post-hoc arms (§5.12.6).

## Artifacts

Specs `config/drama-derivation/matrix-specs/plan-mode-{hethel-resistant,marrick}.yaml` (written at freeze); runs under `exports/dramatic-derivation/matrix/plan-mode-<world>/`; report `exports/dramatic-derivation/strategy-ledger/plan-mode/`; zero-paid mock matrix through the frozen analysis before any paid run.

---

## Results addendum (2026-07-04; frozen analysis unmodified; report at `exports/dramatic-derivation/strategy-ledger/plan-mode/plan-mode-contrast-report.{json,md}`)

**Execution.** 24/24 runs, codex CLI, concurrency 3 with pair-interleaved arms (two interruptions; both resumed via trimmed same-label specs; the second stop landed exactly at the block checkpoint). Parallel wall-clock behaved as projected.

**Promotion bar: NOT MET (bar 1 passes; bar 2 fails; bar 3 passes).**

1. **Direction both worlds: PASS.** T\* 25.42 vs 26.92 (Δ = −1.50), lower in each world's stratum ([-1, -1]).
2. **Pooled one-sided Mann–Whitney: FAIL.** U = 55.5 > 42 (the exact one-sided 0.05 criterion at 12/12); z = (55.5 − 72)/√300 = −0.95, one-sided p ≈ 0.17. Directionally consistent, statistically underpowered at this n.
3. **Guardrails: PASS, 0 of 6 failed** — the first strategic apparatus in this arc with **no negative transfer on any channel**: aporia-like verdicts improved directionally (0.58 vs 0.75, both worlds), release discipline at parity, zero guard overrides, stock-take coverage 1.00.

**Recorded verdict (as pre-committed): NOT CONFIRMED — and the outer-loop line in this stack closes whole.** Both variants are now recorded as non-promotable: the course-holding commitment machinery (replicated local gain, consistent outcome cost) and the course-changing stock-take (consistent outcome direction, insufficient evidence at the pre-registered bar). Per the frozen consequences clause, no third variant runs without stepping back from the engine itself — an operator-level decision outside this line, requiring its own pre-registration.

**Descriptive record (equal prominence, no promotion weight — the pre-registration forbids endpoint swaps and this addendum honors that):**

- **Grounded rate 0.42 vs 0.17** (5/12 vs 2/12), higher in both worlds, meeting the descriptive signal rule — on precisely the endpoint the commitment machinery damaged. This seed draw was substantially harsher than the confirmatory's (baseline grounded 2/12 vs 6/12 there).
- **Repair latency worsens with signal** (10.95 vs 8.71, both worlds) — the exact **inverse trade** of the commitment ledger: course-holding sped the local repair channel and lost outcomes; course-changing spends the repair channel and gains outcome direction. The two variants are mirror images around the same fixed budget.
- The mechanism itself was flawless: 69 stock-takes, 15 corrections demanded, **15/15 answered** with reorientations; commitment machinery fully absent.
- What this licenses: a *descriptive* statement that the dialogic/diagnostic/off-clock/reorienting cell behaves differently in kind from the monologic/conformance/on-clock cell (no negative transfer; outcome-directional), available to any future operator decision to reopen with a properly powered, grounded-rate-primary design — outside this line, under a new pre-registration.
