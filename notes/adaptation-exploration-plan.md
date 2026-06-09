# Adaptation Exploration — Post-§6.10 Reframe

**Status:** exploration brief, 2026-06-09. Seeds the worktree branch
`explore/adaptation-repertoire-ceiling`. Sibling to — and explicitly does **not**
duplicate — `ADAPTATION-PLAN-2.0.md` (§6.10). Any result lands as **§6.11** of
`docs/research/paper-full-2.0.md` (single-paper discipline; positive or negative).

**Source material:** `notes/daily-notes/2026-06-08-research-digest.html` +
`2026-06-09-research-roundup.html` (16 papers, 2 Jun–9 Jun 2026).

---

## 0. The position you are inheriting (read before exploring)

The adaptation **mechanism** search is closed. Five convergent in-paper negatives:

| § | mechanism tried | why it failed |
|---|---|---|
| 6.7 | charisma / id-director | performed legitimacy; never measured uptake |
| 6.8.8 | bilateral-ToM state machine | re-encoded what the base infers |
| 6.9.7 | fitted policy | re-encoded |
| 6.9.8 | learned adaptation (policy-realisation axis) | re-encoded |
| 6.10 | concealed-interior inference (signal axis) | offline gate failed: simulated interior is surface-recoverable |

The **one** decisive positive in the whole arc: the adversarial superego
(20 → 85). It added *a perspective the generator does not produce about itself*
(independent opposition), not a richer restatement of what it already reads.

**Dividing principle (do not relitigate):** gains require signal the base does
**not** already read in-context. Every negative re-encoded the surface the strong
base already infers. §6.10 pushed this onto the *signal* axis: on the simulated
corpus the learner's hidden deliberation is recoverable from surface
(`R²_latent` negative, 95% CI below 0), so there is no unread signal there to
model.

**Therefore a sixth mechanism cell is not the default move.** Do not open one
without a free offline gate passing first. This brief deliberately points away
from "run another mechanism" and toward measurement, a ceiling hypothesis, and
the one place unread signal actually lives.

---

## 1. What the 16 papers add (sorted by what survives §0)

**A. Measurement / diagnostic — the real contribution.** These claim no
pedagogical effect, so they cannot be a "sixth thrash"; they sharpen what
*adaptation* means and can re-interpret existing runs for free.

- **Argument Collapse** (2606.01736) — LLM essays share only **3.4%** unique main
  arguments vs humans' **65.3%**. → the *repertoire-ceiling* hypothesis (Track A).
- **Not All Flips Are Conformity** (2606.00820) — decomposes answer-flips into
  *spontaneous instability* / *stance-induced conformity* / *reasoning-induced
  persuasion*. → adaptation-vs-compliance classifier (Track B).
- **ReasoningFlow** (2606.05402) — DAG formalism for deliberation traces. →
  supporting instrument to sharpen `RevΔ/EgoSpec/AdaptΔ` in
  `analyze-mechanism-traces.js`.

**B. Signal-location — where unread signal actually exists.**

- **PersuasionTrace** (2606.05330) — turn-level *human* belief reports +
  logos/pathos/ethos. → §6.10 closed the *simulated* interior; a *human* belief
  trajectory is not surface-recoverable. The unread-signal lever has fuel only in
  the human pilot (Track C).

**C. Mechanism-flavoured — re-encoding risk, treat as vocabulary not levers.**
Motivational Architecture (2606.05411), ArcANE phase-conditioning (2606.05553),
trait-conditioned persuasion (2604.07028), DySCo (2606.01828), Agent Memory
(2606.06448), Goffman front/backstage, rhetorical-question probing (2604.14128),
ontology-constrained critic (2604.00555). Conditioning the tutor on
phase/trait/motivation is re-encoding what the base reads — do **not** default to
a cell. (The ontology-constrained critic belongs to the poetics-κ arc, not here.)

---

## 2. The one new question worth a worktree

**Is the adaptation ceiling a mechanism failure or a repertoire failure?**

The five negatives all assumed the *mechanism* was the bottleneck. Argument
Collapse offers the rival we never tested: the tutor's **response distribution
itself is collapsed** — much the same explanatory moves regardless of who the
learner is — so there is little adaptation left to engender, whatever mechanism
sits on top. This reframes the negatives without proposing a sixth mechanism, and
the first test costs nothing.

---

## 3. Three tracks, each gated by a free offline Stage 0

Mirror the §6.10 discipline: Stage 0 is read-only on data already on `main`, costs
no API, and a null at the gate **is** the result.

### Track A — Repertoire-ceiling diagnostic  · PRIMARY · free Stage 0
- **Hypothesis:** tutor explanatory repertoire collapses across learners and
  runs → adaptation is generator-capped, not mechanism-capped.
- **Stage 0 (offline, read-only on `evaluation_results` + dialogue logs):** for a
  fixed scenario, measure tutor-move diversity across (a) different learner
  personas and (b) repeat runs. Candidate metrics: unique-n-gram rate /
  embedding-centroid dispersion / an Argument-Collapse-style unique-move rate.
  Symmetry check: compute the same for learner messages. Anchor against the §6.3
  suggestion corpus.
- **Pre-register** the collapse threshold and the contrast (within-scenario,
  across-learner dispersion) before looking.
- **Reads:** if tutors collapse (low, learner-invariant dispersion) → §6.11: the
  ceiling is the generator, and the five negatives are *explained*, not merely
  extended — a stronger paper sentence, earned for free. If tutors **do**
  diversify per learner, Track A returns null and the bottleneck is elsewhere.
- **Architecture-independent:** dispersion is computed on stored outputs; no
  generator in the scoring loop.

### Track B — Adaptation-vs-compliance classifier  · MEASUREMENT · re-reads existing data
- **Hypothesis:** not every `adaptationIndex` move is genuine; some ego revisions
  are *conformity* with the superego, not *reasoning-persuasion*.
- **Stage 0 (offline):** build the 3-way classifier
  (instability / conformity / persuasion) as a **separate channel** — a different
  model family from the generator (closed-loop guardrail) — over existing
  ego-revision turns. Re-examine the one positive: did adversarial-superego
  20 → 85 ride *persuasion* flips, or did it raise *conformity*?
- **Pass/stop:** if the classifier can't separate the three classes on held-out
  hand-labels (κ floor, pre-registered) → drop it. If it can, report the
  conformity-vs-persuasion split of the existing `adaptationIndex`.
- This sharpens the metric; it is not a new mechanism, and it re-interprets prior
  runs at no generation cost.

### Track C — Unread signal is in the human  · HORIZON · pilot-gated
- §6.10 P1 showed the simulated learner's interior is surface-recoverable → no
  unread signal. A *human* learner's turn-level belief trajectory is not. That is
  the one place the unread-signal lever has fuel.
- **Stage 0 (now, no API):** spec a PersuasionTrace-style instrument for the human
  pilot (`TODO.md` §A1) — per-turn belief elicitation + logos/pathos/ethos
  annotation, mirrored tutor/learner. Design only.
- **Run:** when the pilot clears IRB. Not a paid *simulated* run.
- **Guardrail:** do not run this against the simulated learner expecting a win —
  §6.10 already closed that door.

---

## 4. Frozen guardrails (so this cannot become the sixth thrash)

- **Offline gate first, and ruthless.** Each track earns API/live work only by
  passing a pre-registered free Stage 0. A null at the gate is the §6.11 result —
  no tune-and-retry branch.
- **Architecture-independent critic or dead on arrival.** If a scoring channel
  shares the generator's model/prompt it is a closed-loop tell
  (`closed-loop-eval-tells`). Track B's classifier must be a different family.
- **One question, not a sweep.** The question is §2 (mechanism vs repertoire).
  Track A answers it; B and C support. No fan-out of diagnostic variants.
- **Mine our own negatives.** The value is reframing five existing negatives, not
  generating a sixth.
- **Branch off `main`** (A14/§6.9.8 precedent: the branch paradigm produced
  publishable results; isolated prototypes did not). Stage 0 is read-only.
- **Single paper.** Lands as §6.11; no spin-off.

---

## 5. Explicitly out of scope

- A sixth *mechanism* cell as the default move.
- Re-running concealed-interior inference on the simulated learner (§6.10).
- The ontology-constrained critic for poetics κ (separate arc).
- Efficiency optimisation (DySCo) — not an adaptation-*quality* question.

---

## 6. Pointers

`ADAPTATION-PLAN-2.0.md` (§6.10, frozen) · `docs/research/paper-full-2.0.md`
§6.7–6.10 · `scripts/analyze-mechanism-traces.js` · `TODO.md` §A1 (pilot).
Memories: `adaptivity-what-works`, `adversarial-superego-v3-result`,
`closed-loop-eval-tells`, `feedback_ablation_creep_synthesis`,
`feedback_single_paper_discipline`. Source notes: `notes/daily-notes/`.
