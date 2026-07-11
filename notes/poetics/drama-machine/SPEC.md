# The Drama Spec — How to Declare a Drama

**Status:** design / v0.2 (2026-07-11). The `drama:` block reflects fields that **run today**; `cast:`, `audience:`, `turn_plan:`, `act_structure:`, and `learners:` are the **declarative target** — some lower to existing CLI flags (marked WIRED), some need a small loader/engine extension (marked TO-BUILD). The [`/ms-drama-machine`](../../../.claude/skills/ms-drama-machine/SKILL.md) skill is the lowering layer until a unified loader exists (roadmap #1).
**Companions:** [`TAXONOMY.md`](TAXONOMY.md) (the slots) · [`ADAPTATION-MOVES.md`](ADAPTATION-MOVES.md) (the `turn_plan:` moves) · [`example-drama.yaml`](example-drama.yaml) (runnable).

---

## 0. Terminology and compatibility

`director` is the compatibility key for the scene-authoring/staging role. Keep
it in specs, CLI flags, traces, cached files, and generated YAML until a
separate migration exists. In prose and UI labels, gloss it as **scene author /
director** when the authorship function matters.

This policy deliberately avoids a broad rename:

| Term | Status | Meaning |
|---|---|---|
| `director` | **canonical serialized key** | Scene author / staging controller. Authors the scene card, stage material, speaker order, and scheduled cues; never tutors or plays the learner. |
| `authorial_voice` | **reserved alias, not wired** | Candidate future field if the scene-authoring function is split from live staging. Not accepted by the loader today. |
| `staging_director` | **conceptual split only** | The live or scheduled stage-control function (`interventions[]`, movement declarations, cue timing). Currently still serialized as `director`. |
| `id_director` | **separate architecture** | The charisma-family tutor architecture where an id authors the tutor ego prompt. Do not conflate it with the drama-machine `director` role. |
| `Audience` / `audience.context` | **first-order position, declarative** | Actual or implied non-speaking witnesses. Audience is not a role, cannot be cast, cannot speak, and cannot receive a `turn_plan` move. |
| `CriticPanel` / flat `audience.panel` fields | **wired evaluative audience** | One implementation of Audience: the models or humans that judge the artifact. It is not identical to the audience presumed inside an utterance. |
| persisted `audience_register` | **compatibility name** | The hearer's language/domain accessibility profile (`AddresseeProfile`), not the separate dramatic Audience. |

Archived transcripts, run metadata, paper claims, and existing config files are
read under the vocabulary they were produced with; this spec clarifies the
forward policy without reinterpreting historical evidence.

---

## 1. The principle — separate *what* / *who* / *audience*

A single drama spec conflates three concerns today (a `dramas:` YAML entry is both *what the drama is* and *how to generate it*). The drama machine separates them:

```yaml
drama:    { ... }     # WHAT the drama is — the six Aristotelian parts (TAXONOMY §2–§7)
cast:     { ... }     # WHO plays each enacted role — human | llm:<backend>:<model> | mock
audience: { ... }     # WHERE it is witnessed + HOW the evaluative audience judges it
turn_plan: [ ... ]    # (optional) per-role, per-turn adaptation MOVES (ADAPTATION-MOVES §6)
```

`drama:` is the same across runs; `cast:` varies how it is produced;
`audience.context` describes the non-enacted actual or implied audience; and the
remaining `audience:` fields vary how the critic panel judges it. This is exactly
what *"specify which roles are human / which LLMs, and which critics"* needs,
without turning Audience into a role.

---

## 2. `drama:` — the six parts (field reference)

Organised by Aristotelian part (TAXONOMY §2–§7). **R** = required, **o** = optional. **Status:** WIRED unless marked.

```yaml
drama:
  id: D_DEMO1                      # R   unique id (seeds T-id numbering)
  # ── MYTHOS (plot) ──
  topic: "logarithms as the inverse of exponentiation"   # R
  hamartia: "treats log(a+b) as log a + log b"           # o   the misconception (= learner_start_state)
  continuation_policy: reframe     # o   none|anchor|revoice|reconsider|reframe
  continuation_anchor: misframing-candidate   # o   latest|opening|misframing-candidate
  tutor_adaptation_policy: peripeteia  # o   none|routine|uptake|peripeteia|uptake+peripeteia|socratic_discovery|reveal_secret|withhold_secret
  secret:                          # o   the withheld-knowledge device (dramatic irony)
    fact: "<the withheld conclusion S>"
    premise_ledger: ["<obvious check>", "<distinguishing premise>", ...]
    symbolic: { facts: [...], goal: [...] }   # o   formal encoding for a static screen
  act_structure: { ... }           # o   TO-BUILD — see §6; ignored by the engine today
  # ── ETHOS (character) ──
  tutor:
    prompt_type: recognition       # o   base|recognition|placebo|naive|matched_*|dialectical_*|...
    architecture: ego_superego     # o   ego_only|ego_superego|id_director
    superego_disposition: suspicious  # o   standard|suspicious|adversary|advocate|strict|coupling
    recognition_mode: true         # o
    id_tuning: balanced            # o   charisma|pedagogy|balanced   (id_director only)
    goal: "get the learner to author the inverse relation themselves"  # o   TO-BUILD (not yet a knob)
  learner:
    persona: struggling_anxious    # o   confused_novice|eager_explorer|focused_achiever|struggling_anxious|adversarial_tester
    architecture: ego_superego_recognition_authentic  # o   unified|ego_superego|..._recognition|..._authentic|...
    superego_disposition: recognition_authentic  # o
    start_state: "wants the rule memorised; mistrusts the 'inverse' framing"  # o   (= learner_start_state)
    goal: "pass the quiz without having to understand why"   # o   TO-BUILD
  learners: [ ... ]                # o   TO-BUILD — multi-learner (TAXONOMY §3.4); single `learner:` today
  # ── DIANOIA (thought) ──
  pedagogical_approach: socratic_elenchus     # o   → config/poetics-calibration/pedagogical-approaches.yaml
  dialogue_approach: aristotelian_reversal    # o   → config/poetics-calibration/dialogue-approaches.yaml
  # ── LEXIS (diction) ──
  voice:                           # o
    locale: "neutral contemporary"
    register: "plain, a little impatient"
    person_policy: "≤1 direct 'you' per turn"
    constraints: "no exclamation marks; no praise-first"
    side_constraints: { tutor: "...", learner: "..." }
  # ── OPSIS (spectacle) ──
  scene:                           # o
    setting: "a tutoring booth, ten minutes before a quiz"
    relationship: "paid tutor and a resentful teenager"
    stakes: "the quiz is tomorrow"
    opening_speaker: learner        # learner|tutor|director
    ending_speaker: learner
    object: "a half-finished worksheet"
    stage_direction_policy: sparse  # none|none_except_required_cue|sparse|short|interventionist|rich
    stage_direction_style: object_business  # bare_transcript|scene_heading|object_business|ambient_pressure|placard_caption|thread_metadata|choric_margin|rich_scene_work
    reader_context: "<a STAGE line the reader sees but the agents do not>"  # o
  # ── MELOS (composition) ──
  max_turns: 7                     # o   default 6
```

> **Targets.** `drama:` carries a `targets:` hint (`[peripeteia, anagnorisis, catharsis]`) the sampler uses to bias move/approach selection. It is **not** a score and is never shown to the critic.

---

## 3. `cast:` — role-binding (who plays each part)

```yaml
cast:
  director:        llm:claude:opus       # scene author / director compatibility key
  tutor:           llm:api:sonnet        # whole tutor (ego+superego+id share a backend unless split)
  tutor_superego:  llm:codex             # o   split a sub-agent onto a different backend
  learner:         human                 # ← the human plays the learner (via /ms-play-tutor today)
  critic:          llm:api:gpt           # default audience model (overridable in audience:)
  default_backend: api                   # o   fallback for unset roles
```

**Value grammar:** `human` · `llm:<backend>:<model>` · `mock`. Backends: `claude` · `codex` · `gemini` · `api` (OpenRouter).

There is intentionally no `cast.audience`: Audience is a dramatic position, not
an enacted role. `cast.critic` binds evaluator execution; the resulting
`CriticPanel` is one evaluative audience.

**How it lowers (TAXONOMY §9):**

| `cast:` value | Lowers to | Status |
|---|---|---|
| `llm:<backend>:<model>` on any role | `--generator <backend>` + `--role-map "<role>=<backend>"` + model alias | **WIRED** |
| `learner: human` | run via the `/ms-play-tutor` skill (Claude tutor, human learner) | **WIRED** (interactive only) |
| `tutor: human` | — | **TO-BUILD** (no `human` in `--generator`) |
| freeze one side, vary the other | `replay-one-side.js --side learner` | **WIRED (learner)** / **TO-BUILD (tutor)** — needs `scriptedLearnerTurns` |
| `critic:` per-drama binding | passed to the critic script | **TO-BUILD** (critic is a post-gen CLI choice today) |

---

## 4. `audience:` — first-order context + critic config

```yaml
audience:
  context:                       # o   DECLARED / TO-BUILD at runtime
    description: "an implied seminar audience following the exchange"
    relation_to_speaker: "invited to inspect the tutor's framing"
    relation_to_hearer: "witnesses without becoming a second learner"
    knowledge: "knows the public scene, but not the withheld secret"
  panel: [gpt, deepseek-v4-pro, qwen3.7-max, gemini-3.5-flash]   # judge models (aliases or slugs)
  consensus: 3-of-4            # k-of-n   (lowers to --consensus on the binary critic)
  grading: graded             # binary | graded(0–4)
  blinding: arm-blind         # omniscient | arm-blind | fully-blind
  rubric: poetics-v1.0        # poetics | charisma | v2.2
  structure_critic: rules     # rules | codex | claude-code   (pre-gate, optional)
```

**How it lowers (TAXONOMY §8):**

| `audience:` field | Lowers to | Status |
|---|---|---|
| `context` | formal `Audience` position / future director and prompt context | **DECLARED / TO-BUILD** — accepted as free-text metadata, not yet injected |
| `panel`, `consensus` | `critic-poetics-omniscient.js --panel … --consensus …` | **WIRED** |
| `grading: graded` | `critic-poetics-omniscient-graded.js` (median 0–4) | **WIRED** (separate script) |
| `blinding`, `rubric` | which critic script + prompt construction | **PARTIAL** — structural, not a flag |
| one entry-point honouring the whole block | a unified critic dispatcher | **TO-BUILD** (roadmap #1) |

Register is related to this block through a `RegisterRealization`: a speaker
uses an engagement stance toward a hearer, optionally before the audience named
by `context`. Sarcasm typically has the triadic shape speaker → hearer + an
actual or implied audience invited to share the non-literal reading. This does
not make the audience a speaker or move-bearing role.

---

## 5. `turn_plan:` — per-role, per-turn adaptation moves

The dynamic-adaptation block (full reference: [`ADAPTATION-MOVES.md`](ADAPTATION-MOVES.md) §6). Replaces the single global `tutor_adaptation_policy` with per-role, per-beat move-sets:

```yaml
turn_plan:
  - at: { turn: 3 }                 # or { beat: peripeteia } once act_structure is honoured
    role: tutor
    when_trigger: [pseudo_catharsis, closure_pressure]
    moves: [stock_take, route_change, action_gate]
    route_change: { from: counting, to: adversarial_role }
    forbid: [hold]
  - at: { turn: 3 }
    role: learner
    moves: [perform_device]
    forbid: [pseudo_catharsis]
```

Tutor per-turn move-sets run today — the engine's `resolveTutorTurnPlan` reads the plan per turn and the generator's `withTurnPlan` threads `turn_plan` from the spec onto the director plan; learner/director entries lower to `interventions[]`. All **WIRED**. Only `beat:` addressing is **TO-BUILD** (needs act structure) — use `at: { turn: N }`. The ontology (`poetics-core.ttl`) validates a `turn_plan` for **form conflicts** (a turn targeting `catharsis` that includes `pseudo_catharsis` → flagged). The only valid move-bearing roles are `tutor`, `learner`, and `director`; `role: audience` is rejected.

---

## 6. Forward-compatible blocks (accepted, not yet honoured)

```yaml
drama:
  act_structure:                  # TO-BUILD (TAXONOMY §2.1)
    beats: [exposition, complication, peripeteia, anagnorisis, catharsis]
    place: { peripeteia: { turn_range: [3, 4] }, anagnorisis: { after: peripeteia } }
  learners:                       # TO-BUILD (TAXONOMY §3.4) — multi-learner
    - { id: L1, persona: struggling_anxious, architecture: ego_superego }
    - { id: L2, persona: adversarial_tester, architecture: ego_superego_recognition }
```

The loader/skill should **accept and echo** these so specs are forward-stable, but **warn** that they do not yet affect generation.

---

## 7. What runs today (the compile path)

Until the unified loader (roadmap #1) lands, `/ms-drama-machine` lowers a spec to the existing tools:

```bash
# 1. drama: → a dramas: YAML entry (config/poetics-calibration/<name>.yaml)
# 2. cast:  → --generator / --role-map ;  3. arms → --paired-adaptation-arms
node scripts/generate-pedagogical-dramas.js \
  --spec config/poetics-calibration/<name>.yaml \
  --paired-adaptation-arms peripeteia-only \
  --generator api --role-map "tutor=api,learner=api,director=api" \
  --out-dir exports/drama-<name>/txt --delib-dir exports/drama-<name>/delib \
  --transcripts-dir exports/drama-<name>/transcripts --key exports/drama-<name>/key.yaml
# (a `turn_plan` in the spec rides onto the director plan automatically — no extra flag)

# 4. audience: → the critic panel
node scripts/critic-poetics-omniscient-graded.js \
  --spec config/poetics-calibration/<name>.yaml \
  --sample-root exports/drama-<name>/txt \
  --panel gpt,deepseek-v4-pro,qwen3.7-max,gemini-3.5-flash
```

`cast.learner: human` instead routes to `/ms-play-tutor` (interactive). A `mock` cast or the `--mock` flag (with any valid `--generator`) gives a free plumbing check.

---

## 8. Minimal valid spec

The smallest thing that runs today — only WIRED slots:

```yaml
drama:
  id: D_MIN1
  topic: "why dividing by a fraction multiplies"
  learner: { persona: confused_novice }
  tutor:   { prompt_type: recognition }
  tutor_adaptation_policy: peripeteia
  targets: [peripeteia]
cast:     { tutor: llm:api:sonnet, learner: llm:api:sonnet, director: llm:api:sonnet } # director = scene author / staging role
audience: { panel: [gpt, deepseek-v4-pro, qwen3.7-max], consensus: 2-of-3, grading: graded }
```
