# Belief–Desire DAG — role-playing formalism (v0.4, working draft)

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
audience, the **critic of the poetics arc**, the warden's assay, God. Two consequences,
developed in §11:

- **Authority is delegated, not intrinsic.** The `Rec_T(L, ·)` authority-weight (§4) is not the
  tutor's own — `T` borrows it from `D`: `authority(T) = D`'s delegation. The warden's
  recognition counts because the assay (the symbolic order) authorises it; recognition is
  ultimately addressed to `D` _through_ `T`.
- **"Desire is the desire of the Other" gets a referent.** The learner's desire is shaped by
  `𝔐_L(T)`, but `T` is a stand-in for `D`; the learner wants what it reads the _Other_ (via its
  agent) as wanting. The migrating filler (verrell → edony, §9) is the learner's desire being
  re-aligned to the Other's law (the assay's rules).

The Big Other is where `D`, Weber's authority, and the poetics-arc critic / audience converge —
§11 develops it, §13 pins the mechanics.

## 11. The Big Other, developed

§10 placed `D` at Lacan's _grand Autre_ — the symbolic place that guarantees recognition. Three
developments, each with a formal correlate.

**(a) Authority is a delegation the learner must believe.** Make the authorisation explicit:
`auth_D(T)` — `D` vests `T` with the standing to confer recognition. Then the _force_ of the
learner's second-order desire is gated not by `T`'s authority as such but by the learner's
**belief** in it:

```
force( Des_L(Rec_T(L, π)) )  ∝  Bel_L( auth_D(T) )
```

Two things follow. First, Weber's three types are three _modes_ of `auth_D(T)` — `charismatic`
(the warden compels by presence), `traditional` (by office), `rational_legal` (by the assay's
rules) — so the charisma / id-director machinery is the study of how `T` acquires and signals
`auth_D(T)`. Second, recognition can be **deflated without touching the proof**: if the learner
ceases to believe `T` speaks for the Other (`Bel_L(auth_D(T))` falls), the same utterance loses
force. Recognition is not in the words; it is in the believed delegation behind them.

**(b) The Other is barred — and the project has already measured it.** Lacan's `S(Ⱥ)`: there is
no consistent, complete guarantor. Two correlates we already possess:

- `D`'s law can be **inconsistent**: `plotLint` can _fail_ — a world whose constraints cannot be
  jointly met (the secret leaks before `t_min`, or no release path completes). A failed
  `plotLint` is the Other's law with a hole in it.
- The `D`-place is occupied by **several, non-identical** parties — author, director, audience,
  the poetics critic, the warden. When they disagree on whether `π` was earned, there is no
  single conferral. **This is the project's critic-divergence finding** (the poetics κ-gap, the
  critic-mirror) read structurally: critics diverge because _the Other does not exist as
  univocal_. What looked like a measurement failure is the barred Other showing through.

**(c) The three registers — two clear, one that may not fit.** Imaginary = the **mirror** `M`
(the false object, the learner's captured first-order desire). Symbolic = `D` with the public
rules `R` (the law that confers). The **Real** is the slippery one, and we should not force it.
Two candidates, each with a defect:

- the _impossible_ — `struckBy(verrell)` is underivable _by construction_, no rule ever reaches it
  (Lacan: "the real is the impossible"). Attractive, but tightly coupled to the Imaginary that
  _covers_ it: the mirror's surface plausibility is exactly the veil over that hard impossibility.
- the _aporia_ — the impasse where derivation stalls (`detectStall`, the `aporia_window`
  constraint). More dynamic: the Real as the eruption that breaks symbolic flow.

Neither yet does load-bearing work the way `D` does, so we **record the Real as open and do not
build on it** — it earns no place in the core mechanics until it _predicts_ something (e.g. where a
derivation stalls). And we retract the earlier "unvoiced interior" candidate: the latent/manifest
split is preconscious (Freud), not Real.

## 12. Reversal, developed

Reversal is richer than an index swap. Place the dramatis personae in a **recognition-vector
space**:

- **asymmetric** (master/servant): `Des_L(Rec_T(L,·))` without the converse — the opening state.
- **mutual** (Hegel's resolution): both `Des_L(Rec_T(L,·))` _and_ `Des_T(Rec_L(T,·))` — each
  desires the other's recognition; the doubling completes.
- **inverted** (the reversal `R`): the vector flips — `Des_T(Rec_L(T,·))` without the converse;
  the former master now needs the former servant's recognition.

**Peripeteia is a transition in this space**, and `R: T ↔ L` is only its limiting (total) case.
Three things this buys:

- **Anagnorisis enables peripeteia (Aristotle's coincidence).** The asymmetry is destabilised
  exactly when the servant's labour produces the truth: the learner _grounds_ `S` and is
  _recognised_ for it. That fulfilment of `Des_L(Rec_T(L, derived S))` is the structural trigger —
  recognition of the truth is the condition for the reversal of position. The best peripeteia
  _coincides_ with the anagnorisis because, here, one is the other's enabling condition.
- **The index swap is necessary, not sufficient.** Swapping `T ↔ L` puts `S` in the learner's
  hands and empties the tutor's — but a _content_ transformation must accompany it: the former
  master must come to **derive its own dependence** (that its authority was borrowed from `D`,
  §11a). Reversal is a swap _plus_ a new derivation forced on the surpassed party.
- **`D` stages its own destabilisation.** `Des_D(peripeteia)` means the author _wants_ the
  reversal — but the reversal can expose `auth_D(T)` as contingent (the master's standing was only
  ever delegated). So the director's aesthetic desire is in tension with the symbolic order's
  stability: the Other desires the very turn that reveals it is barred. This is not a bug to
  remove; it is the engine of the strongest recognitions, and a thing the formalism should let us
  _stage on purpose_.

**The content-transformation, specified.** Make the second bullet precise. When a victor `Y`
grounds the secret that a surpassed party `X` represented, the reversal forces a new end on `X`: to
ground the **dependence proposition**

```
δ_X  :=  truthBearer(Y, S)        // "the one who bore the truth was Y, not my office"
```

So `reverse` is the index swap `T ↔ L` (`D` fixed) **plus** seeding `Des_X(grounded_X(δ_X))` on the
surpassed party. The swap is necessary; the reversal **consummates** only when `δ_X` is grounded —
until then the dialectic is stalled (Hegel's master who will not own its dependence). Dually, full
**mutual** recognition needs both meta-facts grounded: `X` grounds `δ_X = truthBearer(Y, S)` and `Y`
grounds `δ_Y = enabler(X, derivation_Y)` (the learner recognises the withholding-as-gift). Three
reachable states from the asymmetric opening:

- **mutual** — both `δ` grounded → symmetric recognition (the resolved Hegelian end);
- **inverted** — the bare swap, `δ_X` _not_ grounded → the new master in the old denial, the
  asymmetry repeats with roles flipped (the cyclic / tragic path);
- **stalled** — the swap attempted, `δ_X` neither seeded nor grounded → the dialectic halts.

This is now executable (§14): `reverse()` performs the swap and seeds `δ` (origin `dependence`) and
returns `consummated: false` — the necessary-not-sufficient point made into code.

## 13. Typed schema (v0.1 spec — no code yet)

A precise contract for `⟨φ, α, b, order⟩` and the graphs over `{T, L, D}`, written as
TypeScript-style interfaces _as documentation_ (the runtime is JS; this is the spec, not an
implementation). Each type notes the `services/dramaticDerivation/` structure it generalises.

```ts
// Content & atoms
type Var = `?${string}`; // slot variable, e.g. "?x"
type Fact = [pred: string, ...args: (string | Var)[]]; // existing chainer fact array
type Content = Fact | Statement; // recursion gives orders > 0
type Attitude = "Bel" | "Des"; // Int (intention) deferred, §8
type Bearer = "T" | "L" | "D";
type NodeId = string;

interface Statement {
  content: Content;
  attitude: Attitude;
  bearer: Bearer;
  order: number; // 0 = fact content; n = content is an order-(n-1) Statement
}

// Nodes (tagged union by `kind`)
type Node = FactNode | DesireNode | RecognitionNode | RuleApplicationNode;

interface FactNode {
  // a belief — generalises learnerDag's fact-node
  kind: "fact";
  statement: Statement; // attitude = "Bel"
  status: "grounded" | "belief_only" | "voiced" | "asserted" | "overreach";
  grounded: boolean; // φ ∈ Cl_R(held_bearer)
  source: "background" | "released_premise" | "learner_only";
}

interface DesireNode {
  kind: "desire";
  statement: Statement; // attitude = "Des"
  slot?: { var: Var; binding: Content | null }; // de dicto ∃x.Q(x); binding may be the mirror
  fulfilledBy: NodeId | null; // FactNode whose grounding fulfils this (§2)
  fulfilled: boolean;
  origin: "root_end" | "practical_subgoal" | "false_object" | "given" | "dependence"; // §12
}

interface RecognitionNode {
  // decomposable Rec_a(b, π) (§4)
  kind: "recognition";
  recogniser: Bearer; // a
  recognised: Bearer; // b
  standing: Content; // π, e.g. derived(S)
  beliefComponent: NodeId; // Bel_a(π(b))
  conferral: boolean; // status conferred vs merely believed
  authority: { authorizer: Bearer; mode: WeberMode; believedByRecognised: boolean }; // §11a
  held: boolean; // grounded vs merely uttered (§8)
}
type WeberMode = "charismatic" | "traditional" | "rational_legal";

interface RuleApplicationNode {
  // existing inference node, direction-tagged
  kind: "rule_application";
  rule: string; // world rule id R1…R5
  inputs: NodeId[];
  output: NodeId;
  direction: "theoretical" | "practical"; // forward belief vs backward desire
}

// Edges
type Edge =
  | { kind: "input"; from: NodeId; to: NodeId } // premise → rule-app (existing)
  | { kind: "output"; from: NodeId; to: NodeId } // rule-app → conclusion (existing)
  | { kind: "practical"; from: NodeId; to: NodeId } // end → sub-desire (NEW, §3)
  | { kind: "fulfils"; from: NodeId; to: NodeId } // FactNode → DesireNode (NEW, §2)
  | { kind: "authorises"; from: NodeId; to: NodeId }; // D → RecognitionNode (NEW, §11a)

// Per-bearer state
interface Graph {
  nodes: Record<NodeId, Node>;
  edges: Edge[];
}

interface BearerState {
  bearer: Bearer;
  belief: Graph; // 𝔅_b
  desire: Graph; // 𝔇_b
  model: Partial<Record<Bearer, PublicModel>>; // 𝔐_b(other); today only T→L
}

interface PublicModel {
  // generalises proxyDagMemory (publicOnly, redacted)
  of: Bearer;
  grounded: Fact[];
  voiced: Fact[];
  asserted: Fact | null;
  inferredDesires: DesireNode[]; // NEW: the other's wants, read off public behaviour
  audit: { authoredPathsIncluded: false; secretIncluded: false };
}

// Reversal (§12): swap T↔L across all structures; D fixed.
// Necessary only — a content transformation (the surpassed party deriving its
// own dependence) must follow the swap.
declare function reverse(world: World, s: Record<Bearer, BearerState>): Record<Bearer, BearerState>;
```

**Binding the spec to the code.** `FactNode` = `learnerDag`'s fact-node plus an attitude/bearer
tag. `RuleApplicationNode.direction:"theoretical"` = the existing `closure`; `"practical"` is the
new backward mode. `PublicModel` = `proxyDagMemory` with an `inferredDesires` field and the same
`audit` no-leak block. `World` is the frozen `world.js` object (rules `R`, premises, secret `S`,
mirror `M`, `proof_paths`, `release_schedule`, `slope`): `D`'s belief-graph is the whole `World`;
`T`'s is `World` minus the unreleased premises' _facts_ (it holds the schedule, as staging
authority); `L`'s is only what has been released and held.

## 14. Code scaffold (v0 — pure structure, tested)

`services/dramaticDerivation/beliefDesire.js` + `tests/dramaticDerivationBeliefDesire.test.js`
implement the load-bearing pieces of §13 as deterministic structure — no model call, no eval, no
DB; seam-safe (it imports only the sibling `chainer`). Four tests pass.

- **`buildTutorDesireDag(world)`** builds the tutor's desire-DAG by **inverting the belief-proof of
  the secret** (reusing `chainer.proofTree`, not re-deriving): each derived fact becomes a
  `Des_T(grounded_L(·))` node, each base fact a `Des_T(holds_L premise)` leaf, each rule a
  `practical` edge. On `world-005-marrick` the leaves come out as **exactly the six proof-path
  premises** (`p_alloy, p_caster, p_crucible, p_flaw, p_graver, p_holder`) — move #3 made executable
  and checked against a real world.
- **`seedLearnerDesires(world)`** emits the first-order de dicto slot (`∃x. Q(x)`, binding `null`)
  and the second-order recognition desire (order 1).
- **`recognitionNode(...)`** is the decomposable `Rec_a(b, π)` — belief-component, conferral, and a
  Weber-`mode` authority delegated from `D` (§11a).
- **`reverse(states, {surpassed})`** is the §12 operator: swap `T ↔ L` (`D` fixed) **and** seed the
  dependence proposition `δ` (origin `dependence`) on the surpassed party, returning
  `consummated: false`.

It does _not_ yet hold live per-bearer state (`𝔅_L` / `𝔇_L` / `𝔐_L`) — `reverse` swaps placeholder
state objects. Wiring those live is the symmetry build proper (next).

---

### Next steps

- **v0.1 → v0.4: done.** §11–§13 develop the Big Other, reversal (with the content-transformation
  `δ` now specified, §12), and the typed schema; §14 lands a tested scaffold (`beliefDesire.js`) that
  makes the tutor desire-DAG and `reverse()` executable. The Real is recorded as open and
  deliberately unused (§11c).
- **Next — live symmetry (§5):** give the learner real `𝔅_L`, `𝔇_L`, `𝔐_L(T)` (a learner→tutor
  model — the missing half of `proxyDagMemory`) and rewire `reverse()` over those live states, so the
  three reachable states (mutual / inverted / stalled) can actually be reached on a run.
- **Later (recorded):** intention as a third attitude (§8); verifying recognition vs uttering it
  (§8 / `RecognitionNode.held`); the Real, only if it earns its keep (§11c).
