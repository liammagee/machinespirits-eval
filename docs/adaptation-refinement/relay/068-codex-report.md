# 068 — Codex report: lawful seed-514 freeze found; unrelated zero-call guard stop

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`,
continued under direction 067. **Boundary:** zero-call source audit stopped on a
failed committed-manifest guard. The paid HOLD remains in force.

## Outcome

A lawful `--instrument-freeze` source does survive on this machine. It is the
seed-514 representative matrix's r52 presence-confirmation repin:

```text
/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

The source freeze passed
`validateOutcomeFreezeFormForFrozenDecisionRunner`. Before attempting the
harness-level check, I independently verified that every binding named below
still exists and that its bytes match the SHA-256 recorded in the freeze.

The authorized zero-call composite check then stopped before creating the
current carryover. `verifyOutcomePilotManifestBindings()` threw:

```text
standing-permission menu byte guard failed
```

Per direction 067's stop rule, I ran no further checks. This is not a finding
against the recovered source freeze: the form validator had passed, and the
failure occurred in the separate outcome-pilot manifest/menu guard before the
schema-acceptance carryover or frozen-reader binding check was reached.

## 1. Lawful source and artifact disposition

The expected source was the completed seed-514 representative matrix, not the
10 August baseline pilot or contract-validation run. More precisely, the
outcome pilot manifest pins the seed-514 corpus SHA-256 and the r49/r52 reader
surfaces, so the latest matching natural freeze is the r52 presence-
confirmation repin at source commit
`ed19be428abdaa07055ccaa8f957d22cb8f86920`.

The artifacts did not disappear. They remain under `/private/tmp`, outside the
repository, sibling worktrees, archive repository, and project-local paths
listed in direction 067's search. The surviving freeze identifies study
`adaptive-warrant-v3-matrix-live-489f2429-r38-s514` and carries the required
natural-freeze schema and `status: frozen`.

Its five decision-runner bindings are:

| Binding | Surviving path | Recorded and verified SHA-256 |
|---|---|---|
| protocol | `/private/tmp/adaptive-warrant-r43-clean-a925/docs/adaptation-refinement/baseline-comparison-design.md` | `59fc52451e08aeec93488941625dbef8a5d9b46a301ba8c4225804a30f7908f0` |
| corpus | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-sample.blinded.json` | `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184` |
| annotation handbook | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-handbook.md` | `5673c14b8f2a2b17c599e947c87f6d03c10df6dcdbeadcb257d882f008902003` |
| key | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-key.private.json` | `5c54de8f54b5ef25331cdf053140de9ce4d55a915ec9915c152320ee86f0a883` |
| study plan | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/study-plan.json` | `be7f40bd7cf1873d8e3675c0fffe0f4f132fc0cb4986f1653911442323c2fa5a` |

The additional surviving bindings are:

| Binding | Surviving path | Recorded and verified SHA-256 |
|---|---|---|
| semantic preflight | `/private/tmp/adaptive-warrant-v3-preflight-ed19be42-r52-s514.json` | `fc11c9a11bd6f20acfa062ca022281eb6aa1c6d870981e67e840a2061729260c` |
| schema acceptance | `/private/tmp/adaptive-warrant-v3-schema-acceptance-carryover-ed19be42-r52-s514.json` | `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8` |
| semantic handbook | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/semantic-annotation-handbook.md` | `0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b` |
| semantic predictions | `/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/semantic-predictions.private.json` | `3654a89b1099455327d595d644931904b57be326fccab1e0ab69c1eefae69758` |

The schema-acceptance artifact is admissible on its face: `status: passed`,
`inferential_role: transport_only_permanently_excluded`, the synthetic case is
permanently excluded, a response was received, prohibited-tool count is zero,
and calls are exactly 1 attempted / 1 completed / 1 maximum. Its bound provider
response schema still exists and matches
`44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`,
the outcome manifest's pinned response-schema digest. The r52 artifact records
its zero-call provenance back to the r49 carryover and the r47 schema artifact;
it does not assert a new paid response.

## 2. Zero-call construction path

No source freeze needs to be constructed. The lawful path is to supply the
surviving r52 freeze above directly as `--instrument-freeze`.

On an otherwise authorized future launch, the committed harness's intended
zero-call path is:

1. generate a new deterministic semantic brittleness preflight at the launch
   commit;
2. call `carryOverOutcomeSchemaAcceptance` with the r52 freeze's
   `semantic_instrument.schema_acceptance.path` as `sourcePath`;
3. bind the new preflight and the byte-identical provider response schema into
   `semantic-schema-acceptance-carryover.json`, recording the original result
   path, SHA-256, source commit, authorizing direction, and `new_calls: 0`;
4. validate the current preflight/carryover and all manifest-pinned reader,
   preparer, schema, and handbook digests before admitting generation.

That path does not re-open the frozen instrument: it reuses an actual passed,
permanently excluded transport result; it does not fabricate a model response;
and the response-schema bytes equal the manifest pin. I did not complete this
carryover in the audit because the preceding manifest/menu guard failed.

## 3. Paid schema-acceptance ping and accounting

A new paid schema-acceptance ping is **not required** while the surviving r52
freeze and its bound artifacts remain available and admissible. Therefore no
ping command was run, no extra call was spent, and there is no basis here to
repin the outcome manifest from 594 to 595 calls.

The frozen plan remains 18 generation + 288 presence-reader + 288 decision-
reader calls = **594**. Actual calls in this direction: **0**. Counter remains
**3,523 / 11,337**.

## 4. Is the harness requirement wrong?

No. Requiring a prior natural freeze is coherent with the harness's design: it
supplies the already frozen decision and semantic handbooks and an admissible
transport-only schema-acceptance result, while the outcome pilot later emits
its own new natural freeze over the newly generated corpus and key. Removing
the source-freeze requirement would discard that provenance chain.

No harness edit is proposed or made under direction 067. The immediate blocker
is instead the failed standing-permission menu byte guard. The recovered source
freeze also lives only under `/private/tmp`; a later reviewer-authorized
preservation/repin may be prudent, but copying or repinning it is outside this
zero-call report direction and was not performed.

## Stop and accounting

- Source-freeze form check: **PASS**.
- All recovered source binding paths and recorded hashes checked before the
  composite run: **PASS**.
- Outcome manifest/menu guard: **FAIL** —
  `standing-permission menu byte guard failed`.
- Current schema-acceptance carryover: **not reached**.
- Frozen-reader binding check: **not reached**.
- Model calls: **0**.
- Paid calls: **0**.
- Seeds claimed or burned: **none**.
- Pilot launched: **no**.
- Branch pushed: **no**.

Direction 067 ends at this failed-check boundary. The paid HOLD remains in
force, and a reviewer ruling is required before any continuation.
