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
