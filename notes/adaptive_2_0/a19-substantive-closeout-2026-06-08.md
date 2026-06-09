# A19 Substantive Closeout And UX Pause

Date: 2026-06-08.
Branch: `codex/a19-drama-axiom-framework`.
Status: substantive A19 arc paused below claim threshold while adjudication UX and server consolidation are handled separately.

## Purpose

This note records where the substantive A19 research arc stands before the UX
detour. It is meant as the resume point for future work and as provenance for
the eventual sidecar or atlas treatment. The result is mostly negative or
below-threshold, but it is not empty: A19 converted the A18 insight into a
general protocol, exposed the failure modes that block generalization, and
preserved the ambiguous cases needed for later independent coding.

## Current Bottom Line

A19 has not yet produced a clean empirical extension beyond A18. The canonical
positive evidence remains Paper 2.0 Section 7.9's A18 claim: bounded simulated
counterfactual policy transfer on 10 of 14 held-out siblings across seven
frozen-protocol-admitted families, with explicit non-claims around human
learning, deployed tutoring, model-weight learning, and main-harness effects.

A19's current contribution is instead methodological:

- a repo-native protocol for turning teaching-drama failures into bounded axiom
  memories;
- validation and reporting infrastructure that refuses pooled rates without
  card-level labels;
- a sharper taxonomy of repair-type collapse, S0 ceiling effects, and
  target-granularity risk;
- preserved ambiguous packets for later human or multi-critic boundary coding;
- an atlas-compatible sidecar scaffold that does not introduce empirical claims
  before canonical paper prose.

The clean substantive verdict is: **A19 is framework-positive and
claim-negative at this pause point.**

## Plain-Language Reading Of The Blockers

The short version is that A19 built a better test, and the better test mostly
showed that the apparent positives were not yet clean positives.

### "Recursive-full S0 self-solves"

`S0` is the no-A19-memory control condition: the tutor does not receive the
newly induced teaching-drama axiom. `Recursive-full` means this control is still
allowed to use the strong recursive replay and self-repair machinery. In plain
language, the comparison asks: "Does the saved A19 lesson help beyond what a
strong fresh tutor can already work out for itself?"

Often, the answer was no. The fresh no-memory tutor solved the held-out case on
its own. When that happens, S1 may also solve the case, but the result is a
ceiling rather than evidence of transfer. We cannot credit the A19 memory for a
repair the control tutor already found unaided.

### Why Allow The Strong S0 At All?

The intuition to test is right: A19 is asking whether a small, bounded S1 memory
can shift the behavior of a very capable tutor, not whether it can help a weak
or under-tooled system. In effect, we allow a full Codex/Claude-style process to
bring its normal reasoning, critique, and revision faculties to the held-out
case, then ask whether adding exactly one minimal axiom changes the result
meaningfully and repeatably. Strictly, this is tutor-as-learner recursion in a
simulated counterfactual replay, not evidence that a human learner recursively
learned.

That is a severe test by design. Its purpose is to isolate the treatment. If S0
were weaker than S1, a positive result could come from extra reasoning budget,
better prompting, more recursive checking, or more context, rather than from the
teaching-drama axiom itself. By letting S0 use the same generator, replay gate,
checker, thresholds, and prompt structure as S1, the clean contrast becomes:
"same capable tutor, same held-out case, same machinery; S1 has one extra policy
memory and S0 does not."

The cost of this discipline is that many possible wins disappear. A strong S0
often notices the problem and repairs it on its own. That is not a defect in the
control; it is the point of the control. A19 only gets evidence where the
no-memory tutor still falls into a predictable decoy or nearby repair, while the
one-axiom tutor avoids it. A18 found such windows in structurally identifiable
local-relation cards. A19's broader repair families have not yet produced that
kind of clean, repeatable window.

We can still use weaker S0 variants, but only for diagnosis. A weak S0 can tell
us whether an axiom is useful to a less reflective tutor or whether a family is
worth promoting. It cannot by itself support the stronger A19 claim, because the
claim is about policy memory adding something beyond ordinary high-capability
in-context reasoning and self-repair.

### "Non-transfer repairs collapse into transfer-control or nearby labels"

A19 tried to move beyond A18's cleaner pattern, where the tutor learns a
specific rule and later applies that rule to a sibling case. The goal was to
test broader repairs: restoring learner standing, renegotiating an
instructional contract, naming a contradiction in the tutor's own commitments,
or preserving productive struggle.

The problem is that many of these broader repairs still look, in the public
transcript, like the tutor is asking the learner to choose, apply, test, or
check something before moving on. A blind adjudicator can then reasonably code
the move as ordinary transfer-control: "make the learner apply the rule in the
new case." In other cases, the move looks like a nearby repair such as
claim-addressing rather than the registered target repair.

That matters because A19's claim is not just "S1 sounded better." The claim
would have to be: "S1 used the registered non-transfer repair, and S0 did not."
If the public evidence can be read as transfer-control or a neighboring repair,
the card becomes construct-ambiguous rather than claim-supporting.

### "The learner-standing packet has only single-coder diagnostic support"

The preserved learner-standing packet is the best current ambiguous case. One
human coding pass has been completed, and that is useful: it tells us the
codebook and packet are usable, and it gives concrete feedback for revising the
next family.

But one coder is not agreement evidence. It does not tell us whether independent
readers share the same boundary judgment, whether the target label is stable, or
whether another coder would see the same arm as better for learner-standing
reasons. Until at least two independent coders judge the same blinded packet, the
human result remains `single_coder_diagnostic_only`.

In practical terms: this packet can guide the next codebook and v0.9 design, but
it cannot upgrade A19 into an empirical transfer claim.

## What Was Completed

### Zero-API Framework

The initial A19 scaffold is complete:

- `notes/adaptive_2_0/a19-drama-axiom-transfer-spec.md`
- `notes/adaptive_2_0/a19-drama-axiom-transfer-todo.md`
- `notes/adaptive_2_0/a19-literature-positioning-matrix.md`
- `config/teaching-drama-axioms/a19-protocol.yaml`
- `config/teaching-drama-axioms/pilot-families.yaml`
- `scripts/validate-teaching-drama-axiom-protocol.js`
- `scripts/report-teaching-drama-axiom-framework.js`
- `tests/teachingDramaAxiomProtocol.test.js`

The protocol now checks family IDs, training seeds, held-out siblings,
old-rule decoys, target policy, plausible repairs, anti-conditions, aliases,
cue-map risk, headroom predictions, claim boundaries, prompt/protocol
versions, and report provenance.

### Attempt-1 And Axiom-Induction Apparatus

A19 now has an attempt-1 materialization and gate path, plus bounded axiom
induction. This changed the evidence unit from "a promising transcript" to
"a survived attempt-1 failure record, one admitted axiom, and held-out S0/S1
cards." That is the correct generalization of the A18 apparatus, but it did
not produce a clean positive A19 claim.

### Held-Out Contrast Loop

The S0/S1 loop was repeatedly hardened:

- S0-first screening stops before S1 when recursive-full S0 already solves the
  target;
- S1 receives exactly one bounded axiom, not a full `revision.json` replay;
- target and decoy aliases are withheld from the arbiter;
- each card receives a basis label such as `policy_headroom`, `ceiling`,
  `policy_failure`, `neither_correct`, or `protocol_reject`;
- weak S0 and diagnostic baselines remain protocol screens only, not claim
  paths.

### Generalization Tracks

The three post-A18/A19 tracks were pursued and resolved for this unit of work:

1. **Repair families whose public obligations should resist transfer-control
   collapse.** Multiple candidates were preregistered and screened.
2. **Adjudication infrastructure for ambiguous repair-type boundaries.** The
   packet, codebook, CLI, validator, merge report, and dashboard prototype now
   exist.
3. **Alternate S0 or tutor/learner conditions.** These are registered as
   diagnostic screens only; recursive-full S0 remains required for claims.

The loop registry records this state in:

- `config/teaching-drama-axioms/a19-generalization-loops.yaml`
- `notes/adaptive_2_0/a19-generalization-systemization-plan.md`
- `notes/adaptive_2_0/a19-exhaustion-report-2026-06-08.md`

## Negative Findings To Preserve

The negative result is substantive, not just a tooling blocker.

### Recursive-Full S0 Is Often Too Capable

Many held-out cards self-solved under `recursive_full_no_policy_memory`. This
is a high-quality baseline, but it leaves little headroom for A19 memory. A
weaker S0 can be useful for triage, but cannot license Paper 2.0, atlas,
sidecar, or paid-panel claims without recursive-full confirmation.

### Non-Transfer Repairs Collapse Into Transfer-Control

Several theoretically distinct repair types repeatedly collapsed under blind
extraction because their public action still looked like a learner application,
choice, diagnostic check, or ownership gate before closure. This affected
diagnostic-options and preserve-struggle screens especially, and remained a
risk for later public-commitment and learner-standing screens.

### Local Headroom Did Not Become A Stable Claim

Earlier surface-agreement candidates produced two local policy-headroom cards,
but stability failed: reruns resolved as S1 failure or S0 self-solve. The later
instructional-contract family produced one stable local card, but not the two
clean stability-confirmed cards required for escalation.

### v0.7 And v0.8 Are Ambiguous, Not Positive

`public_commitment_contradiction` and `moral_disclosure_standing_repair`
produced useful ambiguous cases, but both remain below threshold:

- v0.7: one local policy-headroom card with target-granularity risk, plus two
  recursive-full S0 ceilings.
- v0.8: one local policy-headroom card with target-granularity risk, one noisy
  S0 ceiling, and one clean S0 ceiling.

These are preserved as adjudication targets, not reported as transfer evidence.

## Human Boundary State

The v0.8 ambiguous learner-standing card has been preserved for independent
coding:

- blinded assignment:
  `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment.json`
- private key:
  `exports/a19/human-coder-assignments/moral-disclosure-standing-repair-a.assignment-key.json`
- codebook:
  `exports/a19/adjudication-codebooks/learner-standing-v01.codebook.json`
- coder submission:
  `exports/a19/human-coder-submissions/moral-disclosure-standing-repair-a/coder-001.json`
- merged human-coder report:
  `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-coders.json`
- boundary report:
  `exports/a19/adjudication-reports/moral-disclosure-standing-repair-a.human-boundary-report.md`

Current status: `single_coder_diagnostic_only`.

This is useful process evidence. It supports codebook revision and future v0.9
family design, but it does not establish agreement and does not license A19,
Paper 2.0, atlas, or sidecar empirical claims.

## UX Detour Boundary

The adjudication UX now has a CLI and a first dashboard form, but the server and
workflow need consolidation before more coders should be recruited. The
substantive arc should remain paused until the UX work settles:

- one canonical dashboard route should own adjudication;
- coder/session assignment should be explicit before public exposure;
- the web form should remain equivalent to the CLI validator and submission
  schema;
- external access should not expose private assignment keys, target/decoy
  aliases, arm provenance, or policy-memory condition.

The UX detour is operational, not empirical. It should not change the A19 claim
boundary unless new independent coder submissions are collected and merged.

## Forward Provenance Rule

Future A19 generation, checking, and adjudication artifacts should record model
identity as specifically as the local surface permits:

- backend and CLI command, such as `codex exec` or `claude`;
- CLI version, when `--version` is available;
- requested model or model alias, when supplied explicitly;
- resolved model, when the tool exposes it;
- a clear `unresolved_cli_default` marker when the run used a local default;
- reasoning effort or equivalent budget knob, plus whether it came from an
  explicit argument, environment variable, or local default.

This matters because labels like `default`, `config-default`, and
`claude_cli_default` can differ across machines and dates. A19 should preserve
those labels when they are all the CLI exposes, but it should also make the
unresolved-default status explicit so later replication does not treat a local
default as a pinned model.

## Resume Point

When UX consolidation is done, the legitimate substantive resume paths are only:

1. **Independent coding of preserved packets.** Collect at least two independent
   coder files for the same packet hash, merge them, and report agreement only
   on that same artifact.
2. **A newly preregistered repair family.** Design a v0.9 family whose public
   obligations are stricter about anti-collapse before any generation.

No current A19 artifact licenses paid-panel escalation, retrieval,
fine-tuning, DPO/SimPO, process reward modeling, SEAL-style self-edits, atlas
projection, sidecar empirical claims, or Paper 2.0 claim updates.

## Acceptance Snapshot

The substantive closeout should be treated as valid only if these commands
continue to pass after any UX edits:

```bash
npm run a19:validate -- --json
npm run a19:generalize -- --json
npm run test:a19
npm run test:a19:human-adjudication
npm run a19:report
npm run atlas:validate
```

For the dashboard-specific surface, also run:

```bash
npm run test:a19:dashboard
```

## One-Sentence Closeout

A19 successfully generalized A18 into an extensible evaluation framework, but
the current screens are negative or below threshold: recursive-full S0 often
self-solves, distinct repairs often collapse into transfer-control or nearby
repair labels, and the preserved ambiguous learner-standing card has only
single-coder diagnostic support so far.
