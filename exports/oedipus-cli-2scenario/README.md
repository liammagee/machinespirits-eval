# Oedipus information-asymmetry probe — post-fix omniscient panels (§7.9, paper v3.0.114)

The nine omniscient-critic panels backing the §7.9 reversal: the corrected instrument
(bidirectional learner superego `260cdc6` + premise-licensing `05df834`) yields
attributable guided anagnorisis at ~2/3, with a clean control, replicated across two
model backends and generalising to a second independently-screened scenario.

Each JSON: `scored[].arm` → `consensus {discovered, by_reasoning}` + per-critic `votes[]`
(panel: qwen/qwen3.7-max, google/gemini-3.5-flash, deepseek/deepseek-v4-pro, gpt;
3-of-4 consensus), plus a top-level `verdict`. A run "discovers" iff its `socratic` arm
reaches discovered-consensus by reasoning. `none` = control, `reveal` = told-S ceiling.

| file | scenario | backend | socratic verdict |
|------|----------|---------|------------------|
| `omniscient-smoke5.json` | D_OED1 (dataset namesake) | API / Sonnet 4.6 | **discovered** (3/4) |
| `omniscient-smoke6.json` | D_OED1 | API / Sonnet 4.6 | null (1/4) |
| `omniscient-smoke7.json` | D_OED1 | API / Sonnet 4.6 | **discovered** (4/4) |
| `omniscient-oed1-1.json` | D_OED1 | CLI / Sonnet 4.6 (Max-plan) | null (0/4) |
| `omniscient-oed1-2.json` | D_OED1 | CLI / Sonnet 4.6 | **discovered** (4/4) |
| `omniscient-oed1-3.json` | D_OED1 | CLI / Sonnet 4.6 | **discovered** (3/4) |
| `omniscient-oed3-1.json` | D_OED3 (ticker reassignment) | CLI / Sonnet 4.6 | **discovered** (4/4) |
| `omniscient-oed3-2.json` | D_OED3 | CLI / Sonnet 4.6 | **discovered** (4/4) |
| `omniscient-oed3-3.json` | D_OED3 | CLI / Sonnet 4.6 | null (2/4) |

**Totals:** D_OED1 socratic 2/3 (API) and 2/3 (CLI); D_OED3 socratic 2/3 (CLI).
`none` control discovered in **0/9**. `reveal` ceiling fires in 7/8 runs that carry it
(smoke7's told-S drew 2/4; smoke5 lost its reveal arm to a mid-run quota stop).

- Scenarios + secrets: `config/poetics-calibration/oedipus-pilot-v2.yaml` (D_OED1, D_OED3).
- Underivability screen: `scripts/screen-s-underivability.js`; panel: `scripts/critic-poetics-omniscient.js`.
- Spec: `notes/poetics/2026-05-29-oedipus-guided-discovery-spec.md`.
- Verified by the `paper-claim-auditor` against these files (2026-05-31).
