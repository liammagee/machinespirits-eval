---
name: ms-theory-synthesis
description: Refresh the "theory behind the machine" synthesis — the reference surface mapping the project's theoretical lineages (Hegel recognition · Freud ego/superego/id · Weber charisma · Aristotle poetics) onto the architecture, mechanisms, and findings. Use when asked to update, refresh, re-synthesise, or re-stamp the theory synthesis / theory-synthesis.html / the /theory surface, or after the paper version bumps and the theory prose needs re-checking.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

Refresh the **theory synthesis** — a techne reference surface at `notes/poetics/theory-synthesis.html`, served at **`/theory`** in the web app and (by construction) the desktop. It maps the four theoretical lineages the project operationalises onto concrete mechanisms and findings, and reports what the data did to each.

**It is a reference surface, NOT a source of claims.** Every number inherits from `docs/research/paper-full-2.0.md`. Refreshing it never invents a finding — it re-presents the paper's framing and re-points at the code. (Same discipline as paper spin-offs: a new empirical claim belongs in the paper first.)

A refresh has two halves. The **prose** half needs reading + judgement (do it / fan it out). The **mechanical** half is the script.

## When to refresh
- The paper version bumped and the threads/§ pointers may have moved → run `npm run theory:check` first; it flags version drift.
- A prompt / rubric / script the doc references was renamed or moved → `theory:check` fails with the missing `data-ref`.
- A new theory-bearing mechanism, cell family, or rubric landed and belongs on the map.

## Steps

1. **See what's stale (mechanical):**
   ```bash
   npm run theory:check
   ```
   Exit 0 = refs resolve and the stamped paper version is current. Non-zero = a referenced file is missing, or the stamp lags the paper.

2. **Re-synthesise the prose (judgement).** The `.html` IS the source — edit it directly (no build step; read `notes/poetics/TECHNE-DOCS.md` for the component vocabulary). Re-read the theory threads in the paper and how they are operationalised in code, then update the affected sections:
   - **In the paper** — the recognition mechanisms (§3.2, §3.5), the architecture (§4.1–4.2), the matched-specificity control (§7.9 / A10), the poetics arc (§6.10, §7.9), and any new theory framing.
   - **In the code** — recognition prompts + `recognition_quality` (v2.2), the bilateral ego/superego engines, `idDirectorEngine.js` + the charisma rubric, the poetics rubric + drama generator, `tutor-agents.yaml` cell families.
   - For a wide refresh, fan out read-only Explore agents (one for the paper, one for the code) and synthesise from their digests — that is how the doc was first built.
   - **Rule:** every figure must trace to a paper §; mark each thread supported / qualified / null with the right chip colour (`chip--moss` / `chip--ochre` / `chip--brick`). Do not let a costume-vs-substance caveat drop (the dramatic instrument reads form, not learning).

3. **Re-stamp + re-validate (mechanical):**
   ```bash
   npm run theory:synthesize   # re-stamps the provenance band; validates every data-ref
   npm run theory:check        # must exit 0
   ```
   If you added a new source reference, give its `<code>` a `data-ref="<repo-relative-path>"` so the validator covers it.

4. **Eyeball it in the app:**
   ```bash
   npm run poetics:serve   # then open http://127.0.0.1:3466/theory
   ```

## Script details

`scripts/refresh-theory-synthesis.js` (aliases `theory:synthesize` = re-stamp+validate, `theory:check` = validate-only/CI).
- `--check` — no write; exit 1 on a missing `data-ref` or a stale stamp.
- `--date <ymd>` — pin the refresh date (default: today UTC) for a deterministic diff.
- It re-stamps paper version+date, git commit, and refresh date between the `THEORY-SYNTH:PROVENANCE` markers; it does **not** touch the prose.

## Gotchas
- **No new claims.** If a number isn't in `paper-full-2.0.md`, it doesn't go in the doc.
- **Edit the web stack, never `desktop/`.** The `/theory` route lives in `scripts/browse-poetics-scripts.js`; the desktop inherits it (route-parity test guards this).
- The doc must stay a sibling of `notes/poetics/assets/` so `assets/techne.css` resolves when framed.

## Related
- `/ms-techne-doc` — the techne HTML framework this doc is built on.
- `/ms-build-paper`, `/ms-author-paper2` — the canonical paper the synthesis inherits from.
