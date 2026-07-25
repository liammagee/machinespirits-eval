---
name: ms-tutor-remote
description: Play a real tutor-stub session from chat — including Claude Code on the web or mobile, where there is no terminal. You are the learner; Claude relays each turn to the actual tutor-stub CLI running headlessly. Use to sit a tutoring drama from a phone, demo a world, or feel a tutor's behaviour without a TTY.
argument-hint: "[world id or description, e.g. world_001_nocturne | --lab mixed_drafting | --model claude-code.opus]"
allowed-tools: Bash, Read
---

The user wants to **be the learner** in a live tutor-stub session. You are the
relay, not the tutor: every tutor line comes from the real CLI, never from you.

The session is the actual `scripts/tutor-stub.js --session-rpc` process behind
the `/api/tutor-stub` transport. `scripts/tutor-stub-remote.js` boots the server
on demand and remembers the session id, so each turn is one Bash call.

## 1. Pick the scene

Parse `$ARGUMENTS` for a world id, `--lab`, `--tutor`, or `--model`. If the user
described a scene instead of naming one ("something with a missing manuscript"),
list the catalog and choose a plausible match, saying which you picked:

```bash
node scripts/tutor-stub-remote.js worlds
```

Defaults that need no argument: lab `pure_chat`, tutor `dramatic-detective@v1`,
model `claude-code.sonnet-5`.

**Do not change the model default without being asked.** It routes through the
Claude Code CLI bridge, which is the only provider guaranteed to have
credentials in a cloud container. Catalog defaults point at `codex.*`, which
will fail there.

If the container is fresh, `npm ci` first — the driver cannot boot a server
without dependencies installed.

## 2. Open the session

```bash
node scripts/tutor-stub-remote.js start --world world_001_nocturne
```

First run also boots the server (a few seconds). Print the scene one-liner it
returns, then **deliver the first tutor turn if there is one and stop.** If the
session opens with no tutor line, invite the user to speak first.

## 3. The turn loop

For every learner message the user writes:

```bash
node scripts/tutor-stub-remote.js say "<the user's exact words>"
```

Then relay the tutor's reply **verbatim** and wait. Rules that matter:

- **Never write the learner's lines.** The user is the learner. If their message
  is ambiguous ("ok go on"), pass it through — a real learner says that too.
- **Never write, improve, or summarise the tutor's lines.** Relay them as
  returned. If a turn is long, it is long; that is the tutor's register.
- **One turn per user message.** Do not run several `say` calls to move the
  drama forward on the user's behalf.
- Turns take real time — the call crosses the transport, the RPC child, and a
  bridged model call. Do not treat a slow turn as a failure.

Anything the user types that is clearly stage direction to *you* rather than
speech to the tutor ("what's happening here?", "who am I playing?") — answer it
yourself, out of character, without spending a turn.

## 4. Close out

```bash
node scripts/tutor-stub-remote.js end
```

Add `--stop-server` if the user is finished with tutor-stub entirely. Offer
`transcript` if they want the whole dialogue printed, or `status` for turn
counters.

## What this surface cannot do

Say so plainly if the user reaches for it — do not fake it:

- **No slash commands.** The process-backed HTTP transport rejects
  `{"kind":"command"}` with `command_transport_unavailable`, by design. So no
  `/mode`, `/lab`, `/suggest`, `/character`, `/register`. Changing lab or world
  means ending the session and starting a new one.
- **No terminal presentation.** No ghost-text drafts, Tab completion, pickers,
  or the masthead — those live in the TUI this transport deliberately bypasses.
- Each turn is a billed model call through the CLI bridge. Mention this once if
  the user settles in for a long session; do not nag.
