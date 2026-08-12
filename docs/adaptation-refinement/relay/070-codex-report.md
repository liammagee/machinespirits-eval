# 070 — Codex report: corrected outcome pilot refused by clean-worktree guard

**Date:** 13 August 2026. **Authority:** reviewer GO note 069b and ruling
069a. **Boundary:** the launch command from GO note 069b was run verbatim and
refused by its first launch guard. No model call, dialogue, reader, checkpoint,
or v2 run artifact was created. No harness, instrument, manifest, freeze, or
existing run artifact was amended.

## Outcome status

**STOPPED — launch guard refused; no outcome-pilot ruling is available.**

The command printed exactly:

```text
[outcome-pilot] error: outcome pilot launch requires a clean committed worktree
```

The process exited **1**. The guard is the committed check at
`scripts/run-adaptive-warrant-outcome-pilot.js:648`, which refuses when
`git status --porcelain` is non-empty. Immediately after refusal, the only
pre-existing non-report worktree change visible was:

```text
 M docs/research/paper-full-2.0.md
```

That path was not amended, staged, or reverted by this driver. The fresh v2
output directory remained absent. Per GO note 069b, there was no retry and no
reader analysis.

## Calls spent per phase versus the 1116-call plan

| Phase | Frozen plan | Spent in this launch |
|---|---:|---:|
| generation | 540 | **0** |
| presence readers | 288 | **0** |
| decision readers | 288 | **0** |
| **total** | **1116** | **0** |

Counter arithmetic from the ruling-069a baseline:

- Start: **3,556 / 11,337**.
- This launch: **0** calls.
- Stop counter: **3,556 / 11,337**.
- Authorized plan, if later launched clean and completed: **3,556 + 1,116 =
  4,672 / 11,337**. That transition did not occur.

## Checkpoint summary

| Field | Value |
|---|---:|
| launch process exit | 1 |
| v2 checkpoint created | no |
| completed v2 dialogues | 0 / 18 |
| generation reservations | 0 / 540 |
| presence-reader reservations | 0 / 288 |
| decision-reader reservations | 0 / 288 |
| post-generation fingerprint guard reached | no |
| natural freeze created | no |
| outcome readers launched | no |

The requested fresh destination remains absent:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13
```

## Quarantine list

| Artifact | Disposition |
|---|---|
| v2 pilot artifacts | none created; nothing to quarantine |
| v1 dialogue 2 | remains quarantined under ruling 069a; untouched |
| v1 dialogue 1 | preserved and not reused; GO note 069b requires all 18 dialogues fresh |

No new seed was claimed or burned. Seeds 515–517 remain unspent by this v2
launch attempt.

## Artifact SHA-256 table

No new v2 artifacts exist. The launch-bound inputs remained readable at the
stop boundary:

| Artifact | Path | SHA-256 |
|---|---|---|
| executable | `scripts/run-adaptive-warrant-outcome-pilot.js` | `6bcbf45d92f99d767edc296ddd68ac3d33858e56f87a6fdaf133ba173c6203cb` |
| GO note 069b | `docs/adaptation-refinement/relay/069b-reviewer-go-note-outcome-pilot-corrected.md` | `b8bf95a9bf3b85561e35b7bc9c04ce816bb88ba374530b01138fe9ddee0d6862` |
| ruling 069a | `docs/adaptation-refinement/relay/069a-reviewer-ruling-technical-stop-plan-arithmetic.md` | `a6b97bd0513b2f9da3a1c7d8e5f641754bc7fdf35c76704a0abd4f80c0f39bec` |
| relay state | `docs/adaptation-refinement/relay/STATE.md` | `ab25fd913cb433b893815093e46243cbcfdd771015c3daf0960cd42971fc099b` |
| instrument freeze | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json` | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |

## Stop disposition

1. The GO-note command was run verbatim from HEAD `5deb648d`.
2. The executable bytes matched corrected-plan commit `8ad749ec` before
   launch.
3. The clean-worktree launch guard refused before creating the destination or
   spending a call.
4. The existing paper change was preserved as local dirt and excluded from
   this report commit.
5. The post-generation `annotationCaseFingerprint` guard, both reader phases,
   and all outcome computations were not reached.
6. The 72-dialogue main block remains unauthorized.
7. No branch push is authorized or performed.

The run ends at this launch-refusal boundary. Continuation requires a fresh
reviewer disposition; this report makes no repair proposal and changes no
frozen surface.
