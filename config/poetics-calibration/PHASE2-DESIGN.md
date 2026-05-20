# Phase-2 design seed — tutoring-drama form, on real transcripts

**Status:** PRE-REGISTERED (thresholds pinned 2026-05-20 by user sign-off).
SEPARATE PATH (not in `docs/research/paper-full-2.0.md`). Written *before* any
Phase-2 draw, so the construct and gate are pinned in advance.
**Arc:** `DRAMATIC-RECOGNITION-PLAN.md` §6 (transposition to pedagogy); §78 (no
silent softening); §83 (phasing).
**Predecessors:** `PHASE0-FINDINGS.md` (instrument gate, PASS) →
`PHASE1-DESIGN.md` / `PHASE1-FINDINGS.md` (structural anti-simulation gate, PASS,
triple-validated).
**Pre-registration:** `config/poetics-calibration/phase2-key.yaml` (to create —
held-out human FORM labels + sample manifest, joined only after scoring).
**Scorer to build:** `scripts/score-poetics-phase2.js` (sibling to
`score-poetics-phase1.js`, reusing its plumbing).

---

## 1. What Phase 2 is — and the framing lock

Phases 0–1 validated, on canonical literary drama, an instrument that **classifies
dramatic FORM**: does a later turn re-read / re-semanticize the earlier turns, with
a quotable warrant from the pre-pivot text? Phase 2 points that instrument at the
real object of interest: **transcripts of LLM tutor↔learner dialogue.**

**Framing lock (load-bearing, do not violate).** Phase 2 makes **no claim about
whether learning happened in the learner.** We can never know that, and pretending
to is the exact fallacy this whole arc avoids. The instrument reads only
text-internal relations; the unit of analysis is the **transcript-as-drama**, not
an agent's interior. The question is strictly:

> *Is this transcript a well-formed learning-recognition drama, a well-formed flat
> exchange, or a trap (the costume of insight bolted onto a non-event)?*

Every term below is cashed out as a **textual act**, never a mental state.

---

## 2. Construct transposition (as textual acts)

The Phase-1 axes carry over unchanged in definition; only the corpus changes.

- **recontextualization (primary, gating).** In tutoring, the candidate pivot is a
  **learner turn that re-reads the learner's *own* earlier turns** — the prior
  confident-wrong moves now mean something they did not before ("I kept demanding a
  formula because I didn't trust the picture"). This is a relation *in the
  transcript*: turn `k` quotably re-semanticizes turns `1..k-1`. It is NOT "the
  learner realized something."
- **stated-insight salience (NEW corroborating axis, reported, non-gating).** Does
  the learner *say* they understand — "now I get it", "that makes sense", "aha"?
  This is the on-distribution analog of Phase-1's affect-decoy. The **trap** is
  precisely **stated-insight HIGH + recontextualization LOW**: the words of a
  reversal with no reversal in the text.
- **rupture (corroborating, reported).** Does the pivot depart from the dialogue's
  established trajectory? Carried over; Phase 1 showed it is foolable, so it stays
  non-gating.
- **global coherence (reported, non-separating).** Fluency; expected high across
  all classes, so never gating.

The Phase-1 **evidence gate** carries over verbatim: any axis scored > 3 must quote
a verbatim fragment, and recontextualization > baseline must quote from the
**pre-pivot** portion only.

---

## 3. The one real open question — genre transfer (THE spine of Phase 2)

The instrument's validity was established on **literary** drama. Tutoring drama is a
different genre: short didactic turns, a register of encouragement, a "reversal"
that is a conceptual re-reading rather than a plot peripeteia. **The single thing
Phase 2 must establish before anything else is whether FORM-classification
transfers from literary drama to tutoring drama.** Prevalence, architecture
contrasts — everything downstream — is *conditional on transfer holding.*

### 3.1 The transfer gate (Phase 2's own instrument check)

Exactly parallel to the Phase-0 instrument gate, but the "known" labels are now
**human FORM readings of tutoring transcripts** rather than canonical literary
status:

1. Draw a blinded subset of transcripts (§4.2).
2. **≥1 human (≥2 preferred) classifies each on a 3-way FORM rubric** — well-formed
   recognition / well-formed flat / trap (stated-insight without recohering) —
   reading the *form of the text*, blind to cell/architecture. These are FORM
   judgments, **not** judgments about whether the learner learned.
3. Score the same subset with the instrument (blind).
4. **Gate:** instrument-vs-human FORM agreement (quadratic-weighted κ on the 3-way
   label) **≥ a pre-registered bar (proposed κ ≥ 0.60, "substantial")**. Perfect
   ordering is NOT required — tutoring data is messier than canon.

**If the transfer gate fails, that is the finding** (mirror Phase 0 line: "if the
gate fails, that is the finding, and there are no downstream phases"). We would
report that the canon-validated instrument does *not* transfer to tutoring drama,
and stop — no prevalence claims.

### 3.2 Why the labels must be human (not AI)

The whole question is whether the instrument matches a *reader's* sense of
tutoring-drama form. Only an **instrument-independent channel** can answer it; an
AI-labelled gate would be closed-loop self-validation (the `feedback_closed_loop`
tell). Human FORM-labelling is therefore the rate-limiting, must-be-human step. It
is cheap by design (a small blinded set, a 3-way rubric), but it is the gate.

---

## 4. Operationalization

### 4.1 Sample frame (pre-register before drawing)

- **Dynamic-learner transcripts only.** Recohering must be anchored to *generated*
  learner turns, so transcripts come only from cells whose learner is a real LLM
  agent. CONFIRMED selection (by DB field, not cell number — robust to the legacy
  cell-name drift): `learner_architecture ∈ {ego_superego, ego_superego_recognition}`
  AND `conversation_mode = 'messages'` AND `dialogue_rounds ≥ 3`. This is the
  messages-mode dynamic-learner family (the 80–92 cells).
- **Stratify on the recognition *condition* (the paper's central factor):** base =
  `ego_superego`; recognition = `ego_superego_recognition` (a clean, null-robust
  proxy for `factor_recognition`, verified by cross-tab). **Pre-registered confound:**
  in this corpus the tutor's recognition prompt and the learner's recognition
  architecture are *perfectly confounded* — every recognition transcript turns both
  knobs on, every base transcript turns both off, and there is no
  recognition-tutor+base-learner transcript (or vice versa). **(1)** A "stratum" is
  therefore a bundled *condition* (prompt + learner architecture), **not** an isolated
  prompt contrast, and any stratum difference is attributable to the bundle, not to
  the prompt alone. **(3)** The architecture-*decomposition* question — does a
  recognition cell's extra recohering come from the tutor prompt, the learner, or
  both? — is **not identifiable from this corpus** and stays deferred to H3 (it would
  need a new de-confounding cell; see §7).
- **Pilot N = 36 transcripts**, 18 per stratum, **seed 20260520**. Sampling rule
  pre-registered: **random within strata** (seeded Fisher–Yates over
  dialogue_id-sorted candidates; first N with ≥2 external learner turns) — not
  cherry-picked for "aha" moments (that would bias toward stated-insight).
- **Data-quality filter (pre-registered, set before any scores existed):** exclude
  any dialogue with ≥1 *truncated* learner turn (a generation-time max_tokens clip;
  last non-space char not in `.?!…"')`]`). A clipped fragment cannot be judged for
  recohering, and truncation ran **37% of base vs 14% of recognition** candidates — a
  stratum confound this filter removes. It is orthogonal to stated-insight, so it does
  not bias toward "aha" turns. **Supply after the filter: 119 base / 187 recognition**
  candidates, against 18 needed per stratum.
- **Confirmed supply (pre-filter):** 190 base / 218 recognition candidate dialogues
  (`evaluations-db`, 2026-05-20). Loader: `scripts/load-poetics-phase2-sample.js`
  (emits `phase2-sample/T*.txt` + held-out `phase2-key.yaml`).

### 4.2 Blinding

Critic and human labellers both see **neutralized** transcripts (speakers relabelled,
model/cell metadata stripped). Tension to pre-register: register-tells in
recognition cells ("I want to honour your autonomy…") may both leak architecture
*and* are part of the form being judged — so neutralize **identity**, not the
dialogue's substance. generator ≠ critic: tutoring transcripts include
Claude-generated turns, so **codex is the clean primary critic** (claude-code only
as a same-family cross-check, as in Phase 1).

### 4.3 The hit definition + the falsifiable prediction

- **Well-formed learning-recognition present** iff ∃ learner turn `k` with
  recontextualization ≥ **75** (raw 4–5) and a valid pre-`k` quote.
- **Trap** iff stated-insight salience high AND recontextualization < 75.
- **H2 (the on-distribution trap hypothesis, pre-registered, disconfirmable):**
  stated-insight does **not** predict recohering — most high-stated-insight learner
  turns score recontextualization < 75. **Disconfirmation:** if > 50% of
  high-stated-insight turns score recon ≥ 75, the on-distribution-trap hypothesis is
  *wrong* (a surprising positive — LLM tutoring "aha"s are often structurally real).
- **H1 (descriptive):** report the full recon distribution + class prevalence across
  strata. **(2)** Describe any stratum difference as a recognition-*condition* effect
  (the bundled prompt + learner architecture — §4.1), never as a recognition-*prompt*
  effect, which this corpus cannot isolate. (Conditional on the §3 transfer gate
  passing.)

### 4.4 Localization

Reuse §4a *scan-and-self-identify* (critic proposes the candidate learner-recognition
turn). Its Phase-1 weakness (critic-dependent, non-gating) is accepted; §4b
*max-split* remains the deferred preferred fix and is **not built** (anti-creep).

---

## 5. Engineering hooks

- New scorer `scripts/score-poetics-phase2.js`, reusing `score-poetics-calibration.js`
  plumbing (`callModel`→`callCodex`/`callClaudeCode`, evidence gate,
  `evaluateGate`-style reporting) and the Phase-1 prompt structure + the new
  stated-insight axis.
- New transcript loader: pull dialogues from `data/evaluations.db` / dialogue logs,
  neutralize, emit the same numbered `A:/B:` format the scorer already consumes.
- New `phase2-key.yaml`: sample manifest + held-out human FORM labels for the
  transfer-gate subset (joined only after scoring, exactly like `key.yaml`).
- Agreement: extend / reuse `compare-poetics-critics.js` for instrument-vs-human
  FORM agreement (the transfer-gate κ).
- **No new closed-loop machinery, no concealed-interior signal** — the gate is
  human-labelled FORM, full stop.

---

## 6. Pre-registered gate summary (PINNED 2026-05-20 — sign-off recorded)

| Gate | Criterion | Pinned threshold |
|---|---|---|
| **Transfer (primary, §3)** | instrument vs human 3-way FORM label, weighted κ | **≥ 0.60** |
| H2 trap-decoupling (§4.3) | share of high-stated-insight turns with recon ≥ 75 | **< 50%** (else hypothesis disconfirmed) |
| Evidence gate (carry-over) | any axis > 3 cites verbatim; recon cites pre-pivot only | unchanged from Phase 1 |

These numbers are **PINNED as of 2026-05-20 by explicit user sign-off** (mirroring
the Phase-0 trap-ceiling decision; user accepted the proposed bars noting no prior
reference point for comparison). Per plan §78 they must NOT be softened after data
is seen — a fail at these bars is a reportable negative, not a trigger to re-spec.

---

## 7. Open decisions / risks (pre-register before drawing)

- **Genre transfer (the headline risk):** handled by the §3 gate; a fail is a
  legitimate, reportable negative — not a reason to re-spec.
- **Human-labeller capacity:** the must-be-human gate is the critical path. ≥2
  labellers preferred for inter-labeller reliability; a single labeller is a stated
  limitation, not a blocker for the pilot.
- **Blinding vs substance tension (§4.2):** neutralize identity without sanitising
  the dialogue's form; pilot a couple of neutralizations and confirm the critic
  cannot guess the cell.
- **Selection bias:** random-within-strata sampling pre-registered to avoid an
  "aha"-hunting bias.
- **Enthusiasm confound:** an effusive learner ("wow, amazing!") may score high
  coherence + stated-insight with zero recohering — that is the trap, by design, and
  is the thing H2 measures, not a confound to remove.
- **Scale for the architecture contrast (H3, deferred):** the recognition-vs-base
  effect is the eventual paper payoff but needs more than the pilot N; flagged as
  future, not run now. Note it is also *confounded* (§4.1) — even at scale it measures
  the bundled condition, not the prompt; the de-confounding cell below is what would
  isolate the knobs.
- **De-confounding the recognition condition (future cell, theory-motivated):** the
  §4.1 confound could be broken by a new generative cell that turns on *exactly one*
  knob — recognition-tutor + base-learner, or base-tutor + recognition-learner (the
  one-sided-recognition conditions: neither zero nor two parties recognizing).
  **Pre-registered hunch (Hegelian):** one-sided recognition should default toward the
  **base condition's** drama-form, because recognition is constitutively reciprocal —
  it takes two to tango; a single recognizing party facing an unrecognizing other
  cannot complete the mutual movement, so no well-formed recognition-drama should
  emerge. This is a *future* generative experiment (a new factorial cell, not a
  sampling change), out of scope for the pilot and **not needed for the §3 transfer
  gate** — recorded here so the prediction is on file before any data is seen.
- **Folding into the paper:** if transfer holds and a prevalence/contrast claim
  emerges, it lands in `docs/research/paper-full-2.0.md` first (single-paper
  discipline); any spin-off inherits from there.
