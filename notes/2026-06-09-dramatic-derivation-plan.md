# Dramatic Derivation — One Drama, a Contingent Secret, a Visible World

**Status:** exploration brief, 2026-06-09. Seeds the worktree branch
`claude/dramatic-derivation` (worktree `../machinespirits-eval-derivation`).
Supersedes-in-part `notes/2026-06-09-adaptation-ecology-plan.md` (the validity layer —
the same-weights theorem, the triple contrast, the yoked logic — carries
forward; the item-bank corrupted-prior instrument and the G0 *opacity* gate
are parked, the latter deliberately **inverted** here). Sibling to
`DRAMATIC-RECOGNITION-PLAN.md` (the poetics master plan) and heir to the
Oedipus guided-discovery spec
(`notes/poetics/2026-05-29-oedipus-guided-discovery-spec.md`). Any result
lands as **≈§6.13** of `docs/research/paper-full-2.0.md`, cross-referenced
with the poetics §§ (single-paper discipline; positive or negative).

---

## 0. The position you are inheriting (read before staging)

**The theorem (from the ecology brief, kept).** In a dyad where tutor and
learner share weights and the target is weight-derivable, any outcome the
tutor can induce the learner can reach by recursion alone — tutoring can
affect *rate*, never *possibility*. Two exits: an **information gradient**
(the target is contingent — not in the weights — so transmission is the only
path) and an **efficiency gradient** (bounded episode resources make
per-episode derivation infeasible). This design takes the information exit as
primary: the secret S and its premise set are authored particulars. The
learner *cannot* recurse to S because the premises do not exist outside the
drama until released. Strong learner control is preserved exactly as the
theorem requires: the agent is never weakened, only the episode is shaped.

**The substrate finding (kept).** The simulated learner is informationally
transparent and behaviorally cooperative (§6.10 leak; A19 self-solve; A19R
cooperation; Oedipus derivability; §6.8 scheduled traps). The ecology brief
fought the first property (construct opacity); this design **concedes it and
inverts it**: everything is visible *by design*, and adaptation is relocated
from *diagnosis of the concealed* to *navigation of the revealed* — steering
a visible world-model through a derivation at a controlled tempo. The
game-theoretic headroom comes from the information gradient, not from hiding.

**What the four PRs point at (kept).** §6.12 closed transcript-reading:
"no causal adaptation-versus-compliance signal sits in the revision to read —
the distinction needs a counterfactual." A19 closed repair-authoring with
"stop, or make a new protocol-level decision about evidence units." This
brief is that decision: the evidence unit becomes the **derivation
trajectory** — which premises were on the table, what the learner's world
entailed, when recognition became *forced* — all checkable by a reasoner,
none of it a judge's reading.

**The Oedipus pilot null, diagnosed (new here).** The first paid smoke
nulled for two proximate reasons: scenes ended on the tutor before the
learner's recognition, and the learner converged on a *near-miss* (the
"mirror" — possibly-identical, not forced-distinct). Both get direct fixes:
**length** (the drama runs until grounded recognition or the turn cap, never
ending on a tutor line) and **groundedness** (the symbolic checker —
`scripts/oedipus-symbolic-check.js` — exists precisely to separate forced
recognition from the mirror and from a lucky leap; it becomes the success
channel). Its docstring names its own bottleneck: "the NEURO half (translate
NL dialogue → these facts) is the integration bottleneck." The visibility
doctrine dissolves that bottleneck by construction — the learner posts its
facts formally itself; nothing needs translating.

**Two rails on the reprise (do not relitigate, do not skirt):**
- *Charisma (§6.7):* the negative was "performed legitimacy; **never measured
  uptake**." Here uptake is formally measured (grounded recognition, slope
  adherence), so the charisma question becomes answerable for the first time
  — as **covariation of form with trajectory**, not as a mechanism cell.
- *Ontology-ToM (null):* formal state fed to the tutor was redundant when the
  learner's prose was long and expressive — the base already read it. Short
  outputs change the density conditions: a 3-sentence turn cannot carry a
  40-fact world. Whether the tutor's access to the learner ABox now carries
  non-redundant signal is a **bounded phase-2 ablation**, not an assumption.

---

## 1. The one question

**Can a director–tutor dyad holding a contingent secret stage its derivation
so that a strong, fully visible learner is brought to a *forced* recognition —
neither leaked (sudden reveal) nor stalled (aporia) — and does the quality of
the staging (adaptive moves, figures, charisma) covary with the trajectory?**

Phase 1 is generative: produce **one** drama that works, by iterating the
tutor's role-script against a fixed plot. Phase 2 is measurement: the
contrasts that say the staging *mattered* (self-study, yoked, access
ablation), pre-registered only after phase 1 has something worth measuring.

---

## 2. The design

### 2.1 World and secret

A seeded, authored fact-system in the `ms:` namespace (Turtle ABox + N3
rules, the existing `config/ontology/` pattern — EYE closure via
`services/ontology/reasoningOntology.js`):

- **S** — the secret: a goal assertion derivable *only* by chaining released
  premises through the world's rules. A contingent particular (the Oedipus
  screen's requirement): authored, not Meno-derivable from genre knowledge.
- **The proof DAG** — S's derivation structure, authored with the world:
  minimum depth ≥ d (frozen per scenario), no single premise within
  one step of S until the planned window. **The proof DAG is the plot
  skeleton**: the director's scene plan is a dramatised traversal of it.
- **Two leak screens, both before any paid loop:**
  - *Formal (exact, free):* at every planned release prefix, the closure of
    released premises must not entail S before the floor turn. Computed, not
    judged.
  - *Guessability (sampled, cheap):* `npm run poetics:screen-underivability`
    on the learner-visible context K_L — a strong bare model must not place S
    among its top guesses. The existing screen, reused as-is (`--mock` first).

### 2.2 Roles (no superegos; short outputs; many turns)

| role | channel | output per turn | holds |
|---|---|---|---|
| **Director** | stage directions + premise releases (scene cards) | 1–2 sentences + optional release token | plot, proof DAG, S |
| **Tutor** | dialogue | ≤3 sentences + declared move metadata | S, proof DAG, released ledger, learner's visible world |
| **Learner** | dialogue | ≤3 sentences + ABox delta + one hypothesis line | only what the drama has shown it |

- Turn budget 30–60 (frozen per scenario). Exchanges tight and fast — the
  drama earns length by turns, not by per-turn volume.
- **Director is frozen between prompted revisions.** The iteration loop
  (§3) re-does only the tutor's role-script. The director's plot is revised
  only on explicit operator decision, when the diagnosis says the *plot*
  (not the staging) is what fails.
- The tutor's **move metadata** (figure used, target premise, intent) is
  typed against `rhetoric-core.ttl` (the figures) and
  `discursive-game-core.ttl` (tactic → public move → uptake — the
  scorekeeping vocabulary built for exactly this: "what facts must be present
  before the system may call a transcript 'accountably adaptive'").

### 2.3 The visibility doctrine

**The only concealed things in the whole design are S and the unreleased
premises.** No hidden deliberation channels anywhere — no ego/superego
backstage, no concealed learner interior (§6.10 honored by inversion, not
evasion):

- The **learner's world is a visible artifact**: an acquired ABox
  (`services/ontology/acquiredAbox.js` — reused role-symmetrically: built for
  the tutor's model of the learner, now *the learner's model of the world*),
  with its native GROUNDED vs HYPOTHESIZED tiers. Facts learned from
  dramatic action post as GROUNDED; the per-turn hypothesis line posts as
  HYPOTHESIZED. Retraction/repair events fall out of `checkSnapshot` —
  peripeteia gets a formal shadow.
- The tutor reads the learner's ABox **openly** and adapts to it in plain
  sight. Adaptation is observable as: which premise next, which figure,
  paced how — given *this* visible state.
- Tutor move metadata is visible to the analyst (and the transcript reader)
  but not injected into the learner's context.

### 2.4 Tools (node scripts the tutor and director can call)

The user-facing point: lessons are *structured* by computation, not vibes.

- `entailment_check` — closure of (released ∩ learner-GROUNDED) facts under
  world rules; returns: does it force S? what remains? **proof tree on
  success** (which facts did the forcing — the checker's native talent).
  Implementation: EYE closure or the union-find checker generalized;
  requirement frozen: sound, deterministic, proof-producing.
- `slope_monitor` — D(t): remaining minimal derivation distance to S given
  the learner's current GROUNDED set. The drama's instrument panel.
- `release_ledger` — what has entered play, when, via whom (director
  direction vs tutor dialogue).
- `consistency_check` — EYE over `consistency-axioms.ttl`: has the learner's
  world gone contradictory? (A *dramatic* event when it happens — the moment
  the learner must retract — not a crash.)
- Director-side: `plot_lint` — pre-run validation that the planned release
  schedule satisfies the slope constraints (§2.5) against the proof DAG.

### 2.5 The slope (the dramaturgy, made measurable)

Let D(t) = derivation distance after turn t. Frozen constraints per scenario:

- **Anti-reveal:** closure must not force S before turn floor T_min.
- **Anti-aporia:** D(t) must strictly decrease at least once every k turns
  (premises landing, hypotheses firming) — else the run is diagnosed stalled.
- **Grounded anagnorisis** (the success event): the learner *asserts* S in
  dialogue **and** `entailment_check` returns *forced* on its own GROUNDED
  facts. Asserting S unforced is a **lucky leap** (logged, not a win);
  converging on the possibly-identical reading is the **mirror** (the
  Oedipus near-miss, now formally distinguishable); forced-but-unasserted is
  a *staging* failure (the learner has it and doesn't know it — the tutor's
  recognition scene failed).

The failure taxonomy is therefore programmatic, and it drives the loop:
**leak** (screen or anti-reveal breach) · **aporia** (D plateau) ·
**lucky leap** · **mirror** · **inconsistency** · **disengagement** (no ABox
growth over m turns) · **unstaged recognition** (forced, never asserted).

---

## 3. Phase 1 — the staging loop (generative; this is the worktree's work)

1. **Mock plumbing first, free.** Deterministic role mocks; engine, ledger,
   checker, slope monitor, logs verified end-to-end under
   `EVAL_DB_PATH`/`EVAL_LOGS_DIR`. No paid call until the harness replays a
   scripted drama cleanly.
2. **One scenario.** Author one world + proof DAG + plot. Run the leak
   screens. Freeze the world, the checker, and the slope constraints.
3. **Iterate the tutor's role-script only.** Run → programmatic diagnosis
   (the §2.5 taxonomy) + a transcript read → revise the tutor's standing
   role-script (persona, figure palette, pacing policy) → run again. The
   `poetics:adaptation-loop` pattern, with the diagnosis now computed rather
   than judged. Director and plot stay frozen until the operator explicitly
   decides the plot is the problem.
4. **No κ bar, no numeric gate, in phase 1.** The aim is generative
   (`feedback_dramatic_generative_not_oracle`): one drama that reads as
   compelling *and* whose recognition event is forced. What is frozen is the
   success definition (grounded anagnorisis), the leak screens, and the cost
   cap — the things that keep iteration from corrupting evidence.
5. **Cost discipline:** cheap model default, short outputs × many turns is
   still small; attended; hard turn cap; per-run cost logged.

## 4. Phase 2 — measurement (sketch only; pre-registered later)

Only after phase 1 produces a working drama:

- **Rubric extension.** Score transcripts with the poetics rubric (form:
  peripeteia, anagnorisis) and the **charisma rubric**
  (`config/evaluation-rubric-charisma.yaml`, Weber 8-dim — the cells 101–109
  instrument, reprised). The new question: **does form/charisma covary with
  the trajectory** (time-to-anagnorisis, slope adherence, grounded-vs-lucky
  rate)? Form stays form (`dramatic-form-not-mindreading`): the learning
  evidence is the reasoner channel; the rubrics describe *what good staging
  looks like*, and the covariation is the finding either way.
- **The validity triple ports from the ecology brief.**
  (1) *Success is real:* grounded anagnorisis, checker-verified.
  (2) *Success is not recursion:* a self-study arm — same release schedule
  delivered flat (no adaptive tutor, matched tokens). The theorem predicts
  the learner cannot reach S *early* (premises withheld); the question is
  whether it reaches grounded S at all, late, slower, or only lucky-leaps.
  (3) *Success flows through staging:* yoked arms — transplanted tutor turns
  (`scripts/replay-one-side.js` pattern), same-plot vs different-plot.
- **The access ablation:** tutor with vs without the learner-ABox channel —
  the bounded test of whether visibility carries non-redundant signal under
  short outputs (the ontology-ToM null's boundary, tested not assumed).

## 5. Frozen guardrails

- **Single concealment.** S + unreleased premises. Everything else visible.
  No concealed-interior re-run in any form.
- **Architecture-independent success channel only.** The checker decides
  grounded anagnorisis; no LLM judge in the success loop, ever. Rubrics
  (poetics, charisma) describe form and never adjudicate success.
- **Iterate the staging, never the success definition.** Checker, screens,
  slope constraints, and turn cap are frozen before the first paid run.
- **One scenario until it works.** No fan-out of worlds, casts, or variants.
  Director revisions are explicit operator decisions, logged with reasons.
- **Paid runs attended, capped, serialized** (one attended paid thing at a
  time; `feedback_attended_quota_runs`).
- **Brief on `main` seeds the worktree** (house pattern). Lands as ≈§6.13;
  no spin-off.

## 6. Explicitly out of scope (for now)

- Superegos on either side (tight/fast/iterated comes first; deliberation
  layers return only with a reason).
- Multi-scenario sweeps; cell registration in `tutor-agents.yaml` (phase 2,
  if ever).
- Weight updates of any kind (the teacher-as-learner decision rule stands).
- Rebuilding ontology-ToM as tutor feedback (only the §4 access ablation).
- The human pilot (Track C waits; this design's instruments — visible world,
  forced recognition, slope — are exactly what the pilot would inherit).
- Re-litigating poetics κ (form-classification is settled vocabulary here).

## 7. Pointers

**Machinery this assembles (all existing):**
`scripts/oedipus-symbolic-check.js` (forced vs mirror vs lucky leap; proof
pinpointing) · `scripts/screen-s-underivability.js` +
`notes/poetics/2026-05-29-oedipus-guided-discovery-spec.md` (the leak screen
+ K_L assembly) · `scripts/generate-pedagogical-dramas.js` +
`scripts/drama-generator.js` (Director scene cards, public/full separation,
role routing) · `config/ontology/` modules — `reasoning-core`,
`poetics-core`, `discursive-game-core` (+ `-rules.n3`), `rhetoric-core`,
`consistency-axioms`, `adaptation-core`, `casting-axioms` —
via `services/ontology/reasoningOntology.js` (EYE; opt-in module loading) ·
`services/ontology/acquiredAbox.js` (GROUNDED/HYPOTHESIZED tiers,
trajectory, checkSnapshot) · `services/ontology/turnPlanSampler.js` ·
`services/idDirectorEngine.js` + `config/evaluation-rubric-charisma.yaml`
(the charisma reprise) · `config/evaluation-rubric-poetics.yaml` ·
`npm run ontology:test` (5 suites) · `scripts/replay-one-side.js` +
`.claude/skills/ms-replay-one-side` (yoked plumbing) ·
`EVAL_DB_PATH`/`EVAL_LOGS_DIR` (hermetic).

**Position docs:** `notes/2026-06-09-adaptation-ecology-plan.md` (validity layer;
superseded-in-part) · `notes/2026-06-09-adaptation-exploration-plan.md` (Tracks A/B/C)
· `DRAMATIC-RECOGNITION-PLAN.md` · `docs/research/paper-full-2.0.md`
§6.7–§6.12, §7.9 (A18 arc).

**Memories honored:** `project_oedipus_screen_rejects_diagnostic_secrets` ·
`project_oedipus_paid_smoke_null` · `dramatic-form-not-mindreading` ·
`feedback_dramatic_generative_not_oracle` · `project_ontology_tom_layer_null`
· `closed-loop-eval-tells` · `adversarial_superego_v3_result` ·
`feedback_attended_quota_runs` · `feedback_single_paper_discipline`.
