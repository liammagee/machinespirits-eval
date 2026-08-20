# Coordinator workflow efficiency audit

Date: 2026-08-19 (America/Los_Angeles)

## Scope

This audit inspected the live Codex task `Verify resistance programme` while it
executed and repaired the frame-refuser opportunity study. It separates useful
research and engineering outcomes from avoidable coordination, publication,
and context overhead. It does not reinterpret the study result or authorize a
new model-backed run.

The fixed snapshot was taken about 107 minutes into the active turn. At that
point the task contained:

- 246 activity items;
- 103 coordinator wait calls;
- 51 user-facing progress messages;
- 27 direct coordinator commands;
- 10 subordinate tasks.

The final item in the snapshot had opened PR #707 and started an independent
audit while hosted CI ran.

## Useful output

The task was not empty PR churn. It completed the authorized six-dialogue Luna
study: 48 of 48 turns, 180 of the 288 permitted model attempts, and no
technical recovery. The registered result failed substantively. Follow-up
inspection identified an observer/repair defect that could misclassify a
productive local disagreement and then rewrite it into explicit
non-participation.

The task then produced three coherent repository boundaries:

1. PR #704 repaired the prospective semantics while preserving the frozen v1
   replay.
2. PR #706 added zero-call v2 readiness and fail-closed source/request binding.
3. PR #707 prepared the necessarily separate digest-bound v2 request against
   the already-merged implementation source.

Independent construct reviews were valuable: they caught real fail-closed
defects before the final merges. Repairs stayed on the same PR branches rather
than spawning repair PRs.

## Avoidable cost

The productive result was obtained with substantially more orchestration than
necessary:

- Short polling produced 103 wait events and 51 progress messages in roughly
  107 minutes. Most conveyed no decision, failure, or milestone.
- Independent review often began after the first push and hosted CI launch.
  When review found a blocker, another push and full hosted cycle became
  unavoidable. Local implementation and construct review should precede the
  first publication attempt.
- Separate symmetry reviewers repeatedly returned clean on changes that did
  not alter bilateral trace labels, scoring, persistence, or tutor/learner
  structures. Symmetry review should be triggered by the diff boundary, not by
  programme membership alone.
- The tutor-stub evaluation skill is 1,162 lines. The coordinator read it in
  several chunks, including a repeated tail, and a later worker reread the
  complete skill after its first combined read was truncated. The mandatory
  full-skill read therefore became a direct context and latency cost.
- Request packaging repeated repository, quoting, hashing, and temporary
  worktree operations that can be expressed as one deterministic zero-call
  command.

The most serious defect was not merely inefficiency. A push from a shared Git
worktree triggered the installed strong tutor benchmark and made six unrelated
model calls (three Codex Terra and three Claude) without per-push approval for
that benchmark. Installation had been opt-in historically, but a later push
could still imply fresh live-call authority. Shared hooks must never infer
model-call authorization from installation or from ordinary push intent.

## Programme changes

### Wave 2A: coordination and authorization safety

This is the next bounded implementation tranche.

- Require explicit, attended, per-push authorization before a model-backed
  pre-push benchmark can make any call. Without it, a relevant push must make
  zero calls and fail closed with a zero-call plan or use the existing
  conspicuous reasoned bypass.
- Preserve path classification, cached exact-commit reports, stdin chaining,
  hard call ceilings, and zero-call deterministic checks.
- Complete local focused tests and independent construct review before the
  first push. Hosted CI verifies the reviewed candidate rather than acting as
  an early discovery loop.
- Emit coordinator updates only for launch, material progress, failure,
  decision, PR publication, and terminal results. Use longer bounded waits
  between those milestones.
- Select one independent reviewer from the actual risk boundary. Add a
  separate symmetry review only when bilateral labels, scoring, persistence,
  or tutor/learner structures change.

### Later workflow tranche

- Refactor the 1,162-line tutor-stub skill into a short routing/checklist entry
  plus task-specific references. The selected route should load only the
  references required for the requested mode while retaining all safety and
  authorization rules.
- Add one deterministic request-packaging and clean-proof command for source
  closure hashing, request digest stabilization, destination absence, focused
  validation, and no-dependency replay.
- Measure the change using event counts, publication attempts, hosted reruns,
  skill lines loaded, wall time, and any model calls made by local hooks.

These additions do not authorize deleting worktrees or artifacts, moving
evidence to another store, rewriting history, or launching another study.

## Request-packaging mechanics follow-up

The later tranche now has one create-once template-to-request command. In a
controlled mechanics comparison against PR #707—not a timing or throughput
claim—it replaces 12 operator-issued Git/hash/validation command groups with
one explicit invocation of
`scripts/package-tutor-stub-resistant-profile-study-go-request.js`.

The regression fixture reproduces PR #707's committed v2 request byte for byte
at SHA-256
`2c77c131c2803e4af37eea3c8cbfb38e2ba423d645ab98739d661c5778c22c04`.
Two separate create-once outputs are identical; the command writes one request,
no separate proof artifact, and reports zero model calls and zero production
writes. Its isolated replay copies only the bound Git blobs, contains no
`node_modules`, and validates the actual generated request path.

Packaging proves the protected source and binding bytes against the launch
commit, not whole-checkout cleanliness. The request retains the stronger clean,
detached, exact-HEAD requirement as a separate future execution gate.

## Success conditions

The coordination changes are successful when a representative relevant push
without fresh authorization performs zero model calls; an explicitly
authorized attended push remains bounded and attributable; local review occurs
before the first hosted run; and a comparable coordinator phase reports only
material milestones without losing evidence or recovery control.
