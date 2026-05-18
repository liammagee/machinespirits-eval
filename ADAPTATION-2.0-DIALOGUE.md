# Adaptation Arc 2.0 — Design Dialogue (rationale record)

Internal design-rationale document, 2026-05-17. **Not a paper or spin-off**
— introduces no empirical claims; it preserves the reasoning that produced
`ADAPTATION-PLAN-2.0.md`. Persisted at the user's explicit request ("keep
note both of this request and your response — it matters"; "maintain this
current dialogue in document form"). Paper-bound claims still live only in
`docs/research/paper-full-2.0.md` (single-paper discipline).

---

## 0. Where the arc stands

Paper *Geist in the Machine* travelled **v2.3.21 (11 Mar 2026, arXiv-prep)
→ v3.0.84 (17 May 2026)**: an entire Paper 2.0 (§6.7–§6.9.8) built atop
the recognition result. `LEARNED-ADAPTATION-PLAN.md` closed the **fifth**
convergent negative as §6.9.8 (fitted state→action policy ≈ implicit base).

## 1. The user's standing question (after §6.9.8)

The user declined to let the arc close. Prompt-hacking, multiagent review,
state machines, fitted policy — all limited promise — yet "the solution is
out there: what are we missing?" Three theoretical leads:

- **(a)** the *rubric itself*, used dynamically to revise prompts / agent
  config / transcript memory;
- **(b)** a deeper theory of mind — the learner has the *same depth of
  interiority we do*; cater to it empathetically (Hegel / Freud / Weber);
- **(c)** lean further into the state machine, but as an *ever-growing
  ontology / theory of the world*, not a progress tracker.

Constraints (binding): **no ablative thrashing**; mine our own negatives;
mine the theoretical coordinates; crack "machine learning" with *depth*,
not GPU/token brute force. One principled new arc is sanctioned.

## 2. The diagnosis (the answer)

**Every negative has one shape.** §6.7 (persona), §6.8.8 (state vector),
§6.9.7 (evidence log), adaptive-persona (persona machine), §6.9.8 (fitted
policy) each *re-encoded what the strong base already infers in-context
from the surface transcript*. The one decisive positive — adversarial
superego (20→85) — added *a perspective the generator does not produce
about itself*. Gains require **signal the base does not already read**, not
a richer restatement of what it does.

**Where the unread signal lives.** The RLHF base reads the learner **at
face value** (sycophancy / agreeableness bias). The v1 trap suite is
*built from* concealment cases (`polite_false_mastery`, `false_confusion`,
`affective_shutdown`, `epistemic_resistance`,
`answer_seeking_to_productive_struggle`) — the truthful reading diverges
from the surface utterance. The base is systematically wrong here, in a
known direction. And this project **uniquely owns the ground truth**: the
learner is a full ego–superego agent; only `learner/final_output` is
externalised; the hidden `learner_ego_initial / learner_superego /
learner_ego_revision` deliberation is in our logs and the tutor never sees
it. Manifest≠latent is *new signal* and is *offline-checkable against the
real hidden trace*.

**Theory → mechanism (not decoration).** Hegel: recognition = the other's
interior is not given to me (bilateral-ToM flattened it — the opposite).
Freud: manifest vs latent; the trap is the defense; address the defense.
Weber: authority is legitimate only as *conferred by the other's interior*
(charisma §6.7 failed because it *performed* legitimacy rather than
tracking its uptake).

## 3. The three proposals, adjudicated

- **(b) interiority — the core lever, genuinely new.** Build an *inverse
  model of the learner's hidden deliberation* (invert the learner agent we
  already own), condition the move on the *inferred concealed* state,
  structurally forced to diverge from face value. Generalises the one
  thing that worked (independent opposition) from "the draft" to "the
  reading of the other." Uniquely offline-falsifiable here.
- **(a) rubric-in-the-loop — yes, but only as the independent critic.**
  §6.9.8 already fitted a policy *to the rubric outcome* → null; rubric as
  a *policy target is dead*. Rubric as an **external normative critic on an
  independent channel** is the adversarial principle, and the
  Reflexion/Constitutional finding (self-critique pays only vs an external
  standard). It is the *evaluative arm* of (b), not a separate experiment.
- **(c) ontology state machine — thrash risk, flagged.** §6.8.8/§6.9.7/
  §6.9.8 are three statements that elaborating the externalised
  representation does not pay. An "ever-growing ontology" is the
  fifth-negative pattern recoated. Only salvageable version: a *jointly
  negotiated* world-model whose tutor↔learner *divergence* is the signal —
  out of scope unless (b) clears its gate.

**Literature triangulation.** Bayesian ToM / inverse planning
(Baker–Tenenbaum: infer latent states by inverting a generative model of
the other — we have that model, unused); Reflexion / Self-Refine /
Constitutional (external-standard critique pays, self-generated plateaus —
our adversarial/advisory split); contingent tutoring (Wood: tighten/cede
control on demonstrated state — applied to the *inferred concealed* state,
untested); predictive processing (Friston: adaptation = minimise surprise
about *this* other — unifies the rest).

**Thesis.** Adaptation failed not because mechanisms were too simple but
because they re-encoded what the base already reads. The base reads the
learner at face value; the traps are where face value is a lie; we
uniquely own the learner's hidden deliberation as offline ground truth.
The next mechanism is an *independent inverse-model of the concealed
interior*, wielded by an *independent rubric-critic*, *killed offline*
against the real hidden trace before any spend.

## 4. Weber addendum (user, 2026-05-17)

Accompanying (b): following Weber, **track the effectiveness of the
tutor's charisma on learner engagement, and vice versa** — charisma as the
lever that *shifts* the learner toward the normatively desired state
(receptive, not resistant). "We made a start" = §6.7 id-director /
`config/evaluation-rubric-charisma.yaml` (Weber-derived 8-dim, cells
101–109, `tutor_charisma_*` columns) "but have not taken full cognizance
of its potential."

**Integration (disciplined, not a new sweep).** Charisma is not a second
mechanism — it is the **bidirectional uptake channel** the concealed-
interior model needs to be *effective* rather than merely *accurate*.
Inferring the latent state answers *what is withheld*; the charisma↔
engagement channel answers *what move actually shifts it toward
receptivity*. Both fold into the **same Stage 0**, both on **existing
traces, zero-API**: we already have `tutor_charisma_*` (cells 100–109,
n≈505 rows / 11 profiles) and learner-side deliberation/engagement signal.
Stage 0 gains one pre-registered probe: does the existing charisma signal
predict movement of the learner's (hidden) state toward receptivity,
beyond surface-only — and reciprocally, does learner engagement predict
the tutor's charismatic uptake (Weber's *conferred* legitimacy, not
performed)? No new cells until a live stage is licensed.

## 5. Decision

Proceed with **Stage 0** — offline, zero-API, read-only on existing `main`
traces; pre-registered separability/recoverability probe **plus** the
Weber charisma↔receptivity probe. Ruthless kill: if the hidden state is
not recoverable beyond surface-only (concealment is re-encoding) **and**
charisma does not track receptivity movement, the null *is* the §6.10
result — no live run, no tune-and-retry (the §6.9.8 discipline, reused).
Full spec + frozen criteria: `ADAPTATION-PLAN-2.0.md`.
