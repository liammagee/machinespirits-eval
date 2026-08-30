# Codex Project Skills

This repository's canonical Codex skill root is `.agents/skills/`. Do not add a
second copy under `.codex/skills`: Codex discovers duplicate names separately
rather than merging them, which creates ambiguous activation and drift.

This convention follows OpenAI's current [Build skills](https://learn.chatgpt.com/docs/build-skills)
and [plugin skills](https://developers.openai.com/plugins/build/skills) guidance.

## Skill shape

Each skill is one directory with a required `SKILL.md`:

```text
.agents/skills/<skill-name>/
├── SKILL.md
├── agents/openai.yaml     # optional UI metadata
├── references/           # optional, loaded only when needed
├── scripts/              # optional maintained helpers
└── assets/               # optional templates or static inputs
```

The `SKILL.md` frontmatter accepts only:

- `name` (required, lowercase letters/digits/hyphens, matching the directory);
- `description` (required);
- `license`;
- `allowed-tools` (not permitted by this repository's normal permission-flow
  policy); and
- `metadata`.

Legacy `argument-hint`, `disable-model-invocation`, and `$ARGUMENTS` conventions
are not supported. Invocation policy and UI text belong in
`agents/openai.yaml` when genuinely needed.

## Writing rules

- Give each skill one focused job.
- Front-load the description with the positive trigger, then the closest
  negative boundary or sibling skill.
- Write imperative steps with explicit inputs, outputs, authority checks, and
  stop conditions.
- Keep volatile catalogs, historical examples, and long method notes out of the
  entrypoint. Put needed detail in `references/` and link it from the exact mode
  that needs it.
- Prefer maintained repository scripts and live registries over pasted code,
  static cell ranges, model aliases, section maps, or schema snapshots.
- Distinguish read-only work, derived file writes, DB writes, external changes,
  and model/provider calls. Loading a skill never grants authority for the next
  class of action.
- Never claim a requested call/spend ceiling is enforced when the runtime lacks
  a fail-before-call hard stop. Narrow the skill to dry-run, mock, or inspection
  until the runtime is hardened.
- Preserve sealed historical evidence and current user work. Record code
  provenance; do not bind study authority to source-file digests.

## UI metadata

Use `agents/openai.yaml` only when the skill benefits from a display label,
short description, starter prompt, icon, or invocation policy. Quote strings.
`interface.default_prompt` must be one sentence that explicitly names the skill
as `$skill-name`. Keep `short_description` between 25 and 64 characters.

## Validation

Run from the repository root:

```bash
npm run skills:list
npm run skills:check
node scripts/sync-agent-skills.js check-permissions
node --test tests/skillSync.test.js
```

`skills:check` validates deliberate mirrors and every canonical Codex
entrypoint's YAML, allowed keys, name/directory match, duplicate name, required
description, and absence of `$ARGUMENTS`.

Also run the bundled skill-creator `quick_validate.py` against every canonical
skill when its Python/YAML runtime is available.

## Activation review

Before merging a new or materially changed skill, exercise representative
prompts without provider calls:

| Case | What to verify |
|---|---|
| Direct | An explicit `$skill-name` request loads the intended workflow. |
| Indirect | A natural request matching the description activates it. |
| Incomplete | Missing material input leads to one concise question or a safe default. |
| Negative | A neighboring task routes to the named sibling skill or ordinary handling. |
| Safety edge | Paid, destructive, external, or ambiguous action stops at the immediate authority boundary. |
| Freshness edge | The skill discovers live cells, schemas, models, sections, or artifacts rather than trusting a static example. |

Record substantive skill refreshes on the workplan and preserve retired long
workflows under `references/legacy-*.md` when they remain useful history. Mark
them clearly as non-executable.
