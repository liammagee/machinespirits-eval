# unreliable-v1 — per-run conduct observations (qualitative color; scoring is scores.json's)

One bullet per run, recorded as runs land. The mechanical scorer
(`scripts/score-unreliable-learner.js`) owns all adjudication; these notes
exist for the eventual notes/paper fold-in.

- **[SUPERSEDED — opus director] wit-decay-v1-B-s1, first attempt** (artifacts:
  `exports/dramatic-derivation/superseded/wit-decay-v1-B-s1-opus-director/`):
  disengagement t7/24; decay m_taint@t3, p_course@t5, 0 repairs. Superseded by
  the second 2026-06-11 prereg amendment (director casting → codex for all 12
  runs); not in the scored set. The conduct observation stands as qualitative
  color: the channel *was* legible at the end — at t7 the learner explicitly
  names the lapsed premise as missing ("fedBy schoolWell fontHouse must also
  be traced … and entered, or the chain has no first link at all") — but t7
  is the turn the stall detector ends the run, so the blind tutor has no turn
  left to act on it. Earlier (t5-t6) the tutor's own lines kept *presupposing*
  fedBy on the board ("With only fedBy on the board…") — blind in the precise
  sense: it works the board it last saw. Critic's notice missing (Fable CLI
  timeouts).

- **run 1 — wit-decay-v1-B-s1 (conduct, seed 1, codex director)**:
  disengagement t7/24, 342.7s; decay m_taint@t3, p_course@t5 (same slip
  schedule as the superseded attempt), 0 repairs, byReadoption 0, releases
  3/3 on cue. Opposite conduct texture to the superseded run: here the
  learner *keeps citing the decayed fact as held* — t6 "the sexton's pipe
  named the source" after p_course slipped at t5 — the stale-residue
  mechanism the G2 note predicted (conduct need not betray a slip). What it
  names as missing are the never-released ground facts (foulAt, sweetAbove,
  residueAt), not the slipped premises. Critic's notice landed (322.7s):
  "slipped facts circulate as ghosts in the dialogue."

- **run 2 — wit-decay-v1-A-s1 (told, seed 1, codex director)**:
  grounded_anagnorisis t21/24, 982.8s, 87 calls; 9 slips, 8 tutor repairs
  (per-slip 0.889, mean latency 2.13 turns), 0 readoption, releases 9/9 on
  cue. First completed derivation under decay. The repair pattern reads as
  triage: m_taint (the *mirror* premise — Bray's tallow) was repaired twice
  while the mirror was dialectically live (t3→5, t6→7) and then abandoned on
  its third lapse (t8, the run's one unrepaired slip) just as the case moved
  up the slope past Bray; the true-path premises were repaired every time —
  p_course ×4 (last re-grounded on the recognition turn itself, t18→21) and
  p_lore ×2. The blind seed-1 sibling died at t7 with the same opening slip
  schedule. Critic's notice MISSING (3× Fable CLI timeout) — backfill:
  `npm run derivation:critic -- --label wit-decay-v1-A-s1`.

- **run 3 — wit-decay-v1-A-s2 (told, seed 2, codex director)**: disengagement
  t11/24, 529.2s, 47 calls; 6 slips, 4 tutor repairs (per-slip 0.667, mean
  latency 1.5), 0 readoption, 2 unrepaired (m_taint 3rd lapse t8 — the same
  mirror-premise abandonment as run 2 — and p_lore t9, lapsed two turns
  before the stall ended things), releases 5/5 on cue. The told channel does
  not buy survival: the tutor used it (and again triaged the mirror premise
  away on its third lapse) but withercombe's ground facts arrive late
  (S derivable at release-turn 19) and the window-6 stall clock fired at t11.
  Rate is the endpoint, not survival — this is the case the distributional
  design anticipated. Critic's notice MISSING (3× API 529 Overloaded —
  server-side, not the CLI-timeout mode) — backfill:
  `npm run derivation:critic -- --label wit-decay-v1-A-s2`.

- **run 4 — wit-decay-v1-B-s2 (conduct, seed 2, codex director)**:
  disengagement t7/24, 303.6s, 29 calls; 2 slips (m_taint@t3, p_course@t5 —
  the same opening schedule as seed 1, decay draws not yet diverged by t7),
  0 repairs, byReadoption 0, releases 3/3 on cue. Replicates B-s1's shape
  exactly: blind run, no repairs, dead on the window-6 stall clock at t7.
  Within-world the conduct arm is now 0/4 on repairs while its told siblings
  are 12/15. Critic's notice landed (325.1s).

- **run 5 — wit-decay-v1-B-s3 (conduct, seed 3, codex director)**:
  disengagement t7/24, 325.6s, 28 calls; 2 slips (m_taint@t3, p_course@t5),
  0 repairs, byReadoption 0, releases 3/3 on cue. All three withercombe
  conduct runs are near-replicas — same slip schedule (at rate 0.75 every
  seed slips at first eligibility; maxConcurrent 2 caps the rest), same t7
  stall death, 0 repairs each. Withercombe conduct total: 0/6 slips
  repaired. Quirk: this learner ran verbose at the end (one 9-sentence
  turn). Critic's notice MISSING (3× CLI timeout) — backfill:
  `npm run derivation:critic -- --label wit-decay-v1-B-s3`.

- **run 6 — wit-decay-v1-A-s3 (told, seed 3, codex director)**: disengagement
  t11/24, 482.8s, 46 calls; 6 slips, 4 tutor repairs (0.667, latency 1.5),
  0 readoption, releases 5/5 on cue. The slip-and-repair timeline is
  *identical* to A-s2's, event for event (m_taint d3→r5, p_course d5→r6,
  m_taint d6→r7, p_course d7→r9, m_taint d8 + p_lore d9 unrepaired): at rate
  0.75 the early decay schedule is effectively deterministic across seeds,
  and the told tutor's repair policy reproduces itself — including the
  third-lapse m_taint abandonment, now in all three told runs. Critic's
  notice landed (150.0s). **Withercombe block complete: told 16/21 slips
  repaired (0.762), conduct 0/6; told outcomes 1 anagnorisis + 2 stalls,
  conduct 3 stalls at t7.**

- **run 7 — noc-decay-v1-A-s1 (told, seed 1, codex director)**:
  grounded_anagnorisis t36/40, 1473.2s, 152 calls; 12 slips, 11 tutor
  repairs (0.917, mean latency 5.0), 0 readoption, 1 unrepaired (m_away@t35,
  one turn before close), releases 11/11 on cue. Nocturne's longer leash
  shows a different repair texture than withercombe: latencies stretch when
  slips pile up mid-play (p_watermark d19 not re-grounded until the
  recognition turn t36; m_style d24→r35) but nothing on the true path stays
  lost. D reversals 4 — the board visibly sags and recovers four times.
  Critic's notice landed (173.4s).

- **run 8 — noc-decay-v1-B-s1 (conduct, seed 1, codex director)**: aporia
  t39/40, 1981.3s, 165 calls; 4 slips, **2 tutor repairs — the first in the
  blind arm** (latency 14.5), 0 readoption, releases 11/11 on cue. But both
  blind repairs are *incidental*, not diagnostic: each is an
  `erotema → m_style (counter_mirror)` move — the tutor re-states the style
  premise while doing the mirror-deflation its script demands anyway
  (m_style d4→r8, d9→r34). Both land on the mirror premise; neither
  true-path slip was ever re-grounded (p_watermark down t7→end, 32 turns;
  p_stock t34→end). Consequence on stage: the learner asserts S unforced
  *eight times* (lucky_leap ×8, overreach ×15) while D sticks at 2 — it
  "knows" the answer but the board cannot compel it, recognition-by-luck
  blocked by the very premises the blind tutor never repaired. This is the
  incidental-floor mechanism from the §4 anchors operating in vivo, and the
  inverse of the told arm's selection signature (told repairs target the
  true path; blind repairs land where the rhetoric happens to walk).
  Critic's notice landed (226.6s).

- **run 9 — noc-decay-v1-B-s2 (conduct, seed 2, codex director)**: aporia
  t39/40, 1586.5s, 167 calls; 5 slips, 3 blind repairs (latency 11),
  0 readoption, releases 11/11 on cue. The scorer's classification makes
  the incidental mechanism legible run-internally: m_style t4→t5 and
  p_watermark t7→t8 are *lastRelease* repairs (each premise slipped on the
  very turns the script was releasing/consolidating it — the tutor restates
  it because that is the work, not because it noticed), and m_style's
  31-turn resurrection (t6→t37) targets the mirror premise during late
  counter-mirror work. Selected: 0. With this run pooled B sits at 0.333 —
  numerically AT the registered incidental floor (§4 anchor 0.33). Same
  endgame as B-s1: lucky_leap ×7, learner asserting S unforced while
  p_watermark (true path) stays down from t9 to the end; aporia at D=1.
  Critic's notice landed (218.6s).

- **run 10 — noc-decay-v1-A-s2 (told, seed 2, codex director)**:
  grounded_anagnorisis t36/40, 1445.3s, 152 calls; 12 slips, 11 tutor
  repairs (0.917, latency 5.18), 0 readoption, releases 11/11 on cue.
  Near-twin of noc A-s1: same verdict at the same turn, same slip and
  repair counts, same single unrepaired premise (m_away slipping at t35,
  one turn before close), and again a true-path premise re-grounded on the
  recognition turn itself (p_watermark d16→r36). The told arm's behavior
  is now strongly reproducible across seeds in both worlds. Critic's
  notice landed on attempt 2 (667.3s total, one timeout).

- **run 11 — noc-decay-v1-A-s3 (told, seed 3, codex director)**:
  grounded_anagnorisis t35/40, 1504.1s, 152 calls; 12 slips, 11 tutor
  repairs (0.917, latency 4.0), 0 readoption, releases 11/11 on cue. Third
  nocturne told run, third anagnorisis — same 12/11/1 slip-repair-unrepaired
  profile as seeds 1-2, and the one unrepaired slip is again the mirror-side
  premise (m_away d31). Seed 3's churn concentrated on the true path
  (p_watermark slipped five times, repaired five times — the fifth on the
  recognition turn t35). Heaviest D-reversal run of the told arm (4).
  Critic's notice MISSING (3× CLI timeout) — backfill:
  `npm run derivation:critic -- --label noc-decay-v1-A-s3`.

- **run 12 — noc-decay-v1-B-s3 (conduct, seed 3, codex director)**:
  disengagement t39/40, 1725.9s, 166 calls; 4 slips, 2 blind repairs
  (latency 1.0), 0 readoption, releases 11/11 on cue. Same opening slip
  schedule as conduct seeds 1-2 and the same incidental shape: m_style
  d4→r5 and p_watermark d7→r8 are next-turn restatements landing on the
  exact turns the script was releasing/consolidating those premises (the
  lastRelease classification), while each premise's *second* lapse (m_style
  d6, p_watermark d9) stays down to the end — p_watermark unrepaired for
  30 turns. Endgame is the arm's signature: lucky_leap ×8, overreach ×10,
  the learner asserting S unforced from t37 while D sticks at 1; formally
  this one ends disengagement rather than aporia (the only outcome
  difference from seeds 1-2). Critic's notice landed (156.2s).
  **Nocturne block complete: told 33/36 slips repaired (0.917 in each of
  3 runs), conduct 7/13; told outcomes 3 anagnorises, conduct 2 aporias +
  1 disengagement. Registered set complete: 12/12 runs, every release on
  cue, zero schedule violations. Arithmetic pooled rates ahead of the
  scorer: told 49/57 ≈ 0.860, conduct 7/19 ≈ 0.368.**
