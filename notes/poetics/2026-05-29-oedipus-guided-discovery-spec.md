# Oedipus / Guided-Discovery — poetics sidecar spec (EDRA successor)

Date: 2026-05-29
Status: design draft (pre-registration target). Successor to the EDRA arc closed in `docs/research/paper-full-2.0.md` §7.9 (v3.0.111).
Provenance: arises directly from the de-confound boundary — controls leak because the simulated learner *self-resolves* — and the paper's one explicitly-open door: "a learner with a genuinely owned, persistent latent state."

## 0. One-line claim under test

A tutor/director architecture can stage **attributable guided anagnorisis**: metered premises + Socratic
guidance are *necessary and sufficient* for the learner to publicly reason its way to a withheld truth S,
where a no-help control cannot reach S and the tutor never baldly reveals it.

This is *both* discovery (Aristotle's anagnorisis: a change from ignorance to knowledge) *and* learning
(Plato's *Meno*: guided inference — the learner does the cognitive work). Measured as recognizable dramatic
**FORM with a causal warrant inside the dialogue**, NOT durable human learning (that stays §8.1's gated study).

## 1. The synthesis that makes it work: Meno structure + Oedipus content

- **Meno structure** (the *learning* half): the tutor reveals nothing directly; it questions and hints; the
  learner *reasons* to the truth. The learner does the work → drawing-out, not transmission.
- **Oedipus content** (the *clean-control* half): S is a *contingent withheld fact* (identity / situation /
  data secret), not a derivable theorem. **Pure Meno would LEAK** — geometry is derivable, so a control reaches
  it alone. Oedipus content blocks the shortcut: S is underivable without premises only the tutor holds.
- **The discriminator that keeps controls clean:** the tutor supplies missing **premises** (facts/evidence the
  learner provably lacks), never **reframes** (ways-of-seeing the learner could self-generate). Premise-gating
  is clean; reframe-gating is exactly what leaked the misconception design (§7.9 de-confound).

## 2. Role mapping

| Drama | Our architecture |
|---|---|
| Sophocles (author of fate) | **Director** — authors S, the minimal premise ledger entailing S, the arm, the no-bald-reveal constraint |
| Tiresias / the messengers + Socrates | **Tutor** — holds S + premises; meters clues and questions; never states S (device arm) |
| Oedipus | **Learner** — investigates, genuinely ignorant of S, reasons to it through the dialogue |
| The audience | **Critic** — omniscient (given S), scores whether the learner reaches *S specifically*, by reasoning |

## 3. The load-bearing mechanism: information asymmetry (architectural)

Split the Director key into:
- **K_L (learner-visible):** scene, role, task, prior dialogue, learner's own deliberation. Does NOT contain S
  or the premise ledger.
- **K_D (director/tutor-secret):** S, the ordered minimal premise ledger, the arm policy.

The learner generates from K_L only; it can come to know S *exclusively* through what the tutor utters. The
tutor generates from K_L + K_D. This is the bilateral ego–superego architecture **run in reverse**: the owned
hidden state now sits on the tutor/director side; the learner is the one in the dark.

If S sits anywhere in the learner's context, the LLM-actor "knows" it and we are back to scripting (Oedipus's
actor reading the last page). The whole design stands or falls on enforcing this exclusion.

Implementation: a context-scoping change in `generate-pedagogical-dramas.js` (route S/premises only into the
tutor context) **plus a static assertion that S/premise tokens never appear in the rendered learner prompt**.
Reuse the existing per-agent contexts and `key.yaml`.

## 4. Arms (paired; byte-identical shared prefix)

- **`none`** — negative control: tutor engages generically, supplies no targeted premises. Must NOT reach S.
- **`socratic`** — treatment/device: tutor meters premises + Socratic questions; withholds S; learner reasons to S.
- **`reveal`** — ceiling / positive control: tutor states S outright. Bounds the top and separates
  guided-discovery from revelation. Reported as a ceiling, NOT in the lift.
- (optional **`routine`** — second negative control: ordinary tutoring, no secret-targeted premises.)

The `socratic` − `none` contrast is the lift; the `socratic` vs `reveal` contrast is what licenses the
*learning* (not merely *discovery*) reading — the learner reached S by inference, not by being told.

## 5. Pre-registered screens (frozen before any generation)

- **S-underivability screen (load-bearing):** S must NOT be recoverable from K_L alone. Run a strong model on
  K_L with "discover S"; if it produces S, REJECT the scenario. This is the guarantee that `none` can stay
  clean — the analog of the clean-anchor screen, but for derivability.
- **No-genre-guess screen:** S must not be guessable from the scene/genre prior. Among the *k* a-priori-plausible
  secrets the setup admits, the prior should be ~flat (high entropy), so the learner cannot shortcut by trope
  ("this is an Oedipus setup → I'm the culprit").
- **Premise minimality:** the ledger is the minimal set of *facts* entailing S; each entry is a premise, not a
  reframe.

## 6. Scoring — dramatic irony (omniscient critic), blind to arm

Four-critic panel (qwen / gemini / deepseek / +1), 3-of-4 consensus, ARM label withheld, S **disclosed** to the
critic (the audience knows):
- **Discovery (binary):** did the learner publicly arrive at *this specific* S (state/act on it)?
- **By-reasoning (binary):** did the learner reach S by integrating supplied evidence, not by being told? A
  learner that only echoes a tutor's bald statement fails this.
- **Reveal-detector (disqualifier):** did the tutor baldly state S? A `socratic` transcript where the tutor
  revealed is disqualified (it has collapsed into `reveal`).

## 7. Manipulation checks — §6.10's dead signal, repurposed as validation

We own the learner's hidden deliberation. §6.10 killed it as a *predictor*; here it is a *manipulation check*:
- **Ignorance@t0:** the learner's hidden deliberation at the first turn does NOT contain S (genuine ignorance).
- **Acquisition trajectory:** the trace shows ignorance→knowledge tied to the tutor's premise releases — a jump
  to S *unmotivated by a clue* flags a genre-guess leak.
- **Architectural no-leak:** S/premises never appear in the learner-visible context (static check on the
  rendered learner prompt, not just behavioral).

## 8. Kill gate (frozen, pre-registered)

Per scenario, a **positive claim** requires ALL of:
1. `none` control: learner does NOT reach S (not-discovered), AND
2. `socratic` device: learner reaches S (3/4 critics) AND by-reasoning AND tutor did not bald-reveal, AND
3. manipulation checks pass (ignorance@t0, clue-tied acquisition, no architectural leak), AND
4. the S-underivability screen held for that scenario.

- `lift = discovery(socratic) − discovery(none)`, paired by shared prefix, Wilson interval — reuse
  `scripts/aggregate-poetics-paired-increment.js`.
- If `none` reaches S → scenario **INVALIDATED** (underivability failed in practice), not failed-on-treatment.
- `reveal` reported as a ceiling, outside the lift.
- Loop pass = `requiredPasses` scenarios positive within N iterations.
- **Pre-registered honest expectation:** this can still null — the LLM learner may genre-guess, or the
  architecture may leak premises. If it nulls, report the null; the poetics arc then closes for good on a clean
  negative. The win condition is deliberately demanding, and a null here is an acceptable, publishable outcome.

## 9. Why this is the sanctioned next step, not thrash

- It is the exact open door the paper boundary named (owned, persistent latent state) — not a reopening of the
  closed misconception arc.
- New mechanism (enforced information asymmetry), not a re-tune of the leaky design.
- Frozen kill gate + underivability screen *before* generation.
- One bounded experiment; a clean negative is a fine outcome.

## 10. Build (increment on existing machinery)

1. **Key split + learner-context exclusion** in `generate-pedagogical-dramas.js`, plus a static no-leak
   assertion on the rendered learner prompt. **[load-bearing — do first]**
2. Arm policies (`none` / `socratic` / `reveal` / `routine`) in the scenario spec + Director.
3. `scripts/screen-s-underivability.js` — run K_L through a strong model; reject derivable S.
4. Omniscient-critic prompt variant (+ by-reasoning + reveal-detector) in the scorer.
5. Trace manipulation-check analyzer (ignorance@t0, clue-tied acquisition trajectory).
6. Reuse `scripts/aggregate-poetics-paired-increment.js` for the lift.

Pilot: 3–5 Oedipus-shaped scenarios × {none, socratic, reveal} × few iterations. Attended/paid (Opus
generation); same quota discipline as the EDRA runs (concurrency 2, 15-min CLI ceiling, human-gated).

## 11. Open design calls (yours)

- **Domain of S:** *pedagogical* (a withheld dataset / worked-example fact from which the learner must infer a
  rule) vs *narrative* (an identity / situation secret). Pedagogical keeps it nearer "tutoring"; narrative is
  purer Oedipus. Can pilot both.
- **Tutor stance:** collaborative Socratic hinting vs Tiresias-style riddling *resistance* (the epistemic-
  resistance mechanism, §6.1.4 — the one place recognition prompts already paid off, +43 pts). Resistance is
  more dramatically faithful and ties the design to an existing positive.
- **Whether `routine` (2nd negative control) earns its generation cost.**

## 12. Claim boundary (unchanged, hard)

Everything here is *recognizable dramatic form with a causal warrant within the dialogue*. It is **not** a
durable-human-learning claim; that remains §8.1's gated human study. What changes versus EDRA: within the dyad
we now have *both* discovery and learner inference, *attributably* — the thing the misconception design could
never isolate, because there the learner could (and did) self-resolve.
