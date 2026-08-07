---
id: keep-the-repo-dotenv-out-of-the-keyless-cli-tests
title: Keep the repo .env out of the keyless CLI tests
status: done
type: infra
priority: P3
owner: claude
source: manual
verification: "node --test tests/dryRun.test.js passes in a checkout that has a
  populated .env at the root, not only in CI where there is none. Two guard
  cases stand behind that: one plants a .env in a temp directory and asserts the
  child reads nothing from it, with a control proving an unguarded child would
  read it; the other asserts an exported shell key does not reach the child.
  Deleting either half of the fix fails a guard."
claim_status: methods
created: 2026-08-07
updated: 2026-08-07
links:
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/544
  code:
    - tests/dryRun.test.js
    - tests/fixtures/empty.env
    - tests/fixtures/dotenv-probe.js
tags:
  - testing
  - tooling
milestone: evaluation-infrastructure
branch: claude/nostalgic-elion-a493d3
---

`chat fails cleanly without an OpenRouter API key` passed in CI and failed on
any machine holding real credentials. The suite reads as flaky because the
symptom is a 30-second timeout rather than anything about keys: with a key in
reach `chat` opens its readline prompt instead of exiting 1, so the run dies on
the timeout and the stderr assertion fails afterwards.

The harness spread `process.env` and then removed the four provider keys.
`scripts/eval-cli.js` imports `dotenv/config`, and dotenv fills any var *absent*
from `process.env` from `<cwd>/.env`, so removing a key invited it straight back
in. [06e90bc1] blanked the four instead of deleting them, which does stop the
refill — dotenv counts an empty string as present. That closed the reported
symptom but left the shape of the bug: the harness had to name, in advance,
every var a `.env` might carry. This repo's own `.env` declares eighteen. The
four covered names left `GOOGLE_API_KEY`, `GROQ_API_KEY`, `LEMONFOX_API_KEY`,
`GOOGLE_APPLICATION_CREDENTIALS` and the provider selectors reaching the child.

The child's dotenv now reads `tests/fixtures/empty.env`, chosen through
dotenv's own `DOTENV_CONFIG_PATH`. That neutralises the file whatever it
declares, so no list has to keep pace with it, and no production code changes —
the CLI still loads dotenv exactly as it does in a real run. The named vars are
now deleted rather than blanked, which is both safe once dotenv is looking
elsewhere and a truer stand-in for an unconfigured machine, since a blank var
still answers to a presence check.

Spawning with `cwd` set to a temp directory would also have hidden the `.env`,
but it moves the child's working directory, which several commands resolve
paths against. Pointing dotenv somewhere harmless changes only the thing at
issue.

Every case in the file shares the one helper, so all of them inherit the
isolation. `tests/eval-cli-smoke.test.js` makes a similar claim in its header
comment with no scrubbing at all, but the commands it exercises are read-only
config and DB paths that behave the same either way — noted, not changed.

Log:

- 2026-08-07 — Fixed. Full hermetic suite green with a populated `.env` present
  (root 7989 pass / 0 fail, core 137 pass / 0 fail). Removing the dotenv
  redirect fails the on-disk guard and the original chat case; removing the
  deletion loop fails the exported-key guard.
- 2026-08-07 — Merged to main in `1c0f2ac9` via PR #544. Closed.
