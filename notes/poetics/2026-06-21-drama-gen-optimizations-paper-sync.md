# Drama-gen optimizations — paper-sync assessment

Date: 2026-06-21
Status: assessment (no paper change made)
Scope: the week's drama-generator optimization work vs `docs/research/paper-full-2.0.md` (v3.0.166)

## Do the optimizations warrant paper revisions? — No

The week's work (compact prompts + default flip, fidelity ladder, role budgets,
director-plan cache, state-ledger context mode, stochastic phatic turns) is all
**generation-side infrastructure** for `scripts/generate-pedagogical-dramas.js`.
None of it is an empirical claim about recognition, adaptation, or tutoring — the
subject of the paper's claims.

- The paper's drama-using results (the §6.13 dramatic-derivation arc; the §7.9
  poetics instrument) come from **completed, provenance-pinned runs** (run_id +
  config_hash). The optimizations change *future* generation, not those runs, so
  no reported number moves.
- The compact-vs-full **cross-critic de-confound** (codex composite parity Δ −0.17;
  independent Gemini −0.83 ≈ −3.7% favouring full on depth dims; GPT +2.67) is a
  *methodological* result about prompt compression, not a research finding — it
  does not belong in the paper as a claim. Recorded in
  `notes/poetics/2026-06-20-drama-perf-slices-results.md`.
- One marginal item: making `compact` the **default** changes what
  `npm run drama:generate` emits. Reproduction of paper §6.13/§7.9 dramas should go
  through the pinned config_hash, or pass `--drama-fidelity full`. The paper barely
  documents the generation default (≈2 lines), so this is at most a one-line
  reproducibility footnote, and optional.

## Gaps between the week's work and the paper/atlas/arc? — None obvious

Distinguishing infra from claim-bearing findings:
- The optimization work is infra → correctly not paper-bound.
- The week's actual finding-level work is the **plan2.5 / AF6** arc; its own note
  (`2026-06-21-plan25-af6-negative-result-and-replay-next.md`) states it is *"an
  interim result, not a Paper 2.0 claim-bearing result"* — deliberately held out
  until claim-bearing, i.e. the single-paper discipline working, not a gap.
- The adaptation **Plan 2.x** work is already in the paper (§6.12.1–6.12.4, through
  the M0 baseline validation).

Caveat: this is a *light* read, not a full audit. A rigorous sync-check would run
`scripts/validate-paper-manifest.js` (N-counts, stalled runs) and
`scripts/generate-paper-tables.js` (prose numbers vs DB). Not yet run.

## Ledger work — verdict

`--context-mode ledger-recent` (Slice 7): **inert at realistic lengths; keep
opt-in, do not default** (commit `459c01dd`). At ≤8 turns last-six already holds
~the whole transcript, so ledger-recent is information-equivalent; codex
coherence/recon identical, composite +1.67 sat on floor-level statedInsight noise,
callback metric null, transcript read showed no retention difference. Benefit can
only appear past ~10 turns.

**Two unrelated "ledgers" — do not conflate.** This one is a public
conversation-context summary in the *drama generator*. The paper's §6.9 ledger is
the adaptive runner's *learner-model state ledger* (typed hypotheses, TTL,
content-derived ids) — a different mechanism; this work has no bearing on §6.9.
