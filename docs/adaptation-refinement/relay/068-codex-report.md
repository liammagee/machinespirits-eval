# 068 — Codex report: lawful seed-514 instrument freeze located

**Date:** 13 August 2026. **Lease:** `DRIVER-LEASE-2026-08-13-N`,
continued under direction 067. **Boundary:** zero-call source audit complete;
paid HOLD remains in force.

## Outcome

A lawful `--instrument-freeze` input exists on this machine. No construction
and no new schema-acceptance ping are required:

```text
/private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

SHA-256:
`6a64b31fb57fa4a60e6ef4a42414c422d9b0e2964bdf6ee8491193fc026f3c5f`.

This is the presence-confirmation repin of the natural freeze emitted from the
completed seed-514 representative mechanism-validation matrix
`adaptive-warrant-v3-matrix-live-489f2429-r38-s514`. The underlying 93-case
freeze is the one reported in report 044; the r52 repin is bound to source
commit `ed19be428abdaa07055ccaa8f957d22cb8f86920` and carries the subsequently
accepted reader identity. The artifacts did not go to `.tutor-stub-auto-eval`
or `exports/`: they remain under `/private/tmp`. The relevant filename is
`annotation-freeze-manifest-r52-presence-confirmation.json`, not
`validation-freeze-manifest.json`.

The direction-067 claim that no natural freeze or surviving schema-acceptance
artifact exists is therefore not true of the current filesystem. No search
result or provenance field was manufactured to bridge the gap.

## Zero-call validation

`validateOutcomeFreezeFormForFrozenDecisionRunner()` accepted the file as:

```text
machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1
status: frozen
```

Every referenced binding exists and matches its recorded digest:

| Binding | Provenance | SHA-256 |
|---|---|---|
| `protocol` | r43 clean source tree, `baseline-comparison-design.md` | `59fc52451e08aeec93488941625dbef8a5d9b46a301ba8c4225804a30f7908f0` |
| `study_plan` | seed-514 live matrix | `be7f40bd7cf1873d8e3675c0fffe0f4f132fc0cb4986f1653911442323c2fa5a` |
| `annotation_handbook` | seed-514 frozen decision instrument | `5673c14b8f2a2b17c599e947c87f6d03c10df6dcdbeadcb257d882f008902003` |
| `semantic_handbook` | seed-514 frozen presence instrument | `0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b` |
| `semantic_predictions` | seed-514 93-case freeze | `3654a89b1099455327d595d644931904b57be326fccab1e0ab69c1eefae69758` |
| `corpus` | seed-514 93-case blinded corpus | `52bc3ae49f634bd2c4b872f843b1be1f15e859618b3ffa7cfa1fb0ae7cc1e184` |
| `key` | seed-514 93-case private key | `5c54de8f54b5ef25331cdf053140de9ce4d55a915ec9915c152320ee86f0a883` |
| `semantic_instrument.preflight` | r52 source-bound 42/42 preflight | `fc11c9a11bd6f20acfa062ca022281eb6aa1c6d870981e67e840a2061729260c` |
| `semantic_instrument.schema_acceptance` | r52 zero-call carryover | `59e3a6b05ebad416ece70160b59e1efe255d773421243a7d980db6be261073d8` |

The bound schema-acceptance artifact is admissible under
`carryOverOutcomeSchemaAcceptance`: `status: passed`,
`inferential_role: transport_only_permanently_excluded`, synthetic case
permanently excluded, response received, prohibited-tool count zero, and calls
`1/1/1`. Its response-schema file still exists and matches
`44b4807e25f0620e2677ed49031dec558daa6f0aeec0f20a97b85ec2c6cb6bc1`,
the digest pinned in the outcome-pilot manifest.

The current frozen instrument also still matches the pilot manifest:

- extraction schema:
  `e5af8f2b6877e7e427ddae77bf7ed58bf0b6d129082885a838905cad5bce820d`;
- reader schema:
  `6cb95fd8032f4c43c9fdc1e45808680365d5a0d3eb2dda5ef085e4d97e10145f`;
- semantic preparer:
  `9b545f368da469d0271613751d6da6f11bb4ae1fc57fa63d39a66733ce83177c`;
- decision preparer:
  `f23d3b1619734091e9b5ac9a37501c8a64f07c1cbf240e62e9b8e7eb43a767fc`;
- decision runner:
  `1eb6be9d4cf2d802ff2bcb16394fdd0f99952d10a3ff62456ebc79ad42346116`.

## Direction-067 determinations

1. **Lawful source:** the seed-514 live representative matrix, using its r52
   natural-freeze repin at the exact path above.
2. **Construction:** none. Reconstructing a duplicate wrapper would add no
   evidence and risks inventing provenance; the emitted, digest-bound source
   freeze itself survives.
3. **Paid ping:** not required. Added cost is **0 calls**, so the frozen
   manifest remains exactly `18 + 288 + 288 = 594`; no 595-call repin is
   indicated by the evidence found here.
4. **Harness requirement:** not wrong. The harness can use the accepted natural
   source-freeze form exactly as direction 065 and ruling 064a required. The
   gap was artifact discovery/name/location, not a missing freeze form.

A future reviewer go note may name the existing entry point and this source:

```text
node scripts/run-adaptive-warrant-outcome-pilot.js \
  --go-note <fresh-committed-reviewer-go-note> \
  --accept-charges \
  --out <fresh-output-directory> \
  --instrument-freeze /private/tmp/adaptive-warrant-v3-matrix-live-489f2429-r38-s514/annotation-freeze-manifest-r52-presence-confirmation.json
```

This command was **not run**. No fresh go note exists, GO note 063a remains
consumed, and the paid HOLD remains in force.

## Accounting and stop boundary

- Model calls in direction 067: **0**.
- Counter remains **3,523 / 11,337**.
- Seeds 515–517 remain unspent.
- Pilot dialogues generated: **0 / 18**.
- Reader calls: **0 / 576**.
- Instrument, harness, manifest, and external artifacts modified: **none**.
- Branch pushed: **no**.
- Boundary: report committed; waiting for reviewer ruling and, if accepted,
  a fresh go note.
