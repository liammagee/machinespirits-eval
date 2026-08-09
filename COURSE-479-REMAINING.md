# Course 479 — remaining steps, in order

State as of 2026-08-09. Two branches exist and neither is merged:

- **Eval repo**: branch `course-479-externalization` (worktree
  `../ms-course-479`), 6 commits ahead of main. Plan, seam check, frozen
  profiles, presets, transcript generator, guard tests.
- **Website repo**: branch `tutor-lab` (worktree `../ms-website-tutor-lab`),
  2 commits ahead of main. Vendored engine, lab route + page, deploy setup.
  **Merging this one triggers the fly.io deploy** — set secrets first.
- **Content repo**: nothing started; no branch needed (it commits to master
  directly via `./publish`).

## 1. Merge the eval branch (safe any time)

```bash
cd ../ms-course-479 && git push -u origin course-479-externalization
```

Open the PR with `Workplan item: course-479-externalization` in the body.
CI expectations: hermetic tests (three new test files are in the manifest),
lint, and the commit-trailer check (every commit carries the trailer).

## 2. Set the fly secrets (before the website merge)

```bash
claude setup-token
```

```bash
flyctl secrets set CLAUDE_CODE_OAUTH_TOKEN=<token-from-above> --app my-website-dtq0ia
```

```bash
flyctl secrets set TUTOR_LAB_CLASS_KEY=<phrase-for-students> --app my-website-dtq0ia
```

```bash
flyctl secrets set ANTHROPIC_API_KEY=<key> --app my-website-dtq0ia
```

The last one powers the quota-dry fallback; skip it to run CLI-only.

## 3. Merge the website branch (this deploys)

```bash
cd ../ms-website-tutor-lab && git push -u origin tutor-lab
```

Open the PR with `Workplan item: course-479-tutor-lab` in the body; merge.
GitHub Actions builds the image (the build fails loudly if the CLI install
breaks on the alpine base — if it fails at `codex --version`, drop codex
from the Dockerfile install line and go claude-only) and deploys.

## 4. Verify the deployed lab

```bash
curl -s https://machinespirits.org/api/tutor-lab/presets | head -c 200
```

Open https://machinespirits.org/tutor-lab, enter the class key, run one
turn. Check the right pane shows draft / critique / revision and the
network response says `"servedBy": "claude-code.sonnet"`.

## 5. Optional: codex as a second serving path

```bash
flyctl ssh console --app my-website-dtq0ia -C "codex login"
```

Credentials persist on the volume. Switch with `TUTOR_LAB_MODEL` in
fly.toml when wanted.

## 6. One deployed load check (spends quota — once, before day 1)

```bash
node scripts/tutor-lab-load-check.mjs --base https://machinespirits.org --key <classkey> --students 12 --turns 2
```

Run from `../ms-website-tutor-lab`. Real turns take 1–3 minutes each. If
too many students queue behind the in-flight cap (default 6), raise
`TUTOR_LAB_MAX_INFLIGHT` in fly.toml — watch the single shared CPU.

## 7. Content repo: the course page (last build step)

In `../machinespirits-content-philosophy`:

- Create `courses/479-fall-2026/` (agreed: new folder, Fall 2025 stays).
- `course.md`: frontmatter + a short page — the course stands as before;
  what is new this term is the Tutor Lab. Link
  https://machinespirits.org/tutor-lab and say the class key comes in
  seminar, not on the page.
- One activity sheet per preset (six), each pairing the preset's "try this"
  with a discussion question. Draft under `_drafts/` first; move out to
  publish.
- Optionally: techne-rendered pages of the five reference transcripts
  (JSON in the private archive repo, `artifacts/course-479/transcripts/`).
- Claim-audit before publishing (course pages are spin-offs: any number
  must trace to the paper), then `./publish "course 479 fall 2026"` — the
  push redeploys the site's content.

## 8. Day 1

Give students the URL and the class key. Their transcripts download as
JSON from the page; nothing is stored server-side beyond engine logs on
the volume.

## Cleanup after merges

```bash
git worktree remove ../ms-course-479 && git worktree remove ../ms-website-tutor-lab
```

(Run each from its owning repo; the second command runs in the website
repo. Remove the `tutor-lab-mock` entry from the eval repo's
`.claude/launch.json` if you don't want the local mock server around.)
