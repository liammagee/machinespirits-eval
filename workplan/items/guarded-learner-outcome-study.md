---
id: guarded-learner-outcome-study
title: Extend the warrant gate to the guarded (defensive) learner
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-15
updated: 2026-08-15
verification: A pilot under its own registration (bare / gated / standing
  arms, guarded persona) reports the registered endpoints — evidence
  production within two turns of a delivered challenge, decision
  correctness, report-only stance table — and a main block runs only if the
  pilot gate passes. Each paid stage needs its own committed GO note plus
  explicit human approval.
claim_status: future
depends_on:
  - adaptive-warrant-outcome-study
links:
  notes:
    - docs/adaptation-refinement/2026-08-15_guarded-learner-extension-plan.md
    - docs/adaptation-refinement/2026-08-13_guarded-bad-learner-draft.md
    - docs/adaptation-refinement/relay/106-human-ruling-guarded-pole-basis-and-contract-v3.3.md
    - docs/adaptation-refinement/relay/107-build-note-v3.3-contract-and-guarded-sensor.md
    - docs/adaptation-refinement/relay/108-build-report-guarded-pole-complete-smoke-c-request.md
    - docs/adaptation-refinement/relay/109-go-smoke-c-guarded-pole.md
    - docs/adaptation-refinement/relay/110-registration-guarded-pilot.md
    - docs/adaptation-refinement/relay/111-block-pilot-frozen-binding-mismatch.md
    - docs/adaptation-refinement/relay/112-guarded-pilot-reseal.md
    - docs/adaptation-refinement/relay/113-go-guarded-pilot.md
    - docs/adaptation-refinement/relay/114-go-guarded-pilot-resume.md
    - docs/adaptation-refinement/relay/115-go-guarded-pilot-reader-retake.md
    - docs/adaptation-refinement/relay/116-act-list-main-block.md
    - docs/adaptation-refinement/relay/117-registration-guarded-main-block.md
    - notes/2026-08-15-guarded-pilot-patches.md
    - notes/2026-08-15-run-protocol.md
  paper: §6.25
tags:
  - warrant-gate
  - adaptive
  - outcome
---

The warrant arc closed on the passive pole (§6.25): the always-on steering
line carried the deference-break change, the timed challenge family paid
~12 points of decision correctness, and the standing wording alone
delivered zero challenges. This card carries the same gate to the opposite
pole — a learner who over-claims and defends instead of deferring.

Plan (see the linked extension plan): amend the semantic event contract to
v3.2 with three defensive events (over-claim assertion, evidence dismissal,
evidence demand), thread a learner-profile argument through the sealed
warrant runners instead of forking them, add the typed move menu plus
concession guard, and arm the sensor on consecutive defended over-claim
turns. The passive endpoints do not transfer: the primary conduct endpoint
becomes evidence production within two turns of a delivered challenge,
with decision correctness unchanged and the stance table report-only in
the pilot. Predictions get written from pilot evidence only.

**Build complete, 15 August (relay 108).** All four items landed on
`build/guarded-learner-v3.3` in `../ms-guarded-learner`, zero paid calls:
contract v3.3 with the three defensive acts and the preference rule
(`124294c1`), `--learner-profile` on the three sealed runners
(`b7a52752`), and the typed move menu plus concession guard
(`b79c413a`). Hermetic suite 8,719 pass; the only 3 failures are
derivation byte contracts that fail on the branch base too. All four
sealed A1 pins and both reader-script pins re-hash byte-identical.

**Smoke C PASSED, 15 August (GO note relay 109, approval quoted).**
Seed 550, 8 turns, sealed, inside the 30-call budget, archived to the
private repo. The sensor armed at three consecutive defended over-claim
turns (N = 3) and the gate delivered a challenge at turns 3 and 5; after
each, the learner's bounded evidence move closed the contract and the
gate returned to staging. The concession guard fired 0 of 8 turns.
Finding: the evidence-demand act stayed dark — demand-like turns were
read as the older proposed-test act (neutral direction, not the smoke B
deferral failure).

**Pilot REGISTERED, 15 August (relay 110), both open decisions
answered by the human.** 18 dialogues (3 arms x 2 worlds x 3 seeds),
guarded persona, ~1,116 calls. Primary endpoint: evidence production
within two turns of a delivered challenge. Gate: the sensor arms in
more than half the gated dialogues that carry a defensive stretch, no
armed stretch is silently dropped, and reader coverage is complete. The
primary endpoint is measured, never gated, so a null stays a finding.
Stop rules cover the dark evidence-demand act, the deferral mislabel
(terminal), and persona collapse.

**Pilot spend approved, then BLOCKED before launch, 15 August (relay
111).** Zero calls made. The seeds turned out to be frozen in code
(515, 516, 517), not free, so relay 110 §6 was amended. Re-computing
every launcher pin then found two of eight failing.
`extraction_schema_digest` moved by design — it hashes the bytes of
`adaptiveWarrantSemanticEvents.js`, which v3.3 changed — so a v3.3 arm
cannot match the v3.2 pilot seal. `reader_digest` was already broken on
`main` by a prettier pass (`e729e1a8`) that landed after the manifest
was sealed (`a265c99b`); the diff is reflowing with no changed token,
so the fix is to restore the bytes and add a test that holds them. The
A1 pilot has not been launchable from `main` since that commit. The
approval stands unspent; a cleared block needs its own GO note.
Recommendation on the record: re-seal a guarded manifest at v3.3.

**Digest block cleared by re-seal, 15 August (relay 112).** Still zero
calls. `scripts/seal-guarded-warrant-outcome-manifest.js` writes
`docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json`,
which re-pins exactly the two contested digests and inherits and
re-checks every other pin. The A1 seal is untouched and still fails at
HEAD, as a v3.2 seal should. Re-pinning is not taken on trust: each
file behind a moved digest is parsed at the sealed commit and at HEAD
and the two trees are compared with positions stripped, so a real
program change must be declared on the command line. Three of the four
files are reflow; only the v3.3 act catalogue changed. A defect was
fixed in passing — the freshness guard hardcoded `low_agency`, so the
guarded pole would have been fingerprinted as the passive one.

**Endpoint 5 moved to the live extractor, 15 August. No paid call.**
The frozen presence-reader response schema was minted before v3.3 and
cannot name the three defensive acts, so a defensive turn would be
pushed onto the nearest old act; gate slots (a), (b) and (c) never
depended on it. Rather than spend a schema-acceptance call to mint a
v3.3 schema, report-only endpoint 5 now reads the validated v3.3
semantic-event extraction the warrant gate already stores on every
decision — the same extraction the gate acted on, so the counts and the
gate agree by construction. Counter:
`scripts/report-adaptive-warrant-defensive-acts.js`. A turn the
extractor cannot read is named as unmeasured, never counted as a zero.
On smoke C all 8 turns are measurable: 7 over-claim assertions, 1
evidence dismissal, 0 evidence demands. Relay 110 §3 is amended to say
so. Patch record: `notes/2026-08-15-guarded-pilot-patches.md`.

**A second stale pin found, 15 August. No paid call.** Re-computing the
eight launcher pins for the GO note showed all eight matching — and one
of them proving nothing. `provider_response_schema_sha256` is checked by
comparing the carried-over schema-acceptance artifact against the
carried-over manifest pin, two numbers from the same stale seal. The
readers are never sent that schema: the preparer builds a response
schema per batch from the live act catalogue, which at HEAD is v3.3. So
the readers answer under a larger schema than the provider was ever
tested against. This also corrects relay 112 §4 and §5 of the patch
note, which said the readers cannot name the three defensive acts —
they can; what is unproved is provider acceptance.
`auditProviderResponseSchemaPin` now either re-pins from a fresh
acceptance artifact that passed and was stamped at the current commit,
or records `inherited_unproved` with the reason in words. The guarded
manifest carries that record. A second guard stops a bare re-seal from
writing `unresolved` over a frozen-schema status an earlier run read.

**Spend approved by the human, 15 August: "I approve the further
spend."** The launch still needs its own committed GO note, which adds
a rung 0: one schema-acceptance ping at v3.3 (cap 1 call) and a
zero-call re-seal, so the 1,116-call pilot runs against a proved
schema.

**GO note committed, 15 August (relay 113). Still zero paid calls.**
Three rungs: rung 0 the ping plus re-seal (1 call, blocks the rest),
rung 1 the pilot (1,116 calls), rung 2 the main block (its own note).
Counter re-read at GO time: 10,459 (relay 105) + 26 (smoke C) =
**10,485 / 19,337**, closing at 11,602 with 7,735 left. All eight pins
re-hash; menu guard, freshness guard and brittleness preflight all pass
(persona `overconfident`, 18 prepared runs, 42/42 checks). The run
protocol behind the rung ladder is written up at
`notes/2026-08-15-run-protocol.md` so it can be repeated without
reading the relay chain.

**Rung 0 PASSED, 15 August. One paid call. Counter now 10,486 /
19,337.** The provider accepted the v3.3 schema: `status: passed`,
calls 1/1/1, no prohibited tool events, model codex `gpt-5.6-luna`, and
a response schema naming all three defensive acts. Archived to the
private repo. The re-pin that followed then broke the launch, which is
the check working. The manifest pin and the schema-acceptance artifact
the instrument freeze names had been two copies of one A1 seal, so the
launcher had been comparing a number with itself; moving one half
turned a vacuous pass into a real failure, and the 1,116-call pilot
would have refused to start. `seal-guarded-warrant-instrument-freeze.js`
(new, zero calls) moves the other half from the same paid evidence and
refuses unless the two agree. A zero-call launch simulation then put the
result through the launcher's own `verifyOutcomePilotReaderBindings`,
which returned `passed` on all seven checks. One rule of mine was
dropped in the process: demanding the acceptance artifact be stamped at
HEAD would refuse a good artifact one commit later and push a future
re-seal toward paying for a second ping, so the test is now ancestry
plus schema coverage. Relay 113 §4's launch command changed — the
`--instrument-freeze` flag now names the guarded freeze — and the note
is amended. Rung 1 is not launched.

**Rung 1 COMPLETE and the pilot gate PASSES on all three slots, 15
August.** The run finished under relay 114 (resume) and relay 115 (one
reviewer-authorised reader re-take, 1 call). 18 dialogues sealed, four
readers assembling at 144 cases each with 0 rejections. Counter
**11,559 / 19,337**, leaving 7,778. Archived to the private repo before
any analysis. The gate had no scorer — the one in the tree belongs to
the A1 passive study and pins its corpus hash and reader fingerprint —
so `scripts/score-guarded-pilot-gate.js` was written (zero calls, 10
tests) and reads a finished run:

- **(a) the sensor arms when it should: PASS, 5 of 5, 3 needed.** Five
  of the six gated dialogues carry a stretch of three or more
  consecutive defended over-claim turns, and the sensor armed inside a
  stretch in all five. The sixth (dialogue 13) carries no stretch — the
  learner over-claims on 6 of 8 turns but breaks the run with an
  analytic turn at 3 and at 6 — so it leaves the denominator, and the
  sensor correctly stayed quiet. That is the threshold working, not
  persona collapse.
- **(b) no silent drops: PASS, 10 of 10.** Every challenge the policy
  selected on a live turn was enforced and delivered as
  `challenge_resistance` with text. The selection is read from the
  policy, never from the enforcement, so a selection that produced no
  enforcement at all would still count against this slot. A further 40
  selections were made in `observe` mode, where the gate reaches nobody
  by design; those are reported apart, not scored.
- **(c) reader coverage complete: PASS.** Both channels `complete`, 0
  incomplete batches, both presence readers 144 cases with 0 rejected
  and 0 unanalyzed. The one re-read batch is
  `presence-reader-a-batch-123`, which is why the presence channel
  shows 289 complete rows against the decision channel's 288.

Relay 112 puts slots (a) and (b) on the live trace rather than the
readers. The scorer re-scores slot (a) on the frozen readers as well:
PASS 4 of 5 when both readers must mark the turn, PASS 5 of 6 when
either will do. The verdict does not turn on that ruling. Rung 2, the
72-dialogue main block, stays unauthorised and needs its own
registration, GO note and approval; predictions get written from pilot
evidence only.

Both rulings landed on 15 August (relay 106): defended over-claiming is
its own warrant basis, criterion (c) keeps its §6.25 reading, and the
contract amendment (numbered v3.3 — v3.2 was already live from relay
032) is approved. Build work may start: contract amendment plus focused
tests, runner parameterization, the move menu and concession guard,
then smoke C on a fresh seed with mock readers. No paid call inherits
the closed warrant campaign's authorization; the pilot needs its own
registration and GO note.

**Primary endpoint read, and the act list fixed, 15 August.** Zero calls
for both. Ten challenges reached a learner, all in the gated version of
the tutor; the two control versions delivered none, so the pilot has no
comparison between versions on this endpoint.

Relay 110 registered the endpoint but never said which speech acts count
as a bounded evidence move. On the same 10 challenges and the same 576
readings, two defensible lists give 3 of 10 and 9 of 10. Relay 116 fixes
the list by a rule instead of by naming favourites: an act counts when the
learner puts a named public record in play AND is exposed to what it says.
Every one of the 18 acts gets exactly one place, and a test fails if any
act sits in two bands or none.

Result under the fixed list: **3 of 10 with both readers**, 4 of 10 with
either, 2 of 7 over full reply windows. The second count (accepts a check,
names no record) is 0 of 10, which is also the guard on choosing after
seeing the data — the two acts most open to tuning never appear. The
turned-down wide reading, 9 of 10, stays computed so the record shows it.

Correction carried to the main block: the live gate's own uptake check
reads 7 of 10 because it passes a confident re-assertion whenever agency
codes as steering. It stays a control signal and must never be reported as
the endpoint.

Counter unchanged at 11,559 / 19,337, leaving 7,778. Rung 2 stays
unauthorised. The rest of the main-block registration is unwritten.

**Main-block registration sealed, 15 August (relay 117).** The human
ruled on the three open decisions, verbatim: "1. yes. 2. yes. 3. go with
lean, \"read it before sealing\"". So: the shadow contrast is the
registered prediction (delivered-challenge evidence rate above the
shadow-selected baseline, pilot 3/10 vs 2/35); 72 fresh dialogues, both
reader channels, plan ≈4,500 calls, cap 4,800; and the pilot's decision
correctness was read before sealing, zero calls, by grouping the frozen
scorer's own measure-1 case list by condition — gated 28/39 (71.8%),
standing permission 24/41 (58.5%), bare 19/37 (51.4%), overall 71/117
matching the stored scorer exactly. The pilot disagrees with the passive
block's old flat prediction and repeats the passive line's direction, so
M1 registers directional: gated exceeds each control. Measured, never
gated.

Both pilot scorers now carry a main-block shape (72 dialogues, 24 gated)
behind a `--shape` flag, with the pilot shape as the default, so the
pilot's frozen numbers reproduce byte for byte and a run of the wrong
size fails closed rather than scoring. The endpoint scorer also computes
the registered P3 contrast: pilot 3/10 delivered against 2/35 shadow.

The seed check failed and moved the range. Relay 117 proposed 530–541;
six of those (530–535) are the passive main block's own seeds, and 541
is in a drama-derivation matrix spec. Everything from 503 to 550 is
burned. The registered range is now **654–665** (relay 117 §11), clean
on both a seed-context search and report 098's run-seed metadata search,
across this repo and the private archive.

Seeds are now handed out by a tool rather than by hand.
`config/seed-ledger.yaml` writes down every claimed range and
`scripts/seed-ledger.js` unions it with a search of the tree; a range is
free only when both agree. `check 530-541` fails with the owner of each
of the twelve clashes, `check 654-665 --for "guarded-learner main
block"` passes. A test fails when a run lands a seed the ledger does not
carry. This is what the defect asked for: the claim was prose and the
check was written fresh each time.

**The GO note is blocked on a driver, found 15 August.** Before writing
the note I checked that the command it would carry can run. It cannot.
`run-adaptive-warrant-outcome-main-block.js` is welded to the passive
block in seven places: it refuses any `--go-note` but 097a; it asserts
seeds equal 524–535 by value; it asserts the whole call plan by value,
including `counter_before: 5274`; it throws unless the presence channel
is **disabled**, and the guarded block needs it on; it requires the GO
note to contain the literal strings 524, 535, "1,152" and 48; its
reader budget is decision-only, 1,152 against the 2,304 registered; and
its default manifest is the A1 one. No guarded main-block manifest
exists.

The pilot driver is the better base and the arithmetic already fits: it
takes any fresh relay note, reads seeds and worlds from `--manifest`,
and already runs both channels. It pins 18 dialogues in two places
(lines 196 and 1267). The guarded main block is that driver at four
times the size — generation 2,000 + presence 1,152 + decision 1,152,
which is relay 117 §5's plan. So the pre-GO build is: lift the 18 to a
shape read off the manifest, seal a guarded main-block manifest, and
prove it with a zero-call launch simulation. Relay 117 §9 named only the
scorers as the pre-GO build and missed this.

The run stays unauthorised until its own GO note quotes explicit
approval of the spend. Counter still 11,559 / 19,337.

**The driver is built; the GO note is now the only thing missing.** The run
size is a value the manifest states, not a number written into the driver
nine times. One registry holds the seed list and four per-seed constants and
derives the rest, so the pilot's 1,116 calls and the main block's 4,464 come
from the same arithmetic and cannot disagree. The pilot re-seal still writes
the committed manifest field for field.

Three welds went with it, each of which would have passed a wrong run
quietly: the reader launcher read its remaining budget from a module constant
and now reads the checkpoint's own plan; the call-plan assert compared against
a frozen literal and now checks the four counts against the shape plus ledger
arithmetic that must close; the fingerprint guard defaulted to 144 cases and
now demands the count. The GO note is checked *after* the manifest, so a note
approving 1,116 calls cannot launch a 4,464-call block.

Sealed: `docs/adaptation-refinement/guarded-main-block/guarded-main-block-manifest.json`
— 72 dialogues on seeds 654–665, 576 cases, 4,464 calls, counter 11,559 →
16,023 under the 19,337 ceiling, 3,314 left. Same two schema pins the pilot
seal read.

Proved: `scripts/simulate-guarded-main-block-launch.js` runs the launcher's
guard chain and stops before the first call. Eight checks held, including that
the pilot's own GO note (113) is refused against this block and that a pilot
checkpoint cannot be resumed into it. The two refusal checks call the
launcher's guards rather than copies, so deleting a guard fails the
simulation. Artifact: `main-block-launch-simulation.json`.

`launch_authorized: false`. Counter unmoved at 11,559 / 19,337. The block runs
only when its own GO note quotes explicit human approval of the ≈4,500-call
spend.

**The launch note is written, and the approval landed.**
`docs/adaptation-refinement/relay/118-go-guarded-main-block.md` carries the
whole launch on one page — design, command copied from the driver's usage
output, seeds re-checked against the ledger, budget, counter, stop rules.

It was sealed held first: §1 empty, and two of the four things the launcher
reads out of a note left out on purpose, so it read complete to a person and
failed closed to the machine. On 2026-08-15 the human wrote "I approve the
spend, fill in section 1". Filling §1 put the other two tokens in. The design,
the command, the seeds, the budget and the stop rules did not move.

Why the note had to hold itself: every sealed manifest carries
`launch_authorized: false` and a hold sentence, and the driver reads neither.
The note bytes are the only machine lock left after `--accept-charges`.
Recorded as defect ledger entry 20, fix deferred to its own change — and it
does not land while a run is live.

The simulation is told which answer it must get — `--held-go-note` for a note
that must be refused, `--go-note` for one that must launch — so a refusal is
scored as a pass instead of a broken check. Eight checks held with the held
note. Eight hold again with the armed note.

**Next: start the block, then archive before anything else.**
