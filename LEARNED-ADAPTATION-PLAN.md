# Learned-Adaptation Plan — "Adaptation That Earns the Name"

Status: proposal, **materially revised 2026-05-17 after re-reading the repo.**
The first draft was written in ignorance of A14, which is now merged to main
and changes what this plan can claim to be.

Provenance: independent audit of `prototypes/adaptive-persona-mvp/` +
`prototypes/adversarial-superego-mvp/`, reconciled against A14
(`docs/research/paper-full-2.0.md` §6.9, `TODO.md` §A14). Memory:
`adaptivity-what-works`, `adaptive-persona-prototype-verdict`,
`closed-loop-eval-tells`, `adversarial-superego-v3-result`.

## 0. What changed: A14 already ran most of this, and it came back negative

`experiment/evidence-bound-adaptive` (A14, Stages 1–5 **DONE**, merged to
main, paper §6.9.1–§6.9.7, v3.0.82) is the parent-native, properly-instrumented
version of most of what the first draft proposed:

- It built the typed apparatus in the parent LangGraph — `evidenceLog`
  (append-only), `hypotheses` (merge-by-id, TTL, status
  tentative/validated/contradicted/expired), `agencySignal`, grounding
  validator — as `cell_126` (updater only), `cell_127` (+validator),
  `cell_128` (cell_118 minimal profile + audit chain). All in
  `services/adaptiveTutor/stateSchema.js` + `graph.js` on **main** now.
- Stage 5 scored all three on §6.8's **architecture-independent** instruments
  (binary `strict_shift` `claude-code/sonnet`; 4-dim graded GPT-5/codex) at
  pooled N≈33 — exactly the "independent channel" the first draft's Step 0
  demanded.
- **Result (§6.9.7): negative.** Validator's +12pp binary gain over `cell_126`
  does **not** survive the graded channel (3.84→3.85, +0.01 null). `cell_128`
  (audit chain on §6.8.6's best `cell_118`) is **net-negative on both**
  channels (−10pp binary, −0.21 graded). "Mechanism-clean, pedagogically
  inert-to-negative" — the §6.8.8 *apparatus-is-the-contribution* motif.

This is now the **fourth** independent convergent result: §6.7.4, §6.8.8,
§6.9.7, and the `adaptive-persona-mvp` closed-loop verdict all say the same
thing — structured/evidence-bound elaboration on a strong adaptive base does
not pay pedagogically on independent instruments.

**Implication for this plan.** Steps 0/1/3/5 of the first draft are
substantially what A14 did. Re-proposing them is ablation creep. Exactly one
lever in the first draft is *distinct from everything the arc has tried*:

| Arc | Policy = `state → action` is… |
|---|---|
| cell_110 / §6.8 | implicit in the LLM forward pass |
| A14 (cells 126–128) | **hand-authored graph nodes** |
| A15 (designed) | **nearest-neighbor retrieval** over past tuples (non-parametric) |
| **This plan** | **a fitted parametric policy trained on logged outcomes** |

A15 (`experiment/retrieval-adaptation`, gated on A14) retrieves analogues; it
does not *fit* a policy. No arc has fit a policy from outcomes. That is the
single un-pulled lever, and the original `CLAUDES_CRITIQUE.md` named it "the
avenue not taken … the only path on which adaptation would mean what it says …
entered deliberately, not drifted into."

## 1. The honest prior

Four convergent negatives. The base rate says a fitted policy is **also**
likely to be null. This plan is therefore worth running **only** because:

1. it is the *last distinct* lever — running it makes the §6.8.8/§6.9.7 motif
   *exhaustive over {implicit, hand-authored, retrieval, learned}* rather than
   merely repeated; a clean negative is the paper's closing sentence, not a
   failed experiment;
2. the kill gate is **offline and zero-API** — it reuses A14's already-collected
   `cell_126/127/128` + `cell_110/118/124` trace files in main; if it can't
   clear off-policy estimation on data that already exists, it dies for free
   and the synthesis closes.

It is *not* worth running as a hopeful performance bet, and it must not become
a tuning loop. The first draft's kill criteria are retained and tightened.

## 2. The program (revised — tighter, A14-aware)

**Step 1 — Build the offline `(state, action, independent-outcome)` table
from existing main traces. Zero new runs.** A14's apparatus already emits the
typed state on main (`evidenceLog`, `hypotheses`, `agencySignal`, confidence,
turn index). Walk the existing `cell_126/127/128` (and `cell_110/118/124`)
dialogue/trace files; the outcome label is the **already-computed** §6.8
Stage-5 score (binary `strict_shift` and graded), never a controller-internal
metric. This collapses the first draft's Steps 0–1: the features and the
independent label both already exist in main.

**Step 2 — Fit the simplest policy.** Logistic / shallow `state-features →
action-family`. Train on a subset of scenario families; **test on held-out
families**. Bar: beats both the implicit baseline (`cell_110`) and A14's
hand-authored `cell_126` on held-out families, on the independent label.

**Step 3 — Off-policy evaluation as the hard kill gate. Still zero-API.**
Importance-weighted / doubly-robust OPE on the logged trajectories. **If OPE
does not show the fitted policy beating `cell_110` and `cell_126` on the
independent label, STOP.** Write the null as the §6.9.8 closing paragraph and
end the arc. No live run, no tuning pass.

**Step 4 — Counterfactual paired check (causal, not predictive).** Only if
Step 3 passes. Reuse `services/adaptiveTutor/runner.js` hidden_original vs
hidden_counterfactual replay: the fitted policy must select *different*
actions under counterfactual state, and those differences must improve the
independent outcome, paired within scenario.

**Step 5 — One pre-registered live confirmation.** Only if Steps 3–4 pass.
One run: fitted-policy cell vs `cell_110` vs `cell_126`, on the v1 trap suite,
scored on the **same Stage-5 instruments** (binary `strict_shift`
`claude-code/sonnet` + 4-dim graded GPT-5/codex) so it is directly comparable
to §6.9.7. Pre-register the gate before looking. ~$30–60 / ~16–32h, matching
A14 Stage 5's envelope.

**Kill criteria (ruthless, stated up front so this cannot become creep):**
fails OPE on existing data → null is the closing result, stop. Passes OPE,
fails counterfactual pairing → confounded, stop. Passes both, fails the
independent live judge → judge-shared artifact, stop. Each is a clean §6.9.8
sentence. There is no "tune and retry" branch.

## 3. Prototype or new branch? — **branch, and now empirically so**

A new branch off `main`, not a prototype. The first draft argued this on first
principles; A14 has now *demonstrated* it:

- A14 ran in the parent harness (`experiment/evidence-bound-adaptive`,
  stage-by-stage PRs to main) and produced a **clean, publishable, falsifiable**
  result (§6.9.7).
- The isolated `adaptive-persona-mvp` prototype produced an **uninterpretable
  closed loop** (same model in all roles; no architecture-independent channel
  by construction).

Same question, two paradigms, two outcomes. The branch paradigm is the one
that yields a result the paper can use.

Branch shape:

- **Off `main`** (which now contains A14's apparatus to consume as features),
  template = A14's stage-PR pattern. **Sibling to A15**, not a replacement:
  A15 = retrieval, this = fitting; they compose (a fitted policy *over*
  retrieved analogues is the natural union if both clear their gates).
- **Steps 1–3 are offline / read-only** (existing trace files + existing
  Stage-5 labels). Run under hermetic env (`EVAL_DB_PATH`/`EVAL_LOGS_DIR`);
  note adaptive cells write the prod DB even on `--dry-run`.
- **Exactly one registered cell, only at Step 5**, scored under the existing
  Stage-5 instruments — no new evaluator built.
- Do **not** branch off `experiment/adversarial-superego-promotion` (now == main
  anyway); keep the contrast clean.

Not a prototype: isolation has no architecture-independent channel by
construction → cannot satisfy Step 1's outcome label (A14 proved the point in
the opposite direction).

## 4. Guardrails

- **Single-paper discipline.** Lands as **§6.9.8** in
  `docs/research/paper-full-2.0.md`, positive *or* negative — the explicit
  closing of the A14/§6.8.8 arc ("…and the learned-policy lever, the last
  distinct one, [does / does not] pay either"). No spin-off.
- **Not an ablation on A14 or the persona machine.** The portable prototype
  pieces remain an interpretability note, tracked separately. This plan is the
  one *learning* experiment; its kill gate is offline and its null is a result.
- **Decision point for the user (below): whether to pull this lever at all, or
  let the four-result synthesis stand as the arc's conclusion.**

## 5. Result (2026-05-17): offline kill gate FAILED — arc closes

Pulled the lever (user-authorised "Do (a)": run Steps 1–3, the offline
zero-API kill gate, as a unit). It **failed the pre-registered gate. The arc
closes here — Steps 4–5 are not run, no live confirmation, no tuning retry**
(§2 ruthless kill criteria, honoured exactly).

**Step 1 — harvest (`scripts/learned-adaptation-harvest.js`, read-only, zero
API).** 179/179 trajectories from existing `cell_110/118/124/126/127/128`
main traces, one row per pivot decision (context = pre-pivot typed state;
single bandit action = pivot action family; reward = the §6.9.7 instruments).
**Fidelity asserted and passed**: recomputed binary `strict_shift` equals the
canonical `exports/a14-stage5-strategy-shift-finalN.json` `byProfile` rates
exactly (cell_126 0.4242, cell_127 0.5455, cell_128 0.5882; delta = 0 < 1e-6).
The label is provably the same instrument as §6.9.7, not a re-implementation.

**Steps 2–3 — fit + off-policy evaluation
(`scripts/learned-adaptation-policy-ope.py`, numpy only, zero API).**
Leave-one-`scenario_type`-out grouped CV (policy must work from state, not
memorise family identity); Direct Method + assumption-light
on-policy-agreement; cluster bootstrap by `scenario_type` (B=2000, seed
20260517) — the honest variance unit, since outcome variance is overwhelmingly
*between* scenario families.

Pre-registered gate: fitted policy must beat **both** the implicit baseline
`cell_110` and A14's hand-authored `cell_126`, lower 95% CI of the difference
> 0, on the primary binary `strict_shift` label.

| Channel | vs `cell_110` (implicit) | vs `cell_126` (A14 hand-authored) | Gate |
|---|---|---|---|
| `strict_shift` (primary, §6.9.7) | Δ=+0.090, 95% CI **[−0.009, +0.180]** → **does not beat** | Δ=+0.144, CI [+0.048, +0.230] → beats | **FAIL** |
| `graded_mean` (§6.8/§6.9 graded) | Δ=−0.033, CI [−0.164, +0.134] → does not beat | Δ=+0.159, CI [+0.026, +0.330] → beats | consistent FAIL |

On-policy-agreement value (assumption-light cross-check, n=95): 0.326 binary /
3.876 graded — *below* both baselines, agreeing with the Direct Method that
the fitted policy is not better than `cell_110`.

**Reading.** The fitted policy clears only the *weakest* A14 cell (`cell_126`,
the updater-only node) and is **statistically indistinguishable from the
implicit in-context baseline `cell_110`** on the independent label — both
channels agree. This is exactly the `[[adaptivity-what-works]]` prediction:
the typed state mostly *re-encodes* the scenario family the strong base model
already conditions on in-context, so a state→action policy tested
off-family has little room to beat the forward pass. Beating only `cell_126`
is not a pedagogy result; it is the well-established "structured elaboration
underperforms the strong implicit base" motif (§6.8.8) reappearing one level
up.

**Disposition.** This is the **fifth convergent negative** (§6.7.4, §6.8.8,
§6.9.7, `adaptive-persona` closed-loop verdict, and now the fitted-policy
lever). The {implicit, hand-authored, retrieval-designed, **learned**} space
of `state→action` realisations is now **exhausted**, and every distinct lever
lands null on architecture-independent instruments. Per §4 this is the
**§6.9.8 closing paragraph**, written *because* the gate failed offline and
for free — the arc's closing sentence, not a failed experiment. **No live run.
No Step 4/5. No tuning pass.** Artifacts: `exports/learned-adaptation-table.csv`,
`exports/learned-adaptation-{table,ope}.meta.json`.
