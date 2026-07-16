# Codex CLI speaking-transport audit

Date: 2026-07-17  
Installed CLI: `codex-cli 0.144.1`  
Scope: read-only inspection; no model calls

The installed `codex exec` surface has no documented universal
`--speaker-only`, `--no-tools`, or empty-tools option. It supports read-only
sandboxing, ephemeral sessions, ignored user configuration, ignored execpolicy
rules, structured output, and JSONL event reporting. Those controls isolate and
observe the call; they do not remove every agent tool.

The existing bridge already uses a fresh temporary working directory,
`--ephemeral`, `--ignore-user-config`, `--ignore-rules`, and a read-only
sandbox. Project or user instructions therefore must not be named as the cause
of the remaining input-token residual. The user's preliminary estimate put the
difference at roughly 12,250 tokens. The new sectioned UTF-16-chars/4 heuristic
measures 4,930 authored tokens against 16,246 provider-observed input tokens,
giving an inferred residual of 11,316 tokens. This is recorded as a Codex
agent/runtime transport residual, not as directly observed project overhead.

`codex --disable shell_tool --disable unified_exec` is supported and disables
those named feature families, but it does not disable every other Codex tool.
It is therefore not represented as a universal no-tools mode. The
model-specific Codex CLI verification path remains unchanged.

For cheap development screening, frozen replay now has an optional direct
provider override. It uses the same authored system prompt and public message
chain, invokes no learner, classifier, DAG, repair, fallback, or continuation,
and is explicitly marked non-equivalent and ineligible for Codex CLI or
held-out acceptance. No direct Terra/Sol endpoint is configured; a direct
provider draw is cross-model diagnostic evidence only. Missing credentials
fail before generation.
