# 011 — Codex report: representative matrix stopped at execution failure

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-D`

**Frozen matrix commit:** `36d2e63f134c631305ec7216870f36a5bb1af473`

**Branch at report:** `adaptation-refinement`

**Status:** representative collection incomplete; semantic and decision readers
not launched; stopped before the V3 natural-performance gate and outcome study

## Direction and source checks

Relays 009 and 010 authorized the representative matrix after the decision-reader
prerequisite passed. The run used a clean detached worktree at
`/private/tmp/ms-adaptation-refinement-36d2e63f` and the frozen prospective design:

- seed 503;
- two declared worlds, six learner profiles, and observe/active conditions;
- one eight-turn dialogue per cell, for 24 dialogues and 192 planned learner
  turns;
- Luna in the tutor, learner, and existing per-turn learner-analysis seats;
- the OpenAI Codex CLI ChatGPT-account route;
- 64 calls per dialogue and a 1,536-call collection ceiling;
- all nine declared corpus exclusions, with no diagnostic or supplement pooling.

The matrix authorization digest was
`a621fbf6e845e9417c4ed55fb4b28c2feda10af4abc2f08141cb1d435115a1d4`.
The accepted authorization is
`/private/tmp/adaptive-warrant-v3-matrix-dry-36d2e63f/launch-authorization.accepted.json`
(`7d7a40a3aecd2dacc3e4e8d44e3d927d6f7dd5d96e9f7834ba70572e7a36d71a`).
Its request artifact is
`/private/tmp/adaptive-warrant-v3-matrix-dry-36d2e63f/launch-authorization-request.json`
(`feea647e3c8e69e68de030390f56c7d68c7e1f69f2c5208cb6bf78bd03622aa9`).
The dry rehearsal completed 24/24 rows with zero transmitted calls.

The zero-call preflight passed 32/32 checks at
`/private/tmp/adaptive-warrant-v3-matrix-preflight-36d2e63f.json`
(`925772c671eae68ec6682d4c43fad3ee3169cd5dc9dc127f0a057402fb37256b`).
The excluded one-call schema-acceptance and route probe passed at
`/private/tmp/adaptive-warrant-v3-matrix-ping-run-36d2e63f/schema-acceptance-result.json`
(`ca15ede74dfe344406cf5932d9e86c3cad677aba770e8d8cd6927132c788cb96`),
returning Luna through the declared route with zero prohibited tool events. The
corrected freeze commit passed 8,502/8,502 root tests and 137/137 tutor-core
tests; its validation artifacts are in
`/private/tmp/v3-freeze-validation-36d2e63f`.

## Collection result: execution prerequisite failed

The attended matrix run is
`/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f`. Its controlling result
is `study-results.json`
(`6d3b7e7d0793f7a06a97e99e175ecc5a23c994181251af1195df2b482aeeac7c`),
with status `incomplete`. Of 24 planned dialogues:

- 23 produced valid child seals and all eight completed turns;
- one was sealed `incomplete` and the parent correctly classified it
  `evidence_invalid`;
- no semantic-reader or decision-reader call was launched;
- no V3 gate metric or natural five-kind prevalence is reportable from this
  incomplete collection.

The failed cell was
`world_028_larkspur_fridge-counterexample_hunter-intervening-r1-s503`. On its
eighth turn the learner asked whether Wrenfold's ledger entry might postdate
someone else's removal, or whether the shelf photograph directly tied Wrenfold
to shelf two. The initial tutor candidate and recovery path did not satisfy the
active public-obligation check. Recovery terminated with:

> `live_turn_progression_v1:public_obligation_unresolved` — the active public
> request was neither answered nor deferred with a named limit and concrete
> next condition.

The child seal is
`/private/tmp/adaptive-warrant-v3-matrix-live-36d2e63f/jobs/world_028_larkspur_fridge-counterexample_hunter-intervening-r1-s503/run-seal.json`
(`78ec99eaba4a08d740a597529879915cbb5639f2d104877003d69660d53e0db9`).
The parent execution-evidence row digest is
`1698c5c45ef350cc5acfa16ed0ebf441387ef510449aae700779cb600cc703e0`.

This is not an operational failure under the standing retry exception: a model
response was observed, the architecture's live delivery contract rejected the
candidate and recovery, and an evidence artifact was sealed. Retrying would
replace an observed architecture failure with a different stochastic dialogue,
so the failed run is preserved and not overwritten or resumed.

## Semantic extraction non-evaluability

There is a second, broader execution failure. All 192 learner-analysis calls
returned, but only 55 yielded usable live classifications. The remaining 137
fell back to `Classifier failed before the tutor turn.`:

| Live extraction measure | Observed |
| --- | ---: |
| Planned learner-analysis turns | 192 |
| Usable classifications | 55 |
| Failed/fallback classifications | 137 |
| Usable coverage | 55/192 = 0.286 |

On the 23 validly sealed dialogues alone, 54/184 analyses were usable and
130/184 failed, for 0.293 coverage. The incomplete child contributed one usable
and seven failed analyses.

This is not merely missing annotation evidence. The fallback sentinel entered
the live response-planning context and was sometimes surfaced in tutor prose,
including `Write: “Classifier failed before the tutor turn.”` Therefore the
natural dialogues do not provide a valid test of semantic-event extraction or
of downstream warrant decisions conditioned on correct extraction. Reader
labeling cannot repair that causal contamination, so the generated blinded
sample and private key remain untransmitted and unscored.

The failure classification is **architecture/execution non-evaluability**, not
provider transport, authorization, source provenance, reader ambiguity, or a
threshold miss. The frozen instrument successfully exposed the failure; the
natural-performance gate itself was not reached.

## Calls and artifacts

The live matrix spent 612 model calls, below its 1,536-call ceiling:

| Seat | Calls |
| --- | ---: |
| Auto learner | 192 |
| Learner analysis | 192 |
| Tutor | 192 |
| Tutor recovery | 24 |
| Model opening | 12 |
| **Live matrix total** | **612** |

The schema-acceptance probe spent one additional, permanently excluded call.
Dry rehearsal and reader calls spent zero. Total transmitted calls for this
boundary were therefore 613, of which 612 belong to the attempted matrix.

Preserved top-level collection artifacts include:

- `study-results.md`
  (`1adeecd3e7513e820b4a5784e49acdd24389d8857dee425701e0dfb4d73cb887`);
- `annotation-sample.blinded.json`
  (`34cc549453d7d9d5f6f57c39b263a14e5115b1b46852a204d6ab966df72c882f`);
- `annotation-key.private.json`
  (`fa6bfe5952b67b9f7561c5b3b18f3af5828f98d3682d1943717174a43e093675`);
- `semantic-annotation-handbook.md`
  (`53b3bff6f9f3c9ee6df92113439c596407f7045624868ec1f85ca116aab5aa6c`);
- `semantic-predictions.private.json`
  (`aa81c0cc45803ca69f5b510691cfc7098ee9fd14c910db09e0aadf6f1a9b085d`).

No representative-matrix process remains active. Pre-existing tutor-stub MCP
and interactive processes are unrelated to this matrix and were left untouched.

## Boundary and next control point

The run stops for reviewer and human review, as required by relay 009 for a
failed matrix. Do not launch readers, compute a gate from the incomplete corpus,
retry the failed cell, reopen the instrument, or begin the outcome study without
a new prospective ruling. Any continuation should preserve this run as failed
evidence and decide prospectively whether to repair the live analysis fallback
and delivery-recovery boundaries, then freeze an entirely new representative
collection.
