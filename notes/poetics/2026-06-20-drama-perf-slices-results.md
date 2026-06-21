# Curriculum Drama Generation — Performance Slices: Implementation + Results

Date: 2026-06-20
Status: implemented + measured (perf complete; quality check in progress)
Plan: `notes/poetics/2026-06-20-curriculum-drama-generation-performance-plan.md`
Branch: `claude/drama-perf-slices` (worktree), off `claude/derivation-fast-iteration`

## What landed

Slices 3–7 of the performance plan, every option **opt-in** (the default path is
byte-identical to before). Slices 1–2 (telemetry + worker prompt-split) were
already in.

| Slice | Flag | Effect |
|---|---|---|
| 6 | `--director-plan-cache DIR` / `--reuse-director-plan FILE` | Replay the cached raw director response on rerun → skips the single ~90–150s director call |
| 3 | `--role-max-tokens "tutor_superego=700,…"` or `preset` | Per-role output budget: hard `max_tokens` on the API backend, terse-directive (soft) on the claude/codex CLI backends; recorded in telemetry |
| 4 | `--drama-compact-prompts` | Swap the ~20k-char recognition tutor prompts for `prompts/drama/tutor-{ego,superego}-compact.md` (~2k), keeping the recognition stance + hidden-label rails |
| 5 | `--drama-fidelity full\|compact\|public-only` | Deliberation ladder. `public-only` = ego-only on **both** sides (skips superego critique + ego adjudication + opening superego) |
| 7 | `--context-mode last-six\|ledger-recent\|full-public` (`--recent-turns N`) | Event-derived, public-safe state ledger + a shorter verbatim window, so early learner commitments survive past the last-six cutoff |

All five are covered by tests (4 subprocess generator suites + 1 engine-helper
unit suite). The engine's existing unit suites stay green.

## Performance (mock telemetry — deterministic; prompt sizes + call counts do not depend on the LLM)

One AI-Foundations drama, `--max-turns 4`, recognition profile (tutor ego+superego,
learner ego+superego):

| Mode | LLM calls | Total input chars | Tutor-ego sys prompt | vs full |
|---|--:|--:|--:|---|
| full (default) | 28 | 422,953 | 20,735 | baseline |
| compact | 28 | 205,293 | 2,509 | **−51% input chars**, same call count |
| public-only | 10 | 66,414 | 2,509 | **−64% calls, −84% input chars** |
| ledger-recent | 28 | 433,168 | 20,735 | +2% here (see note) |

Reads:

- **compact** halves total input bytes with no structural change — the tutor
  ego/superego prompts were ~half of all input. This is the safe, quality-relevant
  lever.
- **public-only** removes the superego + adjudication calls on both sides: a
  cheap structural screen (the plan's intent), ~3× fewer calls and ~6× less input.
  Quality is expected to drop — it is not a final-fidelity mode.
- **director cache** (not in the per-turn table): removes one ~90–150s call per
  rerun of the same spec/seed/model — verified hit/miss/skip cycle.
- **role budgets**: output-tail control. Input dominates output ~11:1 in the live
  AF11 telemetry, so this is a latency-tail/cost nicety, not a primary lever; the
  hard cap only binds on the API backend (the claude CLI has no max-tokens flag).
- **ledger-recent** is **+2% at 4 turns** — it is a *memory* feature, not a perf
  win at short lengths: last-six already contains the whole short transcript, and
  the ledger adds the carried-forward commitments. Its payoff is on long dramas,
  where last-six caps at 6 turns and silently drops turn-1 commitments while
  ledger-recent preserves them in compact form.

### Compounding

compact + public-only + director-cache stack: on a rerun, the director call is
free, the per-turn calls are ego-only, and each call carries the compact prompt —
the cheapest screen the harness can produce while keeping the public transcript
and hidden-label safety intact.

## Quality maintenance (real generation — claude-code sonnet/low, 1 drama, max-turns 3)

`full` vs `compact` on the same AI-Foundations drama (√2 irrationality), run
sequentially on the now-idle quota window. **n = 1 drama** — a single-case read,
not a statistical claim.

Real telemetry:

| Mode | calls | input chars | output chars | sum latency | tutor-ego sys | quality warnings |
|---|--:|--:|--:|--:|--:|--:|
| full | 22 | 386,405 | 34,791 | 887s | 20,735 | 1 (reframe-cue) |
| compact | 22 | 204,111 | 24,692 | 768s | 2,509 | 0 |

- Input **−47%**, output **−29%**, sum latency **−13%** (latency is dominated by
  per-call model time on the claude-code backend, not prompt size, so it falls
  less than input bytes). Confirms the mock −51% input figure.
- **Quality held.** Both transcripts are coherent proofs by contradiction; both
  realize the recognition reframe-card mechanism (revoice → name what the old
  frame hid → replacement frame) and reach a genuine anagnorisis. The compact
  transcript is if anything tighter ("fifteen digits is a claim about fifteen
  places; 'never' is a different kind of claim") and carried **0** rule-based
  quality warnings to full's 1 (a minor reframe-cue flag — scenario noise at
  n=1, not a compact-vs-full signal).

Caveats: single drama, Sonnet-generated, judged by the rule-based quality gate +
a hand read — not an independent critic panel. (Superseded by the n=6 paired
comparison below.) `public-only` was not quality-checked here (it is a screen by
design); `ledger-recent` needs a long-drama run to show commitment-retention
value.

## Quality maintenance — n=6 paired, critic-scored (claude-code sonnet/low, max-turns 3)

Six dramas (D1–D6 of `phase2-dramas-v2.yaml`), each generated `full` and
`compact`. **The director plan was generated once (full arm) and reused on the
compact arm via `--director-plan-cache` (6/6 cache hits confirmed), so each pair
runs on an identical scene — the only variable is the tutor prompt.** Arms ran
sequentially (full then compact), so any quota-time drift is conservative against
compact. Scored by the **codex critic** (generator=claude → codex, per the
generator≠critic convention) on the 8-dimension poetics rubric; all 6 in both
arms classified as **`recognition` form**.

Rule-based quality gate (n=6, identical scenes):

| | gate-pass (quality_status: ok) |
|---|---|
| full | **2/6** (D4, D5) |
| compact | **5/6** (D4, D6, D3, D5, D1) |

Compact was never worse than full on any drama and flipped D6/D3/D1 from
"review" to "ok" — the lean prompt realized the director's reframe cues *more*
reliably, not less.

Codex critic, raw scores (1–5), paired across all 6 dramas (scored with
`--allow-quality-warnings` so the gate-flagged transcripts are included):

| dimension | full | compact | Δ (compact−full) |
|---|--:|--:|--:|
| recontextualization | 4.50 | 4.67 | +0.17 |
| stated insight | 2.33 | 1.50 | −0.83 |
| rupture | 3.83 | 3.83 | 0.00 |
| global coherence | 5.00 | 5.00 | 0.00 |
| actional breakthrough | 4.67 | 4.67 | 0.00 |
| tutor strategic reversal | 3.67 | 3.17 | −0.50 |
| adaptive mechanism quality | 3.67 | 3.17 | −0.50 |
| tutor contingent adaptation | 2.83 | 4.33 | +1.50 |
| **composite (sum of 8)** | **30.50** | **30.33** | **−0.17** |

Per-drama composite Δ (compact−full): D4 0, D6 −6, D2 +2, D3 0, D5 +3, D1 0 →
3 ties, 2 compact-better, 1 full-better.

**Read.** Composite dramatic-form quality is at **parity** (−0.17 on a ~30-point
scale, well within n=6 noise), and the three core form dimensions — coherence,
rupture, actional breakthrough — are **identical**. The difference is a
dimensional *reshuffle*, not a loss: compact trades some explicit **stated
insight** (−0.83, on an already-low dimension where critic evidence was often
empty in both arms) and **tutor strategic-reversal / adaptive-mechanism depth**
(−0.50 each) for markedly more **contingent adaptation** (+1.50) and slightly
more **recontextualization**. Combined with the gate result (5/6 vs 2/6) and the
~−47% input / −13% latency cost, this upgrades the n=1 read: **at n=6, compact
holds dramatic-form quality at roughly half the input cost, and produces cleaner
transcripts.**

Caveats: n=6, one model (sonnet/low), one curriculum (AI-foundations), 3-turn
dramas. Artifacts: `exports/drama-perf-eval-v2/{full,compact}/` (transcripts) and
`{full,compact}-codex-all.json` (scores).

### Cross-critic de-confound (same transcripts, independent critic)

The n=6 transcripts were re-scored by an **independent-family critic** — Gemini
3.1 Pro (codex is itself a GPT model, so GPT-via-OpenRouter is *not* independent;
it's reported below only as a same-family replication).

| critic | full | compact | Δ (compact−full) | per-drama c/t/f |
|---|--:|--:|--:|--:|
| codex (GPT-family, primary) | 30.50 | 30.33 | −0.17 (parity) | 2/3/1 |
| **gemini (independent)** | 22.67 | 21.83 | **−0.83 (−3.7%)** | 2/0/**4** |
| gpt (GPT-family ≈ codex) | 26.83 | 29.50 | +2.67 | 4/1/1 |

The independent critic is much stricter (absolute scores ~1–3; classifies 2/6 as
"flat" — but the *same* 2 in both arms, so the form classification is arm-invariant
even for the strict critic) and lands a **small, consistent edge for full** (4/6
dramas), concentrated in the depth dimensions: rupture −0.33, actional-breakthrough
−0.33, adaptive-mechanism −0.33; coherence and strategic-reversal tie. This agrees
with codex's own per-dimension read (compact trades tutor-depth for contingent
adaptation); the critics disagree only on whether the trade nets to zero (codex:
yes; gemini: not quite).

**Verdict:** not "parity" — the quality difference is *small* (within ~4% under
the strictest critic) and its *sign is critic-dependent*. Compact is within a few
percent of full by every critic, at −47% input; the independent critic sees it as
marginally thinner on depth. Good enough to default for the cost-sensitive
generation lane; `--drama-fidelity full` stays available where maximum depth
matters most. Artifacts: `{full,compact}-gemini.json`, `{full,compact}-gpt.json`.

## Recommendations

- **`compact` is now the DEFAULT drama fidelity** (the generator's `dramaFidelity`
  defaults to `compact`); `--drama-fidelity full` restores the original full
  recognition prompts for maximum-depth final artifacts. `last-six` stays the
  context-mode default.
- Use `--drama-fidelity public-only` for the plan's "cheap structural screen
  before full-fidelity paid runs" step.
- Use `--director-plan-cache` whenever iterating on cues/runtime against a fixed
  spec — it is a pure win with no quality cost.
- Treat `--context-mode ledger-recent` as a *behaviour* change to evaluate on
  long dramas for commitment-retention quality, not as a perf knob.
- The compact-default decision rests on: n=6 codex parity (Δ −0.17) + better
  gate-pass (5/6 vs 2/6) + −47% input, with the independent-critic de-confound
  showing only a small depth edge for full (−3.7%). If a larger run (more
  dramas/seeds) shows the depth gap widening, revert with a one-line default flip.
