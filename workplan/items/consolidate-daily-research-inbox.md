---
id: consolidate-daily-research-inbox
title: Consolidate the daily-research capture inbox
status: done
type: ops
priority: P2
owner: codex
source: manual
created: 2026-08-04
updated: 2026-08-04
verification: "All 66 research captures were reviewed: one distinct audit was promoted, 54 were folded into existing work with a recorded decision, and 11 background-only captures were dropped; workplan/inbox is README-only and the source check passes without duplicate items."
branch: codex/consolidate-workplan-inbox
claim_status: methods
tags:
  - workplan
  - literature
  - triage
milestone: literature-triage
---

The apparent 67-item inbox contained the inbox README plus 66 automated
daily-roundup research captures. At the start of this pass, 20 captures were
marked `[UNBLOCK]` and 46 `[WATCH]`; they span 2026-06-23 through 2026-08-03.
These are suggestions awaiting a commitment decision, not 66 accepted tasks.

Consolidation rules:

- Promote only when the capture defines work not already represented by a live
  item and can state a concrete verification contract.
- Fold relevant literature into an existing item by linking that item and
  recording why no independent task was created.
- Drop background-only captures after confirming the dated roundup preserves
  the source and rationale.
- Process recent captures first, then the older `[UNBLOCK]` queue, then the
  `[WATCH]` queue.

Log:

- 2026-08-04 — Baseline: 66 captures (20 `[UNBLOCK]`, 46 `[WATCH]`) plus the
  README. Began with the four captures from the 2026-08-03 roundup.
- 2026-08-04 — Resolved the newest four: three folded into existing work as
  reviewed literature records; AISPA promoted to a distinct prompt-parity
  audit. Remaining queue: 62 captures (17 `[UNBLOCK]`, 45 `[WATCH]`).
- 2026-08-04 — Resolved all 17 remaining `[UNBLOCK]` captures. Each mapped to
  existing implementation, research, or measurement work, so no duplicate
  executable card was promoted. The source and decision are preserved in 17
  completed literature-triage records. Remaining queue: 45 `[WATCH]` captures.
- 2026-08-04 — Resolved the final 45 `[WATCH]` captures: 34 folded into
  existing or completed work and 11 dropped as background-only, domain-mismatched,
  or superseded. No WATCH capture supplied both a distinct gap and an executable
  verification contract. The inbox is now README-only and this pass is closed.

## Final WATCH decisions

The dated roundup linked by each original capture remains the durable literature
source. “Fold” means the proposed use is already represented by the named card;
“drop” means the paper may remain useful context but creates no board commitment.

| arXiv | Decision | Existing destination or reason |
|---|---|---|
| 2606.20243 | Fold | `codebase-refactoring-program`; the completed LangGraph migration and adaptive trace projection already provide explicit state and validation boundaries. |
| 2606.21228 | Fold | `program-2-context-vs-weights-finetune` and `program-2-committee-floor-ablation` already test trained orchestration versus prompted scaffolds. |
| 2606.21595 | Fold | `b8-lower-recognitionorigin-js-tutoradaptivemechanism-cut-or` and `character-development-capacity` already freeze critic calibration and construct-validity gates; the entity analogy adds no new test. |
| 2606.24107 | Fold | `proof-dag-dramatic-derivation-assessment` and `character-dag-drama-framework-synthetic-contrast` already compile structural plans into scored dramatic traces. |
| 2606.24391 | Drop | The diplomacy benchmark is domain-mismatched; the trap and cross-suite runners already enforce schema and pass/fail constraints. |
| 2606.19626 | Fold | `proof-dag-dramatic-derivation-assessment` already supplies a controlled concept schema; ontology-grounded tokenization has no demonstrated critic benefit here. |
| 2606.23752 | Fold | `adaptive-eval-immutable-provenance`, `version-symmetric-trace-transformation-pipeline`, and `transcript-archive-training-data-governance` cover append-only evidence and handoff provenance. |
| 2606.20691 | Fold | The proof-DAG concept schema and completed poetics calibration work already cover ontology construction; no hierarchy failure remains open. |
| 2606.22748 | Drop | General fiction-consumption preferences do not establish a tutor or drama-machine requirement without project user research. |
| 2602.15851 | Drop | Useful narrative-theory background, but it proposes no distinct implementation or empirical gate beyond the completed poetics programme. |
| 2603.09890 | Fold | `adaptive-causality-routing` and `rubric-v3-prospective-measurement-suite` already separate policy actions from process measurement. |
| 2603.24639 | Fold | `longitudinal-drift-adaptation` tested cross-session change; the still-blocked `adaptive-curriculum-memory-controller` owns any future controller. |
| 2604.07028 | Fold | `register-taxonomy-negative-registers` and `negative-register-effect-estimation-grid` own trait/register conditioning and its causal test. |
| 2606.01584 | Fold | `evaluator-bias-propagation-literature-triage` and `rubric-v3-calibration-and-held-out-acceptance` already cover judge-bias and held-out calibration. |
| 2606.01828 | Fold | `tutor-stub-latency-routing-optimization` and `program-2-committee-floor-ablation` own attributable routing and committee-cost questions. |
| 2606.03662 | Drop | The modelling/conformance/evolution analogy is vocabulary only; it creates no unmet learner-model contract. |
| 2606.04037 | Fold | `adaptive-eval-immutable-provenance` and `audit-trap-state-schema-for-typed-reveal-events` already cover certification and typed adversarial-state checks. |
| 2606.04874 | Fold | The completed adaptive trap, cross-suite, and refusal-transfer work already tests planning failure and calibrated refusal in-project. |
| 2606.05961 | Fold | `audit-tutor-prompts-for-user-agency-and-control-parity` owns prompt-framing bias; the historical placebo cells already isolate recognition language. |
| 2606.06448 | Fold | `decide-rich-learner-memory-service-retention` and `review-ego-superego-internal-history-window` own memory shape and context policy. |
| 2606.07054 | Fold | `test-canonical-posthoc-analysis-pipeline` and `version-symmetric-trace-transformation-pipeline` already govern cross-step evidence and trajectory analysis. |
| 2606.09900 | Fold | `decide-rich-learner-memory-service-retention` owns future memory architecture; no unresolved long-context accuracy failure warrants bi-temporal storage now. |
| 2606.10307 | Fold | `the-confident-liar-diagnosing-multi-agent-debate-with-log-pr` and `superego-taxonomy-human-validation` cover confidence diagnostics and human reliability. |
| 2606.11459 | Fold | `environment-grounded-automated-prompt-optimization-for-llm-g` and `sepo-self-evolving-prompt-agent-for-system-prompt-optimizati` already record prompt-optimization methods and gates. |
| 2606.11470 | Drop | This survey is a reference catalogue, not a project-specific gap or verification plan. |
| 2606.11521 | Fold | `proof-dag-dramatic-derivation-assessment` and the merged safety/closure clue-insertion sequence already implement evidence-led correction without answer revelation. |
| 2606.11560 | Fold | `proof-dag-dramatic-derivation-assessment` and `lean-semantic-web-proof-dag-validation` already supply graph-grounded concepts and validation. |
| 2606.11609 | Fold | `tutor-stub-latency-routing-optimization` and `program-2-committee-floor-ablation` own worker allocation and panel-value questions; no rationale-synthesis defect is observed. |
| 2606.13197 | Fold | The same routing and committee cards already test when extra agents earn their cost; no separate superego-bypass experiment is needed. |
| 2606.13544 | Drop | Real-time voice turn-taking is outside the current text tutor scope and has no accepted modality requirement. |
| 2606.13681 | Fold | `longitudinal-drift-adaptation` and `decide-rich-learner-memory-service-retention` cover durable memory updates and their retained representation. |
| 2606.14411 | Fold | `character-development-capacity` and `character-dag-drama-framework-synthetic-contrast` already track symbolic character state across a drama. |
| 2606.14470 | Fold | `adaptive-eval-immutable-provenance`, `a17-one-side-replay-replication-across-scenes`, and the symmetric trace pipeline already provide replayable, diffable branches. |
| 2606.15783 | Fold | `character-development-capacity` and the completed poetics calibration apparatus already decompose narrative form; an external dataset would not validate tutor learning. |
| 2606.28127 | Drop | This is conceptual support for explicit state, while the project already has direct state-schema ablations and bounded paper claims. |
| 2607.01084 | Fold | `refusal-cross-stack-adaptive` and `program-2-context-vs-weights-finetune` already test transfer fragility and bound fine-tuning claims. |
| 2607.01153 | Fold | `audit-tutor-prompts-for-user-agency-and-control-parity` and `content-compulsion-contrast` cover instruction conflict and independent guard behavior. |
| 2607.01218 | Drop | The state/prediction split is useful framing but adds no test beyond the completed adaptive state-schema ablations. |
| 2607.02368 | Fold | `arcane-do-role-playing-language-agents-stay-in-character-at`, `character-development-capacity`, and `adaptive-personality-literature-triage` already cover contextual persona stability. |
| 2606.18557 | Drop | Defeasible-abduction benchmark performance would not by itself validate the project’s poetics critic, and no matching depth failure is observed. |
| 2606.20014 | Drop | Hierarchical-control theory describes the existing architecture but does not define a new in-project comparison. |
| 2607.05537 | Fold | Existing prompt-optimization records and `audit-tutor-prompts-for-user-agency-and-control-parity` own any prospective component-order ablation. |
| 2607.09600 | Drop | Auction routing is hypothetical for fixed experimental cells; `adaptation-plan-3-model-profiler` already gates any evidence-based model router. |
| 2607.12739 | Fold | `negative-register-effect-estimation-grid` and `recode-superego-incorporation-as-a-framing-trajectory` already separate surface register from enacted stance. |
| 2607.20064 | Fold | `decide-rich-learner-memory-service-retention` and `adaptive-eval-immutable-provenance` own structured-log retention; no long-horizon retrieval failure is established. |
