# The Drama Machine — A Structural Model for Pedagogical Dramaturgy

**Status:** design / v0.2 (2026-07-11). Systematises machinery already in the repo; does **not** yet implement the to-build elements it names.
**Companions:** [`ADAPTATION-MOVES.md`](ADAPTATION-MOVES.md) (the per-role move catalog) · [`SPEC.md`](SPEC.md) (how to declare a drama) · [`example-drama.yaml`](example-drama.yaml) (a runnable one) · [`config/ontology/poetics-core.ttl`](../../../config/ontology/poetics-core.ttl) (the formal ontology) · [`.claude/skills/ms-drama-machine/`](../../../.claude/skills/ms-drama-machine/SKILL.md) (the invocable assembler).
**Arc:** serves `DRAMATIC-RECOGNITION-PLAN.md`. Makes no new empirical claims (those live only in `docs/research/paper-full-2.0.md`).

---

## 0. What this is

The repo can already *generate* a tutoring dialogue as a **drama** (`director` scene-author card → ego/superego tutor and learner → critic panel scores it on Aristotelian form). But the dramaturgical pieces — characters, plot devices, staging, the audience — are scattered across `generate-pedagogical-dramas.js`, the interaction engine, a dozen config YAMLs, and the critic scripts. **None of it is named as one system.**

The **drama machine** is that system, named. The goal:

> *"Generate a **tutor like X**, a **learner like Y**, on **topic T**, with **peripeteia / catharsis** — and let me say which roles are **human** and which are **LLMs**, and **which critics** judge it."*

A **drama** is a *binding of values to slots*. The **drama machine** is three stages over those slots:

```
   BRIEF                SAMPLE                ASSEMBLE              JUDGE
 (natural        →   (fill unspecified  →  (generate-pedago-  →  (critic panel:
  language or         slots from priors     gical-dramas.js +     poetics rubric,
  partial spec)       / distributions)      the engine)           k-of-n consensus)
                            │                     │                    │
                       the sampler          the assembler         the audience-critic
                       [TO-BUILD]            [WIRED]               [WIRED]
```

The assembler and the audience exist. The **sampler** (turn a brief into a filled spec) is the new connective tissue the `/ms-drama-machine` skill provides. The deep gaps (act structure, multi-learner, recognition/catharsis *generators*) are roadmap, marked **[TO-BUILD]** throughout.

---

## 1. The organizing principle — Aristotle's six parts, plus the audience, plus the cast

Aristotle (*Poetics* ch. 6) decomposes tragedy into **six parts**: *mythos* (plot), *ethos* (character), *dianoia* (thought), *lexis* (diction), *melos* (composition), *opsis* (spectacle). This project's poetics rubric is already Aristotle-derived, so the same decomposition is the natural spine for the *generation* side. To it we add:

- **The Audience** (*theatron*) — a first-order dramatic position from which the speech or drama is witnessed. It may be actual or implied, may coincide pragmatically with the hearer or be a distinct third party, and has **no enacted role**: no turn, cast binding, interior agency, or belief/desire graph. The critic panel is one evaluative implementation of this broader position; it does not exhaust it.
- **The Cast** — a cross-cutting axis orthogonal to all six: *who plays each part* (human / LLM / mock). A character (ethos) is the same character whether a human or an LLM voices it; casting is independent of authorship.

```
        ┌──────────────────────────  THE DRAMA (the artifact)  ─────────────────────────┐
        │                                                                                │
        │   MYTHOS      ETHOS       DIANOIA      LEXIS        OPSIS        MELOS          │
        │   (plot)      (character) (thought)    (diction)    (spectacle)  (composition)  │
        │   ───────     ─────────   ─────────    ─────────    ──────────   ───────────    │
        │   acts,       tutor &     pedagogy &   voice,       scene,       turn cadence,  │
        │   devices,    learner     dialogue     register,    staging,     cue timing,    │
        │   reversal,   personae +  approach,    constraints  stage-       act pacing     │
        │   secret      interior    recognition,              direction                  │
        │              (ego/su-     reasoning                 style                       │
        │               perego/id)  ontology                                             │
        │                                                                                │
        └───────────────────────────────────┬────────────────────────────────────────────┘
            ▲ cross-cuts all six             │ is witnessed / judged from
        ┌───┴──────────────┐         ┌───────▼─────────────────┐
        │   THE CAST       │         │   THE AUDIENCE          │
        │  who plays each  │         │  actual or implied;     │
        │  role: human /   │         │  no role / turn / cast; │
        │  llm:<backend>   │         │  critic panel = one     │
        │  / mock          │         │  evaluative instance    │
        └──────────────────┘         └─────────────────────────┘
```

The formal hierarchy is `DramaticPosition → {DramaticRole, Audience}`. Tutor,
learner, director, and critic are enacted roles under `DramaticRole`; `Audience`
is the sibling non-enacted position, with `CriticPanel` as a subtype. Audience is
therefore first-order alongside the roles without becoming a fourth role or a
fourth `{T,L,D}` belief/desire bearer.

**Status legend** used in every table below:
- **WIRED** — runs today; the skill can emit a spec that exercises it.
- **PARTIAL** — exists but cosmetic / not enforced / asymmetric.
- **TO-BUILD** — named here, not yet implemented; needs engine work.

### 1.1 Terminology policy: director, author, staging

The repo uses `director` in three different neighborhoods. The policy is to
split the concepts in documentation while preserving the serialized key:

| Surface | Keep / use | Rationale |
|---|---|---|
| Runtime keys, CLI flags, traces, cached plans, `cast.director`, `role: director`, `via: director` | Keep `director` | These names are compatibility-bearing and already appear in generated artifacts, tests, URLs, role maps, and config. |
| Human-facing docs and UI labels | Prefer `scene author / director` when the role is being selected | This names the actual function: author scene ecology, public stage material, speaker order, and scheduled cues. |
| Future split, if needed | Reserve `authorial_voice` for setup authorship and `staging_director` for live cueing | No loader accepts these aliases today; adding them would be a small compatibility shim, not a repository-wide rename. |
| `id_director` / id-director charisma family | Leave unchanged | This is a separate tutor architecture: an id authors the tutor ego prompt. It is not the drama-machine scene-author role. |

No archived empirical artifact or paper claim should be renamed or reinterpreted
as part of this vocabulary clarification.

---

## 2. MYTHOS — Plot ("the arrangement of the incidents; the soul of the tragedy")

The dramatic shape and the devices that produce it. **This part has the most modular plumbing and the deepest gaps.**

### 2.1 Act / beat structure — **[TO-BUILD], the central gap**

There is **no act structure today**. The engine is a flat `while (turnCount < maxTurns)` loop (`services/learnerTutorInteractionEngine.js`); cues fire at a fixed absolute `after_turn` number (almost always turn 2). There is no exposition / rising-action / climax / denouement schema, no turn-range placement, no notion that the reversal should land at a structural midpoint.

Proposed schema (forward-looking; the spec accepts it, the engine ignores it until built):

| Beat | Aristotelian role | Placement | Maps to |
|---|---|---|---|
| `exposition` | establish the hamartia (misconception) | opening | `learner_start_state` |
| `complication` | the error does dramatic work | early-mid | rising tutor/learner pressure |
| `peripeteia` | reversal of the situation | mid–late | `tutor_adaptation_policy: peripeteia` |
| `anagnorisis` | recognition named in the drama | coincident with / after peripeteia | **no generator yet** (§2.4) |
| `catharsis` | earned clarification that lands | close | **no generator yet** (§2.4) |

### 2.2 Plot devices — **WIRED, but a flat enumeration**

Three device families, fully wired, today selected by CLI flag / spec field. Each coarse policy below *bundles* finer-grain **adaptation moves** inside its prompt prose — those are unbundled, per role, in [`ADAPTATION-MOVES.md`](ADAPTATION-MOVES.md) (which is what lets you specify per-role, per-turn move-sets via `turn_plan:`).

**Director continuation policies** (what the learner must do with an earlier line of theirs, injected as a STAGE cue after turn 2):

| Device | Effect | Status |
|---|---|---|
| `none` | no cue — any reversal is organic (control arm) | WIRED |
| `anchor` | replay an earlier learner line verbatim; learner must engage it | WIRED |
| `revoice` | learner must repeat/paraphrase the line, then say what it now misses | WIRED (compliance-checked) |
| `reconsider` | learner must quote it and judge: stands / narrow / replace | WIRED |
| `reframe` | three-slot card: old wording / what it hid / replacement frame | WIRED (strongest; compliance-checked) |

**Tutor adaptation policies** (what the tutor does when a reversal event fires):

| Device | Effect | Status |
|---|---|---|
| `none` | no adaptive instruction (default) | WIRED |
| `routine` | **negative control** — tutor instructed *not* to adapt | WIRED |
| `uptake` | tutor visibly adapts to a learner reframe (contrast frames, change task) | WIRED |
| `peripeteia` | tutor invents a *mechanism-level* new device (the reversal generator) | WIRED |
| `uptake+peripeteia` | both in one turn | WIRED |
| `socratic_discovery` | Oedipus: meter premises as questions, draw out the learner's own conclusion | WIRED |
| `reveal_secret` | Oedipus ceiling: state S plainly | WIRED |
| `withhold_secret` | Oedipus control: redact S/premises from tutor context and forbid clue channels | WIRED |

**Reversal-event triggers** (the engine's classification of learner pressure that *gates* the peripeteia instruction; priority-ordered):

`pseudo_catharsis` (500) > `closure_pressure` (420) > `breakdown` (360) > `resistance` (300) > `misfit` (220). Detected by lexical/structural pattern + `services/pseudoCatharsisDetector.js`.

### 2.3 The withheld-knowledge device (dramatic irony) — **WIRED, Oedipus-gated**

The `secret` block is a reusable dramatic-irony engine: the tutor holds a truth **S** the learner does not, plus an ordered `premise_ledger` entailing it (premises 1–2 are "obvious checks" that leak nothing; S lives in premises 3–N). An information-asymmetry guard (`assertSecretAbsent`) throws if S or a premise leaks into the learner's prompt.

```yaml
secret:
  fact: "<the withheld conclusion S>"
  premise_ledger: ["<obvious check>", "<obvious check>", "<the distinguishing premise>", ...]
  symbolic:                       # optional formal encoding for a static screen
    facts: [{resolves: [...]}, {distinct: [...]}]
    goal: [distinct, entity_A, entity_B]
```

**Generalisation [TO-BUILD]:** today this only activates under `evaluation_role: oedipus_guided_discovery`. Any drama could carry a `secret` to create reader/learner dramatic irony — the device is more general than its current gate.

### 2.4 The poetic targets — peripeteia is *generated*; anagnorisis & catharsis are only *detected*

This is the sharpest asymmetry in the whole machine:

| Target | Generated? | Detected/guarded? |
|---|---|---|
| **Peripeteia** | YES — `tutor_adaptation_policy: peripeteia` | `analyze-dramatic-reversal.js` |
| **Anagnorisis** | **NO generator** — only the Oedipus socratic press approximates it | lexicon in `analyze-dramatic-reversal.js` |
| **Catharsis** | **NO generator** | only a *guard* against fakes: `pseudoCatharsisDetector.js` |

**[TO-BUILD]:** a *recognition generator* (a "recognition press" device that requires the learner to author what they now understand differently — generalising the Oedipus socratic ending to any misconception) and a *cathartic-closure device* (a final earned-resolution beat distinct from pseudo-catharsis).

### 2.5 Hamartia & unity — **PARTIAL**

`learner_start_state` carries the misconception (the hamartia), but it is untyped and not *linked* to the reversal trigger — nothing guarantees the peripeteia is caused by *that* flaw. Unity of action is *scored* by the critic, never *enforced* by the generator.

### 2.6 Device taxonomy — **[TO-BUILD]**

The devices above are flat lists. A real taxonomy would be a hierarchy (`Reversal → {epistemic, role, object, social-consequence}`) with each device declaring *which rubric dimension it aims at* — which is exactly what the ontology (`poetics-core.ttl`) is for.

---

## 3. ETHOS — Character (the dramatis personae)

### 3.1 Tutor-character slots — **WIRED**

| Slot | Value space | Default |
|---|---|---|
| `prompt_type` | base · recognition · enhanced · placebo · naive · hardwired · memory · matched_pedagogical · matched_behaviorist · dialectical_{suspicious,adversary,advocate,…} · divergent_{…} | base |
| `architecture` | `ego_only` · `ego_superego` · `id_director` | ego_only |
| `superego_disposition` | standard · suspicious · adversary · advocate · strict · coupling | standard |
| `recognition_mode` | true · false | false |
| `id_tuning` (id cells) | charisma · pedagogy · balanced | balanced |
| `register_classifier` (id cells) | true · false | false |
| `witness_exemplars` (id cells) | true · false | false |
| `conversation_mode` | single-prompt · messages | single-prompt |

### 3.2 Learner-character slots — **WIRED**

| Slot | Value space | Default |
|---|---|---|
| `persona_id` | confused_novice · eager_explorer · focused_achiever · struggling_anxious · adversarial_tester | eager_novice (built-in) |
| `architecture` | unified · ego_superego · unified_recognition · ego_superego_recognition · ego_superego_authentic · ego_superego_recognition_authentic | unified |
| `superego_disposition` | standard · authentic · recognition · recognition_authentic | standard |
| `ego.model` / `superego.model` | any OpenRouter alias | nemotron / kimi-k2.5 |

### 3.3 Interior life — the ego / superego / id simulation — **WIRED, asymmetric**

Both sides run a genuine multi-call deliberation (not templated):

```
TUTOR   ego → superego (PASS/PARTIAL/FAIL critique) → ego adjudication (FINAL)     [3 calls]
   or   id  → ego (id authors a fresh ego prompt each turn, then ego executes once) [id_director cells]
LEARNER ego → superego (advisory critique) → ego adjudication (FINAL, ego has authority) [3 calls]
```

Persisted to traces: `internalDeliberation[]` (role, stage, full content, metrics) both sides; tutor/learner **writing pads** (3-layer conscious/preconscious/unconscious for the learner); `id_construction_trace` for id cells.

**Asymmetry [TO-BUILD]:** the **tutor has an `id`** (a meta-authorial layer that evolves its persona turn-by-turn); the **learner does not** — its persona is fixed for the whole drama. A symmetric *learner-id* would let a learner's character evolve under pressure. This `id`/`id_director` terminology is separate from the drama-machine `director` key.

### 3.4 Multiple learners — **[TO-BUILD], the vision's end-state**

`runInteraction` is single-`learnerId` throughout. Memory is already `learnerId`-keyed (clean), but there is no multi-learner loop, no cross-learner turns, no group-modelling tutor. Supporting *"multiple learners, each with rich interior life"* needs: an outer fan-out over learner instances, cross-learner turn routing in the trace, and a tutor that addresses a group. **Non-trivial architectural change** — the single biggest lift toward the full vision.

### 3.5 Missing character dimensions — **[TO-BUILD]**

A playwright would expect slots that do not exist: `goal`/`motivation` (tutor: "get the learner to discover X by beat N"; learner: "prove competence" vs "avoid exposure" vs "genuinely understand"), `backstory` (declared prior history, vs the writing-pad's *accumulated* history), `status`/`power` (today `relationship` is injected but **cosmetic** — it shapes only public-speech constraints, not epistemic authority), `name`/`voice_signature`. The inert `traits` fields (`frustration_threshold`, `persistence`, …) on the default persona are a stub of this.

---

## 4. DIANOIA — Thought (what the characters reason and argue)

### 4.1 Approach databases — **WIRED**

Two repertoires looked up from config (the "thought" each side performs):

- **`pedagogical_approach`** → `config/poetics-calibration/pedagogical-approaches.yaml`: socratic_elenchus · bloom_cognitive_ladder · vygotsky_zpd_scaffolding · montessori_prepared_environment · skinner_behavioral_feedback · freire_problem_posing · hegelian_recognition · brecht_epic_distanciation · dewey_experience_inquiry · hidden_curriculum · didactic_literature …
- **`dialogue_approach`** → `config/poetics-calibration/dialogue-approaches.yaml`: aristotelian_reversal · shakespearean_scene_turn · miller_social_reckoning · socratic_short_exchange · brechtian_placard · catechism_recitation · online_thread · workshop_clinic · courtroom_cross_examination · bakhtinian_polyphony · seminar_dispute · no_stage_plain_transcript …

### 4.2 Recognition epistemology & the reasoning ontology — **WIRED (ontology is separate)**

`recognition_mode` switches on the Hegelian through-line. Separately, the repo has a **real reasoning ontology** (`services/ontology/reasoningOntology.js` + `config/ontology/*.ttl/.n3`, EYE/N3 reasoner): it classifies learner-utterance observations (KC gaps, ToM states, reasoning errors) and infers recommended/forbidden tutor **policy actions**. This is the *formalised* dianoia. The drama taxonomy plugs into the **same** formalism — see [`poetics-core.ttl`](../../../config/ontology/poetics-core.ttl).

### 4.3 The secret's content

The withheld **S** (§2.3) is dianoia under embargo — the thought the learner must reconstruct.

---

## 5. LEXIS — Diction (the manner of speech) — **WIRED**

Carried by the `directorPlan` and `VOICE_VARIANTS` (6 seeded bundles), all injected per-side:

| Slot | Value space |
|---|---|
| `locale` / `register` | free text (or a VOICE_VARIANT) |
| `person_policy` | free text (e.g. second-person budget) |
| `voice_constraints` | free text diction fence |
| `direct_address_budget` | free text (default: ≤1 "you/your" validation beat per turn) |
| `side_constraints.{tutor,learner}` | per-side speech constraints |

### 5.1 Register is relational, not an intrinsic tone label

The free-text `voice.register` and the tutor-stub's selected
`engagement_stance` are realized in a communicative relation:

```
RegisterRealization(speaker, hearer, engagement_stance, audience?)
```

`speaker` and `hearer` are turn-relative roles. `audience` is optional and
non-enacted. This makes a distinction the former dyadic vocabulary obscured:
sarcasm typically addresses a hearer while recruiting a separate actual or
implied audience that is expected to share the speaker's non-literal reading —
to be “in on” the joke. The current persisted `audience_register` field is **not**
this audience; it is a compatibility name for the hearer's language/domain
profile (`AddresseeProfile`: child-accessible, adult novice, domain apprentice,
or informed peer). `MoveRegister` in the ontology is different again: it marks
an adaptation move as dramaturgical and/or rhetorical.

---

## 6. OPSIS — Spectacle (the staging) — **WIRED**

The `director` role's scene-author card. Single LLM call at setup (or seeded fallback); **not** re-invoked mid-drama.

| Slot | Value space | Default |
|---|---|---|
| `scene_setting` | free text (or 1 of 6 seeded SETTINGS) | seeded |
| `relationship` | free text | seeded |
| `stakes` | free text | seeded |
| `opening_speaker` | learner · tutor · director | seeded (~⅓ tutor) |
| `ending_speaker` | learner · tutor · director | seeded (~¼ tutor) |
| `public_reader_context` | free text (a STAGE line visible to the reader, not the agents) | none |
| `scene_object` | free text (or DISCIPLINE_OBJECTS prop) | seeded by discipline |
| `stage_direction_policy` | none · none_except_required_cue · sparse · short · interventionist · rich | sparse |
| `stage_direction_style` | bare_transcript · scene_heading · object_business · ambient_pressure · placard_caption · thread_metadata · choric_margin · rich_scene_work | seeded |

**[TO-BUILD]:** a *live staging director* that observes the emerging dialogue and re-cues (today all cues are pre-baked into `interventions[]` at setup). If built, keep `director` as a compatibility alias and consider adding `authorial_voice` for setup-only authorship.

---

## 7. MELOS — Composition / Rhythm (the patterning in time) — **WIRED + [TO-BUILD]**

The temporal arrangement — the weakest-named but real dimension:

| Slot | Value space | Status |
|---|---|---|
| `max_turns` | positive int | WIRED (default 6) |
| cue `after_turn` + `timing` | int + `before_tutor`/`before_learner` | WIRED |
| beat cadence / act pacing | — | TO-BUILD (depends on §2.1 act structure) |

---

## 8. THE AUDIENCE — first-order position; critic implementation — **DECLARED + WIRED**

The audience is the actual or implied position from which address, uptake, and
dramatic form become legible. It is declared under `audience.context` and backed
by the ontology, but the generator does not yet condition speech on that context.

| Context slot | Value space | Status |
|---|---|---|
| `description` | free text | DECLARED / TO-BUILD at runtime |
| `relation_to_speaker` | free text | DECLARED / TO-BUILD |
| `relation_to_hearer` | free text | DECLARED / TO-BUILD |
| `knowledge` | free text (what the audience knows or is presumed to share) | DECLARED / TO-BUILD |

The critic panel is the current **evaluative audience** and judge of the
artifact. The project's signature remains: *catharsis is located in the
audience-critic, not asserted by the tutor.*

| Slot | Value space | Default | Surfaced today |
|---|---|---|---|
| `panel` | list of judge models | `[qwen3.7-max, gemini-3.5-flash, deepseek-v4-pro, gpt]` | `--panel` flag |
| `consensus` | k-of-n | `ceil(0.6·n)` = 3-of-4 | `--consensus` (binary only) |
| `grading` | binary · graded(0–4) | binary | separate scripts |
| `blinding` | omniscient · arm-blind · fully-blind | depends on script | structural |
| `rubric` | poetics-v1.0 · charisma · v2.2 | poetics | hard-coded (Phase-0) |
| `structure_critic` | rules · codex · claude-code | rules | `--structure-critic` (pre-gate) |

**Construct-validity gate (Phase-0):** before judging any LLM transcript, a blinded critic must rank-order *known* material (Sophocles/elenchus above textbook Q&A). If it can't, the instrument isn't ready — and that failure is itself a finding.

**Gap — [TO-BUILD]:** there is no single declarative critic-config object. Panel / consensus / grading / blinding / rubric live as different constants across four scripts (`critic-poetics-omniscient.js`, `-graded.js`, `score-poetics-phase2.js`, the orchestration scripts). The spec's `audience:` block (see `SPEC.md`) is the *target* shape; a thin dispatcher is needed to honour it from one entry-point.

---

## 9. THE CAST — role-binding (who plays each part) — **WIRED for LLM, [TO-BUILD] for human/declarative**

Orthogonal to the six parts: each **role** can be played by a human, a specific LLM (on a chosen backend), or a deterministic mock.

Audience is deliberately absent from this table: it is a dramatic position, not
a role, and cannot be cast. `critic` remains a runtime evaluator role; a
`CriticPanel` is the audience constituted by those evaluators, not a character.

| Role | human? | LLM? | mock? | How expressed today |
|---|---|---|---|---|
| director (`cast.director`) | ✗ | ✓ `--role-map director=<backend>` | ✓ | CLI only; conceptually the scene author / staging director |
| tutor_ego / tutor_superego | ✗ | ✓ `--role-map tutor=…` | ✓ | CLI only |
| learner_ego / learner_superego | ✗ | ✓ `--role-map learner=…` | ✓ | CLI only |
| **tutor (whole)** | **Claude** | ✓ | — | `/ms-play-tutor` skill (Claude tutor, human learner) |
| **learner (whole)** | **✓ human** | ✓ | ✓ | `/ms-play-tutor` (human) · `replay-one-side.js --side learner` (LLM/mock) |
| critic | ✓ (human labelling) | ✓ | ✓ | post-generation scripts |

LLM backends: `claude` (Max-plan CLI) · `codex` (Codex CLI) · `gemini` (agy CLI) · `api` (OpenRouter, metered).

**Gaps — [TO-BUILD]:**
1. **No declarative `roles:` / `cast:` block** exists in any spec YAML — casting is entirely CLI/runtime. The spec model adds one.
2. **No human-as-tutor** in any automated pipeline (the `--generator` enum has no `human`).
3. **Tutor-side replay is unwired** — `replay-one-side.js --side tutor` throws; it needs a symmetric `scriptedLearnerTurns` hook in the engine (mirror of the existing `scriptedTutorTurns`). Per the tutor-learner symmetry principle (CLAUDE.md), this *should* be built.
4. **No per-drama critic binding** — the critic model is a post-generation CLI choice, not a spec field.

---

## 10. The assembly pipeline (how a spec becomes a scored drama)

```
 drama-spec.yaml ──┐
   (the six parts) │
 cast: {...} ──────┼──►  the sampler            ──►  generate-pedagogical-dramas.js  ──►  public transcript
   (role-binding)  │     [TO-BUILD: fill          │   --spec <filled> --role-map …          + held-out trace
 audience: {...} ──┘      unspecified slots        │   (the WIRED assembler)                       │
   (critic config)        from priors]             │                                               ▼
                                                   └──────────────────────────────────►  critic-poetics-omniscient(-graded).js
                                                                                          (the WIRED audience) → consensus verdict
```

**What runs today:** if every slot is specified with WIRED values, `/ms-drama-machine` emits a spec the existing generator + critic execute end-to-end. **What the sampler adds:** turning a *partial* brief ("anxious learner, logarithms, aim for peripeteia") into a *fully-filled* spec by sampling the unspecified slots from sensible priors. **What stays roadmap:** act structure, anagnorisis/catharsis generators, multi-learner, the human-as-tutor and tutor-side-replay casting, and the unified critic-config dispatcher.

---

## 11. Roadmap (prioritised by leverage)

| # | To-build | Leverage | Size |
|---|---|---|---|
| 1 | **Unified spec loader** — read `drama: / cast: / audience:` and dispatch to generator + critic from one entry-point | unlocks the whole declarative vision | M |
| 2 | **The sampler** — brief → filled spec from priors (the `/ms-drama-machine` skill does the lightweight version) | the "stochastic assembly" the user asked for | S–M |
| 3 | **Tutor-side replay** (`scriptedLearnerTurns` hook) | symmetry; enables human/frozen learner + varied tutor | S |
| 4 | **Act/beat structure** + turn-range cue placement | the central dramaturgical gap | L |
| 5 | **Anagnorisis & catharsis generators** (not just detectors) | closes the §2.4 asymmetry | M |
| 6 | **Human-as-tutor** casting path | full human/LLM matrix | M |
| 7 | **Learner-`id`** (symmetric to tutor-id) | richer, evolving learner interior | M |
| 8 | **Multiple learners** | the vision's end-state | L |
| 9 | **Device taxonomy in the ontology** (`poetics-core.ttl`) mapping devices → rubric dimensions | machine-reasoned device selection | S (started here) |

---

## 12. One-screen index of every slot

```
MYTHOS    act_structure[TO-BUILD] · continuation_policy · tutor_adaptation_policy · reversal_trigger
          · secret{fact,premise_ledger,symbolic} · hamartia(=learner_start_state) · device_taxonomy[TO-BUILD]
ETHOS     tutor{prompt_type,architecture,superego_disposition,recognition_mode,id_tuning,register_classifier,
          witness_exemplars,conversation_mode} · learner{persona_id,architecture,superego_disposition,models}
          · interior(ego/superego/id) · learners[][TO-BUILD] · goal/backstory/status[TO-BUILD]
DIANOIA   pedagogical_approach · dialogue_approach · recognition_mode · reasoning_ontology · secret.fact
LEXIS     locale · register · person_policy · voice_constraints · direct_address_budget · side_constraints
OPSIS     scene_setting · relationship · stakes · opening_speaker · ending_speaker · public_reader_context
          · scene_object · stage_direction_policy · stage_direction_style
MELOS     max_turns · cue.after_turn · cue.timing · beat_cadence[TO-BUILD]
AUDIENCE  context{description,relation_to_speaker,relation_to_hearer,knowledge}[DECLARED]
          · panel · consensus(k-of-n) · grading(binary|graded) · blinding · rubric · structure_critic
CAST      director · tutor_ego · tutor_superego · learner_ego · learner_superego · critic
          each: human | llm:<claude|codex|gemini|api>:<model> | mock
```
