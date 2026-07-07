# Cross-walk: GroupToM-Bench (arXiv:2606.04184) ↔ the §6.8.5–.6 ToM-redundancy nulls

**Date:** 2026-06-24
**Workplan item:** `grouptom-bench-benchmarking-group-theory-of-mind-nonlinear`
**Source roundup:** `notes/daily-notes/2026-06-14-research-roundup.html` (WATCH)
**Prior plan:** `notes/research-plans/2026-06-20-research-plan.html` (named it as the one project-relevant WATCH candidate)
**Verdict:** citation-only positioning (no re-analysis, no paid runs). Landed in paper v3.0.171, §6.8.8.

> Note on provenance: arXiv was unreachable from the edit environment (WebFetch 403, curl HTTP 000 through the proxy). The abstract content and author list below were reconstructed from web-index search results and should be verified against the arXiv record before publication. The `.bib` entry carries the same caveat.

## What GroupToM-Bench is

The first *multimodal* benchmark for **group-level** Theory of Mind. It models a causal
chain across three levels — micro (individual BDI: belief / desire / intention) → meso
(group tension, conformity dynamics, structural constraints) → macro (collective outcome
prediction). Its central thesis: current MLLMs fail group ToM via **"linear-superposition
bias"** — incorrectly treating collective behaviour as the *sum* of individual intents and
neglecting how social pressure distorts private motives. Collective behaviour is held to
emerge **non-linearly** and to be irreducible to aggregated individual intentions. Regime:
**group (3+ agents), multimodal, collective/nonlinear**.

## What the project's nulls are

- **§6.8.5 (P2.1, pre-registered confirmatory).** A bilateral first/third-person **ToM
  tracker** adds **no** within-family discrimination over the `recognition_only` baseline:
  pooled +4.17 pp (95% Wald CI [−15.18, +23.52]), below the locked 5-pp falsification floor
  → H1.3 supported. The architecture recognises pedagogical *type*, not *within-type*.
- **§6.8.6 (P2.2, post-hoc exploratory).** A **richer learner-state schema is
  counterproductive**: the 2-field `cell_118` (`confidence` + quoted-utterance anchor
  `lastEvidence`) leads on both `strict_shift` (68.8%) and the graded rubric (4.34); the
  3 richer cells (`cell_110`/`cell_119`/`cell_120`) form a flat ~50% cluster; `cell_123`
  localises the binary floor to "any fourth structured field" with a load/capacity
  saturation signature. The externalised-state advantage runs through `confidence` +
  `lastEvidence`, **not** the `misconceptions` array or `agencySignal` enum.

Joint reading: explicit individual-mental-state structure (BDI-like — `misconceptions`≈belief,
`agencySignal`≈intention) is **redundant-to-counterproductive** for localised, single-decision
strategy selection in this setting.

## The cross-walk

The two results sit in **different regimes**, and that is exactly the useful relation.

1. **GroupToM-Bench cannot *explain* the project's null.** Its core construct (non-linear
   emergence from conformity / structural pressure) has no referent in a **dyad** — there is
   no group for behaviour to emerge non-linearly over. Nothing in it maps onto a re-scoring
   of dyadic text logs (it is also multimodal). **Re-analysis is therefore not warranted.**

2. **GroupToM-Bench *brackets* the project's null.** It reports individual-level ToM as a
   regime where MLLMs make "notable progress" and **group-level** ToM as where structured
   social-mental-state modelling becomes load-bearing (and where MLLMs fail). The project's
   result is the dyadic-end complement: even explicit individual-mental-state structure is
   inert for localised move selection. Together they answer the card's own question — the
   null is **a property of the dyadic regime**, not (or not only) rubric insensitivity.
   (§6.8.6 already bounds the rubric-insensitivity reading internally: *minimal wins on both
   the binary and graded channels*, and the ordering replicates under a second judge — §5.12.4.)

3. **Forward direction (user steer, 2026-06-24).** The project eventually wants group / >2-party
   interaction dynamics. GroupToM-Bench's micro→meso→macro causal-chain construct and its
   "linear-superposition-bias" diagnostic are a natural external scaffold for that future arc:
   the regime where the inert dyadic ToM machinery is *expected* to start paying. Flagged in
   §6.8.8 as a forward direction; **not** an empirical claim and **not** scheduled here.

## Decision

- **Citation-only positioning.** No new empirical claim; inherits the existing §6.8.5/§6.8.6
  nulls. `claim_status: methods`.
- **Landed:** paper §6.8.8 "what is defensible" point 4 (v3.0.171); reference
  `@tang2026grouptombench` added to `docs/research/references.bib`.
- **Not done (deliberately, per the brake):** no re-scoring, no new cells, no group-ToM
  instrument build. A >2-party arc, if revived, is a separate human-authorized item.
