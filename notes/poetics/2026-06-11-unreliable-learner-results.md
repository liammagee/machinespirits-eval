# The unreliable learner, adjudicated: telling works, blind detection sits at the incidental floor

**Date:** 2026-06-11 · **Status:** registered set complete (12/12), mechanically scored;
paper fold-in pending (§6.13 extension)
**Registration:** `UNRELIABLE-LEARNER-PREREG.md` (+ 2 dated amendments, both pre-result)
**Scoring (authoritative):** `exports/dramatic-derivation/unreliable-v1-scoring/{scores.json, report.md}`
(`scripts/score-unreliable-learner.js`, bootstrap seed 20260611)
**Qualitative color:** `exports/dramatic-derivation/unreliable-v1-scoring/run-observations.md`
**Design predecessor:** `notes/poetics/2026-06-10-unreliable-learner-design.md`

---

## 1. What ran

The registered visibility contrast: 12 paid runs, group `unreliable-v1`, serialized and
attended over 2026-06-10/11 (~3.5 h run wall-clock). Arm A (**told**) carries the SLIPPED
block in the live tutor ego prompt; arm B (**conduct**) suppresses it (`--decay-visibility
conduct`) — same engine, same decay, the tutor must read forgetting off the learner.
Decay `{rate 0.75, grace 1, maxConcurrent 2, from turn 1}`, seeds {1,2,3} × 2 worlds
(withercombe: stall-watch charter v3, cap 24, S at release-turn 19; nocturne: superego-only
charter v2, cap 40, S at release-turn 32) × 2 arms. Casting per amendment 2: director,
tutor, tutor-superego = codex; learner = claude/sonnet (pinned); critic = Fable. One
opus-directed run was superseded before the amendment and sits out of the scan
(`exports/dramatic-derivation/superseded/`).

Discipline held end to end: **94 releases across 12 runs, every one on cue — zero schedule
violations**, so the registered HALT condition never fired and the formal layer stayed
invariant under decay (the corruption channel touched only what it owns).

## 2. The adjudication (registration §6, scorer's verdict)

| arm | runs | decay events | tutor repairs | pooled per-slip | selected | successes |
|---|---|---|---|---|---|---|
| A (told) | 6 | 57 | 49 | **0.860** | 28 | 4 anagnorises |
| B (conduct) | 6 | 19 | 7 | **0.368** | **0** | 0 |

- **H1a PASS** — told pooled rate 0.860 ≥ 0.66.
- **H1b PASS** — selected repairs 4.67/run (≥1) and 57% of all told repairs (≥50%).
- **H1 SUPPORTED** — given knowledge of the slip, the tutor uses the repair affordance,
  and not as blanket re-statement: the majority of its repairs carry the selection
  signature (non-lastRelease target on a proof-path premise).
- **H2 SUPPORTED, B < A** — gap +0.491, run-level bootstrap 95% CI [0.313, 0.746]
  (10k resamples, seed 20260611), **0 of 10,000 resamples reversed**. The registered
  alternative reading (B ≈ A = fifth explicit-channel-redundancy result) is ruled out.
- **H3 (descriptive)** — conduct sits essentially at the §4 anchors for a tutor that
  never looks: pooled 0.368 vs incidental floor 0.33, decay/run 3.17 vs surfing 2.4.
  Told decay/run is 9.5 — elevated *because* repair re-arms eligibility (a repaired
  premise can slip again); far from the eager-anchor thrash (≈19–21).

## 3. The mechanism, run-internally legible

**Told arm = triage, not checklist.** All 28 selected repairs are true-path premises;
the recurring unrepaired slip is the *mirror-side* premise late in the play (withercombe:
m_taint abandoned on its third lapse in all three seeds, *after* the case moved past Bray;
nocturne: m_away left down near the close in all three seeds). Several true-path premises
are re-grounded on the recognition turn itself (p_course t21, p_watermark t36/t35). The
told tutor spends the channel where the proof needs it and lets scaffolding it no longer
needs stay down. Behavior is strongly reproducible: the three nocturne told runs are
near-twins (12 slips / 11 repairs each, anagnorisis t35–36), and at rate 0.75 the early
slip schedule is seed-invariant, so within-world same-arm runs replicate almost event for
event.

**Conduct arm = the incidental floor in vivo.** All 7 blind repairs classify as
incidental: next-turn restatements landing on the very turns the script was already
releasing/consolidating that premise (lastRelease), or mirror-premise re-statement during
scripted counter-mirror work. Zero selection signatures. The two failure textures:

1. **Stale residue masks decay.** The learner keeps *citing* slipped facts — the staged
   prose is still in its context even though the grounded board lost the premise — so its
   conduct affirms what it no longer holds. The blind tutor works the board it last saw.
2. **Lucky-leap-blocked aporia.** In nocturne the blind runs end with the learner
   asserting S unforced (lucky_leap ×7–8 per run) while a true-path premise sits
   unrepaired for at least 30 turns: it "knows" the answer, the board cannot compel it,
   and the run dies at D=1–2 (aporia ×2, disengagement ×1). In withercombe the blind runs never
   get that far — all three die on the window-6 stall clock at t7.

**Worlds split the outcome story, not the rate story.** Withercombe told runs still
mostly stall (1 of 3 completes — S arrives late relative to the stall clock), but they
repair at 0.76 while doing so; rate, not survival, is the registered endpoint, exactly as
the distributional design anticipated.

## 4. What this means for the arc

This is the **first explicit-information channel in the whole program that is not
redundant** — after four ToM-redundancy nulls (ontology ToM-feedback, stall-watcher
precondition, and kin), where telling the tutor what the learner "must be thinking" added
nothing because the model already inferred it from the transcript. The SLIPPED block is
different in kind: it carries **harness-owned hidden state that is structurally absent
from the dialogue**. The learner cannot report what it forgot (it doesn't know), and its
visible conduct actively *counter-signals* (stale residue). Visibility of that ledger is
worth +0.49 per-slip repair rate and is the difference between 4/6 and 0/6 completions.

The boundary this draws matches the standing adaptivity finding: gains come from **new
signal**, not from re-encoding inferable signal. Decay visibility is the clean positive
case — the first time the boundary has been demonstrated from the load-bearing side
within one registered design.

The caveat to carry into the paper: the design shows blind detection *did not happen*,
not that it *cannot*. Conduct carried weak signals (the lucky leaps; one superseded run's
learner explicitly named a missing premise at the death turn) that no role had the
jurisdiction or prompting to read as decay. "No signal" vs "signal unread" is not fully
separated by this contrast — that is the open v3 question (e.g. a superego-jurisdiction
detector, charter-v4 sketch in the design note §4.4), **not sanctioned**.

## 5. Bookkeeping

- Commits: runs 1–12 incremental (79394cb2 … 853bf663), adjudication 56a4a84b, prereg
  amendment 68603c6a; branch `claude/derivation-fast-iteration`.
- Critic notices: landed on 8 of 12 runs. Backfill debt (CLI timeouts / one 529 cluster):
  `npm run derivation:critic -- --label <x>` for `wit-decay-v1-A-s1`, `wit-decay-v1-A-s2`,
  `wit-decay-v1-B-s3`, `noc-decay-v1-A-s3`.
- Cost: all roles on CLI plan quota (codex + claude CLIs); metered spend $0.00.
- Next: fold into `docs/research/paper-full-2.0.md` as the §6.13 extension (the
  dramatic-derivation arc's section), with version bump + revision-history entry.
