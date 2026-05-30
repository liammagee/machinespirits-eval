# Control-leak: primarily a DRAW (generator) effect, GPT a secondary amplifier

Date: 2026-05-29
Method: pure SQL over existing `poetics_scores` (quota-free; no new generation/scoring).
Context: de-confounding the GPT-critic reverse run (`…reverse-040243Z-i01`, `…reverse-100413Z-i01`)
against the Sonnet baseline (`…20260529T023023Z-i01..i03`). See `project_poetics_gpt_deconfound` memory.

## (1) Per-critic discrimination on the GPT reverse runs

Recognition rate by arm-type (peri = peripeteia-only; ctrl = none+routine):

| critic | ctrl rate | peri rate | discrimination (peri−ctrl) |
|---|---|---|---|
| google/gemini-3.5-flash | **0.00** (0/11) | 0.83 (5/6) | **0.83** (best) |
| qwen/qwen3.7-max | 0.27 (3/11) | 1.00 (6/6) | 0.73 |
| deepseek/deepseek-v4-pro | 0.36 (4/11) | 1.00 (6/6) | 0.64 |
| gpt | **0.45** (5/11) | 1.00 (6/6) | 0.55 (worst) |

- The peripeteia device reads as recognition for **every** critic (≥0.83) — the device works.
- On controls, GPT leaks most (0.45) and is the **worst discriminator**; gemini-flash never leaks and is the best.
- But GPT is not alone: deepseek (0.36) and qwen (0.27) leak substantially too. Only gemini is clean.

## (2) The de-confounding test — shared critics, Sonnet-draws vs GPT-draws

qwen / gemini / deepseek appear in BOTH panels, so any difference in their votes is purely the transcripts
(the critic model is identical). Control arms only:

| shared critic | Sonnet-draws ctrl rate | GPT-draws ctrl rate | Δ |
|---|---|---|---|
| google/gemini-3.5-flash | 0.00 (0/17) | 0.00 (0/11) | 0 |
| deepseek/deepseek-v4-pro | 0.24 (4/17) | 0.36 (4/11) | +0.12 |
| qwen/qwen3.7-max | 0.06 (1/17) | 0.27 (3/11) | **+0.21** |

**The same critic models vote recognition on controls 2–4× more often on the GPT-run draws than on the
Sonnet-run draws.** Since the model is fixed, the difference is in the DRAWS → the reverse-run control
transcripts are genuinely leakier (more organic learner self-correction baked in by the generator).

## Conclusion

1. The elevated control leakage in the GPT runs is **primarily a generator/draw effect** (proven by the
   shared critics), **not** GPT-critic generosity. This corrects the earlier "GPT over-recognizes controls"
   shorthand: GPT is the most generous critic, but it is a **secondary amplifier**, not the cause.
2. The fix points at the **generator** (constrain the control learner so it doesn't self-recohere; demote
   structurally-leaky anchors like D42) — NOT at swapping the critic. Consistent with the fork-audit's
   expected #1/#2 verdict.
3. **gemini-3.5-flash is the cleanest discriminator** (0.00 control, 0.83 peri). A panel weighted toward
   device-linked recognition (gemini-like threshold) would cut leakage — at some risk of peri false-negatives
   (gemini missed 1/6 peri).

## Caveats

- Small n (11 GPT-draw control-votes, 17 Sonnet-draw). Directional.
- "Draw" bundles every transcript difference (fresh stamp, fresh generation), not a single controlled knob.
- Rates are per-critic-per-arm, not the pair-level leak gate (≤1 recognition vote on a 4-critic panel).
- The truly clean isolation is still a same-transcript rejudge (re-score the IDENTICAL transcripts with both
  the Sonnet and GPT panels); this shared-critic analysis is the strongest read available without new scoring.

## Cross-refs

- Feeds the fork-audit workflow (`wf_d6b954bb-617`) and the pooled de-confound (`c3` loop running →
  `exports/paired-increment-reverse-GPT-pooled-ALL.json`).
- Memory: `project_poetics_gpt_deconfound`, `project_poetics_organic_recognition_is_scorer_bug`.

## Fork-audit (independent, transcript-level) — CONVERGES on generator-side

Workflow `wf_d6b954bb-617` (9 agents: 4 classify → 4 adversarial-verify → 1 synthesis; full output
`exports/fork-audit-control-leak-wryqkskot.json`). Each leaked control classified from its transcripts
alone (independent of the SQL above); **adversarial verification overturned 2 of 4** classifications.

Verifier-agreed finals:

| control | fork | conf |
|---|---|---|
| D42-none (100413) | generator_overwrites_learner | 0.78 |
| D53-none (040243) | generator_overwrites_learner | 0.60 |
| D50-none (040243) | scenario_self_resolves | 0.70 |
| D50-routine (040243) | critic_false_positive | 0.70 |

**Dominant: generator_overwrites_learner. 3 of 4 are production-side failures, 1 is a critic over-read.**
`tutorDidDevice=false` everywhere (verifier-confirmed) — no concealed device in any control.

Three mechanisms:
1. **Persona over-write** (D42-none, D53-none): learner written more insightful than a no-device arm
   warrants — caught red-handed by the learner's OWN superego (D42: "more good-student flourish than this
   student's rigour"; D53: "too clean for a first-week hand… springs the very trap flawlessly in a single beat").
2. **Scenario self-resolution** (D50-none): the misconception + self-question are baked into the byte-identical
   shared prefix both arms inherit; the prefix does the dramatic work the absent device was meant to.
3. **Critic over-read** (D50-routine): the scored line is a same-turn echo of the tutor's just-delivered
   distinction; the anti-reframe guard bars genuine old→new, so critics upgraded a tutor-led restatement into
   learner anagnorisis.

Prioritized fix (from the synthesis):
- (a) **Anchor demotion** — D42 is structurally rigged (directional-arrow prefix forces reorientation
  regardless of arm); demote per EDRA M3, screen D54–D57 for a clean third anchor.
- (b) **Constrain the control learner** — cap to task-minimal moves so it can't volunteer verification
  protocols / transfer-tests / pre-solve the lesson (the dominant mechanism).
- (c) **Re-specify the contrast onto recognition ORIGIN** (device-induced vs scenario/prefix/tutor-supplied),
  not recognition presence — D50/D53 lines are REAL old→new movements, so a presence-based critic keeps
  firing; this is the `peripeteia_induced`-vs-`organic` axis the surgery spec already isolates.
- (d) Stricter critic = LAST/weakest lever (risks peri false-negatives — gemini already misses 1/6 peri).

Honest verdict holds: the paired comparison is voided on the generator/scenario side → stays null/weak-positive
until anchors are re-screened and the control learner is constrained. Do not manufacture a pass by tightening
critics or adding scenarios. Claim boundary unchanged: "differential recognizability of dramatic FORM," never
real learning.
