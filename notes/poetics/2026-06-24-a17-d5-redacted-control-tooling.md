# A17 D5 redacted-control tooling

Date: 2026-06-24
Branch: `codex/a17-replay-replication`
Item: `workplan/items/a17-one-side-replay-replication-across-scenes.md`

## Scope

This is a no-spend tooling change after three failed D_OED5 control gates. No
paid model generation or QA call was run for this note.

The prior `none` arm was too weak for D_OED5: the tutor still received S plus
the premise ledger, and the scene setup made source/test-set questions a
natural helpful move. The revised control path makes the `none` paired arm use
`withhold_secret` whenever the drama carries an Oedipus `secret`.

## Runtime change

- `buildSecretContext(secret, "withhold_secret")` no longer exposes S or the
  premise ledger to the tutor.
- The control context instead tells the tutor that S/premises are redacted and
  forbids clue channels: source/origin/provenance, download path, local copy,
  benchmark/test-set identity, split membership, version/date, item counts or
  contents, paper-vs-local artifact comparisons, and same-name/two-things
  probes.
- `--paired-adaptation-arms none` now keeps the public arm key `none`, but for
  secret-bearing Oedipus dramas its effective tutor policy is
  `withhold_secret`. Non-secret paired controls still use policy `none`.
- The shared prefix in paired generation also uses `withhold_secret` for
  Oedipus secret dramas, so the control cannot leak before the branch split.

## Local verification

Covered by unit tests before any paid gate:

- `services/__tests__/oedipusSecretGuard.test.js` asserts that
  `withhold_secret` redacts S and premises while carrying the forbidden channel
  list.
- `tests/generatePedagogicalDramas.test.js` asserts that the `none` paired arm
  upgrades to `withhold_secret` only for secret-bearing scenes.
- `services/__tests__/learnerTutorInteractionEngine.test.js` asserts that the
  `withhold` move lowers to the `withhold_secret` policy.

## Next paid gate, if approved

Generate only the D5 control candidate, then run T1 QA on `none` only:

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/generate-pedagogical-dramas.js \
  --generator api --api-model sonnet \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --only D_OED5 \
  --paired-adaptation-arms none \
  --max-turns 6 \
  --director-variation-key a17-d5-redacted-control-run4 \
  --out-dir exports/a17-one-side-replay-replication/d5-redacted-control-run4/sample \
  --delib-dir exports/a17-one-side-replay-replication/d5-redacted-control-run4/deliberation \
  --transcripts-dir exports/a17-one-side-replay-replication/d5-redacted-control-run4/transcripts \
  --key exports/a17-one-side-replay-replication/d5-redacted-control-run4/key.yaml \
  --generation-concurrency 1 \
  --force
```

```bash
DOTENV_CONFIG_PATH=/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env \
node -r dotenv/config scripts/qa-oedipus-arms.js \
  --sample-root exports/a17-one-side-replay-replication/d5-redacted-control-run4 \
  --spec config/poetics-calibration/oedipus-pilot-v2.yaml \
  --arms none \
  --panel qwen/qwen3.7-max,google/gemini-3.5-flash,deepseek/deepseek-v4-pro,gpt \
  --out exports/a17-one-side-replay-replication/d5-redacted-control-run4/qa-oedipus-arms.json
```

If that gate reaches 3-of-4 withheld consensus, generate D5 `socratic` and
`reveal` plus the D4 scene in fresh roots before grading/replay. If it fails,
A17 should close as a methods finding rather than spending on another identical
D5 control sample.
