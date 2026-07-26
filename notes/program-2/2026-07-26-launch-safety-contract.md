# Program 2 launch safety contract

Date: 2026-07-26
Scope: future paid Program 2 dialogue cohorts launched from `scripts/run-program2-live-pilot.js`

## Why this exists

The committee floor and weights × interface sequence exposed a planning failure
that transport retries could never repair: an all-row coverage threshold of
`0.8` at turn 16 was structurally unreachable in Marrick because only four of
the six premises on its authored proof path were available by that horizon.
The best possible coverage was therefore `4/6 = 0.667`. That fact could have
been established without a model call.

The long runs also showed that a clean SHA, a balanced job matrix, and a
two-attempt retry rule are necessary but not sufficient. They protect code and
attempt provenance; they do not prove that the design can satisfy its own
completion gates or that the planned information density is attainable.

## Contract

Every paid launch through the Program 2 live-pilot launcher now requires a
certificate created before provider or Ollama preflight. The certificate is
bound to:

- the exact source SHA and canonical plan hash;
- the world and every evidence file by SHA-256;
- a zero-model structural reachability check;
- the exact-pipeline pilot, its 11-check provenance audit, and projected
  opportunity density for cohort certificates;
- explicit completion gates and a two-attempt budget;
- hard per-attempt provider-call and reserved-output-token ceilings.

`pilot` certificates deliberately precede exact-pipeline pilot evidence.
`cohort` certificates cannot skip it. A failed certificate can be written with
`--report-only` for diagnosis, but the launcher accepts only `status: pass`.

The operator-facing checklist is
[`docs/program2-launch-certificates.md`](../../docs/program2-launch-certificates.md).
The launcher also exposes `--prepare-certificate`, which writes the exact plan
without model or provider calls and prints the next certificate command. Its
`--help` output and every missing-certificate failure point back to that guide.

The underlying generic command is:

```bash
npm run program2:certify-launch -- \
  --plan-file <zero-model-plan.json> \
  --world-file <world.yaml> \
  --phase pilot|cohort \
  [--pilot-bundle <bundle.json> ...] \
  [--gate-spec-file <gates.json>] \
  --report <ignored-output-path.json>
```

A pilot bundle contains `rows`, an 11-check `audit`, and the
`expectedPlanSha256` to which that audit was bound. The gate-spec file is part
of the certificate evidence and is therefore immutable after certification.

## Runtime stop-loss

The launcher records a futility check before the first paid job and after each
terminal job. It stops only when a preregistered completion gate has become
mathematically unreachable: minimum sealed cells, complete paired blocks,
opportunity density, configured attrition balance, all-row safety/coverage when
normalized rows are supplied, cue-blind enforcement, or the attempt budget.
It never stops because the treatment effect is small or null.

The maintained Phase 5 launcher can enforce matrix, attrition, opportunity,
and attempt reachability immediately from launch state. A successor cohort
that has a cohort-specific normalized-row extractor must feed those rows to
the shared checker to activate the per-row coverage, safety, and cue-blind
branches during the run. Those branches are already tested in the shared
module; this change does not resurrect the unmerged weights × interface
runner merely to obtain its extractor.

## Branch boundary

This mainline repair intentionally excludes the historical weights × interface
runner, analyzer, preregistration, recovery state, and result roots. They depend
on a twenty-commit experiment lineage that was never merged to `main` and are
not prerequisites for the reusable guard. No active or frozen experiment
artifact is edited, and this patch makes no model calls.
