---
id: tutor-stub-remote-claude-code-driver
title: Drive tutor-stub sessions from Claude Code remote sessions
status: done
type: infra
priority: P2
owner: claude
source: manual
created: 2026-07-25
updated: 2026-07-25
verification: "A non-interactive host boots the server on demand, opens a
  tutor-stub session against the Claude Code CLI bridge with no API key present,
  exchanges learner turns, reads status and transcript, and finalizes; unit
  tests cover argument parsing, the model default, specification whitelisting,
  dialogue extraction and the session pointer."
branch: claude/tudor-stub-cli-remote-afplmq
depends_on:
  - tutor-stub-headless-session-transport
links:
  code:
    - scripts/tutor-stub-remote.js
    - .claude/skills/ms-tutor-remote/SKILL.md
    - tests/tutorStubRemoteDriver.test.js
  items:
    - tutor-stub-headless-session-transport
    - tutor-stub-unified-session-surface
tags:
  - tutor-stub
  - runtime
  - api
  - dx
milestone: distribution
---

Make the existing headless session transport usable from a host with no TTY —
specifically Claude Code on the web and mobile, where the tutor-stub CLI cannot
be run interactively but a persistent child process can be driven one shell
command at a time.

No new tutor plumbing. `scripts/tutor-stub-remote.js` is a client for the
`/api/tutor-stub` transport that adds the two things a shell-driven caller
cannot keep in its head between commands: the server process and the current
session id. `/ms-tutor-remote` turns that into a chat loop where the user is the
learner and the model relays turns verbatim.

The enabling detail is the model default. A cloud container has no
`OPENROUTER_API_KEY`, but Claude Code ships an authenticated `claude` binary on
PATH and `services/cliProviderBridge.js` already speaks to it, so the driver
defaults to `claude-code.sonnet-5`. The catalog default (`codex.gpt-5.6-terra`)
resolves to a CLI that is not present there.

## Known boundary

Slash commands stay unavailable: the process-backed transport rejects
`{"kind":"command"}` with `command_transport_unavailable`. The effect-metadata
prerequisite is already satisfied by
`complete-tutor-stub-command-effect-metadata-before-http-comm`, so unblocking a
safe subset is a separate, deliberate transport decision — not something this
driver should route around.

## Progress

- 2026-07-25: Verified the existing transport end-to-end from a remote session
  (real dialogue turn on `world_001_nocturne` via the CLI bridge, no API keys),
  then added the driver, the skill, unit tests, and the `tutor:stub:remote`
  script.
