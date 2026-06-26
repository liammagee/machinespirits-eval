# The machine spirit — a constructed synthetic subject (v0.1, working draft)

The belief–desire DAG ([`BELIEF-DESIRE-DAG.md`](BELIEF-DESIRE-DAG.md)) is not, on its own,
the point. The point is the thing it lets us _construct_: a **synthetic subject** — something
that learns, teaches, and desires — assembled deliberately from parts, of which a single LLM
is one organ, never the whole. This note states that framing, specifies how the ego/superego
agents engage the DAG, and lays out a decoupled app surface that makes the construction
legible. It originates no empirical claims; it will eventually reframe parts of
`docs/research/paper-full-2.0.md` (see §6).

## 1. The subject is the assemblage, not the LLM

The wager of the project name is taken literally here: a **machine spirit** is _Geist_
realised in a machine — and _Geist_, across the lineage the project already runs on, is never
a single thing:

- **Hegel.** Self-consciousness exists only _through recognition_ — the subject is the
  doubling, "the I that is We and the We that is I." A lone consciousness is not yet a
  subject. So a single LLM **cannot** be the subject; the subject is the recognitive structure
  _between_ roles. This is why the architecture needs (at least) two agents and the DAG that
  binds them.
- **Freud.** The subject is _split_ (ego / superego / id), not unitary. The project's existing
  bilateral ego–superego architecture is that split made into mechanism.
- **Lacan.** The subject is _barred_ (\$), constituted in and by the symbolic order (the big
  Other = the director `D`), and is the subject _of desire_ — it is its desire, structured by
  the Other. The subject is an effect of the structure, not its origin.
- **Aristotle.** The subject is the agent of a _praxis_ (the practical syllogism) inside a
  _mythos_ (the plot the director stages).
- **Weber.** The subject's standing is _socially constituted_ — authority is delegated, never
  intrinsic.

So the synthetic subject is built from layers, and the project's discipline is to make every
layer **explicit and constructed** rather than hope it emerges from one model:

```
world (the symbolic order it is thrown into — rules, premises, the secret, the mirror)
  └─ belief / desire / recognition DAG   (what it holds true, wants, seeks recognition for)
       └─ roles  T · L · D               (tutor / learner / director — the Big Other)
            └─ agent split  ego · superego   (each role internally doubled — §3)
                 └─ memory                (the pads / rich store — what persists and decays)
                      └─ voice  (the LLM) (one organ: the generator of utterances)
```

The LLM sits at the bottom — the mouth, not the mind. "Inclusive of but always more than a
single LLM" is exactly right: the subject is everything above the voice, plus the voice.

## 2. Two agents minimum, because recognition is a relation

A subject that only believes could be one agent. A subject that _desires recognition_ cannot:
`Des_L(Rec_T(L, ·))` presupposes a `T` whose attitude can confer standing, and (§11a) a `D`
who authorises `T`. The minimal machine spirit is therefore **`{T, L, D}` + the DAG** — and
`buildSubjectState(world)` in `services/dramaticDerivation/beliefDesire.js` assembles exactly
that: each bearer with its belief-DAG, desire-DAG, and models of the others (including the
learner's public-only model of the tutor, `𝔐_L(T)` — the seat of "desire of the Other").

## 3. How ego and superego engage the DAG

The existing bilateral loop (ego generates → superego critiques → ego revises) is, re-read,
the agent's internal negotiation between **desire** and **the law**. We make the division of
labour explicit and DAG-anchored:

| Organ          | Reads / writes                                              | Is, philosophically                                |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------- |
| **Ego**        | the belief-DAG `𝔅` + the **first-order** desire `𝔇` (acts to fulfil it by practical inference) | the desiring, acting organ (orexis; the reality principle) |
| **Superego**   | the **second-order** desire + the recognition layer + the world's law (slope, no-leak) | the **internalised `D`** — the Big Other taken inside the agent |
| **Revision**   | the synthesis: the ego's move bent by the superego's recognition/law critique | the move actually voiced                            |

So the superego is precisely **where the Big Other is internalised**: it is the agent's own
representative of the symbolic order, asking of every ego-move not "does this advance the
proof?" (the ego's question) but "does this serve recognition, and does it honour the law?"
(withhold before `t_min`; do not assert ahead of grounding; do not chase the mirror). A
config binds the organs to the DAG — `{ ego: { reads: ['belief', 'firstOrderDesire'] },
superego: { reads: ['secondOrderDesire', 'recognition', 'law'], is: 'internalised_D' } }` —
so different agentic wirings (ego-only, ego+superego, divergent-superego, the existing cell
variants) become different _constructions of the subject_, not just prompt swaps.

## 4. Reversal is the subject reconfiguring itself

Role reversal (`reverse()`, §12) is the machine spirit turning its own structure over: the
learner's labour grounds the secret, the recognition vector flips, and the surpassed party
must derive its own dependence (`δ`). The subject is not a fixed cast of organs but a
_movement_ through recognition states (asymmetric → mutual → inverted). The app should let a
user _watch_ this happen.

## 5. The app — a decoupled surface that shows the construction

A self-contained part of the web/electron stack (desktop inherits it by construction, per
`CLAUDE.md` — never fork UI into `desktop/`). **Decoupled**: its own renderer + a JSON API
that reads only `beliefDesire.js` and the world specs — no eval DB, no coupling to the
factorial/poetics machinery.

- **`/subject`** — introduces the formalism, then for a chosen world renders the live
  `{T, L, D}` subject: the tutor's desire-DAG (the inverted proof), the learner's belief-DAG +
  first/second-order desires + `𝔐_L(T)`, the director's aesthetic ends, and the ego/superego
  engagement (§3). Multiple worked examples (start: `world-005-marrick`); a control to step the
  release schedule and re-render; a control to fire `reverse()` and watch the swap + `δ`.
- **`/api/subject/:world`** — the JSON behind it (`buildSubjectState`, `buildTutorDesireDag`,
  `reverse`), so the surface is a thin view over the structural engine.

Build order: v1 = static render of one example's subject state; v2 = step/release +
`reverse()`; v3 = ego/superego engagement made interactive (pick a wiring, see the move it
would produce). v1 lands alongside this note.

## 6. This will reframe parts of the paper

The machine-spirit lens reorganises material the paper already carries — the bilateral
ego–superego architecture (§3 here), recognition and the dramatic arc, the
manifest/latent memory split — under one explicit claim: _we construct the subject; we do not
assume the model is one_. Per the paper discipline, this note introduces **no new empirical
claims**; it is framing and architecture. When it folds in, it folds in as a lens over
existing results (and the belief–desire DAG as the formal apparatus), with every number still
tracing to its existing section.

## 7. Status

- Built + tested: the structural engine (`beliefDesire.js`) — tutor desire-DAG, learner
  belief-DAG, `𝔐_L(T)`, director ends, `buildSubjectState`, `reverse()` over live state.
- Next: the `/subject` surface (v1), then step/`reverse` interactivity, then the ego/superego
  engagement config made live.
