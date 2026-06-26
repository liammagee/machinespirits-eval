# Character desire — compiling motivation from the script outline (v0.1, working draft)

A companion to [`BELIEF-DESIRE-DAG.md`](BELIEF-DESIRE-DAG.md). That note derives a role's
desire from the **proof structure** (the secret, the proof paths). This note adds the
**other source of desire**: the one the author already writes into the script outline — the
characters' motivation — and makes it first-class, so it feeds *both* the role prompts and
the desire-DAG from one place.

The wager (chosen 2026-06-27, option (b)): **author** the motivation explicitly in the world
spec rather than mine it out of the `learner_voice` prose. The proof-desire is already
explicit and typed; making character-desire explicit keeps the two symmetric, gives the
author a direct knob, and avoids brittle prose extraction.

## 1. The two sources of desire, and why both are needed

- **Proof-structure desire** (`beliefDesire.js`): what a role *structurally* must bring about
  given the secret — `Des_T(grounded_L(S))`. The learner gets *nothing* from this source: it
  does not know `S`, so the proof cannot tell us what the learner wants.
- **Character motivation** (the script outline): what a character *personally* wants — to be
  found right, to convict the hated man, to be recognised. Today this lives only as prose in
  `learner_voice` (and `cast`), inlined into the LLM prompt, never structured.

The drama *is* the relation between them: what the role must reach (`S`) versus what the
character wants (recognition; or the wrong object — the mirror). For the learner especially,
the character source is the *only* source of desire, so it has to be modelled.

## 2. The `motivation:` schema (per bearer)

A new authorial block in the world spec, keyed by bearer. Qualitative levels (`low` / `medium`
/ `high`) keep it author-friendly and map cleanly to the prose.

```yaml
motivation:
  learner:
    first_order: # what the character wants in the world (order 0)
      end: question_pattern # the de dicto slot ∃x.Q(x); `question_pattern` = the world's question
      opens_on: verrell # initial slot binding (the false object / mirror); null = genuinely open
      mirror_pull: high # how strongly the false object holds: low | medium | high
    second_order: # the recognition sought (order 1)
      from: warden # the recogniser — an authority figure or a role (T / D)
      as: right # the standing π sought ("found right")
      authority: rational_legal # Weber mode: why that recognition counts (the assay's rules)
    disposition:
      overreach: high # asserts ahead of grounding: low | medium | high
      arc: softens # how dispositions move across the play: static | softens | hardens
  tutor:
    first_order:
      end: inherit # = the proof-derived Des_T(grounded_L(S)); do not duplicate
    second_order: null # marrick: the tutor seeks no recognition (the asymmetry, §5)
    disposition:
      withhold: lawful # honours the floor t_min (= the criterial superego, the law)
```

## 3. Mapping to desire-nodes (BELIEF-DESIRE-DAG.md §13)

Each block compiles to typed nodes — this is what `buildSubjectState` would seed instead of
the generic `seedLearnerDesires`:

| `motivation` field | desire-node |
| --- | --- |
| `learner.first_order` | `DesireNode{ bearer:L, order:0, content:{rel:grounded_L, of:Q}, slot:{var, binding: opens_on}, origin: root_end }` — `binding = opens_on` is the **mirror-bound** opening (§9's de re filler) |
| `learner.second_order` | `DesireNode{ bearer:L, order:1, content: recognitionNode(recogniser:from, recognised:L, standing:as, authority:{mode:authority, authorizer:D}), origin: root_end }` |
| `*.disposition.overreach` | a **dynamics parameter**, not a node — the likelihood the bearer asserts ahead of grounding (the §9 overreach the engine currently flags post-hoc) |
| `learner.first_order.mirror_pull` | a dynamics parameter — how long the slot `binding` stays on the mirror before migrating to the true filler (§9's "filler migrates verrell → edony") |
| `tutor.first_order.end: inherit` | reuse the proof-derived `Des_T(grounded_L(S))` from `buildTutorDesireDag` — no duplication |
| `tutor.disposition.withhold: lawful` | the criterial superego (the law) — the floor-withholding already in `tutorMove` |

## 4. Mapping to prompt lines (one source, two outputs)

The same block renders into prompt text, so the prompt's motivation *is* the formal desire,
not a second hand-written copy. Rough renderer:

- `first_order` → "You want to know **who/what** {Q in plain words}{; you are quick to settle
  on **{opens_on}** when it fits}."
- `second_order` → "Above the answer itself, you want **{from}** to find you **{as}**."
- `disposition.overreach: high` → "You are apt to name an answer before the evidence forces
  it{, but you are learning to let the evidence speak first — `arc: softens`}."

So `learnerSystem`'s current `Your voice: {voice}` prose becomes a *rendering* of the
structured block, not a free-text field that drifts from the engine's model of the learner.

## 5. Validation against marrick's `learner_voice` (the test case)

The existing prose:

> "The assay-master's apprentice: … **eager — too eager — to write the verdict the town
> wants**; **apt to name the hand before the metal has finished naming itself**. **Respectful
> of the warden**, **hungry to be right**, and **learning, mark by mark, to let a coin's own
> evidence say who made it**."

Maps with nothing left over:

- "write the verdict the town wants" → `first_order.opens_on: verrell` (the mirror), `mirror_pull: high` ("eager — too eager");
- "name the hand before the metal has named itself" → `disposition.overreach: high`;
- "respectful of the warden" + "hungry to be right" → `second_order: { from: warden, as: right, authority: rational_legal }`;
- "learning, mark by mark, to let evidence speak" → `disposition.arc: softens` (the mirror-pull and overreach decay across the play — the §9 filler migration and the `learner_drift` channel).

The schema captures exactly what the author already wrote — it just turns it into structure
the engine can hold (and re-render). That is the v0.1 acceptance test: round-tripping the
prose loses nothing.

## 6. Where the two sources meet

`buildSubjectState(world)` would, with this block present, seed:

- `𝔇_L` from `motivation.learner` (the character source — the learner's only desire);
- `𝔇_T` from `buildTutorDesireDag` (the proof source) **plus** any `motivation.tutor`
  second-order/disposition riders;
- `𝔇_D` from `buildDirectorDesireDag` (the aesthetic ends), tunable by `motivation.director`.

The learner's first-order desire opening **mirror-bound** (`opens_on: verrell`) is what makes
the drama move: the proof never wanted Verrell, but the *character* does, and the play is the
migration of that binding to the truth under the tutor's pacing — desire re-aligned to the
Other's law (§11b).

## 7. Deferred / open, and the next step

- **Drift coupling.** `disposition.arc` is the static handle on a dynamic thing; the live
  version is the `learner_drift` channel making `mirror_pull` / `overreach` time-varying. v0.1
  keeps them static with an `arc` hint; wiring them to `learnerDrift` is the follow-up.
- **Authority resolution.** `second_order.from: warden` names a figure not in the bearer set
  `{T, L, D}`; the warden is a *local representative of D* (the Big Other, §11a). The compiler
  resolves `from` to its authoriser `D` and its Weber mode.
- **The director's motivation** is mostly inherited; whether authors should tune it
  (`mirror_pull` of the staging, the strength of the temptation) is open.

**Next step:** build the compiler — `motivation` block → desire-nodes (feeding
`buildSubjectState`) + prompt lines (feeding `learnerSystem`) — test-first, starting by adding
the block to `world-005-marrick.yaml` and checking the round-trip in §5 holds and the seeded
learner desire-DAG opens mirror-bound.
