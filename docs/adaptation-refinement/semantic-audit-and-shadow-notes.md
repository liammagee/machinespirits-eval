# Semantic Audit + First Shadow Results

**Date:** 9 August 2026
**Status:** Working notes — answers the audit demanded by `normative-adaptive-dialogue-architecture.md` §4/§18/§19, plus first results from the Phase-1 trace-only prototype.
**Method:** direct reading of the tutor-stub runtime and its traces, plus two read-only codebase sweeps (DAG semantics; register ontology + PR 617 + Stage-1 freeze).

## 1. The §19 audit table, grounded

| Question | Existing implementation | Gap | Action |
|---|---|---|---|
| How is normative lesson progression represented? | Horn-clause worlds (`config/drama-derivation/*.yaml`): `premises[]` (clue leaves), `rules[]` (public lemmas), `secret`/`mirror`, `release_schedule[]` (authored turn + carrier per clue), `slope.t_min`/`aporia_window`, `turn_cap`. Enforced by `plotLint`, `scripts/lint-derivation-world.js`, `services/dramaticDerivation/pacing.js` (solvency, last-safe-turn), `services/tutorStubDialogueClosure.js` (closure). Per-turn obligations: `compileTutorStubTurnProgressionContract` + first-draft contract. | Norms are temporal/structural (when, who, solvency), plus per-turn obligations. No cross-turn pedagogical expectation ("after releasing p, expect the learner to voice X within k turns"). | extend |
| What descriptive dialogue state is stored? | Learner board (`grounded/belief_only/voiced_derived/...` fact statuses), `learner_dag_preflight` per turn (grounded, derivable, possible next derivations, hashed), post-run assessment with `bottleneck` labels, plus per-turn audits: live turn progression (uptake/development/handoff segments), repetition similarity, guard accounting, pacing signals. | Rich. Nothing missing for Phase 1 — the trace already carries the descriptive side. | reuse |
| How are failed repairs detected? | `tutor_response_fallback`, `tutor_response_guard_exhausted`, `tutor_response_mechanical_repair` events; uptake-audit issues; `program2StallAudit` (`stagnant_repeat`, frozen detector) in a separate subsystem; light-adaptation counter (`tutorStubLightAdaptation.js`, threshold 2–8). | Signals exist but none accumulate into a per-commitment evidence record; the stall auditor is not wired to any strategy/register decision. | extend |
| How are pedagogical figures represented? | Not represented. Nearest object: `actorial_parts` (`config/engagement-registers.yaml`) — per-turn, stance-coupled (e.g. satirist defaults to ironic/sarcastic stances). `action_families` (13 values) is the de-facto strategy level. | The design doc's "figure" maps best onto **action family** (see §3 below), not onto parts. Parts/stances are realization. | reinterpret |
| How are registers represented? | `engagement_stances` axis, ontology v5 (`register_ontology_version: 5`); edged stances `router_selectable: false`; manner is a *delivered realization* measured post hoc (`registerMannerPresence.js`, `registerStanceFidelity.js`), not an axis. | Clean. Reuse as-is. | reuse |
| What does PR 617 add? | Manner block appended to the tutor ego prompt after the persona (`buildTutorMannerBlock`), fixing prompt-isolation loss (irony died pre-ship); `dump-turn-prompts.js`; first switching-prereg draft. | Delivery path fixed; decision path untouched. | reuse |
| Which decisions are already logged? | Release ledger rows (turn, premise, via, optional declared reason), pacing updates with typed signal + reason string, register/policy composition changes, first-draft contracts, all audits. | Two holes: **hold decisions leave no artifact** (engine explicitly skips them), and no decision records *warrant* — reason strings are canned regex output, not evidence. | new |

## 2. What is genuinely absent (the layer to build)

Confirmed by grep and by both sweeps:

- **No defeaters anywhere.** `defeater|undercut|rebut` appears only as prompt prose (cell 192, id-director prompt). The chainer is monotone; rules have no exception conditions; nothing can be authored as "this commitment fails if X".
- **No commitment object binding behaviour.** `services/dramaticDerivation/strategyLedger.js` has the right shape (`register, releasePosture, exitCondition, persist|adjust|switch`) but is advisory by contract — it may never gate a release or repair. Closed arc: do not rebuild its overlays; the shape is still the right template for a *typed record*, not a control channel.
- **No expected-uptake events.** `exit_condition` is free text checked by regex. Nothing predicts a DAG state ("learner voices `failedThrough(...)` by turn N") that later evidence could satisfy or defeat.
- **No warrant threshold at any switching decision.** The register router (`engagementModeRouter.js`) is a one-turn regex chain — exactly the "shift on a single negative signal" the design doc rules out. The only hysteresis switch in the repo is `tutorStubMannerSwitch.js` (accumulator, on-at-2/off-at-0) — the right pattern, wrong object (manner cards).

## 3. Terminology mapping (design doc → repo)

| Design doc | Repo object | Note |
|---|---|---|
| Normative trajectory | world YAML + `release_schedule` + slope + closure conditions | temporal/structural only |
| Descriptive trajectory | learner board + preflight + live audits | already trace-complete |
| Commitment | `action_family` held across turns (derived); strategy-ledger fields (advisory) | nothing holds it today |
| Warrant | — (audited post hoc in `tutorStubWarrantPremiseAudit`, content plane only) | absent on the interactional plane |
| Defeater | — | absent everywhere |
| Pedagogical figure | ≈ `action_family` (13 values) | NOT `actorial_parts`; parts are performance |
| Register | `engagement_stance` (v5 axis) | reuse |
| Linguistic device / manner | manner presence, measured post hoc | not an axis; keep it that way |
| Divergence engine | partial: pacing signals, stall audit, uptake audit — unaggregated | new aggregation layer |
| Adaptive trace (§14) | derivable from existing trace events | see §4 |

## 4. Phase-1 prototype: `scripts/derive-adaptive-warrant-shadow.js`

Trace-only, no behaviour change, no model calls. Replays a `.tutor-stub-traces/*.jsonl` and derives per tutor turn: the held strategy commitment (action family + streak), its realization (stance/part/tactic), warrant evidence (DAG growth, clean uptake, low repetition), defeater evidence (no growth, uptake issues, high repetition, guard/fallback events, pacing decel), typed divergence rows (conceptual/interactional/pacing with magnitude + persistence), a threshold warrant verdict, and the comparison with what the stub actually did next turn (`warranted_and_revised` / `warranted_but_held` / `revised_without_warrant` / `aligned_hold`).

First results on two real July sessions (18- and 17-turn traces):

1. **Failing strategies are held past warrant.** In both traces `reanchor_public_evidence` was held 4 consecutive turns with zero learner-record growth. The warrant threshold (2 defeater-bearing turns) crossed at streak 2; the stub revised at streak 4 in one session (`warranted_and_revised`, two turns late) and never in the other (`warranted_but_held` to session end).
2. **Realization churns while the commitment holds.** Under the held strategy, stance jittered warm→plain→warm→precise. The per-turn selector varies register freely while the strategy stays fixed — supporting the doc's two-level claim, and giving the shadow a clean definition: revision = family change; churn = realization change.
3. **The representation explains existing sessions** — every verdict above was computed from events the stub already logs. Phase 1's question ("does the representation explain existing conversations?") gets a provisional yes.

Caveats: v0 thresholds are guesses; commitment = action family is an interpretive choice; the `dag −1` observed once (turn 5, trace 2) needs explanation before the growth signal is trusted; one trace file can hold several sessions (settings restarts) and segmentation is heuristic.

## 5. Proposed next steps

1. **Gold-annotate the two replayed sessions** (§17 corpus, items 1–2): mark each turn revision-warranted / not / uncertain, and compare with the shadow's verdicts. Borderline and productive-divergence dialogues still need to be found or generated.
2. **Expected-uptake events as the first normative extension:** attach to each release an authored expectation (`voiced target fact within k turns`) — the world YAML already names the fact each premise supports; the chainer can compute which derivation a release unlocks. This turns "no_dag_growth" from a global stall counter into a per-release defeated expectation.
3. **Record hold decisions.** The engine skips them; the shadow cannot see "considered and rejected" revisions. One trace event fixes it.
4. **Only then** consider wiring a warrant threshold into a live decision (the manner-switch accumulator pattern, applied at the action-family level) — as a cell against the uninstrumented stub, per §15.7.
