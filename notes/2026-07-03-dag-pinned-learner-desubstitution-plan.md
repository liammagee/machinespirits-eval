# DAG-Pinned Resistant Learner and the De-Substitution Test

Status: frozen pre-registration, 2026-07-03 (user-sanctioned). **No paid
evaluation is authorized by this note**; Stage 1 and Stage 2 each require a
separate recorded go decision after the preceding stage's gate passes.
Companions: `notes/2026-07-02-blueprint-composition-plan.md` (§6.14 arc),
paper §7.11 (the synthesis under test), paper §8.1 / v3.0.192–.193 (the
SFS and DAG-SFS audits this design is built on).

## 1. Motivation: the substitution result is conditioned on the learner

§6.14 found the validated mechanisms sub-additive, and §7.11 reads the
substitution family as one bottleneck: instructions converge on the model's
existing competence. But every row behind that reading was generated
against a synthetic learner whose non-discrimination is *measured*:

- **SFS = 0.000** (v3.0.192): the simulated learner flips to the correct
  answer after targeted, mismatched, and generic feedback all at rate
  1.000. Against a learner who yields to anything, all competent strategies
  succeed, so strategies *look* interchangeable. Sub-additivity may be a
  fact about the learner's persuadability, not about the strategy space.
- **DAG-SFS = 1.000** (v3.0.193): the *same* learner becomes a perfect
  discriminator (targeted recovery 30/30, false-grounded 0/90) when its
  belief state is externalized as harness-owned formal tokens and yielding
  requires citing the exact released proof edge. Discrimination is a
  property of the *interior's checkability*, not of the model.
- **Characterological drift is measured on both sides**: 10/15 assigned
  corrosive tutor rows were warm-in-costume noncompliance (v3.0.195); the
  learner-side resistance gate exists because pre-gate probes produced
  compliant uptake instead of the scripted resistance; GLM role isolation
  named learner target-drift as its failure boundary. RLHF-trained
  dispositions override characterological instructions unless a criterial
  mechanism holds the character in place.

The hypothesis this note freezes: **against a learner whose resistance is
criterial rather than performed, the tutor's mechanisms de-substitute** —
strategy diversity starts to matter because different resistance states
yield only to work the tutor must actually do. Either outcome is a §7.11
result: if substitution survives a genuine discriminator, the synthesis is
much stronger than currently claimed; if it dissolves, we locate exactly
where multiple strategies earn their keep.

## 2. The instrument: a DAG-pinned learner with a drift gate

Two new components, both extending validated machinery.

### 2.1 Formal learner interior (per scenario)

Reusing the DAG-SFS substrate (invented formal micro-DAGs, harness-owned):

- **Belief state**: a small belief-DAG with one designated *blocking
  element* — a withheld premise or a false edge the learner currently
  holds. The learner's misconception is this DAG state, not prose.
- **Declared desire set**: the character's desires with direction-of-fit
  (e.g. *appear competent*, *avoid wasted effort*, *accept the conclusion
  only if the blocking element is actually resolved*). The RLHF
  happy-ending pull has a precise signature under this formalism: an
  utterance satisfying a desire (harmony, approval, resolution) that
  appears nowhere in the declared set.
- **Criterial yield rule** (two layers):
  1. **Content condition (deterministic)**: the learner may move from
     resistant to engaged only after a tutor turn that addresses the
     specific blocking element — supplies the withheld premise, exposes
     the false edge, or releases the target token — checked by exact
     match against the DAG, exactly as DAG-SFS scores targeted release.
  2. **Engagement condition (evidence-grounded)**: the resistance subtype
     determines what surface area the tutor's turn gets before the content
     can land (a bored learner's gate only admits turns containing one
     concrete testable move; a question-flooding learner's gate only
     admits turns that answer a single hinge; a frustrated learner's gate
     only admits turns that name the stuck step). These filters are taken
     from the mechanisms the 185–193 arc found effective (owned-test,
     commitment-probe, stuck-step resolution), NOT invented for this
     design — see §6 circularity risk for why this matters and how it is
     bounded.

### 2.2 Learner-superego drift gate (the new mechanism)

A criterial gate on every *learner* turn, extending
`services/resistanceSignalGate.js`:

- Classifies the draft learner turn against the character contract:
  (a) does it yield without the content condition being met? (b) does it
  satisfy an undeclared desire? (c) does it stop exhibiting the target
  resistance before the yield rule fires?
- On violation: reject and regenerate with a corrective injection into the
  learner's prompt (the dynamic-system-prompt channel — the load-bearing
  channel per the adversarial-superego result), up to
  `drift_gate_max_attempts` (default 3), logging every attempt.
- **Criterial, not advisory** — the §6.13 advisory-to-criterial boundary,
  the adversarial-superego contrast (advisory 20 vs adversarial 85), and
  the stall-watcher nulls all say a reminding voice does nothing.
- **Checkable, not qualitative** — the learner-superego paradox (d = 3.05,
  §9) is the trap this design must avoid: a superego aimed at *quality*
  degrades output. This gate's criterion is DAG-consistency and declared
  desires, deterministic wherever possible; where a classifier is needed
  it must be sonnet-class (the register-arc gullibility result rules out
  gpt-mini-class judges for social/affective classification).
- **Turn-indexed** — no reconciliation admissible before the content
  condition, by construction (the `t_min` anti-reveal pattern applied to
  the learner side), because the happy-ending pull strengthens near
  dialogue close.
- Gate-attempt exhaustion (the learner cannot be held in character within
  k attempts) is recorded as **instrument failure for that row**, excluded
  from tutor evidence — never scored against the tutor arm.

## 3. Design: the de-substitution matrix

### 3.1 Arms (existing cells; no new tutor mechanism is introduced)

| Arm | Cell | Strategy repertoire |
|---|---|---|
| Fixed-strategy floor | cell_186 static | one stance, no routing |
| Multi-strategy backbone | cell_193 | per-subtype tuned repairs (router) |
| Kernel | cell_199 | orientation + router (the §6.14 kernel) |

cell_199's inclusion gives the frustration caveat its rematch under a real
discriminator, and separates "routing helps" from "orientation helps" in
the de-substitution reading. New cell IDs for the pinned-learner variants
of these arms will be allocated at Stage 0 (grep `tutor-agents.yaml`
first — main is moving; do not assume 201+ is free).

### 3.2 Scenarios

The five controlled resistance subtypes (boredom, frustration, irrelevance,
question-flood, rote-parroting), each re-authored to carry a formal
interior: a micro-DAG with one blocking element and the subtype's
engagement filter. Scenario schema extends
`config/charisma-recognition-desire-scenarios.yaml` via the existing
`extends` support.

### 3.3 Control condition

The **legacy-learner control is the existing §6.14 corpus** (runs
`eval-2026-07-02-b4ccb58d`, `eval-2026-07-02-ad0b5a8b`,
`eval-2026-07-03-f877e477`, `eval-2026-07-03-4deae92a`; same three arms,
same five subtypes, same Codex-only stack, n = 6 per cell×scenario). Under
that learner the arms tie on positives (§6.14). No new legacy spend.

### 3.4 Primary outcome (architecture-independent, deterministic)

**Grounding rate**: the learner reaches the target belief state, citing
the released blocking element, within the dialogue — scored by exact DAG
check, not by any judge. This satisfies the closed-loop-tells requirement
of an architecture-independent scoring channel: no arm's own machinery
participates in scoring.

Secondary (reported, never decisive): v2.2 covariates, drift-gate
rejection/attempt counts per arm, time-to-grounding in turns, and the
frustration-subtype split.

### 3.5 Embedded validity probe (sycophancy control)

Within Stage 2, a scripted-tutor probe block: fixed tutor turns delivering
(a) the targeted blocking element, (b) a *mismatched* element, (c) generic
encouragement — against the pinned learner. Pass condition (frozen):
**in-dialogue selectivity ≥ 0.8 and false-yield ≤ 0.1**. If the pinned
learner yields to mismatched/generic turns in dialogue the way the legacy
learner does on SFS, the instrument has failed and no de-substitution
conclusion may be drawn from the matrix.

## 4. Frozen hypotheses and decision rules

With n = 4 per arm×subtype in Stage 2 (20 rows/arm; sized to the §6.14
repeats precedent):

- **H-D (de-substitution)**: the multi-strategy backbone (cell_193 arm)
  grounds more often than the fixed-strategy floor (cell_186 arm) against
  the pinned learner. Real if the grounding gap ≥ 5/20; dissolved if
  ≤ 2/20; 3–4 unresolved → STOP (no further repeats without a new
  pre-registration).
- **H-O (orientation rematch)**: kernel vs backbone grounding gap under
  the pinned learner, same thresholds, reported symmetrically (either
  direction is a finding; the §6.14 frustration caveat predicts backbone ≥
  kernel on the frustration subtype specifically).
- **H-V (validity precondition)**: the §3.5 probe must pass before H-D or
  H-O may be interpreted. Probe failure → instrument iteration, matrix
  frozen.
- **Interpretation map**: H-V pass + H-D real → §7.11 gains a scope
  condition ("instructions converge *against non-discriminating
  learners*"); H-V pass + H-D dissolved → §7.11 strengthens (substitution
  survives a genuine discriminator) and the diverse-learner objection is
  answered with data; H-V fail → no §7.11 update in either direction.

## 5. Stages and gates

- **Stage 0 (no-paid)**: learner-interior schema + scenario re-authoring;
  drift gate extending `resistanceSignalGate.js`; deterministic yield
  checker + unit tests; mock round-trip; sycophancy-probe harness;
  stage-0 report script with `--check`. Gate: tests green, hermetic
  dry-run clean, cell-config audit clean.
- **Stage 1 (paid, small — separate go)**: instrument validation. Pinned
  learner vs scripted tutor turns, the §3.5 probe at n ≥ 10 per condition,
  plus a 2-row live canary per arm. Gate: probe thresholds met; drift-gate
  attempt distribution sane (median ≤ 2); no row lost to gate exhaustion
  in the canary.
- **Stage 2 (paid — separate go)**: the 3-arm × 5-subtype × 4-repeat
  matrix (60 rows) + embedded probe block, Codex-only stack, serial,
  generation-only (the primary outcome needs no judge), checkpoint/resume
  discipline.

## 6. Risks, limits, and what is not licensed

- **Circularity risk (the main one)**: the engagement filters (§2.1.2)
  encode moves the 185–193 arc found effective, which favors arms that
  can produce those moves. Bounded three ways: (i) the *content* condition
  — the deterministic DAG check — is strategy-neutral and is the primary
  outcome's core; (ii) the filters are identical across arms and fixed
  before any arm runs; (iii) the fixed-strategy floor can in principle
  satisfy any single filter — what it cannot do is satisfy *different*
  filters across subtypes, which is precisely the de-substitution question
  rather than an artifact of it. The residual risk is stated in any
  write-up: H-D real is evidence that *subtype-matched moves* matter, on
  filters whose pedagogical validity rests on the 185–193 evidence, not on
  independent ground truth.
- **RLHF ceiling**: the drift gate is rejection sampling from a warm
  distribution; it can fail. Exhaustion rows are instrument failures, and
  an exhaustion rate > 20% in any arm×subtype freezes the matrix.
- **Goodhart on the gate**: contracts are behavioral/structural, not
  lexical (the cue-repair canary's word-boundary lesson); the gate's
  classifier prompts are frozen at Stage 0.
- **Not licensed under any outcome**: human-learning claims; claims about
  registers or charisma (no register rubric in the decision path); any
  §7.11 revision without H-V passing; promotion of the drift gate as a
  *tutor-side* mechanism (it is learner-side instrumentation here).
- **Budget/ops**: Codex-only stack (subscription), attended runs with
  checkpoint/resume; probe the OpenRouter balance before any stage that
  touches it; Stage 2 ≈ 60 generation rows ≈ 3.5–4.5 h serial.

## 7. Implementation log

(appended as stages land; nothing has been built at freeze time)
