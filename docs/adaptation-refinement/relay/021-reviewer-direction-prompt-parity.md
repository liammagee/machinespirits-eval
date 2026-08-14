# 021 — Direction: prompt parity first, seat upgrade second, caveat never

**Date:** 12 August 2026
**Answers:** reports 019/020 (mechanical-offset repair landed; zero-call
counterfactual predicts 26/48 = 54.2% discards; seed 506 correctly not
launched). Human decision received in chat (12 Aug): prompt parity
first, model-seat upgrade if that fails. The coverage-caveat option is
REJECTED — a half-blind gate will not be registered.

## Classification

Contract-communication defect, timebox class — same family as a schema
defect. The semantic contract and validator are unchanged and correct.
The defect is that the live seat's prompt withholds the contract's own
rules from the model:

- The frozen reader handbook
  (`adaptiveWarrantSemanticReaderHandbook()`,
  `scripts/build-adaptive-warrant-v3-semantic-diagnostic.js:609`) states:
  "requested_value_types and component_ids are non-empty only for
  request-mode acts … every proposal, question, analysis, withdrawal,
  and transfer uses empty sets" — the exact rule behind 21 of the 26
  predicted discards (`value_component_sets_forbidden_for_non_request`).
  It also states the span rules: distinct non-overlapping spans,
  shortest complete literal clause, extend leftward by whole tokens
  until unique — behind the 10 overlap discards and the 1 non-literal.
- The live compact prompt
  (`services/tutorStubPublicLearnerAnalysis.js:1449`) contains neither
  rule. It tells the model how to fill the value fields, never when to
  leave them empty, and says nothing about span overlap.

The same Luna model passed certification at 21/24 hard consensus when
shown the handbook. The gate has still never received input from a
model that was shown the rules it is scored against. Certification
stands; no historical corpus is rescored.

## Authorized now

1. **Port the handbook rules into the live-seat prompt.** Every ported
   sentence must be copied from the frozen handbook (adapted only where
   the live harness already supplies a mechanical field). Nothing may
   be authored fresh against the 26 observed failures — that is the
   overfitting guard. Porting the entire handbook is authorized if that
   is simpler than excerpting; at minimum port: the value/component-set
   empty-sets rule, the per-act target rules (catalog vs state="none"),
   the span rules (non-overlap, shortest complete literal clause,
   leftward extension to uniqueness, no offset calculation), and the
   event-multiplicity rule.
2. **Frozen-constant amendment (predeclared, rule 4b):** register the
   enriched prompt as profile `handbook_v1` and amend
   `LEARNER_ANALYSIS_PROMPT_PROFILE` to it, or amend `compact_v1` in
   place — driver's choice; record the amendment commit either way.
   The child policy SHA changes with it; record the new value.
3. **Diagnostic probe (~48 calls):** re-ask the 48 preserved seed-505
   learner turns through the repaired live seat with the enriched
   prompt. The seed-505 corpus stays burned: probe outputs are
   diagnostic only — never scored, never pooled, never evidence.
   Artifact under `/private/tmp`, labeled diagnostic, with the source
   closure hash. Report the probe discard rate and residual mix.
4. **Preflight extension:** assert the live-seat prompt contains the
   ported handbook rules (digest of the ported block checked against
   the frozen handbook text), so the two seats cannot silently drift
   apart again.

## Gate after the probe (predeclared)

- **Probe discard ≤ 10%:** relaunch the representative matrix at
  reserve seed 506 under the standing authorization — no stop. 017b
  runner guards stay active. Reserve seeds 507-510 unchanged.
- **Probe discard > 10%:** proceed directly to the seat upgrade — no
  stop. Amend the frozen model pin for the **learner-analysis role
  only** (tutor and automated-learner stay on
  `codex.gpt-5.6-luna`) to the strongest Sonnet model registered in
  the claude-code CLI bridge; name the exact model id in the amendment
  commit. Run one acceptance ping on the upgraded seat, then repeat
  the same 48-turn diagnostic probe (second probe, ~48 calls + ping).
  Same gate: ≤10% relaunch at seed 506; >10% STOP for human with the
  residual mix. The mixed-model design (Luna dialogue, Sonnet
  analysis) is prospective-only and must be recorded in the study
  manifest and prereg notes.

## Budget

Two probes maximum (96 calls) plus one upgrade ping before any stop.
Report calls spent, as always.
