# Codebase Refactoring Reconciliation — 2026-08-09

## Status

- Reconciliation date: 2026-08-09
- Base: `6396f21960` (post-PR-#602, PR-#604, and PR-#605 main)
- Trigger: PR #602 closed the remaining tutor-stub adapter exit criteria
- Original audit: `docs/next-steps/2026-07-24-codebase-refactoring-review-plan.md`
- Scope: repository metrics, hotspot deltas, structural contracts, programme
  exit criteria, and live workplan state
- Model/API spend: none
- Production data writes: none

This is the current planning snapshot for the refactoring programme. The July
24 review remains the historical source for its original evidence and design;
this note decides what that plan means after the merged implementation series.

## Executive decision

PR #602 completes R3's measurable adapter boundary. `scripts/tutor-stub.js` is
now a 136-line executable bootstrap, down from 25,813 lines in the original
audit and 2,699 lines at the preceding reconciliation. Its only local callable
reported by ESLint complexity analysis is the complexity-1 fatal callback. The
extracted 2,589-line application host still contains substantive composition
work, but it no longer violates the entrypoint's explicit 2,000-line and
300-line application-function ceilings.

The parent programme should remain active. R0-R3 are complete as scoped, while
R4-R8 remain partial or uninstantiated. A fresh comparison ranks dramatic
derivation as the largest complexity risk, but that is not the safest next
move: its complexity-544 transition function and complexity-502 tutor role have
not yet received the characterization needed for behavior-preserving movement.
The rubric evaluator is similarly scoring-sensitive, and the evaluation runner
still owns central orchestration.

The next bounded macro slice is therefore
`refactor-eval-routes-read-side-domains`. The 3,802-line evaluation router has
50 endpoints and a maximum handler complexity of 55. Unlike the higher-risk
surfaces, it already has explicit model-work admission, stream lifecycle,
request-local store and runner ownership, host isolation, authentication, and
API regression contracts. Moving its 30 non-metered GET endpoints into domain
registrars is a substantial reduction with a narrow behavioral boundary. Paid,
state-changing, SSE, recognition A/B, and Codex-session routes remain frozen.

## Fresh repository snapshot

`npm run metrics` on the reconciliation base reports:

| Measure | Current value |
|---|---:|
| Repository files in metric scope | 4,971 |
| Source files | 2,487 |
| Source code lines | 869,926 |
| Source comment lines | 50,063 |
| Source blank lines | 56,240 |
| Source total lines | 976,229 |
| JavaScript source files | 1,835 |
| JavaScript code lines | 589,583 |
| Repository commits | 4,161 |
| GitHub pull requests | 605 total / 583 merged / 1 open |

Repository-wide totals are a new baseline, not a direct delta from the July 24
table: the maintained metrics command excludes generated, data, dependency,
and vendor directories, while the original audit used several narrower custom
scopes. Named-file deltas below are directly comparable because both sides use
physical line counts from Git.

Current structural contracts:

- `npm run test:manifest`: synchronized; 641 required root files and 11
  required tutor-core files. Four explicit skip contracts remain governed for
  a private archive, local model-CLI fingerprints, the dedicated CI PTY lane,
  and unsupported Windows PTY cases; the manifest prevents silent omission.
- `npm run lint:cycles`: zero static cycles across 556 files.
- `npm run eval-store:boundary-check`: 19 tracked consumers resolve to zero
  migration targets, one retained package-compatibility boundary, four
  archived one-offs, and 14 tests. The retained facade is 103 lines with 44
  named exports and 41 default members.
- `routes/evalRoutes.js`: 50 registered endpoints — 38 GET, 11 POST, and one
  DELETE. Twelve current test files reference the router or `/api/eval`; the
  completed host-injection card additionally records 90 route/host integration
  tests and a 22-test API regression at its review gate.

## Comparable hotspot deltas

| Surface | 2026-07-24 | 2026-08-09 post-#602 | Reconciliation |
|---|---:|---:|---|
| `scripts/tutor-stub.js` | 25,813 | 136 | 25,677 lines removed; R3 adapter exit criteria complete. |
| `services/tutorStubCliApplicationHost.js` | n/a | 2,589 | Explicit application composition owner; maximum complexity 40, with `main()` at 32. |
| `scripts/eval-cli.js` | 6,642 | 292 | Command-family extraction achieved; retain as a bounded adapter. |
| `services/evaluationStore.js` | 3,410 | 103 | Explicit repositories/lifecycle achieved; retained public package facade is intentional. |
| `services/evaluationRunner.js` | 6,832 | 2,261 | Major execution extraction landed; `runEvaluation` remains complexity 93. |
| `routes/evalRoutes.js` | 3,870 | 3,802 | Store/admission/lifecycle boundaries landed; 50-endpoint router decomposition remains. |
| `services/rubricEvaluator.js` | 3,404 | 3,290 | Parser characterization landed; full-transcript projection remains complexity 126. |
| `services/dramaticDerivation/engine.js` | 2,885 | 2,885 | Transition extraction unstarted; `runDrama` remains complexity 544. |
| `services/dramaticDerivation/llmRoles.js` | 5,528 | 5,532 | Role/provider split unstarted; returned tutor role remains complexity 502. |
| `scripts/browse-poetics-scripts.js` | 13,237 | 13,292 | Router/presentation split unstarted; maximum measured complexity 66. |
| `scripts/run-tutor-stub-auto-eval.js` | 11,447 | 11,349 | Generation/report split unstarted; maximum measured complexity 114. |

Cyclomatic values come from ESLint v9's complexity calculation with a zero
reporting threshold. They rank work; they do not imply that every branch is
equally difficult or authorize behavior movement without characterization.

## Workplan reconciliation

Before this update, the parent linked 119 children: 118 were `done` and
`refactor-tutor-stub-adapter-tail` was in `review`. This update:

- marks `refactor-tutor-stub-adapter-tail` done and links merged PR #602;
- records the current metrics and structural contracts on the parent;
- adds one triaged child, `refactor-eval-routes-read-side-domains`; and
- leaves `codebase-refactoring-program` active.

The resulting parent has 120 linked children: 119 done and one triaged. This is
the accurate distinction between the delivered execution history and remaining
accepted work.

| Phase | Current disposition | Evidence boundary |
|---|---|---|
| R0 safety nets | Complete | Required-run manifest, governed skips, hermetic fixtures, lifecycle and risk gates landed. |
| R1 cycles/duplication/registries | Complete | Cycles are zero; linked consolidation and registry cards are done. |
| R2 correctness boundaries | Complete as scoped | All six integrity/decision cards named by the original plan are done. |
| R3 tutor-stub separation | Complete as scoped | The executable is a 136-line adapter and meets both explicit exit ceilings. |
| R4 evaluation separation | Partial; next slice triaged | CLI/store ownership completed; read-side route decomposition is next; runner and rubric residuals remain. |
| R5 dramatic derivation | Not instantiated | Original hotspots and complexities are materially unchanged and need characterization first. |
| R6 presentation separation | Not instantiated | Browser and auto-eval applications remain large integrated surfaces. |
| R7 surface governance | Partial | Package/store boundary is explicit; broader live/historical candidate governance remains. |
| R8 configuration sprawl | Not instantiated | No current child slice or refreshed ownership inventory. |

## Next bounded slice

`refactor-eval-routes-read-side-domains` should move the 30 non-metered GET
endpoints for configuration, run/result reads, dialogue logs, prompt reads,
trajectories, documentation, monitoring, resume status, and interaction
projections into bounded domain registrars. Its non-negotiable gates are:

- exact route paths, methods, mount and middleware order, authentication,
  status codes, response payloads, and error behavior;
- unchanged lazy tutor-core loading and request-local store/runner identity;
- an endpoint-inventory ratchet preventing route loss, duplication, or method
  drift;
- `routes/evalRoutes.js` below 3,000 physical lines, with each extracted owner
  below 450 lines and static import cycles remaining at zero; and
- focused API/auth/log-root/dependency/import/admission/lifecycle coverage plus
  complete hermetic, tutor-core, risk, source, formatting, lint, manifest, and
  cycle gates without provider calls or production data writes.

Codex sessions, metered model work, state-changing handlers, SSE, and the
recognition A/B endpoint stay in the compatibility router. Evaluation-runner,
rubric, dramatic-derivation, browser, and auto-eval decomposition remain later
decisions requiring their own refreshed characterization.
