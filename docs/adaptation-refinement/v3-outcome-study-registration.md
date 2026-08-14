# Outcome study — prospective registration

**Date frozen:** 13 August 2026, before any outcome-study call.
**Authority:** design draft `2026-08-12_outcome-study-design-draft.md`
(its three open questions settled 12 Aug, §8); ruling 054 (presence
gate PASS); note 052e (relayed go-ahead: clean PASS authorizes the
reviewer to register and run without waking the human); note 052b
(direct ceiling 11,337 total). Deviations from the draft are listed
in §9. The follow-on in draft §7 (negative-register realization)
stays registered and PARKED: no follow-on data before the main
contrast reports.

## 1. Question

Does the live warrant gate change tutor conduct and learner
engagement in ways the bare tutor stub does not — more warranted
challenges, earlier and more frequent deference breaks — without a
cost to decision correctness? Secondary: is the gate's machinery
necessary, or does its instruction content carry the effect alone?

## 2. Conditions (identical worlds and personas across all three)

1. **Bare** — the tutor stub with no warrant gate. Control.
2. **Gated** — the stub with the live warrant gate as smoked in
   Phase 5.
3. **Standing-permission** — the bare stub plus the gate's VERBATIM
   template and hint-menu text pasted as standing instructions. Holding
   the words fixed isolates per-turn hint selection and timing as the
   contrast. The paraphrase in the deference-break note §3 is
   superseded for this purpose.

## 3. Materials and sample

- Fresh worlds from the same families as the representative matrix.
  No case from any burned diagnostic corpus; no overlap with the
  three pilot sessions in the deference-break note; nothing pooled
  from r47, r49, or r52.
- Eight-turn dialogues, permission-seeking learner persona as in the
  natural-prevalence corpus.
- **Pilot block:** 6 dialogues per condition (18 total). Go/no-go
  only (§6); it does not resize the main block.
- **Main block:** fixed at 24 dialogues per condition (72 total),
  run only on a pilot GO.

## 4. Measures

Only channels with proven reader consensus or deterministic
computation score the contrast. Per rulings 051 and 054 the
semantic-event layer joins at the **presence grain only**; every
fine-grain slot (speech-act identity, target sets, action bindings)
is out of all scoring and all gates.

**Primary (deterministic, no reader):**
1. **Decision correctness** — observe-arm decisions against the
   binary-consensus decision reading (the layer with perfect
   agreement at the last diagnostic checkpoint). Guard: correctness
   must not differ across conditions.
2. **Warranted-challenge rate** — challenges whose warrant basis the
   gate's typed rules support, scored deterministically and
   identically in all three conditions by post-hoc application over
   the learner-analysis layer. No reader. Registered with it: a
   **blind-spot audit** — 20 challenges sampled across conditions,
   condition-blind, judged in plain terms by a second model outside
   the gate's vocabulary; audit is reported, not gating.
3. **Sustained deference** — length of consecutive-turn deference
   streaks, from the deterministic compiler's deference boolean.
4. **Deference break** — first turn, if any, at which the learner
   acts or asserts without seeking permission, and whether the break
   persists to the end of the dialogue.
5. **Record growth** — whether the trial-book record grows after a
   break.
6. **Closure legitimacy (guard only)** — floor check, expected to
   saturate; not a contrast.

**Secondary (presence-grain reader channel, certified by ruling 054):**
7. **Learner result-request presence** — per decision-turn case, did
   the learner ask the tutor for a public result (speech act
   `tutor_directed_public_result_request` present).
8. **Learner proposed-test presence** — per case, did the learner
   propose a test (`learner_proposed_test` present).

Rules for 7–8: the frozen r52 instrument unchanged (all seven
digests of the presence-gate registration §1; preparer, packet and
response caps identical); two FRESH independent `codex.gpt-5.6-luna`
readers per case, one-case calls, bridge-echo attestation; scored at
presence grain by the A1 scorer's definitions; **consensus cases
only** enter the contrast (both readers agree on flag and both
presences); non-consensus and inadmissible cases are excluded and
counted in the report. Both slots satisfy the defensibility rule
(note 052c). No reader response from r47/r49/r52 is reused.

## 5. Predictions (frozen)

- Gated > Bare on measures 2–4: more warranted challenges, shorter
  deference streaks, earlier and more frequent breaks.
- Measure 1 does not differ across conditions.
- Measures 7–8: Gated > Bare on proposed-test presence; directional,
  secondary.
- **Standing-permission reading rule (predeclared):** if it matches
  Gated, the instruction content carries the effect and the machinery
  claim dies; if it sits between Bare and Gated, the machinery adds
  something the prompt cannot; if it matches Bare, the wording alone
  is inert. "Matches" is read per measure, by the reviewer, against
  the pilot-then-main pattern; no post-hoc threshold is invented
  after unblinding.

## 6. Pilot go/no-go (reviewer rules zero-call; no floor on effect size)

GO requires all of:
(a) **Assembly** — 18/18 dialogues complete and admissible; all
    deterministic measures compute on every dialogue; presence
    packets assemble and both readers return schema-valid responses
    for every extracted case.
(b) **No saturated contrast measure** — no registered contrast
    measure (2, 3, 4, 7, 8) takes a single value on more than 90% of
    pilot dialogues pooled across conditions. (Measure 6 is expected
    to saturate and is exempt.)
(c) **Variance not hopeless** — at least one deference break occurs
    somewhere in the pilot, and the warranted-challenge rate is
    nonzero in the Gated condition.
NO-GO on (b) or (c) = stop and redesign the failing measure before
the main block; the main block's 54 remaining dialogues are not run
into a ceiling. NO-GO on (a) is a technical failure under note 052a:
quarantine, disclose, re-take.

## 7. Rules

- No pooling with any diagnostic, smoke, or burned corpus; the three
  deference-break sessions are motivating evidence only.
- Presence-level claims only; the fine-grain FAIL (ruling 051,
  strict identity 26/93 out of sample in r52) is disclosed beside
  any presence-grain result.
- Never patch a live run; never waive a failed check post hoc.
- Unattended: this study runs on the overnight ruling (052a) and the
  relayed go-ahead (052e); a messy result or design decision stops
  for the human. NEVER push the branch.
- Main block runs only on a reviewer GO note committed after the
  pilot report.

## 8. Budget and provenance

- Counter: 3,523 attempts spent at freeze; hard ceiling 11,337
  total (note 052b); report-031 convention (every
  `model_call_budget_reserved` event is one attempt).
- Each phase (pilot generation, pilot readers, main generation, main
  readers) records its planned call count in a manifest BEFORE any
  call of that phase; the reviewer approves each phase plan zero-call
  before launch. A plan that would cross the ceiling is a hard stop
  for the human.
- Seed discipline: fresh seeds for outcome worlds, recorded in the
  manifest; seed 515 stays unspent unless the manifest claims it
  before any call.
- Scoring code, guards, and manifests are committed before the paid
  phase they govern.

## 9. Deviations from the design draft, stated

1. Draft §3 said "attended run with checkpoints"; this study runs
   unattended under 052a/052e. Checkpoints stay.
2. Draft §4 made the semantic-event layer conditional on the V3
   gates; resolved — it joins at presence grain only (measures 7–8),
   and measure 2 uses the deterministic typed-rule path in all
   conditions (draft §8.1).
3. The blind-spot audit's second judge is a model, not a human
   (unattended); the human may re-audit later.
