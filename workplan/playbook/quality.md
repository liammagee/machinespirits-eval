# Quality — QA, testing, verifiability

The project's credibility rests on results that can be re-derived and claims that
don't quietly drift. This is what the board exists to enforce: **every item says
how it will prove it's done, and that proof has to pass before `done`.**

## Verification, per item
The `verification` frontmatter field is required. It is the check that flips the
item to `done` — not "I wrote it" but "here is what shows it works":
- infra / maintenance → a test passes, lint is clean, a command runs green.
- experiment / research → the analysis script runs, the report lands in
  `exports/`, the claim is registered in provable-discourse.
- paper → version bumped, revision-history line added, claims machine-checked,
  N-counts validated.

## Testing
- `npm test` — full suite. `npm run test:hermetic` — isolated tmp DB + logs so
  the production DB/logs are never touched; use it for anything DB-adjacent.
- Add a test when you add a service, or a script with real logic. Co-locate unit
  tests in `services/__tests__/`; integration/CLI tests in `tests/`.
- `npm run lint` and `npm run format` before review.

## Verifiability backbone (already in the repo — use it)
- **provable-discourse** (`npm run paper:provable-discourse:all`) machine-checks
  every registered paper claim against the data and flags stale claims.
- **provenance** — `npm run provenance:validate`, `npm run audit:message-chain`,
  and the config/dialogue/prompt hashes (`evalSignature.js`) catch drift between
  runs that should match.
- **Reproducibility** — record run IDs in `links.runs` and Appendix D. `eval
  --force` only fills NULL scores; `rejudge` produces cross-judge paired data.

## Guardrails that have bitten us
- **Closed-loop evaluation.** Don't let the architecture under test also score
  itself. Require an architecture-independent scoring channel and verify findings
  from the artifact JSON, not the runner's own summary. Self-flattering
  "architecture beats baseline" claims are the failure mode.
- **Pre-register the kill gate.** For paid arcs, freeze the threshold and
  decision rule offline before computing the number, so it can't be revised post
  hoc. No add-a-metric-and-rerun until something passes.
- **Budget before big paid runs.** The cost tracker is not the only ceiling —
  account-level credits can run out mid-run and bias attrition. Probe first;
  prefer attended, checkpointed, pausable runs for quota-bound work.
- **Mock by default for smoke.** Adaptive/derivation smoke runs go through
  mock-LLM + hermetic paths so they cost nothing and touch no prod state. Note
  that `eval-cli --dry-run` still writes the prod DB — use the smoke scripts.
