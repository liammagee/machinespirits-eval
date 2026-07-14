# Named tutor instances and tuning

The interactive tutor now treats a tutor as a versioned executable partition,
not just a model name. The repository-owned definition lives in
`config/tutor-instances.yaml`; its role prompt lives under `prompts/tutors/`.
The default is `dramatic-detective@v1`.

```bash
npm run tutor:stub -- --list-tutors
npm run tutor:stub:scaffold:mixed -- --tutor dramatic-detective
npm run tutor:stub:scaffold:mixed -- --tutor dramatic-detective@v1
```

The selected instance owns a base role prompt, policy pack, model defaults, and
version provenance. A model remains a replaceable performer inside that tutor
partition. Traces, transcript HTML, learning summaries, `/status`, and compact
response metadata record the active `tutor@version`.

## Tuning modes

Tuning is off by default and writes only to the ignored local
`.tutor-stub-tuning/` store. Set `TUTOR_STUB_TUNING_DIR` or pass
`--tuning-dir` to relocate it.

- `--tuning off`: run the current stable tutor without recording tuning data.
- `--tuning capture`: retain feedback evidence, but synthesize no candidates.
- `--tuning on`: retain evidence and compile typed negative reasons into
  bounded, reviewable candidates.
- `--tuning canary`: run the currently approved canary version.

The mode and unpinned tutor id are remembered for returning interactive
sessions. An explicit CLI or environment setting still wins.

## Feedback and promotion loop

Arrow ratings remain the quickest signal. Commands can add a typed reason and
an optional comment:

```text
/down too_abstract Uses labels instead of the objects in the scene
/down ignored_me It moved on without answering my question
/down unsupported_question I had not been shown that record
/up helpful_acknowledgement
/tune reasons
```

The reason taxonomy is executable and bounded. The comment is evidence only:
it is stored for review and never interpolated into a model prompt. Unknown
reason text becomes `custom`, which cannot compile an automatic prompt rule.

```text
/tune review
/tune show cand-...
/tune approve cand-...
/tune replay cand-...
```

Approval creates an immutable canary version but does not make it stable. The
replay artifact preserves the exact system prompt, public message prefix,
model settings, prompt hash, rated turn, and candidate overlay. Run that pinned
version or launch with `--tuning canary`, judge the result, then promote:

```text
/tune validate cand-... up Candidate replay was clearer
/tune promote cand-...
```

A down validation rejects the candidate. Promotion requires both an approved
canary and an explicit helpful validation. The current dialogue remains pinned
to the version with which it started; a promoted version is picked up on the
next run.

```text
/tune rollback
/tune rollback v1
```

Rollback moves the stable pointer to a prior immutable version and clears the
canary pointer. It does not rewrite or delete evidence, candidates, versions,
or the append-only ledger.

## Boundaries

- Public-evidence, release, safety, response-composition, and closure checks
  continue to outrank learned preferences.
- Raw learner comments never become instructions.
- Candidate rules come only from the typed reason catalog.
- Free-form `/tune note` guidance is provisional for the current session and
  is not a durable promoted rule.
- The frozen point-of-action experiment remains separate and unchanged.
- Subjective helpfulness remains distinct from objective DAG/field progress;
  tuning records make no causal learning claim.
