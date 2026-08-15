# 2026-08-15 — patches and fixes on the guarded-learner pilot branch

Branch `build/guarded-learner-v3.3`, worktree `../ms-guarded-learner`, off
`origin/main` at `9da19711`. **Never push this branch.**

**Sections 1–9 cost zero paid calls.** Section 10 records the one call that
has since been spent — the rung-0 schema-acceptance ping, approved in the
chat and covered by the committed GO note, relay 113. The pilot spend itself
is still held, not spent.

This note records what was patched today and why, so the work can be read
without walking the relay chain. The registration itself is relay 110; the
block report is relay 111; the re-seal report is relay 112.

---

## 1. The seeds were not free (relay 110 §6 amended)

The registration was drafted as if the pilot could draw fresh seeds. It cannot.
The seeds are frozen in code as **515, 516, 517**
(`scripts/prepare-adaptive-warrant-outcome-study.js:44`), and the pilot runner
asserts the manifest matches that exact list
(`scripts/run-adaptive-warrant-outcome-pilot.js:176`).

The registration now takes them as given. The gain is real: the guarded arm
draws the same scenarios as the passive pilot, so the two poles can be read
against each other without a draw difference standing between them. The
freshness audit still governs the smoke rungs and any later free-seed run.

Commit `1a6fbf10`.

---

## 2. Two of the eight launcher pins failed (relay 111)

Re-computing every pin before launch found two failures. They have different
causes and only one of them is about this branch.

**`extraction_schema_digest` moved by design.** It hashes the bytes of
`services/adaptiveWarrantSemanticEvents.js`, and commit `124294c1` changed that
file to add the v3.3 acts. A v3.3 arm cannot match a v3.2 seal. Nothing to
restore.

**`reader_digest` was already broken on `main`.** Bisected: it passes at
`a265c99b`, the commit that wrote the A1 manifest, and fails at `e729e1a8`,
`style: apply prettier to warrant-fold files`. So the A1 pilot has not been
launchable from `main` since that formatting pass landed.

The block was reported before any spend, not found afterwards.

Commit `1a6fbf10`.

---

## 3. The re-seal, and how a re-pin is kept honest (relay 112)

The user chose to re-seal a separate manifest for the guarded pole rather than
edit the passive seal.

New: `scripts/seal-guarded-warrant-outcome-manifest.js` — zero calls. It reads
the A1 manifest, re-checks every inherited pin against the working tree,
re-computes the two digests that moved, and writes
`docs/adaptation-refinement/guarded-pilot/guarded-pilot-manifest.json`. The A1
directory is untouched, and the A1 manifest still fails at HEAD, which is
correct for a v3.2 seal.

A pin exists so that a byte change stops the run, so re-pinning by hand would
defeat the point. The script does not accept the word "reflow". For each file
behind a moved digest it parses the sealed-commit version and the working-tree
version, strips positions from both parse trees, and compares them:

| File | Bytes | Program |
|---|---|---|
| `services/adaptiveWarrantSemanticEvents.js` | moved | **changed** |
| `services/adaptiveWarrantSemanticAnnotation.js` | moved | same |
| `scripts/prepare-adaptive-warrant-semantic-annotations.js` | same | same |
| `scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js` | moved | same |

A file whose program changed may be re-pinned only when it is named on the
command line as a contract change, and a named file that did not change is also
a failure. Both refusals are tested.

**Why an AST comparison and not a whitespace collapse.** The first attempt
collapsed whitespace and compared strings. It called
`run-adaptive-warrant-semantic-schema-acceptance-ping.js` a content change,
wrongly: prettier had folded a multi-line import onto one line, which also
removes the trailing comma. Collapsing whitespace cannot tell that apart from a
real edit. Comparing parse trees can.

Commit `b66ffe0d`.

---

## 4. The freshness guard fingerprinted the wrong learner

Found while wiring the re-seal. `guardOutcomePilotPreparation` hardcoded
`learner_profile: 'low_agency'`, so the guarded pole's 18 planned runs would
have been fingerprinted as the passive pole's, and the freshness check would
have compared the wrong thing.

Fixed: the persona is threaded through and comes from the manifest. The default
stays `low_agency`, so a manifest that names no persona — the A1 seal — behaves
exactly as before. The launcher now also refuses when `--learner-profile`
disagrees with the manifest, from either side. Tested: the two poles share no
prepared-run fingerprint.

Supporting change: `OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE` and
`OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES` moved into
`services/adaptiveWarrantOutcomeLearnerProfiles.js`, so the zero-call
preparation script can name a persona without importing the scorer. The scorer
re-exports both names, so existing callers are unchanged.

Commit `b66ffe0d`.

---

## 5. The frozen acceptance artifact covers a smaller schema than the readers get

Machine-checked. The pinned schema-acceptance artifact —

    /private/tmp/adaptive-warrant-v3-schema-ping-62e4fd0a-r47-s514/response.schema.json
    sha 44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1

enumerates 15 acts. Missing: `learner_overclaim_assertion`,
`learner_evidence_dismissal`, `learner_evidence_demand`.

**Correction to an earlier reading of mine, and to relay 112 §4.** I first wrote
that the readers "cannot name the v3.3 acts". That is true of this artifact and
false of the reader instrument at HEAD. The preparer builds a fresh response
schema per batch from the live act catalogue
(`scripts/prepare-adaptive-warrant-semantic-annotations.js:192`) and writes it as
`${batchId}.response.schema.json`. At HEAD that catalogue is v3.3, so the readers
**are** sent a schema that names all three defensive acts. The acceptance
artifact is only checked for a `passed` status; its schema is never handed to a
reader.

So the real gap is the opposite way round: the readers answer under a larger
schema than the provider was ever tested against, and the pin that is supposed to
catch that compares two numbers carried over from the same stale seal. It passes
and proves nothing. This is the second stale-pin defect on this branch — the
first was the hardcoded persona in §4.

Slot by slot, nothing in the gate depends on it:

- gate slots (a) and (b) read the live gate trace. Unaffected.
- gate slot (c) needs the readers to run and agree, not to name a new act.
  Unaffected.
- registered endpoint 5 no longer uses the readers at all — see §6.

**Fix.** `auditProviderResponseSchemaPin` in the seal script either re-pins from
a schema-acceptance artifact that passed **and** was stamped at the current
commit, or records `inherited_unproved` in the seal with the reason in words. It
refuses a failed artifact, an artifact from another commit, and an artifact with
no hash. The guarded manifest is re-sealed and now carries
`reseal.provider_response_schema_pin.status = "inherited_unproved"`.

The first draft of that audit read the stamp from `artifact.bindings.source_commit`
and would have refused every real artifact. The ping writes `source_commit` at the
top level. Caught by reading the archived A1 artifact instead of trusting the
shape I had in mind, and a test now reads that file so the shape cannot drift
unnoticed.

Clearing the pin costs one paid call: run the schema-acceptance ping at v3.3,
then re-seal with `--schema-acceptance`. That is rung 0 of the GO note.

**Superseded 15 August, see §10.** The pin is now `repinned`, not
`inherited_unproved`. The stamped-at-the-current-commit rule described above
was replaced: it decays after one commit. The seal now asks for ancestry plus
schema coverage instead.

Commits `b66ffe0d`, then the re-seal.

---

## 6. Endpoint 5 moved to the live extractor (no paid call)

Two ways out were put to the user: mint a v3.3 response schema for one paid
call, or read the counts from the live extractor. **The user chose the live
extractor.**

The warrant gate already stores a validated v3.3 semantic-event extraction on
every decision (`decision.semantic_event_extraction`), and it is the same
extraction the gate acted on when it armed or held. So the counts and the gate
agree by construction, and no reader is involved.

New:

- `services/adaptiveWarrantDefensiveActCounts.js` — per-turn and per-dialogue
  counts.
- `scripts/report-adaptive-warrant-defensive-acts.js` — reads run directories or
  event JSONL files, prints a table, writes JSON with `--out`.

Reading rules, and why each one:

- A turn whose envelope came back `uncertain` **is** counted. The gate acted on
  its accepted events, and the report must describe the same turns the gate saw.
- A turn whose envelope is `invalid` is named as unmeasured. It never becomes a
  zero.
- A turn whose extraction predates v3.3 is refused by schema. This is the whole
  reason the live path is used, so it fails loudly.
- A single rejected defensive event is dropped and reported in
  `rejected_defensive_events`, so the drop is visible.

On smoke C (`guarded-learner-smoke-C-s550-2026-08-15`), all 8 turns are
measurable:

    learner_overclaim_assertion        7
    learner_evidence_dismissal         1
    learner_evidence_demand            0

Zero evidence demands on that run is itself the §5 zero count the registration
asks for.

Relay 110 §3 endpoint 5 is amended to name the live source.

---

## 7. Working-copy fix, not a code fix

Three of the 22 excluded artifacts in `OUTCOME_PILOT_EXCLUDED_ARTIFACTS` were
missing from this worktree, which blocked the freshness guard. They live under
`.tutor-stub-auto-eval/`, which is gitignored and per-worktree. Copied from
`../ms-adaptation-refinement/`. Nothing to commit.

---

## 8. Tests

- `tests/adaptiveWarrantGuardedPilotReseal.test.js` — **29 tests** (19 before
  the rung-0 work, see §10). The A1 seal is untouched and still a v3.2 seal;
  the guarded manifest re-pins the contested digests and inherits the rest;
  both manifests pass the launcher guard under their own persona; the persona
  changes every prepared-run fingerprint; a mismatched persona is refused from
  both sides; an undeclared program change is refused; a declared non-change is
  refused; the drift classifier separates the reflow from the real change; the
  response-schema gap is recorded; and the provider-schema pin refuses a failed
  artifact, a hashless artifact, an artifact whose commit is not an ancestor,
  and an artifact whose accepted schema predates the current contract, re-pins
  from a good one, and otherwise says `inherited_unproved` out loud.
- `tests/adaptiveWarrantDefensiveActCounts.test.js` — 9 tests, including an end
  to end read of the real smoke C trace.

All pass, plus the two existing outcome suites unchanged.

---

## 9. What is still open

- ~~**The provider-schema pin is `inherited_unproved`.**~~ **Cleared 15
  August** by the rung-0 ping and re-seal. See §10.
- The four ledger fields inside `planned_calls` are carried over from the A1
  seal because the launcher asserts that object by value. They are flagged
  `stale: true` and must be re-read at GO time.
- Deferred from relay 106: the handbook prose in
  `services/tutorStubPublicLearnerAnalysis.js:67` still lists the old 15-act
  vocabulary, so readers cannot apply the evidence-demand preference rule.
- Not started: the edged-register Stage 0 build.

---

## 10. Rung 0: the ping, and the launch blocker it exposed

**The ping passed. One call, codex `gpt-5.6-luna`, stamped at `27bcb644`.**
The result records `status: passed`, `calls: {attempted: 1, completed: 1,
maximum: 1}`, `prohibited_tool_event_count: 0`, and a response schema that
names all three defensive acts and hashes
`149171804550890f34d8d662f358762c9ae35e689343eab87df0142f30ff1a12`. So the
provider does accept the larger v3.3 schema, which was the open question in
§5. Archived to the private repo under
`artifacts/guarded-learner-v33/schema-acceptance-ping/`.

**Then the re-pin broke the launch, and that is the check working.** The
launcher compares the manifest pin against the schema-acceptance artifact
that the instrument freeze names
(`run-adaptive-warrant-outcome-pilot.js:250`, carried over at :1224). Both
sides were copies of the A1 seal — the same number twice — so the check had
been passing on nothing. Re-pinning the manifest from the v3.3 ping moved
one side only, and the two stopped agreeing: `44b4807e…` in the freeze
against `14917180…` in the manifest. The 1,116-call pilot would have refused
to start after the go-ahead was given. This is the same defect class as §4
and §5, found a fourth time: **a pin proves nothing when both halves come
from one stale seal, and re-pinning one half turns a vacuous pass into a
real failure.**

**The fix moves the other half from the same paid evidence.**
`scripts/seal-guarded-warrant-instrument-freeze.js` (new, zero calls)
inherits the A1 freeze, re-hashes all five inherited bindings, and replaces
exactly one field — `semantic_instrument.schema_acceptance` — with the v3.3
artifact. It refuses unless the artifact passes the launcher's own
admissibility list and unless the manifest pin and the artifact already
agree on the hash. It also copies the artifact and its response schema into
the repo, because the A1 pair lives in `/private/tmp`, which is cleaned; a
launch that dies on a deleted file fails for a reason with nothing to do
with the study.

**One of my own rules had to go.** The re-seal first demanded the acceptance
artifact be stamped at HEAD exactly. That rule holds for one commit and then
refuses a good artifact, which would push a later re-seal toward paying for
a second ping to satisfy bookkeeping. Hash equality is not available as a
substitute: `buildAdaptiveWarrantSemanticBatchOutputSchema`
(`scripts/prepare-adaptive-warrant-semantic-annotations.js:192`) mints a
schema per batch from the reader, batch, study, corpus and act catalogue, so
two runs never produce the same bytes. The rule is now ancestry plus
coverage — was the artifact made on this line of work, and does the schema
it accepted name the acts the contract now carries. Both questions stay
answerable at any later commit, and an artifact from before v3.3 fails the
second one on its own evidence.

**Proved without launching.** A zero-call simulation generated a fresh
preflight at the new HEAD, ran `carryOverOutcomeSchemaAcceptance` from the
new freeze, and put the result through `verifyOutcomePilotReaderBindings`:

    {"status":"passed","checks":{"extraction_schema_digest":true,
     "reader_digest":true,"semantic_preparer":true,
     "provider_response_schema":true,"decision_preparer":true,
     "decision_runner":true,"decision_handbook":true}}

All seven, including the one that was about to refuse.

**One risk checked and closed.** `scripts/score-semantic-reader-presence-gate.js`
hardcodes the A1 registration constants, including the old provider-schema
hash. It does not run for this pilot: nothing imports it but its own test,
and relay 083b records that it keeps the old fingerprint on purpose, as what
the frozen instrument was validated with, and is not on the launch path.

**Consequence for the GO note.** Relay 113 §4's launch command named the A1
freeze and is now wrong. It is amended, with the old value kept visible, and
the corrected command is copied from the simulation above. Commits:
`27bcb644` (GO note and protocol), `28c26bb1` (freeze re-seal).

---

## 10:06Z — the reader re-take, and why HEAD moves safely this time

**The fault.** Both reader channels finished: 288 calls each, 576 readings.
Assembly then stopped on `presence-reader-a-batch-123`. The reader's evidence
span was `The Osprey crew took Nadia's box`; the learner turn reads
`the Osprey crew took Nadia's box`. One capital letter.
`deriveAdaptiveWarrantSemanticEvidenceSpan`
(`services/adaptiveWarrantSemanticEvents.js:509`) normalises curly quotes and
then matches exact characters, so the span is `not_literal` and
`scripts/prepare-adaptive-warrant-semantic-annotations.js:453` throws.

**How wide.** A zero-call replay of the same check over all 576 readings:
675 spans, 674 literal, 1 not literal. A zero-call replay of the frozen
assembly per reader: presence-reader-b, decision-reader-a and
decision-reader-b each pass at 144 cases with no rejections. So one reading
of 576 is bad, and the contract is not.

**The fix, all zero-call.** Relay 094a already rules on this class. The
response was moved, bytes unchanged, into `quarantine/reader-responses/`
inside the run root, and
`reader-response-quarantine-manifest.json` was written at the run root with
`status: reviewer_authorized`, the 094a hash, and the enumeration
(576 audited, 1 presence-invalid, 0 decision-invalid, allowance 10).
`loadReviewerAuthorizedReaderRetakes` was called read-only for both channels
and reported 1 batch to re-read on presence, 0 on decision. Batch 123 holds
one case, so the re-take is one call.

**Second stale-stamp sighting, and why it does not bite.** Committing GO note
115 moves HEAD off `c21d023f`, the freeze's launch commit. That refused a
launch before note 114. On reader resume the launcher reuses the freeze and
passes `reusedFreeze.freeze.source_commit` to the binding check
(`run-adaptive-warrant-outcome-pilot.js:1244`), so pins are compared against
`c21d023f`, not live HEAD. The preflight is not regenerated and the
schema-acceptance carry-over does not run: both sit inside `if (!resume)`.
The only live-HEAD rule left is the GO note being committed at HEAD, which is
the rule we want.

**One accounting trap.** The reader reservation is `288 − already_spent`,
which is now 0, so the launch is not refused for want of a reservation — but
the checkpoint total also stays at 1,046 while the wire count becomes 1,047.
Do not read the checkpoint as the wire count for this step.

Commit: `b59c8097` (GO note 115).

## 12:40Z — the pilot gate had no scorer, and what writing one had to settle

The re-take landed. All four readers assembled at 144 cases, 0 rejections.
Then the gate report stopped: there was nothing to run it with. The only
gate scorer in the tree, `scripts/score-semantic-reader-presence-gate.js`,
belongs to the A1 passive study and pins that study's corpus hash
(`52bc3ae4…`), reader digest (`6cb95fd8…`) and response schema. Pointing it
at the guarded pilot would compare this run against another study's seal.

So `scripts/score-guarded-pilot-gate.js` is new. Zero calls, 10 tests. Two
decisions inside it are worth keeping on the record, because either one
taken the easy way would have produced a PASS that means less than it looks.

**Slot (b) reads the selection from the policy, not from the enforcement.**
The trace carries three events per turn: `tutor_warrant_gate_decision` holds
`decision.policy.family` (what the policy wants),
`tutor_warrant_gate_final_authority` holds `applied` and
`desired_action_family` (whether it was imposed), and
`tutor_warrant_gate_outcome` holds `action_family` and `tutor_text` (what
reached the learner). The enforcement event is only written when the gate
acts — 6 of 8 turns in dialogue 04, not 8. Reading the selection from the
enforcement would therefore skip every selection that produced no
enforcement at all, which is exactly the silent drop the slot exists to
catch. The denominator has to come from the policy.

**Observe-mode selections are shadow, not drops.** Bare and
standing-permission run the same gate with `mode: observe`; it selects and
reaches nobody by design. There are 40 such selections against 10 live ones.
Scoring them as drops would have failed the slot outright. They are counted
and reported apart rather than filtered out of sight.

**Result: PASS on all three.** (a) 5 of 5 gated dialogues that carry a
stretch armed inside one, 3 needed. Dialogue 13 carries no stretch — the
learner over-claims at turns 1, 2, 4, 5, 7, 8 but breaks the run with an
analytic turn at 3 and 6 — so it leaves the denominator and its silence is
the threshold working. (b) 10 of 10. (c) both channels complete, both
presence readers 144 cases, 0 rejected, 0 unanalyzed; the presence channel
shows 289 complete rows to the decision channel's 288, which is the re-read
batch.

**Slot (a) does not turn on relay 112.** That ruling puts (a) and (b) on the
live trace. The scorer re-scores (a) on the frozen readers too: PASS 4 of 5
when both readers must mark a turn, PASS 5 of 6 when either will do. Same
verdict from all three sources.

Commits: `3b93db7a` (scorer, test, manifest). Report archived to the private
repo as `gate-report.json` before the card was touched.
