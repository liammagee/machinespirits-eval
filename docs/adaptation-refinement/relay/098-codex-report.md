# 098 — Codex report: main-block build stopped at seed-freshness gate

**Date:** 13 August 2026. **Authority:** direction 097. **Boundary:**
structural stop during task 2, before any build edit, test, model call, or run
launch.

## Outcome

The outcome main block was **not built or launched**. Direction 097 requires a
proof that every proposed seed from 518 through 529 appears in no prior
diagnostic, smoke, pilot, or burned run directory. That proof is false for
seeds **518** and **519**:

- `.tutor-stub-auto-eval/sensor-fix-smoke-A-s518-2026-08-13` is a sealed,
  completed smoke corpus. Its run plan passes `--run-seed 518`, uses world 102,
  runs eight turns, and uses the low-agency permission-seeking learner profile.
- `.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13` is a sealed,
  completed smoke corpus. Its run plan passes `--run-seed 519`, uses world 102,
  and runs eight turns.

The first overlap is also the same permission-seeking persona and one of the
same frozen worlds required for the main block. Direction 097 provides no
authority to substitute seeds, waive freshness, delete or relabel the smoke
corpora, or change the registered 518–529 range. The driver therefore stopped
instead of inventing a replacement plan.

No harness, launcher, manifest, study plan, scorer, test, child runner, frozen
instrument, or paid artifact was changed. No paid or zero-call model route was
invoked. Nothing was pushed.

## Searches run

The initial directory inventory searched both local artifact roots for all
adaptive-warrant diagnostic, smoke, pilot, outcome, matrix, and burned-run
shapes:

```bash
find .tutor-stub-auto-eval /private/tmp -maxdepth 2 -type d 2>/dev/null \
  | rg 'adaptive-warrant|outcome|pilot|smoke|diagnostic|burn|matrix' \
  | sort
```

That inventory exposed the two named smoke directories. The follow-up search
then limited matches to executable run-seed metadata in run plans, run states,
traces, and logs, and limited the result paths to the relevant corpus/run
families:

```bash
rg -l -U --hidden \
  --glob 'run-plan.json' --glob 'run-state.json' --glob '*.jsonl' --glob '*.log' \
  '(--run-seed"?[[:space:]]*,?[[:space:]]*"?(518|519|520|521|522|523|524|525|526|527|528|529)\b|"run_seed"[[:space:]]*:[[:space:]]*(518|519|520|521|522|523|524|525|526|527|528|529)\b)' \
  .tutor-stub-auto-eval /private/tmp 2>/dev/null \
  | rg 'adaptive-warrant|outcome|pilot|smoke|diagnostic|matrix|burn' \
  | sort
```

It returned exactly two files:

```text
.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13/run-plan.json
.tutor-stub-auto-eval/sensor-fix-smoke-A-s518-2026-08-13/run-plan.json
```

Direct `jq` inspection of each plan confirmed the argument pairs
`["--run-seed", "518"]` and `["--run-seed", "519"]`. Direct inspection of
each `run-seal.json` confirmed `status: complete`, one successful result, eight
analyzed public turns, and learner-analysis coverage 1. Seeds 520–529 had no
exact adaptive-run metadata hit in the searched roots, but the registered set
fails freshness because 518 and 519 are already burned.

## Evidence digests

| Artifact | SHA-256 |
|---|---|
| Direction 097 | `4640285ed50aeec89b5ff52206a9ef7c85b78c3b09258fd2c0bf24fa91fe83bd` |
| Relay state read before action | `2300c397c55fa4e5435d6a029645bd2d1539e479e030d7ecd454dc20b9e8368d` |
| Seed-518 smoke run plan | `35e00bad5634278f99e26c0d85bfdb34e3dfec11ecd5d451bb3e923df7754c6c` |
| Seed-518 smoke seal | `79d654eb313eb18bb3061682cd901d6226fcd571f18bf1dd4f500bbcbf50093b` |
| Seed-519 smoke run plan | `f2e6a0244b61e452f96db483a958199474acd5063750412524053deb3dde08ea` |
| Seed-519 smoke seal | `3571507239d3f8d5670d6e3fa2e1a7a03c1e959e8296aa33ddf805c10cc0f60c` |
| Frozen decision-reader child, unchanged | `c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad` |

The only tracked file changed by this stop is this report. Its committed blob
identity and commit identity are supplied by Git; no build-file digest exists
because no build file was changed.

## Tests and call arithmetic

No tests were run: task 2 is a mandatory pre-build identity gate, and it failed
before the task-6 test implementation existed. Running unrelated tests could
not establish seed freshness or authorize a substitute seed plan.

The registered but unbuilt arithmetic remains:

- generation: approximately 2,000 calls for 72 dialogues;
- decision readers: 576 cases × 2 readers = 1,152 planned calls;
- failed-attempt allowance: 48;
- total: approximately 3,200 calls.

Actual calls in direction 097/this report: **0**. The counter therefore remains
**5,274 / 19,337**, with **14,063** remaining. No presence channel was built or
fielded, and no reader process was launched.

## Required ruling before continuation

Continuation requires a new committed reviewer direction that supplies a
fresh, pre-registered 12-seed range or explicitly resolves the seed-518 and
seed-519 prior-smoke overlap. The current human GO does not resolve this
contradiction because it approved registration 096 as written, whose freshness
claim the local run evidence disproves. The main-block GO note 097a must not be
cut from this build state.

---

## Amendment 096a resumption — build complete, launch still held

**Date:** 13 August 2026. **Additional authority:** amendment 096a at
`30227122`, which withdraws seeds 518–529, registers seeds **524–535**, and
directs the driver to resume direction 097 while retaining the stop record
above. This section extends that record; nothing above the divider was removed
or rewritten.

### Outcome

The outcome main block is now **built but not launched**. No model route,
generation child, reader child, or run was invoked. The new entry point defaults
to a zero-call HOLD display and refuses the paid path before any output-directory
creation unless the exact committed reviewer note 097a and
`--accept-charges` are both present.

The frozen plan is:

- 72 dialogues, 24 each for bare, gated, and standing permission;
- worlds 101 and 102, eight turns, permission-seeking `low_agency` learner;
- seeds 524–535, with every seed used once per world and condition;
- exactly 576 decision-turn cases and two fresh decision readers per case;
- 1,152 planned decision-reader calls and a 48-attempt failure allowance;
- no presence collection, process, assembly, or score path;
- M7/M8 report-only from stored generation-time semantic events, with the
  output label **`not reader-validated`**.

The decision-reader child was not edited and remains byte-pinned at
`c0a201300a66e32919d22aaac42e431f32bd1df595b582f7762928a148c2e6ad`.
The unchanged preparation/assembly pin is
`332447730054e13f02d6d8af0d5c4a58130254e08abf838b87237df62d14fb95`.

### Seed-freshness proof for 524–535

The driver independently searched the repository source roots, local artifact
root, `/private/tmp`, and the private archive repository. The source-proximity
search was:

```bash
rg -n --pcre2 -i \
  '(?:seed.{0,12}\b(?:524|525|526|527|528|529|530|531|532|533|534|535)\b|\b(?:524|525|526|527|528|529|530|531|532|533|534|535)\b.{0,12}seed)' \
  docs config scripts services tests .tutor-stub-auto-eval \
  /Users/lmagee/Dev/machinespirits/machinespirits-eval-private
```

Its only paths were the current registration/direction/state/report and the new
main-block manifest, launcher, and tests. It returned no private-archive or
prior-corpus path.

The executable metadata search inspected `run-plan.json`, `run-state.json`,
`run-seal.json`, and `run-events.jsonl` across all three artifact roots:

```bash
rg -l -U --hidden \
  --glob 'run-plan.json' --glob 'run-state.json' \
  --glob 'run-seal.json' --glob 'run-events.jsonl' \
  '(--run-seed"?[[:space:]]*,?[[:space:]]*"?(524|525|526|527|528|529|530|531|532|533|534|535)\b|"run[_-]?seed"[[:space:]]*:[[:space:]]*"?(524|525|526|527|528|529|530|531|532|533|534|535)\b)' \
  .tutor-stub-auto-eval /private/tmp \
  /Users/lmagee/Dev/machinespirits/machinespirits-eval-private
```

It returned **zero files**. A separate directory-name search for `s524`–`s535`
and `seed-524`–`seed-535` over the same roots also returned **zero
directories**. The launcher's independent zero-call audit inspected 7,812
run-metadata files and returned `status: passed`, `hits: []`. On resume it
excludes only its own already-bound main-block output root, preventing the new
run from falsely burning itself while continuing to search every prior root.

### Reader acceptance and allowance boundary

The parent prepares one decision-only natural-prevalence collection at batch
size one: 576 cases for each of two readers. The authorization request carries
1,152 planned calls and maximum 1,188; the unchanged child contributes its
pinned 12-attempt technical allowance, giving the registered absolute ceiling
of 1,200 attempts = 1,152 planned + 48 failed attempts. The parent checks the
1,200 boundary before process dispatch and reconciles actual child attempts
into its checkpoint after either completion or failure.

Before any response is admitted to the score, the parent runs the full
deterministic assembly contract independently on all 1,152 response files. A
missing, malformed, inconsistent, or unsupported field fails the parent before
assembly; only a 1,152/1,152 passing acceptance audit permits scoring. This
extends the 094a validation mechanism to every fresh main-block decision
response without changing the pinned child.

### Files changed and SHA-256 digests

| File | SHA-256 | Purpose |
|---|---|---|
| `docs/adaptation-refinement/outcome-study-a1/main-block-manifest.json` | `33139d71aa96e7620998472a1b095b563f0cc10bde31ac089c64438b3f7c7438` | Amended study plan, decision-only channel, pins, allowance, hold |
| `scripts/run-adaptive-warrant-outcome-main-block.js` | `9984dc3401289a788c155760264e624d1fe4f6d6efced6bffe71aef8b79936c0` | Fail-closed parent/launcher and zero-call plan |
| `scripts/run-adaptive-warrant-outcome-pilot.js` | `fe47b7acf8a1c31570ea5c8c2f36b87291eb2f384ac831e6cab716ea4dfdcab0` | Exported generic pilot helpers; pilot defaults unchanged |
| `scripts/score-adaptive-warrant-outcome-study.js` | `19d64c520e6ea82e8fcdc87fb16d540ecf9bd86ccf2b03d6fa7fa681793779c9` | Decision-only main score and stored-event M7/M8 description |
| `services/adaptiveWarrantReaderRetake.js` | `232e1f1c1a6911c09ebec85ece216d74b86f949758a45b5bf44c5063fa66eb5a` | General full-contract validator used by both 094a re-takes and main acceptance |
| `tests/adaptiveWarrantOutcomePilot.test.js` | `0cf4e8bfc9ef08bbd90eec2a66da09df8c5904540a688a1d925303e3e07d7533` | Main-plan, freshness, decision-only, invalid-response, allowance, and M7/M8 tests |

This report is the seventh changed tracked file; its final blob and commit
identities are supplied by Git because writing a self-digest would change the
digest. No v1–v4 paid artifact or child runner changed.

### Verification

- Focused Node suites:
  `node --test tests/adaptiveWarrantOutcomePilot.test.js tests/adaptiveWarrantOutcomeStudy.test.js tests/adaptiveWarrantSemanticAnnotation.test.js tests/adaptiveWarrantAnnotationCollection.test.js`:
  **85 passed, 0 failed**. The six new main-block cases cover the registered
  plan shape, a positive and negative seed-freshness guard, exact 576/1,152
  decision-only assembly, full-contract rejection, zero-call allowance
  exhaustion, and stored-event M7/M8 labeling.
- Targeted ESLint over every changed JavaScript file: passed.
- `git diff --check`: passed.
- Default main-block invocation: printed HOLD and zero-call arithmetic; no
  artifact directory created.
- Paid-path refusal without 097a: failed before output-directory creation and
  before any model call, as required.
- Full `npm run lint`: retained only the pre-existing unrelated unused import at
  `services/tutorStubPublicLearnerAnalysis.js:26`.
- `npm run test:manifest`: retained the pre-existing stale root-manifest report
  for five already-present adaptive-warrant test files; no manifest was changed
  under this direction.

### Call arithmetic and handoff

- generation: approximately 2,000 calls (hard per-dialogue cap 72 × 30 =
  2,160);
- decision readers: 576 × 2 = 1,152 planned calls;
- failed-attempt allowance: 48;
- registered operational plan: approximately **3,200** calls; absolute harness
  ceiling **3,360**;
- actual calls during the direction-097 build and this extension: **0**;
- counter remains **5,274 / 19,337**, with **14,063** remaining.

The build now waits for the reviewer's zero-call verification and committed
note 097a. The main block remains unlaunched, and nothing was pushed.
