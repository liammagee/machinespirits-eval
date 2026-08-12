# 056a — Codex report: binding-independent outcome harness complete; human binding still awaited

**Date:** 13 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-13-N`, continued under ruling 057

**Authority:** ruling 057 section 5; frozen registration
`docs/adaptation-refinement/v3-outcome-study-registration.md` section 4;
notes 055a and 055b; direction 055 A1.3.

## Boundary reached

The binding-independent zero-call continuation is complete at implementation
commit `5b24782ae9d567b797dfd6a1405da37c40c65e64`.

Built:

- `scripts/score-adaptive-warrant-outcome-study.js`, a zero-call scoring
  harness for registered deterministic measures 1–6;
- the measure-1 two-reader binary-consensus path, with non-consensus cases
  excluded and counted;
- digest preflights for the frozen decision-reader instrument and the
  presence channel;
- consensus-only presence scoring for measures 7–8, used here only to support
  the registered pilot saturation check;
- the focused A1.3 guard functions and fixtures; and
- run-configuration templates for `bare` (`warrant-gate=off`) and `gated`
  (`warrant-gate=active`) only.

The harness has no child-process or model-call path. The only CLI operation it
performs is reading an already-prepared JSON input and printing deterministic
JSON scores.

## Measure definitions implemented

1. **Decision correctness:** the logged observe-arm
   `revision_warranted` value is compared with the binary consensus of two
   fresh readers. Non-consensus cases leave the denominator and are counted.
2. **Warranted-challenge rate:** typed-rule-supported
   `challenge_resistance` turns divided by decision turns, applied identically
   across conditions.
3. **Sustained deference:** every consecutive streak length and the maximum
   streak, from the deterministic compiler's `deference_present` boolean.
4. **Deference break:** first own-voice learner assertion/act and whether every
   following learner turn remains own-voice through the horizon.
5. **Record growth:** whether the deterministic DAG total increases after the
   break; dialogues without a break report null rather than a false zero.
6. **Closure legitimacy:** guard-only; every closure audit must pass and a
   closing turn must have closure available.

The measure-1 reader-output-form line required by note 055b is frozen in the
harness as:

> Measure 1 reader output form: path 1. Each frozen binary decision reader
> reports commitment_transition_warranted (yes/no); the harness compares the
> logged observe-arm revision_warranted decision with two-reader consensus.
> The public world ground-truth source is the SHA-pinned world YAML projected
> into the decision packet public_inquiry_brief, and the same source is used in
> every condition.

The actual A1 manifest does not yet exist, by ruling 057. When the human binds
the remaining condition and authorizes manifest preparation, that manifest
must carry this line unchanged.

## Digest preflights

The decision-reader preflight pins the unchanged last-checkpoint instrument:

| Identity | Pinned SHA-256 |
|---|---|
| decision handbook | `5673c14b8f2a2b17c599e947c87f6d03c10df6dcdbeadcb257d882f008902003` |
| decision preparation and assembly | `f23d3b1619734091e9b5ac9a37501c8a64f07c1cbf240e62e9b8e7eb43a767fc` |
| decision reader runner | `1eb6be9d4cf2d802ff2bcb16394fdd0f99952d10a3ff62456ebc79ad42346116` |

The presence preflight fails closed unless an eventual A1 input supplies and
matches all seven pinned identities plus both registered caps:

| Required identity/cap | Status now |
|---|---|
| corpus SHA-256 | checker built; awaits the prohibited-for-now A1 corpus/manifest |
| extraction-schema digest | checker built; awaits A1 manifest binding |
| provider response-schema SHA-256 | checker built; awaits A1 manifest binding |
| one-case response-schema SHA-256 | checker built; awaits A1 manifest binding |
| one-case packet SHA-256 | checker built; awaits A1 manifest binding |
| preparer SHA-256 | checker built; awaits A1 manifest binding |
| reader digest | checker built; awaits A1 manifest binding |
| response cap | fixed at 14,000 bytes |
| packet cap | fixed at 42,000 bytes |

No claim is made that an A1 artifact preflight passed: ruling 057 forbids the
world, seed, and manifest work needed to produce those artifacts. The harness
is ready to perform the check and hard-stop on any mismatch.

## Focused guard suite

Command:

```text
node --test tests/adaptiveWarrantOutcomeStudy.test.js
```

Result: **10/10 passed**. ESLint also passed on the scorer and its focused test.

The focused suite covers:

- bare/gated-only run configurations;
- measure-1 reader-output form, consensus exclusion, and digest drift;
- all seven presence digests and both caps;
- break-turn extraction with and without a break;
- deterministic deference streak length;
- post-break record growth and closure legitimacy;
- presence fail-closed accounting;
- the strict saturation rule (a value at exactly 90% is not “more than 90%”);
- pin 2's denominator: consensus cases pooled across conditions for measures
  7–8, with non-consensus and inadmissible cases excluded;
- generic byte-for-byte prompt drift; and
- generic duplicate/excluded fingerprint rejection.

The prompt-drift and fingerprint guards are deliberately generic only. They do
not bind standing-permission text, prepare worlds, claim seeds, or construct a
manifest.

## What waits on the human

The human must still choose the standing-permission binding described in
ruling 057 sections 3–4, or amend the registration to drop that condition.
Until that design decision is committed:

- no standing-permission configuration exists;
- no verbatim gate-string union or conditional-prefix prose exists;
- no world is prepared;
- no seed is claimed;
- no pilot manifest is written;
- no actual presence packet/corpus digest preflight can be run; and
- no generation, decision-reader, presence-reader, or blind-spot-audit call is
  authorized.

The HOLD point remains in full. No pilot go/no-go result exists and no main
block verdict is made.

## Accounting and branch status

- Model/provider calls this continuation: **0**.
- Generation calls: **0**.
- Decision-reader calls: **0**.
- Presence-reader calls: **0**.
- Budget: **3,523 / 11,337**, unchanged.
- Seeds claimed or burned: **none**; seed 515 remains unspent.
- Worlds prepared: **none**.
- Pilot manifests written: **none**.
- r47/r49/r52 pooling: **none**.
- Branch push: **none**.

Unrelated pre-existing worktree changes were not staged or modified: the
deleted generated Python bytecode file and the three untracked skill
directories remain outside both continuation commits.

## Addendum under reviewer note 057a — decision-reader evidence fails closed

Implementation commit `1460709d2e4676107f9b67872b4d6abbb5a7113d`
closes the prospective omission identified in note 057a. Before measure 1 can
score any case, the harness now requires a readable decision-reader run record
with `status: complete`; at least one uniquely identified completed batch; an
on-disk response whose SHA-256 matches that batch's recorded hash; explicit
`model_independently_attested: true`; and an explicitly recorded prohibited-
tool count of zero. The returned evidence preflight preserves run-level and
per-batch pass/fail accounting. Missing records and any partial batch evidence
hard-stop before a measure-1 result is produced.

The focused fixtures now include both the missing-record and partial-evidence
cases. `node --test tests/adaptiveWarrantOutcomeStudy.test.js` passes 12/12,
and ESLint passes on the scorer and focused test. The frozen preparer remains
at `f23d3b1619734091e9b5ac9a37501c8a64f07c1cbf240e62e9b8e7eb43a767fc`;
the frozen reader runner remains at
`1eb6be9d4cf2d802ff2bcb16394fdd0f99952d10a3ff62456ebc79ad42346116`.
No model call, world, seed, manifest, or branch push occurred; budget remains
3,523 / 11,337.
