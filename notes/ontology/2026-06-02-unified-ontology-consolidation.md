# Unified Ontology: shared TBox + per-role defined/acquired ABoxes

Date: 2026-06-02 · Status: design v0.1 · Branch: `ontology-consolidation`
Makes **no empirical claims** — any results fold into `docs/research/paper-full-2.0.md` (single-paper
discipline). This is tooling + a model.

## 0. The core bet (what makes this not a §6.10 re-run)

Each role's **acquired ABox is its persona-memory, built through the dialogue**. Cross-role, the
slice of role A's ABox that is *about* role B is a **formal, inspectable theory-of-mind**: not
free text, but typed assertions (`learner_L1 a ms:AffirmingConsequent`, `learner_L1 ms:perceivesRole
ms:AuthorityToDeferTo`). Because it is Description Logic, it can be **checked for consistency** with
a DL reasoner.

That is the signal §6.10 lacked. §6.10 killed *modelling the concealed interior* because the
learner's logged free-text deliberation carried no recoverable, family-transferable structure
(95.7% within-family idiosyncratic). A free-text ToM cannot be checked for contradiction. A formal
ToM ABox **can**: `TBox + role.tom(other) ⊨ ⊥ ?` is a mechanical, deductive signal the base LLM
does **not** produce in-context. Whether that signal is *usable* (improves the drama / tracks real
recognition) is the open empirical question — and it is the §6.7–§6.10 success bar restated: *does
it add signal the strong base does not already infer from the surface, rather than re-encode it?*
DL inconsistency detection is a concrete candidate for "signal the base does not already produce."

The honest bound travels unchanged ([[dramatic-form-not-mindreading]]): a consistent, converging
ABox is *dramatic/structural form*, not a proof anyone learned. The win sought here is a **better
instrument**, not a learning claim.

## 1. What exists today (the review)

Two TBoxes, one namespace (`ms: https://machinespirits.dev/ontology/reasoning#`), one EYE pipeline:

- **`config/ontology/reasoning-core.ttl`** — KnowledgeComponents (DeductiveReasoning, ArticulateWarrant,
  DistinguishNecessarySufficient…), ReasoningErrors (AffirmingConsequent, MissingWarrant, OverextendedAnalogy,
  ScopeError), TheoryOfMindState (InterlocutorModel, BeliefHypothesis, SecondOrderBelief, PerceivedRole→
  AuthorityToDeferTo/ThinkingPartner, LowAnswerability, EvidenceAccessGap), RecognitionState (Misrecognition,
  RecognitionRepair, ContestableRepresentation, ConclusionOwned, ClaimOwnershipWeak), PolicyActions, and
  `RoleView` instances `tutor_ego/tutor_superego/learner_ego/learner_superego`. Plus guidance axioms
  (`X supportsPolicy / contraindicatesPolicy / indicatesMissingKC …`).
- **`config/ontology/poetics-core.ttl`** — same namespace, reuses `RoleView`; adds DramaticForm
  (Peripeteia/Anagnorisis/Catharsis/…), `DramaticRole ⊑ RoleView` = **TutorRole/LearnerRole/DirectorRole/
  CriticRole**, Character + InteriorAgency (Ego/Superego/Id; tutor has Id, learner does not), PlotDevice
  (ContinuationPolicy, **WithheldKnowledgeDevice**, ReversalTrigger), AdaptationMove catalog per role, Casting.
- **Rules** `reasoning-rules.n3` + `poetics-rules.n3` — subclass/type closure, property propagation,
  `blocksPrematurePolicy` (missing-KC guard), `hasFormConflict` (turn targets a form but includes a move
  that contraindicates it).
- **Runtime** `services/ontology/reasoningOntology.js` — `buildObservationABox(observations)` →
  EYE deductive closure → `buildOntologyGuidance({role})`. The A/B pilot (`run-ontology-ab-pilot.js`)
  injects this guidance into the tutor; result so far: null on explicit traps, marked win on a latent
  recognitive/ToM stress trap (`notes/ontology/2026-06-02-ontology-trap-search.md`).
- **DL reasoner already vendored**: `vendor/reasoners/elk/` + `scripts/run-elk-reasoner.js`
  (`npm run ontology:elk`). ELK is an OWL 2 EL classifier/consistency checker — **the consistency engine
  this design needs, not yet wired to any ABox**.

**The three gaps:**
1. The runtime loads **only `reasoning-core`** (`reasoningOntology.js:9-10`) — the drama TBox is never
   co-loaded with reasoning. → consolidate into one shared TBox, always co-loaded.
2. **No per-role ABox, no defined/acquired split.** `buildObservationABox` is ephemeral, tutor-only,
   discarded each call. → the missing instantiation layer.
3. **The TBox has no disjointness/cardinality axioms** → every ABox is trivially consistent. DL
   consistency-checking has no teeth until we add them.

## 2. Target architecture

```
            ┌─────────────────── shared TBox = "terms" (role/scenario-agnostic) ───────────────────┐
            │  reasoning-core.ttl  ⊕  poetics-core.ttl   (+ NEW: disjointness/satisfiability axioms) │
            └───────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ instantiated by
        ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
        ▼                        ▼                               ▼                          ▼
   LearnerRole ABox        TutorRole ABox                 DirectorRole ABox            CriticRole
   ─ defined (persona,     ─ defined (prompt_type,        ─ defined = GROUND TRUTH:    (judges artifact,
     start_state,            architecture, disposition)     the withheld S, premise     blind to all ABoxes)
     hamartia)             ─ acquired = ToM-of-learner      ledger, hamartia
   ─ acquired = self-model   + self-model (the memory      ─ (mostly defined; the
     + ToM-of-tutor          that builds via dialogue)       omniscient frame)
```

- **Defined axioms** = asserted at setup from the `drama:` spec (TAXONOMY's six parts). The spec block
  *is* the defined-ABox source: `hamartia → learner a ms:OverextendedAnalogy`; tutor `prompt_type`/
  `architecture`/`superego_disposition` → tutor character facts; director `secret`/`premise_ledger` →
  the ground-truth ABox the others can't see.
- **Acquired axioms** = the persona-memory. Generalize `buildObservationABox` into a **persistent,
  per-role accumulator**: each turn's observation tags append to that role's acquired graph, turn-stamped.
- **Theory of mind** = role A's acquired sub-graph *about* role B (`<roleA>.tom.<roleB>`). Inspectable
  (dump the TTL), and DL-checkable.
- **Director ontology** = the ground-truth ABox. The Oedipus screens already live here in spirit; this
  formalises them. Learner/tutor acquired ABoxes are *partial, fallible* views that may or may not
  converge on it.

## 3. Representation choices (open for steer)

- **Provenance**: file/named-graph level for the coarse split — `<run>/abox/<role>.defined.ttl`,
  `<role>.acquired.ttl`, `<role>.tom.<other>.ttl` (gitignored, like other run artifacts) — **plus**
  turn-stamp annotations on acquired triples (`ms:acquiredAtTurn N`) so the ToM's growth and the
  *first inconsistency* can be replayed turn-by-turn.
- **Consistency teeth (TBox extension)**: add `owl:disjointWith` / functional constraints so contradictions
  are detectable. Concrete candidates from the existing terms: `ConclusionOwned ⊓ ClaimOwnershipWeak = ⊥`;
  `AuthorityToDeferTo ⊓ ThinkingPartner = ⊥` (extremes of PerceivedRole); `Misrecognition ⊓ RecognitionRepair`
  on the same target at the same turn. These are *modelling decisions* — pick the disjointness set deliberately,
  since it defines what counts as a ToM contradiction.
- **Two reasoners, two jobs**: keep **EYE/n3reasoner** for forward-chaining *guidance* (supportsPolicy /
  blocksPrematurePolicy — already works); add **ELK** for *DL consistency/classification* over `TBox +
  role.tom`. (Wire `run-elk-reasoner.js` to the per-role ABox.)

**Disjointness set — decided 2026-06-02 (1B/2B/3A):** cut `Misrecognition ⊥ RecognitionRepair` (1B —
breakdown→repair is a diachronic transition, not a synchronic clash); moved casting/agency disjointness
to `casting-axioms.ttl`, a module loaded only by spec validation, not the default ToM check (2B); added
`KCMastered ⊥ KCMissing` attached to a per-(learner, KC, turn) status individual (3A). Kept
`AuthorityToDeferTo ⊥ ThinkingPartner` and `ConclusionOwned ⊥ ClaimOwnershipWeak`. (Implemented in
`config/ontology/consistency-axioms.ttl` + `casting-axioms.ttl`; 7/7 tests.)

## 3.1 Temporal + epistemic layering (proposed) — DL stays atemporal, modality stays out

Learning is nonmonotonic (earlier commitments are revisable) and ToM assertions are usually *guesses*,
not facts. Two literatures tempt us — temporal description logics and modal/epistemic DLs — but both are
research-grade with no maintained reasoner (ELK has no temporal/modal sibling) and high worst-case
complexity (temporal + expressive DL is PSPACE → undecidable). Embedding either INTO the reasoner is the
step too far. The feasible, higher-value realisation keeps the DL atemporal and puts both structures in
thin layers OUTSIDE it:

- **Temporal = snapshot-stratification + a sequence layer.** Materialise one ABox snapshot per turn (the
  `acquiredAtTurn` stamp); run plain DL consistency on each snapshot independently (ELK/EYE — tractable,
  tooling we have); express the cross-turn (LTL-style) patterns — *eventually consistent*, *inconsistency
  at t repaired by t+1*, *monotone vs revised* — as turn-indexed N3 rules / plain code over the sequence
  of snapshot results. This IS the synchronic/diachronic split: point-in-time axioms must be consistent;
  revision across snapshots is development, not contradiction.
- **Epistemic = a two-tier acquired ABox** (the right frame for "uncertainty" — ToM is *doxastic*, not
  alethic; the vocab already has `BeliefHypothesis` / `SecondOrderBelief`). Tag each acquired axiom
  `grounded` (observed / scenario-stipulated) vs `hypothesized` (the role's inference), optionally with a
  confidence weight. Check at two strengths: grounded-only MUST be consistent (a real error); a
  grounded + hypothesized inconsistency is the *pedagogically interesting* signal — a hypothesis refuted
  by observation = a detected misrecognition to revise. Delivers known/believed (□/◇) as graph-membership,
  no modal operators, and composes with the temporal layer (a hypothesis raised → tested → confirmed/
  refuted across turns).

Why layered beats monolithic: it keeps the symbolic core (per-snapshot DL consistency) clean, tractable,
architecture-independent and *falsifiable* — the §6.10-beating structured signal — rather than a slow,
unfalsifiable temporal-modal-DL black box that would replace the working ELK. Each layer is independently
inspectable + testable. Build order: temporal folds into step 4 (turn-stamped acquired accumulator) + a
small sequence analyzer; the epistemic tier folds into steps 3–4 (provenance tag on acquired axioms +
the two-strength check).

## 4. Evaluation (extends the existing A/B harness; results → paper)

Two **symbolic, architecture-independent** instruments the ABoxes unlock:
1. **Anagnorisis as set-overlap**: |learner.acquired ∩ director.defined(S)| over turns. Did the learner's
   memory come to contain the withheld axioms? Clean replacement for §6.10's tf-idf concealment proxy,
   and the formal version of the Oedipus "did the `none`-arm learner reach S" outcome check.
2. **Misrecognition as DL inconsistency**: turns at which `TBox + tutor.tom(learner) ⊨ ⊥` (the tutor's
   model of the learner became incoherent) — and whether a repair move restores consistency. A formal
   event detector for recognition repair.

Arms (build on `run-ontology-ab-pilot.js`): role-ABox off / defined-only / defined+acquired; with vs
without ELK consistency feedback to the tutor. Success bar = adds signal beyond what the base infers
in-context ([[adaptivity-what-works]]); honest bound = dramatic/structural form, not learning ([[project_dramatic_transfer_fail]]).

## 5. First implementation steps (proposed — confirm before I build)

1. ✅ **TBox consolidation**: co-load `reasoning ⊕ poetics ⊕ consistency` in `reasoningOntology.js`.
2. ✅ **Disjointness axiom set** (decisions 1B/2B/3A): `consistency-axioms.ttl` (ToM) + `casting-axioms.ttl`
   (spec-validation, opt-in module).
3. **`specToDefinedABox(drama, role)`**: drama spec block → per-role defined ABox (feeds the same accumulator).
4. ✅ v0.1 **Acquired accumulator** (`services/ontology/acquiredAbox.js`, built acquired-first): per-role,
   turn-stamped, two-tier (grounded/hypothesized) records + per-turn snapshot consistency (latest-wins
   revision per `(subject, dimension)`) + a sequence analyzer (firstMisrecognition / repairs / transitions).
   Fixture misrecognition→repair trace end-to-end in `tests/acquiredAbox.test.js`.
5. **ELK wiring**: upgrade the EYE precursor to proper OWL 2 EL DL consistency over `TBox + role.tom(other)`.
6. **Eval**: the two symbolic metrics (§4) as arms in the A/B harness.

Status: **1 ✅, 2 ✅, 3 ✅, 4 ✅ v0.1, 6 ✅ v0.1** (post-hoc A/B readout on real Codex dialogues —
`scripts/analyze-ontology-tom.js`, write-up in `2026-06-02-ontology-tom-eval.md`: symbolic
learner-outcome Δ≈0, and the judge's stress-trap win is tutor-move-side, not learner goal-attainment —
the independent channel declines to corroborate it as *learning*). Key conceptual finding: ToM
*consistency* ≠ pedagogy (scaffolding is productive inconsistency). Next: step 5 (ELK) for
production-grade DL; the proper ToM-feedback A/B needs an **attended** multi-turn run.
