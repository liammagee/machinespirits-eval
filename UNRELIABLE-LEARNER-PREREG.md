# Pre-registration: the unreliable-learner visibility contrast (v1)

**Status**: **COMPLETE** — registered 2026-06-11 before any arm-B build or paid contrast run; amended twice before any scored run; 12/12 amended runs completed and mechanically rescored.
**Base commit**: b0686fc9 (twin-fact alias fix; this document registers against that engine).
**Condition**: seeded decay of the learner's grounded board (`services/dramaticDerivation/corruption.js`) — a run-level condition; worlds stay frozen.
**Provenance chain**: design note [notes/poetics/2026-06-10-unreliable-learner-design.md] → mock survival map [exports/dramatic-derivation/adaptation-sweep-2026-06-11/SURVIVAL-MAP.md] + narrative [notes/poetics/2026-06-11-adaptation-survival-map.md] → first real probe [exports/dramatic-derivation/episodes/decay-probe-real-001/] → this registration.
**Paper destination**: the dramatic-derivation section series of `docs/research/paper-full-2.0.md` (single-paper discipline; no spin-off).

## 1. Question

Does an LLM tutor's repair of decayed evidence depend on being *told* what slipped, or can it infer decay from the learner's conduct alone? Two arms, identical except for one prompt block:

- **Arm A (told)**: the tutor ego's user prompt carries the harness's ground truth — the `SLIPPED FROM THE BOARD` block (`services/dramaticDerivation/llmRoles.js:448-457`, the only render site). This is current behavior and the regime of the first real probe.
- **Arm B (conduct)**: the block is suppressed by a dial (gate G3 below). The engine's view object still carries `view.corruption` — instruments, scorers, and the corruption report keep ground truth; only the tutor-facing *prompt text* changes. The learner is blind to the condition in both arms (no corruption text reaches learner or director prompts — asserted by the G3 regression test).

**Registered prior**: this repo's standing result is that explicit state channels are usually redundant with what a strong model infers in-context (four ToM-redundancy instruments to date: ontology ToM-feedback null, stall-watcher precondition null, §6.7–6.10 motif, adaptive-persona verdict). Arm B matching arm A would be the fifth instance and is a live possibility, not a failure of the experiment. Arm B *dropping* would be the first case where the explicit channel is load-bearing — because here the signal (absence of a fact from a mind) is genuinely missing from the text unless conduct reveals it.

This is a question about reading **board state from dialogue conduct** — a text-internal capability. It is not framed as mind-reading or detection of interior states.

## 2. Frozen detector (the stall clock)

Verdicts under decay are partly detector economics, so the detector is registered verbatim.

`detectStall(trajectory, window, firstReleaseTurn)` — `services/dramaticDerivation/slope.js:31-44`:

- Needs at least `window` trajectory points; examines exactly the last `window`.
- Inert until the tail begins at or after the first release turn (a flat overture is not a stall).
- Null if the last point has D = 0.
- **disengagement** if no adjacent pair in the tail shows `groundedCount` growth (checked first).
- **aporia** if grounded growth exists but no adjacent pair shows a strict D decrease.

Engine integration (`services/dramaticDerivation/engine.js`):

- Called once per turn at line 466 with `world.slope.aporia_window`, after the learner acts, **before** the decay draw.
- `stopOnStall: true` is the engine default (line 61) and **no caller overrides it** — not the loop runner, not the episode runner, not the mock sweep harness. A stall fire ends the run (`endedBy = stall`), and the decay draw is skipped on that turn (line 478 guards on `!endedBy`). The mock anchors below and the live arms therefore run under the identical regime.
- Decay eligibility (lines 478-491): released premises only (background immune); grace counted from `regroundedTurn ?? turn`, so every repair re-arms eligibility; one PRNG draw per eligible entry per turn in board insertion order; `maxConcurrent` caps landings, never draws.

Per-world parameters (from the world YAMLs, frozen):

| world | `slope.aporia_window` | `turn_cap` |
|---|---|---|
| 001-nocturne | 8 | 40 |
| 004-withercombe | 6 | 24 |

## 3. Condition cells

**Primary cell (the paid contrast)**: `rate 0.75, graceTurns 1, maxConcurrent 2, startTurn 1`. Chosen because it is the most discriminating cell on the two paid worlds: the no-policy floor and the always-repair baseline are pulled apart from the targeted policies, and the cell carries an in-cell parsimony contrast (see anchors).

**Secondary cell (registered contingent extension, not part of the v1 paid budget)**: `rate 1.0, graceTurns 0, maxConcurrent 2, startTurn 1`. At grace 0, every-turn repair is hard-capped by forced disengagement (survival-map finding 6) — verdicts in this cell are partly detector accounting. **Interpretation rule, registered now**: in this cell only per-slip endpoints are interpreted; verdict rates are reported but carry no evidential weight. If quota allows after the primary cell completes, the same 12-run shape may be run here without further registration.

Rejected cells, for the record: `rate 1.0/grace 0/maxConcurrent 4` (all four anchors at 0/10 on these worlds — no headroom for a contrast); `startTurn 12` variants (less discriminating; decay-from-turn-1 stresses the whole arc).

## 4. Mock anchors (seeds 1-5 × both worlds; archived under `exports/.../summaries/postfix/anchor-*.json`)

All anchors post-date the alias fix. Mock learner throughout (no re-adoption mechanism), so `repairs.byReadoption = 0` by construction.

**Primary cell** (10 runs each):

| policy | success | decay/run | tutor repairs/run | per-slip repaired | mean latency |
|---|---|---|---|---|---|
| s00 none (incidental floor) | 0/10 | 3.0 | 1.0 | **0.33** | 1.0 |
| s01 every-turn FIFO | 5/10 (noc 4/5, wit 1/5) | 18.8 | 17.8 | 0.95 | 1.7 |
| blocking-greedy-clean | 10/10 | 21.4 | 20.4 | 0.95 | 1.4 |
| stall-clock-surfing | 10/10 | 2.4 | 1.4 | **0.58** | **16.0** |

**Secondary cell** (10 runs each): s00 0/10 (per-slip 0.60), s01 0/10 — all ten by disengagement, the finding-6 treadmill — (per-slip 0.96), blocking-greedy-clean 10/10 (0.96), stall-clock-surfing 10/10 (0.50, latency 20.5).

Two anchor facts shape the endpoints:

1. **Latency cannot be the endpoint.** Stall-clock-surfing is a 10/10 policy with mean latency 16 — a "repaired within k turns" endpoint would score the best policy as negligent.
2. **A bare per-slip rate cannot be the sole use-criterion.** Surfing repairs only 0.58 of slips (fallow decayed premises draw no PRNG — leaving a slip to rot is sometimes optimal), while the *incidental* floor reaches 0.60 at the secondary cell. Rate must be paired with a selection signature.

## 5. Endpoints (all mechanical — no LLM judge in the primary chain)

Scored from run artifacts only: the corruption report (`services/dramaticDerivation/diagnose.js` `corruptionReport`), the release ledger, and the world YAML. This keeps the scoring channel architecture-independent.

- **Primary**: pooled per-slip tutor-repair rate per arm = `repairs.byTutor / decayEvents`, summed over the arm's runs before dividing. Cross-check: `(decayEvents − unrepairedAtEnd) / decayEvents` (equal when `byReadoption = 0`; a divergence means G2 failed mid-experiment and is reported as such). Per-run rates reported descriptively alongside.
- **Secondary**: success rate (`grounded_anagnorisis`); stall-fire rate (runs ended by disengagement/aporia); decay events/run; tutor repairs/run.
- **Descriptive style metrics**: `meanRepairLatency` (eager ≈ 1-2 vs surfing ≈ 16-20); repair-target composition (below).

**Selection signature** (for H1b): a tutor repair counts as *selected* when its target premise (i) is **not** the most recent release in the ledger at the repair turn, and (ii) is **derivation-critical** — its premise id appears in some authored `proofPaths[*].premises` list of the world. The incidental mechanism (the plain consolidate branch re-touching `lastRelease`) can produce neither-(i) repairs only. Both paid worlds are twin-free (verified during the alias audit), so premise ids are unambiguous here.

## 6. Hypotheses

- **H1 (arm A uses the channel)** — supported if **either**:
  - **H1a**: arm-A pooled per-slip repair rate ≥ 0.66 (2× the primary-cell incidental floor of 0.33), **or**
  - **H1b**: selected repairs (per §5) average ≥ 1 per run **and** make up ≥ 50% of arm-A tutor repairs.

  Anchor separation: s01, blocking-greedy, and surfing each pass at least one branch (s01/bgc via H1a at 0.95; surfing via H1b — its 1.4 repairs/run target projected-stall blockers, which are derivation-critical by construction); the s00 floor fails both (0.33 rate; zero selected repairs — its incidental repairs target `lastRelease` by definition). The n=1 real probe's conduct (latency-1 repair of a non-lastRelease, derivation-critical premise, against the release habit) passes both branches.

- **H2 (visibility is load-bearing)** — one-sided: arm-B pooled per-slip repair rate < arm A. The **gap** is the measured quantity; report it with a bootstrap CI over runs (10,000 resamples, run-level). No significance test is registered at n = 6/arm — direction plus interval, and the registered prior in §1 makes a null (B ≈ A) the fifth redundancy instrument, reported with equal prominence.

- **H3 (exploratory, parsimony)** — does the live arm-A tutor avoid the re-arming treadmill? Decay events/run nearer the surfing anchor (2.4) than the eager anchors (≈ 19-21) would indicate it does. The probe hints the opposite (eager, latency 1, slot re-filled same turn). Descriptive only.

**Outcome map, registered**: A uses + B matches → telling is redundant; conduct suffices (fifth redundancy result). A uses + B drops → the explicit channel is load-bearing; the gap prices what conduct alone cannot recover. A fails H1 → the channel goes unused even when told; the v2 conduct question is moot and the survival map's tutor-side ceiling is academic for live casts. Any B > A reversal at meaningful size would most plausibly indicate a prompt-regression in the dial build and triggers a G3 re-audit before interpretation.

## 7. Gates (all must pass before paid arms)

- **G1 — twin-fact alias fix**: DONE (commit b0686fc9; regression test `tests/dramaticDerivationCorruption.test.js` pins decay/repair identity to the released twin; post-fix re-measurement archived in SURVIVAL-MAP.md).
- **G2 — no spontaneous re-adoption by the real learner** (an s02-like learner erases the tutor contrast): across ≥ 3 real-LLM episodes under the primary cell, `repairs.byReadoption = 0` and no transcript evidence of the learner re-asserting decayed facts unprompted. **SATISFIED 2026-06-11**: decay-probe-real-001 (nocturne t20-23, seed 1), decay-probe-real-002-noc-late (nocturne t26-29, seed 2), decay-probe-real-003-wit (withercombe t12-15, seed 3) — `byReadoption = 0` in all three; 12 live learner turns, two worlds, three seeds. Conduct note recorded with the episodes: the learner sometimes continues to assert *derived conclusions* whose premise support has lapsed (stale residue, e.g. ep2 t27) — it never re-states the decayed premises themselves. This residue is the mechanism that makes arm B non-trivial: conduct need not betray a slip.
- **G3 — arm-B build + blindness regression test + mock rehearsal**: a dial in `llmRoles.js` suppressing the SLIPPED block; a test asserting that with the dial set (a) no corruption-derived string reaches **any** tutor-side prompt, and (b) learner and director prompts carry none in **either** arm; then one full mock loop run per arm with decay on, confirming identical engine-side artifacts (corruption ledger present, report well-formed) and that only the tutor prompt text differs. **SATISFIED 2026-06-11**: `decayVisibility: 'told'|'conduct'` option on `makeLlmTutor` (default `told`; the conduct value suppresses the SLIPPED render — one edit point covers both ego passes, since the revision prompt embeds the ego user prompt); `--decay-visibility` flag on `run-derivation-loop.js` (echoed in the config printout, persisted in diagnosis.json, refused without `--decay`) with episode-runner inheritance + override. Three regression tests in `tests/dramaticDerivationCorruption.test.js`: value validation throws; told renders the block while conduct is **byte-identical** to a corruption-free render (user and system prompts); end-to-end mock drama with superego on — under told the notice reaches only tutor-ego prompts, under conduct no role's prompt carries it, and the formal channel (corruption ledger, D-trajectory, release ledger) is invariant across arms. Mock rehearsal of both arms on nocturne (primary cell config, seed 1): identical formal channels, `decayVisibility` persisted, corruption artifacts well-formed. Full suite 3512 pass / 0 fail.

## 8. Run plan

**Shape**: 2 worlds × 3 decay seeds × 2 arms = **12 paid loop runs**, primary cell only.

- **Worlds + casts pinned to their recorded no-decay baselines** — each world's decay arms are configuration-identical to its baseline except the `--decay` flag (and the arm-B dial):
  - 001-nocturne: tutor-script `nocturne-v002`, `--superego` (charter-v2 rut-watcher), baseline `nocturne-v002-real-superego-on-t1-charterv2`.
  - 004-withercombe: tutor-script `withercombe-v001`, `--superego --stall-watch`, baseline `withercombe-v001-real-sw-on-t1`.
- **Casting** (unchanged from the baselines and the probe): director claude/opus *(superseded by the second 2026-06-11 amendment below: director is codex for all 12 runs)*; tutor codex; tutor superego codex; learner claude/sonnet (pinned); per-run critic's notice stays on (Fable, pinned role) — interpretive color, outside the scoring chain.
- **Decay seeds {1, 2, 3}** per world, identical sets across arms — but **not matched pairs**: the draw sequence is a pure function of (seed, role outputs), and role outputs differ across arms, so the comparison is distributional (survival-map recommendation 6).
- **Invocation** (arm A; arm B adds the G3 dial flag):

  ```bash
  node scripts/run-derivation-loop.js --real \
    --world config/drama-derivation/world-001-nocturne.yaml \
    --script config/drama-derivation/tutor-scripts/nocturne-v002.md \
    --superego --group unreliable-v1 \
    --decay '{"seed":1,"rate":0.75,"graceTurns":1,"maxConcurrent":2,"startTurn":1}' \
    --label noc-decay-v1-A-s1 --note "unreliable-learner v1, arm A (told), seed 1"
  ```

- **Order**: serialized and attended (one run at a time, human checkpoint between runs — Max-plan quota discipline). Arm order counterbalanced within world: nocturne seeds 1/2/3 run A-B, B-A, A-B; withercombe runs B-A, A-B, B-A.
- **Budget**: ≈ 4 CLI calls/turn (director, tutor ego, tutor superego, learner) + per-run critic. Nocturne cap 40 → ≤ ~170 calls/run; withercombe cap 24 → ≤ ~105; stall-ended runs cost less. Twelve runs ≈ 1,200–1,600 plan-quota calls.
- **Exclusions / infra rules**: a run that dies on infrastructure (CLI timeout, malformed JSON beyond the runner's retries) is re-run with the same seed and logged. A frozen-channel schedule violation (release ledger diverging from the world schedule) invalidates the run and halts the experiment for investigation — expected never (0 violations across 313,449 mock runs).

## 9. What this registration does not cover

Changes to worlds, detector windows, decay semantics, endpoints, or hypothesis thresholds after the first paid run require a dated amendment section below, before the affected runs.

## Amendments

**2026-06-11 (clarification, before run 1 — no protocol change).** §8's casting parenthetical "(unchanged from the baselines and the probe)" is inaccurate for one role: the withercombe baseline `withercombe-v001-real-sw-on-t1` ran a **codex** director, while the registered casting (and all three G2 probe episodes, both worlds) uses **claude/opus**. The explicit registered casting governs: all 12 runs use director claude/opus. Consequence: the withercombe no-decay baseline differs from its decay arms in director casting as well as in `--decay`; this touches only exploratory baseline color, not H1/H2 (within-experiment, casting-identical across arms) and not H3 (anchored on the mock survival map, not the real baselines).

**2026-06-11 (protocol change, before any scored run): director casting claude/opus → codex (cli default), all 12 runs.** Operator directive during the sequence ("use codex over opus" — Claude-plan quota conservation). To keep one casting across every scored run rather than splitting mid-experiment:

- **Run 1 superseded.** `wit-decay-v1-B-s1` (arm B, seed 1, opus director — complete, ended disengagement t7/24) is moved out of the scorer's scan to `exports/dramatic-derivation/superseded/wit-decay-v1-B-s1-opus-director/` and will be re-run codex-directed under the same label. Rationale: with a mid-sequence switch, arm B would carry the only opus-directed run — a one-sided casting confound on exactly the contrast under test.
- **Run 2 stopped mid-flight.** `wit-decay-v1-A-s1` (arm A, told, opus director) was killed at ~t11/24 before artifact write; no artifacts exist; it re-runs codex-directed.
- **Effect on the first amendment above**: inverted, not removed. The withercombe baseline discrepancy is resolved (baseline and decay arms now both codex-directed); the mirror discrepancy is created for nocturne (baseline `nocturne-v002-real-superego-on-t1-charterv2` ran an opus director; its decay arms run codex). Same standing: exploratory baseline color only — H1/H2 are within-experiment and casting-identical across arms; H3 anchors on the mock survival map. The G2 probe episodes (opus-directed) remain valid: the gate's conclusion (`byReadoption = 0`) concerns the learner role, which is unchanged.
- **Unchanged**: tutor codex, tutor superego codex, learner claude/sonnet (pinned), Fable critic; worlds, scripts, decay cell, seeds, arm order, endpoints, hypotheses, scorer.

## Results addendum — 2026-06-11, independently reverified 2026-07-14

The amended registered set is complete: two worlds × three seeds × two arms =
12/12 Codex-directed runs. The superseded Opus-directed `wit-decay-v1-B-s1`
remains outside the scorer's scan. The stopped Opus-directed arm-A attempt
produced no artifact. No endpoint, threshold, world, seed, or decay parameter
changed after registration.

Mechanical re-scoring from `diagnosis.json`, `result.json`, and the frozen world
YAMLs reproduces the archived result exactly after excluding the scoring
timestamp:

| arm | runs | decay events | tutor repairs | pooled per-slip | selected | completions | stall-ended |
|---|---:|---:|---:|---:|---:|---:|---:|
| A — told | 6 | 57 | 49 | **0.860** | 28 | 4 | 2 |
| B — conduct | 6 | 19 | 7 | **0.368** | 0 | 0 | 6 |

- G2 remained intact: `repairs.byReadoption = 0` in every scored run.
- The frozen release schedule remained intact: 94/94 releases on cue and zero
  schedule violations.
- H1a passed (`0.860 >= 0.66`) and H1b passed (4.67 selected repairs/run;
  57% of told repairs), so arm A used the explicit channel.
- H2 was supported: A - B = +0.491, run-level bootstrap 95% CI
  `[0.313, 0.746]`, 10,000 resamples, seed 20260611, zero reversals.
- H3 remains descriptive: 9.5 decay events/run in told versus 3.17 in conduct.

Authoritative scorer: `scripts/score-unreliable-learner.js`. Archived outputs:
`exports/dramatic-derivation/unreliable-v1-scoring/`. Interpretive record:
`notes/poetics/2026-06-11-unreliable-learner-results.md`. The canonical paper
fold-in is `docs/research/paper-full-2.0.md` §6.13.7, with the revision-history
entry already present. The licensed reading is scope-bound: harness-owned
hidden state was load-bearing for repair in these two simulated worlds and this
cast; this is not a human-learning or general mind-reading claim.
