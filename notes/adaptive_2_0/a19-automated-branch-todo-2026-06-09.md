# A19 Automated Branch Todo

Date: 2026-06-09.
Status: automated branch scaffold implemented; deterministic packet adjudication
showed a bounded S1 > S0 proxy difference, but the promoted A19 attempt-1 and
stability gates did not reach a controlled positive.

## Boundary

Human coding is intentionally deferred for this branch. The preserved
learner-standing packets remain useful artifacts, but they should not be the
next operational blocker: human coding adds coder-selection fragility,
assignment-key hygiene, interface-navigation risk, and another construct layer
before the automated A19 evidence unit is stable.

The active branch should therefore stay purely automated:

- deterministic fixture/protocol validation;
- deterministic cheap screens;
- blinded packet generation without human assignments;
- automated/model adjudication only after a candidate survives deterministic
  gates;
- no Paper 2.0, atlas, sidecar, paid-panel, human-learning, deployed-tutor,
  model-weight-learning, or main-harness claim.

## Immediate Implementation Todo

- [x] Import the missing workspace dependency surface by installing the declared
  npm modules locally (`yaml` is required by the A19 scripts).
- [x] Copy the automated mini-drama/rhetorical screening modules from the main
  repo into this checkout:
  - `config/rhetoric/*.json`;
  - `services/miniDramaMachines.js`;
  - `scripts/a19r-mini-drama.js`.
- [x] Keep the copied CLI off the human-coder branch by disabling assignment
  generation in `packetize`.
- [x] Add package scripts for the automated branch:
  - `npm run a19r:mini-drama`;
  - `npm run a19r:screen`;
  - `npm run a19r:codebook`;
  - `npm run a19r:adjudicate`;
  - `npm run test:a19r`.
- [x] Add focused automated tests for codebook coverage, no-model generation,
  proxy-screen reporting, and blinded packet redaction.
- [x] Run targeted automated checks:
  - `npm run a19:validate -- --json`;
  - `npm run a19:generalize -- --json`;
  - `npm run a19r:codebook -- --json`;
  - `npm run a19r:screen -- --json`;
  - `npm run test:a19r`;
  - `npm run test:a19`.
- [x] If targeted checks pass, write one automated branch report under
  `exports/a19r/reports/` from the deterministic screen output.
- [x] Packetize the five strongest deterministic candidates as blinded,
  packet-only artifacts under `exports/a19r/adjudication-packets/` without
  writing human-coder assignment files.
- [x] Add deterministic automated packet adjudication that preserves the raw
  blinded judgment before applying the private S0/S1 key.
- [x] Run the automated packet adjudicator over the five prepared packet-only
  artifacts:
  - command: `npm run a19r:adjudicate -- --packet-dir exports/a19r/adjudication-packets/automated-branch-2026-06-09 --out-dir exports/a19r/automated-adjudication/automated-branch-2026-06-09 --summary-out exports/a19r/reports/automated-adjudication-2026-06-09.json --json`;
  - summary: `exports/a19r/reports/automated-adjudication-2026-06-09.json`;
  - result: `systemic_s1_mini_drama_greater_than_s0_shadow`;
  - packets: 5;
  - S1 supported for registered move: 5;
  - S0 preferred: 0;
  - unclear: 0;
  - mean deterministic score delta: 0.42.

## Next Research Unit

The controlled-positive proxy search has cleared its automated packet gate. The
next unit should still not restart human adjudication. Instead:

1. Treat `systemic_s1_mini_drama_greater_than_s0_shadow` as a bounded A19R
   proxy result only.
2. Promote a small subset of supported candidates into a preregistered
   recursive-full S0/S1 gate.
3. Keep prompt/scenario payloads paired between S0 and S1.
4. Run stability only after recursive-full headroom exists.
5. Promote nothing to A19 transfer evidence unless it later survives the normal
   A19 recursive-full S0/S1 and stability gates.

The exhaustive Step 4/5 option map is now recorded in
`notes/adaptive_2_0/a19r-step4-step5-options-2026-06-09.md`, with the
machine-readable companion
`config/teaching-drama-axioms/a19r-promotion-options.yaml`.

Option 1 was selected and implemented as A19 v0.9:
`strategy_reversal_error_spotting` / `strategy_reversal_repair`, with a
zero-API materialized scaffold at `exports/a19/materialized-attempts-v09`.
Its real attempt-1 gate blocked before S0/S1:
`recursive_dyadic_update = 0.62 < 0.7`; report:
`notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-strategy-reversal.md`.

That made option 2 warranted. The existing-schema fallback was preregistered as
`over_compliance_ethopoeia_copy_dependency` under `preserve_struggle`, with a
zero-API materialized scaffold at
`exports/a19/materialized-attempts-v09-option2`. Its real attempt-1 gate also
blocked before S0/S1: `device_specificity = 0.45`, recursive tutor-learning
scores 0.5-0.6, checker `revise_again`; report:
`notes/adaptive_2_0/2026-06-07-a19-attempt1-real-gate-report-over-compliance-ethopoeia.md`.

The subsequent automated loops are closed in
`notes/adaptive_2_0/a19-controlled-positive-search-2026-06-09.md`:

- `over_compliance_copy_import_audit` survived real attempt-1 and admitted one
  bounded axiom, but stability failed (`a`: 0/2 policy headroom; `b`: 1/2
  mixed/unstable).
- Four productive-impasse recursive variants blocked before axiom induction or
  S0/S1 escalation.
- Three public-commitment recursive variants blocked before axiom induction or
  S0/S1 escalation.
- The current resume point is not another near-neighbor card. It is either stop,
  or make a new protocol-level decision about the evidence unit.

## Achieved Automated Result

The achieved positive is systemic only inside the automated A19R contrast:
packetized mini-drama S1 arms were deterministically preferred over their
plain-language S0 shadows in all five blinded packets, after the raw judgment
was preserved and only then mapped through the private key.

This licensed only preregistered attempt-1 tests on selected candidates. Both
promoted candidates and the later automated variants failed before a stable
systemic S0/S1 difference, so it does not license recursive-full confirmation
beyond the completed v10 stability screen, human-learning, human-panel,
Paper 2.0, atlas, sidecar, deployed-tutor, model-weight-learning, or broad A19
transfer claims.

## Stop Rules

- Stop if deterministic gates fail.
- Stop if packet redaction exposes intended move, arm provenance, or hidden
  target metadata in coder-facing materials.
- Stop if proxy candidates win only by warmth, verbosity, answer leakage, or
  private-disclosure pressure.
- Stop before any human-coder task until the adjudication interface is simpler
  and the automated evidence unit is stable enough to justify the additional
  fragility.
