# Track B — Adaptation-vs-Compliance Classifier · Stage 0 Pre-Registration

**Status:** FROZEN 2026-06-09, before any classifier call or κ computation.
User signed off on this design this date. Edits after this line are
field-name / rendering plumbing only; the gate (classes / classifier /
gold / κ floor / kill rule) below is not to be revised post-hoc.

**Provenance.** Implements Track B, Stage 0 of `notes/adaptation-exploration-plan.md`
(post-§6.10 reframe). Sibling-in-discipline to the Track A repertoire gate
(`notes/adaptation-repertoire-stage0-preregistration.md`, → §6.11) and the
§6.10 / §6.9.8 offline kill gates. Lands as a new subsection (≈**§6.12**) of
`docs/research/paper-full-2.0.md`, positive or negative, no spin-off.
Source paper: "Not All Flips Are Conformity" (arXiv:2606.00820).
Scripts: `scripts/adaptation-conformity-harvest.py`,
`scripts/adaptation-conformity-classifier.py`.
Artifacts: `exports/adaptation-conformity-*.{jsonl,meta.json}`.

---

## The question (the one question, supporting §2 of the brief)

The architecture realises the superego's value through **ego revisions**: the
ego generates, the superego critiques, the ego revises. The project's adaptation
metrics count the revision as the superego "working." But a revision can be
genuine *reasoning-engagement* (persuasion) or mere *surface compliance*
(conformity). Track B asks: **of the tutor's superego-driven revisions, what is
the persuasion / conformity / instability split — and do the adversarial /
divergent-superego cells (the one positive, 20→85) ride persuasion or
conformity?** This is a *measurement* re-interpretation of data already on disk,
not a new mechanism (no generation cost beyond the classifier).

## Unit (frozen)

One **revision event** = the triplet
`(ego initial suggestions, superego critique, ego revised suggestions)` from one
tutor turn in which the superego pushed back and the ego subsequently revised.

- **Source:** `dialogueTrace` entries with `agent='ego' action∈{generate,revise,incorporate-feedback}`
  surrounding a non-approving `agent='superego' action='review'`. The *initial*
  is the ego entry before the superego; the *revision* is the first ego entry
  after it. (Structural recon 2026-06-09: in a 6000-trace sample, 3177 had a
  superego, 2301 pushed back, 2119 produced a revision; labels `ego/revise` 1690,
  round-2 `ego/generate` 356, `ego/incorporate-feedback` 73. Revision events
  cluster in `dialectical_suspicious` / `_recognition` / adversary / advocate.)
- **Substantive-change restriction (frozen, model-free):** include an event only
  if token-Jaccard distance between the initial and revised suggestion text
  `> 0.05`. Events at/below the floor are **"resistance"** (the ego held its
  ground despite pushback) and are reported as a separate rate, not forced into
  a class. This mirrors the source paper's restriction to actual flips.
- **Frozen input rendering** (identical for gold annotator and classifier):
  each event rendered as three fields — `initial_text`, `critique_text`,
  `final_text` — where each is the concatenated suggestion `message`/`title`
  text (ego sides) or the `feedback`/`verdict.feedback` (superego side), each
  truncated to 1500 chars. No cell name, profile, or score is shown to the
  labeller/classifier (blind to condition).

## The three classes (frozen; mapped from arXiv:2606.00820)

- **persuasion** (reasoning-induced) — the revision engages the *reason* in the
  critique and changes substance accordingly; uptake is reasoned, may go beyond
  or reframe the literal demand.
- **conformity** (stance-induced) — the ego adopts the superego's demanded change
  as a directive, complying with the stance without independent reasoning;
  the revision tracks the critique's instruction rather than its rationale.
- **instability** (spontaneous) — the revision changes things the superego did
  *not* raise, or changes in ways unrelated to the critique; non-responsive
  drift / noise.

## Classifier (frozen; architecture-independent by construction)

- **Model:** `openrouter.gpt` (GPT-5.2, OpenAI family). Clean: **no OpenAI model
  generated any dialogue in this corpus** (generators are Anthropic, Nvidia,
  Moonshot, DeepSeek, Google, Z-ai, Qwen), so the closed-loop guardrail
  (`closed-loop-eval-tells`) is satisfied — the scoring channel shares neither
  model nor prompt with any generator.
- **Frozen prompt:** the three class definitions above + the rendered triplet;
  output a single class label + one-line rationale. Temperature 0. The exact
  prompt string is committed in `scripts/adaptation-conformity-classifier.py`
  before the gate runs.

## The gate (frozen, ruthless — the Stage 0 kill criterion)

- **Gold set:** a deterministic, seeded (seed `20260609`) stratified sample of
  **60 revision events** across the superego-bearing profiles. Labelled into the
  three classes by an independent annotator (Claude Opus 4.8) **before** the
  classifier is run (blindness guaranteed by order: the prediction file does not
  yet exist), then **reviewed/corrected by the human operator** to anchor the
  gold to human judgement. Gold committed to `exports/adaptation-conformity-gate-gold.jsonl`.
- **Pass condition:** **weighted Cohen's κ(classifier, gold) ≥ 0.60** (substantial
  agreement) on the 60-event gold set.
- **Kill rule (frozen, executed without relitigation):** **κ < 0.60 → Track B is
  dropped and the null is the result** — the persuasion/conformity construct is
  not reliably separable on this corpus, so no split is reported and no full run
  is bought. **No tune-and-retry** (no prompt-rewording-and-rerun loop — the same
  anti-thrash rule that closed Track A / §6.10). Either outcome lands as ≈§6.12.

## If the gate passes (frozen protocol)

Run the same frozen classifier over a **stratified random sample of revision
events, hard cap 2,500** (seed `20260609`; not the full ~16k, to keep cost in the
tens of dollars and attended). Report:

1. The overall persuasion / conformity / instability split (+ the resistance rate).
2. The split **by profile/cell**, so the headline is not a pooling artifact.
3. **The primary contrast:** do the divergent-superego cells
   (`dialectical_suspicious`, `dialectical_adversary`) show a *higher* persuasion
   share, or a *higher* conformity share, than the advisory / advocate cells?
4. Inference: cluster bootstrap by `scenario_id` (B = 2000, seed `20260609`) on
   the per-class shares and the divergent-vs-advisory contrast.

## The 20→85 channel caveat (stated up front)

The divergent-superego gain (advisory 20 ≪ adversarial 85) rode the
**prompt-rewrite** channel (the superego editing the ego's standing prompt);
"message-mutation was not necessary" (`adversarial-superego-v3-result`). Track B
classifies the **message-revision** channel. This is a frozen prediction, not a
flaw: if the power was in directive prompt-reconfiguration, the divergent cells
should show **high conformity / low persuasion** on the message channel; a
persuasion-heavy result there would complicate the prompt-rewrite reading.
Either way it is a real re-interpretation of existing data.

## The bound (the §7.9 symmetric-honesty constraint, stated up front)

The classifier is an LLM judgement of revision *type* — a noisy proxy. The claim
is bounded to **classifier-measured revision types on the logged ego-superego
tutor traces**:

- a conformity-heavy read does **not** license "the superego is useless" — only
  "the measured message-revisions are predominantly compliance on this corpus";
- a persuasion-heavy read does **not** license "the tutor genuinely adapts" —
  only "the measured message-revisions engage the critique's reasoning".

No new dialogue generation — the classifier consumes only already-logged traces.
The full-run cost is bounded by the 2,500 cap and is attended; the gate is ~60
calls. A null at the gate costs ~$1–2.
