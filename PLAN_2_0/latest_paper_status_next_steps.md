# Paper Finalization & Plan Cleanup Checklist

**Date:** 2026-06-30  
**Purpose:** Convert the earlier “latest paper status / next steps” note into a de-duplicated finalization checklist.  
**Scope:** Paper 2.0 manuscript, adaptive-tutor active plans, A20/A21/ownership/didactic closeout notes, and regression-command hygiene.  
**Decision:** Do **not** add more adaptive-policy prose to the paper. Verify and preserve the hierarchy already integrated in the manuscript; clean up stale planning notes so future work does not reopen closed arcs.

---

## 1. Current Status

The paper already contains the core hierarchy that the older next-steps note asked to add:

```text
Core mechanism claim:
  calibration and error correction are supported;
  recognition-modulated adaptive responsiveness is null.

Bounded adaptive addenda:
  heavier typed state-action governance can work in localized simulated settings;
  this does not revive the recognition-modulated trajectory-slope hypothesis.

Derivation-control closeout:
  hidden+proofDebt is the production derivation arm;
  A20/A21/ownership/didactic overlays remain research instrumentation only.
```

The immediate task is therefore **verification and plan pruning**, not new claims.

---

## 2. Do Now: Verify / Preserve, Not Add

### 2.1 Manuscript hierarchy consistency pass

Check that the following paper locations all say the same thing:

- Abstract
- Introduction
- Contributions list
- §6.3 adaptive responsiveness
- §6.12 Plan 2.x / typed-governance addenda
- §6.13.15 derivation-control closeout
- §8 limitations
- §9 conclusion
- Revision history

Use this wording discipline:

```text
Recognition mechanisms:
  Supported: calibration, error correction.
  Null: recognition-modulated adaptive responsiveness.

Plan 2.x / typed governance:
  Localized simulated state-contingent strategy governance.
  Not human learning, deployment readiness, or recognition-prompt trajectory evidence.

Derivation control:
  hidden+proofDebt remains production proof-control.
  A20/A21/ownership/didactic tools are retained as instrumentation, not promoted policies.
```

### 2.2 Remove or downgrade duplicate editorial tasks

If `latest_paper_status_next_steps.md` still says “add the claim hierarchy,” “add the adaptive split,” or “add the A20/A21 closeout,” replace those with:

```text
VERIFY/PRESERVE: already integrated in manuscript. Do not duplicate.
```

Do **not** add another summary paragraph to the abstract or introduction unless a consistency check shows a contradiction.

---

## 3. Active Plan Cleanup

### 3.1 Add a top-level closed/not-promoted banner

Add this near the top of `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`, immediately after the status block:

```markdown
## Current Promotion Status: Closed / Not Promoted

A20 conduct-policy promotion, selector-v4 conduct enforcement, Phase 6 progress-policy promotion, the A21 Hethel patch, didactic mode as proof-control policy, and ownership/didactic promotion from the current artifact pool are closed as valid negatives.

Hidden+proofDebt remains the production proof-control arm. It should be treated as a compact proof-continuity controller, not as a weak static baseline.

A20 conduct objects, episode replay, non-leak/generator-compliance audits, A21 action-value microbenching, didactic-mode scaffolding, and the ownership benchmark remain durable research instrumentation. They are not promoted runtime policies.

Do not reopen selector-v4, conduct enforcement, progress-policy, A21 patch promotion, or didactic/ownership promotion from the same mined artifact pool. Reopening proof-control work requires a new predeclared hidden+proofDebt failure under first-pass replay or paid evidence.
```

### 3.2 Archive legacy Phase 6/progress-policy text

The active plan still contains legacy “Goal: test whether the conduct layer can stop asking diagnostics...” language. Do one of the following:

1. Move it under an archive heading:

```markdown
## Archived: Closed Phase 6 / Progress-Policy Proposal

The following section is retained as historical provenance only. It is not an active roadmap. Phase 6 did not clear the Hethel gate, and A21 Phase 9 showed that the proposed release-after-diagnostic patch matched hidden+proofDebt rather than beating it.
```

2. Or replace it with a short pointer to the closeout reports.

Preferred: **archive rather than delete**, because the history matters for provenance.

### 3.3 Reframe future proof-control work

Keep only this re-opening gate:

```text
A future proof-control arc may begin only from a predeclared hidden+proofDebt failure.
For each failure, identify:
  1. action-choice failure, learner-uptake failure, discourse-texture failure,
     decay/repair-continuity failure, world instability, or over-constrained runtime policy;
  2. a public signal available before the action;
  3. an A21-style action-value comparison showing a better action;
  4. no negative transfer against hidden+proofDebt on held-out worlds.
```

---

## 4. Ownership Plan Cleanup

Target: `ADAPTIVE-TUTOR-OWNERSHIP-EVALUATION-PLAN.md`

Ensure the plan says:

```markdown
## Closeout Status

The ownership evaluator and proof-matched ownership benchmark are implemented.

Benchmark controls passed 12/12:
- 4 positive controls detected ownership gain with proof state fixed;
- 4 negative controls rejected warmer/prose-only changes;
- 4 disqualification controls rejected proof/release-confounded gains.

Post-benchmark mined artifact scoring found no qualifying proof-safe ownership gain. Proof-safe pairs did not exceed the ownership-gain gate, and higher-ownership cases were disqualified by proof/release mismatch or proof failure.

No paid run or runtime policy promotion is warranted from this artifact pool.

The ownership benchmark remains a regression/evaluation asset. It should be used only for future predeclared quality-layer studies or new proof-identical transcript pairs, not to continue mining the same artifact pool for a win.
```

---

## 5. Didactic Plan Cleanup

Target: `ADAPTIVE-TUTOR-DIDACTIC-MODE-PLAN.md`

The didactic plan should remain **dormant / instrumentation-only** unless a future study has proof-identical transcript pairs and an ownership/uptake endpoint.

Add or verify this closeout language:

```markdown
## Current Status: Implemented Scaffold, Not Promoted

Didactic mode primitives, public-only audit, rhetorical-policy integration, runtime flag, replay inheritance, and act-level metadata carryover are implemented and locally gated.

The local Hethel S0/S1 mock pair changed explanatory/rhetorical regime while preserving prefix integrity, release timing, and proof-control state. It did not improve the formal outcome or demonstrate ownership/uptake gain.

Didactic mode is retained as a quality-layer scaffold. It is not promoted as proof control, and no paid mini-run is warranted from the current local evidence.
```

Also resolve the activation-gate inconsistency:

```text
The original activation gate is superseded for local scaffold implementation.
Experimental activation remains gated: no paid run or policy promotion without proof-safe uptake/ownership evidence.
```

---

## 6. Regression Command Appendix

Add a reproducibility appendix to the active or ownership plan. Verify `package.json` before committing exact names.

Expected commands to confirm:

```bash
# Core test surfaces
npm test
node --test tests/dramaticDerivationConductPolicy.test.js tests/dramaticDerivationReplay.test.js
node --test tests/dramaticDerivationDidacticMode.test.js
node --test tests/derivationOwnershipBenchmark.test.js

# A20 fixture/replay gates
npm run derivation:a20-fixtures
npm run derivation:a20-replay-panel

# A21 diagnostic surfaces, if present in package.json
npm run derivation:a21-microbench
npm run derivation:a21-analyze
npm run derivation:a21-report

# Ownership evaluator/benchmark
npm run derivation:ownership-benchmark
```

If a command is absent, either add the alias or list the underlying `node scripts/...` command instead.

---

## 7. Human Validation Is Future Work, Not a Completion Blocker

Do not block paper finalization on human studies.

The current paper already scopes claims to LLM-judge evaluation with synthetic learners and formal derivation outcomes. Keep human validation as future work unless a reviewer specifically requests a supplement.

Optional future-work stub:

```markdown
A final validation step is human-facing rather than harness-internal: human expert coding of selected ego/superego exchanges and human learner or reader studies on whether recognition-calibrated transcripts produce durable understanding. The present paper does not claim human learning improvement; it supplies the mechanism and instrumentation needed to design that validation cleanly.
```

---

## 8. Do Not Do

Do not:

- add another adaptive-controller section to the paper;
- reopen selector-v4;
- promote A21 release-after-diagnostic as default;
- run paid didactic or ownership validation from the same mined artifact pool;
- keep rescoring old artifacts until a success appears;
- conflate prose quality, ownership gain, and proof-control improvement;
- claim human learning or deployment readiness.

---

## 9. Reopening Conditions

A closed arc can reopen only under one of these conditions:

### 9.1 Proof-control reopening

A new predeclared hidden+proofDebt failure appears under first-pass replay or paid evidence.

Required before runtime-policy work:

- failure class assigned before patching;
- public signal available before the action;
- A21-style action-value comparison showing the baseline action is suboptimal;
- replay/no-harm gate against hidden+proofDebt;
- held-out negative-transfer check.

### 9.2 Quality-layer reopening

A new proof-identical transcript-pair benchmark shows a quality or ownership gain while proof control is fixed.

Required before paid work:

- proof path fixed;
- release schedule fixed;
- target object fixed;
- positive, negative, and disqualification controls pass;
- held-out artifact or authored pair clears the ownership/quality gate.

---

## 10. Final Closeout Language

Use this as the canonical short paragraph across plans:

```markdown
A20/A21 and ownership/didactic follow-ups are closed as promotion attempts from the current artifact pool. The tools they produced remain valuable instrumentation: replayable prefixes, typed conduct decisions, non-leak and generator-compliance audits, action-value microbenching, ownership controls, and didactic-mode scaffolding. But none produced a qualifying improvement over hidden+proofDebt under the required proof-safety and ownership gates. Hidden+proofDebt remains the production proof-control arm; future adaptation work must either begin from a new predeclared hidden+proofDebt failure or target a separate proof-identical quality-layer benchmark.
```

---

## 11. Suggested Commit Plan

### Commit 1: plan-pruning

- Update `latest_paper_status_next_steps.md` with this checklist.
- Add closed/not-promoted banner to `ADAPTIVE-TUTOR-ACTIVE-PLAN.md`.
- Archive legacy Phase 6/progress-policy text.

Suggested message:

```text
plans: close A20/A21 promotion arc and prune stale next steps
```

### Commit 2: evaluator-closeout-hygiene

- Update `ADAPTIVE-TUTOR-OWNERSHIP-EVALUATION-PLAN.md` closeout status.
- Update `ADAPTIVE-TUTOR-DIDACTIC-MODE-PLAN.md` scaffold/not-promoted status.
- Add regression command appendix or verify existing command list.

Suggested message:

```text
plans: record ownership benchmark closeout and didactic scaffold status
```
