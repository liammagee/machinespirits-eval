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

Both rulings landed on 15 August (relay 106): defended over-claiming is
its own warrant basis, criterion (c) keeps its §6.25 reading, and the
contract amendment (numbered v3.3 — v3.2 was already live from relay
032) is approved. Build work may start: contract amendment plus focused
tests, runner parameterization, the move menu and concession guard,
then smoke C on a fresh seed with mock readers. No paid call inherits
the closed warrant campaign's authorization; the pilot needs its own
registration and GO note.
