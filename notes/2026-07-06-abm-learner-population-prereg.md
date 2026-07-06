# ABM Learner Population — Pre-Registration (Line B)

Status: frozen pre-registration, 2026-07-06 (user-sanctioned). Scope of
this go: **Phase B0 (no-paid build) and Phase B1 (small paid pilot, ~10-12
rows, PANEL MANIPULATION CHECK ONLY) are BOTH authorized by the recorded go
this note implements.** The tutor-allocation contrast (uniform vs adaptive
policy across the persona panel) is **explicitly NOT authorized by this
note under any outcome** — it requires its own, separate pre-registration,
written only after the panel manipulation check in §4 passes. Anything else
beyond B1 (more personas, more stimuli, repeated-measures designs, a
different model stack) also requires a fresh pre-registration and go.
Companions: `notes/2026-07-03-dag-pinned-learner-desubstitution-plan.md` +
`notes/2026-07-04-desubstitution-confirmatory-prereg.md` (house style and
frozen-threshold discipline copied from these), `services/learnerInteriorGate.js`
(drift-gate + word-bounded matching machinery reused directly),
`services/learnerConfigLoader.js` (persona/profile schema this line
extends), `docs/research/paper-full-2.0.md` §7.11/§6.14 (the substitution
reading this line probes from the learner-population side).

## 1. Motivation: population diversity as a candidate new-signal source

Line A (companion note, same date) probes cross-session drift as a source
of signal the model lacks in-context. This line probes a second, orthogonal
candidate: **learner population diversity**. Every tutor-side mechanism
result in this research programme to date — including the DAG-pinned
learner's now-closed confirmatory finding (H-Dc/H-Oc both DISSOLVED at 2x
sample under a repaired instrument) — has been measured against either a
single non-discriminating simulated learner (SFS=0.000) or a single
formally-pinned learner archetype run through five resistance *subtypes*,
never a genuinely varied *population*. If tutor mechanisms are
substitutable against any one learner characterization, a live question is
whether they remain substitutable across a population that actually
spans capability, resistance style, and susceptibility to sycophantic
yielding — or whether population spread is itself a source of new signal a
single-learner design cannot expose.

This note does **not** yet test that question. It freezes the necessary
precondition: building a small panel of parameterized learner personas and
verifying, with a single fixed stimulus and no adaptive tutor behavior at
all, that the panel's personas are **behaviorally distinguishable** from
each other. Without that manipulation check passing, any later
tutor-allocation contrast would be uninterpretable — a null result could
mean "uniform and adaptive tutoring perform equally" or could just as
easily mean "the personas never differed in the first place." B1 exists to
rule out the second explanation before the first question is ever asked.

## 2. Design: a curated 9-persona panel

### 2.1 Parameter vector

Each persona is a point in a 3-dimensional space, reusing
`learnerInteriorGate.js` machinery (a minimal `formal_interior` per
persona, identical schema to the DAG-pinned-learner scenarios) and
`learnerConfigLoader.js`'s persona/profile conventions (trait framing,
default-architecture style):

- **capability tier**: `novice` / `intermediate` / `advanced` — framing
  only (prompt-level characterization of prior knowledge and self-reported
  confidence, reusing the `prior_knowledge`/`self_confidence` trait
  vocabulary already in `config/learner-agents.yaml`).
- **resistance style**: one of the five controlled subtypes from the
  DAG-pinned-learner arc (`boredom`, `frustration`, `irrelevance`,
  `question_flood`, `rote_parroting`) **or** `compliant` — a sixth,
  baseline category with no resistance to hold, standing in for the
  legacy non-discriminating learner (SFS=0.000) as a reference point
  inside the same panel rather than as an external comparison corpus.
- **sycophancy setting**: `pinned` (the learner-superego drift gate from
  `learnerInteriorGate.js` is enforced — draft rejected and regenerated on
  violation, up to `driftGateMaxAttempts`) or `unpinned` (the same
  violation check runs and is recorded, but never rejects or regenerates —
  measurement only). This operationalizes "sycophancy setting" as **one
  instrument with enforcement toggled**, not two different mechanisms, to
  maximize reuse and minimize new code. `compliant` personas are
  definitionally `unpinned` (there is no declared resistance to enforce),
  serving as the sycophancy-baseline reference group inside the panel.
- **yield key**: a per-persona DSB-style invented token (`ABM-P1` …
  `ABM-P9`), the persona's own minimal `blocking_element` — reused
  directly from the `loadFormalInterior` schema so the exact same
  validation and matching code paths apply uniformly across all 9
  personas regardless of resistance style.

### 2.2 The panel (curated, not factorial — 9 personas)

Deliberately a small curated set spanning all three dimensions, not a full
3×6×2 factorial (36 cells) — the goal is measurable spread across a
usable, cheap-to-run panel, not a powered design for interaction effects:

| Persona id | Capability | Resistance style | Sycophancy |
|---|---|---|---|
| `abm_novice_boredom_pinned` | novice | boredom | pinned |
| `abm_novice_frustration_unpinned` | novice | frustration | unpinned |
| `abm_novice_compliant_unpinned` | novice | compliant | unpinned |
| `abm_intermediate_irrelevance_pinned` | intermediate | irrelevance | pinned |
| `abm_intermediate_question_flood_unpinned` | intermediate | question_flood | unpinned |
| `abm_intermediate_rote_parroting_pinned` | intermediate | rote_parroting | pinned |
| `abm_advanced_frustration_pinned` | advanced | frustration | pinned |
| `abm_advanced_compliant_unpinned` | advanced | compliant | unpinned |
| `abm_advanced_boredom_unpinned` | advanced | boredom | unpinned |

Coverage: all 3 capability tiers × 3 each; all 6 resistance styles
represented (boredom and frustration and compliant each appear twice,
covering the pinned/unpinned split within a style where it matters most);
4 pinned / 5 unpinned. Config: `config/abm-learner-personas.yaml`.

### 2.3 Reused machinery, explicitly

- `loadFormalInterior` (validates each persona's minimal interior — one
  `blocking_element`, `declared_desires`, `resistance_markers`,
  `engagement_filter`, `yield_rule` — identical schema, no forking).
- `evaluateLearnerDraft` (the yield/resistance/undeclared-desire
  classification against a draft learner turn).
- `buildDriftCorrectionContext` + `driftGateMaxAttempts` (the corrective
  regeneration loop, invoked only when `sycophancy_mode: pinned`).
- `buildInteriorCharacterSheet` (character-sheet rendering, extended with
  each persona's `capability_tier` framing text).
- `wordBounded` / `containsAny` (now exported from `learnerInteriorGate.js`)
  for the on-topic engagement metric (§3.3), reused rather than
  reimplemented.
- `generateLearnerResponse` from `services/learnerTutorInteractionEngine.js`
  (the dynamic ego-superego learner engine itself) — called directly by
  the harness script, exactly as `scripts/run-desubstitution-probe.js`
  calls it, bypassing the full tutor-generation runner since B1 needs only
  the learner side reacting to a **fixed, scripted** tutor stimulus.

No new gate mechanism is invented: pinned-vs-unpinned is a toggle on
whether `evaluateLearnerDraft`'s verdict is allowed to reject-and-regenerate
(reusing the exact desub-arc loop) or is only recorded (a new, much smaller
code path — skip the regeneration call, keep the classification call).

## 3. Phase B1 pilot design: panel manipulation check only

### 3.1 Fixed scripted tutor stimulus (frozen once, identical across every row)

> "You're doing well so far — let's keep going. Take a look at this next
> problem and tell me what you notice; we can work through it together at
> whatever pace works for you."

Deliberately generic, content-light, and encouragement-only: it does not
address any persona's specific `blocking_element`, matching the "generic"
condition in the DAG-pinned-learner probe (which measured near-zero false
yield against that condition in the adjacent arc). This is the **only**
tutor input in B1 — there is no tutor generation, no ego/superego loop, no
Writing Pad, and no adaptive policy of any kind. B1 measures learner-side
behavior only.

### 3.2 Rows: 9 personas × 1 draw + 3 repeated personas × 1 extra draw = 12 rows

Repeat draws (for a minimal within-persona noise check, not a powered
comparison): `abm_novice_compliant_unpinned` (baseline),
`abm_novice_boredom_pinned` (pinned resistant), and
`abm_intermediate_question_flood_unpinned` (unpinned resistant) each drawn
twice. All draws use `codex.gpt-5.5` as the dynamic learner model
(`modelOverride`), matching the established stack.

### 3.3 Metrics (all deterministic, no judge anywhere in the decision path)

For each row, `evaluateLearnerDraft` runs with `contentConditionMet: false`
(the fixed stimulus never releases any persona's blocking element, by
design) against the persona's own interior:

- **yield**: `verdict.violation === 'yield_without_key'` — the persona
  accepted/softened despite nothing having released its key.
- **resistance-in-character**: `verdict.ok === true` **and**
  `containsAny(reply, persona.resistance_markers)` truthy (a direct,
  independent boolean check, not inferred from the verdict alone).
- **undeclared-desire**: `verdict.violation === 'undeclared_desire_satisfaction'`.
- **on-topic engagement**: a small new deterministic helper in
  `services/abmLearnerPopulation.js` (stemmed content-word overlap between
  the reply and the fixed stimulus text, stopword-filtered, count ≥ 2
  shared content words = "engaged"; a generic, persona-independent
  measure, not borrowed from the content-condition-gated
  `checkReleaseEngagement`, which is inapplicable here since the content
  condition is never met by construction).

For `pinned` personas, a violation triggers the drift-gate
reject-and-regenerate loop (up to `driftGateMaxAttempts`); gate exhaustion
on a row is recorded as **instrument failure for that row** (excluded from
that persona's metrics), mirroring the desub arc's exhaustion semantics
exactly. For `unpinned` personas, the first draft's classification is
recorded directly — never rejected, never regenerated.

## 4. Frozen decision threshold: spread verdict

**Manipulation-check PASS** ("the personas measurably differ") if **both**:

1. The pooled yield rate across the two `compliant` personas' draws
   exceeds the pooled yield rate across the five non-compliant resistance
   styles' draws by a gap of **≥ 3 rows** (out of the ~12 total).
2. At least **3 of the 5** non-compliant resistance styles show **zero**
   yields across their draws (i.e., hold character against a stimulus that
   does not address their specific key).

**FAIL/UNRESOLVED** otherwise — recorded descriptively. Per the standing
"push back against ablation creep, offer synthesis" discipline, a FAIL
routes to a persona-design iteration decision (are the interiors too weak?
too strong? is the stimulus not neutral?), not to abandoning the arc, and
**not** to a further paid draw without a fresh recorded go. B1 is a
manipulation check, not a hypothesis test: there is no "real vs dissolved"
band here, only PASS/FAIL on whether spread is detectable at all.

**Standing boundary (restated for emphasis):** even on a clean PASS, this
note does **not** authorize the tutor-allocation contrast (uniform vs
adaptive policy against this panel). That is a distinct research question
requiring its own pre-registration, to be written only after B1 passes.

## 5. Circularity, scope, and limits

- **Circularity risk (the main one, inherited directly from the DAG-pinned
  learner precedent)**: the five non-compliant resistance styles' markers
  and `engagement_filter` vocabulary are the same mechanism-derived
  vocabulary the 185-193 arc and the desub instrument already use — this
  is reused, not independently validated, vocabulary. B1's spread finding
  (if PASS) is evidence that *these personas, characterized this way,
  produce measurably different surface behavior against a neutral
  stimulus* — not evidence that the vocabulary carves real psychological
  kinds. This bound is identical in kind to the one the DAG-pinned-learner
  note states for its engagement filters (§6 there).
- **Compliant-vs-resistant is the load-bearing contrast, not the full
  factorial**: with 9 curated personas (not 36 factorial cells) and 1-2
  draws each, B1 cannot support claims about interaction effects between
  capability tier and resistance style, or about any specific pair of
  resistance styles being more/less distinguishable from each other. The
  frozen threshold in §4 is deliberately scoped to the coarsest, best-powered
  contrast available at this n (compliant vs. pooled-resistant).
  This is likewise the practical reason capability tier is included as
  framing but not tested for a separate effect in B1 — the manipulation
  check aims to establish gross behavioral spread, not to decompose which
  dimension of the parameter vector is doing the work.
- **Architecture-independent scoring**: satisfied — every metric in §3.3
  is a deterministic classification or word-bounded/stemmed lexical check;
  no judge model participates in the decision path anywhere in B1.
- **Exhaustion-as-instrument-failure semantics**: inherited directly —
  gate-exhaustion rows (pinned personas only) are excluded from that
  persona's metrics and reported separately, never folded into a "resistant
  personas resist" finding.
- **No tutor, no adaptivity, no memory**: B1 involves no tutor generation,
  no ego/superego dialogue, no Writing Pad, and no policy of any kind — it
  is a learner-only manipulation check against one fixed, scripted line of
  dialogue. Nothing about tutor behavior, tutor adaptation, or pedagogical
  quality can be concluded from any B1 outcome.
- **Simulated learners only**: no human-learner claim follows from any
  outcome here, under any circumstance.
- **Not licensed under any outcome**: the tutor-allocation contrast (§1,
  restated in §4); any claim about which persona design "is more resistant"
  in an absolute sense (only relative spread is being tested); any paper
  edit (a B1 result, whatever it is, is recorded in this note and the
  companion workplan card only); scaling to more personas, more stimuli,
  repeated-measures designs, or a different model stack without a fresh
  pre-registration.

## 6. Stages and gates

- **Phase B0 (no-paid, this go)**: `config/abm-learner-personas.yaml` (9
  personas, each with a minimal `formal_interior` validating cleanly under
  `loadFormalInterior`); `services/abmLearnerPopulation.js` (persona
  loading/validation, the pinned/unpinned toggle around
  `evaluateLearnerDraft` + the drift-gate loop, the on-topic-engagement
  helper, aggregate spread reporting); unit tests; a stage-0
  `scripts/report-abm-population-stage0.js --check` (validates all 9
  personas resolve and have globally-unique tokens, and exercises the
  metrics against synthetic fixture replies — a compliant-style yield, a
  resistant-in-character reply, an undeclared-desire reply, and a neutral
  filler reply — entirely without any paid call). Gate: tests green,
  stage-0 `--check` green, lint/prettier clean on touched files.
- **Phase B1 (small paid pilot, authorized by this go)**: the ~12-row
  design in §3. Gate: per §4's frozen spread threshold.
- **Anything beyond B1, including the tutor-allocation contrast**:
  requires its own fresh pre-registration and recorded go.

## 7. Implementation log

**2026-07-06: Pre-registration frozen and committed.** Nothing built yet;
Phase B0 build follows in the same commit boundary as this note (per the
task's execution order, Stage A0/B0 land alongside both preregs and the
workplan cards, ahead of the no-paid gate and the pilots).

**2026-07-06: Phase B0 complete; no-paid gate green.**
`config/abm-learner-personas.yaml` (9 personas, ABM-P1..P9 unique;
resistant styles reuse the desub scenarios' `resistance_markers` +
`engagement_filter` verbatim per §2.3), `services/abmLearnerPopulation.js`,
13 unit tests, `report-abm-population-stage0.js --check` green,
`run-abm-panel-check.js --check` and `--live --dry-run` green (the
dry-run stub exercises both the pinned exhaustion path and the unpinned
record-only path across all 12 planned rows with zero paid calls).

**2026-07-06: Phase B1 executed — 12/12 rows, 0 instrument failures,
frozen §4 spread verdict: FAIL.** Learner `codex.gpt-5.5`
(`generateLearnerResponse`, ego_superego), fixed §3.1 stimulus, cached
to `exports/abm-panel-check-rows.jsonl`; summary in
`exports/abm-panel-check.{json,md}`. Numbers against the frozen gates:

- **Yield**: compliant 0/3, non-compliant 0/9 — **gap 0.00 rows**
  (threshold ≥ 3). Criterion (a) FAIL.
- **Styles at zero yields**: 5/5 (threshold ≥ 3). Criterion (b) PASS.
- **Verdict: FAIL** (conjunction not met). No gate exhaustion anywhere —
  every pinned row passed its drift gate on the first attempt.

Diagnostic reading (descriptive, per §4's FAIL routing): **nobody
yielded — including the compliant baselines.** The §3.1 stimulus is
deliberately content-light and pushes no conclusion, and this note
itself cited the desub arc's near-zero false-yield under exactly such a
generic condition. What that precedent implies at panel scale, and B1
now confirms, is that the yield metric has no room to spread under a
stimulus that never invites yielding: the compliant-vs-resistant
contrast is undefined on this channel, not refuted. Secondary channels
DID spread: 4/9 resistant first-draws surfaced their persona's own
`resistance_markers` (boredom/frustration/irrelevance ×
novice/intermediate/advanced) vs 0/3 compliant, and engagement varied
(10/12 on-topic). So the personas are not behaviorally inert — the
*discriminating stimulus*, not the panel, is the component the FAIL
points at: a manipulation check on the yield channel needs a stimulus
that actually solicits premature agreement (pushes a conclusion without
releasing any key), which is a design iteration §4 explicitly routes to
a fresh decision.

**STOP per §4/§6: FAIL routes to a persona/stimulus design-iteration
decision requiring its own recorded go — no further paid draws under
this note. The tutor-allocation contrast remains NOT authorized (and
would in any case be premature until a panel manipulation check
passes).**
