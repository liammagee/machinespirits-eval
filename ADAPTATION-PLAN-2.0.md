# Adaptation Plan 2.0 — Modelling the Concealed Interior

Status: proposal, 2026-05-17. Author-of-record: user request (verbatim
intent recorded below) + this analysis. Sibling to, and successor of,
`LEARNED-ADAPTATION-PLAN.md` (which closed null as paper §6.9.8).

Provenance: synthesis across the full arc paper v2.3.21 (11 Mar 2026,
arXiv-prep) → v3.0.84 (17 May 2026). Memories: `adaptivity-what-works`,
`adversarial-superego-v3-result`, `closed-loop-eval-tells`,
`adaptive-persona-prototype-verdict`, `feedback_ablation_creep_synthesis`,
`feedback_single_paper_discipline`.

## 0. The user's standing request (recorded verbatim-in-intent — it matters)

After `LEARNED-ADAPTATION-PLAN.md` closed the *fifth* convergent negative,
the user asked: prompt-hacking / multiagent-review / state-machine /
fitted-policy all show limited promise, but "the solution is out there —
what are we missing?" Three theoretical leads offered: (a) the rubric
itself, used *dynamically* to revise prompts / agent config / transcript
memories; (b) a deeper theory of mind — acknowledge the learner has the
*same depth of interiority we do*, and cater to it empathetically (Hegel /
Freud / Weber); (c) lean further into the state machine, but as an
*ever-growing ontology / theory of the world*, not a progress tracker.
Hard constraints: **no ablative thrashing**; mine our own negatives; mine
the theoretical coordinates; crack "machine learning" with *depth*, not
GPU/token brute force. One principled new arc of cells/prototypes is
sanctioned; a sweep is not.

## 1. The diagnosis the negatives actually license

Five convergent negatives (§6.7, §6.8.8, §6.9.7, adaptive-persona,
§6.9.8) share one shape: each **re-encoded what the strong base model
already infers in-context from the surface transcript** (persona / state
vector / evidence log / fitted policy). The one decisive positive
(adversarial superego, 20→85) added a **perspective the generator does
not produce about itself**. Dividing principle (sharpened from
`adaptivity-what-works`): gains require signal the base does *not* already
read — not a richer restatement of what it does.

Where is unread signal? The RLHF base reads the learner **at face value**
(sycophancy / agreeableness bias). The v1 trap suite is *built from* cases
where the truthful reading diverges from the surface utterance
(`polite_false_mastery`, `false_confusion`, `affective_shutdown`,
`epistemic_resistance`, `answer_seeking_to_productive_struggle`) — the
learner is *concealing*. The base is systematically wrong here, in a known
direction. And this project **uniquely owns the ground truth**: the
learner is a full ego–superego agent; only `learner/final_output` is
externalised; the hidden `learner_ego_initial / learner_superego /
learner_ego_revision` deliberation is *in our logs* and the tutor never
sees it. That discrepancy (manifest vs. latent) is new signal in the
strict empirical sense **and is offline-checkable against the real hidden
trace**.

Theory maps onto mechanism, not decoration: Hegel — recognition = the
other's interior is not given to me (bilateral-ToM flattened it: the
*opposite*); Freud — manifest vs. latent, the trap is the defense, address
the defense not the sentence; Weber — authority is legitimate only as
conferred by the other's interior (charisma §6.7 failed because it
*performed* legitimacy).

## 2. The mechanism (exactly one)

A **concealment-inference** step, ephemeral by design:

1. Before each tutor move, the tutor produces an explicit hypothesis of
   the learner's **latent state and what is being withheld**, *structurally
   conditioned to diverge from the face-value reading* (prompt forces the
   "what if the surface is a defense?" branch the base suppresses — the
   adversarial-superego principle, generalised from the draft to the
   reading-of-the-other).
2. The move is generated *against that hypothesis* (address the inferred
   concealment, not the literal utterance).
3. An **independent** rubric-critic — a *different channel* from the
   generator (different model, or the architecture-independent judge) —
   scores the move on the existing rubric. This is proposal (a), correctly
   scoped: rubric as **external normative critic in the loop**, NOT as a
   fitted-policy target (that was §6.9.8, already null).
4. The hypothesis is **consumed and discarded each turn** — never an
   accumulating state object. This is the single design line that
   separates it from §6.8.8 / §6.9.7 / the persona machine. Proposal (c)'s
   "ever-growing ontology" is **explicitly out of scope** unless §3 Stage 1
   passes; if it does, the natural composition is a *jointly negotiated*
   world-model whose tutor↔learner *divergence* is the signal.

### 2a. Weber channel — charisma→receptivity *uptake* (measurement, not a second mechanism)

Following Weber, accuracy about the concealed interior is necessary but
not sufficient: the move must *shift* the learner toward the normatively
desired state (receptive, not resistant). So the plan carries a
**bidirectional uptake channel** alongside the inference: (i) tutor
charisma → movement of the learner's (hidden) state toward receptivity;
(ii) learner engagement → the tutor's charismatic uptake (Weber's
legitimacy *conferred by the other*, not performed — the failure mode of
§6.7's id-director, which performed charisma without tracking its uptake).
This is **not a new mechanism arm and not a new cell sweep**: it reuses the
already-computed `tutor_charisma_*` signal (the Weber-derived 8-dim
`config/evaluation-rubric-charisma.yaml`, cells 100–109, ≈505 rows / 11
profiles) and an existing learner-side receptivity proxy. A 2026-05-17 feasibility
probe found the existing charisma corpus (cells 100–109) is **scripted-
learner, tutor-only scored** (≤38/505 rows with any learner score, 0 with
interiority) — so the uptake claim is **not** zero-API testable now, and
that absence is itself the finding (the §6.7 arc never instrumented the
other's uptake — see §3/P2). The channel therefore enters as a
**pre-registered live dimension at Stage 1** (scored *alongside* the
concealment cell against an `ego_superego` learner), not as a Stage 0
probe and not as a weaker tutor-only proxy — zero new cells of its own.

## 3. Stages, each a ruthless kill gate (LEARNED-ADAPTATION discipline)

**Stage 0 — offline, zero-API, read-only on existing `main` traces. A
necessary-condition gate, pre-registered before looking.**

The full mechanism (a concealment-prompted *reading*) needs API; running
it is Stage 1. Stage 0 tests the **necessary condition that makes the
mechanism even possible** — and it is decidable for free on data already
on `main`. We have, per `ego_superego`-learner dialogue, both the
externalised learner turn *and* the hidden `learner_ego_initial /
learner_superego / learner_ego_revision` deliberation. Two frozen probes:

- **P1 — separability of the concealed interior.** Define the
  concealment target from the logged hidden trace (e.g. the
  divergence between `learner_ego_initial`/`learner_superego` content and
  `learner/final_output`, and superego concealment/face-saving flags).
  Fit the *simplest* models predicting that target from (a) **surface-only
  features** of the externalised dialogue vs (b) surface **plus** a
  cheap structured "is-the-surface-a-defense?" feature set. Grouped CV by
  `scenario_type`; cluster bootstrap by `scenario_type`. **Pre-registered
  pass:** the concealed-interior target carries variance **not recoverable
  from surface-only** (lower 95% CI of the recoverability gap > 0). If the
  hidden trace is essentially surface-determined, a concealment mechanism
  is provably re-encoding — **STOP**.
- **P2 — Weber charisma→receptivity uptake. NOT zero-API testable on the
  existing corpus — and the reason is itself a finding.** Feasibility probe
  (2026-05-17): all charisma cells (100–109) were run with **scripted
  `unified` learners** and scored **tutor-only** — of 505 charisma rows,
  ≤38 carry *any* learner-side score and **0** carry learner interiority or
  a receptivity index. The Weber "conferred legitimacy" claim
  (charisma is legitimate only as taken up by the other) was therefore
  **never measurable in the §6.7 arc by construction**: the id-director
  corpus instrumented the *performance* of charisma and not its *uptake*.
  That is the concrete answer to "why have we not realised charisma's
  potential" — not under-analysis of existing data, but a corpus that
  never recorded the other side. P2 is consequently **deferred to Stage 1**
  (charisma's 8 Weber dimensions scored *alongside* the concealment cell
  against an `ego_superego` learner, so uptake is observable), pre-
  registered there. It is **not** silently run as a weaker tutor-only
  proxy.

**Kill rule (frozen):** Stage 0 hinges on **P1 alone** (P2 is structurally
deferred, above). If **P1 fails** (the concealed interior is recoverable
from surface-only → a concealment mechanism is provably re-encoding) → the
null *is* the §6.10 result: the §6.7/§6.8.8/§6.9 motif now stated over the
*signal* axis too (and the P2 corpus-gap finding is reported as the reason
the Weber lever was never realised). No Stage 1, no live run, no
tune-and-retry. If **P1 passes** its frozen bar, the concealment arm earns
Stage 1, and P2 rides with it as a pre-registered live dimension. (Mirrors
§6.9.8's offline gate exactly: a null that closes the question for free is
the result, not a failed experiment.)

**Stage 1 — paired counterfactual (only if Stage 0 passes).** Same
scenario, move-on-surface vs. move-on-inferred-concealment, scored on the
*same* §6.8/§6.9 architecture-independent instruments (binary
`strict_shift` claude-code/sonnet + 4-dim graded GPT-5/codex). No new
evaluator built. The difference must be *caused by* the concealment
channel, paired within scenario.

**Stage 2 — one pre-registered live cell (only if Stage 1 passes).**
Fitted-mechanism cell vs `cell_110` (implicit base) vs `cell_126` (A14
hand-authored), v1 trap suite, identical Stage-5 instruments — directly
comparable to §6.9.7 / §6.9.8. Pre-register the gate before looking.
~\$30–60 / ~16–32h envelope.

## 4. Guardrails (frozen up front so this cannot become creep)

- **One mechanism.** Not a sweep of "concealment variants".
- **Charisma is a measurement channel, not a second mechanism.** The Weber
  probe (§2a/P2) reuses already-computed `tutor_charisma_*`; it adds **zero
  new cells and zero API** at Stage 0. It earns a live scored dimension
  only if P2 clears its frozen bar.
- **Stage 0 is necessary-condition only.** Passing P1/P2 licenses Stage 1;
  it is *not itself* evidence of a pedagogical effect (that is the
  architecture-independent live instruments at Stage 2). Failing closes the
  arc for free.
- **Ephemeral inference.** The hypothesis never accumulates into state —
  the moment it does, it is the §6.8.8 trap; that is the kill condition,
  not a tuning knob.
- **Independent critic or dead on arrival.** If the rubric-critic shares
  the generator's channel it is a closed-loop tell (`closed-loop-eval-tells`)
  — Stage 0 must use the architecture-independent channel.
- **Offline gate is ruthless and free.** Fails Stage 0 → the null is the
  result; no live run, no Stage 1/2, no tune-and-retry branch.
- **Single paper.** Lands as **§6.10** of `docs/research/paper-full-2.0.md`,
  positive *or* negative — no spin-off (`feedback_single_paper_discipline`).
- **Prototype vs. branch:** branch off `main` (A14/§6.9.8 precedent — the
  branch paradigm produced publishable results; isolated prototypes did
  not). Stage 0 is read-only on existing traces.

## 5. Why this is not the sixth thrash

It is the *only* lever that adds signal the base does not already read
(every prior one re-encoded); it is the generalisation of the *one thing
that worked* (independent opposition); it exploits an asset unique to this
codebase (we own the learner's hidden deliberation as offline ground
truth — no prior mechanism was offline-falsifiable this way); and its
first gate is free. A null here is the genuine close of the adaptation
question — "even modelling the concealed interior, with the one signal the
base provably lacks, does not pay" — which is a *stronger* paper sentence
than §6.9.8, not a repeat.

## 6. Stage 0 result — FROZEN GATE FAILED → arc closes as §6.10 (recorded 2026-05-18)

`scripts/adaptation2-stage0.py` ran the pre-registered §3 probe exactly as
frozen (seed 20260517, B=2000 cluster bootstrap, ridge λ=1.0,
leave-one-`scenario_type`-out grouped CV). Zero-API, read-only (DB opened
`mode=ro`; only existing `main` trace files read). Artifacts:
`exports/adaptation2-stage0-probe.meta.json`,
`exports/adaptation2-stage0-table.csv`.

**Harvest.** n = **1604** learner triplet-turns (full
`learner_ego_initial / learner_superego / learner_ego_revision /
learner·final_output` present), **9 scenario_type families**
(`epistemic_resistance_impasse`, `affective_shutdown_impasse`,
`mood_frustration_to_breakthrough`, `productive_deadlock_impasse`, … —
the concealment families the pre-registration targets), 11 profiles,
2589 dialogues.

**Primary target** `1 − tfidf_cosine(ego_initial, final_output)`:

| channel | grouped-CV R² | 95% cluster-bootstrap CI |
|---|---|---|
| A surface-only (manifest, = what the base sees) | **+0.086** | — |
| B latent-cause (`learner_superego` text only) | **−0.026** | [−0.212, −0.032] |
| gap B − A | **−0.111** | [−0.234, −0.010] |

Frozen P1 needs BOTH `lower95(R²_B) > 0` and `lower95(R²_B − R²_A) > 0`.
Both are violated, and not marginally: the latent-cause channel carries
**no recoverable structure** for the manifest≠latent gap (R²_B negative,
CI entirely below 0) and is **significantly worse than surface** (gap CI
entirely below 0). The robustness target (token-Jaccard) concurs
(R²_A=+0.039, R²_B=−0.022, CI95 [−0.206, −0.018]). **P1 FAILED.**

**Disposition (pre-registered, executed without relitigation).** Per §3's
frozen kill rule and §4's guardrails: **STOP. No Stage 1, no live run, no
tune-and-retry.** The concealed-interior signal is *not separable from the
surface the base already reads* — worse, the hypothesised latent cause (the
superego critique) does not even carry structured signal for the
manifest≠latent gap at the honest (between-family) variance unit. The
§6.7 / §6.8.8 / §6.9 re-encoding motif now extends onto the **signal axis
itself**: with §6.7 / §6.8.8 / §6.9.7 / §6.9.8 this is the **fifth
in-paper convergent negative** (the archived closed-loop persona is a
sixth, outside the paper's claim set) and the genuine close of the
adaptation arc — §6.9.8 closed the *policy-realisation* axis, §6.10 the
*signal* axis. P2 (Weber charisma→receptivity uptake) was
structurally unmeasurable on the existing corpus (cells 100–109 are
scripted-learner / tutor-only; ≤38/505 rows any learner score, 0
interiority) — that corpus gap *is* the concrete answer to "why charisma's
potential was never realised": the §6.7 arc instrumented the *performance*
of charisma, never its *uptake*.

**Lands as paper §6.10** (single-paper discipline; positive *or* negative,
no spin-off — §4). The pre-registered sentence: *even modelling the
concealed interior — the one signal the base provably misreads, which this
project uniquely owns as offline ground truth — buys no separable
structure over the surface; the adaptation question is closed.*
