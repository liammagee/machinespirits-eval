# Markdown Timestamp Rename Manifest

Created: 2026-06-18 12:48 CDT

## Scope

Applied a conservative timestamp-prefix pass to note-like Markdown files only. The timestamp is the file's git-created date from `git log --diff-filter=A --follow --format=%ad --date=short -- <path>`.

Files were renamed only when all of these were true:

- The file lived under `notes/`, `docs/explorations/`, `docs/critique/`, or `docs/next-steps/`.
- The basename did not already contain a `YYYY-MM-DD` date anywhere.
- The basename was not a stable convention such as `README.md`, `TODO.md`, `CHANGELOG.md`, `SKILL.md`, `TECHNE-DOCS.md`, `SPEC.md`, `TAXONOMY.md`, `ADAPTATION-MOVES.md`, or `INDEX.md`.

Skipped by design: canonical papers/slides, prompts, generated exports, course files, agent skill files, config manifests, root-level plans, and files that already had a date suffix. Exact old-path references were mechanically updated after the renames.

## Summary

- Applied renames: 70
- docs/critique: 2
- docs/explorations: 21
- docs/next-steps: 1
- notes: 46

## Applied Renames

| Old path | New path |
|---|---|
| `docs/critique/gptpro-5.5-critique-follow-up.md` | `docs/critique/2026-05-18-gptpro-5.5-critique-follow-up.md` |
| `docs/critique/gptpro-5.5-critique-response.md` | `docs/critique/2026-05-18-gptpro-5.5-critique-response.md` |
| `docs/explorations/claude/breaking-the-adaptation-ceiling.md` | `docs/explorations/claude/2026-04-29-breaking-the-adaptation-ceiling.md` |
| `docs/explorations/claude/synthesis-with-gpt-pro.md` | `docs/explorations/claude/2026-04-29-synthesis-with-gpt-pro.md` |
| `docs/explorations/claude/consolidated-plan.md` | `docs/explorations/claude/2026-04-30-consolidated-plan.md` |
| `docs/explorations/claude/a13-pre-registration.md` | `docs/explorations/claude/2026-05-01-a13-pre-registration.md` |
| `docs/explorations/claude/comprehensive-strategy.md` | `docs/explorations/claude/2026-05-01-comprehensive-strategy.md` |
| `docs/explorations/claude/a13-gate-b-results.md` | `docs/explorations/claude/2026-05-05-a13-gate-b-results.md` |
| `docs/explorations/claude/p2-bilateral-tom-pre-registration.md` | `docs/explorations/claude/2026-05-05-p2-bilateral-tom-pre-registration.md` |
| `docs/explorations/claude/a13-followup-N24-granular-results.md` | `docs/explorations/claude/2026-05-10-a13-followup-N24-granular-results.md` |
| `docs/explorations/claude/bilateral-tom-id-director-crossover-design.md` | `docs/explorations/claude/2026-05-10-bilateral-tom-id-director-crossover-design.md` |
| `docs/explorations/claude/p2-followup-pre-registration.md` | `docs/explorations/claude/2026-05-10-p2-followup-pre-registration.md` |
| `docs/explorations/claude/p21-N24-results.md` | `docs/explorations/claude/2026-05-10-p21-N24-results.md` |
| `docs/explorations/claude/p22-p23-parking-note.md` | `docs/explorations/claude/2026-05-10-p22-p23-parking-note.md` |
| `docs/explorations/claude/primitives-qualitative-pilot-design.md` | `docs/explorations/claude/2026-05-10-primitives-qualitative-pilot-design.md` |
| `docs/explorations/claude/primitives-qualitative-pilot-findings.md` | `docs/explorations/claude/2026-05-10-primitives-qualitative-pilot-findings.md` |
| `docs/explorations/claude/primitives-qualitative-pilot-followup.md` | `docs/explorations/claude/2026-05-10-primitives-qualitative-pilot-followup.md` |
| `docs/explorations/claude/state-schema-ablation-design.md` | `docs/explorations/claude/2026-05-10-state-schema-ablation-design.md` |
| `docs/explorations/claude/agents/agent-framework-analysis.md` | `docs/explorations/claude/agents/2026-05-01-agent-framework-analysis.md` |
| `docs/explorations/claude/agents/research-resources.md` | `docs/explorations/claude/agents/2026-05-01-research-resources.md` |
| `docs/explorations/gpt-pro/01-adaptive-recognition-psyche-architecture.md` | `docs/explorations/gpt-pro/2026-04-29-01-adaptive-recognition-psyche-architecture.md` |
| `docs/explorations/gpt-pro/02-codex-claude-code-action-plan.md` | `docs/explorations/gpt-pro/2026-04-29-02-codex-claude-code-action-plan.md` |
| `docs/explorations/gpt-pro/03-resource-list.md` | `docs/explorations/gpt-pro/2026-04-29-03-resource-list.md` |
| `docs/next-steps/next-steps-report.md` | `docs/next-steps/2026-05-13-next-steps-report.md` |
| `notes/gemini-analysis-of-paper-2-0.md` | `notes/2026-03-04-gemini-analysis-of-paper-2-0.md` |
| `notes/major-bugs.md` | `notes/2026-06-03-major-bugs.md` |
| `notes/adaptation-conformity-classifier-stage0-preregistration.md` | `notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md` |
| `notes/adaptation-ecology-plan.md` | `notes/2026-06-09-adaptation-ecology-plan.md` |
| `notes/adaptation-exploration-plan.md` | `notes/2026-06-09-adaptation-exploration-plan.md` |
| `notes/adaptation-repertoire-stage0-preregistration.md` | `notes/2026-06-09-adaptation-repertoire-stage0-preregistration.md` |
| `notes/dramatic-derivation-plan.md` | `notes/2026-06-09-dramatic-derivation-plan.md` |
| `notes/adaptive_2_0/a19-attempt1-fixture-gate-report.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-fixture-gate-report.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-addressed-claim.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-addressed-claim.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-fraction-common-unit.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-fraction-common-unit.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-instructional-contract.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-instructional-contract.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-learner-standing.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-learner-standing.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-over-compliance-ethopoeia.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-over-compliance-ethopoeia.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-over-compliance.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-over-compliance.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-productive-impasse.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-public-commitment.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-strategy-reversal.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-strategy-reversal.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-surface-agreement.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-surface-agreement.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-temperature-unit.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-temperature-unit.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report.md` | `notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report.md` |
| `notes/adaptive_2_0/a19-drama-axiom-transfer-spec.md` | `notes/adaptive_2_0/2026-06-07-a19-drama-axiom-transfer-spec.md` |
| `notes/adaptive_2_0/a19-drama-axiom-transfer-todo.md` | `notes/adaptive_2_0/2026-06-07-a19-drama-axiom-transfer-todo.md` |
| `notes/adaptive_2_0/a19-literature-positioning-matrix.md` | `notes/adaptive_2_0/2026-06-07-a19-literature-positioning-matrix.md` |
| `notes/adaptive_2_0/a19-real-s0s1-counter-warrant-scope-a.md` | `notes/adaptive_2_0/2026-06-07-a19-real-s0s1-counter-warrant-scope-a.md` |
| `notes/adaptive_2_0/a19-real-s0s1-fraction-common-unit-counterexample-a.md` | `notes/adaptive_2_0/2026-06-07-a19-real-s0s1-fraction-common-unit-counterexample-a.md` |
| `notes/adaptive_2_0/a19-real-s0s1-productive-impasse-answer-leakage-a.md` | `notes/adaptive_2_0/2026-06-07-a19-real-s0s1-productive-impasse-answer-leakage-a.md` |
| `notes/adaptive_2_0/a19-real-s0s1-surface-agreement-uptake-a.md` | `notes/adaptive_2_0/2026-06-07-a19-real-s0s1-surface-agreement-uptake-a.md` |
| `notes/adaptive_2_0/a19-real-s0s1-temperature-unit-conversion-aggregation-a.md` | `notes/adaptive_2_0/2026-06-07-a19-real-s0s1-temperature-unit-conversion-aggregation-a.md` |
| `notes/adaptive_2_0/a19-surface-agreement-mapping-calibration.md` | `notes/adaptive_2_0/2026-06-07-a19-surface-agreement-mapping-calibration.md` |
| `notes/adaptive_2_0/a19-generalization-systemization-plan.md` | `notes/adaptive_2_0/2026-06-08-a19-generalization-systemization-plan.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-claim-evidence-role-mismatch-bounded-continuation.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-claim-evidence-role-mismatch-bounded-continuation.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-claim-evidence-role-mismatch-staged.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-claim-evidence-role-mismatch-staged.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-claim-evidence-role-mismatch.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-claim-evidence-role-mismatch.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-copy-import-audit.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-copy-import-audit.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse-enacted-shortcut.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-productive-impasse-enacted-shortcut.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse-next-policy.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-productive-impasse-next-policy.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse-recursive.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-productive-impasse-recursive.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-productive-impasse-recut-counts.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-productive-impasse-recut-counts.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment-consent-misclassification.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-public-commitment-consent-misclassification.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment-evidence-role-boundary.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-public-commitment-evidence-role-boundary.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment-self-ledger.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-public-commitment-self-ledger.md` |
| `notes/adaptive_2_0/a19-attempt1-real-gate-report-public-commitment-speech-act-triage.md` | `notes/adaptive_2_0/2026-06-09-a19-attempt1-real-gate-report-public-commitment-speech-act-triage.md` |
| `notes/poetics/oedipus-discovery-grade-rubric.md` | `notes/poetics/2026-06-01-oedipus-discovery-grade-rubric.md` |
| `notes/poetics/recursive-tutor-learning-benchmark.md` | `notes/poetics/2026-06-05-recursive-tutor-learning-benchmark.md` |
| `notes/rhetoric/deep-research-report-2.md` | `notes/rhetoric/2026-06-08-deep-research-report-2.md` |
| `notes/rhetoric/deep-research-report.md` | `notes/rhetoric/2026-06-08-deep-research-report.md` |
