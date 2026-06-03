# The Drama Machine

A structural model + spec + skill for assembling **pedagogical dramas** — tutoring dialogues generated and scored as *drama* (peripeteia, anagnorisis, catharsis). This folder systematises machinery already scattered across the repo so you can say:

> *"Generate a **tutor like X**, a **learner like Y**, on **topic T**, with **peripeteia / catharsis** — these roles played by **humans**, those by **LLMs**, judged by **these critics**"*

…and have each component sampled and assembled into a runnable drama.

**Status:** design v0.1 (2026-06-02). Serves `DRAMATIC-RECOGNITION-PLAN.md`. **Makes no empirical claims** — those live only in `docs/research/paper-full-2.0.md`. This is tooling + a model, not a result.

---

## What's here

| File | What it is |
|---|---|
| [`TAXONOMY.md`](TAXONOMY.md) | **The structural model.** Aristotle's six parts (mythos/ethos/dianoia/lexis/opsis/melos) + the audience + the cast, as typed slots with value-spaces, each marked WIRED / PARTIAL / TO-BUILD. Start here. |
| [`ADAPTATION-MOVES.md`](ADAPTATION-MOVES.md) | **The move catalog.** The dramaturgical + rhetorical moves of adaptation, per role (tutor/learner/director), grounded in the engine's instruction text, plus the `turn_plan:` schema for specifying per-role, per-turn moves. |
| [`SPEC.md`](SPEC.md) | **The spec model.** How to declare a drama: `drama:` (what) / `cast:` (who plays each role) / `audience:` (critic config) / `turn_plan:` (moves), and how each lowers to existing tools. |
| [`example-drama.yaml`](example-drama.yaml) | A worked, mostly-runnable spec (logarithms · anxious learner · peripeteia+catharsis). |
| [`../../../config/ontology/poetics-core.ttl`](../../../config/ontology/poetics-core.ttl) + [`poetics-rules.n3`](../../../config/ontology/poetics-rules.n3) | **The formal ontology.** Drama forms, devices, moves, characters, casting — a real OWL/N3 ontology in the same namespace as `reasoning-core.ttl`, reasoned by the same EYE pipeline. Validates a `turn_plan` for form-conflicts (e.g. a catharsis target that includes a pseudo-catharsis move). |
| [`../../../.claude/skills/ms-drama-machine/SKILL.md`](../../../.claude/skills/ms-drama-machine/SKILL.md) | **The assembler.** `/ms-drama-machine <brief>` — maps a brief to slots, samples the rest, validates, emits a spec, optionally runs generator + critic. |

## The picture

```
  BRIEF ──► /ms-drama-machine ──► drama: / cast: / audience: / turn_plan:  spec
                  │                          │
            (sample slots          ┌─────────┴─────────┐
             from priors)          ▼                   ▼
                          generate-pedagogical    critic-poetics-
                          -dramas.js (assembler)  omniscient(-graded).js
                                    │                   │ (the audience)
                                    ▼                   ▼
                            public transcript ───► panel verdict (peripeteia/
                            + held-out trace        anagnorisis/catharsis…)
```

The **assembler** and **audience** exist today. The **sampler** is the skill's connective tissue. The deep gaps — act structure, anagnorisis/catharsis *generators*, multiple learners, human-as-tutor casting, tutor-side replay, a unified critic dispatcher — are the **roadmap** (TAXONOMY §11), marked TO-BUILD everywhere so nothing is pretended into existence.

## Quickstart

```
/ms-drama-machine a recognition tutor and an anxious learner on logarithms, aiming for peripeteia and catharsis --mock --run
```

…or hand-write a spec from [`example-drama.yaml`](example-drama.yaml) and run it per [`SPEC.md`](SPEC.md) §7.

## The one boundary that governs everything

The drama machine is a **generative** apparatus. The critic judges the *form of the artifact*, blind to the spec. A well-formed drama — even one with a textbook peripeteia and a clean recognition-press — is **not** evidence that anyone learned anything; the instrument classifies *dramatic form*, not mind-reading or real learning (see `notes/poetics/dramatic-form-not-mindreading` and ADAPTATION-MOVES.md §0). Richer control over *asking* for adaptation is not a theory of *what adaptation does* — that stays the empirical question the §6.7–§6.10 nulls bear on.
