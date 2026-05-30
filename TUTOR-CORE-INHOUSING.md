# In-housing `@machinespirits/tutor-core`

Status: **migration complete** — commits A–D landed 2026-05-30 (`npm test` → 2753 pass / 0 fail).
The four prompts-authoritative files (`localPromptLoader`, `tutorConfigLocal`, `learnerConfigLoader`,
`learnerTutorInteractionEngine`) were flipped by a concurrent commit (260cdc6); the remaining 18
consumers + peerDependency removal by commit C. The `node_modules` copy + `package-lock.json` entry are
intentionally NOT pruned yet (rollback net) — run `npm rm @machinespirits/tutor-core` when ready. The
"Wins unlocked" follow-ups below remain open.
Owner: migration is piecemeal + atomic-commit; another agent is concurrently active on this repo.

## Why

`machinespirits-eval` was designed to *evaluate* a reusable `@machinespirits/tutor-core`
package (the Ego/Superego dialogue engine + AI provider abstraction + config loaders).
That separation taxes the active poetics/dramatic-recognition work: every experiment that
needs a new prompt, profile, or engine tweak requires a tutor-core **release + reinstall**
before it can run through the real dialogue engine. Evidence the team already feels this:

- `services/localPromptLoader.js` — a "local-first" prompt loader written specifically because
  tutor-core resolves prompts against *its own* bundled `prompts/`, so an eval-repo prompt edit
  "would never load — the active text silently came from `node_modules/...`. That cost us real time."
- `services/tutorConfigLocal.js` — a wrapper that re-routes agent prompt text through the eval-first loader.
- `resolveEvalProfile()` has a published-vs-dev **existence-check fallback**: cells 95/96
  (`matched_pedagogical` / `matched_behaviorist`) target tutor-core profiles that exist only in the
  *dev build*, so a published install silently degrades them to `budget` (see `tests/regression-bug-007.test.js`).

In-housing the code removes the release-cycle tax: prompts, profiles, and engine internals become
directly editable in this repo.

## What was found (coupling surface)

Consumed from `@machinespirits/tutor-core` (32 import sites across ~15 files): `tutorDialogueEngine`,
`tutorApiService`, `tutorConfigLoader`, `unifiedAIProvider`, `configLoaderBase`, `modelResolver`,
`dialecticalEngine`, `memoryDynamicsService`, `monitoringService`, plus convenience re-exports
(`callAI`, `_fetchProvider`, `isContextOverflowError`, `truncateForContextOverflow`, `setLogDir`,
`setQuietMode`). Only `/services/*` subpaths and the top-level barrel are imported — **never**
tutor-core's `/config` or `/prompts` subpaths.

- **19 services, ~12k LOC**, one tightly-coupled cluster (everything funnels through
  `tutorDialogueEngine` ← `dialecticalEngine`/`writingPadService`/`aiService`/`dbService`). Partial
  vendor is not viable — it is the whole `services/` tree or nothing.
- External runtime deps inside tutor-core: only `better-sqlite3`, `jsonrepair`, `yaml` (all already
  in this repo) + node builtins. AI SDKs (`@anthropic-ai/sdk` present; `@google/genai`, `openai`
  absent) are optional peers loaded dynamically.
- **Path resolution**: `configLoaderBase` computes `CONFIG_DIR`/`PROMPTS_DIR` as
  `path.resolve(<its own services dir>, '..')` — no env override. tutor-core always reads its **own
  bundled** `config/tutor-agents.yaml` (1774-line base profiles) and `prompts/` (48 files). The eval
  repo keeps its **own richer** `config/tutor-agents.yaml` (5862 lines, cells 1–125) and `prompts/`
  (57 files), and `evaluationRunner.resolveEvalProfile()` remaps eval cell names onto tutor-core base
  profiles. **This relationship is preserved by the migration.**
- **Stateful singletons**: `dbService` (one `better-sqlite3` handle), prompt/config caches,
  `setLogDir`/`setQuietMode` globals. ⇒ the consumer flip must be **atomic** (see commit C).
- **Runtime artifacts** in the install (`data/lms.sqlite`, `logs/tutor-api/*.jsonl`) are NOT vendored;
  `dbService.getDb()` `mkdir`s its data dir on first use, so a fresh `tutor-core/data/lms.sqlite` is
  created on demand.

## Approach

Vendor the **installed 0.5.2** tree (what currently runs — byte-identical behaviour, tests stay green)
into a first-class in-repo module `tutor-core/`, then rewrite every `@machinespirits/tutor-core`
import specifier to a relative path into it. Take 0.5.2, not the sibling-source 0.5.3, so the migration
is pure motion with zero behaviour delta; the 0.5.3 niceties become trivial follow-ups (below).

`tutor-core/` mirrors the upstream package layout (`index.js`, `services/`, `config/`, `prompts/`,
`migrations/`, `package.json`) precisely so its relative internal imports and `__dirname`-based path
resolution keep working unchanged.

## Commit sequence (piecemeal, each leaves the repo green)

- **A** — add this plan doc. (pure doc)
- **B** — vendor `tutor-core/` (code only: `index.js`, `package.json`, `services/`, `config/`,
  `prompts/`, `migrations/`; **exclude** `data/`, `logs/`). Add `tutor-core/` to eslint + prettier
  ignores; add `tutor-core/data/` + `tutor-core/logs/` to `.gitignore`. Purely additive — nothing
  imports it yet, behaviour unchanged.
- **C** — **atomic flip**: rewrite all `@machinespirits/tutor-core` specifiers → relative
  `../tutor-core/...` (depth-adjusted); remove the `@machinespirits/tutor-core` peerDependency; point
  the two provenance/version probes (`scripts/eval-cli.js`, `scripts/audit-message-chain.js`) at the
  vendored `tutor-core/` first. Verified with `npm test`.
- **D** — docs: update `CLAUDE.md` (+ `AGENTS.md`/`GEMINI.md` if they reference the package).

Not done by this migration (intentionally): deleting `node_modules/@machinespirits/tutor-core`,
running `npm install`/`npm rm`, editing `package-lock.json`, or pushing. The stale install is left as
a rollback safety net; prune it later with `npm rm @machinespirits/tutor-core`.

## Rollback

`git revert` commits C→A (or `git checkout` the pre-migration ref). `node_modules/@machinespirits/tutor-core`
is retained, so reverting the import flip restores the previous resolution immediately.

## Residual `node_modules` ties (after commit E)

The eval **runtime + full test suite have zero dependence** on
`node_modules/@machinespirits/tutor-core` — verified by hiding the install and running the
suite (2769 pass / 0 fail). Commit E swept up the path-form references the bare-specifier grep
missed (`routes/chatRoutes.js`, `scripts/prompt-lab.js`, `tests/promptVersioning.test.js`, and
the `scripts/analyze-a7-*` DB paths). Two *intentional* residuals remain, both harmless until
the eventual `npm rm`:

- **Graceful fallbacks**, not hard deps: the two prompt-existence probes (`eval-cli`,
  `audit-message-chain`) still `try`/`resolve('@machinespirits/tutor-core/package.json')` *after*
  the vendored dir, and the `analyze-a7-*` scripts default to the node_modules DB but now honor
  `AUTH_DB_PATH`.
- **Writing-pad DB**: tutor-core's `data/lms.sqlite` holds *historical* A7 writing-pad data and is
  runtime state (never vendored — `data/` is gitignored). Post-migration, live runs write to
  `tutor-core/data/lms.sqlite`; the history stays in `node_modules/.../data/lms.sqlite`. **Before
  pruning node_modules**, archive that file (e.g. `cp node_modules/@machinespirits/tutor-core/data/lms.sqlite
  data/tutor-core-writingpad-archive.sqlite`) and point the a7 scripts at it via `AUTH_DB_PATH` if
  those analyses must stay reproducible.

## Wins unlocked (follow-ups — NOT part of the behaviour-preserving migration)

1. **Edit tutor-core prompts/profiles in-repo** with no release cycle.
2. **Unblock cells 95/96**: add the `matched_pedagogical`/`matched_behaviorist` base profiles (from
   0.5.3) to `tutor-core/config/tutor-agents.yaml`; `resolveEvalProfile`'s existence check then routes
   them correctly instead of degrading to `budget`.
3. **Retire the dual-prompt-dir hack**: point `configLoaderBase.PROMPTS_DIR` at the eval repo's
   `prompts/` (or unify the two dirs) and `localPromptLoader.js` / `tutorConfigLocal.js` can collapse.
4. Pull the remaining 0.5.2→0.5.3 delta (UTC consolidation fix, coupling/dialectical-directive prompts)
   if desired.

Each is a behaviour change → its own commit, gated on the paper/experiment owner, not bundled here.

## Externalization note (keeping `tutor-core/` re-extractable)

The vendored module is a **clean seam** — keep it that way so it can be re-published later if reuse
returns:

- **Public API = `tutor-core/index.js`** (the barrel). Consumers should import the barrel or documented
  `tutor-core/services/*` subpaths only — do not reach into private internals.
- **No reverse imports**: `tutor-core/**` must never import from the eval repo's `services/`,
  `scripts/`, `config/`, or `prompts/`. The dependency arrow points one way (eval → tutor-core). The
  one eval-owned override (`localPromptLoader`) lives on the eval side and *wraps* tutor-core, never
  the reverse. Audit before extraction: `grep -rn "\.\./\(services\|scripts\|config\|prompts\)" tutor-core/`.
- **Internal imports stay relative** (`./x.js`) and **path resolution stays `import.meta.url`-relative**
  — both already hold and make the directory relocatable.
- **Config/prompt ownership boundary**: tutor-core owns base profiles + base prompts under
  `tutor-core/config` + `tutor-core/prompts`; the eval layer owns cells 1–125 + experiment prompts and
  remaps via `resolveEvalProfile`. Preserve this split (don't migrate eval-specific cells into
  `tutor-core/config`).
- **Deps**: `tutor-core/package.json` already declares its own runtime deps + optional AI-SDK peers, so
  re-extraction is `cp -R tutor-core/ ../machinespirits-tutor-core-next/ && npm publish`.

Re-extraction cost is essentially: republish `tutor-core/`, re-add the peerDependency, and reverse the
relative specifiers back to `@machinespirits/tutor-core`.
