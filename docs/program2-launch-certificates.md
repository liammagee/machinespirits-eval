# Program 2 paid-launch checklist

Every paid Program 2 launch needs a **fresh launch certificate**. Do not copy a
certificate from an earlier launch. It is bound to the exact source commit,
plan, world, gates, pilot evidence, and provider budget; changing any of those
inputs requires another certificate.

## 1. Prepare the exact plan

Work from the final clean checkout and use the same plan and output directory
that the paid launch will use:

```bash
node scripts/run-program2-live-pilot.js \
  --prepare-certificate \
  --plan 5 \
  --output-dir exports/<program2-run>
```

This is a zero-model operation. It writes `launch-plan.json` and prints the
exact certificate command for that plan. Use `--plan 5b` or `--plan 5c` when
appropriate.

## 2. Generate and inspect the certificate

Run the emitted `npm run program2:certify-launch` command. Cohort certificates
also require the audited exact-pipeline pilot bundle and frozen gate file. A
valid result prints `PASS`; a diagnostic `--report-only` result is not accepted
by the paid launcher.

Check the reported static reachability, pilot completeness, opportunity power,
attempt ceiling, provider-call ceiling, and reserved-output-token ceiling
before proceeding.

## 3. Launch with the certificate

Rerun the launcher with the same `--plan` and `--output-dir`, plus:

```text
--launch-approved --expected-sha <clean-40-character-sha> \
--launch-certificate exports/<program2-run>/launch-certificate.json
```

The launcher validates the certificate before Ollama or provider preflight.
Missing, stale, hash-mismatched, incomplete, or failed certificates stop the
launch without a paid call.

## When to regenerate

Generate a new certificate before every paid launch, and always after changing
the checkout SHA, plan, output directory, world, gate specification, pilot
bundle, or any other bound evidence file. Preparing a plan or certificate never
authorizes a paid launch by itself.

The rationale and full safety contract are in
[`notes/program-2/2026-07-26-launch-safety-contract.md`](../notes/program-2/2026-07-26-launch-safety-contract.md).
