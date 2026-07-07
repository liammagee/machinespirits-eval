# Adaptive Tutor Cast Layer Plan

**Status:** local implementation complete through Phase 6; first-pass paired transcript comparison supports static cast, not default reinvention  
**Date:** 2026-06-16  
**Activation gate:** do not commence runtime implementation until the didactic-mode local integration/replay gates are settled, unless the first step is schema-only and read-only against existing transcripts.  
**Primary substrate:** hidden + proofDebt proof-continuity control, with rhetorical/discursive/didactic layers advisory above it  
**Primary question:** can tutor and learner character become a public, auditable layer that improves dialogue continuity and permits bounded tutor self-reinvention without weakening proof control?

---

## 0. One-Sentence Shift

The current worlds specify dramatic positions well but characters unevenly. The cast layer makes tutor, learner, and their relation into a stable public object that every role prompt can consume, while allowing the tutor to change stance when the current way of being a tutor is obstructing learning.

---

## 1. Why This Is a Distinct Layer

The current derivation engine already has several adjacent mechanisms:

- proof control: release authority, proofDebt, entitlement, assertion gates, hidden proof continuity;
- rhetorical policy: local figure, intent, stance, and tutor move advice;
- discursive calibration: public learner posture, uptake quality, recognition pressure, strain;
- didactic mode: explanatory regime for the same proof obligation;
- scenes: multi-exchange texture, phatic uptake, repair requests, confusion, tempo;
- acts: bounded memory, plots, throughline, act-close audits;
- director prologue: public atmosphere and one-shot tutor/learner character sketch.

None of these yet provides a durable public answer to:

> Who are these two people to each other, what habits do they bring to the scene, and when should the tutor deliberately become someone slightly different so the learner can learn?

That question is not a proof question. The proof obligation may remain identical. It is not just a rhetorical move either: a tutor can choose a new figure while still inhabiting the same failed role. It is also not merely register: the issue is not whether the language is modern or period, but what kind of pedagogical person the tutor is being in relation to this learner.

---

## 2. Non-Goals

This plan should not become:

1. another H/V selector;
2. another learner situation taxonomy;
3. a new proof-control policy;
4. a hidden psychological model of the learner;
5. a generic roleplay prompt that is hard to audit;
6. a mechanism for changing register mid-drama;
7. a way to smuggle concealed facts into public character notes;
8. a claim about human learning without evidence beyond transcript quality.

The cast vocabulary should remain small, public, and operational. If the mechanism needs many personality labels to explain failures, it is probably drifting into taxonomy creep.

---

## 3. Current State

World YAMLs currently preserve:

- `setting`: public learner situation and inquiry frame;
- `learner_voice`: a prose voice constraint and starting disposition;
- `discipline`: domain/institutional frame;
- `dramaturgy.acts`: act-level arc and intended pressure.

Tutor character currently lives mostly in the tutor script:

- "Who you are";
- "What you hold, and what you owe";
- craft rules;
- pacing policy;
- recognition scene discipline.

The director prologue can generate:

- public stage notes;
- tutor character;
- learner character;
- register note.

But the prologue is runtime-generated and optional. There is not yet a stable authored `cast` schema that all roles consume. There is also no explicit mechanism for a tutor stance change, except indirectly through rhetorical policy, didactic mode, or act plots.

---

## 4. Proposed World Schema

Add an optional public `cast` block to dramatic derivation worlds.

Example:

```yaml
cast:
  tutor:
    role: "master of works"
    public_identity: "a bridge-mason retained by the assize"
    temperament: ["spare", "exact", "patient under pressure"]
    pedagogical_habit: "reads material traces before accepting testimony"
    recognition_style: "credits quickness, then slows it"
    default_stance: "craft examiner"
    risks:
      - "can become too terse when the learner needs reassurance"
      - "may mistake speed for ownership"

  learner:
    role: "bridge-warden's young clerk"
    public_identity: "keeps the assize-book under civic pressure"
    level: "novice but numerate"
    prior_bias: "trusts official bond and town verdict"
    temperament: ["quick", "anxious", "eager to close"]
    recognition_need: "needs their speed acknowledged before being slowed"
    likely_failure: "turns liability into causation"
    phatic_style: "short assent, then premature entry"

  relation:
    frame: "apprenticeship under public pressure"
    power_gradient: "high but not hostile"
    stakes: "the record becomes civic judgment"
    trust_baseline: "working but untested"
```

All fields are public. They must not contain:

- secret answer;
- hidden proof path;
- premise IDs;
- rule IDs;
- predicate names;
- D arithmetic;
- hidden learner board state;
- corruption ledger;
- concealed individuals or objects before release;
- release schedule;
- answer-bearing foreshadowing.

---

## 5. Core Runtime Object

Add a small public object, provisionally:

```text
CastState
```

Likely derivation function:

```js
deriveCastState({
  worldCast,
  worldSetting,
  worldLearnerVoice,
  stagePrologue,
  transcript,
  scene,
  acts,
  discursiveCalibration,
  didacticMode,
  recognitionNeed,
  publicRegister,
})
```

Minimum output:

```json
{
  "schema": "dramatic-derivation.cast-state.v0",
  "publicOnly": true,
  "mayOverrideProofControl": false,
  "tutor": {
    "stableRole": "master of works",
    "defaultStance": "craft examiner",
    "currentStance": "craft examiner",
    "riskFlags": ["too_terse_under_pressure"],
    "activeCommitment": "slow the clerk without humiliating their speed"
  },
  "learner": {
    "stableRole": "bridge-warden's young clerk",
    "currentPosture": "quick_closure_pressure",
    "likelyFailure": "turns liability into causation",
    "recognitionNeed": "speed must be acknowledged before being slowed",
    "phaticPattern": "short assent may mask premature closure"
  },
  "relation": {
    "frame": "apprenticeship under public pressure",
    "currentTrust": "working_but_thin",
    "pressure": "civic record will become judgement"
  },
  "reinvention": null,
  "promptNotes": {
    "director": ["public staging note"],
    "tutor": ["public conduct note"],
    "learner": ["public self-position note"],
    "tutorSuperego": ["public audit note"]
  },
  "inputAudit": {
    "ok": true,
    "forbiddenKeys": []
  }
}
```

The object should distinguish:

- **stable cast:** the authored role and relation;
- **current cast state:** how those roles are currently being inhabited;
- **reinvention state:** a bounded tutor stance change, if one has been authorized.

---

## 6. Tutor Reinvention

One legitimate sense of adaptation is that the tutor decides:

> The proof obligation is unchanged, but the way I am occupying my role is failing this learner. I need to become a different kind of tutor for this scene.

This should be called **tutor reinvention**, not proof-control adaptation.

Examples:

| From Stance | To Stance | Trigger |
|---|---|---|
| examiner | co-investigator | learner is defensive after repeated correction |
| craft master | patient demonstrator | learner cannot map rule to concrete exhibit |
| terse assessor | recognitive listener | recognition pressure remains high |
| Socratic questioner | concrete example giver | repeated questions produce echo without ownership |
| pressure-maintainer | repair-and-rebuild guide | same public dependency keeps needing repair |
| ceremonial authority | plain explainer | register or role distance is blocking uptake |

Reinvention should be rare, bounded, and logged. It should usually happen at scene or act boundaries, not opportunistically every turn.

Proposed object:

```json
{
  "schema": "dramatic-derivation.tutor-reinvention.v0",
  "active": true,
  "source": "didactic_failure",
  "trigger": "echo_without_ownership",
  "fromStance": "craft examiner",
  "toStance": "co-investigator",
  "publicRationale": "the learner is complying without owning the distinction",
  "allowedChanges": ["tone", "figure", "tempo", "example_style", "recognition_act"],
  "forbiddenChanges": ["release_timing", "secret", "proof_target", "answer_assertion"],
  "exitCondition": "learner restates the current distinction in their own words",
  "startedTurn": 9,
  "expiresAtActEnd": true
}
```

---

## 7. Reinvention Rules

Allow reinvention when one or more public signals persist:

- didactic-mode exit condition fails across a scene;
- recognition pressure remains high after acknowledgement;
- learner repeatedly echoes without ownership;
- learner becomes defensive after correction;
- scene closes as `needs_repair` or drift;
- act audit records the same friction recurring;
- tutor superego detects manner failure, not proof failure.

Block reinvention when:

- it would change release, restore, hold, or assertion timing;
- it would change the proof target;
- it introduces new evidence, concealed names, or hidden proof structure;
- it rewrites the learner as a convenient type after the fact;
- it changes public register mid-drama without an explicit operator setting;
- it lets the tutor avoid the current proof obligation;
- it adds more than one stance change inside a bounded act without an act-close justification.

Reinvention is a public conduct adaptation, not a private proof adaptation.

---

## 8. Relationship to Existing Layers

### Proof Control

Proof control remains dominant. Cast and reinvention cannot authorize evidence release, restoration, holding, or final assertion.

### Rhetorical Policy

Rhetorical policy selects the local move. Cast state biases how the selected move is inhabited.

Example:

```text
proof obligation: restore already-staged evidence
rhetorical figure: erotema
cast stance: co-investigator
surface conduct: "Let's check this together. Which part did the record actually give us?"
```

### Discursive Calibration

Discursive calibration supplies public posture and strain. Cast state says how that posture matters for these characters.

### Didactic Mode

Didactic mode says which explanatory regime should be used. Cast state says who the tutor must become to make that regime credible.

Example:

```text
didactic mode: teach_back
reinvention: examiner -> co-investigator
result: tutor asks for teach-back as shared checking, not oral examination
```

### Director Prologue

The prologue should become a projection of the cast, not a free invention. It may color the run, but it should not be the sole source of character truth.

### Tutor Superego

The tutor superego can audit stance compliance:

- current stance is being honored;
- current stance is failing and may require reinvention;
- proposed reinvention is unjustified or proof-leaking.

It must not order evidence movement.

---

## 9. Prompt Projections

The same `CastState` should be projected differently into each role prompt.

### Director Projection

The director sees:

- tutor role;
- learner role;
- relation and public stakes;
- current relation pressure;
- any act-level reinvention already authorized.

The director uses this for:

- prologue;
- act openings;
- public atmosphere;
- relation pressure.

The director must not:

- teach;
- instruct the tutor directly;
- add evidence;
- hint the answer.

### Tutor Projection

The tutor sees:

- own stable role;
- default and current stance;
- learner public posture;
- relation pressure;
- active reinvention, if any;
- allowed and forbidden changes.

The tutor uses this for:

- address;
- tone;
- question style;
- example style;
- recognition act;
- phatic acknowledgement.

The tutor must not use it for:

- changing evidence timing;
- changing proof target;
- asserting the answer;
- releasing hidden facts.

### Learner Projection

The learner sees:

- own public role;
- relation to tutor;
- public pressure/stakes;
- stage prologue;
- voice constraints.

The learner should not see:

- tutor's hidden reinvention audit;
- proof-control strategy;
- private trigger labels.

The learner may develop across the drama, but development should be visible through public turns and board changes, not hidden state injection.

### Tutor Superego Projection

The tutor superego sees:

- tutor current stance;
- active reinvention and exit condition;
- public recent conduct;
- draft tutor response.

The superego audits:

- stance mismatch;
- unjustified reversion to the old stance;
- overcorrection into answer-giving;
- reinvention that changes proof-control.

---

## 10. Implementation Surfaces

Likely new files:

```text
services/dramaticDerivation/castLayer.js
tests/dramaticDerivationCastLayer.test.js
```

Likely touched files:

```text
services/dramaticDerivation/index.js
services/dramaticDerivation/world.js
services/dramaticDerivation/llmRoles.js
services/dramaticDerivation/engine.js
scripts/run-derivation-loop.js
scripts/run-derivation-episode.js
tests/dramaticDerivationWorlds.test.js
tests/dramaticDerivationScenes.test.js
tests/dramaticDerivationActs.test.js
```

Optional report path:

```text
exports/dramatic-derivation/cast-layer-local-gate/report.md
```

CLI flag:

```text
--cast-layer
```

Episode replay should support:

```text
--cast-layer on|off
```

If reinvention is separately gated:

```text
--cast-reinvention
```

---

## 11. Evaluation Design

Compare:

- **S0:** hidden + proofDebt + rhetorical/discursive/didactic stack, no cast layer;
- **S1:** same, plus static cast layer;
- **S2:** same, plus static cast layer and bounded tutor reinvention.

Hold fixed:

- source prefix;
- proof-control flags;
- release authority;
- proofDebt behavior;
- public register;
- learner model/provider where paid runs are eventually used.

Primary local outcomes:

- prefix integrity in episode replay;
- no prompt leaks;
- proof-control output unchanged unless the test explicitly exercises proof-neutral conduct;
- tutor/learner/director prompts receive role-appropriate cast projections;
- public transcript reflects the cast without becoming decorative roleplay;
- reinvention, when active, changes stance while preserving proof obligation;
- reinvention expires or satisfies an exit condition.

Primary paid outcomes, only after local gates:

- final grounding is not harmed;
- release timing is not harmed;
- fewer repeated repair cycles;
- fewer aporia/disengagement outcomes;
- didactic exit conditions clear more often;
- recognition pressure resolves without extra proof starvation;
- human-reader transcript quality improves at matched proof reliability.

Interpretive rule:

- If S1/S2 only make prose nicer, report a character/discourse-quality gain.
- If S2 improves uptake, reduces repeated repair, prevents impasse, or reduces turns without harming hidden + proofDebt reliability, then it becomes mechanism evidence.
- If S2 harms grounding or delays proof progress, freeze it as negative transfer.

---

## 12. Work Arc

### Implementation Log

- 2026-06-16 — Phase 1 landed locally: added deterministic public `CastState`
  and bounded `TutorReinventionState` derivation in
  `services/dramaticDerivation/castLayer.js`, exported the public API, and
  added focused leak/projection/reinvention tests in
  `tests/dramaticDerivationCastLayer.test.js`. Focused command:
  `node --test tests/dramaticDerivationCastLayer.test.js` passed. Runtime
  prompt wiring is deliberately not active yet.
- 2026-06-16 — Phases 2-6 landed locally: `--cast-layer` projects role-specific
  public cast notes to director, tutor, learner, and tutor superego;
  `--cast-reinvention` enables one scene-bounded, trigger-cooldown tutor
  stance change without proof-control authority; Hethel now carries the pilot
  authored `cast` block. Local S0/S1/S2 mock matrix and an episode replay from
  S0 turn 7 passed with identical grounding and release timing. Report:
  `exports/dramatic-derivation/cast-layer-local-gate/report.md`. Phase 7 paid
  validation is not warranted yet because the local gate shows proof invariance
  and discourse-control plumbing, not an uptake/turn/impasse improvement.
- 2026-06-17 — Bounded first-pass paired transcript comparison completed on
  Hethel with real role bridges and no rerolls. S0 no-cast, S1 static cast, and
  S2 cast+reinvention all grounded with final D=0 and zero release deviations.
  S1 asserted at turn 20, S2 at turn 21, S0 at turn 22. A blinded Codex
  pairwise transcript judge preferred S1 over S0 slightly and S1 over S2
  moderately; S2 lost both pairwise comparisons despite bounded reinvention.
  Report:
  `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/report.md`.
  Interpretation: keep static cast as a candidate transcript-quality default;
  keep reinvention behind a flag pending tighter trigger/exit policy.

### Phase 0: Static Audit

Read the current worlds, tutor scripts, prologue prompts, and transcripts.

Deliverable:

- compact report of how strongly each world currently specifies tutor, learner, relation, and stakes;
- list of reusable cast fields already present;
- list of missing fields.

Exit rule:

- no source changes beyond this note/report.

### Phase 1: Schema and Normalization

Implement `deriveCastState(...)` as a pure deterministic function.

Requirements:

- accepts optional `world.cast`;
- falls back to existing `setting`, `learner_voice`, tutor script header, and stage prologue;
- returns stable public fields;
- rejects forbidden private/proof keys recursively;
- does not wire into runtime yet.

Exit rule:

- focused unit tests pass;
- leak audit passes;
- worlds without `cast` remain valid.

### Phase 2: Static Prompt Projection

Project `CastState` into director, tutor, learner, and tutor superego prompts behind `--cast-layer`.

Rules:

- proof-control fields remain unchanged;
- prompt projection is role-specific;
- no reinvention yet.

Exit rule:

- focused tests show prompt blocks appear in the right roles;
- learner projection contains no tutor-private strategy;
- tutor projection contains no hidden proof state.

### Phase 3: Author One Pilot Cast Block

Add a cast block to one world, preferably Hethel or Withercombe, because both have visible character hazards:

- quick closure on a dead or partial finding;
- public pressure to accuse;
- learner compliance that may mask non-ownership.

Exit rule:

- world invariant tests pass;
- mock derivation still grounds;
- transcript character changes are inspectable but not proof-relevant.

### Phase 4: Reinvention State

Implement bounded `TutorReinventionState`.

Start with deterministic triggers:

- echo without ownership across a scene;
- repeated didactic-mode failure;
- recognition pressure not resolved;
- repeated repair of same public object.

Rules:

- one active reinvention at a time;
- scene or act scope;
- explicit exit condition;
- no proof-control override.

Exit rule:

- tests show stance changes while proof intent, target, and release timing remain fixed.

### Phase 5: Scene/Act Integration

Allow reinvention to be proposed at scene close or act opening.

Scope:

- scene-level first;
- act-level only if scene-level gates pass;
- log reinvention in transcript metadata.

Exit rule:

- episode replay from a known prefix preserves prefix integrity;
- reinvention appears in tutor prompt/metadata;
- same proof-control and release timing;
- no leaks.

### Phase 6: Local Replay Gate

Run a replay where the baseline shows one of:

- learner echoes without ownership;
- learner becomes defensive after correction;
- repeated same-object repair;
- didactic mode fails to clear its exit condition.

Compare S0/S1/S2 locally.

Exit rule:

- S2 must not harm final D/verdict/release timing;
- S2 must show at least one concrete uptake/discourse benefit before any paid run.

### Phase 7: Paid Mini-Run

Only after replay gates pass.

Candidate design:

- one Hethel or Withercombe prefix;
- S0/S2 first-pass or tightly bounded pair;
- no rerolls except crash/truncation;
- compare against hidden + proofDebt.

Exit rule:

- report whether cast/reinvention improved uptake, turn count, impasse risk, or human-reader quality without harming grounding.

---

## 13. First Candidate Local Gate

Use Hethel because the character hazard is clear:

- learner role: quick clerk under civic pressure;
- prior bias: official bond and town verdict;
- likely failure: liability becomes causation;
- tutor risk: too terse or too procedural while the learner prematurely closes.

Fixture:

```text
public learner signal: fluent echo of liability distinction without owned contrast
proof obligation: same current public object
didactic mode: teach_back or contrast_case
cast default stance: craft examiner
reinvention: craft examiner -> co-investigator
exit condition: learner distinguishes liability from causation in their own words
```

Expected local difference:

- proof target unchanged;
- release decision unchanged;
- rhetorical advice may remain similar;
- tutor stance changes from testing the learner to checking the distinction with them.

This is a good gate because success would mean the cast layer changes the social form of the same proof step, not the proof step itself.

---

## 14. Reporting Standard

Every cast/reinvention report should include:

1. exact source prefix or fixture;
2. active proof-control flags;
3. cast state;
4. reinvention state, if any;
5. prompt projections by role;
6. proof-control invariance check;
7. leak audit;
8. transcript excerpts before/after;
9. final D/verdict/release timing;
10. interpretation: prose quality only, local uptake gain, or mechanism evidence.

---

## 15. Working Claim If This Succeeds

If the local and replay gates succeed, the claim should be narrow:

> With proof control held fixed, a public cast layer can make tutor and learner character durable across scenes, and bounded tutor reinvention can improve how the same proof obligation is taught when the current stance fails.

Do not claim:

- the tutor has a real personality;
- the learner has a real psychology;
- reinvention improves human learning;
- adaptation beats hidden + proofDebt generally;
- cast replaces proof, rhetoric, discursive calibration, or didactic mode.

The stronger philosophical reading is:

> Recognition is not only a way of addressing the learner. It can require the tutor to change who they are being in the relation, while remaining answerable to the proof.
