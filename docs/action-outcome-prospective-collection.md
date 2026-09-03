# Prospective action-outcome collection

Workplan item: `adaptive-curriculum-memory-controller`.

The original zero-call engineering contract closed the action-selection gap
between the typed-action runtime and the human-review packet. The current v2
design now registers a fresh collection inside the repaired comparison seam. It
still does not test whether action-outcome memory improves learning or transfer.

The first registered collection later failed its feasibility gates. Its sealed
quality audit remains the historical result. The prospective successor is
specified in `notes/2026-09-01-action-outcome-prospective-redesign.md` and
`config/tutor-stub-action-outcome-prospective-redesign.v1.json`; it does not
reuse, recode, or top up the failed pilot.

Run its deterministic contract check with:

```bash
node scripts/check-tutor-stub-action-outcome-prospective-redesign.js
```

The check reads repository state only and reports zero model calls and zero
production writes.

## Why ordinary policy traces are insufficient

The ordinary typed-action policy chooses one action deterministically from the
current public learner state. Outcomes collected under that policy are useful
operational history, but action families see different learner states by
construction. Comparing their raw hit rates would therefore mix action outcome
with policy selection. A deterministic propensity of one does not create the
overlap needed to distinguish those quantities.

The memory controller aggregates the five tutor-stub move families, so the
prospective collection unit is a **move family**, not an individual action.
Sampling actions uniformly would overrepresent a family whenever it contributes
several eligible action types.

## Collection assignment contract

The tutor CLI now accepts this default-off assignment mode alongside the existing
typed-action task and support axes:

```text
--typed-actions
--typed-action-assignment uniform_family_eligible
--typed-action-support-level <0..3>
--typed-action-task-id <stable-id>
--typed-action-knowledge-component <text>
--run-seed <integer>
--eval-repeat <integer>
--eval-job-id <stable-id>
```

This is only the relevant flag shape. It is not a complete launch command or an
authorization to call a model.

At each turn the runtime:

1. estimates the public learner state and applies the existing world and scaffold
   gates;
2. preserves mandatory diagnostic or escalation authority with probability one;
3. on an assignable turn with at least two represented move families, draws
   uniformly among those families; a singleton set remains an audit-only policy
   choice;
4. draws uniformly among the eligible action types inside the selected family;
5. realizes the assigned action through the existing response-configuration and
   guard path; and
6. closes the action against the next public learner observation.

The selected-family propensity is `1 / eligible families`. The selected-action
propensity is that family propensity multiplied by `1 / eligible actions in the
selected family`. The trace records the baseline policy action, eligible actions
grouped by move family, both deterministic draws, both probabilities, the chosen
action, and the seed material. Repeating the same run seed, profile, repeat, turn,
and job identity reproduces the draw.

Every decision also records a canonical `eligible_set_id`. Evidence joins and
controller lookups must match that exact identifier, so rates from different
choice sets cannot be pooled. The current support phase provides one genuine
three-family comparison (`minimal_support`, `explain_model`, and
`request_self_explanation`). The current diagnose and fade phases each expose a
single family and therefore remain outside comparative memory.

Fixed support is required so an assigned family does not silently change the
assistance level. Register, task, support, world constraints, scaffold phase,
release rules, guards, and public-output audits remain separate axes. A guard that
displaces the assigned action cancels the intervention before delivery; its next
learner turn cannot be credited to the requested action.

## Evidence admission

`action-outcome-memory-readiness` validates the saved family and action draws,
candidate membership, family mapping, propensities, selected action, and replayed
seed record. Tampered or internally inconsistent assignment provenance is
excluded as `invalid_prospective_assignment`.

The readiness row reports one of these assignment states:

- `seeded_uniform_family_assignment`: eligible for prospective binary memory
  evidence after valid human review;
- `mandatory_policy_authority_preserved`: retained for audit, but not an
  exchangeable family assignment;
- `insufficient_family_overlap_policy_preserved`: an assignable but singleton
  choice, retained for audit and excluded from comparative evidence;
- `policy_selected` or `not_recorded`: deterministic or historical selection,
  retained for audit.

The standard two-coder packet accepts only the first state. Even if a separate
human review is supplied directly, deterministic, mandatory, or unrecorded
selection remains `measurement_indeterminate` with status
`nonrandomized_assignment`; it cannot become binary memory support. Human and
auxiliary disagreement remains indeterminate under the historical pilot rule.
The prospective v2 rule keeps two-coder semantic consensus when the deterministic
observer is merely inconclusive, while an opposite binary auxiliary result or
invisible delivery still forces `measurement_indeterminate`.

## Zero-call preflight evidence

The focused tests exercise a real `scripts/tutor-stub.js` process with a fake
local CLI executable. Three turns traverse CLI parsing, launch configuration,
seeded assignment, response realization, trace persistence, and next-turn outcome
closure without contacting a provider. Separate tests replay both assignment
draws, preserve mandatory authority, reject a corrupted draw, and complete the
trace-to-packet-to-review-importer handoff.

This proves the collection plumbing. The fake dialogue does not establish real
condition prevalence, delivery fidelity, outcome rates, coder agreement, usable
support per family, or expected cost.

## Registered pilot design

The complete prospective design is
`config/tutor-stub-action-outcome-collection-pilot-design.v1.json`. It fixes one
nonoverlapping stalled-state condition, the four collection worlds and two later
evaluation worlds, the maintained `bored` learner population, the Luna model
stack, an eight-turn horizon, fixed support and register, 24 job identities and
their seed schedule, two private human-coder seats, feasibility thresholds,
create-once destinations, technical dispositions, and a hard ceiling of 1,944
model-call reservations.

At registration, the design alone was not launch authority. The zero-call collection launcher is
`scripts/run-tutor-stub-action-outcome-collection-pilot.js`. Its dry run compiles
all 24 commands, probes the local Codex CLI version, exercises the three model
roles with local stubs, and verifies the private archive plus all four
create-once destinations:

```bash
node scripts/run-tutor-stub-action-outcome-collection-pilot.js --dry-run
```

The paid path uses `services/paidStudyLaunchContract.js`. Under
`docs/paid-study-authorization-policy.md`, the launcher must merge to `main`; a
clean detached launch commit had to contain the design and launcher, and a separate
signed GO note had to name that commit, design path, and 1,944-reservation
ceiling. That launch is now closed. A passing dry run still grants no launch or
model-call authority for any successor study.

The collection pilot reported mandatory versus assigned turns, eligible-family
sets, family and action propensities, delivered/displaced actions, conditions,
review dispositions, and usable binary records. It failed the registered
feasibility gates and therefore did not license or size a later controller study.
The action-outcome memory controller remained disabled throughout collection.

## Whole-workflow status

The maintained launcher writes a versioned atomic status record outside the
sealed generation root, under its sibling `.workflow-status/` directory. The
record follows this complete phase plan:

```text
PREFLIGHT → GENERATING → EXTRACTING → AUDITING → PACKAGING → WORKFLOW_COMPLETE
```

`RECOVERING`, `BLOCKED`, and `HANDOFF_PENDING` are explicit operational states.
When generation seals, the status enters `HANDOFF_PENDING` for `EXTRACTING` and
reports model activity as inactive; `generation_complete` in the generation
report is never whole-workflow completion. The zero-call audit resumes the same
status automatically from the generation report. Its output prints the status
path, which packet preparation accepts with `--workflow-status <status.json>`.
Packet completion is the only point in this registered collection/audit/packet
workflow that records `WORKFLOW_COMPLETE`.

Status updates use atomic replacement plus a validated `.previous` record. A
reader can recover the previous complete record after an interrupted or corrupt
primary write. The status file is operational metadata only: it does not alter
sealed traces, results, routes, thresholds, study design, or call ceilings.

## Registered comparable collection v2

`config/tutor-stub-action-outcome-comparable-collection-design.v2.json`
registers the successor block. It contains 60 fresh dialogues, 15 independent
repeats in each of the four collection worlds, a new master seed, the same
Luna-only low-effort route, and a fixed ceiling of 4,860 reservations for 1,500
planned calls. The maintained collection launcher accepts this exact pinned
design through `services/tutorStubActionOutcomeComparableCollection.js`.

Only stalled-state decisions with the exact three-family support eligible set
enter comparative review. Diagnose and fade singleton decisions remain visible
audit records. The measurement policy is
`human_consensus_auxiliary_veto_v2`: exact agreement between two independent
human coders supplies the semantic label; an opposite binary auxiliary result
or invisible delivery makes the case indeterminate; an inconclusive auxiliary
result is retained as nonconfirmatory and does not erase human agreement.

The sealed v1 pilot is not part of the new sample. Rowan Flat and Tideway
Makerspace remain outside collection, review, readiness, and memory. The
controller stays disabled, so even a passing v2 collection can only support a
new held-out controller-study design.
