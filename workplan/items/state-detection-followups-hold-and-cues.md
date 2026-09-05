---
id: state-detection-followups-hold-and-cues
title: "Detector follow-ups after closeout: cue retraining, live hold pairs on 037, stress-event fix, pre-push line-cap guard"
status: active
type: experiment
priority: P2
owner: claude
source: review
created: 2026-09-03
updated: 2026-09-04
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
    - "https://github.com/liammagee/machinespirits-eval/pull/996"
    - "https://github.com/liammagee/machinespirits-eval/pull/1010"
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
    - notes/poetics/hero-demo-runs/2026-09-04-step7-template-fallback-cause.md
    - notes/poetics/hero-demo-runs/2026-09-04-step7e-opus-tutor-seat-check.md
    - notes/poetics/hero-demo-runs/2026-09-04-hold-speech-check-opus-reread.md
    - notes/poetics/hero-demo-runs/2026-09-04-step6a-opus-labeller-check.md
    - notes/poetics/hero-demo-runs/2026-09-04-step7-offline-matcher-fix.md
  exports:
    - exports/tutor-stub-outcome/step6-form-v3-live/
    - exports/tutor-stub-outcome/step7-hold-live/
    - exports/tutor-stub-outcome/step7b-hold-rework/
    - exports/tutor-stub-outcome/step7c-hold-overconfident/
    - exports/tutor-stub-outcome/step6-pool-widening-2026-09-03/
    - exports/tutor-stub-outcome/step7d-hold-memory-limited/
    - exports/tutor-stub-outcome/step7e-hold-opus-tutor/
    - exports/tutor-stub-outcome/hold-speech-recheck-opus/
    - exports/form-state-detector/
    - exports/first-draft-audit-replay/
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
- The template wall is not bound to Sonnet 5: with Opus 5 in the tutor seat
  the same turns fell the same way (step 7e). The codex seat is the one seat
  that clears it; the other ways are code changes.
- Model second readers (Sonnet, Opus, Fable) each range from kappa 0.50 to
  0.83 across the four packets; no reader is above the others throughout.

# Open steps (offline only, no paid call without its own go)

1. Done 2026-09-04, offline. Turns 2 to 5 are the four clue turns; the
   guard wants the clue text character for character, Sonnet 5 rewords it
   (turn 4 drops only the quotation marks), the recovery is not told what
   failed, and the clue-insertion repair was off in every hold run
   (`TUTOR_STUB_CLUE_INSERTION` unset). Note
   `notes/poetics/hero-demo-runs/2026-09-04-step7-template-fallback-cause.md`.
2. A human second read of at least one blind packet is still open. The model
   reads (Sonnet, Opus) do not close it.
3. Offline matcher and packet fix done 2026-09-04; live confirmation
   needs a paid run. Options 3 and 4 of the cause note are built: the clue
   check accepts a draft that differs from the clue text only in quotation
   marks (dropped or straightened), the presented-exhibit cue says "copied
   word for word, once", and the plain recovery packet names the failed
   check and what it requires. A zero-call replay on the ten recorded 037
   hold dialogues (7 to 7e): of 59 drafts the clue check rejected on turns
   2 to 5, 20 now pass, all of them at turn 4; 13 of those carry no other
   hard issue. Turns 2, 3 and 5 gain nothing offline (0 of 39): 33 reword
   the clue, 6 differ in one letter's case. Turn 5 first drafts all fail
   the duplicate check, which is unchanged. Note
   `notes/poetics/hero-demo-runs/2026-09-04-step7-offline-matcher-fix.md`;
   script `scripts/replay-first-draft-audit.js`. What still needs a paid
   run: whether the new cue and packet get a copied clue at turns 2 and 3,
   whether the duplicate check clears at turn 5, and a model line on the
   held turns. Then choose: one hold pair on the current code (the
   clue-insertion flag and the codex tutor seat stay as the other two
   ways; the Opus tutor seat is ruled out by step 7e), or write the seven
   pairs up as a lean in the hold notes and close this card. Do not widen
   to world-036.

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
- **Template-fallback cause, 2026-09-04, offline, no paid call.** Read the
  eight 037 hold dialogues (7, 7b, 7c, 7d) and the archive traces of earlier
  runs. Turns 2 to 5 are world 037's four clue turns and the only turns where
  the guard's exact-text check can fail; turns 6 to 12 all shipped as model
  lines. On clue turns: t2 7/8 and t3 6/8 rewordings, t4 8/8 whole text with
  the curly quotation marks dropped, t5 8/8 exact but rejected as duplicate
  delivery (a one-line arithmetic clue restated while explaining it). The
  plain recovery fails the same way on every turn; its prompt says only that
  a check failed. Cross-run: step-6 pool worlds 24/27 clue turns to template
  vs 2/70 no-clue turns; codex tutor seat 6/472 clue turns to template
  (its recovery copies text), Sonnet 5 from Aug 7 on 75 to 100%.
  Early-August Sonnet runs shipped most clue-turn misses through clue
  insertion (87/133, 36/53); that path is opt-in and was unset in every hold
  launch line. Four ways to a model line are listed in the note; none chosen
  here, no runtime change. Note
  `notes/poetics/hero-demo-runs/2026-09-04-step7-template-fallback-cause.md`.
- **Hold pair on 037 with Opus 5 in the tutor seat, 2026-09-04, paid (step 7e).** The model check the new CLAUDE.md rule asks for (PR #996). Ceiling 200 dialogue + 20 judge calls; used 42 + 41 dialogue, 2 judge, 3 second-reader; turn cap 12; everything else as 7d. Template fallback: with-card t2, t4, t5; without-card t4, t5; t3 with-card saved by the plain recovery. The drafts fail the same three ways as on Sonnet (reworded clue, quotation marks dropped, clue in two sentences). Holds kept 3/4 (without t3 released). Repair HIT 2/6 with, 3/6 without; five pairs pooled 16/24 vs 14/24. Second reads of this packet: Sonnet kappa 0.83, Opus 0.66, Fable 0.50. Fable reads of the 7b, 7c, 7d packets the same day, 3 calls: 0.64, 0.82, 0.67. The wall is not model-bound on the Claude side; next is offline or the codex seat, no re-run as is. Note `notes/poetics/hero-demo-runs/2026-09-04-step7e-opus-tutor-seat-check.md`; artifacts `exports/tutor-stub-outcome/step7e-hold-opus-tutor/`, archived.
- **Opus 5 re-read of the recorded hold speech checks, 2026-09-04, 16 paid reader calls.** The
  reader-seat check the CLAUDE.md model-bound rule asks for. `scripts/replay-hold-speech-check.js`
  sent the 16 recorded Sonnet prompts of steps 7c, 7d and 7e to Opus 5 (7b predates the check).
  13 of 16 agree, kappa 0.48. All three differences run one way: Sonnet reads a line that
  concedes the answer and still pushes to move on as dropping the state; Opus reads it as
  holding. Retry counts are reader-bound (5 under Sonnet, 2 under Opus); every final verdict
  stayed `kept` under both, so the hold-kept tallies stand. Note:
  `notes/poetics/hero-demo-runs/2026-09-04-hold-speech-check-opus-reread.md`.
- **Opus 5 check of the step 6a model labeller, 2026-09-04, 287 paid calls under a 300 ceiling.**
  The labeller-seat check the CLAUDE.md model-bound rule asks for. Same 14 traces, same
  prompt, `claude-code.claude-opus-5`. Right kind at pressure plants 53/66 (Sonnet 53/66,
  form-v3 49/66); quiet plants 10/12 (8/12, 7/12); off-plant fires 57/205 (35/205, 19/205).
  Sonnet and Opus agree on 231/287 turns, kappa 0.69; both fire together on 29 unplanted
  turns, mostly "so what do I write" lines. Opus also reads the closing summary turns as
  bored or forgetting. The step 6a finding stands on a second model: a model reader gains a
  few right reads and fires far more off plant; form-v3 stays shipped. New
  `scripts/compare-learner-state-labels.js` joins label files with a form-v3 replay. Note:
  `notes/poetics/hero-demo-runs/2026-09-04-step6a-opus-labeller-check.md`.
- **Paper paragraph, 2026-09-04.** §6.24 of `docs/research/paper-full-2.0.md` (v3.0.303, PR #1010)
  now records the September detector work: the re-read of the v6/v7 held-out figure, form-v1..v5
  with their leave-one-world-out numbers, the form-v3 live pair, the labeller comparison with its
  Opus 5 check, the four-row sheet, and the hold instrument's template wall.
- **Paper sentence, 2026-09-04.** §6.24 (v3.0.304) now also records the reader-seat check
  from PR #1001: Opus 5 re-read the 16 recorded Sonnet 5 hold speech checks, 13/16 agree,
  kappa 0.48, retries reader-bound, every final verdict kept. The scope line and provenance
  name the re-read. Tag `paper/v3.0.304` and the ref-status follow-up come after merge.
