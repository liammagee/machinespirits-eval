# Preconscious Final-Stretch Plan

Status: **proposal, drafted 2026-07-13**. Nothing in this document is sanctioned to spend until the user says go, and nothing in it is an empirical claim. Steps 0–1 are zero-model-call and can start on sanction without further design work; Steps 2–6 are paid, attended runs, each requiring its own frozen pre-registration before launch.

Derived from: `PLAN_4_0/2026-07-13-preconscious-arc-stocktake-and-final-stretch.md` (the stock-take this plan operationalizes). Evidence provenance: `PLAN_4_0/2026-07-12-adaptive-state-exact-channel-protocol-v2.3.md`, `PLAN_4_0/2026-07-10-headroom-fixed-horizon-interactions.md`, `PLAN_4_0/2026-07-10-adaptive-policy-discrimination-and-learner-diversity.md`, `PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md`, `GREEN-ROOM-PLAN.md` + `notes/2026-07-12-greenroom-gate1-diagnosis.md`, `docs/tutor-stub-learner-profile-robustness.md`, and paper `docs/research/paper-full-2.0.md` (§6.13–§6.16, §7.9, §7.11).

Relation to other live plans: this plan supersedes nothing that is closed and reopens nothing that is closed. `ADAPTIVE-TUTOR-BOUNDARY-PLAN.md` remains plan-only; `GENUINE-ADAPTATION-IMPLEMENTATION-PLAN.md` targets a different worktree and stays dormant; the conduct-policy promotion family stays closed. This plan is the arc's exit path.

---

## 0. The situation in plain terms

Every mechanism that gave the tutor a private model of the learner has failed, across two substrates and roughly seven independent closures. The newest and cleanest: on a deterministic, zero-call observation channel with synthetic learners whose hidden state we own, every state representation predicted the learner's next move *worse* than ignoring state — while an oracle reading the hidden state directly passed, proving the signal exists and the public summaries don't carry it.

Everything that ever worked shares one shape instead: **a true signal the tutor could not infer, arriving through a checkable trigger, formatted as an action, at the moment of generation, tuned per model.** Standing prose fails (the Green Room prompt book: 18% uptake against a 60% bar). Raw state dumps fail (the agon result: the same information wins as an action projection and loses as a dashboard). Policies do not transfer between model families (the in-context register policy was best on one stack and worst on the other).

And the arc finally has one replicated positive: on stressed learner profiles, register variation produces mid-dialogue progress gains that endpoint measurement cannot see — rank crossings by profile, at fixed horizons, on both model families, matching a pre-declared success signature.

The final stretch assembles the surviving pieces and tests them properly: two free studies, three or four paid gates, one capstone. Every step has a frozen kill criterion. Either the assembled loop beats a strong fixed control where it matters, or the arc closes with instrument-grade negatives. Both outcomes end the arc.

---

## 1. Goal

Terminate the preconscious arc with one of two defensible results:

- **(a) The composed positive:** an adaptive tutor assembled exclusively from validated mechanisms beats a strong fixed control (`bland`) on stressed learner profiles, at fixed horizons, at claimable n, on two model families, on mechanical endpoints, under sealed provenance.
- **(b) The bounded closure:** the remaining levers (active sensing, register selection at n, point-of-action coaching, the planner under privileged sensing) each close with a clean, pre-registered negative, and the arc's contribution is the instrument plus the design law.

No third outcome (indefinite exploration) is licensed by this plan.

## 2. Design laws (frozen for every step)

1. **The five-property rule.** Any mechanism proposed under this plan must state which of the five properties it has — new signal, checkable trigger, action-shaped format, point-of-action delivery, per-model fitting — and any mechanism with fewer than four requires written justification before design time is spent on it.
2. **Fixed-horizon primary endpoints.** Coverage/mastery/risk at learner turns 8/12/16 and trajectory AUC are primary; until-grounded endpoint and turn counts are secondary. (The endpoint null was an until-grounded catch-up artifact; do not rebuild it.)
3. **Outcome-only scoring.** Rankings, deltas, and verdicts run on the outcome score exclusively; register diversity and other process measures are reported in separate labeled columns. (The regression test pinning tied-outcomes to delta-zero stays mandatory.)
4. **Sealed lineage, no-tune-and-retry.** Every paid run: committed SHA, frozen manifest before any model call, kill criteria frozen before data, one run per pre-registration, failures close their lever rather than respawning variants.
5. **Two-model discipline.** No claim wording without both families (`codex.gpt-5.6-terra` and `claude-code` Sonnet 5) or an explicit single-stack bound. Model identity is verified from `run_start` metadata, never from the requesting flag (the terra flag-forwarding incident is the standing reason).
6. **In-run manipulation checks.** The v3 profile-discrimination gate is computed on each run's own control cells rather than inherited from prior runs, because contract floors are model-sensitive.
7. **Zero-call before paid.** Any question answerable against the kernels or existing artifacts for free is answered there first.
8. **Attended and pausable.** Paid runs use checkpointed exit-and-rerun (quota-window discipline); sequential execution when arms share a quota window and feed a between-arm contrast.

---

## 3. Step 0 — Provenance close-out

**Type:** engineering, free. **Precondition for every paid step.**

The state-of-evidence audit graded run provenance D+ and named the stop condition; most of it is now built (sealed lineage, packaging, fail-closed verification). Three items remain:

- **0.1** Route the remaining unseeded draw (`sampleEngagementStanceDistribution`, currently raw `Math.random()`) through `services/tutorStubPolicySampler.js` so every stub run is replay-deterministic.
- **0.2** Stamp commit SHA + resolved config hash into every tutor-stub run header at `run_start` (the QA-plan-overwrite and terra incidents were both caught by luck, not design).
- **0.3** Package the decisive machine-local artifacts — `.tutor-stub-auto-eval/headroom-contrast-n3-live/`, `.tutor-stub-auto-eval/headroom-sonnet5-pressure-n3-live/`, and the sealed adaptive-state runs — via `scripts/package-adaptive-run.js` into the tracked evidence area or the private archive repo, verified with `scripts/verify-experiment-run.js`. (Connects to the standing consolidate-logs task; the arc's empirical record currently rests on one working tree.)

**Exit gate:** all three items done and demonstrated by one replayed run. No paid step launches before this gate.

## 4. Step 1 — Kernel testbed: decomposition audit + active sensing

**Type:** analysis, zero model calls. **Contract:** a fresh prospective contract (`adaptive-state-instrument v2.4`) frozen before any analysis, per the v2.3 protocol's own successor rule.

### 1a. The sanctioned P0 decomposition audit

The exact-channel sensor pilot stopped negative (lean DAG worse than no-state by −0.52 log-loss on both co-primary targets; trajectory and field representations worse still). The protocol's named next step is a zero-call error/decomposition audit. Freeze and run it:

- target predictability from the action/task sequence alone (how much does the fixed six-action schedule itself explain?);
- feature dimensionality and regularization effects at 144 transitions / 12 latent clusters (is the negative a carrying-nothing result or a data-starvation result?);
- world-specific encoding (why did lean DAG improve only in Hethel?);
- per-kernel failure modes (durable-state vs dropout-readoption).

**Output:** a classification of the sensor null as `representation_carries_nothing` vs `data_starved` vs `world_confounded`, which controls whether any sensor work ever reopens.

### 1b. The active-sensing value-of-information study (the new lever)

The benchmark holds tutor actions fixed by design; the discrimination note independently observed that some tutor policies reveal learner differences and others erase them. No instrument in the program, on either substrate, has ever tested **choosing the move partly for what it reveals**. The kernels make this computable for free: for any public history, the posterior over latent kernel state under each candidate action is exactly derivable.

Frozen questions:

- per action family × world × kernel: expected posterior-entropy reduction over the latent state;
- does an information-optimal action schedule (probing permitted) make a lean representation beat no-state where the fixed schedule could not?
- is there an information/pedagogy trade-off (do revealing moves cost proof progress), and is it profile-dependent?

**Decision rule (frozen):** emits exactly one of
- `close_sensor_program_on_substrate` — if even oracle-guided probing cannot separate the kernels through the public channel, the concealment boundary is a property of the substrate under *any* policy: a boundary-grade negative, publishable as such;
- `graduate_active_sensing_to_paid` — probing works offline; a paid design becomes the input to any future Phase 6B reconstructed-state adapter;
- `inconclusive_data_starved` — only if 1a returned `data_starved` and the VOI estimates are dominated by the same starvation; permits one bounded kernel-data extension, zero-call, under the same contract.

**Cost:** analyst time only. **This is the single genuinely new mechanism class available to the program.**

## 5. Step 2 — The register confirmatory (the mintable claim)

**Type:** paid, attended, ~120 dialogues (~2 attended quota days). **Requires:** Step 0 exit gate; its own frozen pre-registration (skeleton below, to be frozen verbatim in a dated prereg doc at launch).

The fixed-horizon reanalysis found the pre-declared adaptive-success signature — policy × profile rank crossings — at n=3, replicated in structure on a second family. This step powers it.

**Pre-registration skeleton:**

- **Primary endpoint:** coverage at learner turn 16, policy × profile interaction (estimated as interaction contrasts, not a global policy ranking).
- **Arms:** `bland` (control), `field` (the only arm never behind bland on terra and leading two stress profiles on Sonnet), `negative` (the hostile floor — its profile-dependent collapse is part of the predicted signature). **`dynamic` is excluded from claim-bearing arms** — its non-transfer is already a two-model result (best on terra, worst on Sonnet, endpoint closure 0.083); at most one diagnostic cell on one stack, reported descriptively.
- **Profiles:** `diligent`, `affective_resistant`, `false_memory`, `proof_skipper` under v3 contracts, with the discrimination gate computed **in-run** on this run's own cells (design law 6).
- **n:** 5 per cell. **Models:** both families, same design each. **Controls:** deterministic policy interleaving (`--interleave-policies`), turn-6 pressure probe in every arm (`--pressure-turns`), binding `--safety-turns 40`, outcome-only scoring.
- **Secondary endpoints:** coverage/mastery/risk AUC over turns 1–16, until-grounded endpoint, post-probe recovery (window 4).
- **Pre-committed interpretation:** `bland` leading `diligent` is part of the predicted interaction signature, not a failure; the claim under test is the crossing. A null is: no policy × profile interaction on the primary endpoint at n=5 on either family.

**What it licenses:** if the interaction confirms on both families — *profile-contingent mid-dialogue gains from register selection, at claimable n, on a mechanical endpoint outside the §7.9 slope-proxy regime* — the program's first adequately powered adaptation positive. If it nulls, the register-policy line closes and the residue is the instrument plus the model-dependence finding. Both outcomes land in the paper.

**Priority:** this is the highest-value paid run in the plan and runs before any other paid step.

## 6. Step 3 — Phase 6A as a conditional kill test

**Type:** paid, conditional. **Requires:** Step 2 complete (whatever its outcome); the existing sealed canary → k5 → k10 lineage machinery (`PLAN_4_0/PHASE_6_EVIDENCE_GATE_PLAN.md` v2.1, unchanged — this plan adds only framing and a stopping rule).

With the sensor null, Phase 6A is correctly framed as an **actuator test under privileged sensing**: the non-acts planner reads true learner-store state, so it measures whether deterministic move-planning helps *even when sensing is free*.

- **6A.1** Run the excluded sealed route canary, then the canary-bound k=5 block. **Stop and decide before k=10.**
- **Decision rule:** if no planner arm clears the frozen material-improvement bar against both baseline and report-only at k=5, **stop permanently** — the planner retires, Phase 6B is declared moot (an actuator that cannot help with privileged state cannot help with reconstructed state), and the field machinery survives as reporting instrumentation only. If k=5 clears, complete k=10 for the narrow promotable feasibility claim, exactly as the existing gate plan specifies.
- **Budget guard:** if quota forces a choice at any point, Step 2 and Step 4 outrank this step.

## 7. Step 4 — Point-of-action coaching (the Green Room successor)

**Type:** paid, attended (~1–2 quota days). **Requires:** Step 0; a fresh pre-registration (this is a successor under the no-tune-and-retry rule — both the channel and the grain change relative to Gate 1, per the diagnosis's levers 1 and 3).

The Gate-1 diagnosis localized the failure to situation-recognition at performance time. Attack it by moving recognition out of the actor:

- **Arms:** (i) no coaching; (ii) **standing-book placebo** — the same notes injected as the failed static block (`--prompt-book-context`), the channel Gate 1 already measured; (iii) **compiled constraints** — each note's trigger condition implemented mechanically over quantities the stub already computes (field velocity, DAG velocity, stagnation composite, re-gloss count), enforced in the register/stance layer; (iv) **side-coaching** — the note delivered mid-performance at the moment its trigger fires, action-shaped per the §6.15 format law, tutor only complies (the plan's reserved cell-206 concept; verify the cell ID against `config/tutor-agents.yaml` before registering).
- **Design constraints:** coach to high-frequency predicates only, so compliance denominators are dense (Gate 1's n=1–4 per note cannot recur); stressed profiles; fixed-horizon outcomes alongside the per-note compliance channel.
- **Decision rules (frozen at prereg):** (iii) or (iv) must beat (ii) on compliance *and* not harm fixed-horizon outcomes. If (iv) fails while its triggers demonstrably fire, record the boundary result: the insight-action gap is generation-intrinsic on this model class — a first-class finding, not a retry ticket.

This is where the program's entire positive family converges (checkable trigger + point-of-action + action-shaped + new situational signal); it carries the clearest theory-stakes of any single run in the plan.

## 8. Step 5 — Close the stalled pre-registration

**Type:** paid, small. `UNRELIABLE-LEARNER-PREREG.md` is registered (2026-06-11), its G2 gate is satisfied, both paid runs were superseded or stopped mid-flight, and no verdict is recorded. It is the follow-up to the program's one load-bearing explicit channel (§6.13.7, +0.49 per-slip repair) under fact-decay pressure. Re-run per its own amendments and record the verdict either way. A registered experiment with passed gates and no verdict reads later as motivated stopping; close it.

## 9. Step 6 — The assembled-tutor gate (the capstone wager)

**Type:** paid, attended (~80–120 dialogues). **Requires:** Steps 1–5 read out; its own frozen pre-registration.

Compose **only elements that survived their steps** into one configuration. The candidate list (final membership contingent on Steps 1–5):

- the small instruction kernel (§6.14);
- criterial guards where their geometry matches the world (§6.13.11–.13 cartography);
- the harness-owned slip channel (§6.13.7, as Step 5 leaves it);
- the per-model register floor (as Step 2 leaves it);
- point-of-action coaching (as Step 4 leaves it);
- active-sensing probes (only if Step 1b graduated them and a paid slice validated).

**The wager, pre-registered:** §6.14 showed *instruction*-composition is sub-additive; §7.11 predicts independent *signals* accumulate. The assembled tutor tests the law's positive half: assembled-vs-`bland`, stressed profiles, fixed-horizon primary endpoint, n≥5 per cell, both families, sealed lineage.

**Terminal either way:** a win is the arc's deliverable — a composed, mechanism-understood adaptive tutor, claim bounded to the substrate and stacks named. A loss amends §7.11 in public (signal-composition sub-adds too), which is itself a section-grade result. No third round.

---

## 10. Ordering, budget, and the stop rule

```text
Step 0 (free)  ──►  Step 1 (free)  ──►  Step 2 (paid, ~2 days)
                                          │
                            ┌─────────────┼──────────────┐
                            ▼             ▼              ▼
                     Step 3 (cond.)  Step 4 (~1–2d)  Step 5 (small)
                            └─────────────┼──────────────┘
                                          ▼
                                  Step 6 (capstone)
```

- Total spend on the order of **five to seven attended quota days**, spread across the natural sequencing; every run claim-bearing.
- Steps 3, 4, 5 are order-independent among themselves after Step 2; when quota-bound, run sequentially with the between-arm-contrast rule, Step 4 first (highest theory value), Step 3 last (narrowest claim).
- **Stop rule for the whole plan:** if Step 2 nulls on both families *and* Step 1b returns `close_sensor_program_on_substrate`, Steps 3 and 6 are cancelled, Step 4 still runs (its question is independent), and the arc closes as outcome (b) of §1.

## 11. Foreclosed — not under this plan, not as "quick checks"

- No new register-policy variants before Step 2 reads out; no `dynamic` rehabilitation (two-model non-transfer stands).
- No representation-ladder rungs before Step 1a classifies the sensor null; no v2.2 reruns; no Ravensmark prompt-tuning; no reinterpretation of any stopped row.
- No prompt-book retry in any static-text form; successors must change channel or grain (Step 4 is that successor).
- No LLM-read "model the interior" variants; no fitted or retrieval state→action policies (both axes closed offline, five-way convergent).
- No new worlds except where a step's design explicitly requires one; no marrick re-costumes (standing directive).
- No Phase 6B work before Step 1b provides something to reconstruct from; no shadow pilot or human-facing step under this plan (the human threshold keeps its own gates: IRB, consent, item content, and the v2.3 parity bridge — this stretch's only human-side action is starting that paperwork clock, which carries no run).

## 12. Paper landing and workplan integration

**Paper (single-paper discipline; no spin-offs):**
- New **§6.17** carrying: the stub instrument (v3 population, fixed-horizon methodology), the replicated interaction structure and its model-dependence, the exact-channel sensor negative, and Step 2/4/6 results as they land. §6.16 (Green Room) already anchors the sequence.
- **§7.11 corollary:** signal must be action-shaped and delivered at the point of action, and selection layers are model-indexed.
- **§7.9 note:** the fixed-horizon mechanical endpoint is the first in-claim-set instrument measuring adaptation outside the slope-proxy regime, symmetric in both directions.

**Workplan (cards created/updated at sanction time, then `node scripts/workplan.js render && node scripts/workplan.js validate`):**
- `tutor-stub-learner-state-validity` (active) absorbs Step 1 (P0 audit + VOI, v2.4 contract).
- `tutor-stub-multiworld-policy-replication` (blocked) unblocks as the Step 2 vehicle, retitled to the confirmatory design.
- `field-planner-phase6-gate` (triaged) gains the Step 3 conditional framing and k5 stopping rule.
- New card for Step 4 (side-coaching + compiled constraints, referencing the Green Room closeout and cell-ID check).
- New or reopened card for Step 5 (unreliable-learner completion).
- New card for Step 6 (assembled-tutor gate), created only after Steps 1–5 read out.
- `tutor-stub-transition-reward-model` stays blocked pending Step 1's classification.

## 13. Sanctioning checklist

| Step | Ready now? | Needs before launch |
| --- | --- | --- |
| 0 | yes | go |
| 1a/1b | yes (design in this plan) | go + frozen v2.4 contract |
| 2 | design complete | go + frozen prereg doc + Step 0 gate |
| 3 | machinery complete | go + Step 2 complete |
| 4 | design in this plan | go + fresh prereg + cell-ID check + Step 0 gate |
| 5 | registered already | go (re-run per amendments) |
| 6 | contingent | Steps 1–5 read out + frozen prereg |

One go authorizes Steps 0–1 (free). Each paid step takes its own go at its own freeze point.
