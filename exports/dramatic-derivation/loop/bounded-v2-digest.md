# bounded-v2 paid pair — cross-arm digest

Group `bounded-v2-probe` · world `world-001-nocturne` · script `nocturne-v002` · 2026-06-12.
Scoring plan fixed mid-pair in `notes/poetics/2026-06-11-act-bounded-learner-design.md` §5
(after the ON arm was read, before the OFF arm landed — disclosed there).
Diagnostics computed by `bounded-v2-contrast.mjs` from each arm's `result.json` only.

Both arms: stage v2 (acts, director-judged termination, min 3 / max 8 turns), bounded learner,
decay `{rate:0.75, graceTurns:1, maxConcurrent:2, startTurn:1, mutateShare:0.33, seed:1}`.
ON = `--reconstruct` (tutor commits a per-turn theory of the learner's board);
OFF = default tutor mechanisms, no theory channel.

**Structural fact** (recorded per §5): nocturne has 0/13 mutable premises, so
`mutateShare 0.33` degrades to delete-only — `mutations.total = 0` in both arms.
**This pair tests recall only.** The revise test needs a mutable world (lantern, 5/10);
that is a registered follow-up requiring separate sanction.

## Headline table (harness-ledgered quantities)

| quantity | ON (reconstruct) | OFF (default) |
|---|---|---|
| verdict | grounded_anagnorisis | grounded_anagnorisis |
| turns | 38/40 | 32/40 |
| forced → asserted gap | 0 (t38→t38) | 0 (t32→t32) |
| slips (per turn) | 9 (0.237) | 5 (0.156) |
| repaired (tutor / readoption) | 8 (8/0) | 3 (3/0) |
| repair rate | 0.89 | 0.60 |
| mean repair latency (turns) | 7.25 | 5.33 |
| unrepaired at end | 1 (m_away) | 2 (m_style, m_away) |
| degraded integral (per turn) | 62 (1.63) | 51 (1.59) |
| F final / min | 0.933 / 0.714 | 0.867 / 0.714 |
| D reversals | 3 | 1 |
| acts (director / max / run_end) | 7 (6/0/1) | 5 (4/0/1) |
| lucky leaps / overreaches | 6 / 19 | 0 / 3 |
| releases on cue | 11/11 | 11/11 |

Exposure caveat (§5): same seed ≠ same slip schedule. Repairs free `maxConcurrent`
slots and the ON arm ran 6 turns longer, so ON's higher slip count is partly
self-inflicted exposure. Compare repair economy, never per-slip outcomes.

## Same-act vs cross-act repairs

Cross-act recall is tutor-only by construction (the bounded learner sees only the
current act's releases; it cannot re-adopt what it can no longer see).

- **ON**: 2 same-act, 6 cross-act, 1 never. Episodes: m_style t4→5 (A1, lat 1),
  m_style t6→11 (A1→A2, 5), p_watermark t8→10 (A2, 2), p_stock t10→19 (A2→A3, 9),
  m_style t12→34 (A2→A6, 22), m_away t19→23 (A3→A4, 4), p_stock t23→30 (A4→A5, 7),
  p_watermark t30→38 (A5→A7, 8), m_away t34→never.
- **OFF**: 0 same-act, 3 cross-act, 2 never. Episodes: m_style t4→never,
  p_watermark t7→8 (A1→A2, 1), p_watermark t10→16 (A2→A3, 6),
  p_stock t16→25 (A3→A4, 9), m_away t25→never.

In both arms the restoration channel was the tutor reaching across act boundaries;
the learner re-adopted nothing. The bounded-learner design did what it was built to
do — removed learner self-repair — and the tutor compensated, with or without the
theory channel.

## Proof-path triage (the cleanest cut)

Split slips by whether the premise is a base leaf of the secret's proof tree:

| | ON | OFF |
|---|---|---|
| proof-path slips repaired | **4/4** (lat 2,9,7,8 · mean 6.5) | **3/3** (lat 1,6,9 · mean 5.3) |
| mirror-prop slips repaired | 4/5 (lat 1,5,22,4) | 0/2 |

**Every proof-critical slip was repaired in both arms, at similar latency.** The
entire headline repair-rate difference (0.89 vs 0.60) is mirror-prop housekeeping.
The OFF arm triaged — it spent zero repairs on the false trail's props (its critic
called those losses painless); the ON arm also tended the mirror, including a
22-turn-latency m_style restoration at t34 while the proof-critical p_watermark
(slipped t30) stayed down through the staged assertion at t32.

## Repair selection signature

Reach-back = the move's `targetPremise` is not the most recent release (i.e. the
tutor deliberately went back for a slipped premise rather than consolidating the
newest evidence).

- **ON**: 7/8 repairs are reach-backs (intents: consolidate ×6, counter_mirror ×2).
- **OFF**: 2/3 reach-backs (all consolidate).

The default tutor already reaches back deliberately. Deliberate repair targeting is
not a gift of the explicit theory channel.

## ON-arm theory channel (reconstruction)

- Detection: 9/73 gap instances caught (12.3%).
- Missing-set Jaccard (believed_missing vs truth.missing): mean **0.171**, by act
  A1 0.43 · A2 0.08 · A3 0.12 · A4 0.10 · A5 0.20 · A6 0.00 · A7 0.17 — no
  calibration trend. (The diagnosis's `meanHeldJaccard` 0.637 is the held-set/board
  overlap, an easier target since the board is mostly intact on most turns.)
- Coupling, theory→repair (k=3): 2/8 repairs were preceded within 3 turns by a
  theory commit naming the premise missing (p_stock@t19, m_style@t34).
- Coupling, converse (k=3): 2/9 caught gap instances were followed by a repair of
  that premise within 3 turns.

The theory and repair channels ran mostly independent of each other. The one repair
the theory plausibly steered (m_style named missing t31–33 → repaired t34) chose a
mirror prop over the proof-critical p_watermark, which was down at the time — the
exact defect the ON critic flagged (staged recognition t32, lawful t38). One
instance; suggestive, not established.

## Reading (per §5 frame — descriptive, n=1 per arm)

The OFF arm's repair economy on what matters is at least as good as the ON arm's:
proof-path repair 100% in both at similar latency, identical verdict, zero
forced→asserted gap, near-identical per-turn degraded integral (1.59 vs 1.63), and
a cleaner dramatic line (no lucky leaps, 3 overreaches vs 19, no staged/lawful
split). The explicit reconstruction channel detected little (12.3%), coupled to
repairs weakly (2/8, 2/9), and its one visible influence picked the wrong priority.

**Conclusion: explicit theory reconstruction added nothing detectable over the
default tutor mechanisms on the recall test** — consistent with the arc's standing
ToM-redundancy result (ontology-ToM null, stall-watcher precondition null, §6.8
bilateral-ToM, §6.10 concealed-interior). What the pair does establish, twice and
independently: a bounded learner under aggressive forgetting can still earn a
grounded ending, because the default tutor already reaches back across act
boundaries for proof-critical premises. The open question is **revise** (mutated,
not deleted, beliefs) — untestable on nocturne; lantern follow-up registered,
separate sanction required.
