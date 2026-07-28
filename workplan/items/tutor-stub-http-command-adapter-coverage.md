---
id: tutor-stub-http-command-adapter-coverage
title: Widen tutor-stub HTTP slash-command coverage per command
status: triaged
type: infra
priority: P2
owner: unassigned
source: review
created: 2026-07-27
updated: 2026-07-27
verification: Each newly opened command runs over the process-backed HTTP
  transport with self-contained output and no TTY interaction, keeps its
  terminal-only side effects blocked, and has a test that fails if the
  declaration is flipped without the command behaving.
depends_on:
  - automate-browser-and-packaged-electron-tutor-stub-acceptance
links:
  code:
    - services/tutorStubCommandRegistry.js
    - services/tutorStubProcessSessionFactory.js
    - services/evalSurfaces.js
    - scripts/tutor-stub-remote.js
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/306
  items:
    - tutor-stub-remote-claude-code-driver
    - complete-tutor-stub-command-effect-metadata-before-http-comm
    - automate-browser-and-packaged-electron-tutor-stub-acceptance
tags:
  - tutor-stub
  - runtime
  - api
milestone: distribution
---

Only 3 of 65 slash commands run over the process-backed HTTP transport:
`/module`, `/next`, `/progress`. The other 62 are rejected with
`command_transport_unavailable` and reason `adapter_unavailable`.

Measured on 2026-07-27, the admitted set is the same whether the mount allows
`['persistentMutation']` or every effect key. So the effect allowlist in
`evalSurfaces.js` is not what bounds this. `evaluateTutorStubCommandTransportAdmission`
checks the registry's transport declaration first, and a command without
`noninteractiveAdapter: 'structured'` never reaches the effects check.
`tests/tutorStubRemoteDriver.test.js` pins that ordering.

## What an adapter is here

There is no per-command adapter code. When a command is admitted,
`tutorStubProcessSessionFactory.js` attaches a stdout listener, sends the RPC
step, and captures what the CLI printed. The same path serves all three.

`noninteractiveAdapter: 'structured'` is the command author's claim that the
command survives that treatment: output is self-contained text, and it finishes
without a keypress. So the work per command is to make its own output
self-contained and TTY-free, or check that it already is, then flip one field.
`processHttp` is derived from that field, not set separately.

## Why this is not a config change

Flipping the flag on a command that opens a picker does not grant access to a
working feature. The transport would capture a half-drawn menu as output and the
child would wait for keypresses that cannot arrive. Some commands may never
qualify.

The declaration is the only thing between an HTTP caller and the command, since
input is forwarded as typed. Commands needing care before anyone opens them:

- `/voice` — consent-gated microphone
- `/scenario`, `/board` — relaunch the process
- `/transcript`, `/demo` — open a browser

Take them one at a time, cheapest first (`/status`, `/help` are likely just a
check and a one-line change). Do not flip in bulk.

## Prerequisite

`automate-browser-and-packaged-electron-tutor-stub-acceptance` calls itself the
parity gate required before tutor-stub command extraction. Land that first.
