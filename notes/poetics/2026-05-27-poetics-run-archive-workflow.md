# Poetics Run Archive Workflow

Date: 2026-05-27

Status: durable workflow for preserving generated poetics evidence without
putting raw transcript, deliberation, sample, score, or key bulk into Git.

## Policy

Git should contain:

- source specs, scripts, tests, and notes;
- compact run manifests under `config/poetics-calibration/runs/`;
- reports that summarize a run.

Git should not contain:

- generated public samples;
- full tutor/learner/director transcripts;
- deliberation traces;
- critic score JSON;
- per-run key YAML;
- structure-critic output.

Those raw artifacts are evidence, but they are not source. Keep them in
compressed archives and back those archives up outside the repository.

## Local Package Step

Package one run:

```bash
npm run poetics:package-run -- --run-id <RUN_ID>
```

This writes:

- ignored payload: `artifacts/poetics-runs/<RUN_ID>/`
- tracked manifest: `config/poetics-calibration/runs/<RUN_ID>.manifest.json`

The manifest records:

- run id and source commit;
- archive file names;
- record counts;
- artifact-kind counts;
- SHA-256 hashes;
- missing artifact list, if any.

Commit the manifest. Do not commit the payload directory.

## GitHub Release Backup

Publish a packaged run to GitHub Release assets:

```bash
npm run poetics:publish-run -- --run-id <RUN_ID> --dry-run
```

If the dry run looks correct and the repository/storage target is acceptable:

```bash
npm run poetics:publish-run -- --run-id <RUN_ID>
```

For this repository, `gh repo view` currently reports `PUBLIC`. Because release
assets in a public repository are public, the script refuses a real upload unless
you explicitly pass:

```bash
npm run poetics:publish-run -- --run-id <RUN_ID> --allow-public
```

Use `--allow-public` only if the run's raw transcripts and deliberation traces
are safe to publish. Otherwise use a private repository, institutional object
store, encrypted local backup, or a private GitHub repo dedicated to artifacts.

## Multiple Runs

The script accepts comma-separated run ids:

```bash
npm run poetics:publish-run -- \
  --run-id phase2-adaptation-recognition-loop-20260527T105617Z-i01,phase2-adaptation-recognition-loop-20260527T105617Z-i02,phase2-adaptation-recognition-loop-20260527T105617Z-i03 \
  --dry-run
```

It creates one release per run:

```text
poetics-<RUN_ID>
```

Each release gets:

- `<RUN_ID>.tar.gz`, containing the ignored archive directory;
- `<RUN_ID>.manifest.json`, the tracked manifest.

If a release already exists, the script uploads again with `--clobber` by
default. Use `--no-clobber` to require unique asset names.

## Current Completed Loop

The completed adaptation-recognition loop from 2026-05-27 has already been
packaged locally:

- `phase2-adaptation-recognition-loop-20260527T105617Z-i01`
- `phase2-adaptation-recognition-loop-20260527T105617Z-i02`
- `phase2-adaptation-recognition-loop-20260527T105617Z-i03`

Before deleting this worktree, either publish those archives to an acceptable
remote target or copy `artifacts/poetics-runs/phase2-adaptation-recognition-loop-20260527T105617Z-*`
to durable storage.
