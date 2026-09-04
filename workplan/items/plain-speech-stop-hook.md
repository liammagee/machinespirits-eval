---
id: plain-speech-stop-hook
title: Stop hook that blocks a reply which breaks the style rule
status: review
type: infra
priority: P1
owner: claude
source: manual
created: 2026-09-03
updated: 2026-09-03
branch: claude/plain-speech-stop-hook
verification: "tests/plainSpeechStopHook.test.js passes; the hook blocks a reply with a coined label or a motto once, then lets the rewrite through; a clean reply passes without output."
links:
  notes:
    - .claude/style-rule.md
    - .claude/settings.json
    - scripts/plain-speech-stop-hook.js
    - tests/plainSpeechStopHook.test.js
tags:
  - tooling
  - claude
  - style
---

The style rule in `.claude/style-rule.md` is injected on every turn, but the
reply still drifted back to mottos, coined labels ("the archive gap"),
borrowed jargon ("load-bearing", "bit-rot") and dashes. An input-side rule
does not check the output.

This card adds a `Stop` hook. It reads the last assistant reply from the
session transcript and checks it for: banned words and phrases, Latinate
words with a plain replacement, dashes and arrows, sentences over 35 words,
two or more parentheticals in one sentence, "X is A, not B" mottos, coined
labels and hyphenated compounds that do not appear in the repo, headers in a
short reply, and a long reply to a short question. Terms the user typed are
exempt. Code spans and fences are stripped first.

On a finding the hook blocks once with the list of quotes to fix. On the
retry (`stop_hook_active`) it stays silent, so there is exactly one rewrite
pass. It fails open on any error. Manual modes: `--check-file <path>` and
`--check-transcript <path>`.

Hooks load at session start, so the check is live from the next session.

## Log

- 2026-09-03: hook, ten tests, settings entry, manifest update. Checked on
  two real replies from this session (5 and 7 findings) and on a clean recap.
