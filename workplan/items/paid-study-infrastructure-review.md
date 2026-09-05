---
id: paid-study-infrastructure-review
title: Review paid-study infrastructure and recurring experiment blocks
status: triaged
type: infra
priority: P1
owner: unassigned
source: manual
created: 2026-09-05
updated: 2026-09-05
verification: Produce an evidence-backed incident review separating provider failures, implementation defects, measurement dependencies and scientific stop rules; rank concrete infrastructure fixes by preventable disruption, identify the focused regression or existing recovery mechanism for each, and state remaining uncertainties without new provider calls or changes to sealed studies.
links:
  items:
    - superego-critique-causal-replay
    - superego-critique-measurement-calibration
    - superego-contemporary-pilot
    - superego-human-quality-comparison
  notes:
    - notes/2026-09-05-superego-critique-calibration-transport-failures.md
    - notes/2026-09-05-superego-contemporary-generation-truncation.md
    - notes/2026-09-05-superego-human-comparison-repairs.md
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/1061
---

The user requested this card before continuing the human quality pilot. It
promotes the earlier capture in
`workplan/inbox/2026-09-05-review-recurring-study-blocks.md` into queued work.
Creating the card does not start the review or interrupt the current study.

Review the shared infrastructure through the observed superego incidents:

- Reconstruct each interruption from retained requests, responses, ledgers and
  reports. Separate observed symptoms from established causes and uncertainty.
- Distinguish provider or transport failures, runner defects, output-format
  assumptions, measurement dependencies and deliberately registered stop rules.
  Report paid attempts, spend and delay only where records support them.
- Assess whether offline tests exercise the actual provider request shapes and
  failure boundaries, and whether missing-work recovery preserves completed
  data while respecting the same routes, scope and aggregate ceilings.
- Review progress reporting, human handoffs, archiving, CI and approval overhead
  for avoidable barriers to obtaining an interpretable scientific comparison.
- Recommend a short, prioritized set of concrete fixes, each tied to a real
  failure and a focused verification. Identify which decisions must remain
  scientific choices rather than being hidden in infrastructure defaults.

Preserve historical attempts and results. The review is read-only and zero-call;
implementation proposals can be scheduled from its findings. Do not introduce
source-file pins, approval packages, new authorization schemas or repeated
canaries. Existing spend ceilings and append-only accounting remain required.

2026-09-05: card created at the user's request; review is queued, not started.

2026-09-05: the user authorized continued study iteration and infrastructure
repairs without a repeated PR/GO cycle. Two concrete findings are recorded in
`notes/2026-09-05-superego-human-generation-results.md`: avoidable insistence on a
literal GO after an instruction to proceed, and a completed generation-only run
misreported as recoverable paid work. The latter received a focused correction
and regression without changing sealed data. Generation completed all 60 jobs
without failures. These incremental findings do not close the broader queued
incident review or establish the cause of the earlier provider repetition.

2026-09-05: CLI-only quality assessment exposed a preflight gap: Codex bridge
calls did not expose single-attempt controls or a private raw-output sink. The
focused optional controls now disable request/stream retries, require one
completed turn, force subscription authentication when requested, strip API
credentials and retain successful/failed CLI output. Existing paths keep their
defaults. This is an incremental repair, not completion of the queued review.
