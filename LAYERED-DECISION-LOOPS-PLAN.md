# Layered Decision Loops — Review and Plan

**Status:** design / v0.1 (2026-07-02). Review findings verified against source; plan not yet sanctioned.
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
