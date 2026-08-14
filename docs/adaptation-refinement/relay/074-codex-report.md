# 074 — Codex report: outcome pilot v3 stopped at frozen case-count guard

**Date:** 13 August 2026. **Authority:** reviewer GO note 073a. **Boundary:**
the launch command from GO note 073a was run verbatim once from a clean
worktree at HEAD `53d6bb8378197c2929beff114e6706eda0e4bae5`. All launch
guards passed. All 18 generation dialogues then sealed complete, after which
the frozen case-count guard refused with exit code **1** before the
`annotationCaseFingerprint` guard, natural freeze, or either reader phase.
No harness, instrument, manifest, freeze, source artifact, or generated run
artifact was amended, retried, resumed, or deleted.

## Outcome status

**STOPPED — frozen case extraction produced 143 / 144 cases; no
outcome-pilot ruling is available.**

The executable reported exactly:

```text
[outcome-pilot] error: outcome case extraction did not produce the frozen 144 cases
```

The preserved checkpoint contains 18 `complete` dialogue rows, no child error,
and no checkpoint quarantine. A read-only reconstruction using the exact
frozen extraction arguments produced **143** cases:

| Axis | Extracted cases |
|---|---:|
| bare | 48 |
| gated | 47 |
| standing permission | 48 |
| world 101 / Kestrel | 72 |
| world 102 / Marigold | 71 |
| **total** | **143** |

The single missing admitted case is mechanically localized to
`outcome-pilot-11-world_102_marigold_archive_box-s516-gated`: the child sealed
with eight public turns and eight decisions, but its recorded learner-analysis
coverage is 7/8 (`0.875`) and turn 5 appears in
`learnerAnalysisUnanalyzedTurns`. The frozen corpus builder excludes an
unanalyzed turn, leaving seven cases from that dialogue while every other
dialogue contributes eight. This is an accounting observation only, not a
semantic verdict or a repair proposal.

## Calls spent per phase versus the 1116-call plan

| Phase | Frozen plan | Actual reservations | Unspent |
|---|---:|---:|---:|
| generation | 540 | **454** | 86 |
| presence readers | 288 | **0** | 288 |
| decision readers | 288 | **0** | 288 |
| **total** | **1116** | **454** | **662** |

All 454 generation reservations belong to children that sealed complete. No
schema-acceptance ping was made; the carryover artifact records zero new
calls. The case-count guard failed before either reader launcher was reached.

Counter arithmetic from the GO-note baseline:

- Start: **3,613 / 11,337**.
- This launch: **454** calls.
- Stop counter: **3,613 + 454 = 4,067 / 11,337**.
- Remaining under the ceiling: **11,337 - 4,067 = 7,270**.
- Unspent portion of the authorized 1,116-call block: **662** calls.
- The planned completion counter, **3,613 + 1,116 = 4,729 / 11,337**,
  was not reached.

## Checkpoint summary

| Field | Preserved value |
|---|---:|
| status | `generation` |
| process exit | 1 |
| completed dialogues | 18 / 18 |
| checkpointed quarantined dialogues | 0 |
| generation reservations | 454 / 540 |
| presence-reader reservations | 0 / 288 |
| decision-reader reservations | 0 / 288 |
| total reservations | 454 / 1116 |
| checkpoint update | `2026-08-13T00:55:19.533Z` |
| extracted outcome cases | 143 / 144 |
| post-generation fingerprint guard reached | no |
| natural freeze created | no |
| outcome readers launched | no |

Completed checkpoint rows:

| Order | Dialogue suffix | Condition | Seed | Reserved calls |
|---:|---|---|---:|---:|
| 1 | world 101 | bare | 515 | 25 |
| 2 | world 101 | gated | 515 | 25 |
| 3 | world 101 | standing permission | 515 | 27 |
| 4 | world 102 | gated | 515 | 24 |
| 5 | world 102 | standing permission | 515 | 24 |
| 6 | world 102 | bare | 515 | 24 |
| 7 | world 101 | standing permission | 516 | 25 |
| 8 | world 101 | bare | 516 | 28 |
| 9 | world 101 | gated | 516 | 26 |
| 10 | world 102 | bare | 516 | 24 |
| 11 | world 102 | gated | 516 | 25 |
| 12 | world 102 | standing permission | 516 | 25 |
| 13 | world 101 | gated | 517 | 26 |
| 14 | world 101 | standing permission | 517 | 26 |
| 15 | world 101 | bare | 517 | 25 |
| 16 | world 102 | standing permission | 517 | 25 |
| 17 | world 102 | bare | 517 | 25 |
| 18 | world 102 | gated | 517 | 25 |
| **total** |  |  |  | **454** |

All six planned condition/seed cells were generated: six bare, six gated, and
six standing-permission dialogues across seeds 515–517.

## Quarantine list

| Artifact set | Disposition |
|---|---|
| v3 dialogues 1–18 | All child seals are complete, but the set is report-quarantined from outcome admission because the frozen extraction count failed at 143/144. Preserve unchanged; do not admit, pool, score, or launch readers without a fresh reviewer disposition. |
| v3 dialogue 11, world 102 / seed 516 / gated, turn 5 | The mechanically excluded turn: marked learner-analysis unanalyzed. It is not present in the 143-case reconstruction and receives no semantic classification here. |
| v2 dialogues 3–4 | Remain quarantined under report 071/ruling 071a; untouched and never reused. |
| v2 dialogues 1–2 | Preserved, untouched, and not reused by v3. |
| v1 dialogue 2 | Remains quarantined under ruling 069a; untouched. |
| v1 dialogue 1 | Preserved and not reused; untouched. |

The parent checkpoint's own `quarantined_dialogues` array is empty. The v3
quarantine above is the report disposition required by the failed
post-generation guard.

## Artifact SHA-256 table

All v3 run artifacts remain under the ignored local output root:

```text
.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/
```

Principal launch and stop-boundary artifacts:

| Artifact | Path | SHA-256 |
|---|---|---|
| executable | `scripts/run-adaptive-warrant-outcome-pilot.js` | `6b0d2bee23f3e896351002712a88ed398d6d106d4ed3054de9fbe2d29ec069ea` |
| GO note 073a | `docs/adaptation-refinement/relay/073a-reviewer-go-note-outcome-pilot-v3.md` | `7903cb6f326f355e7d38afffa8f92226e16fb9890cfd0f533a68509780007da8` |
| relay state at launch | `docs/adaptation-refinement/relay/STATE.md` | `d7e1e8e7d13ab3597835accfef82787cd90683834c3f836cd0726bdfb0bd208c` |
| pilot manifest | `docs/adaptation-refinement/outcome-study-a1/pilot-manifest.json` | `2475cb2479cb826ef9abf64515597edbfc4954a0045fe1f09e9917e37d93006b` |
| instrument freeze | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json` | `6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f` |
| v3 checkpoint | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/outcome-pilot-checkpoint.json` | `c70e445258624cece37bc82d7f8aa4458bb05f186c4c33fac2cace827c796d79` |
| prompt-audit preflight | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/prompt-audit-preflight.json` | `5458ce199dbf2eac4c7c5a124619888bbce2f2a62f08be20971c0d1330c2c2fb` |
| semantic preflight | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/semantic-brittleness-preflight.json` | `7c06dc493ad56d702fd023353e89de2c425f713cacc5ea916165bb8e1db206b1` |
| schema-acceptance carryover | `.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/semantic-schema-acceptance-carryover.json` | `df8eda01cf73a5894a5746fa865afea22ccab9563b71421f4060a48c90663693` |

Sealed child artifacts (`run-seal.json` under each dialogue directory):

| Order | SHA-256 |
|---:|---|
| 1 | `12b05b0335219e0bafa46aa8b0aa17ac152a63da0c177f6132c3b9e96c48b4b1` |
| 2 | `166a258e6401dbea1741f9029d598a4f650e5de5f519032687db3a5f498697d9` |
| 3 | `3f4c4a06a144b84ecc78f4329cbb4dfe70d83cd329b256f11e501b6078567096` |
| 4 | `84c9df26c1e7f43f7e152a17ace1c04830cbfc6333c0f116e82ad30794313d3a` |
| 5 | `43f55255825bc38e71acf7213c00a24e313dad5a26ae3ed828593c97c398200c` |
| 6 | `03aaa703cc759b150a963cb5cd0bb45e68680a536f665debe04603742d9ea932` |
| 7 | `e918b9be8bcb15f297bf366959f380d0d45bf27ecdfeb55a820e003c21a414d0` |
| 8 | `062935ecb6cfc4f25a36d396bd82d5e4200ef64ba7a2ee788629d1260f843bb6` |
| 9 | `f14f4b335268e0cc8d07b5bd9eb578e5bbffef3b390b3c7fcf58d622ada9b132` |
| 10 | `61f3ad90a24a80aac9014c0035e3e04769d7bd686eedda6dd0a5ba7a91c60fa0` |
| 11 | `ff2373b6c34323106bb8f5c2efddd3dd627f4434067c7b6ab99a0cfc5fe9e2df` |
| 12 | `60dd5e323e289dbe1729b87f1044b9d8225710a12d75ae145529b9fa60da81bb` |
| 13 | `823756f335837315526597ed3cf52747ed84655363353a19e3f16a6f773a729d` |
| 14 | `6ff3acce6941dc83a2600e087e68559bc09c03fffbdc2aba620aa32fa390cd13` |
| 15 | `652117924677dbb22e35cc4a9001ebc49a1785c35b5fa1bf7d1d82b1ba80ab3e` |
| 16 | `5ddb4e95d768d8f2dc0a919e93c2b8b7232acc09afecfb1c82abef5b636f203f` |
| 17 | `4b53501973b9d1f55915468f986ab81fce3035b2aa9eb63309a0e18d259b9fae` |
| 18 | `4dca461fb3af9ef273490793f753de6a1defed087ad15190eddf06f4f9008f8d` |

No `annotation-sample.blinded.json`, private key, semantic predictions,
natural freeze, presence-reader output, decision-reader output, or outcome
report was written because the refusal preceded those steps.

## Stop disposition

1. The GO-note command was run verbatim once from clean HEAD `53d6bb83`.
2. Every pre-call launch guard passed, including the six-render prompt-audit
   preflight; no launch guard refused.
3. All 18 generation dialogues sealed complete and consumed 454 calls.
4. The frozen case-count guard then refused at 143/144. No retry, resume,
   amendment, substitution, deletion, or repair was attempted.
5. The mandatory `annotationCaseFingerprint` guard was not reached. No natural
   freeze or reader artifact was created, and no reader call was made.
6. No semantic interpretation or outcome computation was run. The
   72-dialogue main block remains unauthorized.
7. No branch push is authorized or performed.

The run ends at this stop boundary. Continuation requires a fresh reviewer
disposition; this report makes no repair proposal and changes no frozen
surface.
