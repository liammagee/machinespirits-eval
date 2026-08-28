---
name: ms-tutor-remote
description: Inspect or close a headless tutor-stub remote session from chat. Do not relay learner turns until tutor-stub-remote supports stdin or a message-file input; interpolating arbitrary user text into a shell command is unsafe. Use ms-play-tutor for a simulated chat-only roleplay meanwhile.
---

This skill's turn-relay path is temporarily on hold. The current remote driver
accepts learner text only as a command-line positional argument. The available
shell surface cannot safely transport arbitrary quotes, backticks, or command
substitutions from user text without interpolation risk.

Do not start a new live session or send a learner turn from this skill. Safe
read-only/control uses for an already known session are `worlds`, `status`,
`transcript`, and an explicitly requested `end`.

The session is the actual `scripts/tutor-stub.js --session-rpc` process behind
the `/api/tutor-stub` transport. `scripts/tutor-stub-remote.js` boots the server
on demand and remembers the session id, so each turn is one Bash call.

## 1. Pick the scene

Read the user's request for a world id, `--lab`, `--tutor`, or `--model`. If the user
described a scene instead of naming one ("something with a missing manuscript"),
list the catalog and choose a plausible match, saying which you picked:

```bash
node scripts/tutor-stub-remote.js worlds
```

The historical default is lab `pure_chat`, tutor `dramatic-detective@v1`, model
`claude-code.sonnet-5`, but no credential or route is guaranteed. Inspect the
catalog and preflight the explicitly selected route before any future live use.
Never install dependencies automatically; report missing dependencies and ask.

## 2. Opening a session is currently blocked

```bash
# Do not run until the safe learner-message transport is implemented.
```

First run also boots the server (a few seconds). Print the scene one-liner it
returns, then **deliver the first tutor turn if there is one and stop.** If the
session opens with no tutor line, invite the user to speak first.

## 3. The turn loop

Do not interpolate learner text into this historical command:

```bash
node scripts/tutor-stub-remote.js say "<unsafe-shell-interpolation>"
```

This remains blocked until the driver accepts stdin or `--message-file` and the
skill can pass bytes without shell evaluation. Once implemented, relay the
tutor's reply verbatim and preserve one user message → one tutor turn.

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

- **Almost no slash commands.** Only commands with a structured non-interactive
  adapter run here. Check with `node scripts/tutor-stub-remote.js cmd --list`
  rather than guessing — today it is the curriculum-navigation set (`/module`,
  `/next`, `/progress`), usable via `cmd /progress`. Everything else, including
  `/help`, `/mode`, `/lab`, `/suggest`, returns `command_transport_unavailable`
  (`adapter_unavailable`). Changing lab or world means ending the session and
  starting a new one.
- **No terminal presentation.** No ghost-text drafts, Tab completion, pickers,
  or the masthead — those live in the TUI this transport deliberately bypasses.
- Each turn is a billed model call through the CLI bridge. Mention this once if
  the user settles in for a long session; do not nag.
