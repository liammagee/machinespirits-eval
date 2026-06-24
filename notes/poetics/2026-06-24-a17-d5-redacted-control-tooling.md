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

Additional no-spend preflight:

- Confirmed `/Users/lmagee/Dev/machinespirits/machinespirits-eval/.env` exists
  and loads `OPENROUTER_API_KEY` without printing the key.
- Confirmed `exports/a17-one-side-replay-replication/d5-redacted-control-run4/`
  and its expected child roots were clear.
- Ran the exact run4 generator command with `--dry-run`; it selected D_OED5 as
  `T01`, resolved `api/anthropic/claude-sonnet-4.6 via OpenRouter`, wrote
  nothing, and made no LLM call.
- Generated a temporary mock D5 `none` root and ran
  `scripts/qa-oedipus-arms.js --mock --arms none`; QA passed T1 in mock mode and
  the trace recorded `tutor_adaptation_policy: withhold_secret`.
- Added `scripts/run-a17-redacted-control-gate.js` and the package alias
  `npm run poetics:a17-redacted-control-gate -- ...` to package the gate as a
  guarded workflow. Validation:
  - `npm run poetics:a17-redacted-control-gate -- --dry-run` plans run4 and
    makes no LLM call.
  - `node scripts/run-a17-redacted-control-gate.js --mock --root /tmp/... --force`
    runs generator + QA with stubs, verifies `key-none.yaml` and the held-out
    trace both record `withhold_secret`, and passes T1 mock QA.
  - `node scripts/run-a17-redacted-control-gate.js --approve-paid` exits before
    generation unless `A17_PAID_GATE_APPROVED=YES` is also set.

## Next paid gate, if approved

Generate only the D5 control candidate, verify it used `withhold_secret`, then
run T1 QA on `none` only:

```bash
A17_PAID_GATE_APPROVED=YES \
npm run poetics:a17-redacted-control-gate -- --approve-paid
```

If that gate reaches 3-of-4 withheld consensus, generate D5 `socratic` and
`reveal` plus the D4 scene in fresh roots before grading/replay. If it fails,
A17 should close as a methods finding rather than spending on another identical
D5 control sample.
