# tutor-core seam check (for the course-479 Tutor Lab)

2026-08-09. Question: can tutor-core be lifted out of this repo and mounted
inside the website's Express stack unchanged? **Yes.** Proven by running the
full ego/superego dialogue from a bare copy outside the repo.

## Evidence

**Imports stay inside.** Every specifier in `tutor-core/**` (tests aside) is
same-folder relative, a Node built-in, or one of its own npm packages
(`yaml`, `jsonrepair`, `better-sqlite3`). No import reaches back into the
eval repo. All filesystem roots are anchored on tutor-core's own directory
via the module URL, never on the working directory or the repo root.

**Provider SDKs are optional.** Anthropic, OpenAI, and OpenRouter calls are
plain HTTP with server-sent-event streaming — no SDK. The Google SDK
(`@google/genai`) is the only SDK reference and loads lazily, only when a
Gemini model is called. `npm install` in a bare copy succeeds with just the
three real dependencies (83 packages including dev-only vitest).

**Standalone smoke passed.** Copied `tutor-core/` to a scratch directory,
installed, registered a stub model behind the external provider hook
(`setExternalAIProviderHook`), ran `runDialogue` with the `quality` profile
and `stub.stub-model` overrides for both agents. The full loop ran: ego
draft, superego rejection, ego revision, superego approval — four calls in
order, revised suggestion delivered, converged in 2 rounds. Script:
scratchpad `seam-check/smoke.mjs` (session-local; recreate from this doc if
needed).

## What the Tutor Lab gets for free

- `runDialogue` returns `dialogueTrace`: ordered entries for the tutor
  context, the ego draft, the superego review (with approval and feedback),
  and revisions. That is the deliberation pane's data, no extra plumbing.
- `onStream` callback fires per stage (`stage`, `complete` with agent
  attached; `token` events when the provider streams). This is the live feed.
- Model overrides in dot notation (`provider.model`) work per agent, and
  `disableSuperego` plus `superegoStrategy` are already options — the lab's
  critic switch (off / advisory / adversarial) and stance switch map onto
  existing knobs plus profile choice.

## Notes for the website mount

1. **Use the built-in HTTP providers on fly.io, not the hook.** The external
   hook exists for local CLI bridges and returns whole text — no token
   streaming. tutor-core's own Anthropic/OpenRouter paths stream tokens over
   HTTP with just an API key in env. The hook stays available for local dev.
2. **Set the writable paths.** A bare run mints `data/lms.sqlite` under
   tutor-core's own directory and writes logs beside it. Set `AUTH_DB_PATH`
   (or call `initDb` with a path) and `setLogDir()` to writable locations —
   same discipline as the desktop app's path relocation.
3. **Profiles resolve from tutor-core's bundled config** (`quality`, `naive`,
   `single_agent`, `enhanced`, …). The course-479 stance set (recognition /
   placebo / enhanced / naive) needs the eval repo's prompt variants frozen
   into a profile set tutor-core can load without the eval repo's loader —
   that is the next piece of work on this card.
4. **No automated guard enforces the one-way rule.** The desktop sync
   contract test mirrors it for `desktop/`, and the config-boundary tests
   cover profile gates, but nothing fails if someone adds an eval-repo
   import to `tutor-core/**`. Worth adding the same style of test before the
   website vendoring doubles the cost of a leak.
