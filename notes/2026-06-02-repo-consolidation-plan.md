# Repo Consolidation / Sanitization Plan

**Date:** 2026-06-02
**Provenance:** synthesized from a 6-agent read-only scan (root, docs/, notes/, config/, scripts/, content-\*).
**Scope:** infra/working note only — makes no empirical claims (those live in `paper-full-2.0.md`).

Status legend: ✅ done · ▶ pending (needs a go-ahead) · ⏸ deferred · ❓ judgment call

---

## Headline finding (read before re-proposing anything)

The nine top-level `content-*` directories are **NOT sprawl** — they are an intentional
domain-generalization test framework. All nine are registered in the `CONTENT_PACKAGES`
array in `routes/chatRoutes.js:436` and switched at runtime via `EVAL_CONTENT_PATH`
(`content-ai-literacy`, `content-ethics-ai`, `content-history-tech`, `content-stats-skeptics`,
`content-test-{creative,elementary,programming,sel,support}`). **Do not consolidate them** —
it would break the chat router for marginal tidiness. (See `docs/generalization-plan.md`.)

The real consolidation surface is: (a) a handful of remnant files, (b) a tracked PID file +
a gitignore leak, (c) genuinely-stale docs in `docs/` — but **NOT** the closed-experiment plan
docs at root, which on verification turned out to be cited provenance (see Provenance rule + Phase 2).

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

## ▶ Phase 3 — `docs/` archival batch (PENDING — review pass, then `git mv`, preserves history)

Candidates (closed/superseded, results already in the paper):
- Legacy Paper 1.0: `docs/research/{paper-full,paper-short,slides}.md` (+ update README/build.sh refs).
- Closed eval reports: `docs/cell-100-*.md` (×7) — id-director charisma family, results in the paper.
- Design dumps now implemented in `services/adaptiveTutor/`: `docs/explorations/{claude,gpt-pro}` dated summaries
  (keep the still-live `consolidated-plan.md` / `comprehensive-strategy.md` / `next-steps-report.md`).
- Orphan build scripts: `docs/research/build-appendix.sh`, `build-machinagogy-combined.sh` (verify unreferenced first).

## ▶ Phase 4 — `scripts/` one-shot archival (PENDING — conservative)

- Move only the ~19 clearly-executed one-shots → `scripts/archive/oneoff/`:
  `backfill-*`, `debug-cell-115-*`, `recover-sonnet-scores.js`, `consolidate-runs.js`,
  `check-{dialogue-judgements,parse-failures,run}.js`, `remove-public-speech-quotes.js`, etc.
- **Keep** all `analyze-a*/d*` experiment scripts — they are the reproducibility chain for paper findings.
- Promote into `scripts/ANALYSIS-SCRIPTS.md`: `analyze-strategy-shift.js`, `grade-adaptive-dialogue.js`
  (referenced in CLAUDE.md but missing from the registry).

## ⏸ Phase 5 — `notes/` light archive (DEFERRED — arc is mid-iteration)

Only the superseded dated *status/handoff* notes (2026-05-24 → 05-29) are candidates. The *spec*
notes still steer open work — do **not** archive: `2026-05-28-edra-m3-surgery-spec.md`,
`2026-05-29-oedipus-guided-discovery-spec.md`, `2026-05-31-forcedness-underivability-window.md`,
`2026-06-01-discovery-grade-worksheet.md` + `oedipus-discovery-grade-rubric.md`,
`drama-machine/`, the two `2026-05-27-{next-steps,handoff}-*` continuation checklists.
Revisit once the adaptation-recognition loop stabilizes.

---

## ❓ Judgment calls (need a human decision)

1. `config/interaction-eval-scenarios.yaml` — 0 references anywhere. Dead, or a draft instrument to keep?
2. `docs/research/methods-paper.md` and `machinagogy_appendix_rewrite_v0_1.md` — archive, or already folded into the paper?
3. Phase 2/3 archive destination: `docs/research/archive/` (already gitignored) vs. a top-level `archive/`.
   Note: `git mv`-ing an *already-tracked* file into the gitignored `docs/research/archive/` **keeps it
   tracked** — gitignore only suppresses *untracked* files, so history is preserved either way. The
   gitignore entry just stops stray new scratch files in `archive/` from being accidentally added.
   So this is mostly a cosmetic/where-do-I-look choice, not a history-loss risk.
4. `.antigravitycli/` — untracked agent-tool dir (like `.codex/` / `.agents/`). Gitignore it, or remove?

## Explicitly NOT touching (rails)

`content-*` (intentional test framework) · `public/` & `vendor/` (served/loaded at runtime) ·
`config/tutor-agents.yaml` + rubrics + `config/rubrics/v*/` + scenarios (cell registry & reproducibility) ·
`paper-full-2.0.md` + `figures/` + `build.sh` · the active analysis-script suite ·
the gitignored private artifacts (`data/`, `logs/`, `exports/`, `artifacts/poetics-runs/`).
