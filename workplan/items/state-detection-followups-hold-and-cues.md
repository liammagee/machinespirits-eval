---
id: state-detection-followups-hold-and-cues
title: "Detector follow-ups after closeout: cue retraining, live hold pairs on 037, stress-event fix, pre-push line-cap guard"
status: active
type: experiment
priority: P2
owner: claude
source: review
created: 2026-09-03
updated: 2026-09-03
verification: "Either the turn-2 and turn-4 template fallback on world-037 is explained offline and one recorded run shows a held plant meeting a model reply; or the six pooled with/without pairs are written up as a lean in the hold notes and this card closes with no further paid 037 pair."
claim_status: exploratory
depends_on:
  - state-detection-without-word-lists
links:
  items:
    - state-detection-without-word-lists
    - lesson-world-transfer
    - adaptation-planted-stress-bench
    - manner-trigger-tuning
  prs:
    - "https://github.com/liammagee/machinespirits-eval/pull/944"
    - "https://github.com/liammagee/machinespirits-eval/pull/982"
    - "https://github.com/liammagee/machinespirits-eval/pull/985"
  notes:
    - notes/poetics/hero-demo-runs/2026-09-02-step6-model-labels.md
    - notes/poetics/hero-demo-runs/2026-09-02-step6-form-v3-live.md
    - notes/poetics/hero-demo-runs/2026-09-02-step7-hold-live.md
    - notes/poetics/hero-demo-runs/2026-09-02-model-second-reader.md
    - notes/poetics/hero-demo-runs/2026-09-03-step7b-hold-rework-live.md
    - notes/poetics/hero-demo-runs/2026-09-03-step7c-hold-overconfident-live.md
    - notes/poetics/hero-demo-runs/2026-09-03-step6-pool-widening.md
    - notes/poetics/hero-demo-runs/2026-09-03-step7-quote-manner-cue.md
    - notes/poetics/hero-demo-runs/2026-09-03-model-second-reader-7b-7c.md
    - notes/poetics/hero-demo-runs/2026-09-03-step7d-hold-memory-limited-live.md
  exports:
    - exports/tutor-stub-outcome/step6-form-v3-live/
    - exports/tutor-stub-outcome/step7-hold-live/
    - exports/tutor-stub-outcome/step7b-hold-rework/
    - exports/tutor-stub-outcome/step7c-hold-overconfident/
    - exports/tutor-stub-outcome/step6-pool-widening-2026-09-03/
    - exports/tutor-stub-outcome/step7d-hold-memory-limited/
tags:
  - adaptive-tutor
  - detector
  - bench
  - hold-instrument
---

# Why this card exists

`state-detection-without-word-lists` closed on 2026-09-02 with the detector
shipped as form-v3. Work kept landing on that card for two more days (PRs
#944, #982, #985). The board rule puts new follow-up work on a new item, so
the record below moved here on 2026-09-03. Nothing in it changes the closed
card's verdict.

# What it shows, in short

- The detector reads the seen line shapes and stays quiet elsewhere. Retraining
  on a wider pool (form-v4) and one more closed-class cue (form-v5) moved the
  042 hold-out from 0/10 to 1/10 right kind with no wrong-fires. The cue set is
  the limit, not the pool.
- The card is a consistent lean, not a result: six with/without pairs, one
  dialogue per version, each within 0 to 2 plants. Pooled hold pairs 14/18 vs
  11/18 repair hits.
- The hold instrument now holds a planted state through a turn, but only with
  the reader and a retry (two more calls per held turn). It has never met a
  model reply on the held turns, because turns 2 and 4 on world-037 fall to
  the template reply in every run. More 037 pairs cannot change that.

# Open steps (offline only, no paid call without its own go)

1. Find out why turns 2 and 4 on world-037 fall to the template fallback.
   Read the traces in the exports above; do not run again.
2. A human second read of at least one blind packet is still open. The model
   reads (Sonnet, Opus) do not close it.
3. Then choose: a powered run (about six dialogues per version) on a world
   where the held turn meets a model line, or write the six pairs up as a lean
   in the hold notes and close this card. Do not widen to world-036.

# Also landed on PR #985, not detector work

- The stress plant trace event is recorded once per learner turn, not once per
  draft (a speech-check retry rebuilt the prompt and fired it twice). Lives in
  the stress schedule service; test extended.
- Pre-push line-cap guard: `npm run test:ratchets` finds every test that caps
  a source file's line count and runs them (nine files, about a second); the
  lint pre-push hook runs it after lint and blocks the push when a cap is
  over. PR #985 went red twice in CI on one of those caps before this existed.

Rails that stay: spend ceiling stated before any paid run, attended runs, no
resampling after a failure, no self-judging, indeterminate means stop. No
approval machinery beyond "the user says go".

# Record moved from the closed card (2026-09-02 and 2026-09-03)

- Candidate (a) model labels run, 287 Sonnet calls under a 300 ceiling. Right kind 53/66 vs form-v3 49/66; off-plant fires 35/205 vs 19/205. form-v3 stays shipped. Note `notes/poetics/hero-demo-runs/2026-09-02-step6-model-labels.md`. Labeller defect (bare model string to the bridge) fixed ed26216a9, no spend lost.
- **Live pair on form-v3 (037), 2026-09-02, paid.** Ceiling 100 calls per
  dialogue ×2 plus 20 judge calls; used 76 + 75 + 2. form-v3 read 4/6 plants
  right (form-v1 at step 4: 2/6, with 3 wrong-kind fires), 0 wrong kind,
  2 off-plant fires on 18 turns (step 4: 5). Judge (codex.gpt-5.6-sol, blind):
  repair HIT 4/6 with the card, 2/6 without; uptake 5/6 both arms. Lean, not
  result. Note `notes/poetics/hero-demo-runs/2026-09-02-step6-form-v3-live.md`;
  artifacts `exports/tutor-stub-outcome/step6-form-v3-live/`, archived.
- **Hold pair on 037, 2026-09-02, paid.** Schedule copy with `hold: turns 1`
  on plants 2 and 4 (6/7 and 9/10 are adjacent, so they cannot hold).
  Ceiling 200 dialogue + 20 judge calls; used 38 + 40 + 2, turn cap 12. Hold
  events fired at t3 and t5 in both arms. The sim dropped the state on all
  three held turns where the reply missed the release; the one held-looking
  turn is the answer-seeking plant, which the standing brief asks for anyway.
  The release text leaked into one plant line. Repair HIT 4/6 with, 3/6
  without (step 6 again). Next step is offline: stricter hold direction,
  release text hidden on the planted turn, with a test. Note
  `notes/poetics/hero-demo-runs/2026-09-02-step7-hold-live.md`; artifacts
  `exports/tutor-stub-outcome/step7-hold-live/`, archived.
- Model second reader on the three blind packets (3 calls, Sonnet 5, judge was codex): card effect keeps its direction on every packet, reader margin one plant (step 6: 4/6 vs 3/6; judge 4/6 vs 2/6); kappa on HIT vs not 0.67 / 0.50 / 0.31; move tags agree on half the items or fewer. Opus 5 read the same packets (3 more calls): step 6 5/6 vs 2/6, kappa 0.83; step 7 4/6 vs 2/6; step 4 (form-v1) reversed to 4/12 vs 5/12, so step 4 is not citable alone. A human reader is still needed; the model reads do not close that.
- Offline hold-block rework (2026-09-02, no paid call): release text hidden on the planted turn; held turn names the drop as the exception and makes the sim quote the releasing words on a private `HOLD:` line, stripped and recorded as `learner_stress_hold_verdict` with a `quoteFound` check. Canned-dialogue test `tests/tutorStubStressHoldWiring.test.js`. A paid 037 hold pair on the reworked direction needs its own go. Note `notes/poetics/hero-demo-runs/2026-09-02-model-second-reader.md`; script `scripts/score-blind-packet-model.js`.
- **Hold pair on 037 again, 2026-09-03, paid, on the reworked direction.** Ceiling 200 dialogue + 20 judge calls; used 40 + 40 + 2, turn cap 12. All four held turns wrote `HOLD: kept`, none claimed a release. The release leak is gone. Both t3 turns kept the state in speech (the brief asks for that line anyway); both t5 turns conceded five sixths in speech while marking `kept`, after the same template reply that shows the six-piece cut. Repair HIT 5/6 with, 4/6 without (within one plant of step 7). The hold still cannot show a card lifting a state the sim would keep. Next is offline (a speech-versus-verdict check, or a plant whose brief does not pull the same way); no re-run as is. Note `notes/poetics/hero-demo-runs/2026-09-03-step7b-hold-rework-live.md`; artifacts `exports/tutor-stub-outcome/step7b-hold-rework/`, archived.
- Offline follow-up (2026-09-03, no paid call): speech check built, opt-in `TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK=1`: a model read of the held-turn line against the planted state, one retry with the reading fed back when a `kept` verdict sits on a conceding line, all drafts recorded (`learner_stress_hold_speech_check`); unreadable reading stops the retry. Tests in the two stress test files. Next pair designed, not run: same hold schedule with the overconfident brief (`--auto-learner-profile overconfident`), so the t5 concession is not the brief speaking. Launch line in the step-7b note. Needs its own go and ceiling.
- **Hold pair on 037 a third time, 2026-09-03, paid: overconfident brief plus the speech check (step 7c).** Ceiling 200 dialogue + 20 judge calls; used 44 + 45 + 2, turn cap 12; a first judge pass hit a codex outage and was rerun an hour later. All four held turns wrote `HOLD: kept`; on three of four the spoken line conceded five sixths anyway, the reader caught all three, and the one retry kept the state each time by repeating the schedule's sample line near verbatim. So the verdict line is the weaker record and the reader is the one to trust; the hold now works but costs two calls per held turn and holds a sentence, not a stance. The overconfident brief opens with the right answer, so the opposed plant has her contradict herself; it moved the confound, did not remove it. Repair HIT 5/6 with, 3/6 without (with-arm same as 7b). Next is offline: one hold event per turn not per draft, a retry asking for her own words with the reader flagging a copy of the sample line, and a brief orthogonal to both plants (low_agency or memory_limited). No re-run as is; do not widen to 036. Note `notes/poetics/hero-demo-runs/2026-09-03-step7c-hold-overconfident-live.md`; artifacts `exports/tutor-stub-outcome/step7c-hold-overconfident/`, archived.
- **Pool widening on three new lesson worlds (041/042/043), 2026-09-03, paid.** Six plants-only dialogues (Sonnet and codex learners), ceiling 100 calls each; used 335 (24 on two failed starts) plus 6 judge calls. Both failed starts were world-text defects (a leaked answer word in 042, a duplicated clue sentence in 043), fixed offline and pinned by `tests/derivationWorldSurfacesPassTutorGuards.test.js`; the two Sonnet dialogues ran again as `d1` on the fixed worlds, the failed `d0` traces kept. All 32 plants realized; the irritated lines avoid "sound like". Detection offline on the 26 pressure plants: form-v3 (unseen) 4/26 right kind; form-v4, retrained on the widened pool and scored leave-one-world-out, 6/26; 042 reads 0/10 under both, and the three new irritated shapes ("reading off a card", "Oh come on", "I'm not five") are silent under both. On the eight hero hold-outs form-v4 equals form-v3 plant for plant (29/42, 0/6 wrong-fires). Shipped `config/manner-trigger/form-v4.json`, opt-in, pinned; form-v3 unchanged. Plain-tutor repair with no card, judge codex blind: HIT 18 / PARTIAL 4 / MISS 10, the t2 demand missed in all six. The pool is not the limit for the new shapes; the cue set is. Next is offline only. Note `notes/poetics/hero-demo-runs/2026-09-03-step6-pool-widening.md`; artifacts `exports/tutor-stub-outcome/step6-pool-widening-2026-09-03/`, archived.
- **One more closed-class cue, gated on 042 held out, 2026-09-03, offline.** Cue set `form-v3` = `form-v2` plus one conjunction, `quote_manner_challenge` (a quoted span plus, outside it, a demand to say it plainly or a challenge to the speech itself), and a quote matcher that no longer lets a straight apostrophe open a span; trainer takes `--feature-version`. Same pool, seed and hyper-parameters as form-v4. Gate: 042 held out 0/10 to 2/10 right kind (both irritated lines), wrong-fires 0/2, false alarms 2/28 unchanged. Elsewhere: 043 3/8 to 4/8, 033 63/214 to 68/214; 041 3/8 to 2/8, 036 7/10 to 6/10, 030 234/295 to 223/295, all losses near-threshold quote-less sound-like lines and deadline demands, not at the cue; hero hold-outs 29/42 to 28/42, false alarms 9/144 to 6/144, 0/6 wrong-fires. Same day, user call: the two Sonnet d1 re-run traces (042, 043) dropped from the pool; both cue sets retrained on the 106-trace pool, dropped traces held out. Gate on this pool: 042 held out 0/10 to 1/10 (the card line; Oh-come-on sits under the threshold), wrong-fires 0/2, false alarms 2/28; dropped traces as hold-outs 2/10 to 4/10; hero hold-outs 29/42 to 28/42; 030 227/295 to 215/295. Shipped `config/manner-trigger/form-v5.json` on the no-d1 pool, opt-in, pinned; form-v4 left as merged (trained with d1); nothing live. No paid run. Note `notes/poetics/hero-demo-runs/2026-09-03-step7-quote-manner-cue.md`.
- **Model second reads of the 7b and 7c packets, 2026-09-03, 4 paid reader calls.** Sonnet 5 and Opus 5 read each 12-item packet blind; compared with the codex judge on repair HIT vs not-HIT. Kappa: 7b Sonnet 0.50, Opus 0.80; 7c Sonnet 0.63, Opus 0.82. Card-effect direction (HIT with / without): judge 5/4 and 5/3; Sonnet 4/2 and 4/4; Opus 5/3 and 4/3. Opus reaches the arc's bar, Sonnet does not; every reader keeps with at or above without. Human read still open. Note `notes/poetics/hero-demo-runs/2026-09-03-model-second-reader-7b-7c.md`.
- **7c offline fixes, 2026-09-03.** The plant event fires once per learner turn, not once per draft; the speech-check retry asks for a line in her own words and the reader flags a near-verbatim copy of the sample line (`copy`, recorded, never enforced); the review sheet gains held-turn rows (kept, retried, copies). Tests extended. On the 7c traces the new rows read: held turns kept 4/4, retried 3/4.
- **Hold pair on 037 a fourth time, 2026-09-03, paid: memory_limited brief, own-words retry, form-v5 sensor (step 7d).** Ceiling 200 dialogue + 20 judge calls; used 44 + 42 + 2, plus 2 model second-reader calls; turn cap 12. All four held turns wrote `HOLD: kept`; the reader found one conceding line (with-arm t3) and the own-words retry kept the demand in a new sentence, not the sample line; the copy flag fired once, at without-arm t5, on a first draft the reader passed. The brief did not pull on either held plant, so the 7b/7c t3 confound is gone. Plant events once per turn. Repair HIT 4/6 with, 4/6 without (with-arm t2 template read as capitulate); three pairs pooled 14/18 vs 11/18. Second readers on the packet: Sonnet kappa 0.82, Opus 0.63, both keep with at or above without. The wall is the template fallback at turns 2 and 4 in every 037 run: until that reply is a model line a held plant cannot test the card. Next is offline (why t2/t4 fall to the template); no re-run as is; do not widen to 036. Note `notes/poetics/hero-demo-runs/2026-09-03-step7d-hold-memory-limited-live.md`; artifacts `exports/tutor-stub-outcome/step7d-hold-memory-limited/`, archived.
