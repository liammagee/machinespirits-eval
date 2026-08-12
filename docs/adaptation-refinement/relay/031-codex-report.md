# 031 — Codex report: contract v3.1, seed-510 coverage halt, seeds exhausted

**Date:** 12 August 2026

**Driver lease:** `DRIVER-LEASE-2026-08-12-D`

**Authority:** human ruling in Direction 030 under unattended note 023

## Ruling

**HARD STOP for the human under notes 023 and 030. Seed 510 is burned and the
reserve seeds are exhausted.**

The two and only two human-authorized semantic-contract amendments were
implemented as contract v3.1, licensed in the required order, and committed at
`724573e0a8e90902c7dd95a8b3944ca3f95c4756`. The zero-call replay and all
preflights passed, so the fresh seed-510 matrix was launched from that clean,
detached commit.

The live runner then entered its registered `coverage_halt` state. Its retained
halt snapshot is **25/160 unanalyzed = 15.625%**, above the frozen 15% ceiling.
The first logged crossing was 20/128 = 15.625%; already-running bounded children
were allowed to seal, and the retained halt snapshot advanced through 21/136,
22/144, 23/152, and 25/160. One final already-running eight-turn child then
sealed, making the descriptive final total **25/168 = 14.881%**, but the failed
self-halt checkpoint is not waived post hoc: `study-results.json` remains
`status: coverage_halt`. Direction 030 says any seed-510 coverage halt is a
human hard stop.

No semantic readers, decision readers, matrix-gate ruling, preregistration,
pilot, or outcome block were started. There was no retry, seed substitution,
contract reinterpretation, or outcome scoring.

## Open amendment history

Contract v3.1 is an openly disclosed post-hoc amendment selected after seeing
seeds 503–509 fail. Those corpora remain burned and unscored; seed 510 was the
first fresh corpus under v3.1. Any later report or paper section using seed-510
data must retain that disclosure.

The amendments are exactly Direction 030's two rules:

1. On request acts only, literal `"unspecified"` may occupy both `target_id`
   and `action_object_id` when the learner's words name no catalogue item.
   Empty remains invalid, non-request use remains invalid, and downstream it is
   a generic evidence request that names no catalogue item.
2. Requested value-type and component sets are descriptive and allowed on any
   act. The speech-act label alone determines whether an event is a request;
   `value_component_sets_forbidden_for_non_request` was removed.

The contract, validator, live prompt handbook, generated handbook, annotation
descriptions, downstream obligation ledger, tests, and prospective seed lock
were updated together. All other strict rules remained in force.

## Zero-call licensing chain

### Tests and preflights

- Direction-030 focused contract set: **177/177 passed**.
- Broader adaptive-warrant set: **193/193 passed**.
- Launcher's exact focused/integrity set: **194/194 passed**.
- Derivation-world quality: **35 worlds passed**.
- Prompt/world focused tests: **22/22 passed**.
- Exact semantic preflight: **42/42 passed**, `instrument_ready`.
- Probe/live handbook prompt parity was byte-identical at
  `3397fc58f43008d52e9dd4d0c15a831653ddb732850d0d8146c2e0f8cee8a29d`.
- The provider schema was byte-identical to the previously accepted schema at
  `44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`;
  its acceptance carried over with zero new calls.
- The dry matrix produced all **24/24** planned jobs before authorization.

Focused regressions explicitly cover request-sentinel acceptance, empty-ID
rejection, non-request sentinel rejection, descriptive value/component sets on
non-request acts, generic downstream handling, and the unchanged literal-span,
public-identifier, and atomicity rules.

### Seed-509 replay under v3.1

The authoritative zero-call replay of all 131 retained seed-509 returns
predicted **13/131 discarded = 9.9237%**, passing the required <=15% launch
line. It predicted 118 survivors.

This is less optimistic than the reviewer's mechanical 3/128 expectation
because v3.1 permits the new literal sentinel but does not rewrite historical
empty strings into it. The replay correctly left those old empty-ID responses
invalid. It was licensing evidence only and was not used for outcomes.

## Seed-510 execution

- Study: `adaptive-warrant-v3-matrix-live-724573e0-v31-s510`
- Commit: `724573e0a8e90902c7dd95a8b3944ca3f95c4756`, detached and clean
- Shape: two worlds x six profiles x observe/active, one run, eight turns,
  **24 dialogues planned and 24 rows collected**
- Seat: `codex.gpt-5.6-luna` for tutor, learner analysis, and automated learner
- Route: OpenAI Codex CLI, ChatGPT-account route
- Frozen ceiling: 1,536 calls; actual conservative attempts: 588
- Children: **21 complete/valid**, **3 evidence-invalid** after incomplete child
  seals; valid completed turns: 168
- Execution row digest:
  `c8fb5bad469b22ae8b2770ae253e433a3db02d48d3be81f4e36efb131051631f`

Authorization was digest-bound to the exact commit, source closure, child
policy, study-plan execution, destination, private payload scope, and frozen
matrix. The accepted source-provenance digest was
`fb96f9ff08b318f6eea5d40ac6381a3631c4966c870bd060a47c35daf948295e`;
child-policy digest
`25813b3ccadfd786b6b491ecc8467db891dc3d69276772b18072dec99739cc13`;
study-plan execution digest
`0ea7e5bda09dbacd11fb08338192d87ac3cfd108bfe1eedc26bef15f6cf8dd51`.
No SHA, route, destination, payload, source-closure, or matrix mismatch was
observed.

Training reuse was requested `on`. Because every session was automated-only,
the effective status was `off` / `not_applicable`, reason
`no_human_or_mixed_input_expected`.

## Coverage cause split

At the final descriptive 168-turn total, 143 analyses were valid and 25 were
unanalyzed. Prompt-audit overflow was **0/168**; prompt-audit failures,
classification fallbacks, and prompt-audit recoveries were all zero.

Of the 25 unanalyzed turns:

| Cause | Turns |
|---|---:|
| `"unspecified"` used on a non-request act, forbidden by v3.1 | 19 |
| non-atomic overlapping event spans | 3 |
| non-public identifier | 1 |
| non-literal evidence span | 1 |
| learner-analysis model timeout | 1 |
| **Total** | **25** |

Thus the requested audit-overflow/model-residual split is **0 audit overflow,
24 returned-output strict-validator residuals, and 1 transport timeout**. The
dominant failure is the analysis seat overgeneralizing the newly introduced
sentinel beyond the handbook's request-only rule. These are violations of
written v3.1 rules, hence reader/model errors under the discriminator, not
both-defensible contract ambiguity. No contamination or provenance anomaly was
found.

## Calls spent

Seed 510 recorded **580 completed `model_call` events** and **8 model-call
errors**, against **588 call-budget reservations/attempts**. For the unattended
budget this report conservatively counts all 588 attempts, including errors.
The replay, tests, preflights, dry run, and schema carryover used zero new
provider calls.

| Component | Calls |
|---|---:|
| Running total through report 029 | 1,085 |
| Seed-510 matrix attempts | 588 |
| **Unattended running total** | **1,673 / 4,000** |

The 4,000-call ceiling was not approached. The stop is seeds exhausted after a
matrix coverage halt, not budget exhaustion.

## Principal artifacts

| Artifact | SHA-256 |
|---|---|
| v3.1 seed-509 zero-call replay | `6af034e561c952d3bfe6be31e13ab4b47587109f85682aa219b0c6b195363e78` |
| v3.1 seed-510 exact preflight | `e7f8b650d17e0d84cd1b3a9950f5ade69f706e5095f0b37c4e0fc48bdddf8c54` |
| Schema-acceptance carryover | `757153e04ff5c9d24ed767f12b387e7a24851d8b10dbb9251655d0aec8bdbeba` |
| Approved launch authorization | `0b875f47290b00170a327c8570a4c32ceed9d8737318e257a76b44e085344963` |
| Live launch authorization request | `31e960f39f698f43ad57d5cb4b55f8b759c1d5b281e42f081ebd3601d5d0fa3e` |
| Live accepted authorization | `e43f34f94c2946444aa8c40e50c8c527229a4a7d0f868e65429ada34524dc27b` |
| Seed-510 study plan | `2d8939d58ac7dbe632c1112a1447c6f45334cd091fe8b9cdcaae8128263552bc` |
| Seed-510 study results JSON | `22d731953323a69e3311842bebcb50864cf969747f63c2ee1694e94881fbfe06` |
| Seed-510 study results Markdown | `5a0489106b1d1a1c06d26fe7bec853dd8945f6531131243b7b955642b1ccf94f` |

Live artifacts are retained at
`/private/tmp/adaptive-warrant-v3-matrix-live-724573e0-v31-s510/`.

## Required next authority

Hold. Direction 030 explicitly exhausts the seed reserve at this boundary and
provides no further amendment, retry, alternate-seat, threshold, or outcome-
study authority. A human must decide whether to stop the programme or issue a
new prospective protocol. The matrix gate is **not ruled** because the live
matrix self-halted before the independent-reader stage; ruling 010's binary
fallback was never reached.
