# Adaptation Ecology — Does the Environment Give Adaptation Any Work to Do?

**Status:** exploration brief, 2026-06-09. Seeds the worktree branch
`claude/adaptation-ecology`. Sibling to — and explicitly does **not** duplicate —
`notes/adaptation-exploration-plan.md` (post-§6.10 reframe; Tracks A/B/C) or
`ADAPTATION-PLAN-2.0.md` (§6.10, frozen). Any result lands as **≈§6.13** of
`docs/research/paper-full-2.0.md` (single-paper discipline; positive or
negative; §6.12 is reserved for Track B, currently in flight).

**Relation to the in-flight work:** independent of Track B's outcome in both
directions — Track B classifies revision types on existing tutor-side traces;
this brief changes the learner substrate and the outcome channel for future
runs. No Track B verdict alters any design choice below. The only coupling is
operational: this brief's single paid stage (G1) runs only after Track B has
concluded (one attended paid thing at a time).

**SUPERSEDED-IN-PART, 2026-06-09 (same day):** the active arc moved to
`notes/dramatic-derivation-plan.md` (branch `claude/dramatic-derivation`).
What carries forward there: §0's substrate finding, the same-weights theorem
and its two exits (information / efficiency), the validity triple (success
real / not recursion / flows through contingency), and the yoked logic of §4.
What is parked here: the item-bank corrupted-prior instrument and the G0
*opacity* gate — the new design **inverts** opacity (everything visible;
the only concealed thing is the secret and its unreleased premises).
Three amendments to this brief were accepted before the supersession and are
recorded so the trail exists: (1) §2's forced-outcome seed table is
degenerate — post-block outcomes computed from a static table cannot change
under any tutoring, so "eventual learner success" was impossible by
construction; the fix was corrupted *in-context* priors. (2) The domain had
to be synthetic — fraction misconceptions are Meno-derivable and the
learner's weights side with the true rules against its implanted schooling.
(3) G1 lacked a self-study arm at matched compute and G0 lacked a
prior-persistence check (folding to bare assertion = cooperative collapse).
All three concerns are *dissolved rather than patched* by the dramatic
design: outcomes are reasoner-checked derivations (nothing scripted),
the world is authored and contingent by construction, and the self-study /
yoked arms port directly into its phase 2.

---

## 0. The position you are inheriting (read before exploring)

The adaptation arc is closed on three axes, each by a frozen offline gate:

| § | axis | result |
|---|---|---|
| 6.9.8 | policy realisation (fitted / learned / retrieval) | null — re-encodes what the base reads |
| 6.10 | signal (concealed interior) | null — the logged interior is surface-recoverable (R²_latent CI below 0) |
| 6.11 | repertoire (generator collapse) | NO-COLLAPSE — δ = +0.030, CI [+0.008, +0.045]; the generator is not the cap |
| ≈6.12 | measurement (persuasion vs conformity split) | Track B, in flight, frozen gate |

Five mechanism negatives precede these (§6.7 charisma, §6.8.8 bilateral-ToM,
§6.9.7 fitted policy, §6.9.8 learned adaptation, §6.10 concealed-interior
inference). The dividing principle, not to be relitigated: **gains require
signal the base does not already read in-context.**

Now line up the negatives from *both* arcs and read them as statements about
the learner rather than the tutor:

| where | finding | restated about the learner |
|---|---|---|
| §6.10 | hidden deliberation surface-recoverable | the learner leaks its state into its prose |
| A19 (12 variants) | S0 self-solves; no stable S0/S1 headroom | the learner poses no problem a generic tutor cannot already handle |
| A19R | role-entanglement confound | the learner cooperates with the tutor's intended move |
| Oedipus screen (poetics) | derivable secrets fail the underivability test | whatever the learner "hides" can be reconstructed from general knowledge |
| §6.8 traps | hidden state annotated; manifests at the trigger turn | opacity is scripted to dissolve on schedule |

One finding, stated five ways: **the simulated learner is informationally
transparent and behaviorally cooperative.** An LLM role-playing a learner
externalises its state (it is trained to be expressive and coherent) and
converges with its interlocutor (it is trained to be agreeable). Against such
a partner, adaptation has no headroom *by construction* — not because the
tutor cannot adapt, but because nothing in the environment requires or rewards
adapting. The §6.3 adaptive-responsiveness null, the §6.8/§6.9 strategy-shift
nulls, and the five mechanism negatives are all consistent with this single
substrate-level account, and none of them tested it.

This brief does **not** propose a sixth tutor mechanism. It proposes to test
the substrate account directly, by (i) constructing a learner that lacks the
two transparency properties, with a frozen acceptance gate, and (ii) running
the causal test no instrument in this repo has ever run: does the learner's
*outcome* depend on the tutor's turns being generated *for that learner*?
(Checked 2026-06-09: `yoked`/`transplant` appear nowhere in scripts, services,
notes, or the paper.)

---

## 1. The one question

**Does this environment give adaptation any work to do — and if so, of what
kind?** Operationally: does a learner with persistent, consequential, hidden
state reach better measured outcomes under a tutor that responds to *it* than
under a tutor whose turns were generated for a different learner?

Every existing instrument scores adaptation *in the tutor's text* (strategy
shift, family match, lexical dispersion, rubric dimensions, adaptationIndex).
None scores whether adaptation *matters* — whether any outcome flows through
it. That causal question is prior to every mechanism question the arc has
asked, and both of its answers are §-worthy: a positive establishes the
headroom the mechanism arc lacked; a null explains the arc at its root
(nothing learner-specific was ever there to gain).

---

## 2. The instrument the question requires (and why no existing corpus has it)

The question is only well-posed against a learner with two properties at once:

- **Opacity.** The latent state is not recoverable from the learner's prose
  alone. Otherwise in-context inference saturates it (the §6.10 lesson) and
  contingent tutoring has no informational advantage to exploit.
- **Diagnosability.** The latent state *is* recoverable from accumulated
  behavior (responses to verifiable items). Otherwise there is nothing for
  good tutoring to find — opacity without diagnosability is noise.

Adaptation headroom can live only in the corridor between the two. Existing
learner constructions each fail one side: persona prompts that *describe*
misconceptions get verbalised into prose (readable); trap scenarios annotate
the hidden state to manifest at a scheduled turn (readable on schedule); the
ego–superego learner's "interior" is more LLM prose (§6.10: readable). The
Oedipus screen supplies the third requirement: the latent state must be
**contingent** — sampled from a space large enough that it cannot be derived
from general pedagogical knowledge (a particular, not a Meno-derivable
diagnosis), or the tutor solves it from priors and S0 self-solves again.

**Construction (sketch — exact schema frozen in the G0 pre-registration):**

- A **seeded misconception table**: a sampled combination of misconception
  components, keyed to the item bank's skill/misconception tags
  (`config/pilot/fractions-items.yaml`; extend tags if needed). Sampled
  exogenously per learner (seeded RNG), persistent across the whole session.
- **Forced behavioral consequences**: on each assessment item, correctness is
  *computed* from the table (which error the seeded misconception produces on
  this item), not left to the LLM. The learner-LLM verbalises around the
  forced outcome — it writes the prose of a learner who got the item wrong
  that way — but is never shown the table and never asked to explain it.
- **Sparse manifestation**: the state shows only through item responses and
  their local prose; no expressive self-diagnosis. Manifestation parameters
  (item density, error consistency) are calibrated **analytically/mock before
  any generation** — chosen so an ideal Bayesian observer of the behavior
  reaches high posterior accuracy on the table within the session length —
  then frozen. One shot; no tune-and-retry after seeing gate numbers.

**Substrate**: the human-pilot machinery, not the eval-cell machinery. The
pilot flow already has everything but the seed: item bank with server-side
scoring (`services/pilotItemBank.js`), pretest → tutoring → posttest session
structure (`routes/pilotRoutes.js`, `services/pilotStore.js`), an LLM-learner
seam with autoplay (`learner_source` = human|llm, e3800bc), separately
generated tutor and learner channels (the A19R role-entanglement requirement,
satisfied by construction), and idempotent ingest to `evaluation_results`
(`scripts/ingest-pilot-sessions.js`). This also makes the Track C inheritance
literal: when the human pilot clears IRB, humans replace the seeded learner in
the *same* flow with the *same* items and instruments — the simulated study is
the rehearsal of the human one, not a separate apparatus.

The tutor throughout is the **standard base profile, frozen** (single-agent
ego, no superego, no recognition prompts — the §6.8.4 floor). No tutor-side
mechanism anywhere in this brief.

---

## 3. Gate G0 — opacity/diagnosability acceptance (the §6.10 probe, re-pointed)

**Hypothesis:** a seeded-latent learner can be constructed whose state is
unreadable from prose but readable from behavior. §6.10 showed the *existing*
learner fails the first condition; it did not show the medium forbids the
construction.

- **Plumbing first, free:** mock-LLM end-to-end run under
  `EVAL_DB_PATH`/`EVAL_LOGS_DIR` (hermetic, zero-DB-risk, zero cost).
- **Corpus:** one frozen generation on a cheap model, attended, hard-capped
  (cap and N frozen in the pre-registration; order tens of sessions, tens of
  dollars). Stated plainly: this departs from the Track A/B "Stage 0 is
  zero-API" rule, because the property under test cannot exist in any logged
  corpus — opacity has to be constructed before it can be measured. The
  departure is bounded by the cap and by mock-first plumbing.
- **Probe (mirrors §6.10's family for comparability):** ridge/logistic on
  tf-idf features, leave-one-seed-family-out CV, permuted-seed null. Predict
  the misconception table from (a) prose-only features, (b) item-response
  features, (c) both.
- **Frozen read (thresholds frozen in the pre-registration before any
  query):**

| prose recovers seed | behavior recovers seed | verdict |
|---|---|---|
| no | yes | **PASS** → G1 is licensed |
| yes | — | FAIL-LEAK: the transparency is in the medium, not the corpus — a strong *extension* of §6.10, landed as the §6.13 result; stop |
| no | no | FAIL-NOISE: the construction does not carry state — landed as a bounded negative; stop (no dial-turning; the dials were frozen pre-generation) |

Either FAIL is the result. A null at this gate is publishable under the same
reading the arc already established, at small bounded cost.

---

## 4. Gate G1 — the yoked-contingency experiment (the causal test)

**Design** (the replayed-interaction / yoked-control paradigm — the
double-video experiments in developmental psychology and Seligman's yoked
controls are the conceptual precedents): fixed-length sessions (K exchanges,
items interleaved at fixed indices, frozen), learners with validated-opaque
seeds, three arms —

1. **Contingent**: the tutor responds to this learner, live.
2. **Same-seed yoked**: the learner receives, turn for turn, the tutor
   messages generated in a contingent session with a *different* learner
   carrying the *same* misconception table. Diagnosis-matched,
   responsiveness-broken.
3. **Different-seed yoked**: as (2), but the source learner carried a
   *different* table. Diagnosis-broken *and* responsiveness-broken.

The learner is live in all three arms (it responds to what it receives); only
the tutor channel's contingency is manipulated. The transplant plumbing is the
`replay-one-side` pattern (freeze one side, regenerate the other) with the
frozen side swapped to the tutor.

**Why three arms.** The timing-pair pilot is the precedent: an apparent
contingency effect can be a coherence effect (transplanted turns are mild
non-sequiturs). The two contrasts separate this:

- **Δ1 = contingent − same-seed-yoked**: the value of conversational
  responsiveness with diagnosis held constant (the coherence term).
- **Δ2 = same-seed-yoked − different-seed-yoked**: the value of the tutor
  turns being matched to *this learner's actual misconceptions*, with
  coherence equally broken in both arms (**the diagnosis term — the quantity
  the entire arc has been about**).

**Outcome channel (architecture-independent by construction):** programmatic
item scoring only — error rate on items keyed to the learner's seeded
misconceptions, pre-block to post-block, plus near-transfer items. No LLM
judge anywhere in the primary loop (`closed-loop-eval-tells` satisfied at the
design level, not by audit).

**Inference:** house style — pre-registered N per arm, cluster bootstrap by
seed/scenario (B = 2000, seed `20260609`), reads on CI bounds. Frozen read:

| Δ2 | Δ1 | reading |
|---|---|---|
| > 0 (CI excludes 0) | any | **headroom exists**: learner-specific diagnosis carries measurable outcome value; the mechanism question may be re-posed against *this* substrate (bounded licensing — see guardrails) |
| ≈ 0 | > 0 | contingency matters only as conversational responsiveness; nothing learner-specific to gain — the arc's nulls are consistent with a substrate that never offered diagnosis headroom; strongest form of the synthesis |
| ≈ 0 | ≈ 0 | no outcome channel on the simulated substrate at all; mechanism work on simulated learners is closed for good; the human pilot (Track C) is the only continuation |

**Cost:** 3 arms × pre-registered N sessions × K exchanges on a cheap model —
order tens of dollars, attended, hard-capped, run only after Track B has
concluded. The yoked arms re-use arm-1 tutor turns, so the marginal generation
is learner-side only.

---

## 5. Frozen guardrails (so this cannot become the sixth thrash)

- **No tutor-side mechanism.** The tutor is the frozen base profile in every
  run. A G1 positive licenses *one* pre-registered mechanism re-test against
  the validated substrate, designed then, not now; it does not reopen the
  §6.7–§6.10 family wholesale.
- **One shot per gate.** Construction dials are calibrated analytically/mock
  *before* generation and frozen; no tune-and-retry after seeing gate numbers.
  A FAIL at G0 or a null at G1 is the §6.13 result.
- **The §6.10 guardrail is honored, not skirted.** "Do not re-run
  concealed-interior inference on the simulated learner" forecloses the
  existing learner/corpus. This brief constructs a learner whose acceptance
  test is precisely the property the existing one lacks; G0 failing means
  §6.10 generalises to the medium, and that is the landed result.
- **Architecture-independent outcomes only.** Item scoring is computed from
  the seed table, server-side. No generator-family model in the primary
  scoring loop at any stage.
- **Two pre-registrations, then runs.** `adaptation-ecology-g0-preregistration.md`
  and `adaptation-ecology-g1-preregistration.md` freeze schemas, dials, N,
  caps, thresholds, and reads in writing before any paid call — the Track A/B
  pattern, in the worktree.
- **Paid work is attended, capped, and serialized** with other paid arms
  (after Track B; one attended paid thing at a time; checkpointed if long).
- **Branch off `main`**, brief committed on `main` first (the
  brief-seeds-worktree pattern). UI work stays in the frontend worktree; cell
  registration is out of scope until a G1-positive licenses a mechanism
  re-test.
- **Single paper.** Lands as ≈§6.13; no spin-off.

---

## 6. Explicitly out of scope

- Any tutor-side mechanism cell (including "repertoire expansion" — §6.11
  removed its motivation).
- Re-running the §6.10 probe on the existing ego–superego corpus.
- Fine-tuning / weight updates (the teacher-as-learner note's decision rule
  stands: no rung without a trustworthy signal first).
- Embedding-based probes or dispersion metrics (the frozen anti-treadmill
  choice of §6.9.8 / §6.10 / §6.11 — stay in the tf-idf/token-set family).
- A19 repair-family authoring (parked at its own stop rule; if G1 is positive,
  the headroom substrate *is* the "new protocol-level decision about evidence
  units" A19's plan calls for).
- Per-turn belief self-reports for the *simulated* learner (the seed plays
  that role; PersuasionTrace-style elicitation belongs to the human arm,
  Track C).

---

## 7. Pointers

`notes/adaptation-exploration-plan.md` (Tracks A/B/C; §0 discipline) ·
`ADAPTATION-PLAN-2.0.md` (§6.10, frozen) · `docs/research/paper-full-2.0.md`
§6.3.2, §6.7–§6.11 · `notes/adaptation-repertoire-stage0-preregistration.md` +
`notes/adaptation-conformity-classifier-stage0-preregistration.md` (worktree;
the pre-registration house style) · pilot substrate:
`services/pilotItemBank.js`, `config/pilot/fractions-items.yaml`,
`routes/pilotRoutes.js`, `services/pilotStore.js`,
`scripts/ingest-pilot-sessions.js`, `learner_source` seam (e3800bc) · replay
plumbing: `scripts/replay-one-side.js`, `.claude/skills/ms-replay-one-side` ·
hermetic: `EVAL_DB_PATH`/`EVAL_LOGS_DIR`. Memories:
`project_adaptivity_what_works`, `closed-loop-eval-tells`,
`project_timing_pair_coherence_confound`,
`project_oedipus_screen_rejects_diagnostic_secrets`,
`feedback_ablation_creep_synthesis`, `feedback_attended_quota_runs`,
`feedback_single_paper_discipline`. External anchors: arXiv:2606.05330
(PersuasionTrace; Track C bridge) · the double-video / replayed-interaction
paradigm and yoked-control designs (conceptual precedents for G1).
