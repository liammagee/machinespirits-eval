# Adaptive Tutor Didactic Mode Plan

**Status:** proposed next-after-discursive arc  
**Date:** 2026-06-16  
**Activation gate:** do not commence implementation until the current discursive calibration arm concludes and its final local/paid evidence is summarized.  
**Primary substrate:** hidden + proofDebt proof-continuity control  
**Primary question:** when the learner is not learning the current object, can the tutor switch explanatory mode at scene or act scale without weakening proof control?

---

## 0. One-Sentence Shift

Discursive calibration asks how the current proof step should be conducted in public dialogue. The didactic mode layer asks whether the current *mode of explanation* is failing and whether the next scene or act should teach the same object differently.

---

## 1. Why This Is a Distinct Layer

The current derivation engine has several adjacent mechanisms:

- proof control: release authority, pacing, proofDebt, entitlement, assertion gates;
- rhetorical policy: figure/intent/stance selection for a local tutor move;
- discursive calibration: public learner posture, uptake quality, recognition pressure, conversational strain;
- scenes: multi-exchange dialogue texture, phatic uptake, repair requests, confusion, tempo;
- acts: bounded memory, act plots, throughline, act-close audits.

None of these is quite the same as:

> The learner is not learning this thing; try a different explanatory mode.

That judgement is not only a proof judgement. The proof obligation may be unchanged. It is not only a rhetorical figure choice either: one can use `analogia` or `exemplum` locally while still staying in the same failed teaching regime. The missing object is a scene/act-level pedagogical strategy state.

---

## 2. Non-Goals

This plan should not become:

1. another H/V selector;
2. another broad taxonomy of learner situations;
3. another proof-control policy that overrides hidden + proofDebt;
4. another post-hoc rescue category after a failed run;
5. another generic “try something different” prompt;
6. a claim about human learning without reader/learner evidence;
7. a paid validation run before local replay gates pass.

The mode vocabulary should stay deliberately small. If the work needs many new situation labels to explain failures, that is evidence the mechanism is underpowered.

---

## 3. Proposed Core Object

Add a small public object, provisionally:

```text
DidacticModeState
```

It should be derived from public and already-audited runtime surfaces only:

- recent learner exchange types: confusion, repair_request, resistance, phatic_ack, echo, purpose question;
- repeated non-uptake of the same released evidence;
- repeated proofDebt repair of the same public dependency, expressed as “the same already-staged point keeps needing re-entry” rather than raw hidden arithmetic;
- scene closure status: needs_repair, drift_guard, clarified, completed;
- act audit outcome: fallback failed, friction recurred, hold target not learned;
- public uptake audit: learner can/cannot put the object in their own words;
- rhetorical/discursive metadata already safe for tutor-facing use.

It must not consume or expose:

- hidden proof path;
- secret;
- raw D arithmetic;
- hidden board state;
- corruption ledger;
- private learner internals not already public.

Minimum fields:

```json
{
  "schema": "dramatic-derivation.didactic-mode.v0",
  "publicOnly": true,
  "authority": "scene_or_act_advisory",
  "mayOverrideProofControl": false,
  "currentObject": "public label for the item being learned, if safe",
  "learningSignal": "acquiring|stalled|misapplied|echo_only|purpose_gap|overloaded|resistant|unknown",
  "recommendedMode": "teach_back|concrete_example|analogy_bridge|contrast_case|slow_recap|purpose_bridge|decompose_subtask|repair_vocabulary",
  "scope": "scene|next_act",
  "evidence": ["short public reasons"],
  "exitCondition": "what public learner behavior would end the mode"
}
```

The mode family is not a learner-situation taxonomy. It is a compact set of teaching regimes.

---

## 4. Mode Families

Start with eight mode families. Do not add more until a local fixture proves one is necessary.

| Mode | Use When | Tutor Conduct | Exit Condition |
|---|---|---|---|
| `teach_back` | learner sounds fluent but uptake is unowned | ask learner to restate the object in their own words | learner gives usable own-words account |
| `concrete_example` | abstract rule/detail is not landing | seat the same obligation in a concrete case | learner maps example back to current object |
| `analogy_bridge` | learner needs transfer from known shape | use a parallel structure without adding new facts | learner names the shared structure |
| `contrast_case` | learner keeps making a nearby wrong join | compare current object with a counter-case | learner distinguishes the two routes |
| `slow_recap` | confusion or overload accumulates | restage the chain in smaller pieces | learner can identify the next missing link |
| `purpose_bridge` | learner asks why evidence matters | state the public role of the evidence | learner connects evidence to the current question |
| `decompose_subtask` | object is too large for one exchange | split current obligation into a smaller local task | learner completes subtask without leap |
| `repair_vocabulary` | learner is stuck on terms/context | clarify ordinary language/context, not formalism | learner uses the term correctly in dialogue |

---

## 5. Relationship to Existing Layers

### Proof Control

Proof control remains dominant. If hidden + proofDebt says “repair dependency p” or “release current safe evidence,” didactic mode cannot choose a different proof action. It can only alter how the same obligation is taught.

### Rhetorical Policy

Rhetorical policy remains the local move selector. Didactic mode can bias the distribution over figures, but it should not collapse into a one-turn figure choice.

Example:

```text
proof obligation: repair already-staged point
didactic mode: teach_back
rhetorical policy: erotema or anaphora, restore intent preserved
surface conduct: ask learner to put the restored point in their own words
```

### Discursive Calibration

Discursive calibration is an input to didactic mode. It tells us public posture and strain. Didactic mode decides whether a short-lived explanatory regime should change.

### Scenes

Scenes are the natural first scope. A mode can hold across several exchanges without forcing proof advancement every turn.

### Acts

Acts are the escalation scope. If a scene-level mode fails, the next act plot may commit to a different mode and name its exit condition.

---

## 6. Implementation Surfaces

Do this only after the discursive arm concludes.

Likely new files:

```text
services/dramaticDerivation/didacticMode.js
tests/dramaticDerivationDidacticMode.test.js
```

Likely touched files:

```text
services/dramaticDerivation/index.js
services/dramaticDerivation/llmRoles.js
services/dramaticDerivation/engine.js
services/dramaticDerivation/rhetoricalMovePolicy.js
scripts/run-derivation-loop.js
scripts/run-derivation-episode.js
tests/dramaticDerivationScenes.test.js
tests/dramaticDerivationReplay.test.js
```

Optional report path:

```text
exports/dramatic-derivation/didactic-mode-local-gate/report.md
```

CLI flag, if implemented:

```text
--didactic-mode
```

Episode replay should support:

```text
--didactic-mode on|off
```

---

## 7. Evaluation Design

Compare:

- **S0:** hidden + proofDebt + rhetorical policy + discursive calibration, no didactic mode;
- **S1:** same proof-control and discursive layer, plus didactic mode.

Hold fixed:

- source prefix;
- proof-control flags;
- release authority;
- proofDebt behavior;
- learner model/provider where paid runs are eventually used.

Primary local outcomes:

- prefix integrity;
- same proof-control/release timing unless the fixture explicitly tests proof-neutral hold;
- no leaks;
- changed explanatory mode for the intended scene/act;
- tutor prompt includes mode and exit condition;
- learner uptake improves in replay or mock fixture;
- no drift into proof-control authority.

Primary paid outcomes, only after local gates:

- fewer turns to usable uptake of the same object;
- fewer repeated repairs of the same public dependency;
- fewer aporia/disengagement outcomes;
- no negative transfer against hidden + proofDebt on final grounding.

---

## 8. Work Arc

### Phase 0: Wait and Summarize Discursive Arm

Do not begin implementation until the current discursive arm has concluded.

Deliverable:

- short summary of what discursive calibration did and did not improve;
- list of public signals it exposes safely;
- decision on which signals are stable enough for didactic mode.

Exit rule:

- discursive arm result is summarized, including failures and caveats.

### Phase 1: Local Object and Fixtures

Implement `deriveDidacticModeState(...)` as a pure deterministic function.

Fixture set:

- echo without ownership -> `teach_back`;
- repeated confusion -> `slow_recap`;
- purpose question -> `purpose_bridge`;
- wrong nearby route -> `contrast_case`;
- abstract rule not landing -> `concrete_example`;
- recurring same dependency repair -> `decompose_subtask` or `teach_back`;
- vocabulary/context confusion -> `repair_vocabulary`.

Exit rule:

- focused unit tests pass;
- leak audit rejects forbidden inputs;
- no runtime wiring yet.

### Phase 2: Rhetorical Policy Integration

Pass didactic mode into rhetorical policy as an advisory layer.

Rules:

- proof-step intent and target are preserved;
- didactic mode can bias figure, stance, tempo, and requested learner operation;
- output records selected mode and exit condition.

Exit rule:

- focused tests show local advice changes while proof-control fields remain fixed.

### Phase 3: Scene-Level Runtime Flag

Wire `--didactic-mode` into full loop and episode replay.

Scope:

- scene-level only at first;
- no act plot mutation yet;
- report mode state in tutor metadata.

Exit rule:

- episode replay from a known prefix preserves prefix integrity;
- same proof-control/release timing;
- changed explanatory mode appears in tutor prompt/metadata;
- no leaks.

### Phase 4: Act-Level Escalation

Only if scene-level gates pass, let act openings read recent didactic mode failures and commit an act-level explanatory fallback.

Example:

```text
Act 2 plot fallback: if the learner still echoes p_point without own words, switch to teach_back before new evidence.
```

Exit rule:

- act-close audit can say whether the fallback was attempted and whether its exit condition was met.

### Phase 5: Paid Mini-Run

Only after replay gates pass.

Candidate design:

- one Hethel or Withercombe prefix where learner non-uptake is known;
- S0/S1 first-pass or tightly bounded pair;
- no reroll except crash/truncation;
- compare against hidden + proofDebt.

Exit rule:

- report whether S1 improves uptake/turn count/impasse without harming final grounding.

---

## 9. Interpretive Rules

Do not claim adaptive success if the layer only makes prose nicer.

Allowable claims:

- “didactic mode changed explanatory conduct while preserving proof control”;
- “didactic mode improved local uptake in a replay fixture”;
- “didactic mode reduced repeated repair of the same dependency in this bounded case.”

Not yet allowable:

- “the tutor has learned a general teaching policy”;
- “the system adapts to learners in general”;
- “this beats hidden + proofDebt as proof control”;
- “scene/act pedagogy improves human learning.”

The useful claim to aim for is narrower:

> With proof-control held fixed, a public scene/act-level didactic mode signal can choose a better explanatory regime for the same object, improving uptake without weakening derivation reliability.

---

## 10. First Candidate Local Gate

After the discursive arm concludes:

1. Choose one existing replay prefix with repeated public non-uptake.
2. Build a fixture from the public transcript and safe metadata only.
3. Derive didactic mode state.
4. Run S0/S1 mock episode:
   - S0: discursive calibration only;
   - S1: discursive calibration + didactic mode.
5. Pass only if:
   - prefix is identical;
   - proof-control/release timing is unchanged;
   - S1 changes explanatory regime;
   - S1 preserves proof-step intent/target;
   - leak audit passes;
   - the report states this is local debugging evidence, not validation.
