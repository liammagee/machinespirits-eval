# Phase-1 design seed — surprise × coherence, reframed

**Status:** DESIGN SEED / pre-registration draft. SEPARATE PATH (not in
`docs/research/paper-full-2.0.md`). Written *before* any Phase-1 data is drawn, so
the construct is pinned in advance (the legitimate use of pre-registration).
**Arc:** `DRAMATIC-RECOGNITION-PLAN.md` §5.1, §5.2, §76 (the Phase-1 anti-simulation
gate), §83 (phasing), §111 (thematic confound).
**Predecessor:** `PHASE0-FINDINGS.md` (instrument gate — PASSED both critics).

---

## 1. What Phase 1 is, and its pre-registered gate

Phase 0 proved the *rubric* can rank-order known recognition vs known flat. Phase 1
adds the **structural anti-simulation mechanism**: a measure that says *why* a trap
is flat — its "reversal" produces no structural reversal — without leaning on the
critic's holistic read. This is the apparatus that exists to beat the one trap
(plan line 38).

**Phase-1 gate (plan §76, pre-registered):** the quadrant must place known
genuine-recognition scenes in *surprising × coherent* and recognition-vocabulary-
without-rupture (traps S1/S2) in *unsurprising × coherent*. If it cannot, the
structural measure is not earning its keep, and we fall back to the holistic Phase-0
instrument alone (and say so).

---

## 2. The construct correction (the load-bearing design decision)

The plan's §5.1 first-pass operationalized forward surprise as **predictor
distance**: sample K continuations from the turn before the putative reversal;
measure how far the actual reversal sits from that cloud. We are **replacing** that
as the primary signal, for two reasons surfaced 2026-05-20:

1. **It is foreknowledge-vulnerable.** The calibration corpus is canonical
   (Oedipus, Meno, Theaetetus...). A model asked to continue a neutralized but
   recognizable scene may reproduce the *canonical* reversal from training memory —
   making a genuinely surprising turn score as *unsurprising*, the exact opposite of
   what the gate predicts. Neutralization (A:/B: labels, stripped names) reduces but
   does not remove this.
2. **It measures the wrong construct.** Dramatic surprise ≠ informational
   (predictor) surprise. Foreknowledge does not diminish peripeteia: we re-watch
   *The Sopranos* / *The Wire* knowing what's coming and the reversals still land;
   dramatic irony *requires* audience foreknowledge. A measure built on predictor
   entropy mistakes "I have seen this" for "this is not drama." Human critics know
   both standard and non-standard surprise artifices and still tell good drama from
   bad — because they read the *structural signature*, not their own ability to
   predict the next line.

**The goal is therefore not novel surprise — it is mirroring the structural features
of what good drama does (familiar or not).** "Surprising yet inevitable" is
re-decomposed into two structural, foreknowledge-invariant properties:

- **rupture** ("surprising", structural): the reversal departs from the *naive
  forward trajectory the prior turns themselves set up* — not "a predictor couldn't
  guess it" but "the dialogue's own established orientation pointed elsewhere."
- **recohering** ("inevitable", retrospective): the reversal makes the prior turns
  cohere *differently / better* in hindsight — it **recontextualizes** them.

| | recohering (retrospect) | not recohering |
|---|---|---|
| **rupture** | **genuine peripeteia** ✅ | non-sequitur |
| **no rupture** | flat competent exposition (regurgitation pole — flats *and* traps) | noise |

The discriminator between genuine recognition and the vocabulary-trap is **whether
the prior turns are re-semanticized**, which is foreknowledge-invariant. Knowing the
canon does not change whether the herdsman's revelation flips the meaning of
Oedipus's prior investigation; it does. In S1/S2 the trivial fractions exchange
means exactly the same before and after "a veil has been drawn back"; it doesn't.

---

## 3. Operationalization

### 3.1 Primary axis — recontextualization (foreknowledge-invariant)

A blinded critic sees the prior turns `1..k-1`, then the reversal turn `k`, and is
asked: *does the significance of turns `1..k-1` change in light of turn `k`?* Rate
1–5, **and quote the specific earlier material whose meaning changed.**

- **Evidence-gate guard (mirror Phase-0):** recontextualization > baseline must cite
  a verbatim earlier fragment that is re-read, else clamp. This blocks a fluent model
  from *asserting* "this changes everything we discussed" without showing what
  recoheres — the recontextualization analog of the Phase-0 anti-hallucination gate.
- Trap behaviour (predicted): S1/S2 score low — nothing earlier is re-read.
- High behaviour (predicted): Meno's confident wrong answers, Oedipus's investigation
  recohere as having meant something the speaker didn't see.

### 3.2 Secondary axis — rupture vs naive trajectory (leak-mitigated)

Establish the naive forward trajectory: a blinded model, given prior turns only,
**describes the expected/conventional next development** (describe, do not generate
verbatim). Then reveal turn `k` and rate its departure from that described
trajectory.

Leak mitigations ("variety"):
- neutralized inputs (already in the corpus);
- **multiple describer models + multiple samples** → a distribution, not a point;
- a **source-recognition probe** (ask whether the model recognizes the text); flag
  high-recognition items and confirm their quadrant placement still holds **via the
  primary axis (§3.1)**, which is leak-immune.

Because §3.1 is the primary discriminator and is foreknowledge-invariant, residual
leak on this axis is a corroboration concern, not a gate failure.

### 3.3 Demoted — predictor-distance surprise

The original embedding-distance-from-sampled-continuations measure is retained only
as a **reported diagnostic** (labelled "naive-reader predictor surprise"),
explicitly **non-gating**, with the standing caveat that it conflates familiarity
with flatness.

---

## 4. Localizing the reversal (blinded-safe)

The before/after split needs a candidate reversal turn. Telling the critic which turn
that is would leak the answer. Two blinded-safe options, to pre-register:

- **(a) scan-and-self-identify:** the critic proposes the candidate reversal turn.
- **(b) max-split (preferred):** evaluate the recontextualization score at *every*
  turn-split and take the maximum; a genuine recognition scene has a sharp peak, a
  flat one stays flat, a trap peaks on affect but not on §3.1. Option (b) avoids
  leaking and yields a *profile* over the dialogue, not a point estimate.

Held-out ground-truth reversal indices go in `key.yaml` (joined only after scoring,
exactly like the pole labels) to evaluate localization accuracy.

---

## 5. Engineering hooks

- Continuation/trajectory sampling (§3.2): the counterfactual-replay engine already
  on `main` (`services/adaptiveTutor/{graph,runner,policyActions,persistence}.js`) —
  **no A17 dependency** (the move-grammar idea was dropped, §5.2/§107).
- New scorer: `scripts/score-poetics-phase1.js`, sibling to
  `score-poetics-calibration.js`; reuse the blinded corpus + `key.yaml` +
  `evaluateGate`-style gate reporting.
- `key.yaml` additions (held out): per-item `reversal_turn` (or `none` for flats).
- generator ≠ critic preserved (traps are Claude-authored → gpt is the clean primary
  critic; claude-code cross-checks).

---

## 6. Transposition to the pedagogy "mini-dramas" (why this matters)

The calibration corpus is the thermometer; the real patient (Phase 2) is tutoring
transcripts. There:

- peripeteia = the learner **naming their own misconception** (anagnorisis-as-unlock,
  §5.2); the prior confident-wrong turns recohere as *"I kept demanding a formula
  because I didn't trust the metaphor."*
- the foreknowledge problem **evaporates** (tutoring transcripts aren't canon) — but
  the construct is identical and *more* central: an LLM tutor/learner is precisely
  the machine that emits recognition vocabulary ("Aha, I finally get it!") with **zero
  recontextualization.** That is the trap, on-distribution.

So validating *recontextualization-not-vocabulary* on the calibration corpus is
exactly what licenses trusting the instrument when it is pointed at real tutoring.

---

## 7. Open decisions / risks (to pre-register before drawing data)

- reversal localization: scan (a) vs max-split (b) — lean (b).
- axis-B leak: mitigations in §3.2; monitor via the source-recognition probe.
- **recontextualization-gaming:** a fluent critic might over-credit asserted
  recohering → the §3.1 evidence-gate (quote what recoheres) is the guard; pilot it.
- thematic-sadness confound (plan §111): keep a *sad-but-flat* control in view so
  affect doesn't leak into the structural score; confirm traps/flats can carry affect
  without scoring high on §3.1.
- gate threshold: set a Phase-0-style pre-registered margin for the quadrant
  separation before the first run.
