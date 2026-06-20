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
a hand read — not an independent critic panel. Before promoting `compact` to a
default, run a larger set (several dramas × seeds) and score with the poetics
critic, comparing compact vs full on the dramatic-form rubric. `public-only` was
not quality-checked here (it is a screen by design); `ledger-recent` needs a
long-drama run to show commitment-retention value.

## Recommendations

- Keep `full` / `last-six` as the default (unchanged), as instructed.
- Use `--drama-fidelity public-only` (or `compact`) for the plan's "cheap
  structural screen before full-fidelity paid runs" step.
- Use `--director-plan-cache` whenever iterating on cues/runtime against a fixed
  spec — it is a pure win with no quality cost.
- Treat `--context-mode ledger-recent` as a *behaviour* change to evaluate on
  long dramas for commitment-retention quality, not as a perf knob.
- Adopt `compact` as a default candidate only after the quality comparison below
  shows parity with full.
