# Cell 100 / id-director — Queued Follow-ups

**Status (2026-04-29):** the id-director extension closed at confirmatory N
across cells 101–108 (full-N CLI Sonnet 4.6 pass, see
`cell-100-charisma-full-n-update.md`). Paper §6.7 and §8.9 integrate the
findings; chatbot UI surfaces the four-design-point Pareto frontier; §VII
of `public/eval/geist-in-the-machine.html` covers it for the public-facing
overview.

This doc collects work that was deliberately deferred — either as
"out-of-scope for v1" in the original plan (`woolly-percolating-feigenbaum`)
or as queued items emerging from the pilot itself. None of these are
required for the current closure; each is hypothesis-generating and could
be picked up if a future paper or replication asks for it.

---

## A. Architectural ablations

### A1. Symmetric learner-side id-director — high priority

**Status:** the original plan listed this as "queued as cell_102/103"; cell
IDs 102+ are now occupied, so this would land at the next free pair (c110
and c111 once main's d3 cell_100 lands; queueing logic in
`config/tutor-agents.yaml` should be respected — grep before allocating).

**Question:** does the inverted topology generalise to the learner side?
Currently every id-director cell uses `learner_architecture: unified` (or
`unified_recognition` for c102/c104), so the asymmetry is deliberate — we
isolated the tutor-side mechanism. A symmetric "learner id-director" would
have a back-stage agent author the learner's persona each turn, mirroring
the tutor side. CLAUDE.md flags symmetric tutor/learner construction as
the project default; cells 100–109 are the explicit exception.

**Why it matters:** the charisma rubric is currently scored only on tutor
output. A learner side that cycles persona could test whether charismatic
*reception* is also a stance the architecture can sustain — i.e. whether
the learner-tutor charisma exchange is bidirectional in the way recognition
is.

**Cost:** ~2× a full-N pilot ($n=27$ × 2 cells × 3 curricula). Confirmatory
$n=27$ floor applies.

### A2. Routinization-of-charisma ablation

**Question:** Weber's prediction (W&G §III, Politik als Beruf) is that
charisma collapses into traditional or legal authority once routinised.
Construct a cell where the id is *required* to keep the persona stable
across ≥ N turns (no persona delta allowed). Predicted: charisma score
should drop monotonically as the stability window grows.

**Why it matters:** the c105 charisma-tuning result (verbose 800–1500
token directives) supports the "more authoring → more charisma" claim, but
doesn't isolate persona freshness from persona richness. This ablation
would.

**Implementation:** new `factor: persona_stability_window` (integer,
1–N). The id-director engine clips the persona delta to the previous N
turns when window > 1. Trace logs per-turn persona drift; rubric scored
at end-of-dialogue.

### A3. Persona-budget ablation

**Question:** the c105 result (highest charisma at full N) was achieved
with verbose 800–1500 token id directives. The c106 result (worst v2.2
+ charisma) was 200–400 token directives. The pilot framing assumed this
is a *prompt-budget* axis trading rhetoric for pedagogy; the full-N data
showed the axis is *non-monotonic* with an under-specification floor.

A targeted ablation: bin id directive length into 5 buckets
(≤300 / 300–500 / 500–800 / 800–1200 / 1200–2000) and run $n=27$ per
bucket. Plot v2.2 + charisma against directive length. Look for the
optimum and the under-specification cliff.

**Cost:** ~5× full-N pilot. Substantial. Worth it only if the
non-monotonic axis is going to anchor a paper claim.

---

## B. Robustness checks

### B1. Third-judge cross-check

**Status:** flagged in `cell-100-charisma-full-n-update.md` as future work.
The c105 vs c104 charisma lead (5.3 points) and the c107 generalist claim
both rest on a single judge (Claude Code CLI Sonnet 4.6). A third-judge
pass — Haiku 4.5 via CLI, Gemini Pro via API — would test rubric
stability. The original cross-judge sanity check at $n \approx 10$
(`cell-100-cross-judge-sanity-check.md`) was directionally consistent but
not statistically robust.

**Cost:** $\approx 0$ via CLI subscription for Haiku; $\sim$generation cost
for Gemini Pro. Re-judge full 430-row matrix.

### B2. c109 ego-capacity diagnostic

**Question:** c109 (charisma-tuning + exemplars) showed an
instruction-leakage failure mode at pilot $n = 6$ — the Nemotron ego
occasionally output its system prompt verbatim. Hypothesis: id-prompt
length crosses a threshold above which Nemotron's instruction-following
degrades. Log id-prompt length per row, correlate with t0 score.

**Why it matters:** if the failure mode is monotone in prompt length,
"more architectural support is better" (the implicit dialectical-cells
intuition) has a ceiling. This is a useful negative result for design
work that stacks levers.

**Status:** queued in `cell-100-charisma-full-n-update.md` §10 / Action 2.
Not yet run.

---

## C. Tooling / publication

### C1. Live charisma scoring in the chatbot

**Status:** the chat UI surfaces charisma scores via a static
`CHARISMA_PROFILES` table in `routes/chatRoutes.js`, sourced from
`docs/cell-100-charisma-full-n-update.md`. If new id-director cells land,
or existing cells get re-judged, the table needs hand-updating.

**Improvement:** query `evaluation_results` directly at chat-time,
aggregating the latest cell-level mean charisma + v2.2-last-turn under a
specified judge. Cache aggressively (these don't change between eval
runs). Same shape, no manual updating.

**Cost:** half a day. Useful only if id-director cells are likely to
expand (they likely won't unless A1/A2/A3 above are picked up).

### C2. §VII SVG: add c108/c109 once stable

**Status:** `public/eval/geist-in-the-machine.html` §VII shows four
design points (c104/c105/c107/c106). c108 (composer-classifier) regressed
at full N to 72.6/71.4 — close to the c105/c107 cluster, would crowd the
plot. c109 (composer-charisma) is still pilot-only. Add when both have
stable confirmatory numbers and the plot can fit them legibly.

### C3. Paper §6.7 → spin-off paper

The closing-synthesis paragraph (`paper-full-2.0.md` §6.7, v3.0.64) is
publishable as a short paper on its own — "Outward voice and upward voice:
two architectures for AI-tutor authority". Spin-off must follow the
"Paper Authoring Discipline" rule in CLAUDE.md: no original empirical
claims that don't trace back to §6.7. Currently no urgency to extract.

---

## D. What is NOT a follow-up

These were considered and explicitly rejected:

- **"c108 minus classifier" sanity check** — the §9 pilot framing
  motivated this, but c108's confirmatory regression made the comparison
  uninteresting. c107 already exists at full N and provides the
  exemplars-only baseline.
- **Cell rename to absorb paper IDs** — the cells now in
  `config/tutor-agents.yaml` (cell_101 through cell_109) match paper IDs
  c101–c109 directly. Historical `evaluation_results` rows still use the
  old `cell_100_*` to `cell_107_*` naming; analysis scripts handle the
  remap. No further rename needed.
- **Adding the recognition rubric to charisma cells** — the existing v2.2
  rubric *is* the recognition rubric (literature-informed redesign §5.4).
  No third rubric needed.

---

## E. Decision rule

When evaluating a future "should we do X?" against this list:

1. If X is in §A (architectural ablation), it needs a paper claim it
   would underwrite. Don't run pilots speculatively.
2. If X is in §B (robustness check), it gates publication. Run before
   submitting.
3. If X is in §C (tooling/publication), it follows demand — only build
   when the cost of NOT having it is felt.

The current closure (paper §6.7, chatbot UI, §VII overview) is sufficient
for a v1 publication of the id-director extension. None of the above
items block that. They're queued in case a v2 wants more.
