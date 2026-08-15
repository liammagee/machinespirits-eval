# 2026-08-15 — patches and fixes on the guarded-learner pilot branch

Branch `build/guarded-learner-v3.3`, worktree `../ms-guarded-learner`, off
`origin/main` at `9da19711`. **Never push this branch.**

**Zero paid calls were made on any of this.** The pilot spend approval from
14 August is still held, not spent. A launch needs its own committed GO note.

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

## 5. The frozen presence readers cannot name the v3.3 acts

Machine-checked. The response schema the frozen presence readers answer under —

    /private/tmp/adaptive-warrant-v3-schema-ping-62e4fd0a-r47-s514/response.schema.json
    sha 44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1

— enumerates 15 acts. Missing: `learner_overclaim_assertion`,
`learner_evidence_dismissal`, `learner_evidence_demand`. Under that schema a
defensive turn is pushed onto the nearest old act, which is the mislabel smoke C
already showed.

What it costs, slot by slot:

- gate slots (a) and (b) read the live gate trace. Unaffected.
- gate slot (c) needs the readers to run and agree, not to name a new act.
  Unaffected.
- registered endpoint 5, the defensive-act counts, report-only. Affected.

The seal records this rather than inheriting it quietly.

Commit `b66ffe0d`.

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

- `tests/adaptiveWarrantGuardedPilotReseal.test.js` — 13 tests. The A1 seal is
  untouched and still a v3.2 seal; the guarded manifest re-pins exactly two
  digests and inherits the rest; both manifests pass the launcher guard under
  their own persona; the persona changes every prepared-run fingerprint; a
  mismatched persona is refused from both sides; an undeclared program change is
  refused; a declared non-change is refused; the drift classifier separates the
  reflow from the real change; the response-schema gap is recorded.
- `tests/adaptiveWarrantDefensiveActCounts.test.js` — 9 tests, including an end
  to end read of the real smoke C trace.

All pass, plus the two existing outcome suites unchanged.

---

## 9. What is still open

- **No launch.** The pilot needs its own committed GO note and explicit
  approval.
- The four ledger fields inside `planned_calls` are carried over from the A1
  seal because the launcher asserts that object by value. They are flagged
  `stale: true` and must be re-read at GO time.
- Deferred from relay 106: the handbook prose in
  `services/tutorStubPublicLearnerAnalysis.js:67` still lists the old 15-act
  vocabulary, so readers cannot apply the evidence-demand preference rule.
- Not started: the edged-register Stage 0 build.
