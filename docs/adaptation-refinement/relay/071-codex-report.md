# 071 — Codex report: corrected outcome pilot stopped during generation

**Date:** 13 August 2026. **Authority:** reviewer GO note 069b and ruling
070a. **Boundary:** the launch command from GO note 069b was run verbatim from
HEAD `0734ae62`. All launch guards accepted. The process later stopped with
exit code **130** during dialogue 4, before the generation corpus, fingerprint
guard, natural freeze, or either reader phase completed. No harness,
instrument, manifest, freeze, or existing run artifact was amended, and no
reader analysis interpretation was run.

## Outcome status

**STOPPED — generation incomplete; no outcome-pilot ruling is available.**

The first two dialogues sealed `complete`. Dialogue 3 sealed `incomplete` in
its child run and was quarantined by the parent checkpoint with zero reserved
calls. The parent then launched dialogue 4. That dialogue completed one turn
and reserved its turn-2 tutor call before the process stopped. The parent
process returned exit code 130 without appending dialogue 4 to the checkpoint.

The preserved checkpoint records this dialogue-3 error exactly:

```text
missing observed model provenance for role analyzer; missing observed model provenance for role learner; missing observed model provenance for role tutor; child seal status incomplete does not match complete
```

The local evidence establishes the terminal exit code and the incomplete
child state. It does not establish what delivered the interrupt signal, so
this report does not assign a cause.

## Calls spent per phase versus the 1116-call plan

| Phase | Frozen plan | Checkpointed | Additional incomplete-trace reservations | Conservative actual |
|---|---:|---:|---:|---:|
| generation | 540 | 51 | 6 | **57** |
| presence readers | 288 | 0 | 0 | **0** |
| decision readers | 288 | 0 | 0 | **0** |
| **total** | **1116** | **51** | **6** | **57** |

Dialogue 1 reserved 25 calls and dialogue 2 reserved 26 calls. Dialogue 3
reserved zero. Dialogue 4's incomplete trace contains six
`model_call_budget_reserved` records and five completed `model_call` records;
the sixth reservation was in flight at the stop boundary. The conservative
count includes that reservation because its billing outcome is not established
locally.

Counter arithmetic from the ruling-070a baseline:

- Start: **3,556 / 11,337**.
- Conservative stop count: **3,556 + 57 = 3,613 / 11,337**.
- Confirmed completed-call lower bound: **3,556 + 56 = 3,612 / 11,337**.
- Unspent portion of the authorized 1,116-call block on the conservative count:
  **1,059** calls.
- The planned completion counter, **3,556 + 1,116 = 4,672 / 11,337**, was not
  reached.

No schema-acceptance ping was made; the carryover artifact records zero new
calls.

## Checkpoint summary

The preserved parent checkpoint remains exactly as last written:

| Field | Preserved value |
|---|---:|
| status | `generation` |
| process exit | 130 |
| completed dialogues | 2 / 18 |
| checkpointed quarantined dialogues | 1 |
| additional interrupted dialogues outside checkpoint | 1 |
| checkpointed generation reservations | 51 / 540 |
| conservative generation reservations | 57 / 540 |
| presence-reader reservations | 0 / 288 |
| decision-reader reservations | 0 / 288 |
| conservative total | 57 / 1116 |
| checkpoint update | `2026-08-12T22:43:03.687Z` |
| post-generation fingerprint guard reached | no |
| natural freeze created | no |
| outcome readers launched | no |

Completed checkpoint rows:

| Order | Dialogue | Condition | Seed | Status | Reserved calls |
|---:|---|---|---:|---|---:|
| 1 | `outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare` | bare | 515 | complete | 25 |
| 2 | `outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated` | gated | 515 | complete | 26 |
| 3 | `outcome-pilot-03-world_101_kestrel_signal_lamp-s515-standing_permission` | standing permission | 515 | quarantined | 0 |

The fourth child,
`outcome-pilot-04-world_102_marigold_archive_box-s515-gated`, is absent from
the parent dialogue rows. Its child `run-state.json` remains `running`, with no
completion timestamp, and its trace stops immediately after reservation 6.

## Quarantine list

| Artifact | Disposition |
|---|---|
| v2 dialogue 3, world 101 / seed 515 / standing permission | Parent-checkpoint quarantine; zero reservations; child evidence invalid for the exact provenance and seal errors quoted above; never admit or pool. |
| v2 dialogue 4, world 102 / seed 515 / gated | Report quarantine; incomplete child outside the parent checkpoint; six reservations, five completed call records, final reservation in flight; never admit or pool. |
| v2 dialogues 1–2 | Sealed generation artifacts only; preserve unchanged, but they are not a completed 18-dialogue pilot corpus and support no outcome ruling. |
| v1 dialogue 2 | Remains quarantined under ruling 069a; untouched. |
| v1 dialogue 1 | Preserved and not reused; untouched. |

Seed 515 was used. Seeds 516–517 were not reached by this launch.

## Artifact SHA-256 table

All v2 run artifacts remain under the ignored local output root:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/
```

Principal launch and run artifacts at the stop boundary:

| Artifact | Path | SHA-256 |
|---|---|---|
| executable | `scripts/run-adaptive-warrant-outcome-pilot.js` | `6bcbf45d92f99d767edc296ddd68ac3d33858e56f87a6fdaf133ba173c6203cb` |
| GO note 069b | `docs/adaptation-refinement/relay/069b-reviewer-go-note-outcome-pilot-corrected.md` | `b8bf95a9bf3b85561e35b7bc9c04ce816bb88ba374530b01138fe9ddee0d6862` |
| ruling 070a | `docs/adaptation-refinement/relay/070a-reviewer-ruling-clean-worktree-stop.md` | `1adc01c5e5bd1d3f5d490d636b3a9eea5acfa5f492edb341165527afa6a2ba5d` |
| relay state | `docs/adaptation-refinement/relay/STATE.md` | `ab25fd913cb433b893815093e46243cbcfdd771015c3daf0960cd42971fc099b` |
| instrument freeze | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json` | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |
| v2 checkpoint | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/outcome-pilot-checkpoint.json` | `79d952e278d7cf96421dec21b63f840f88ff3b46a0da2c69c15f2f4a615031a2` |
| semantic preflight | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/semantic-brittleness-preflight.json` | `98c0630b63583755e988c24b4463c973685856f21ba038cff8ac619a922c7c3e` |
| schema-acceptance carryover | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/semantic-schema-acceptance-carryover.json` | `3ea7d1b7e0a6f3fafba2b6c835a5ef1da7424f7a23aa9c9048de9b31349a1a2c` |
| dialogue 1 report | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare/auto-eval-2026-08-12T22-36-39-605Z.json` | `ed1910d930b70a061ba68000f017783d54a521217e4e7970a10b0c862a5513f8` |
| dialogue 1 trace | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-01-world_101_kestrel_signal_lamp-s515-bare/2026-08-12T22-30-03-734Z.jsonl` | `84bc0687be42560ec4b8229fba8f304d772c23cc2f4b997713f58bc70148a26d` |
| dialogue 2 report | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated/auto-eval-2026-08-12T22-42-59-314Z.json` | `1a82e894da0fcceb8d6621dfaa280ff8037dd57465eb30e229017f33f189e9d8` |
| dialogue 2 trace | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-02-world_101_kestrel_signal_lamp-s515-gated/2026-08-12T22-36-42-527Z.jsonl` | `e92e91c85dcb88ab3f47e02e13c61fb876cf31017dccd3784a7aa84838da01dd` |
| dialogue 3 failed report | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-03-world_101_kestrel_signal_lamp-s515-standing_permission/auto-eval-2026-08-12T22-43-02-272Z.json` | `c33704113850ce8b5d37deba38320071bfa1741051bb2cfe2b37a185e88c3284` |
| dialogue 3 child state | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-03-world_101_kestrel_signal_lamp-s515-standing_permission/run-state.json` | `6c06aa5c2d331fcc7979bb6578a26a181647d1c8893d19f4f482409098696700` |
| dialogue 4 incomplete trace | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-04-world_102_marigold_archive_box-s515-gated/2026-08-12T22-43-04-314Z.jsonl` | `8f00adb3b31b655fa2cecf68e468ecf17d9bd44561d5bb8bd3a1a25d8abd80fa` |
| dialogue 4 child state | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v2-live-2026-08-13/dialogues/outcome-pilot-04-world_102_marigold_archive_box-s515-gated/run-state.json` | `1afc7724862d4119d014702382f7149b17ea47ffe8513c4372bb44d0e042b4c7` |

## Stop disposition

1. The GO-note command was run verbatim once from the clean ruling-070a HEAD.
2. All pre-call launch guards passed; the destination and checkpoint were
   created.
3. Generation stopped before dialogue 4 sealed. The incomplete dialogue 4
   reservations are reported conservatively outside the stale checkpoint.
4. Dialogue 3 and dialogue 4 are quarantined as listed above. No run artifact
   was rewritten, repaired, resumed, or deleted.
5. The post-generation `annotationCaseFingerprint` guard, natural freeze,
   presence-reader phase, decision-reader phase, and outcome computations were
   not reached.
6. No reader analysis interpretation was run. The 72-dialogue main block
   remains unauthorized.
7. No branch push is authorized or performed.

The run ends at this stop boundary. Continuation requires a fresh reviewer
disposition; this report makes no repair proposal and changes no frozen
surface.
