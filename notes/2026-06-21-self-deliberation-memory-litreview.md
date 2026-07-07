# Self-deliberation memory in multi-agent LLM systems — literature note

**Date:** 2026-06-21
**Status:** WORKING NOTE — provisional. Not a paper claim.
**Provenance:** deep-research harness run `wf_e752a23b-e97` (5 search angles, 27 primary sources,
129 claims extracted, top 25 selected). **The adversarial verification phase did NOT run** — an
API/network outage stalled and killed every verifier mid-run, so the harness mislabelled the result
"all refuted / inconclusive." That verdict is an artifact, **not** a refutation. Every figure below
is **sourced-but-unverified**: spot-check the number against the cited paper before it informs
`docs/research/paper-full-2.0.md` (single-paper discipline; this note introduces no paper claims).

---

## Question this answers

In our bilateral ego–superego tutoring system, each side's hidden deliberation (ego draft → superego
critique → ego adjudication) is logged but **not** replayed into later prompts — future turns see only
the last ~6 public turns plus writing-pad summaries (see
[notes/poetics/2026-06-20-1901-ego-superego-history-context-note.md](poetics/2026-06-20-1901-ego-superego-history-context-note.md)).
The open question: would adding a **compact, public-safe self-deliberation ledger** (recurring ego
habit, recurring superego objection, last adjudication, unresolved self-critique, public behaviour
that changed) — carried forward by each side about *itself* — measurably improve multi-turn quality
over a public-history-only baseline?

## TL;DR verdict

**Replaying an agent's own internal deliberation helps only when each entry is anchored to an
external correctness signal. Ungrounded self-talk carried forward is neutral at best and actively
degrading at worst.** A tutoring turn has no per-turn oracle, so a *bare* ledger sits squarely in the
"harmful" regime the literature documents. The one field worth keeping is the outcome-anchored one
("what public behaviour changed, and did it land"). This converges with our own prior finding that
adaptation gains come from *new signal*, not from re-encoding what the model already infers
(§6.8.8 / §6.9; `project_adaptivity_what_works`). **Recommendation: don't build the bare ledger;
if anything, build an outcome-anchored variant and test it 3-arm.**

---

## 1. The two camps

### 1a. Pro — replaying own reflection helps *when grounded by an external signal*

- **Reflexion** (Shinn et al., [arXiv:2303.11366](https://arxiv.org/abs/2303.11366)) persists the
  agent's *own verbal self-reflections* across trials in an episodic buffer and replays them. Its
  HotPotQA ablation isolates first-person self-reflection from carrying forward only the prior
  trajectory ("episodic-memory-only"): self-reflection adds **~+8%** over the EPM-only baseline — the
  closest published analogue to our "ledger vs public-history-only" contrast. Removing the verbal
  self-reflection step drops HumanEval-Rust to base (**0.60 vs 0.68 pass@1**), i.e. the persisted
  self-critique is load-bearing. Gains over a no-memory agent: **+22%** ALFWorld (130/134 tasks),
  **+20%** HotPotQA, **+11%** HumanEval (**91% vs 80%** pass@1); non-reflective baselines plateau.
  **Crucial caveat:** Reflexion's reflections are triggered by an *external* signal — task
  success/failure, unit-test results. The reflection is grounded.

### 1b. Skeptic — *intrinsic* self-correction (own feedback, no external signal) is neutral-to-harmful

- **Huang et al., "LLMs Cannot Self-Correct Reasoning Yet"**
  ([arXiv:2310.01798](https://arxiv.org/abs/2310.01798)): intrinsic self-correction *drops* accuracy
  across models — GPT-3.5 GSM8K **75.9 → 75.1 → 74.7**, CommonSenseQA **75.8 → 38.1 → 41.8**, GPT-4
  GSM8K **95.5 → 91.5 → 89.0**. Mechanism: the model can't judge its own correctness, so a
  self-critique prompt biases it to flip correct answers to incorrect. The apparent Reflexion/RCI
  gains come from **oracle labels deciding when to stop** (with oracle, GSM8K 75.9 → 84.3); remove the
  oracle and the gains vanish. **The verification signal, not the self-reflection text, drives the
  improvement.**
- **"When Can LLMs Actually Correct Their Own Mistakes?"** (TACL,
  [tacl_a_00713](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/When-Can-LLMs-Actually-Correct-Their-Own-Mistakes)):
  self-correction succeeds only with reliable *external* feedback (e.g. code execution) or on
  verifiable/decomposable tasks; internal self-feedback alone is insufficient. Many prior positive
  results used unfair setups (oracle info during correction; deliberately weak initial prompts).
- **On the self-correction bottleneck** ([arXiv:2406.01297](https://arxiv.org/abs/2406.01297)): LLMs
  refine well *given* reliable feedback, but **generating** reliable feedback on their own outputs
  unaided is the failure point. No fair-setting success on general tasks.
- **Self-correction degrades across tasks** ([arXiv:2412.14959](https://arxiv.org/html/2412.14959v1)):
  across four tasks self-correction *reduced* accuracy; worst case Llama-3.1-8B **−20.4%** with
  **58.8%** of its correct answers overturned. Iterating destabilises answers — GPT-3.5-turbo changed
  **81.3%** of its answers more than six times over a 10-round loop ("answer wavering").

## 2. Failure modes that map directly onto the ledger risk

- **Sycophancy / "FlipFlop effect"** ([arXiv:2311.08596](https://arxiv.org/abs/2311.08596)):
  challenged in a later turn ("Are you sure?"), accuracy drops **~17%** averaged over 10 LLMs × 7
  tasks; models **flip ~46%** of answers, abandoning correct ones under conversational pressure.
  Universal across GPT-4 / Claude / PaLM / Mistral / Gemini. This is the "self-justification under
  pressure" risk, measured.
- **"Review Target Drift"** (citation `arXiv:2603.16244` — **⚠ future-dated ID, verify it exists**):
  replaying a reviewer's *own prior deliberation* into a later turn made the agent shift from
  reviewing the artifact to **critiquing the prior conversation itself and fabricating findings about
  the dialogue** — a concrete instance of our "false depth / self-justification" worry. Nuance worth
  keeping: the harm came from *re-engagement pressure* ("false-positive pressure" once real errors are
  exhausted), **not** from the amount of carried context — within multi-turn conditions more carried
  information actually helped (F1 0.303 > 0.293 > 0.263), and context-free re-review was worst. So the
  danger is "re-litigate your own past critique," not "carry forward state."

## 3. Taxonomy note

A 2026 survey ([preprints 202601.0618](https://www.preprints.org/manuscript/202601.0618)) separates
**intra-trajectory reflection** (refine within one episode) from **inter-trajectory experience
abstraction** (induce reusable rules across episodes) as distinct evolutionary stages. This validates
treating single-episode self-refinement and cross-turn deliberation memory as genuinely different
mechanisms — our ledger is the latter, which is the less-studied and riskier of the two.

## 4. Synthesis — what this means for the ledger

The corpus converges on a conditional: **the grounding signal is the active ingredient, not the
self-talk.** Reflexion works because its reflections are tied to pass/fail; strip the external signal
(intrinsic self-correction) and the same mechanism goes flat or negative. A multi-turn tutoring
dialogue has **no reliable per-turn oracle** — there is no unit test for "did this pedagogical move
land." So a ledger that replays *ungrounded* self-critique (recurring habit, recurring objection,
unresolved critique) is precisely the regime the skeptic literature flags as neutral-to-harmful, and
it invites the documented failure modes (sycophantic flipping, review-target-drift, answer wavering,
prompt bloat). The only ledger field with literature support is the **outcome-anchored** one: *what
public behaviour changed as a result, and did the next public turn indicate it worked.*

This independently reproduces our own §6.x result and the `project_adaptivity_what_works` note: gains
come from new signal, not from re-encoding what the model already infers.

## 5. Recommendation + clean experiment

- **Do not build the bare self-deliberation ledger** as specified. Expected value is low and the
  downside (instability, self-justification loops, bloat) is documented.
- **If building anything**, make every entry *outcome-anchored* (tie each carried item to an
  observable change in the learner's next public move), keep it tiny, bound it hard, and never replay
  raw self-critique.
- **Test it 3-arm** on AF1/AF11, fixed seed/routing/scorer/quality-gate:
  1. public-history-only (current baseline),
  2. ungrounded ledger (the note's original spec),
  3. outcome-anchored ledger.
  The literature predicts **arm 2 ≈ or < arm 1**, and **arm 3 > both only if the anchor carries real
  signal.** A 2-arm (1 vs 3) test would confound "self-talk" with "grounding"; the 3-arm isolates it.
- The privacy/boundary requirement from the original note (never expose one side's hidden deliberation
  to the other; share only public-safe inferences) is **not contradicted by anything found** — but the
  search surfaced little direct empirical work on it, so treat it as a design constraint, not a
  settled result. (Angle-4 sources on multi-agent privacy/ToM are in the list below but their specific
  claims were among those left unverified.)

## 6. Caveats / provenance

- **Verification never ran.** All numbers are extraction-phase outputs, not adversarially checked.
  Before any figure enters the paper, open the cited PDF and confirm it. Treat the four foundational
  citations (Reflexion 2303.11366, Huang 2310.01798, FlipFlop 2311.08596, TACL tacl_a_00713) as
  high-confidence (well-known); treat all **2025–2026 arXiv IDs as needing an existence-check** — an
  extraction agent can emit plausible-looking IDs. Specifically verify: `2603.16244`, `2606.00820`,
  `2602.11510`, `2606.09900`, `2601.06973`, `2512.14118`, `2509.21981`, `2510.05381`.
- This is a working note. Nothing here is a paper claim until verified and folded via the normal
  version-bump + revision-history process.

## Sources (as returned by the run; quality = harness label)

Primary, claim-bearing:
- [arXiv:2303.11366](https://arxiv.org/abs/2303.11366) — Reflexion (5 claims)
- [tacl_a_00713](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00713/125177/When-Can-LLMs-Actually-Correct-Their-Own-Mistakes) — When Can LLMs Self-Correct (5)
- [arXiv:2310.01798](https://arxiv.org/abs/2310.01798) — LLMs Cannot Self-Correct Reasoning Yet (5)
- [preprints 202601.0618](https://www.preprints.org/manuscript/202601.0618) — reflective-memory survey (5)
- [arXiv:2412.14959](https://arxiv.org/html/2412.14959v1) — self-correction degrades (5)
- [arXiv:2406.01297](https://arxiv.org/abs/2406.01297) — self-correction bottleneck (5)
- [arXiv:2311.08596](https://arxiv.org/abs/2311.08596) — FlipFlop effect / sycophancy (5)
- `arXiv:2603.16244` — Review Target Drift (5) **⚠ verify**

Other sources fetched (claims left unverified; several IDs need existence-checks):
2505.24726 · [2025.findings-acl.871](https://aclanthology.org/2025.findings-acl.871.pdf) ·
2509.05396 · 2606.00820 · 2510.05381 · 2506.15674 · 2602.11510 · 2509.21981 ·
[CMU dissertation ioguntol_phd_mld_2025](https://ml.cmu.edu/research/phd-dissertation-pdfs/ioguntol_phd_mld_2025.pdf) ·
2405.18870 · 2603.05618 · 2601.06973 · 2606.09900 · 2512.14118 ·
[emergentmind 2503.08026](https://www.emergentmind.com/papers/2503.08026) · 2405.06682
