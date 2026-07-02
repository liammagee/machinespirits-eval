# Layered Decision Loops — Review and Plan

**Status:** v0.2 (2026-07-02). Review findings verified against source. **Phases 0–2 sanctioned and IMPLEMENTED** on branch `worktree-strategy-ledger`: `services/dramaticDerivation/strategyLedger.js` + engine/bridge wiring, opt-in dials `--strategy-ledger` / `--learner-ledger` on `scripts/run-derivation-loop.js` (both require `--scene-mode`). Acceptance gates: `npm run derivation:ledger-gates` — **22/22 zero-paid checks pass**, including proof-control fingerprints byte-identical ledger-on vs ledger-off for both the inline mock cast and the llmRoles mock-client cast (gate L3), and tutor/learner ledger-row field-set identity (gate L4). Regression suite: `tests/dramaticDerivationStrategyLedger.test.js` (13 tests; off-state invariance pinned — with both dials absent the engine result is field-for-field unchanged). Full `npm test`: 4653 pass / 0 fail. **Phase 3 run 2026-07-03** (`STRATEGY-LEDGER-PHASE3-PREREGISTRATION.md`): pre-registered pilot, 24 runs, gemini-flash, ≈$1.97 — **NULL on all three contrasts (E1/E2/E3) with 15/15 guardrails passing**; commitments and audits engage fully (coverage 1.00, ~35–40% clause drift) but no pre-registered endpoint moves. Two measured instrument limits: outcome ceiling (all runs grounded at the first post-forcing turn) and unexercised levers (0/24 register switches — the tutor declines the costume; blocks barely open with a compliant learner). Bounded conclusion: on schedule-solvable worlds with a compliant learner, held-and-audited scene commitments neither help nor harm — consistent with the standing adaptivity finding that gains come from new signal, not re-encoded decisions. Any follow-up under binding conditions (resistant-learner worlds, register pressure, outcome headroom) is a separate pre-registration.
**Trigger:** operator observation that the four adaptation layers (turn / dialogue block / scene / act) were added, yet loop-based decision-making over strategies (which register to adopt, which information to release) does not appear to be happening at the layers above the turn.
**Prior analysis:** `adaptive-tutor-trajectory-analysis-note.md` (VanLehn inner/outer loop; "it does not yet have a comparably explicit pedagogical decision model. That is the missing layer.")
**Companion docs:** `PLAN_2_0/layered_adaptive_tutor_technical_spec.md` (closed), `workplan/items/layered-*.md` (archived 2026-07-02).

---

## Part 1 — Review: what the four layers actually do today

The four scopes exist as a vocabulary: `ADAPTATION_SCOPES = ['turn', 'dialogue_block', 'scene', 'act']` (`services/dramaticDerivation/publicEvidence.js:3`). What runs behind each scope differs sharply from what the vocabulary suggests.

### 1.1 Per-scope reality (derivation drama engine, the stack with the layers)

| Scope | Who decides, live | Cadence | Evidence window | Authority | Persistence across turns |
|---|---|---|---|---|---|
| **turn** | Tutor ego LLM (+ optional superego watch); proof control (schedule / pacing guards / proof-debt / conduct gates) | every turn | full transcript (tutor); act-bounded (learner) | **binding** (proof) | n/a |
| **dialogue block** | **nobody** | **never** | — | — | — |
| **scene** | harness heuristics only: `openSceneForTurn` computes the goal from proof state (`engine.js:637-663`); `updateScene` closes on D-decrease / confusion / phatic budget / exchange budget (`rhetoricalMovePolicy.js:564-622`) | per turn (bookkeeping) | scene exchange counts + recognition-debt accumulator (`estimateRecognitionNeed`, `rhetoricalMovePolicy.js:446-493`) | advisory prompt lines | scene state object (harness-owned) |
| **act** | Director LLM verdict `{act: continue\|end, direction}` with min/max guards (`engine.js:982-1024`); tutor plot commit at opening + superego audit at close (C1); throughline commit + audit-bound revision (`llmRoles.js:2846-2958`) | per turn (verdict); per act (plot/audit) | full transcript (director/auditor) | advisory over proof; brief/plot/throughline enter the tutor prompt | `actState.brief`, `plotState`, `throughlineState` (real cross-turn state) |

Key verified facts:

1. **`dialogue_block` has no live implementation anywhere.** It appears only as an accepted enum value in library functions (`publicEvidence.js:3`, `discursiveAdaptation.js:65`, `uptakeNegotiation.js:101`, `selfRegulation.js:36`, `opportunityCost.js:4`). No code segments the dialogue into blocks, holds per-block state, or makes a block-cadence decision.

2. **The scope-bearing "layered adaptation" modules are not on the live path.** `arbitrateAdaptation` (the spec §4 "Runtime Arbiter") is called only by `scripts/derivation-adaptation-gates.js`. `deriveDiscursiveAdaptationState` — gate script only. `deriveSelfRegulationState` — no callers outside its own file. `deriveUptakeNegotiationState` — only the offline `qualityPairs.js` benchmark. `deriveTaskMasteryState` / `deriveHumanHandoffState` — frozen-artifact gates and probes. The layered v0 was validated by deterministic zero-paid gates and then **archived in the Plan 2.x closeout** ("advisory instrumentation and provenance, not a live implementation track" — `workplan/items/layered-task-session-adaptation.md`).

3. **What is live in the drama loop is per-turn heuristic classification feeding advisory prompt lines.** The tutor bridge calls `deriveDiscursiveCalibrationState`, `deriveDidacticModeState`, `deriveLearnerTransformationState`, `deriveCastState` fresh each turn (`llmRoles.js:2687-2812`), each a regex/marker classifier over the **last learner utterance** (recent window ≤ 5 lines), each rendered as an advisory section (`didacticModeLines`, `castLayerLines`, `llmRoles.js:539-593`) into the single ego call.

4. **Scope fields are output labels, not decision cadences.** `deriveDidacticModeState` returns `scope: 'scene'` or `'act'` as an annotation on a per-turn classification (`didacticMode.js:225-319`); nothing holds the recommended mode stable for that scope, and it can flap every turn.

5. **Exit conditions exist everywhere and are checked nowhere.** Didactic modes carry authored `exitCondition` text (`didacticMode.js:42-52`); cast reinvention carries one (`castLayer.js:310-315`); learner drift carries one. No code ever evaluates clearance. The one persistence mechanism — `castRuntimeState.activeReinvention` — expires only on scene/act **index change** (`llmRoles.js:2751-2767`), never on its exit condition being met.

6. **The opportunity-cost budget machinery is inert on the live path.** `deriveOpportunityCostBudget` documents counter-reset policies `on_scene_exit` / `on_act_exit` (`opportunityCost.js:49-55`) and `nextOpportunityCostBudget` maintains counters — but no live caller maintains the counters across turns; they are supplied as (absent) inputs.

7. **The one genuine multi-level decision loop is the acts-mode + C1 + throughline stack**, and it is opt-in per arm (`--acts --plot --throughline` on `scripts/run-derivation-loop.js`): director verdict/brief (LLM, act cadence), plot commit at act opening audited at act close by a separate superego call, audit verdicts binding the next commitment (`llmRoles.js:2846-2958`, `engine.js:1189-1210`). This is the pattern that met the rut-watcher bar. It exists **only at act scale**, only for the tutor, and only advisorily with respect to proof.

### 1.2 The two named strategy surfaces

**Register.** The layered spec does not even name register as a decision surface: tone, pressure, question shape, and rhetorical figure fall under §3.3 conduct ("may not change proof target or release authority") — there was never a layer whose job was to *choose* a register. In the derivation engine, register is a **run constant**: `publicRegisterForTurn` is assigned once before the loop — static config or a seeded FNV-hash weighted lottery (`weightedRegisterPick`, `engine.js:154-194, 279-289`) — and never reassigned (`registerRows` gets exactly one `scope: 'run'` row). No agent, at any scope, ever decides the register. In the id-director arc (cells 101-109, 196-198), `routeEngagementMode` is a per-turn regex router with a 2-item history (`engagementModeRouter.js:38-40, 137-`), or the register is fixed per experiment arm (`register_assignment_source: 'experiment_arm'`, `idDirectorEngine.js:59-75`); a per-turn LLM classifier reads the learner's register to bias persona authoring. Nowhere is "which register should this scene/act be played in, given how the dialogue has gone" a decision anyone makes.

**Information release.** Turn-level release is bindingly owned by proof control (release schedule, `releaseAuthority` + pacing/visible guards, proof-debt repair, conduct gates). Above the turn, release *strategy* exists only as the C1 plot's `hold_by_end` / `withhold` advisory commitments plus their act-close audit, and a single advisory line under high discursive strain ("hold or consolidate unless a hard proof-control obligation forces it", `llmRoles.js:2818-2826`). The quality layers are explicitly forbidden from touching release — correctly, per A20/A21.

### 1.3 The learner has no outer loop at all

The derivation learner is one **single-pass** JSON call per turn — `{dialogue, adopt, retract, derive, hypothesis, exchange_type, asserts}` (`llmRoles.js:3933-4028`, one `callJson` at `llmRoles.js:4357`; no learner ego/superego in this engine). Scene goals, tempo beats, act-boundary rules, cast lines, drift pressure, and character-arc colouring are all **handed to it**; it owns nothing across turns except its theory board and hypotheses (plus `proxyDagMemory`, a per-turn *reconstructed* snapshot, not a persisted plan). Every "learner-state layer" in the layered v0 (uptake negotiation, self-regulation, ownership, transformation) either **reads** the learner for scoring or **emits a tutor move** (`recommendedCoachMove`, `nextActionRecommendation`) — wider-scope scaffolding exists on the learner's *data*, but no consumer is learner-owned. The closest structural analog to a learner-side adaptation is `learnerDrift`: learner-facing, injected into the learner's own prompt with full plumbing (`worldLearnerDrift` config, modes, `learnerDriftLines`), but a deterministic `chooseMode()` over the last ~4 transcript lines, recomputed per turn, voice-only (`learnerDrift.js:111, 199-205`). The eval-factorial learner (`learnerTutorInteractionEngine.js`) deliberates ego→superego→revision **within** each turn (`generateLearnerResponse`, called once per turn), with no cross-turn strategy object of its own; its Writing Pad is descriptive memory written and read every turn — never a plan, never revisited at boundary granularity.

### 1.4 Why it feels like it "isn't working as thought"

Three compounding causes:

- **By design, v0 gave the outer layers no authority — and never promised cadence.** The spec's §3.1 table is an *authority* table (its column is literally "v0 authority"): dialogue block "advisory; no proof-target changes"; scene "advisory defaults plus audit"; act "**planning/evaluation only in v0**" (`PLAN_2_0/layered_adaptive_tutor_technical_spec.md:178-186`). Its one executable rule subordinates every broader scope to the per-turn proof decision: `if (scope !== "turn") { runtime.proofAction = currentTurnProofControl.action; ... }` — broader scopes "may set conduct defaults, exit conditions, and evaluation expectations. They may not rewrite the current turn's proof action, proof target, proofDebt state, or release entitlement" (spec:647-658). Even the scene/act gate fixtures assert *subordination* ("act-level recommendation that must stay advisory when current proof action is binding", spec:1031-1032), not any scene/act loop.
- **By wiring, the layered machinery never entered the live loop.** All six v0 modules landed in one commit (PR #69, `08ae8ed5`) as stateless `derive*(input)` functions that read `input.scope` and stamp it onto their output, exercised only by gate scripts and fixture tests; the arbiter hardcodes `scope: 'turn'`. The results were folded into the paper as bounded advisory claims and archived.
- **By cadence, everything live above the turn except the act stack is a per-turn heuristic re-classification** — there is no moment at which a block or scene *decision* is taken, held, and later audited.

The paper is consistent with this: §6.13.15's only positive layered claims are two advisory **fixture gates** (task/session selector 12/12 vs fixed 2/12 on frozen artifacts; handoff probe 8/8 deterministic controls), each ending "no proof-control behavior change" — **no block/scene/act layer's decision was ever shown to change live tutor output** (`docs/research/paper-full-2.0.md:2960-2966`).

So: the earlier assessment ("inner loops but not outer loops") remains substantially true of the *live decision path*. The four layers added vocabulary, evidence schemas, offline gates, and (at act scale, in specific arms) one real commit/audit loop — but not multi-level *decision-making*.

---

## Part 2 — The deficit, stated precisely

1. **Cadence gap.** No decision points exist at block or scene boundaries. Only acts have boundary decisions (director verdict; plot commit/audit), only in opt-in arms.
2. **Authority gap.** Outer-scope outputs are advisory prompt garnish. Nothing above the turn *binds* even conduct — a scene-scope register or mode choice, once made, is not held to.
3. **Agency + symmetry gap.** All outer-scope machinery is tutor-side (or harness-side). The learner owns no strategy at any scope — violating the tutor-learner symmetry principle.
4. **Evidence gap.** Scope labels ride on last-utterance regex classification. There are no scope-matched evidence windows (per-block episode ledger, per-scene clearance record), and exit conditions are never checked, so no layer ever learns whether its strategy *worked*.

---

## Part 3 — Design principles (from established results; do not relearn these)

1. **Proof authority stays at the turn.** A20/A21: overlays earn promotion only by beating hidden+proofDebt without negative transfer; the artifact pool contains no such overlay. Outer loops own **conduct strategy** (register, didactic mode, release *posture*, recognition budget), never proof action.
2. **Extend the proven pattern.** The commit-at-opening / audit-at-close / verdict-binds-next-commitment loop (C1 plot + throughline) is the mechanism that met the internal-superego rut-watcher bar. Generalize *it* down the hierarchy (scene, block) and across (learner), rather than inventing a new controller.
3. **New signal or nothing.** Adaptivity gains come from signal the model cannot already infer in context. At outer scopes the genuinely new signal is: (a) **commitments** (which change future behaviour via audit pressure), (b) **cross-turn aggregates** (exit-condition clearance, repair recurrence, mode-effectiveness per scene) that a per-turn context read does not reliably reproduce, (c) **persistence** (stopping per-turn strategy flap). Do not add ToM layers — four instruments have now shown them redundant.
4. **Decisions into the LLM, bookkeeping into the harness.** Hand-coded state machines were the weakest adaptivity layer. The heuristic classifiers' job shrinks to evidence bookkeeping; the *choices* (which register, which mode, hold-or-spend) belong to the agents at boundaries.
5. **Learner levers are structural, not advisory.** The character-development arc: learner self-recognition unlocked only when the mirror was the learner's **own committed verdict**; per-turn mechanisms hurt. Learner-side outer loops should therefore be commitments the learner authors at boundaries, not extra advisory lines.
6. **Cost discipline.** Fold commitments into existing boundary-turn calls as extra JSON fields (the plot pattern does exactly this — zero extra calls); audits are one small call per boundary, deterministic where possible.

---

## Part 4 — The plan: Strategy Ledger v1 (per-agent, per-scope commit/audit loops)

One object shape, four scopes, two agents. A **strategy ledger row**:

```yaml
{ agent: tutor|learner, scope: block|scene|act|run,
  commitment: <register / mode / release-posture / goal / carry-forward>,
  rationale: <one line>, exit_condition: <checkable>,
  committed_turn: N, expires: <boundary>,
  audit: { verdict: kept|justified_deviation|drift|cleared|failed, evidence } }
```

### Phase 0 — Wiring debts (no new claims; makes the existing machinery real)

0a. **Check exit conditions.** At each turn end, run a deterministic marker check (reuse the existing lexicons) of the active didactic mode / reinvention exit condition; record `cleared|pending|failed` onto the row. This single bit closes the missing feedback loop ("did the strategy work?").
0b. **Maintain opportunity-cost counters live** with the documented reset policies (`on_proof_action` / `on_scene_exit` / `on_act_exit`), via `nextOpportunityCostBudget` in the tutor bridge.
0c. **Segment blocks.** A block opens when a non-minimal mode/exchange episode starts (confusion, repair, resistance, teach-back — `classifyLearnerExchange` already labels these live in scene mode) and closes when its exit condition clears, its budget exhausts, or the episode type changes. Harness bookkeeping only; no new decisions yet.
0d. **Stabilize modes within blocks.** While a block is open, the didactic mode holds unless its exit condition clears or budget exhausts (ends per-turn flap); re-derivation happens at block close.

### Phase 1 — Tutor boundary decisions (scene + block)

1a. **Scene-opening commitment.** On a scene-opening turn, the ego's existing call gains commitment fields (plot-pattern): choose `{scene_register (from the world's palette), didactic_default, release_posture: eager|hold|consolidate, recognition_budget}` with a one-line rationale and an exit condition. The harness then *holds* the register/mode lines in subsequent prompts to the committed values for the scene's duration — conduct-binding, proof-untouched.
1b. **Scene-close audit.** At scene close, the superego (where present; deterministic checker otherwise) audits the commitment against the scene's exchange record and clearance bits — same clause discipline as the plot audit; the verdict enters the next scene-opening prompt ("the audit binds").
1c. **Block escalation.** At block close with `failed`, the next block's options are constrained (e.g., same mode not re-selectable without a stated reason) — the didacticFallback pattern, but checked and within-run.
1d. **Act layer unchanged** (director verdict + plot + throughline stay as built).

### Phase 2 — Learner symmetry (the genuinely novel piece)

Implementation path: **lift and invert `learnerDrift`** rather than building new machinery — it already has the config surface, the state shape, and the learner-prompt injection slot (`learnerDriftLines`, beside `characterArc.lines`). The change is (a) authorship: the *learner LLM* commits the state instead of the deterministic `chooseMode()`, and (b) cadence: committed at boundaries, not recomputed per turn. The cadence hooks already exist and are today read only by tutor-side adapters: scene-open at `engine.js:637-663` and the act boundary at `engine.js:982-1024`.

2a. **Learner scene commitment.** At scene openings the learner's existing call gains fields: `{what_i_want_from_this_scene, if_lost: ask_repair|resist|try_own_derivation, speech_posture}` — its own strategy, entering *its own* subsequent prompts (private; not shown to the tutor).
2b. **Learner act carry-forward verdict.** At act boundaries (where the stage already clears), the learner commits `{what_i_carry_forward, what_i_still_owe}` — the mirror-verdict lever, now at act cadence.
2c. **Learner boundary audit.** In arms with a learner superego, it audits at block/scene boundaries instead of every turn (per-turn hurt in the character arc).
2d. **Symmetry discipline:** mirror trace labels and ledger schemas exactly (tutor/learner), per the standing symmetry rule; the tutor's scene audit may read the learner's **public** conduct only — no ToM.

### Phase 3 — Evaluation (small, contrast-driven, single paper)

Primary contrasts (drama suite, matched budgets, pre-registered):

- **E1 (persistence):** scene-scope commitments held (Phase 1) vs live per-turn advisory (today). Endpoints: mode-flap rate, exit-condition clearance rate, grounded-anagnorisis rate, D-trajectory.
- **E2 (register as decision):** scene-scoped agent-chosen register vs run-fixed register (current), same worlds. This is the first time "which register" is a decision anywhere.
- **E3 (learner ledger):** learner commitments on vs off, tutor side held constant. Endpoints: ownership/transformation instruments + assertion timing.

Guardrails: proof-control fingerprints unchanged across arms (the A20/A21 test); negative-transfer check; any critic-scored claim passes the coherence-confound discipline; register claims wait on the exemplar test flagged in the register-taxonomy plan. Results land in `docs/research/paper-full-2.0.md` §6.13.x (or a new §6.16), never a spin-off.

### Non-goals

- No proof-authority changes; no task/session sequencing (stays archived); no human-handoff activation; no ToM/bilateral-belief modeling; no new rubric.

### File map (indicative)

- `services/dramaticDerivation/strategyLedger.js` (new; row shape, clearance checks, block segmentation)
- `services/dramaticDerivation/llmRoles.js` (commitment fields at boundary turns; held prompt lines; boundary audits — extends the plot/audit code paths)
- `services/dramaticDerivation/engine.js` (block state beside `sceneState`; ledger rows into artifacts)
- `scripts/run-derivation-loop.js` (`--strategy-ledger`, `--learner-ledger` dials, opt-in like every other layer)
- Gates: `scripts/derivation-ledger-gates.js` (deterministic: segmentation, clearance, hold-discipline, symmetry)

### Acceptance gates (before any paid contrast)

1. Zero-paid mock run shows: blocks segment sanely; committed register/mode lines actually held; audits fire at boundaries; ledger rows land in artifacts.
2. Proof-control fingerprint byte-identical between ledger-on and ledger-off mock runs (conduct-only proof).
3. Symmetry check: learner ledger schema mirrors tutor's field-for-field.

---

## Part 5 — Alternatives considered

- **Plan A (minimal):** Phase 0 only — check exit conditions, hold modes within blocks, maintain counters. Cheapest possible test of whether persistence alone moves anything. Recommended if appetite is low.
- **Plan B (recommended):** Phases 0-2 as above — the full commit/audit generalization, still fold-in-cheap.
- **Plan C (learner-first):** Phase 2 alone on top of today's tutor — tests the symmetry lever in isolation; attractive because the learner side is the largest untouched surface and the structural-commitment precedent is strongest there.

Open questions: whether scene-register choice should be constrained to a world-authored palette (safer, register-taxonomy lesson: gullibility-vs-costume unresolved) or free; whether block audits deserve an LLM call or stay deterministic through v1 (lean: deterministic); whether the id-director arc should adopt scene structure at all (lean: no — keep arcs clean, test there only after the drama-suite result).

---

## Part 6 — Strategy Ledger v2: mechanism trialling (design, 2026-07-03; not yet implemented)

**Motivation.** The operator's articulation after the Phase-3 null: the outer loop should act at the level of **strategy — a choice among adaptive mechanisms** ("go charismatic", "go sarcastic", "try a different pedagogical instrument") **made by reviewing the history to date**, which then **guides but does not determine** turn-by-turn conduct; and it should be **multiple layers of adjudication over one instrument** (e.g. "release a, b, c this scene, with a livelier register" → per-turn calibration → binding guards), not a second instrument stacked on the first. v1 has the skeleton (boundary cadence, held commitments, audits binding the next opening) but three narrowings block the articulation, and they jointly explain the Phase-3 lever idleness from the design side:

1. The scene-close audit is a **conformance** review (kept/drift), never an **effectiveness** review — nothing in the loop ever gives the tutor a *reason* to switch mechanism.
2. The commitment menu is a thin form (three surface registers, mode, posture, budget), not the adaptive repertoire — charisma/recognition are run-constant operator dials, and the taxonomy registers (ironic, sarcastic, charismatic-challenge) live only in the id-director arc.
3. Release **content** is excluded from commitments entirely (A20/A21 caution), where the articulation wants scene-level release *intent* as planning over the authority the tutor already holds in `--release-authority` arms — intent (scene) → decision (turn) → pacing guard (binding floor).

**v2 changes (four, all opt-in on top of v1):**

1. **Mechanism menu.** The scene-opening commitment chooses over: (a) **tone/register** — drawn from the merged register taxonomy (see dependencies below), scene-choosable rather than run-fixed or experiment-assigned; (b) **pedagogical instrument** — didactic family and rhetorical-figure family (the `recommendRhetoricalMove` policy already exists as an advisory; v2 makes the family a scene choice); (c) **release intent** — only under `--release-authority`: the exhibits the tutor *intends* to play this scene. Guards keep final authority at every turn; an intent can never widen a window, only sequence inside it.
2. **Effectiveness review (the missing loop).** At scene close, a programmatic performance digest — exit-condition clearance, uptake/stance markers, D-progress within the scene, releases played vs intended, departures declared — accumulates into a cross-scene **mechanism history table**. The next opening renders it ("purpose_bridge → didn't clear; learner responds to concrete cases") and demands persist / adjust / **switch**, with a stated reason. The history table is the *new signal* (cross-scene aggregates the model cannot reliably reconstruct in-context) that the standing adaptivity finding says is the only thing that works.
3. **Guide, don't determine.** Strategies render as defaults; the harness *records* rather than enforces (drop v1's hard register hold). Turn-level departures are declared in a one-line `departure` field and adjudicated at scene close with the plot vocabulary — kept / **justified_deviation** / drift — so calibration against learner behavior is licensed, visible, and judged.
4. **Act layer (optional, rides existing machinery).** The act-scale plot/throughline loop selects the mechanism *family*; scenes select instances. No new act machinery.

**Binding-conditions requirement (the Phase-3 lesson, now a precondition gate).** v2 contrasts run only where the levers can bind: `--release-authority` (+ pacing guard binding), AND decay or a resistant-learner world (hethel-resistant family, worlds 010–015) so blocks/repair exist, AND derivation depth past the forcing turn (marrick-class join or decoy-spine) so outcomes have headroom. A zero-paid probe plus two paid runs must show T\* variance across arms **before** any matrix spends; if T\* is still schedule-clocked, stop and redesign the worlds, not the ledger.

**Pre-registration skeleton (to be finalized from main, post-merge — see dependencies):**

- Arms (single-delta): A2 baseline-under-binding-conditions (no ledger) · B2 v1 ledger (conformance audit, thin menu — isolates exactly v2's delta) · C2 v2 trialling (mechanism menu + effectiveness review + licensed departures) · D2 optional: C2 + learner mirror.
- Primary endpoints: T\* (headroom pre-verified), grounded rate, repair latency under decay (turns from slip to restore), stall/aporia rate. Conduct endpoints: mechanism-switch rate *after* failed scenes (does the loop actually trial?), departure-justification mix.
- Guardrails: the v1 set (leaks 0, release discipline ≤ baseline, coverage ≥ 80%) plus **guard-override count = 0** (release intents never breach a pacing-guard verdict) and the negative-transfer check.
- Decision rules: pilot tier and the 0.5-SD-both-worlds signal rule again, unless the design is scaled at pre-registration time.
- Cost: probe-first; OpenRouter balance was $3.92 after Phase 3 — a v2 matrix under binding conditions (longer worlds, more arms) will need either a top-up or the claude-CLI fallback, decided at pre-registration.

**Integration dependencies and the re-review clause.** Two active worktrees overlap v2's menu: the **register taxonomy / negative registers** arc (cells 196–198, `config/engagement-registers.yaml`, register registry + irony/sarcasm rubric — currently experiment-assigned arms in the id-director engine) and the **blueprint composition** arc (cells 199–200, registry/contract middleware). v2's tone menu must draw on the merged register registry rather than invent a parallel drama-engine vocabulary — either by porting taxonomy registers into the drama engine's register channel or by mapping them through the cast/reinvention stance surface. The taxonomy arc's standing caveat (gullibility-vs-costume unresolved; sarcasm smoke scored *highest*) transfers: v2 keeps every primary endpoint programmatic, and any critic-scored color stays descriptive. **Action ordering:** land/merge those branches to main → refresh this branch from main → re-run the v1 gates (expect 22/22 unchanged) → finalize the v2 pre-registration against the merged registry → implement v2. v2 is not to be implemented from this branch's current base.

### Part 6 revision — post-merge review of the landed register arc (2026-07-03, merge `4f919c23` → branch merge `07c91091`)

The negative-register exemplar arc landed on main and was merged into this branch (v1 gates re-run: 22/22; registry + fidelity tests green). Four revisions to the v2 design follow from reading it:

**1. The register dependency is RESOLVED, and the integration surface is now concrete.** The merged registry (`config/engagement-registers.yaml` via `services/engagementRegisterRegistry.js`) provides valence-tagged register definitions (`positive` / `liminal` / `negative`) with per-register `stance_fidelity_cues` and rubric paths. The review also settles the axis question Part 6 left open: the drama engine's `publicRegister` channel (default/modern/period) is a **surface-style** axis; the taxonomy registers are an **interpersonal-stance** axis. v2's menu therefore carries both as distinct scene-scoped choosables: the v1 surface-register palette unchanged, plus an engagement-stance choice rendered through a `<register_stance_contract>`-style prompt block in `llmRoles` (mirroring the id-director's landed contract, cues included) rather than through the surface-register channel or an invented vocabulary.

**2. A two-gate adjudication structure is imported as a v2 structural requirement.** The landed arc's decisive methodological result: before cue repair, 10/15 assigned sarcasm rows were `weak_or_warm_in_costume` — the mechanism was *assigned but never instantiated* — while the exemplar test proved the judges catch real corrosive sarcasm (3/3, controls 0/2 false positives); after cue repair, 15/15 faithful. Translated to v2: the effectiveness review MUST sit on top of a **treatment-fidelity gate**, else the mechanism history table attributes outcomes to strategies that were never really deployed (the warm-in-costume failure, generalized). Per scene, the history table records *assigned* vs *faithful*; only faithful trials enter mechanism-effect attribution; estimands split assigned-arm vs faithful-arm (adopting the `negative-register-effect-estimation-grid` vocabulary). For registers the gate is the landed `evaluateRegisterStanceFidelity` (deterministic, cue-based, word-bounded forbidden phrases); for pedagogical instruments the analogous instantiation checks are the existing didactic marker lexicons and declared figure moves.

**3. The negative-register discipline transfers verbatim.** Negative-valence registers are never organically selectable — in v2 they can appear in a scene menu ONLY when the operator's palette explicitly includes them (the registry's own arm-assigned discipline, and the same palette-bound rule v1 already enforces for surface registers). `face_threat_challenge` remains simulated-only per the arc's bounded conclusion (measurable recognition-cost/face-repair cost, v2.2 last-turn recognition 4.4 vs 4.8–5.0).

**4. Action ordering updated.** Register-taxonomy dependency: **landed and merged**. Branch: **refreshed from main** with gates re-verified. Blueprint-composition (cells 199–200): not yet landed, downgraded from blocking to watch — its registry middleware was speculative for v2, and the load-bearing register registry is in. The remaining gate before implementation is finalizing the v2 pre-registration itself (now unblocked), including the binding-conditions precondition probe from Part 6.
