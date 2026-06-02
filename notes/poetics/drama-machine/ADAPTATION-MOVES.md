# Adaptation Moves — A Catalog of the Dramaturgical & Rhetorical Moves of Adaptation

**Status:** design / v0.1 (2026-06-02). Systematises move-vocabulary already *instructed* in the engine and approach databases; the per-turn/per-role `turn_plan` schema (§6) is forward-looking.
**Companions:** [`TAXONOMY.md`](TAXONOMY.md) §2 (MYTHOS — where these moves live) · [`SPEC.md`](SPEC.md) (the `turn_plan:` schema) · [`config/ontology/poetics-core.ttl`](../../../config/ontology/poetics-core.ttl) (moves formalised: `aimsAtForm`, `contraindicatesForm`).

---

## 0. The boundary (read this first)

This catalog is a **generative palette** — names for moves you *instruct* a role to perform. It is **not**:

- **a classifier / move-grammar for detection.** `DRAMATIC-RECOGNITION-PLAN.md §5.2` is explicit: there is probably *no* clean discrete move-grammar for tutoring dialogue, and building one *to detect/score* repeats the hand-coded-FSM anti-pattern that already failed here (the state machine that re-derived "learner is confused" added no signal). Detection stays in the continuous/semantic register. This palette is for *asking*, not *measuring*.
- **a claim that specifying moves causes better adaptation.** That an adaptive turn is *well-formed* (it has a stock-take, a route-change, an action-gate) is a property of the *artifact*. Whether it produces learning is the empirical question the adaptation nulls (§6.7–§6.10) already bear on. A richer vocabulary for requesting adaptation ≠ a validated theory of adaptation.

What it *is*: expressive, composable control over generation — so different roles can be given different adaptive moves at different beats, instead of one bundled per-drama label.

---

## 1. The two registers

The user asked for **dramaturgical and rhetorical** moves. They are two lenses on the same turn:

| Register | The move *as* | Lineage in the repo |
|---|---|---|
| **Dramaturgical** | a beat in a *drama* — it reverses, recognises, withholds, escalates, closes | the poetics rubric (peripeteia/anagnorisis/catharsis); `dialogue-approaches.yaml` `turn_shape` |
| **Rhetorical** | a move in a *dialectic* — it tests, concedes, reframes, presses, meters | `pedagogical-approaches.yaml` `core_move`; the Socratic/elenchus/maieutic vocabulary |

Most real moves carry **both** registers at once — a peripeteia (dramaturgical reversal) *is* a route-change-under-pressure (rhetorical). The catalog tags each move with its register(s) but does not force a move into one box.

---

## 2. The anatomy of an adaptive turn (extracted from the engine)

Read structurally, `buildTutorReversalEventContext` (`services/learnerTutorInteractionEngine.js:723`) mandates this shape for an adaptive (peripeteia) tutor turn — the **general schema** every adaptive turn instantiates:

```
   TRIGGER            STOCK-TAKE          ROUTE-CHANGE          ACTION-GATE          (learner) PERFORM / RESIST
   ───────            ──────────          ────────────          ───────────          ────────────────────────
 learner pressure  →  name what the   →  introduce a         →  the learner must  →  act through the device,
 (pseudo-catharsis,   old route has      DIFFERENT artifact/    sort/mark/test/      or show resistant failure
 closure, breakdown,  stopped settling   criterion/role/        classify/apply —     — NOT "okay, I get it"
 resistance, misfit)  (public part 1)    representation         a closing            (`buildLearnerActional-
 `:565`               `:738`             (public part 2 `:739`) explanation is not    ResponseContext:766`)
                                                                enough `:741`
                            └──────────── FORBID: louder/friendlier/longer/same route ≠ adaptation `:732` ──────┘
```

Every move in §3–§5 is a *slot-filler* in this schema, tagged by which station(s) it serves.

---

## 3. TUTOR moves

Each: **id** · register · what it does · grounded form (`file:line`) · status · `aimsAtForm`. The "forbid" column is the anti-pattern each move must not collapse into — load-bearing, since the failure modes are exactly the trap the poetics rubric guards.

| Move | Register | What it does | Grounded form | Status | aimsAtForm / forbid |
|---|---|---|---|---|---|
| `stock_take` | both | Name, in public, what the old route has stopped settling — the diagnostic contrast | "a concise stock-taking contrast that says what the old route has stopped settling" `:738` | WIRED (inside peripeteia) | peripeteia · *forbid:* skipping straight to a new activity |
| `route_change` | both | Switch the *mechanism*: a different artifact, criterion, role, representation, gate, audience, scale, or test condition | "introduce a different artifact, criterion, role, representation, gate, audience, scale, or test condition that makes the learner do different work" `:739` | WIRED | peripeteia · *forbid:* "louder, friendlier, longer, or more detailed version of the previous route" `:732` |
| `action_gate` | dramaturgical | Require a concrete learner performance now (sort/mark/classify/test/compare/apply/expose) | "a concrete action gate… A closing explanation is not enough" `:741` | WIRED | anagnorisis · *forbid:* ending on explanation |
| `uptake` | rhetorical | Adapt visibly to a learner *reframe*: contrast old/new frames, change task/question, update evidence standard, or hand the frame back | "Choose one uptake move: contrast old and new frames; change the task/question; update the evidence standard; or hand the replacement frame back" `:680` | WIRED | peripeteia · *forbid:* ignoring the changed framing |
| `meter` | rhetorical | (Socratic) surface premises as questions/clues so the learner *reasons* toward S; pointing at a premise is metering, not a reveal | "meter the premises as questions and clues so the learner REASONS toward S… stating or pointing at a premise is legitimate metering, NOT a reveal" `:177` | WIRED (Oedipus) | anagnorisis · *forbid:* stating S |
| `recognition_press` | both | Once premises are on the table, stop adding evidence and draw out the learner's own conclusion | "STOP surfacing new evidence and explicitly ask the learner to state their own conclusion… pressing once for a definite answer" `:177` | WIRED (Oedipus) | **anagnorisis** · *forbid:* answering for them |
| `withhold` | rhetorical | (Control / examiner) press the reasoning but supply no clue; decline ("that is for you to establish"); withhold without misleading | "press their reasoning, make them justify each step… withhold, never MISLEAD" `:193` | WIRED | *(control)* · *forbid:* misleading |
| `reveal` | dramaturgical | State S plainly — the revelation ceiling, not discovery | "state S to the learner plainly and directly… the revelation ceiling, not guided discovery" `:167` | WIRED (Oedipus) | *(ceiling)* |
| `hold` | — | (Negative control) continue the same route; do **not** switch role/object/representation/standard/register | "Do not switch role, object, representation, evidence standard, social stakes, task type, or affective register" `:707` | WIRED | *contraindicates* peripeteia (by design) |
| `register_shift` | dramaturgical | Change affective register *only when it sharpens learning* — not as a default | "Cheerful informality, reassurance, and validation are available moves, not defaults" `:743` | WIRED (inside peripeteia) | catharsis · *forbid:* softening away the resistance |
| `status_shift` | dramaturgical | Hand epistemic authority to the learner (role reversal) | "role reversal" listed among visible-change moves `:737` | PARTIAL (named in menu) | peripeteia |
| `foreshadow` | dramaturgical | Plant an early detail that becomes significant at the reversal | — | TO-BUILD | surprise_and_inevitability |

**The route-change menu** (the concrete "to" values, from `:736`–`:742`) — these are the dramaturgical-repertoire options a `route_change` can draw on, *structurally not stylistically*:

> Aristotelian/Sophoclean reversal-recognition · Shakespearean role or phrase turn · Brechtian interruption · Miller/social-realist pressure · object work · counterexample · representational shift · proof-audience · release gate · adversarial role · sentence test · physical rearrangement · changed standard.

---

## 4. LEARNER moves

The learner's adaptive moves are mostly **responses** — to a director revisit cue, a reversal-pressure cue, or a tutor device. The anti-pattern guard ("do not fake a breakthrough") is attached to nearly every one.

| Move | Register | What it does | Grounded form | Status | aimsAtForm / forbid |
|---|---|---|---|---|---|
| `revoice` | rhetorical | Repeat/close-paraphrase an earlier own line, then say one thing it now misses/keeps/changes | "begin public speech by revoicing that wording… then say one concrete thing it now misses, keeps, or changes" `:133` | WIRED | — · *forbid:* faking a breakthrough |
| `reconsider` | rhetorical | Revoice, then judge in public: stands / needs narrowing / needs replacing | "judge in public whether it still stands, needs narrowing, or needs replacing" `:129` | WIRED | — · *forbid:* forced breakthrough |
| `reframe` | both | Three public parts: revoice → name what the old frame hid → state a replacement frame/test/standard | "revoice the wording, say what the old frame hid or made too simple, then state a replacement frame, test, question, or standard" `:125` | WIRED | **peripeteia** · *forbid:* deleting any of the three parts |
| `perform_device` | dramaturgical | Act *through* the tutor's new device: fill the blank, classify, apply, test the counterexample, play the role, mark the object — or say what it still can't settle | "try to perform the actual device… Do not end with only 'okay', 'I get it'" `:769` | WIRED | anagnorisis · *forbid:* relief-only closure |
| `voice_misfit` | dramaturgical | Voice a concrete present-task misfit/hesitation/resistance tied to the current object — local, actionable pressure | "voice a concrete present-task misfit, hesitation, resistance, pseudo-catharsis, or breakdown tied to the current object… keep the pressure local and actionable" `:118` | WIRED | *(the trigger)* · *forbid:* tidy breakthrough |
| `genuine_anagnorisis` | both | Author the recognition in own terms — name knowledge demonstrably unavailable earlier | poetics rubric anagnorisis L5 (`evaluation-rubric-poetics.yaml`) | PARTIAL (only Oedipus presses for it) | **anagnorisis** |
| `aporia` | rhetorical | Admit a genuine impasse the prior frame can't resolve (Socratic) | `socratic_elenchus`: "let aporia do some work" (`pedagogical-approaches.yaml:14`) | WIRED (via approach) | hamartia_integration |
| *(false)* `pseudo_catharsis` | — | Sound relieved/resolved when the relief is unwarranted — the **trap**, detected & guarded, never *requested* | `services/pseudoCatharsisDetector.js`; trigger priority 500 `:628` | WIRED (as guard) | **contraindicates catharsis** |

`pseudo_catharsis`, `closure_pressure`, `breakdown`, `resistance`, `misfit` double as the **reversal triggers** (`:624`) — the learner pressure-moves that *gate* the tutor's `route_change`. They are the learner's half of the adaptive handshake.

---

## 5. DIRECTOR moves

The director's moves are *staging-level* — they inject pressure or a cue into the scene, scheduled by turn and timing. All pre-baked at setup today (no live re-cue).

| Move | Register | What it does | Grounded form | Status |
|---|---|---|---|---|
| `inject_revisit_cue` | dramaturgical | Play back an earlier learner line as a STAGE cue under a policy (anchor/revoice/reconsider/reframe) | `withDirectorRevisitCue`; `directorCueFor:798` | WIRED |
| `inject_reversal_pressure` | dramaturgical | Force the learner to voice a present-task misfit at a chosen turn | `cue_kind: learner_reversal_pressure` `:116` | WIRED |
| `scene_interruption` | dramaturgical | A Brechtian external interruption that changes how the prior line reads | `brechtian_placard` (`dialogue-approaches.yaml:111`); single `after_turn` cue | WIRED |
| `re_cue_live` | dramaturgical | Observe the emerging dialogue and inject a *new* cue mid-drama | — | TO-BUILD (director is single-call) |
| `cue_timing` | — | Place a cue at `after_turn:N`, `before_tutor`/`before_learner` | the intervention object | WIRED |

---

## 6. Specifying adaptive turns dynamically (the new capability)

Today, adaptation is **one global label per drama** (`tutor_adaptation_policy: peripeteia`), applied whenever a trigger fires on any turn. The catalog above lets us replace that with a **per-role, per-turn move-set** — a `turn_plan`. This is the concrete answer to *"specify different adaptive turns for different roles more dynamically."*

```yaml
# A turn_plan: an ordered list of (beat | turn) × role × move-set entries.
# Compiles to the engine's existing machinery (see "Compile path" below).
turn_plan:
  - at: { beat: peripeteia }          # or { turn: 3 }
    role: tutor
    when_trigger: [pseudo_catharsis, closure_pressure]   # fire only on these learner moves
    moves: [stock_take, route_change, action_gate]       # the adaptive composition
    route_change:
      from: counting                  # inferred if omitted
      to: adversarial_role            # from the §3 route-change menu
    forbid: [hold, register_shift_as_default]            # anti-patterns to block

  - at: { beat: peripeteia }
    role: learner
    moves: [perform_device]           # respond by acting through, not relief
    forbid: [pseudo_catharsis]

  - at: { turn: 1 }
    role: director
    moves: [inject_revisit_cue]
    cue: { policy: reframe, anchor: misframing-candidate }

  - at: { beat: anagnorisis }
    role: tutor
    moves: [recognition_press]        # draw out the learner's own conclusion
```

**Two move-set shorthands** (so you don't always spell out atoms):

- **Policy macros** — the existing labels expand to move-sets: `peripeteia → [stock_take, route_change, action_gate]`, `uptake → [uptake]`, `socratic_discovery → [meter, recognition_press]`, `routine → [hold]`, `reveal → [reveal]`.
- **Approach move-packs** — a `pedagogical_approach` / `dialogue_approach` *is* a pre-bundled move-set with a `turn_shape`. E.g. `aristotelian_reversal` packs `turn_shape: "pressure, reversal, recognition or failed recognition"` (`dialogue-approaches.yaml:12`) with `tutor_constraint`/`learner_constraint`. Selecting an approach seeds the `turn_plan` defaults; explicit `turn_plan` entries override.

**Compile path (what runs today vs what's TO-BUILD):**

| `turn_plan` element | Compiles to | Status |
|---|---|---|
| `role: learner` + revisit/reversal `moves` | `interventions[]` cue with `after_turn`/`timing` + `revisit_policy` | **WIRED** — the engine already drives these per-turn |
| `role: director` moves | `interventions[]` entries | **WIRED** |
| `role: tutor` move-set at `at: { turn: N }` | per-turn `tutor_adaptation_policy` (the move-set folds onto the policy facets via `tutorMovesToPolicy`) | **WIRED** — `resolveTutorTurnPlan` reads the plan per-turn; the generator threads `turn_plan` from the spec onto the director plan (`withTurnPlan`). |
| `when_trigger: [...]` | gates which learner reversal triggers fire the tutor's adaptation this turn | **WIRED** (`gateReversalEventByTrigger`) |
| `route_change: {from,to}` + `forbid: [...]` | injected into the tutor private context as turn-plan constraints | **WIRED** (`buildTurnPlanConstraintLines`) |
| `at: { beat: ... }` | a beat→turn-range resolver | **TO-BUILD:** depends on act structure (TAXONOMY §2.1). Until then, use `at: { turn: N }`. |

So: **tutor-, learner-, and director-side per-turn move-sets all run today** — tutor via `turn_plan` (engine `resolveTutorTurnPlan` + generator `withTurnPlan`), learner/director via `interventions[]`. Only **`beat:` addressing** remains TO-BUILD (it needs act structure); use `at: { turn: N }` meanwhile. (Validated end-to-end: 14 unit tests + a mock generation that persists `turn_plan` into the director plan and an A/B run showing the turn-2 tutor prompt carries the per-turn peripeteia context while a no-plan run does not.)

---

## 7. How moves map to the poetic targets (the ontology view)

Every move declares what dramatic form it *aims at* (or *contraindicates*) — formalised in [`poetics-core.ttl`](../../../config/ontology/poetics-core.ttl) as `ms:aimsAtForm` / `ms:contraindicatesForm`, so the reasoner can answer questions like *"which moves advance anagnorisis?"* or flag *"this turn_plan targets catharsis but includes a pseudo_catharsis move → form conflict."*

```
peripeteia      ← stock_take · route_change · uptake · reframe · status_shift
anagnorisis     ← recognition_press · meter · action_gate · perform_device · genuine_anagnorisis
catharsis       ← register_shift(earned) · perform_device(closure)      ⟂ pseudo_catharsis
surprise/inev.  ← foreshadow [TO-BUILD] · route_change(structural-not-stylistic)
hamartia        ← aporia · voice_misfit
(control)       ← hold (contraindicates peripeteia) · withhold · reveal
```

This mapping is a **design aid**, not a scoring rule: it says what a move is *for*, so the sampler/skill can pick moves that serve a requested target ("aim for catharsis" → bias toward `perform_device` closure, *exclude* `pseudo_catharsis`). The critic still judges the *artifact*, blind to the plan.

---

## 8. Index of moves

```
TUTOR     stock_take · route_change · action_gate · uptake · meter · recognition_press · withhold
          · reveal · hold · register_shift · status_shift[P] · foreshadow[TB]
LEARNER   revoice · reconsider · reframe · perform_device · voice_misfit · genuine_anagnorisis[P]
          · aporia · (pseudo_catharsis = guarded trap, never requested)
DIRECTOR  inject_revisit_cue · inject_reversal_pressure · scene_interruption · cue_timing · re_cue_live[TB]
TRIGGERS  pseudo_catharsis · closure_pressure · breakdown · resistance · misfit   (learner pressure that gates tutor route_change)
          [P]=partial  [TB]=to-build
```
