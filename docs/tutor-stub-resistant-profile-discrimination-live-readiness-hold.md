# Resistant Learner Profile Discrimination — Live Readiness HOLD

**Prepared:** 19 August 2026.
**Status:** **HOLD. The one-call route canary passed; no live study is authorized.**
**Workplan item:** `resistance-action-register-integration`.

The machine-readable authority for this note is
`config/tutor-stub-resistant-profile-discrimination-live-readiness.hold.v1.json`.
The zero-call checker is:

```bash
npm run tutor:stub:resistant-profile-live-readiness
```

It validates the frozen registration and protected-profile hashes, sends a
full-scale 18-dialogue synthetic corpus through the production discrimination
analyzer, verifies all three registered endpoints, reconstructs the proposed
live and analysis commands, and confirms that the fresh destination does not
exist. The checker itself makes zero model calls and zero production writes;
it separately validates the one recorded route-canary call below.

The bounded route-canary request is at
`config/tutor-stub-resistant-profile-route-canary-request.v1.json`. Its default
command is also zero-call and zero-write:

```bash
npm run tutor:stub:resistant-profile-route-canary -- --json
```

The request pins the final HOLD bytes, route executable, shared CLI bridge,
model resolver, provider configuration, and frozen registration. It covers the
single `codex.gpt-5.6-luna` CLI route shared by the tutor, analysis, and learner
roles, with low effort, structured output, a hard ceiling of one call, and no
retry or resume authority. The separately committed authorization was consumed
by exactly one call. Its approved bytes are preserved only inside
`config/tutor-stub-resistant-profile-route-canary-authorization.consumed.v1.json`;
the executable authorization path is absent at HEAD, so a fresh clone cannot
reuse it. The consumed record has SHA-256
`1ec23bf81df7678050e5383fbda9ab913979b9b93b24fb1944b59002c6eeefb2`
and does not authorize the study.

The committed result is
`config/tutor-stub-resistant-profile-route-canary-result.v1.json`; it pins the
ignored execution artifact at SHA-256
`a2989dfb48438b7153928244a20ef42f698122b6edb3062fdfecca41ca1ac55f`.
The promoted config record itself has SHA-256
`c68ee936441504fdb514f97537aaf87915c734b43da82f7d81136c40c6918623`.
It records a passing `codex` / `gpt-5.6-luna` route at low effort, structured
output, zero prohibited tool events, and Codex CLI `0.147.0`. Its attestation
basis is explicitly limited: the CLI model argument was accepted and echoed by
the bridge; server-side model identity was not independently attested.

## What is ready

- The registration remains byte-pinned at
  `e6581e6cbfe9589b825589318c2b5b523b03ef1b8587ec31fec5b87ff69249ac`.
- The endpoint contract makes the pooled discrimination gate, bored contract
  gate, and frame-defiant contract gate co-primary. Disabling the analyzer,
  public-marker channel, or learner-contract channel makes preflight fail.
- Six profile-preserving packets cover exactly 18 synthetic dialogues. The
  production analyzer completes every endpoint with no model call and no write
  to a live artifact or evaluation database.
- The proposed live command is exactly the frozen six-profile, `field`-only,
  safe-palette, strict-DAG plan: three repeats per profile, eight turns,
  `codex.gpt-5.6-luna` in all three model roles, 48 attempts per dialogue, 864
  maximum planned attempts, and parallelism three.
- The live artifact root is fixed to
  `.tutor-stub-auto-eval/resistant-profile-discrimination-v1-live-2026-08-19`.
  It is create-once and does not currently exist. The run ledger is enabled;
  optional HTML, generic QA analysis, and memory-summary outputs stay disabled
  to keep the artifact surface bounded.
- The payload is repository-authored world, prompt, classifier, and automated
  dialogue material only. It contains no human-subject or private-archive data,
  so training-reuse status is `not_applicable`.

The committed `endpoint_runtime_go` certificate means only that the registered
endpoints are executable at their full scale. It is not a study GO note and
cannot authorize spend.

## What still blocks launch

1. Select the exact clean `origin/main` commit from which the study would run.
   The preparation base
   `8de5787f95995c12d657f07dcaedaca66205efe7` is recorded for provenance but is
   not a launch SHA.
2. Write and commit a study-specific GO note binding the registration digest,
   endpoint contract and preflight digests, route artifact, exact launch SHA,
   artifact destination, payload scope, and 864-attempt ceiling.
3. Obtain explicit human approval for that exact GO note and spend.

Until all three steps are satisfied, do not run the `proposedCommands.live`
array in the machine packet. A technical failure after authorization stops the
run; it does not license a resume or retry. Any retry needs review and a new
sealed artifact root. The existing `low_agency` and `overconfident` results
remain read-only throughout.
