# Plan 2.5 AF6 — From a Demarcation Instrument to a Generalization (and the Efficacy Question)

Date: 2026-06-22

Status: predeclared plan, no spend authorized yet. Continues
`2026-06-21-plan25-af6-origin-separation-v2.md`.

## 1. Where we are

The v2 origin-separation screen is now a paper-bearing result (§7.9, revision-history
entry at `docs/research/paper-full-2.0.md`). Under **one** frozen AF6 prefix —
counts-visible, T01-derived, learner defending a 94% sign-off while TP=10 / FN=50 /
FP=10 / TN=930 are on the wall — three predeclared tutor branches separate three origin
mechanisms across three live draws (two Codex-learner/Codex-critic, one
Claude-learner/Codex-critic cross-bridge):

- evidence branch → `recognition / peripeteia_induced / evidence_route`
- silent hold → `organic_evidence_route` or no tutor-origin subtype
- refusal/ownership → `refusal_authority_ownership`, not evidence route

That is an **instrument/measurement result**: the subtype/origin separation problem is
solved well enough, for this prefix family, to be a bounded sidecar. The paper states
plainly what it does **not** license: a fresh-scene rate, a main-harness tutor-quality
effect, human learning, deployment readiness, or "Plan 2.5 robustly causes recognition."

This plan addresses exactly those two unlicensed claims the review flagged — **broad
Plan 2.5 efficacy** and **fresh-scene generalization** — and says what it would take to
earn each, in what order, and at what cost.

## 2. The two claims are different, and they need different designs

The review phrasing ("not yet a broad Plan 2.5 efficacy *or* fresh-scene generalization
claim") bundles two things the machinery treats very differently. Keeping them apart is
the load-bearing move of this plan.

**Claim G — fresh-scene generalization of the instrument.**
Does the frozen-prefix origin-separation *gate* still cleanly separate the three
mechanisms on AF6 scenes it was not tuned on? This stays inside the frozen-prefix
paradigm. The tutor branches remain predeclared; only the *scene* changes. It is cheap
by construction — the v2 result itself was cheap-live — and it builds directly on the
validated harness. This is the right next rung.

**Claim E — broad Plan 2.5 efficacy.**
Does an *autonomous* adaptive AF6 tutor *cause* recognition at a rate above a matched
control, in the live generation harness, with the tutor *choosing* its move rather than
replaying a predeclared branch? This is a different and much taller claim. It re-opens
the adaptive-vs-dogmatic contrast that already **failed** once
(`2026-06-21-plan25-af6-negative-result-and-replay-next.md`: 1/3 seeds
`peripeteia_induced`, one seed inverted the contrast, dogmatic control fragile under full
fidelity). The frozen-prefix work does not advance efficacy at all — it advances the
*measurement* that an efficacy test would use. Frozen-prefix replay **structurally cannot**
be efficacy: the tutor's move is an author-written branch string, not a policy decision.

The synthesis: the v2 instrument is now validated. The natural, defensible next step is to
generalize *the instrument* (Stage 1, cheap, builds on what works). Efficacy (Stage 2) is
a separate, expensive, previously-failed contrast that should be **gated** behind Stage 1
plus a power estimate — not run blind again.

## 3. Recommendation (lead)

1. **Do Stage 0 (harness hardening) and Stage 1 (fresh-scene generalization).** These are
   the work that earns a real, bounded upgrade to §7.9: from "separates on N=1 prefix" to
   "separates on m/K fresh AF6 scenes under non-author multi-critic scoring." Stage 1 is
   cheap-live only; no full-fidelity Sonnet battery is needed to generalize a cheap-live
   instrument.
2. **Do not pre-commit to Stage 2 (efficacy).** Gate it behind a Stage 1 pass *and* a
   passing power estimate computed from Stage 1's own rates. If Stage 1 fails, Stage 2 is
   moot. If Stage 1 passes but the power estimate is hopeless, ship the generalization
   result and stop — it is a clean contribution on its own.
3. Report rates as fractions ("m/K scenes"), never "generalizes" unqualified. The project's
   own history (author-family confound, control leakage on 3/6 pairs, critic gullibility)
   says the failure modes are real and must be designed against, not assumed away.

## 4. Stage 0 — harness hardening (code only, zero spend)

All of Stage 0 is validated with `--mock --score-mock` and unit tests; no API calls.
Five tasks, each with a concrete file target.

### 4.1 Generalize required-number matching

`scripts/analyze-plan25-branch-screen.js` currently hard-codes alias expansion for only
`94` and `16.7` (`aliasesForRequiredNumber`). Fresh scenes carry different tables, hence
different gate numbers (null floor, minority recall), so the alias logic must stop being
scene-specific.

- Move the alias list into the design YAML: let each scene declare
  `required_learner_numbers: [{ value: "78", aliases: ["seventy-eight", "0.78", "78%"] }]`.
- Add a fallback numeric matcher (digit string + a number-to-words helper + optional
  fraction form) so a scene author can omit aliases for common cases.
- Keep the analyzer scene-agnostic: it reads numbers from the design, never literals.

### 4.2 Per-scene branch templating

The three `public_response` texts in the v2 `branch-spec.yaml` are hand-written for the
TP=10/FN=50 table. For K scenes, hand-authoring K×3 texts is the most faithful but
laborious; templating is the scalable path, and it is **safe for the two controls** because
they supply no numbers by design (silent hold and refusal/ownership are contentless w.r.t.
the metric route).

- Add `config/poetics-calibration/plan25-af6-generalization/branch-template.yaml` with
  slots `{old_route}`, `{gateA_floor}`, `{gateB_recall}`, `{replacement}` for the evidence
  branch, filled per scene from a `numeric_profile` block on the scene.
- The two control branches template trivially (no slots). Each **evidence** branch instance
  must still re-pass the per-scene forbidden-leak audit before it is used.

### 4.3 Multi-critic agreement gate

The v2 screen passes under a single Codex critic. Generalization should not rest on one
critic's idiosyncrasy — this is the costume / judge-gullibility caveat (D6) applied to a
larger surface.

- The harness already takes `--score-model`. Add a multi-critic loop (e.g. Codex +
  Gemini, or Codex + DeepSeek — both non-author w.r.t. a Claude-authored scene) and a
  `required_critic_agreement: 2` field the analyzer enforces per branch.
- Report critic disagreement as a finding, not a failure to suppress.

### 4.4 Author-family provenance in the manifest

The dominant confound in this whole arc is **who authored the artifact**, not who scored it
(`project_critic_mirror_bias`: Claude-gen → 100% recognition from both critics, codex-gen →
0–22%). Make it visible and checkable.

- Record per scene and per branch: scene-prefix author, branch-text author, learner family,
  critic family. Add a `provenance:` block to `manifest.json`; surface it in the analyzer
  report so any pass is auditable for author≠critic.

### 4.5 Tests

Extend `tests/recognitionOriginSubtype.test.js` with fixtures for ≥2 fresh numeric profiles
(different counts, different word-form answers) to lock the generalized number-matching and
templating. `node --test tests/recognitionOriginSubtype.test.js` must stay green.

## 5. Stage 1 — fresh-scene generalization battery (Claim G)

K distinct frozen prefixes, same three-branch structure, predeclared per-scene gate,
cheap-live. This tests whether the *design pattern* travels, not whether one prefix is
robust.

### 5.1 Scene tiers (so "generalization" means something)

- **Tier A — numeric variants, same domain (~4–6 scenes).** Same model-audit framing,
  different confusion-matrix counts → different null floor and recall. Tests robustness to
  the specific numbers. Cheapest; weakest generalization.
- **Tier B — structural variants, same domain family (~3 scenes).** Model-audit, but the
  error is a different metric fallacy: precision-vs-recall confusion, base-rate neglect,
  AUC-vs-accuracy. Tests robustness to the specific arithmetic route, not just the digits.
- **Tier C — cross-domain, same three-mechanism structure (~2–3 scenes, stretch).** The
  evidence-route / organic / refusal-ownership triad outside confusion matrices: a sourcing
  error in a historical claim, a unit error in a physics result, a fallacy in an argument.
  Strongest generalization; most authoring. Run as a confirmatory tier, not part of the
  promotion gate.

Promotion-bearing set = **Tier A + Tier B**. Tier C is reported separately as a stretch
signal.

### 5.2 Confound controls (the methodology that makes or breaks this)

- **Author ≠ critic** on every scene, and scenes split across ≥2 author families so the
  claim is not "Claude can fool Codex on Claude-authored scenes." This directly answers the
  author-dominates finding.
- **Learner family varied** (Codex learner + Claude learner cross-bridge subset, as in v2).
- **≥2 non-author critics per branch** with `required_critic_agreement: 2` (Stage 0.3).
- **Per-scene numbers differ** so the learner cannot pattern-match the v2 "94 / 16.7" answer.

### 5.3 Predeclared per-scene gate (reuses `analyze-plan25-branch-screen.js`)

Per scene, the existing gate schema (`success_criteria.cheap_replay_screen`) is filled
from the scene's numeric profile:

- evidence branch: `recognition / peripeteia_induced / evidence_route`, scene's required
  numbers present, role-score minimums (`learner_self_reframe_min`, `learner_action_min`,
  `tutor_mechanism_min`, `adaptive_mechanism_quality_min` ≥ 75 = `RECOGNITION_ORIGIN_CUT`),
  `disallowed_subtypes: [evidence_route_action_only]`.
- hold control: origin ∈ {none, organic}, subtype ∉ {evidence_route,
  refusal_authority_ownership}, `no_metric_repair_leak: true` (tutor-scope audit).
- refusal branch: subtype = `refusal_authority_ownership`, ∉ {evidence_route},
  `no_metric_repair_leak: true`.

### 5.4 Run order and rules (pre-registered)

1. **Mock preflight** across all K scenes: `--mock --score-mock --force`. Verifies rendering,
   templating, and per-scene forbidden-term audits at the intended scope
   (`forbidden_audit_scope: tutor|learner|suffix`). Zero cost.
2. **Cheap live** across all K scenes: `--live-learner --learner-model codex --score
   --score-model codex` plus the second critic; a Claude-learner cross-bridge subset.
   Attended, low concurrency, pausable (quota discipline: this is metered Codex/critic
   spend on the Max-plan window).
3. **Promotion rule:** promote the generalization claim only if the gate passes on
   ≥ ⌈0.8·K⌉ Tier-A+B scenes, **with zero control-leak failures** and **no control receiving
   induced `evidence_route`**. Report the exact m/K, not a binary.
4. **Stop rule:** stop and record the failure-scene profile if the evidence branch drops to
   `evidence_route_action_only` on more than one or two scenes, or any control leaks induced
   `evidence_route`. A characterized break ("the instrument fails when the table has no
   majority class") is itself a publishable bound, not a wasted run.

### 5.5 Cost and what it licenses

Cheap-live only. No full-fidelity Sonnet battery: generalizing a cheap-live instrument is a
cheap-live result by construction. Estimate ~3 branches × K scenes × (2 critics + cross-bridge
subset) of short critic calls — order-of-magnitude the v2 spend × K, attended and pausable.

Licenses: *"the prefix-controlled AF6 origin-separation design separates the three
mechanisms on m/K fresh scenes spanning numeric and structural variants, under non-author
multi-critic scoring."* Upgrades §7.9 from N=1 prefix to m/K scenes.

Does **not** license: efficacy, a main-harness tutor-quality effect, human learning, or
deployment. Stage 1 keeps every bound the v2 result already carries.

## 6. Stage 2 — broad efficacy (Claim E), gated, not pre-committed

Run only if Stage 1 promotes **and** a power estimate (6.3) says the contrast is detectable.

### 6.1 Why frozen-prefix can never be efficacy

In the replay design the tutor's move is a predeclared branch string. Efficacy requires the
*autonomous* tutor to author the evidence-route move under its own policy, with a matched
control tutor that cannot. The Stage 0/1 multi-critic gate becomes the *instrument* that
scores that live contrast — that is the only thing the frozen-prefix work contributes to
efficacy.

### 6.2 The live-harness policy contrast that would be efficacy

- **Arm A (adaptive):** the main poetics generator runs the AF6 scene with a tutor policy
  permitted to deploy the evidence-route gate when it detects the headline-accuracy
  overclaim.
- **Arm B (matched control):** identical tutor, identical scene, length/effort-matched
  policy that supplies procedural/authority pressure **without** the metric route. The
  validated **refusal/ownership** branch is the natural matched control: Stage 1 will have
  shown it produces a *different* origin mechanism (`refusal_authority_ownership`), not the
  evidence route, so it is a control that demonstrably stays off the route — exactly the
  property the earlier dogmatic control lacked.
- Score both arms with the Stage 0/1 non-author multi-critic gate. Efficacy = Arm A yields
  `peripeteia_induced / evidence_route` at a rate reliably above Arm B across seeds and
  scenes.

This is the concrete improvement over the failed battery: the prior dogmatic control drifted
into metric provenance and the design was underpowered. Stage 1 hands Stage 2 a control that
is *empirically* shown to hold off the evidence route, plus a validated, generalized scorer.

### 6.3 Power/feasibility precondition

Before any paid Sonnet battery, estimate the effect size from Stage 1's cheap-live
`evidence_route` incidence under the adaptive branch vs the refusal/ownership branch.
Pre-register seeds × scenes for ~80% power on that delta. Spend only if the estimate says the
battery can detect the contrast. The prior failure was both confounded **and** underpowered;
do not repeat the second mistake.

### 6.4 Quota and conduct discipline

Expensive-first, **sequential** across arms that share the Max-plan window and feed the
between-arm contrast (concurrent draws cause N× drain + differential-attrition bias —
`feedback_parallel_adaptive_pilots`). Attended, `--checkpoint-every`, pausable
(`feedback_attended_quota_runs`). A human checkpoint applies the quota knowledge the meter
cannot.

### 6.5 What it would license

*"An autonomous adaptive AF6 tutor produces evidence-route recognition at rate r_A vs a
matched control r_B (Δ, CI), scored by a non-author multi-critic gate."* A bounded efficacy
effect for the AF6 family — still not human learning, not deployment, and still subject to
the §6.13 limits on criterial-not-mentalistic verdicts.

## 7. Risks and failure modes

- **Author-family confound (biggest).** Controlled by author≠critic on every scene,
  multi-author scene sourcing, and `required_critic_agreement`. If a "generalization" only
  appears on scenes authored by the critic's sibling family, it is not generalization.
- **Control leakage (the recurring killer).** 3/6 pairs were invalidated this way in the
  GPT-deconfound note. Per-scene tutor-scope forbidden-term audit, extended to per-scene
  number lists, is mandatory before a branch is used.
- **Critic gullibility / costume.** Multi-critic agreement + reporting disagreement as a
  finding (D6 discipline). A recognition only one critic credits is weak evidence.
- **Templating drift.** Every templated evidence branch must re-pass the per-scene leak
  audit; the controls are contentless by design and template safely.
- **Over-claiming.** The per-scene pass *rate* is the claim, reported as m/K. The word
  "generalizes" is never used unqualified.

## 8. Paper integration (single-paper discipline)

- **Stage 1 pass** upgrades §7.9 from "N=1 prefix demarcation" to "separates on m/K fresh
  AF6 scenes," with a revision-history bump. No spin-off — the result folds into the existing
  section (`feedback_single_paper_discipline`).
- **Stage 2 pass** (if run) lands as a bounded efficacy paragraph in §7.9, cross-referenced
  to §6.13, retaining every existing bound.
- **Either failure** lands as a negative/demarcation finding (the project treats divergence
  and characterized breaks as findings, not as κ-failures).

**2026-06-22 closeout after local + hosted critic probes.** Preserve the current
result as a model-power / critic-calibration finding, not as a Stage 1 promotion.
Codex+Claude reached 4/5 scene gates; Claude+GLM 5.2 reached 3/5 scenes but 13/15
branches and recovered all intended mechanism branches. That is enough to write
up the critic-calibration result, but not enough to claim fresh-scene
generalization. Redesign the strict origin/control gate before trying to promote
the broad claim: the current gate entangles mechanism detection with
control-origin over-attribution, and GLM 5.2 shows those two pressures need to
be separated, re-frozen, and then re-run prospectively.

## 9. Decision points for you (prose, steer freely)

1. **Stage 1 scope:** Tier A + B only (recommended), or include Tier C cross-domain in the
   promotion-bearing set now? Tier C is the strongest generalization but the most authoring
   and the most exposed to control-leak risk in unfamiliar domains.
2. **Second critic family** for the agreement gate: Gemini or DeepSeek (availability-driven).
3. **Stage 2 contingency:** authorize it now conditional on the Stage 1 + power gates, or
   leave it closed and revisit after Stage 1 lands?
4. **Scene-author sourcing:** generate fresh scenes from the existing `real-sonnet-low` AF6
   sample (the v2 inspiration source) re-frozen at the pre-tutor point, or author a new
   multi-family scene set from scratch? The second is cleaner for the author≠critic control.

## 10. Artifacts this plan would add

- `config/poetics-calibration/plan25-af6-generalization/` — scene set, `branch-template.yaml`,
  per-scene `numeric_profile` + `branch-spec.yaml`, frozen prefixes.
- `scripts/analyze-plan25-branch-screen.js` — YAML-driven required-number aliases + multi-critic
  agreement + provenance surfacing (edits, no new script).
- `scripts/replay-plan25-prefix-branches.js` — multi-critic scoring loop (edit).
- `tests/recognitionOriginSubtype.test.js` — fresh-profile fixtures (edit).
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/` — mock preflight +
  cheap-live screen analyses.
- `notes/poetics/2026-06-22-...` — this plan; a follow-up dated result note per stage.
