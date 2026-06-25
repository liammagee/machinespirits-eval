---
name: ms-research-review
description: Review recent daily research roundups, synthesize them, and produce a prioritized, project-grounded action plan
argument-hint: "[window, e.g. 'last 7' or a date like 2026-06-09]"
allowed-tools: Bash, Read, Grep, Glob, Write, WebFetch, WebSearch
---

Turn the accumulated daily research roundups into an actionable plan. The roundups
(`notes/daily-notes/*-research-roundup.html`) are a passive feed; this skill is the
**review → plan** half of the research loop. Implement and evaluate stay human-gated
(see "The brake").

## 1. Review — read the recent roundups

```bash
# the notes to review (default: all roundups from the last ~14 days)
ls -1 notes/daily-notes/*-research-roundup.html | sort | tail -14
```

For each, extract the papers (title, arXiv id, UNBLOCK/WATCH flag, summary). The blocks
are regular: `<div class="paper">` → `<h3>` title → `<div class="meta">` (`arXiv <id>`) → `<p>` summary.
Cluster across all of them by theme. Note where the field has converged on *this project's*
themes (ego/superego, recognition, rubric-as-instrument, dramatic/"right-time" form, teach-vs-solve,
theory of mind) — that is where the leverage and the novelty risk both are.

## 2. Plan — prioritize, and ground every item in the project's machinery

Produce a SHORT prioritized plan (3 strong items beats 10). For each item:

- **Paper(s)** it draws on (arXiv id).
- **Do** — the concrete project action, named against real artifacts: a specific cell
  (`config/tutor-agents.yaml`), a rubric (`config/rubrics/`), a mechanism in the §6.13
  dramatic-derivation arc, the prompt-lab, etc. Not "explore X" — "add X as cell N variant" /
  "cross-walk against rubric v2.2".
- **Evaluate** — name the eval up front: which `scripts/eval-cli.js run/evaluate` + which metric/§,
  or which existing-data re-analysis. This is what makes "did it work?" concrete later.
- **Cost** — flag read-only/existing-data vs needs-paid-runs.

Always check whether a candidate is the project's OWN work resurfacing (the routine has surfaced
`@magee2026geist` / "Geist in the Machine" / Drama Machine as if external). Self-citations are a
positioning note, not a finding.

## 3. Write the plan

Write `notes/research-plans/YYYY-MM-DD-research-plan.html` (date = today). Mirror the lightweight
inline-CSS HTML of the most recent roundup so it renders in email (NOT techne — techne CSS won't load
in a mail client). First line inside `<body>`:
`<!-- meta: date=YYYY-MM-DD reviews=<comma-separated roundup dates covered> generator=ms-research-review -->`

## The brake (do NOT skip)

- **Review + plan only.** Never implement a plan item or run a paid eval as part of this skill.
- Each plan item is a candidate the human picks from. Implementation = a scoped PR, chosen deliberately.
- Anything that would run cells, re-score samples, or spend OpenRouter/Max quota is the user's to
  authorize — the pre-registration / single-paper discipline (`AGENTS.md` → "Paper Authoring Discipline")
  depends on those being deliberate choices, not an agent's.
- Existing-data re-analysis (querying `data/evaluations.db`, parsing `logs/`) is fine and preferred.

## Companions

`ms-litreview` (literature pulls), `ms-analyze-data` (routes an analysis to the right script),
`ms-query-db` (DB queries). Build on them; don't duplicate. The daily generator is the cloud
"Research roundup" routine; the weekly version of THIS skill is the "Research review" routine.
