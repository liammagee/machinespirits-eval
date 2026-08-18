# 108 — Build report: guarded pole complete, smoke C awaits approval

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 107 (build note, step 1), relay 106 (human ruling)
Status: all four build items complete, zero calls. **Smoke C is a paid rung
and is NOT authorized. This note is a request, not a GO.**

## 1. What landed since 107

Branch `build/guarded-learner-v3.3` in the worktree `../ms-guarded-learner`.

| Commit | Item |
|---|---|
| `124294c1` | 1 + 4: contract v3.3 defensive acts, preference rule, guarded sensor |
| `b7a52752` | 2: `--learner-profile` on the three sealed runners |
| `b79c413a` | 3: typed move menu and concession guard |

### Item 2 — the runners take the profile as an argument

`resolveOutcomeStudyRunConfigurations(profile)` returns the frozen A1 table
**itself** for the default `low_agency`, not a copy, and the test asserts
that with `assert.equal` identity. Only `overconfident` substitutes, and it
substitutes the profile field alone: ids, cli_args and gate modes are
untouched. An unsupported profile throws rather than quietly defaulting. The
pilot and main-block launchers thread it through every job, preflight and
freeze, record it on the budget state, and the main block checks it against
the manifest's assignment.

### Item 3 — the move menu and the concession guard

`services/tutorStubGuardedLearnerMoves.js` is pure: no I/O, no model call.
It picks one move per turn from a fixed seven, deterministic in turn number,
landed challenges and recorded prior moves, so a run replays identically and
a reader can check the schedule by hand. `full_concession` is forbidden
until two evidence-grounded tutor challenges have landed;
`grudging_concession` is available at most once in three turns. A landed
challenge is counted from the same recorded field the steering decomposition
reads, so the phrase means one thing across the arc.

The guard reads the draft as text and rejects two breaks:

- `permission_seeking` — the passive pole's tell, which is never in this
  menu, so its appearance means the persona drifted whatever move was
  selected;
- `unscheduled_full_concession` — a fold the schedule has not yet allowed.

A fire triggers exactly one redraft. Both outcomes are traced
(`guarded_learner_guard_fired`, `guarded_learner_move`), so a reader counts
fires instead of inferring them.

The path is opt-in twice over: `TUTOR_STUB_GUARDED_LEARNER_MOVES=1` **and**
the `overconfident` profile. With the flag set the passive pole still never
reaches the guard, which a test asserts directly. No existing study changes.
The guard runs **before** profile adherence, so the adherence pass scores the
text that actually ships.

## 2. Verification (all zero-call)

- Full hermetic suite: **8,719 pass / 3 fail / 3 skips**. The three failures
  are derivation page byte contracts; they fail on the branch base with this
  work stashed, so they are not from this change. The three skips are the
  known machine-local warrant artifacts.
- 17 new tests: 10 on the menu, 7 on the wiring.
- One test still asserted 15 speech acts —
  `services/__tests__/tutorStubPublicLearnerAnalysis.test.js:492`, a fourth
  call site missed in 124294c1. Now 18. That is the ratchet working as
  intended: the literal made the contract change visible instead of silent.
- All four sealed A1 pins and both hash-pinned reader scripts re-hash
  byte-identical:

| File | sha256 |
|---|---|
| `services/tutorStubWarrantGate.js` | `db30f563…fc24` |
| `services/adaptiveWarrantPolicy.js` | `8e17f23b…0837` |
| `services/tutorStubFirstDraftContract.js` | `868c5ef7…8a29` |
| `services/tutorStubQuestionSupport.js` | `6084936a…8dfa3` |
| `scripts/run-adaptive-warrant-decision-readers.js` | `c0a20130…6ad` |
| `scripts/prepare-adaptive-warrant-annotation-batches.js` | `33244773…95` |

## 3. Smoke C — the request

**One gated dialogue, guarded persona, fresh seed, 8 turns, diagnostic,
never pooled.** Bound: **30 calls** (the per-dialogue budget smoke B ran
under, which spent 29).

### The command

Copied from the smoke B run plan
(`../ms-adaptation-refinement/.tutor-stub-auto-eval/bad-learner-smoke-B-s519-2026-08-13/run-plan.json`),
with three changes and nothing else: the guard flag, a fresh seed, a fresh
run directory.

```bash
TUTOR_STUB_GUARDED_LEARNER_MOVES=1 node scripts/run-tutor-stub-auto-eval.js \
  --runs 1 \
  --run-seed 550 \
  --turns 8 \
  --policies dynamic \
  --warrant-gate active \
  --model codex.gpt-5.6-luna \
  --analysis-model codex.gpt-5.6-luna \
  --auto-learner-model codex.gpt-5.6-luna \
  --auto-learner-profile-id overconfident \
  --model-call-budget 30 \
  --world docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml \
  --dag-mode strict_dag \
  --loop-mode strict \
  --cli-effort medium \
  --max-tokens 4096 \
  --history-turns 4 \
  --learner-analysis-prompt-profile handbook_v1 \
  --trace-dir .tutor-stub-auto-eval/guarded-learner-smoke-C-s550-2026-08-15
```

The gate mode travels to the child through `TUTOR_STUB_WARRANT_GATE`, not
argv, which is why smoke B's recorded child command shows no gate flag while
its plan records `warrantGateMode: active`. The guard flag travels the same
way: the launcher spawns children with `...process.env`.

This command was dry-run today (`--dry-run`, zero calls). It resolved
correctly and produced the expected child command. The dry-run scratch
directory was **deleted afterwards** so it cannot burn seed 550 or block the
real run.

### The seed

Seed **550**, checked by machine, not by memory. The steering
decomposition's own freshness audit
(`auditSteeringDecompositionSeedFreshness`, zero model calls) was run over
the window 540–560 across every sibling worktree's run directory,
`/private/tmp`, and the private archive — 7,001 metadata files inspected:

- burned: 540, 542, 543, 544, 545, 546, 548, 549
- fresh: 541, 547, **550**, 551–560

550 sits clear of every consumed window.

### What smoke C is for

It confirms two things the tests cannot, because both need a real dialogue:

1. the three v3.3 defensive events fire on model-written learner speech, not
   just on hand-built spans;
2. the sensor arms at the defensive pole — three straight defended
   over-claim turns produce the basis `sustained_defended_overclaim:3_turns`
   on `challenge_resistance`, where smoke B produced `low_agency_deferral`
   on five of eight turns.

It also gives the first live reading of the guard's fire rate. Smoke B says
the unguarded persona held 8/8 turns, so a fire rate near zero is the
expected result and would confirm the guard is insurance rather than rescue.

### NO-GO / stop rules

- Any delivered challenge is a design event to report, not a fault; the
  dialogue continues.
- A technical failure quarantines and is reported. A substantive failure is
  terminal: stop and report, never patch a live run.
- Diagnostic only. Smoke C is **never pooled** with any pilot or main block.

### What is still missing

Explicit human approval of the spend. Nothing here inherits the warrant
campaign's authorization — that counter is closed. When approval is given,
it gets quoted verbatim in a GO note (`109`) committed before the run
starts.

## 4. After smoke C

Registration for the defensive pilot. It needs values only smoke C can
supply: N, the count of straight defended over-claim turns that actually
arms the sensor on live speech; the burned seed list re-enumerated at that
time; the pilot size; and the NO-GO rules for dead instruments. It carries
no main-block predictions — those are written from pilot evidence only — and
amends nothing sealed.

NEVER push this branch.
