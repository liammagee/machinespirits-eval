# Program-2 related-work sweep — five-question precedent map

Date: 2026-07-20. Method: deep-research workflow (run `wf_d43adf86-3b2`), 100/103
agents completed, 606 tool calls; every claim below marked **[verified]** survived
3-0 adversarial verification with a source quote. The workflow's own synthesis
agent died on a spend limit, so this synthesis was written in the main session
from the 23 surviving claims. Coverage limits: one sweep (arXiv + web, through
July 2026); two verifier agents and the synthesizer were lost to quota; the
negative verdicts on questions 4 and 5 are absences from this sweep, not proofs
of absence.

Object under comparison (paper §6.20): Qwen3.5-9B LoRA-tuned on 865
audit-labeled warrant-demand examples ("audit exhaust"); at inference the mini
owns the demand-question span, a frontier model composes the turn around it
verbatim, the deterministic battery re-runs on the composite, and any failure
falls back to the mini's own reply; the same checker that produced the training
labels grades the composite. Two-arm base-vs-instruct comparison: skill trained
into both, conduct survived only in the instruct arm.

## Q1 — Span-level protected composition: PARTIALLY PRECEDENTED

- **Co-LLM** (Shen et al. 2024, arXiv:2403.03870) [verified]: interleaves
  multiple LLMs' generations at the token level inside one output — the
  which-model-generates decision is a *learned latent variable*, no
  deterministic verifier, no fail-closed fallback. Qualitatively exhibits
  emergent "template-filling" (one model scaffolds, the other fills spans) —
  the closest observed *shape* to our seam, but emergent rather than
  protocol-enforced. Reviewers will cite this; pre-empt by naming it.
- **Token-level cascade routing** (CITER, Zheng et al. 2024; Roads to Rome,
  Fu et al. 2025; via the SLM–LLM collaboration survey arXiv:2510.13890)
  [verified]: span/token-granular small–large division of labor exists but is
  cost-motivated and **directionally inverse** — the LLM is invoked for the
  critical tokens, the small model writes the filler. Ours gives the small
  model the load-bearing span.
- **Guardian–generator paradigm** (Llama Guard / ShieldGemma / WildGuard /
  MiniCheck families; survey ibid.) [verified]: a small model filters inputs
  and audits a large generator's outputs — gating without generating. The
  survey's trustworthiness coverage contains **no** method combining
  deterministic checks with fail-closed fallback between two *generating*
  models.
- **Knowledge Card** (Feng et al., ICLR 2024, arXiv:2305.09955) [verified]:
  small specialists generate text a black-box LLM consumes — but at the
  *prompt* level (concatenated context documents), with programmatic selectors
  applied *pre*-composition; the composed answer is never re-verified and no
  span of the final turn is owned.

**Forced weakening**: we cannot claim span-granular small/large composition as
such is new. What the sweep did not find anywhere: a fixed protocol in which
the *small* model owns the load-bearing span verbatim inside the large model's
turn, the composite is re-audited deterministically, and failure falls closed
to the specialist's own reply.

## Q2 — Verified-exhaust distillation: TRAINING SIDE CLEARLY PRECEDENTED; the closed loop over a composite is the delta

- **STaR** (Zelikman et al. 2022, arXiv:2203.14465) [verified]: ancestral
  correctness-gated fine-tuning loop — but generator and trainee are the same
  model (self-improvement), filter is gold-answer matching.
- **RFT** (Yuan et al. 2023, OpenReview cijO0f8u35) [verified]: deterministic
  filter (answer match + Python evaluation of the calculations); mixing
  rejection samples from larger LLaMA models pushed LLaMA-7B 35.9→49.3 on
  GSM8K; evaluation uses the same correctness criterion that filtered the
  data — a closed loop, but over a *standalone* student on held-out items.
- **ReST-EM** (Singh et al., TMLR 2024, arXiv:2312.06585) [verified]: explicit
  cross-model setup — PaLM 2-S fine-tuned on PaLM 2-L's verifier-filtered MATH
  solutions; filters are deterministic (answer match; test-case execution on
  APPS). **Calibration note [verified, refutation]**: the claim that
  larger-model exhaust *beats* self-generated data for the small model was
  REFUTED — ReST-EM found self-generated fine-tuning outperformed the
  distillation setup. In our setting self-training was not available at
  quality (the mini's floor missed the cue), but the paper should not imply
  teacher exhaust is inherently the better signal.
- **OpenMathInstruct-1** (Toshniwal et al., NeurIPS 2024, arXiv:2402.10176)
  [verified]: 1.8M verifier-filtered pairs from Mixtral into smaller students
  across families; students evaluated by the same kind of deterministic check
  that filtered the data — again, no multi-model composite re-graded by the
  verifier, no fail-closed fallback.

**Positioning**: "train a smaller different model on deterministically-verified
outputs of larger models" is standard practice. Our delta is the closure: the
*same frozen auditor* that produced the labels grades the *composed two-model
turn* at inference, with fail-closed fallback — every found precedent closes
the loop over a standalone student instead. Say exactly that, no more.

## Q3 — Alignment layer as integration scaffold: OPPOSITE DIRECTION PRECEDENTED; no controlled sibling comparison found

- **Qi et al. 2023** (arXiv:2310.03693) [verified]: fine-tuning erodes safety
  — 10 adversarial examples / <$0.20 jailbreaks GPT-3.5-Turbo; even benign
  datasets degrade alignment. **Crucially [verified]**: that lineage only ever
  fine-tunes aligned checkpoints; it never runs a controlled base-vs-instruct
  sibling comparison decomposing skill acquisition from conduct retention — so
  it does not preempt our scaffold claim; it frames the *risk* side.
- **arXiv:2505.12716 v2** (2025; title/authors NOT captured by the sweep —
  verify before citing in the paper) [verified quotes]: "directly tuning the
  Instruct models often leads to marginal improvements and even performance
  degeneration"; quantified: LoRA on Qwen-3-4B-Instruct drops Math-7 by 2.6
  and Code-3 by 6.8 vs untuned. This is the practitioner "tune the base
  sibling instead" position, made controlled — the directional opposite of our
  finding. Their mechanism hypothesis (instruction-following *interferes* with
  new-skill acquisition) is **[unverified]** — the verifier agents died on
  quota; treat as their speculation. Note our base-vs-instruct result
  contradicts it in our setting: skill acquisition was *equal* across arms;
  what differed was conduct integrity.

**Positioning**: no prior controlled result was found showing
instruction/preference tuning *helps* integrate a new narrow skill without
conduct collapse. Ours is one datapoint, scope-limited: one model family
(Qwen3.5-9B siblings), one narrow skill, LoRA, n=58 held-out moments, conduct
measured by our deterministic guards in dialogue — not capability benchmarks.
Cite both opposing lineages (safety erosion; instruct-tuning degradation) and
mark the scope difference (they measure benchmark capability, we measure
in-dialogue conduct).

## Q4 — Failure-anatomy-driven seam placement: NO PRECEDENT FOUND (this sweep)

No confirmed claim surfaced a multi-model system whose seam (which model owns
which part of the output) is justified by measured per-component failure
decompositions on shared test items. Everything found motivates seams by cost,
latency, or uncertainty (cascades/routing) [verified via survey claims]. State
as: "we are not aware of prior work placing the seam by failure anatomy;
routing and cascade literatures place it by cost or uncertainty."

## Q5 — Pedagogy-specific small models beside frontier models: NO SUB-UTTERANCE PAIRING FOUND

- **Knowledge Card** [verified] is the structural neighbor (small specialists
  beside a black-box generalist) but injects *factual knowledge at prompt
  level*, not a pedagogical move at span level.
- **LearnLM lineage** (Google, 2024–25) — pedagogy-tuned *frontier* models,
  folded into Gemini: from session knowledge, NOT sweep-verified (the sweep
  returned no confirmed LearnLM claims). Verify the citation before paper use.
  Direction of difference: pedagogy tuning at frontier scale vs our
  pedagogy-move specialist at 9B beside an untouched frontier model.

**Positioning**: no found precedent pairs a pedagogy-trained small specialist
with a frontier generalist at the utterance or sub-utterance level.

## Flags — what forces weakening

1. **Never claim** span-granular multi-model composition, small-beside-large
   specialists, or verifier-filtered distillation as novel categories
   (Co-LLM / CITER / R2R; Knowledge Card; STaR→RFT→ReST-EM→OpenMathInstruct).
2. The novelty claim that survived the sweep, stated at exact width: the
   *conjunction* — specialist owns the load-bearing span, verbatim containment
   enforced, deterministic re-audit of the composite by the label-producing
   checker, fail-closed fallback — plus the seam being placed by measured
   failure anatomy, and the controlled base-vs-instruct conduct decomposition.
3. Co-LLM's emergent template-filling must be named and distinguished
   (emergent vs protocol-enforced; no verification; no fallback).
4. ReST-EM's refuted-direction result (self-generated ≥ teacher exhaust)
   caps any claim that audit exhaust is the *preferred* signal in general.

## Draft related-work paragraph (~150 words, conservative)

> Our assembly borders several literatures without, to our knowledge, being
> contained by any. Sub-utterance multi-model composition exists: Co-LLM
> interleaves models at the token level with a learned deferral policy and
> exhibits emergent template-filling (Shen et al., 2024), and token-level
> cascade routing assigns critical tokens to the *large* model for cost
> (Zheng et al., 2024; Fu et al., 2025) — the inverse of our seam. Guardian
> models audit another model's output but do not generate within it. Training
> a smaller model on verifier-filtered outputs of larger ones is standard
> (Zelikman et al., 2022; Yuan et al., 2023; Singh et al., 2024; Toshniwal et
> al., 2024); our variant differs in closing the loop — the label-producing
> auditor re-grades the composed two-model turn, failing closed to the
> specialist. On alignment, the dominant findings run opposite ours:
> fine-tuning erodes safety (Qi et al., 2023) and degrades instruct
> checkpoints (arXiv:2505.12716). We found no controlled base-vs-instruct
> comparison decomposing skill acquisition from conduct integrity, and no
> multi-model seam placed by measured failure anatomy.

(Citation strings for Shen/Zheng/Fu author names and the 2505.12716
title/authors need bibliographic verification before the paragraph enters the
paper — the sweep verified mechanisms and quotes, not reference metadata.)
