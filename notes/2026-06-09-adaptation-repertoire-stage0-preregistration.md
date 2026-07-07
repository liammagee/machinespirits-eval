# Track A — Repertoire-Ceiling Diagnostic · Stage 0 Pre-Registration

**Status:** FROZEN 2026-06-09, before any query of the evaluation data.
User signed off on the design ("Option A") this date. Edits after this line
are field-name plumbing only; the gate (metric / thresholds / contrast /
reads) below is not to be revised post-hoc.

**Provenance.** Implements Track A, Stage 0 of `notes/2026-06-09-adaptation-exploration-plan.md`
(post-§6.10 reframe). Sibling-in-discipline to `scripts/adaptation2-stage0.py`
(the §6.10 offline kill gate) and `scripts/learned-adaptation-policy-ope.py`
(§6.9.8). Lands as **§6.11** of `docs/research/paper-full-2.0.md`, positive or
negative, no spin-off. Script: `scripts/adaptation-repertoire-stage0.py`.
Artifacts: `exports/adaptation-repertoire-stage0-table.csv`,
`exports/adaptation-repertoire-stage0.meta.json`.

---

## The question (the one question, §2 of the brief)

Is the adaptation ceiling a *mechanism* failure or a *repertoire* failure? The
five convergent negatives (§6.7, §6.8.8, §6.9.7, §6.9.8, §6.10) all assumed the
mechanism on top of the tutor was the bottleneck. The rival never tested: the
tutor's **response distribution is itself collapsed** — much the same
explanatory moves regardless of who the learner is — so there is little
learner-conditioned variation for any mechanism to amplify. If so, the five
negatives are *explained*, not merely extended.

## Why a matched-learner design (the structural fact that forces it)

In `config/suggestion-scenarios.yaml` the learner persona **is** the scenario:
"Struggling Learner", "Adversarial Tester", "Concept Confusion" are distinct
`scenario_id`s that bundle persona + setup together. There is no axis that holds
topic fixed and swaps the persona, so the brief's literal "across-persona
dispersion at fixed scenario" is not cleanly computable (persona ≡ topic). The
signed-off design (Option A) replaces it with a contrast that has a *principled
internal reference and natural zero boundaries* instead of an arbitrary
"how-much-dispersion-counts-as-collapse" cutoff:

Rerun the same scenario many times. The ego-superego learner is an LLM agent, so
it phrases its turns differently each run. The learner's own cross-run dispersion
is the **architecture-matched yardstick** — same family of provider models, same
harness — for how much a comparable agent varies in this setting. We ask whether
the tutor (i) varies *as much as* the learner it faces, and (ii) varies *more*
on runs where the learner varies more.

## Corpus & unit

- **Rows:** `evaluation_results` where `learner_architecture LIKE 'ego_superego%'`
  with a non-null `dialogue_id` whose log file exists (`EVAL_LOGS_DIR`). The
  ego-superego restriction is *forced*: a scripted `unified` learner emits
  identical text every run, so its cross-run dispersion is zero and the yardstick
  is undefined. This is the same corpus §6.10 harvested.
- **Externalised text per turn:** tutor = the ego `generate`/`revise`
  `suggestions` payload (what the learner sees; the last one in a turn wins);
  learner = the `learner`/`final_output` text (`detail`/`contextSummary`). Tutor
  response at tutor-turn `t` is paired with the learner message it responds to
  (`L_t`, the learner turn immediately preceding it).
- **Stratum:** `(scenario_id × profile_name × tutor_turn_index)`. "Repeat runs"
  = the distinct dialogues of that scenario × profile.
- **Read-only, zero API.** DB opened `mode=ro`; only existing trace files read.
  No model of any kind in the scoring loop — pure lexical statistics.

## Echo-stripping (control the parroting confound)

A tutor can look diverse merely by quoting a varied learner. So each turn is
reduced to its **own contribution** by removing tokens present in the
immediately preceding turn, symmetrically for both sides:

- `tutor_own(t)`  = tokens(tutor_t)  − tokens(L_t)
- `learner_own(t)` = tokens(L_t) − tokens(tutor_{t-1})   (`L_1` has no preceding tutor)

Echo-stripped is **primary**; raw (un-stripped) is a reported sensitivity.

## Metric

Within each stratum, across its runs, on the echo-stripped token-sets:

- **D_out** = mean pairwise token-set **cosine distance** among the tutor turns
- **D_in**  = mean pairwise token-set **cosine distance** among the learner turns

Cosine distance is the binary token-set cosine used as §6.10's target metric
(`cos_dist` in `scripts/adaptation2-stage0.py`); token-**Jaccard** distance is
the frozen robustness target (must agree in direction). Both are model-free.

## The two frozen quantities (each a natural zero boundary)

1. **Compression** `δ = mean_strata( D_out − D_in )`. Boundary 0. `δ < 0` ⇒ the
   tutor varies *less* than the matched learner — it funnels varied inputs toward
   more uniform output.
2. **Coupling** `ρ = partialSpearman( D_out , D_in | tutor_turn_index )` over
   strata. Boundary 0. `ρ > 0` ⇒ strata with more-varied learners get
   more-varied tutor responses — the tutor *tracks* learner variation. Turn index
   is partialled out so the correlation is not just "later turns diverge more".

## Inclusion (frozen)

A stratum enters the primary contrast iff it has **≥ 3 runs** AND **D_in > 0.05**
(the learner actually varies; below this the "does the tutor track the learner"
question is ill-posed). The count of strata excluded for `D_in ≤ 0.05`
(learner-invariant input) is itself reported — a large share would mean the
simulated learner is too uniform to pose the adaptation question, a §6.10-flavoured
finding in its own right.

## Inference (frozen)

**Cluster bootstrap by `scenario_id`** (B = 2000, seed 20260609): resample
scenarios with replacement, pool their strata, recompute δ and ρ; 95% percentile
CI. This is the honest variance unit — dispersion is overwhelmingly between
scenarios, and a stratum-level bootstrap would manufacture a false pass (the
§6.10 / §6.9.8 rule). No alpha correction: δ and ρ are two distinct facets
(level vs coupling) deliberately combined into one read, not two tests of one
hypothesis.

## Frozen reads — the 2×2 (a null / either outcome IS the §6.11 result)

|                              | ρ reliably > 0 (tracks)            | ρ not reliably > 0          |
|------------------------------|------------------------------------|-----------------------------|
| **δ < 0 (compresses)**       | consistent-but-responsive → NO COLLAPSE | **COLLAPSE**           |
| **δ ≥ 0 (≥ learner)**        | diverse + responsive → NO COLLAPSE | indeterminate               |

- **COLLAPSE** ≡ upper 95% CI of δ < 0 **and** 95% CI of ρ includes 0 (no
  reliable coupling). → §6.11: the adaptation ceiling is, in part, a *repertoire*
  ceiling — on this corpus the tutor compresses diverse learners into less-varied
  output and does not track input diversity; the five mechanism negatives are
  explained, not merely extended.
- **NO COLLAPSE** ≡ lower 95% CI of ρ > 0, **or** δ CI reaches/exceeds 0. →
  §6.11: Track A null — the tutor's output repertoire does diversify with and
  track the learner; the bottleneck is not a collapsed generator, it sits on the
  mechanism/signal axes already closed in §6.7–§6.10.
- **INDETERMINATE / mixed** (any other CI configuration, e.g. δ<0 with ρ also
  reliably >0 already handled as no-collapse; or δ CI spans 0 with ρ≈0): report
  the partial result. Stop either way.

**Disposition rule (frozen, executed without relitigation):** whatever the read,
**no tune-and-retry, no Stage 1, no live/paid run.** Track A is diagnostic;
neither outcome licenses a new cell (a "repertoire-expansion" mechanism would be
a sixth mechanism — foreclosed by the brief). Both lands as §6.11. Paid-work
gates, if any, live downstream in Tracks B/C and are out of scope this session.

## Reported alongside (interpretive, not gated)

- Absolute mean D_in and D_out levels (floor = identical text = 0; the
  across-scenario tutor distance ≈ the topic-driven ceiling), so the reader sees
  whether the learner provides diverse inputs at all.
- Between-scenario vs within-scenario share of tutor dispersion (mean
  across-scenario tutor distance at matched turn index vs mean within-scenario
  across-run distance). **Labelled topic-confounded** (persona ≡ scenario);
  descriptive only, shows the measure is not floored.
- Per-cell (`profile_name`) breakdown of δ and ρ, so a collapse read is not a
  pooling artifact.

## The bound (the §7.9 symmetric-honesty constraint, stated up front)

The measure is **lexical** token-set dispersion — a noisy proxy for
strategic-move diversity. The claim is bounded to lexically-measured output
dispersion on the v-corpus ego-superego multi-turn traces:

- a COLLAPSE read does **not** license "the tutor cannot adapt" — only "the
  measured output-move distribution is learner-compressed and decoupled on this
  corpus";
- a NO-COLLAPSE read does **not** license "rich adaptation occurs" — only
  "output dispersion tracks the learner".

No embeddings / no semantic model: that is a deliberate anti-thrash choice (it
forbids the "add embeddings and rerun" treadmill §6.9.8/§6.10 exist to stop), not
an oversight, and the variance structure reported is a property of the
distribution regardless of proxy fidelity.
