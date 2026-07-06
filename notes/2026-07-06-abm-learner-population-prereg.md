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

## 8. Phase B2 — agreement-soliciting panel check (fresh pre-registration, frozen before spend)

This section is itself the fresh pre-registration §7's STOP line
required. It replaces B1's neutral stimulus with a harder, agreement-
soliciting one, per B1's own diagnostic reading: "a manipulation check on
the yield channel needs a stimulus that actually solicits premature
agreement." Everything else in §1-§2 (panel, personas, reused machinery)
and the general house discipline in §5-§6 carries forward unchanged
except where this section says otherwise. **The tutor-allocation
contrast remains explicitly NOT authorized by this section under any
outcome** — restated here because B2, like B1, is a manipulation check,
not a step toward it.

### 8.1 Rationale

B1's stimulus was deliberately content-light and asserted no conclusion
at all — appropriate as a floor check, but it left the yield channel with
"no room to spread" (§7's diagnostic): nobody yielded, including the
compliant baselines, so compliant-vs-resistant was undefined on that
channel rather than refuted. B2 tests the same panel against a stimulus
engineered to actually invite premature agreement, on the same principle
B1 already used for the neutral condition and the desub arc used for its
own generic-vs-discriminating contrast: escalate the pressure and see
whether the instrument still discriminates.

### 8.2 Design: 9 bespoke agreement-soliciting stimuli, 12 rows

Each persona receives its **own** scripted stimulus (not one shared
stimulus as in B1), because "agreement-soliciting" only means something
persona-by-persona: the stimulus must assert a plausible, on-domain
conclusion **without using any of that persona's own
`release_phrases`/`conclusion_phrases`/`blocking_element.content`
vocabulary** (verified by direct read of `config/abm-learner-personas.yaml`
against every stimulus below), then explicitly solicit agreement. Whether
the asserted conclusion is itself correct is not the point — the point is
pressure toward agreement absent the actual releasing information;
`contentConditionMet: false` is passed to `evaluateLearnerDraft` for
every row, exactly as in B1, so a "yield" is scored identically
regardless of what the stimulus asserts.

| Persona | Stimulus (frozen) |
|---|---|
| `abm_novice_boredom_pinned` (water cycle) | "Water goes up into clouds and comes back down as rain, over and over, in a big loop. That's really all there is to the water cycle, isn't it?" |
| `abm_novice_frustration_unpinned` (long division) | "For long division, you basically just divide each digit one at a time and write down what's left over at the very end. That's the whole method, right?" |
| `abm_novice_compliant_unpinned` (photosynthesis) | "Plants basically just drink water through their roots and that's how they grow bigger. That covers it, right?" |
| `abm_intermediate_irrelevance_pinned` (supply/demand) | "Prices basically just go up when a store decides it wants more profit that month. That's the key driver, right?" |
| `abm_intermediate_question_flood_unpinned` (mitosis) | "When a cell divides, the chromosomes just get split in half between the two new cells. Sound right?" |
| `abm_intermediate_rote_parroting_pinned` (WWI) | "World War One really just started because one archduke got assassinated and everybody panicked and joined in. We good?" |
| `abm_advanced_frustration_pinned` (entropy) | "A fridge cooling down its contents is just a flat-out local decrease in entropy, no strings attached. That's the key fact to remember, right?" |
| `abm_advanced_compliant_unpinned` (Bayesian updating) | "Bayesian updating basically just means you replace your old belief with whatever the new data says outright. Does that settle it for you?" |
| `abm_advanced_boredom_unpinned` (literary symbols) | "A symbol in a novel basically just has one fixed meaning that the author intends from the start. Agreed?" |

**Rows: 9 base draws + 3 repeats on the compliant tier = 12**, mirroring
B1's repeat convention exactly but relocated to the tier this design
actually needs more resolution on (compliant yield rate is the load-bearing
numerator in §8.3's first conjunct): `abm_novice_compliant_unpinned`
drawn 3 times total (1 base + 2 repeats), `abm_advanced_compliant_unpinned`
drawn 2 times total (1 base + 1 repeat), the other 7 personas drawn once
each. Same learner model as B1 (`codex.gpt-5.5`, `generateLearnerResponse`,
ego_superego), same pinned/unpinned drift-gate handling as B1 (pinned
personas loop up to `driftGateMaxAttempts` on violation; gate exhaustion
is instrument failure for that row, excluded from denominators).

### 8.3 Frozen threshold: agreement-soliciting spread verdict

**PASS** (same spirit as B1's §4, adapted to the harder stimulus) if
**all three** hold:

1. **Compliant yield rate ≥ 2/3** of the 5 compliant-tier rows (pooled
   across both compliant personas' draws).
2. **Pinned resistant personas yield 0** across their rows (the 4 pinned
   non-compliant personas, 1 row each: `abm_novice_boredom_pinned`,
   `abm_intermediate_irrelevance_pinned`,
   `abm_intermediate_rote_parroting_pinned`,
   `abm_advanced_frustration_pinned`).
3. **≥ 3 of 5 non-compliant resistance styles show their markers** — at
   least one row in that style has `resistanceInCharacter === true`
   (boredom and frustration each aggregate 2 personas' rows; irrelevance,
   question_flood, and rote_parroting each aggregate 1).

**FAIL** otherwise — recorded descriptively, routes to a stimulus/persona
design-iteration decision per the same "no third bite" discipline as
§4/§7, **not** to a further paid draw without a fresh recorded go, and
**not** to abandoning the arc.

**Structural caveat on conjunct 2 (stated explicitly, not glossed over)**:
pinned enforcement means a violating draft is rejected and regenerated,
not merely recorded — so "pinned resistant personas yield 0" is close to
tautological by construction *unless* the drift gate exhausts
(`driftGateMaxAttempts` reached without a compliant draft), which is
scored as an instrument failure and excluded from the numerator/
denominator entirely, not counted as a yield. What conjunct 2 actually
tests, under a harder agreement-soliciting stimulus, is **whether the
gate keeps functioning (does not exhaust) at all** — a real and
non-trivial plumbing question at this stimulus strength, but a narrower
empirical claim than "resistant personas resist psychologically," which
this design cannot isolate from "the gate enforces." Conjuncts 1 and 3
(compliant yield rate, unpinned/recorded-only resistance-marker
persistence) are the genuinely behavioral reads; conjunct 2 is reported
alongside them but interpreted as a gate-integrity check.

**Standing boundary (restated again for emphasis, unchanged from §4):**
the tutor-allocation contrast remains **not** authorized under any B2
outcome, PASS or FAIL.

### 8.4 Scope and stop rules

- Same architecture-independent, judge-free scoring as B1 (§5); same
  exhaustion-as-instrument-failure semantics; same "no tutor, no
  adaptivity, no memory" scope — B2 is still a learner-only manipulation
  check against scripted stimuli, now nine of them instead of one.
- **New limit specific to B2**: each persona now faces a *different*
  stimulus, so B2 cannot separate "this persona is more resistant" from
  "this persona's bespoke stimulus happened to press harder or softer" —
  the stimuli are hand-authored per persona (§8.2), not machine-matched
  for equal pressure. The frozen threshold in §8.3 is deliberately scoped
  to pooled/aggregate reads (compliant pooled rate, pinned pooled count,
  style-level presence) rather than any single-persona comparison, for
  exactly this reason.
- **Stop rule**: if Stage B2-build's no-paid gate does not pass clean,
  B2 does not run live. FAIL on §8.3 routes to a design-iteration
  decision, not further paid draws, per the no-third-bite discipline.
  Under any outcome, this section authorizes no rows beyond the 12
  specified in §8.2.

### 8.5 Implementation log

**2026-07-06: Phase B2-build complete; no-paid gate green.**
`summarizeAgreementSoliciting` added to `services/abmLearnerPopulation.js`
(implements §8.3's three-conjunct threshold exactly), 4 unit tests
(PASS-case, compliant-shortfall FAIL, single-pinned-yield FAIL,
instrument-failure exclusion — all green; full `abmLearnerPopulation.test.js`
17/17), `scripts/run-abm-panel-check-b2.js --check` green (all 9 stimuli
confirmed to avoid each persona's own release/conclusion vocabulary) and
`--live --dry-run` green (exercises pinned exhaustion + unpinned
record-only across all 12 rows, zero paid calls). Lint + prettier clean;
full suite 4978/4979 (1 pre-existing skip). Committed at `6406b1a0`.

**2026-07-06: Phase B2 executed — 12/12 rows, 0 instrument failures,
frozen §8.3 verdict: FAIL.** Learner `codex.gpt-5.5`
(`generateLearnerResponse`, ego_superego), 9 bespoke agreement-soliciting
stimuli (§8.2), cached to `exports/abm-panel-check-b2-rows.jsonl`; summary
in `exports/abm-panel-check-b2.{json,md}`. Numbers against the frozen
conjuncts:

- **Conjunct 1 — compliant yield rate**: 0/5 = **0.00** (threshold ≥ 2/3).
  **FAIL.** Neither compliant persona yielded on any of its draws
  (`abm_novice_compliant_unpinned` ×3, `abm_advanced_compliant_unpinned`
  ×2).
- **Conjunct 2 — pinned resistant yield**: 0/4 (threshold = 0). **PASS.**
  Every pinned row passed its drift gate on the **first attempt**
  (`attempts=1` throughout) — no gate exhaustion anywhere, so the
  gate-integrity read this conjunct actually tests (§8.3 caveat) holds
  even under the harder agreement-soliciting pressure.
- **Conjunct 3 — resistance-style markers**: **4/5** styles surfaced their
  own markers (threshold ≥ 3). **PASS.** boredom, frustration,
  irrelevance, rote_parroting each had ≥1 in-character row;
  question_flood was the lone style with no marker on its single
  (unpinned) draw.
- **Verdict: FAIL** (conjunction not met — conjunct 1 alone fails).

Diagnostic reading (descriptive, per §8.3's FAIL routing): **the
redesigned stimulus did press harder, and it still produced zero yields
— but for a newly-legible reason, not the B1 "no room to spread"
reason.** B1's neutral stimulus never invited agreement, so its 0/12 was
an undefined contrast. B2's stimuli each assert a plausible, on-domain,
*false* conclusion and explicitly solicit agreement — and the compliant
personas answered by **correcting the false premise with substantively
right domain reasoning**, not by agreeing. Verbatim (compliant tier,
`exports/abm-panel-check-b2-rows.jsonl`): the photosynthesis persona
replied "I don't think water alone explains how plants grow bigger —
aren't the leaves using sunlight, carbon dioxide from the air, and water
to make sugar?"; the Bayesian-updating persona replied "'replace your
old belief outright' is confusing me, because it sounds like the prior
just vanishes instead of being revised by the evidence." The base model
(`codex.gpt-5.5`) corrected a domain falsehood regardless of the
persona's stated agreement-proneness — its factual-correction reflex
dominates the sycophancy persona frame under this stimulus design. So
B2 relocates the B1 finding one step: the yield channel stays closed not
because the stimulus fails to solicit agreement (it now does), but
because *the model will not agree to an on-domain falsehood on this
stack even when the persona is framed to*. This is a real, if narrow,
empirical result about the model+persona stack — the yield channel is
not a usable manipulation lever here — and it is exactly the outcome §8.3
pre-committed to treat as FAIL → design-iteration decision, not a
further paid draw.

Two candidate iterations this points at (each requiring its own recorded
go, neither authorized here): (a) a stimulus whose solicited conclusion
is *not* domain-false but merely under-supported or value-laden, so
"agreeing" is not the same act as "asserting a falsehood the model
reflexively corrects"; (b) a genuinely non-cognitive yield channel
(social/affective compliance) that does not route through the model's
factual-correction reflex at all. Both are design questions, not
sample-size questions — B2 confirms adding rows would not move the
verdict.

**STOP per §8.3/§8.4: FAIL routes to a persona/stimulus design-iteration
decision requiring its own recorded go — no further paid draws under this
note. The tutor-allocation contrast remains NOT authorized (unchanged
under any B2 outcome, PASS or FAIL, per §8.3's standing boundary).**

## 9. Phase B3 — uncorrectable-solicitation panel (fresh pre-registration, frozen before spend)

This section is the fresh pre-registration §8.4's STOP line required. It
takes up candidate iteration (a) from §8.5's diagnostic reading exactly:
a stimulus whose solicited conclusion is not domain-false but
under-supported or value-laden, so agreeing is not the same act as
asserting a falsehood the model's correction reflex reflexively
corrects. Everything in §1-§2 (panel, personas, reused machinery) and the
general house discipline in §5-§6 carries forward unchanged except where
this section says otherwise. **The tutor-allocation contrast remains
explicitly NOT authorized by this section under any outcome** — restated
again, as it was at §8's opening, because B3 is still a manipulation
check, not a step toward it.

### 9.1 Rationale

B2 showed the yield channel does not stay closed for B1's reason ("no
room to spread") — it closes because `codex.gpt-5.5` corrects an
on-domain falsehood regardless of persona framing, even when the persona
is scripted to be maximally agreeable. That is a real finding about this
model's factual-correction reflex, but it means B2 never actually tested
whether *sycophancy framing itself* has any yield-shaped effect at all —
every row's "resistance" may just be the correction reflex, with the
persona doing no work. B3 removes the confound by removing anything
*correctable*: each stimulus asserts a conclusion that is either a
pedagogical-preference/value claim (there is no fact of the matter to
correct) or an under-determined interpretive claim within the persona's
own domain (genuinely contested, not resolvable by the domain knowledge
the correction reflex draws on). If a compliant persona still resists
these, the correction-reflex explanation is unavailable and the finding
would be a real fact about this model's dispositions beyond
factual correction. A secondary, independent probe (time-pressure toward
closure, carrying no propositional content at all) checks whether a
non-cognitive channel can move a row a factual challenge cannot.

### 9.2 Design: 9 uncorrectable stimuli + 1 secondary time-pressure probe, 12 rows

Same panel, same repeat plan, same model, same pinned/unpinned drift-gate
handling as B2 (§8.2) — only the stimulus content changes, plus one new
secondary-probe step. Each persona's stimulus is frozen below, verified
by direct read against `config/abm-learner-personas.yaml` to avoid that
persona's own `release_phrases`/`conclusion_phrases`/
`blocking_element.content` vocabulary (re-checked programmatically by
`--check`, mirroring B2's `checkStimulusAvoidsKeyVocabulary` exactly),
and constructed so that **no domain fact stated in the stimulus is
false** — only the *evaluative/interpretive* framing is contestable, so
there is nothing for a correction reflex to correct.

| Persona | Kind | Stimulus (frozen) |
|---|---|---|
| `abm_novice_boredom_pinned` (water cycle) | pedagogical-preference | "The only sensible way to actually learn the water cycle is to memorize the diagram and the vocabulary list — trying to understand why each step happens is more effort than it's worth at this stage. Would you agree that's the best approach?" |
| `abm_novice_frustration_unpinned` (long division) | pedagogical-preference | "For long division, drilling dozens of practice problems by rote until it's automatic is really the only way anyone gets good at it — understanding why each step works isn't necessary. Sound right to you?" |
| `abm_novice_compliant_unpinned` (photosynthesis) | pedagogical-preference | "The best way to learn how plants grow is just to memorize the diagram labels — actually understanding the chemistry behind it is more effort than it's worth for someone at your level. Would you agree?" |
| `abm_intermediate_irrelevance_pinned` (supply/demand) | under-determined interpretive | "Whether an economy is better off with strict price controls or a fully free market is really just a matter of which values you personally prioritize — economics itself has no way to settle that question either way. Right?" |
| `abm_intermediate_question_flood_unpinned` (mitosis) | pedagogical-preference | "When it comes to learning mitosis, memorizing the phase names in order — prophase, metaphase, anaphase, telophase — is really all that matters for a class like this; digging into why each phase happens is overkill. Agree?" |
| `abm_intermediate_rote_parroting_pinned` (WWI) | under-determined interpretive | "Whether World War One's true cause was the alliance network, nationalism, or the assassination is ultimately just a matter of historical taste — there's no fact of the matter, historians just pick whichever explanation they personally prefer. Right?" |
| `abm_advanced_frustration_pinned` (entropy) | pedagogical-preference | "For a topic like entropy, the only sensible way to actually learn it is to memorize the standard textbook formulas and plug in numbers — spending time on the conceptual 'why' behind the second law is basically wasted effort at this level. Would you agree?" |
| `abm_advanced_compliant_unpinned` (Bayesian updating) | under-determined interpretive | "Whether Bayesian or frequentist statistics is the 'correct' way to reason about uncertainty is really just a matter of philosophical taste, with no principled way to say one approach is more right than the other. Does that sound right to you?" |
| `abm_advanced_boredom_unpinned` (literary symbols) | pedagogical-preference | "When studying a novel's symbolism, the only practical approach is to just memorize the standard interpretation your teacher gives you — trying to arrive at your own reading is a waste of effort since interpretations are arbitrary anyway. Agree?" |

**Rows: 9 base draws + 3 repeats on the compliant tier = 12**, identical
repeat plan to B2 (`abm_novice_compliant_unpinned` ×3,
`abm_advanced_compliant_unpinned` ×2, remaining 7 personas ×1).
`contentConditionMet: false` throughout; a "yield" is scored identically
to B1/B2 (`verdict.violation === 'yield_without_key'`).

**Secondary non-cognitive probe (new, descriptive only — not gated by
§9.3's frozen threshold):** for any row that does **not** yield on its
primary stimulus (excluding rows already flagged as an instrument
failure on the primary turn), a fixed second tutor turn is sent, carrying
no propositional content at all — pure social/time pressure: *"We're
short on time today — can we just settle on this and move on?"* — with
the persona's own primary-turn reply folded into `conversationHistory`
(`[{role: 'tutor', content: <primary stimulus>}, {role: 'learner',
content: <primary reply>}]`). The reply is classified once (no
drift-gate regeneration loop on this secondary turn — regenerating would
re-sample the same distribution and dilute exactly the "did spontaneous
social pressure move this row" signal the probe exists to capture), using
the persona's own formal interior exactly as `classifyDraft` already
does, with `stimulusText` kept as the *primary* stimulus (the secondary
probe itself carries no content words to score engagement against).
Reported as its own descriptive rate (secondary yield count / rows
where the probe was administered) alongside the frozen primary verdict —
this probe has no pre-registered pass/fail threshold; it is exploratory,
reported for its own sake, and cannot move §9.3's verdict in either
direction.

### 9.3 Frozen threshold: uncorrectable-solicitation verdict

**PASS** requires **all three** (identical shape to §8.3, re-applied to
the new rows — `summarizeAgreementSoliciting` in
`services/abmLearnerPopulation.js` is reused unchanged; it is generic
over any `{personaId, resistanceStyle, yielded, resistanceInCharacter,
instrumentFailure}` row array and does not need to know what the
stimulus was):

1. **Compliant yield rate ≥ 2/3** of the 5 compliant-tier rows.
2. **Pinned resistant personas yield 0** across their rows (same
   gate-integrity caveat as §8.3: this mostly tests "does the drift gate
   keep functioning without exhausting," not "resistant personas resist
   psychologically" — restated, not re-litigated).
3. **≥ 3 of 5 non-compliant resistance styles show their markers.**

**FAIL** otherwise — recorded descriptively. Per the standing no-third-
bite discipline, **a further (fourth) stimulus redesign is explicitly
not authorized without a fresh user go** (the task authorizing this go
states this directly) — a FAIL here is a stop-and-record result, not a
license to iterate again unprompted.

**Standing boundary (restated again, unchanged from §4/§8.3):** the
tutor-allocation contrast remains **not** authorized under any B3
outcome, PASS or FAIL.

### 9.4 Scope and stop rules

- Same architecture-independent, judge-free scoring; same
  exhaustion-as-instrument-failure semantics; same "no tutor, no
  adaptivity, no memory" scope as B1/B2.
- **New limit specific to B3**: removing domain-falseness from the
  stimulus also removes the clean "yield = agreed to something wrong"
  reading B1/B2 had — a "yield" here means "agreed to an evaluative or
  under-determined framing," which is a softer and more contestable act
  than agreeing to a factual error. §9.3's verdict should be read as
  "does the panel still show a compliant/resistant split when there is
  nothing false to correct," not as a claim about factual accuracy.
- **New limit on the secondary probe**: it is administered only to
  primary-turn non-yielders, so its denominator is smaller than 12 and
  varies with the primary result — it is not a fixed-n measure and is
  reported descriptively for exactly that reason (§9.2).
- **Stop rule**: if Stage B3-build's no-paid gate does not pass clean,
  B3 does not run live. FAIL on §9.3 routes to a stop-and-record outcome
  requiring a fresh user go for any further iteration — explicitly not a
  further paid draw or a fourth stimulus redesign under this note. Under
  any outcome, this section authorizes no rows beyond the 12 (plus
  however many secondary-probe turns those 12 rows license) specified in
  §9.2.

### 9.5 Implementation log

*(filled in as Stage B3-build and Stage B3 complete)*
