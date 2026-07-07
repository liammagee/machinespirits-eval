# Repo Consolidation / Sanitization Plan

**Date:** 2026-06-02
**Provenance:** synthesized from a 6-agent read-only scan (root, docs/, notes/, config/, scripts/, content-\*).
**Scope:** infra/working note only — makes no empirical claims (those live in `paper-full-2.0.md`).

Status legend: ✅ done · ▶ pending (needs a go-ahead) · ⏸ deferred · ❓ judgment call

> **Update 2026-06-07 (read first).** Two things changed since the 6-agent scan.
> (1) The **log/DB consolidation axis** — which the original scan parked under "NOT
> touching" — turned out to be the *highest-value* consolidation and is now partly
> done (see new **§ Log/DB consolidation** below; fork logs + DB are symlinked to the
> private archive; website's 6,652 logs remain). (2) A **per-file provenance audit**
> of every Phase 3 candidate (the audit the Provenance rule demands, which Phase 3's
> list pre-dated) falsified *all* of Phase 3: the legacy Paper 1.0 docs are *live
> build/validation inputs*, 6 of 7 cell-100 docs are *paper-cited*, and the two
> "orphan" build scripts that looked safe turned out to be live, location-coupled
> publishing tools (caught and reverted when the move was attempted — see Phase 3).
> **Phase 4 is DONE** (PR #7); **Phase 3 is now fully cancelled** (zero safe items).
> Net lesson: this repo is far more tightly coupled than a names-and-dates scan can
> see — the safe *doc* surface is empty; the real consolidation win is *logs*.

---

## Headline finding (read before re-proposing anything)

The nine top-level `content-*` directories are **NOT sprawl** — they are an intentional
domain-generalization test framework. All nine are registered in the `CONTENT_PACKAGES`
array in `routes/chatRoutes.js` (~line 459) and switched at runtime via `EVAL_CONTENT_PATH`
(`content-ai-literacy`, `content-ethics-ai`, `content-history-tech`, `content-stats-skeptics`,
`content-test-{creative,elementary,programming,sel,support}`). **Do not consolidate them** —
it would break the chat router for marginal tidiness. (See `docs/generalization-plan.md`.)

The real consolidation surface, after verification, is narrower than the scan guessed:
(a) a handful of remnant files [done, Phase 0], (b) a tracked PID file + a gitignore leak
[done, Phase 1], (c) ~10 executed one-shot scripts [done, Phase 4], and (d) **log/DB
co-location into the private archive** — which the scan under-rated and is the actual win
[partly done, see § Log/DB consolidation]. What is **NOT** a surface: the `docs/` archival
batch the scan proposed (Phase 3) is *entirely* live build/validation inputs, paper-cited
provenance, or live-but-orphan-from-automation build tools — zero safe items — and **NOT**
the closed-experiment plan docs at root, which are cited provenance too (see Provenance rule + Phase 2).

## ⚠ Provenance rule (learned the hard way in Phase 2)

**A closed experiment does NOT imply an archivable document.** Pre-registration docs, their
rationale docs, and anything the canonical paper or a script cites *by name/path* are load-bearing
**provenance** even after the experiment closes and nulls. Before moving or deleting ANY doc in
Phases 3–5, grep it across `docs/research/paper-full-2.0.md`, `scripts/`, `docs/research/build.sh`,
and `notes/`. If the paper names it — especially with a location like "repo root" — it stays put.

---

## ✅ Phase 0 — Trivially safe deletes (DONE 2026-06-02)

Untracked/gitignored cruft, zero git-history loss:

- Deleted untracked root remnants: `draft-transcendence-check.js` (self-labelled v0.1 DRAFT,
  no references), `transcendence-check-results.json` (216 KB, its output), `poetics-sidecar.db` (0 B).
- Deleted 5 `.DS_Store` (root, `docs/`, `docs/research/`, `notes/`, `notes/poetics/`) — gitignored OS junk.
- Deleted 5 stale local PDF builds (~40 MB): `paper-2.0-v3.0.{104,105,106,113,116}.pdf`.
  Kept `v3.0.117` (matches `paper-full-2.0.md` `version: "3.0.117"`). All rebuild via `./build.sh paper2`.

## ✅ Phase 1 — Gitignore hygiene + tracked PID file (DONE 2026-06-02)

- `git rm --cached backfill.pid` + removed working copy (a PID file should never be tracked).
- `.gitignore` += `*.pid` (under Temp files).
- `.gitignore` += `config/poetics-calibration/phase2-transcripts*/` — these dirs slipped the
  existing `**/transcripts/` rule (named `phase2-transcripts-api` etc., not literally `transcripts`),
  so generated transcripts were leaking into untracked status. `git check-ignore` confirms the fix.
- **Not committed** — staged `git rm` + modified `.gitignore` left for review.

---

## ⛔ Phase 2 — CANCELLED (the trio is cited provenance, not cruft)

**Reversed after verification (2026-06-02).** The experiment is closed — it landed as
`paper-full-2.0.md` §6.9.8 (`state→action` policy axis) and §6.10 (signal axis / concealed
interior), both null at pre-registered offline kill gates. But the three plan docs are
**load-bearing pre-registration provenance the paper cites by name and explicit location**:

- `paper-full-2.0.md:2392` — "a kill gate pre-registered (`LEARNED-ADAPTATION-PLAN.md`, **repo root**)"
- `paper-full-2.0.md:2415` — "a kill gate pre-registered (`ADAPTATION-PLAN-2.0.md`, **repo root**;
  rationale in `ADAPTATION-2.0-DIALOGUE.md`)" · revision-history at `:3709`
- scripts cite them by name: `learned-adaptation-harvest.js`, `learned-adaptation-policy-ope.py`
  (→ LEARNED-ADAPTATION-PLAN.md §2); `adaptation2-stage0.py §3` (→ ADAPTATION-PLAN-2.0.md)

Moving them would falsify the paper's "repo root" citations and break the §5.12 pre-registration
chain. **All three KEEP-AT-ROOT**, alongside `DRAMATIC-RECOGNITION-PLAN.md` (active master) and
`TUTOR-CORE-INHOUSING.md`. Relocating would require editing the canonical paper's citations under
a version bump — out of scope for a cleanup; do not bundle. Net: root keeps its 6 plan docs;
that is provenance, not clutter.

## ⛔ Phase 3 — `docs/` archival batch — MOSTLY CANCELLED (per-file audit 2026-06-07)

**The 2026-06-02 candidate list pre-dated the Provenance rule and never ran through it.**
Running it now (grep each basename across `paper-full-2.0.md`, `scripts/`, `build.sh`,
`README.md`, `notes/`, `CLAUDE.md`) collapses the "safe archival batch" to almost nothing:

| Candidate | Verdict | Evidence |
|-----------|---------|----------|
| `docs/research/paper-full.md` (legacy 1.0) | **KEEP — live input** | feeds `validate-bug-claims.js` (= `paper:bug-audit`), `validate-paper-manifest.js`, `generate-paper-tables.js`, `paper-provable-discourse-chat.js`, `build.sh` (`full)` target), README, CLAUDE.md |
| `docs/research/paper-short.md`, `slides.md` | **KEEP — live input** | `build.sh` targets (`slides)`; short built by `full`) |
| `docs/research/methods-paper.md` | **KEEP — live input** | `build.sh` `methods)` target |
| `docs/cell-100-{pilot-findings,methods-note,pilot-findings-addendum,cross-judge-sanity-check,replication-findings,charisma-full-n-update}.md` (6) | **KEEP — paper-cited** | `paper-full-2.0.md` §6.7 — the "Five internal documents" sentence (:2074) + `charisma-full-n-update` at :2044/:2052/:3834/:3837 |
| `docs/explorations/claude/2026-05-10-p22-p23-parking-note.md` | **KEEP — paper-cited** | `paper-full-2.0.md:2080` ("See … for the integration plan") |
| `docs/research/build-appendix.sh`, `build-machinagogy-combined.sh` | **KEEP — live tools** (was mis-tagged "SAFE") | orphan *from automation* but NOT dead. `build.sh` has **no** appendix/machinagogy target, so these are the *only* way to build the appendix PDF and the machinagogy-combined PDF; `build-machinagogy-combined.sh` writes the combined PDF straight into the paper-publishing staging dir (`…/machinespirits-content-philosophy/articles/ai-tutor`). Both do `cd "$(dirname "$0")"` and read `paper-full-2.0.md` relatively → **hard-coupled to `docs/research/`**; moving them to `archive/` silently breaks them (wrong `cd`, version resolves to "dev", inputs not found). Verified 2026-06-07 when judgment call #3 was resolved — the move was attempted, the pre-commit read of the scripts caught the coupling, reverted. |
| `docs/cell-100-followups.md` | judgment call | 0 by-name refs anywhere — the lone non-cited cell-100 doc; **recommend keep-with-family** (archiving 1 of 7 audit-trail docs to a different dir fragments the family for ~0 gain) |

So Phase 3 now has **zero** clearly-safe output. Everything the scan flagged is either a live
build/validation input, paper-cited provenance, or — the build scripts — an orphan-from-automation
tool that is still live and hard-coupled to its location. **This is the third time the
names-and-dates / "orphan" heuristic mistook a coupled file for cruft** (Phase 2 = root plan docs;
Phase 3 docs = cell-100/legacy-paper; Phase 3 scripts = these build helpers). The sharper rule:
*"nothing auto-calls it" ≠ "dead"* — a human-invoked build/publish tool has no caller in the repo
yet is fully live. Always **read the file**, not just its reference count, before archiving.
`docs/explorations/{claude,gpt-pro}` was never fully enumerated here — if it is ever revisited,
audit **every** file in it, not the dir as a unit (p22-p23-parking-note.md proves a single cited
file hides inside an otherwise-stale dir).

## ✅ Phase 4 — `scripts/` one-shot archival (DONE 2026-06-07, PR #7)

- `git mv`'d **10** verified-zero-reference one-shots → `scripts/archive/oneoff/` (+ a README
  documenting each and a do-not-rewire warning): `backfill-{hashes,holistic.sh,judge-input-hashes}`,
  `recover-sonnet-scores.js`, `check-{dialogue-judgements,parse-failures,run}.js`,
  `debug-cell-115-{history,prod-path}.js`, `inspect-judge-prompt.js`.
- **Held back** from the original ~19-script wish-list (conservatism paid off):
  - `consolidate-runs.js` — two scripts list it as an active pipeline step in their doc-headers
    (header comments, not `require()`s, but enough to keep it in `scripts/`).
  - `remove-public-speech-quotes.js` and the rest — not re-verified to zero refs; left for a later pass.
- **Kept** all `analyze-a*/d*` experiment scripts — reproducibility chain for paper findings.
- ✅ Promoted into `scripts/ANALYSIS-SCRIPTS.md`: `analyze-strategy-shift.js`, `grade-adaptive-dialogue.js`.
- Verified before merge: lint clean · `test:hermetic` 3264 pass / 0 fail · `paper:bug-audit` 0 fail.

## ◐ Log/DB consolidation — the real win (DB done · fork logs done · website logs remain)

The original 6-agent scan parked `data/` + `logs/` under "NOT touching" as gitignored
private artifacts. That was right about *committing* them and wrong about *consolidating*
them: co-locating every fork's DB + dialogue logs into the single private archive
(`../machinespirits-eval-private` / `~/.machinespirits-data`) is the highest-value
consolidation in this repo, because two validators silently fail without it
(`paper:provable-discourse` provenance and `paper:bug-audit`'s log-trace checks). Tracked
in memory as `consolidate-logs-db-to-private` and in `TODO.md` §C7.5.

- ✅ **DB** — `data/evaluations.db` is a symlink to `~/.machinespirits-data/evaluations.db`
  in all forks (canonical, 277 MB). Done before this arc.
- ✅ **Dramatic-fork logs** (TODO C7.5, PR #6, 2026-06-07) — `rsync --ignore-existing`
  copied the fork's 644 unique log items into the archive (zero overwrites), then `logs/`
  became a gitignored symlink → `../machinespirits-eval-private/logs`, and the
  `config/provable-discourse-mechanisms.yaml` `log_dir` override reverted to the repo-relative
  default. `paper:bug-audit` log-trace fails went 3 → 0. A safety backup sits at
  `logs.pre-symlink-backup-20260607/` (untracked) — **delete once the archive maintainer
  commits the newly-copied logs** (they currently sit as untracked files in the archive's
  normal accumulation pile; I did not run git there).
- ▶ **Website logs** (`../machinespirits-website/logs`, a *real* dir, **6,652** dialogue
  files) — the one remaining union gap. Same recipe: `rsync --ignore-existing` into the
  archive, then symlink. **But this is deploy-adjacent** (the website is the live fly app
  serving machinespirits.org/poetics), so it is plan-not-execute here — do it attended,
  and verify the fly deploy still ships logs correctly afterward.
- ~~tutor-core logs~~ — the memory's "~5.9k tutor-core logs" is **stale**: `../tutor-core/logs`
  is now absent (the module was in-housed; the standalone repo's log dir is gone). Drop it
  from the remaining-work list.

## ⏸ Phase 5 — `notes/` light archive (DEFERRED — arc is mid-iteration)

Only the superseded dated *status/handoff* notes (2026-05-24 → 05-29) are candidates. The *spec*
notes still steer open work — do **not** archive: `2026-05-28-edra-m3-surgery-spec.md`,
`2026-05-29-oedipus-guided-discovery-spec.md`, `2026-05-31-forcedness-underivability-window.md`,
`2026-06-01-discovery-grade-worksheet.md` + `oedipus-discovery-grade-rubric.md`,
`drama-machine/`, the two `2026-05-27-{next-steps,handoff}-*` continuation checklists.
Revisit once the adaptation-recognition loop stabilizes.

---

## ❓ Judgment calls (need a human decision) — statuses refreshed 2026-06-07

1. `config/interaction-eval-scenarios.yaml` — **confirmed 0 code references** (only this plan names it).
   Dead, or a draft instrument to keep? Conservative default: archive (don't delete) a config file.
2. `docs/research/methods-paper.md` → **resolved: KEEP** (it's a live `build.sh` `methods)` target, not
   foldable). `machinagogy_appendix_rewrite_v0_1.md` → 0 code refs (only this plan); the machinagogy
   build script doesn't name it. Still a judgment call: archive, or already folded into the paper?
3. **Archive destination → RESOLVED 2026-06-07: top-level `archive/`** (user's call). *But* when this
   unblocked the only candidates (the two orphan build scripts) and the move was attempted, reading the
   scripts first showed they are live, location-coupled publishing tools — so the move was reverted and
   Phase 3's safe set is now empty (see Phase 3 table). **Net: the convention is decided (top-level
   `archive/`, tracked — not gitignored, since a deliberate archive wants its `git mv` history kept),
   but there is nothing safe to put in it yet.** The dir is therefore not created until a genuinely-dead
   file appears. For reference: `git mv`-ing a tracked file into a gitignored dir would keep it tracked
   (gitignore only suppresses *untracked* files), so the gitignore-or-not choice was only cosmetic; we
   chose tracked top-level so future archived files are tracked by default.
4. `.antigravitycli/` → **resolved: already effectively ignored** (untracked yet absent from the
   `git status` dirty set, like `.codex/`/`.agents/`). No action needed; drop from the list.

## Explicitly NOT touching (rails)

`content-*` (intentional test framework) · `public/` & `vendor/` (served/loaded at runtime) ·
`config/tutor-agents.yaml` + rubrics + `config/rubrics/v*/` + scenarios (cell registry & reproducibility) ·
`paper-full-2.0.md` + `figures/` + `build.sh` · the active analysis-script suite ·
the gitignored private artifacts (`data/`, `logs/`, `exports/`, `artifacts/poetics-runs/`)
— "not touching" here means *never commit them to this repo*; it does **not** forbid
*consolidating* them into the private archive (see § Log/DB consolidation — that's the
opposite of committing, and it's the right move).
