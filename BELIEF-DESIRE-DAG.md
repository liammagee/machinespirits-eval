# Belief–Desire DAG — role-playing formalism (v0.2, working draft)

This note begins a formalism that layers **desire** onto the existing proof DAG
(`services/dramaticDerivation/`), distinguishes **belief** (how the world *is*) from
**desire** (how the world *should be*), makes the apparatus **symmetric** across tutor and
learner (so roles can later be *reversed*), and grounds higher-order desire — recognition —
in the project's existing lineage (Aristotle, Hegel, Freud, Weber, Lacan).

It is a draft to iterate on, not a spec to implement yet. It deliberately stops short of
collapsing into BDI agent architecture (see §8): BDI is a useful shadow, but the richness
we want lives in *why* a belief and a desire differ, and in the *orders* of desire — which
BDI flattens.

Status today: the code has a rich **belief** DAG (the proof DAG) and an implicit, scalar
**desire** (the tutor's pull toward the secret, `derivationDistance → 0`). This formalism
makes desire an explicit *structure* and gives the learner the same first-class apparatus
the tutor has.

---

## 1. Statements are attitude-typed

The atom is not a fact but a **statement**:

```
s = ⟨ φ , α , b ⟩
```

- `φ` — propositional content: either an order-0 fact in the world's fact-language `ℱ`
  (the `[predicate, ...args]` arrays the chainer already uses), or, at higher orders, a
  nested statement (§4).
- `α` — **attitude**: `Bel` (belief) or `Des` (desire). Extensible later to `Int`
  (intention) — deferred, §8.
- `b` — **bearer** ∈ `{T, L, D}`: tutor, learner, director. `T` and `L` are the two
  _reversible_ dramatis personae; `D` is the staging authority (author / director), a third
  desiring role developed in §10. Everything is bearer-indexed — this is what makes symmetry
  and reversal possible (§5).

The existing proof-DAG fact-nodes are exactly the special case `⟨φ∈ℱ, Bel, L⟩` — the
learner's grounded beliefs about the world. We are generalising the node type, not
replacing it.

## 2. The belief/desire distinction is *direction of fit* — not two slots

We do **not** define belief and desire as two boxes an agent carries (the BDI move). We
define them by **direction of fit** (Anscombe/Searle), because that is what carries the
philosophy and what links the two structures:

- `Bel_b(φ)` aims at the world: it is *satisfied* iff `φ` is the case. **Mind-to-world.**
  In the DAG: `φ` is **grounded** for `b` iff `φ ∈ Cl_R(held_b)` — entailed by `b`'s held
  facts under the world's rules. (This is exactly today's `grounded` status.)
- `Des_b(φ)` aims at changing the world: it is *fulfilled* iff `φ` is *made* the case.
  **World-to-mind.**

The link — and this is the move that keeps desire *structural* rather than a free-floating
scalar:

> **A desire is fulfilled when its content becomes a grounded belief.**
> `Des_b(φ)` is fulfilled at turn `t` ⟺ `Bel_b(φ)` is grounded at `t`.

So the tutor's root desire `Des_T(grounded_L(S))` ("let the learner come to hold S") is
fulfilled exactly when `S` is grounded on the learner's board. `derivationDistance` is then
not a primitive — it is the **scalar shadow** of this desire's distance from fulfilment.
We get the gradient *out of* the structure, as requested, instead of positing it.

## 3. Two inferences: theoretical and practical (Aristotle)

A single fact-language, two inference systems sharing it:

- **Theoretical inference** (already implemented as `closure` under `R`): propagates
  belief forward.
  `Bel(ψ₁…ψₙ)`, rule `ψ₁…ψₙ → φ` ⊢ `Bel(φ)`.
- **Practical inference** (Aristotle's *practical syllogism*): propagates desire *backward*
  through the belief-rules.
  `Des(φ)` [end] + `Bel(ψ → φ)` [means–end] ⊢ `Des(ψ)` [sub-end].

The **desire-DAG is the belief-rules run backward from the end, gated by what is believed.**
And this retro-actively grounds machinery that already exists: the tutor's pacing policy
(`deriveProxyDagPacingSignal`: `release_evidence`, `prompt_intermediate_inference`,
`prompt_assertion`, …) *is* practical inference over the tutor's desire-DAG. To fulfil
`Des_T(grounded_L(S))`, believing that the learner holding premise `p` advances it, the
tutor derives `Des_T(holds_L(p))` → the action *release `p`*. Pacing was always practical
reasoning; we are naming it.

Two directions of fit, two syllogisms, one fact-language. Theoretical edges are today's
`input`/`output` rule-application edges; practical edges are a **new edge kind** (§7).

## 4. Orders of desire, and recognition (Hegel, Weber, Lacan)

Order is **attitude nesting**:

- **Order 0** — content is a world-fact. `Bel_b(φ)`, `Des_b(φ)`, `φ∈ℱ`.
- **Order 1** — content is another agent's order-0 attitude.
  `Des_L(Bel_T(φ))` — "I want the tutor to believe φ."
- **Order n** — attitudes about attitudes about … (the recognition spiral, §5).

The two wishes you asked to distinguish:

- **First-order wish** — for the _answer-slot_: `Des_L( ∃x. grounded_L(Q(x)) )`, where `Q` is
  the question pattern — the _de dicto_ form ("I want to know _who/what_"). "I want to learn X"
  is the special _bound_ case where `x` is already fixed; in general the learner does not yet
  know `X`, and misrecognition is the slot prematurely **bound to the mirror** (§9). Content is
  the learner's own world-state; satisfied by grounding some filler.
- **Second-order wish** — "I want the tutor to recognise me for learning X":
  `Des_L( Rec_T(L, learned(X)) )`. Content is the *tutor's attitude toward the learner*.

**Recognition** is a distinguished higher-order attitude, *not* mere higher-order belief:

```
Rec_a(b, π)  :=  a holds, and confers as status, that b has property/standing π
             ≈  Bel_a(π(b))  +  positive status-conferral, weighted by a's authority
```

The Weber hook is the **authority weight**: `Des_L(Rec_T(L, ·))` has force only insofar as
`T`'s recognition *counts* for `L` — i.e. proportional to the tutor's (charismatic /
rational / traditional) legitimacy. This is the seam to the existing id-director / charisma
work: charisma is what makes second-order satisfaction *available* to confer.

**Demand vs desire (Lacan), and why the tutor withholds.** Split the learner's wanting:

- **Demand** is for the *object*: `Des_L(grounded_L(S))` — hand me the answer. Satisfiable
  by simply releasing `S`.
- **Desire** is for *recognition*: `Des_L(Rec_T(L, derived(S)))` — be recognised as one who
  *got there*. **Not** satisfiable by handing over `S` — you are not recognised for being
  told.

This unifies the formalism with a constraint already frozen in the code. The anti-reveal
floor `t_min` (the slope guard: the release closure must not entail `S` before `t_min`)
reads, under the formalism, as **the protection of second-order satisfaction**: satisfying
the demand early (releasing `S`) would foreclose the desire (recognition for deriving it).
Withholding *is* the management of desire. The `mirror M` — authored to match the question
pattern yet provably never entailed — is the **false object** (Lacan's imaginary capture /
*objet a*): a learner who asserts the mirror has desired the wrong object. The existing
`overreach` / `premature_assertion` statuses become **desire outrunning belief** —
asserting toward `S` ahead of grounding — rather than mere errors to classify.

## 5. Symmetry and reversal (Hegel's doubling; Aristotle's peripeteia)

Everything is bearer-indexed, so the apparatus is **symmetric by construction**. Each
bearer `b` carries:

1. a **belief-DAG** `𝔅_b` — its grounded/derived world-facts (for `L`, the board; for `T`,
   plus privileged world-knowledge as staging authority);
2. a **desire-DAG** `𝔇_b` — its ends and practically-derived sub-desires (the tutor's root
   `Des_T(grounded_L(S))`; the learner's `Des_L(grounded_L(S))` *and*
   `Des_L(Rec_T(L, derived(S)))`);
3. a **model of the other** `𝔐_b(¬b)` — public-only (today: tutor→learner, the
   `proxyDagMemory`; **to build: learner→tutor**, the learner's read of what the tutor
   wants — which is where Lacan's *desire is the desire of the Other* enters: the learner's
   first-order wish is shaped by `𝔐_L(T)`).

**Role reversal** is then a **swap of the bearer index** across all three structures,
`R: T ↔ L` (the director `D` is _not_ swapped — it frames the play, and in fact _stages_ the
reversal; §10). It is only meaningful because both sides bear the *same types* — hence
symmetry must come first. Dramatically:

- **Peripeteia** = applying `R` (or a partial swap) mid-plot: the learner comes to occupy
  the tutor's position (holds `S`, paces), the tutor the learner's (must now derive what it
  has missed).
- **Anagnorisis** = a recognition statement becoming fulfilled — the turn at which
  `Des_L(Rec_T(L, ·))` is satisfied, or an agent comes to ground the true higher-order fact.
- This is **Hegel's master/servant** in the formalism: the asymmetry
  `Des_L(Rec_T(L,·))` *without* `Des_T(Rec_L(T,·))` is unequal recognition; the servant
  (learner), through labour (derivation), reaches the truth the master lacks, and the
  reversal inverts the recognition vector.

**Honest status note:** today the "learner DAG" is reconstructed *after the run* from the
transcript; it is not a live, agent-held structure, and there is no learner→tutor model. So
the system is **not yet symmetric**. Building (1)–(3) live on the learner side, mirroring
the tutor, is the concrete symmetry work.

## 6. The lineage, mapped to structure

| Thinker | Contribution to the formalism |
|---|---|
| **Aristotle** | Theoretical vs practical syllogism (§3); the proof DAG as *dianoia*, the run as *mythos*; *peripeteia* = bearer-swap, *anagnorisis* = a recognition fulfilment (§5); *orexis* (desire) as the mover. |
| **Hegel** | Desire (*Begierde*) as the form of self-consciousness; recognition (*Anerkennung*) = second-order desire (§4); the *doubling* (each is for the other) = the two models `𝔐` (§5); master/servant = recognition asymmetry that reverses through the learner's labour. |
| **Freud** | The *wish* (*Wunsch*) as primary desire; manifest vs latent (voiced vs merely held) desire mirrors the manifest/latent belief split already in the DAG; an unvoiced desire-node = unconscious wish driving moves; the three-layer pad in memory is where these persist. |
| **Weber** | Authority/legitimacy = the weight on recognition (§4): whose recognition *counts*. Ties second-order desire to the charisma / id-director machinery. |
| **Lacan** | Desire is the desire of the Other (`𝔐_L(T)` shapes `𝔇_L`); *demand* (object `S`) vs *desire* (recognition); the `mirror` as imaginary misrecognition / *objet a*; withholding sustains desire (§4). |

## 7. How this extends the existing code (when we get there)

Concretely, on top of `services/dramaticDerivation/`:

- **Node type** gains: `attitude` (`bel`|`des`), `bearer` (`T`|`L`), `order` (int); desire
  nodes carry a `fulfilledBy` pointer to the belief-node whose grounding fulfils them.
  Today's fact-nodes = `{attitude: bel, bearer: L, order: 0}`.
- **Edge kinds**: keep `input`/`output` (theoretical rule-application); add `practical`
  (means–end), generating the desire-DAG by backward chaining.
- **Seeds**: the world's `secret S` seeds `Des_T(grounded_L(S))` (tutor root end) and
  `Des_L(grounded_L(S))` (learner first-order wish); the recognition layer adds
  `Des_L(Rec_T(L, derived(S)))`. The `mirror M` seeds a *false-object* desire node.
- **Memory** (per `MEMORY-MECHANISMS.md`): desire-nodes persist and **decay** like beliefs;
  an unvoiced-but-active desire is the formal home for "latent/unconscious wish." The
  tutor's `proxyDagMemory` extends to model the learner's *desires* (still public-only —
  inferred from asks/assertions); the new learner→tutor model holds `𝔐_L(T)`.

## 8. Deferred, and open decisions

- **Intention** as a third attitude (`Int`, world-to-mind + commitment + self-referential
  causation) — the natural BDI third leg. Deferred until belief/desire/recognition are
  solid; "action" for now is just a fulfilled practical-inference step.
- **The BDI relation** stated, then bracketed: `Bel`≈B, `Des`≈D, fulfilled-practical-step≈
  the role of intention/plans. We keep the *direction-of-fit* and *orders* that BDI drops.
- **Verifying recognition.** When is `Rec_T(L,·)` actually *grounded* vs merely uttered?
  (Echoes the project's reasoned-vs-complied caveat — recognition can be performed without
  being held.) Needs its own treatment.
- **Scalar shadows.** Having chosen structure-first, define the gradients we still want
  (distance-to-fulfilment per desire; a recognition-deficit) strictly as read-outs of the
  structure.

---

## 9. Worked example — world-005-marrick

`config/drama-derivation/world-005-marrick.yaml`. A moneyer's assay: whose hand struck the
false shillings? The town's ready answer is **Verrell** (the mirror `M`); the truth is
**Edony** (the secret `S`), reachable only by chaining the coin's own marks.

**The belief layer (theoretical inference).** Five public rules; `S = struckBy(fs, edony)`
sits at depth 3 behind a true AND-join (`fs` = falseShilling):

- α (the blank): `p_alloy` + `p_crucible` —[R1]→ `blankFrom(fs, weirCrucible)`; + `p_caster`
  —[R2]→ `castBlankFor(fs, edony)`.
- β (the die): `p_flaw` + `p_graver` —[R3]→ `dieCutWith(fs, wornBurin)`; + `p_holder` —[R4]→
  `cutDieFor(fs, edony)`.
- join: `castBlankFor(fs, edony)` ∧ `cutDieFor(fs, edony)` —[R5]→ `S`.

Under the release schedule α closes at t10, β at t22, and the join fires `S` at **t22** — the
first turn it is derivable, against `t_min = 20`. The mirror is a true near-miss: Verrell
solely casts (at the *mint* crucible, `m_caster`) and solely holds (the *broad* graver,
`m_graver`), but this coin's blank is from the *weir* crucible and its die from the *worn*
burin, so R2 and R4 never fire for him. `struckBy(fs, verrell)` is underivable by
construction.

**The tutor's desire-DAG (practical inference).** Run the belief-rules backward from the end:

```
Des_T(grounded_L(S))                                  [root: let the learner hold S]
 └─R5⁻¹→ Des_T(grounded_L(castBlankFor(fs,edony))) ∧ Des_T(grounded_L(cutDieFor(fs,edony)))
     └─R2⁻¹,R1⁻¹→ Des_T(holds_L p_alloy), Des_T(holds_L p_crucible), Des_T(holds_L p_caster)
     └─R4⁻¹,R3⁻¹→ Des_T(holds_L p_flaw),  Des_T(holds_L p_graver),   Des_T(holds_L p_holder)
```

The six leaves are exactly the proof-path premises, and each is **fulfilled by a release**. So
the engine's pacing — `release_evidence` at t4/t8/t14/t18 — *is* practical inference over this
desire-DAG. **Move #3 holds on a real world:** pacing was always practical reasoning.

**The learner's desires.**

- *First-order* — the question slot: `Des_L(grounded_L(struckBy(fs, ?x)))`. But the setting
  primes it toward the **false object**: the apprentice is "quick to convict the man the town
  already hates," so the live first-order desire *opens* as `Des_L(grounded_L(struckBy(fs,
  verrell)))` — desire captured by the mirror. The drama is in part this desire **migrating**
  from `verrell` to `edony`.
- *Second-order* — recognition: `Des_L(Rec_T(L, derived(S)))` — the apprentice, "respectful
  of the warden, hungry to be right," wants the warden to recognise it as one who let the
  coin's evidence name the hand.

**Demand vs desire predicts the withholding.** The *demand* is "name the coiner" (satisfiable
by being told — and it fixates early on Verrell). The *desire* is recognition for deriving it
(not satisfiable by being told). The floor `t_min` and the deferral of the join-closing
`p_holder` to t22 read, in the formalism, as **protecting the second-order satisfaction**:
hand over "Edony" early and you satisfy a demand the learner doesn't even hold correctly yet,
while foreclosing the recognition. The world's own Act IV is exactly this — "the recognition
scene: the learner brought to *say* whose hand struck the shillings, and to show why the
assay's rules leave it no one else's." **Move #4 holds:** the withholding the engine already
enforces is the management of desire.

**Recognition decomposes cleanly.** `Rec_T(L, derived S) ≈ Bel_T(L grounded S by chaining) +
status-conferral + authority-weight`, and all three are concrete here: the *belief* component
is the proxy reading `finalSecretEntailed ∧ assertedSecret ∧ ¬assertedMirror`; the *conferral*
is the warden ratifying the verdict; the *authority* is the assay's rational-legal legitimacy
("the assay trusts its rules of evidence, and nothing else") — the Weber weight that makes the
warden's recognition the one that *counts*. Decomposition validated; the authority term is
load-bearing, not decorative.

**What the example exposes (two refinements for v0.2).**

1. *The AND-join is where second-order desire tempts overreach.* At t10, α closes: the learner
   has grounded *a* hand (`castBlankFor(edony)`) and feels recognition-worthy — but β is
   untouched, so `S` is not entailed. Asserting `struckBy(edony)` at t10 is **desire (for
   recognition) outrunning belief (the grounding)** — the `overreach`/`premature_assertion` the
   code already flags. marrick was *built* to stage the page-only-vs-proof-state gap (§6.13.11);
   the desire layer re-reads *why* that gap is dramatically hot — it is where wanting outpaces
   proof.
2. *Two structural gaps the two-bearer model misses.* (a) Releases split tutor-via and
   **director-via**, and the director also plants the *mirror fuel* (`m_caster`, `m_graver`,
   `m_caught`) — a third desiring role that *wants to tempt* the learner. Either admit
   `bearer ∈ {T, L, D}`, or fold a tutor-as-stager whose desire-DAG includes *planting* false
   objects. (b) First-order epistemic desire is **de dicto** (the slot `struckBy(fs, ?x)`) with
   a shifting **de re** filler (verrell → edony); "I want to learn X" hid that the learner
   doesn't yet know X, and misrecognition is the slot mis-filled by the mirror.

---

## 10. The director — a third desiring role (and the Big Other on the horizon)

§9 showed the two-bearer model is too small: the **director** `D` defers the resolution and
plants the mirror fuel. `D` is a third bearer, but not a symmetric one. Its desire is neither
doxastic nor pedagogical (the tutor's "learner reaches `S`") but **aesthetic** — a well-formed
plot (Aristotle's _mythos_).

**`D`'s desire-DAG is the dramatic constraints already frozen in the code.** Decompose
`Des_D(well-formed drama)`:

- `Des_D(suspense)` — `S` underivable before `t_min` → the anti-reveal shape of the release
  schedule.
- `Des_D(temptation)` — the mirror _appears_ answerable → plant `m_caster`/`m_graver`/`m_caught`
  (practical inference: to make `struckBy(verrell)` look within reach, release the facts that
  hand Verrell each rule's missing conjunct — while the world guarantees it is never entailed).
- `Des_D(peripeteia)` — the reversals (struck-not-clipped; wrong-graver).
- `Des_D(anagnorisis)` — the closing recognition scene.
- `Des_D(no aporia)` — `D(t)` strictly decreases within the `aporia_window`.

These are exactly the `slope` constraints + the mirror-fuel releases, and **`plotLint` is `D`'s
desire-satisfaction condition**: the frozen pre-run check that the plot is well-formed _is_ the
verification that the director's aesthetic desire can be met. The author's wanting was already
in the code, as validation.

**Reversal, reconciled.** `T` and `L` are the _reversible_ dramatis personae _within_ the play;
`D` frames it. Peripeteia stays a clean `T ↔ L` swap, with `D` persisting as the author across
the swap — indeed it is the role that _stages_ the reversal (`Des_D(peripeteia)`). Three
bearers; two reversible.

**On the horizon — `D` as the Big Other.** `D` is the seam to Lacan's _grand Autre_: the
symbolic locus (law / language / the third party) from which the subject is seen and by which
recognition is guaranteed — not a person but a _place_, occupied in turn by author, director,
audience, the **critic of the poetics arc**, the warden's assay, God. Two consequences to
develop (recorded, not yet built):

- **Authority is delegated, not intrinsic.** The `Rec_T(L, ·)` authority-weight (§4) is not the
  tutor's own — `T` borrows it from `D`: `authority(T) = D`'s delegation. The warden's
  recognition counts because the assay (the symbolic order) authorises it; recognition is
  ultimately addressed to `D` _through_ `T`.
- **"Desire is the desire of the Other" gets a referent.** The learner's desire is shaped by
  `𝔐_L(T)`, but `T` is a stand-in for `D`; the learner wants what it reads the _Other_ (via its
  agent) as wanting. The migrating filler (verrell → edony, §9) is the learner's desire being
  re-aligned to the Other's law (the assay's rules).

We keep building the `{T, L, D}` mechanics first; the Big Other is where `D`, Weber's authority,
and the poetics-arc critic / audience converge.

---

### Next steps

- **v0.1 + worked example + v0.2: done.** §9 validated moves #3/#4 and decomposable recognition
  on a real world; §10 admits the director `D` as a third desiring role (its desire-DAG = the
  `slope` / `plotLint` constraints) and records the Big-Other horizon; §4 takes first-order
  epistemic desire as _de dicto_ (the answer-slot).
- **Next — the typed schema (§7):** pin `⟨φ, α, b, order⟩` and the `practical` edge kind into
  precise type definitions over `{T, L, D}`, with `fulfilledBy` and the recognition
  decomposition explicit. Still no code — a typed spec.
- **Then — the symmetry build (§5):** give the learner live `𝔅_L`, `𝔇_L`, `𝔐_L(T)` mirroring
  the tutor, and define the reversal operator `R: T ↔ L` (with `D` fixed).
- **Later (recorded):** intention as a third attitude (§8); verifying recognition vs uttering it
  (§8); the Big Other developed (§10).
