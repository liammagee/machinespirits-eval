# Adaptation / Recognition / Correction — next steps

Date: 2026-06-04

**Context.** The opt-in `adaptation-core` ontology module + the population bridge
landed (commits `f2d10b8` UX, `1e7c7fe` ontology). The bridge
(`npm run poetics:reconcile-adaptation`) reproduces the §6.8 gate's `control_leak`,
`action_gap`, and — joining the deliberation sidecar for the wrong-trigger path —
`mechanism_not_publicly_resolved` on **9/9** real cells, and derives a *structural*
recognition-origin that catches critic over-attribution on exactly the failed cells
(`organic` where the critics voted `peripeteia_induced`). What remains: make the
**correction axis** operational, close the last gate-struct gap, and turn the
scoring TBox into a generative one.

Boundary (keep honest): generative scaffolding, **not** a measurement-improvement
claim — the prior ontology-ToM layer was an empirical null. The instrument
classifies dramatic *form*, not real learning. Empirical claims trace to
`docs/research/paper-full-2.0.md`.

---

## (b) The hamartia-repair signal — the correction axis, operational  **[BIG]**

**Why.** The whole conceptual payoff — `repairWithoutRecognitionCredit` (repair
present, recognition *denied*; the D53 keystone) and Scaffolded-vs-Self repair origin
— is *modelled* and fires on a worked ABox, but never on real runs, because the loop
emits **no durable-repair signal**. `summarizeItem` has no `HamartiaRepairStage`
input.

**The design choice (yours to make): what counts as durable hamartia-repair**,
distinct from dramatic recognition? Candidates, increasing in ambition:

1. **Public-text rule** — the learner's final turn states a corrected rule + a
   replacement-check that *contradicts the `hamartia`* (a structure-critic-style frame
   over the specific misconception, not just any reframe). Cheap, deterministic, lossy.
2. **Held-out application** — a follow-up item probes whether the corrected rule
   *transfers* (the learner applies it to a NEW instance). Closer to "durable"; needs a
   post-test turn the loop doesn't generate today.
3. **Latent vs manifest** — compare the learner's HIDDEN deliberation (we own it as
   ground truth) against the public turn: durable repair = corrected rule in BOTH;
   organic/costume repair = public only. The least gullible, the heaviest — this is the
   manifest≠latent thread (`ADAPTATION-PLAN-2.0.md`, lands paper §6.10).

**Where it plugs in.** Emit a `hamartiaRepair` block from `summarizeItem` (or a new
analyzer) → extend `adaptationAboxBridge.summaryToAbox` to assert
`HamartiaRepairStage gateFired` + the repair-origin inputs → add the repair axes to
the reconcile's `DERIVABLE` set. Then `repairWithoutRecognitionCredit` and
Scaffolded/SelfRepair reconcile on real cells, and the orthogonality (repair ⟂
recognition) becomes a real-data finding, not a fixture.

## Residual: the S5/S6 naming signal  **[SMALL]**

S5/S6 (old-check / replacement-check naming) are currently **proxied** from
"recognition produced". The real signal is the structure critic's pressure +
replacement frames (`scripts/critic-poetics-structure.js`). Lift those two booleans
into the ABox so S5/S6 are real and `chainComplete` is fully faithful (no proxy).
Closes the last gate-struct gap; small and well-defined.

## Parallel arc: the generative direction — sampler walks the TBox  **[ARC]**

The aim you named: *"a robust and replicable machine for generating varied forms of
adaptation, responsive to contexts and alter egos."* The same `ms:` TBox a critic
walks to **score**, a sampler can walk to **generate**:

- the 8-stage pipeline + `aimsAtForm` / `realizedBy` are already the seam;
- a sampler enumerates valid `(stage → move/trigger/reframe)` bindings under the
  ontology constraints (R6 form-conflicts, the alter-ego `correctsAgency` channels),
  sampling **varied-but-valid** `turn_plan`s — exactly what `/ms-drama-machine` and the
  new `/compose` UI already validate *against* (`validateTurnPlan`);
- *"responsive to contexts and alter egos"* = condition the sampler on the scene /
  persona slots (contexts) and the ego/superego/id agencies (alter egos).

**Connection.** The composer (`/compose`) is the manual front-end; the sampler is its
automation. Start small: have the sampler propose a `turn_plan` that the existing
`validateTurnPlan` accepts, then widen to full `drama:/cast:/audience:` specs. This is
where the drama-machine, the composer, and the ontology converge into the "machine".

## Smaller follow-ons

- **R-SAT** (diagnostic saturation) is rule-live but corpus-uninstantiated — needs a
  real multi-iteration loop run (the current loop has 1 usable iteration; i02 hit a
  stageError).
- **Wire into `DEFAULT_MODULES`?** Reconsider ONLY once the bridge is fully validated
  incl. the repair axis — and weigh the per-call reasoner cost. Likely keep it opt-in
  (consumers opt in explicitly; defaults shouldn't pay for it).
- **peripeteia_induced de-confound test** — its structural derivation still leans on
  author-family lexicons in the `tutorMechanism` conjunct. An A/B of
  structural-derivation vs critic-vote against a *model-clean* mechanism signal is the
  missing test.
