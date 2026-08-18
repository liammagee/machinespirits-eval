---
id: edged-register-outcome-study
title: Edged-register outcome study on a de-saturated baseline
status: active
type: experiment
priority: P2
owner: claude
source: manual
created: 2026-08-15
updated: 2026-08-18
verification: A powered main block (or a registered no-corridor kill verdict)
  answers whether router-selected ironic/sarcastic delivery beats the warm
  router on post-resistance conversion, on persona-scenario cells where the
  warm baseline converts at 30-70%. Each paid stage runs only after its own
  committed GO note plus explicit human approval.
claim_status: future
depends_on:
  - adaptive-register-switching
links:
  notes:
    - notes/2026-08-15-edged-register-outcome-study-design.md
    - notes/2026-08-16-edged-register-calibration-draft.md
    - notes/2026-08-09-adaptive-register-switching-prereg-draft.md
  code:
    - services/adaptiveRegisterSwitchingStage2.js
    - scripts/run-adaptive-register-switching-stage2.js
    - services/tutorStubEdgeTimingPolicy.js
tags:
  - registers
  - adaptive
  - outcome
---

Stage 2 of the register-switching arc returned NO_PRIMARY_EVIDENCE because
the warm control converted at .94 — the endpoint sat at the ceiling and the
study could not measure a difference. This card re-asks the outcome question
on learners the warm router does not already convert.

Design (see the linked note): three versions of the tutor — adaptive-edged,
yoked-warm (same router, same moments, warm delivery substituted at each
edge moment; prices manner at matched timing), and router-warm. A warm-only
calibration pilot first finds persona-scenario cells with conversion in a
30-70% corridor; if none exists the study stops with a registered kill
verdict. Primary endpoint: post-resistance conversion, adaptive-edged
versus router-warm, on corridor cells only. Stance-fidelity and
manner-presence run as gates; the person-directed-harm guardrail runs
report-only with a pause-for-review stop rule. face_threat stays out of the
menu (simulated-only rule). Sonnet-class judge from the first row.

The confirmatory-grid interaction signals (edged helps diligent, hurts
affective-resistant) are hypotheses only — that instrument was ruled
invalid. Stage order: build (no paid calls) → calibration pilot →
registration freeze from calibration evidence → main block. Nothing is
registered or authorized yet.

2026-08-16 operator rulings (recorded in the calibration draft note): the
four review amendments approved — first-edge-moment A-vs-B endpoint,
two-pass content/manner split on arms A and B, upper-80%-bound powering,
edge-eligibility screen as a keep condition. Stack pinned: generation
codex `gpt-5.6-luna`, judge claude-code Sonnet 5. Calibration at 4 lanes.

Stage 0 build is complete: hardened personas, two-pass payload seam, yoked
delivery swap, calibration runner, corridor selector with eligibility
screen, cells 206-208, tests. The GO note landed as commit `1a9b7034` and
the paid screen block ran from it.

2026-08-16 calibration finding (draft note §2.11): the person-directed-harm
matcher fired three times in 40 warm rows, every time on the two words
"your capacity" in praise of what the work builds. The operator read all
three turns and resumed unchanged. The matcher was written for turns
deliberately written to cut and was reused on warm turns untested. Before
the main block it must be replaced by a reader — a model reads every edged
turn, a human rules on its flags — and no detector that caps a **score**
enters a gate again without a hand-marked test set first. This repeats the
stance-gate 2.0 finding where the manner phrase list scored 1/15 against
readers at 19/20 and 15/15.

2026-08-16 screen block complete (draft note §2.12): 60 paid rows, all
resolved. Seven harm-tripwire pauses, all the two words "your capacity" in
praise of what the work builds, all ruled resume_unchanged. One cell dropped
at the floor (0/5), one at the ceiling (5/5). Ten cells survived; the §2.3
rule took the seven at 0.10 from .50 and left three at 4/5 unconfirmed. The
warm router converts at 33/60 pooled — de-saturated, unlike stage 2 at .94 —
so a corridor looks likely to exist, but no cell is kept until the confirm
block pools it to n=12 under §2.4.

2026-08-16 confirm block complete (draft note §2.13): 49 paid rows from the
GO note at `b03caee9`, 109 rows total against the 120 cap. Four rows timed
out once and all four passed on the retry, so no cell finished short of
n=12. Four more harm-tripwire pauses, eleven across the study, every one the
two words "your capacity" and none an attack; all ruled resume_unchanged.
`status_shame` and `coerced_uptake` never fired in 109 rows.

**A corridor exists.** Six cells kept: irrelevance_sustained 6/12,
question_flood_sustained 5/12, rote_parroting_sustained 6/12,
boredom_claimheld 5/12, boredom_guarded 5/12, rote_parroting_guarded 7/12.
Pooled 34/72 = 0.472, powering baseline 0.529 — against the .94 that killed
stage 2. frustration_claimheld was excluded by the edge-eligibility screen
(0/12 eligible rows) despite converting at 8/12; the screen changed an
outcome for the first time.

2026-08-17 M-C2 endpoint read complete — **the check FAILS** (draft note
§2.15). The operator read the first and last row of each kept cell blind to
the classifier: 4 of 12 disagreements, 33.3%, against a 20% bar. The
corridor estimates in §2.13 are void for selection and the endpoint must be
revised before registration. Three of the four disagreements run one way —
the learner keeps its resistance phrase at the front and does fresh work
behind it, and the classifier vetoes on the surface phrase. The fourth runs
the other way, so the rule is keyed to the wrong surface and misses in both
directions. Same defect class as §2.11 and the stance-gate 2.0 finding.

2026-08-17 revised endpoint written and applied (draft note §2.16, §2.17).
The operator ruled against spending a hand-marked test set. A blind model
reader sees the learner's earlier turn, the tutor's push and the learner's
next turn, and answers what task the tutor set and whether the learner did
it — a question a second reader can argue from the transcript. The
yes/partly/no-to-conversion rule was frozen at commit `b761bbbe` before any
per-cell number was visible: yes only is primary, yes-plus-partly is
reported beside it. No new generation; the same 109 paid rows.

Reader answers across 109 rows: yes 52, partly 47, no 10.

**A corridor exists on the revised endpoint.** Four cells kept —
question_flood_sustained 5/12, rote_parroting_sustained 5/12,
boredom_claimheld 7/12, rote_parroting_guarded 6/12, all 12/12
edge-eligible. Pooled 23/48 = 0.479, powering baseline 0.550. Dropped:
irrelevance_sustained 2/12 below the floor, boredom_guarded 9/12 above the
ceiling, frustration_claimheld excluded a second time by the
edge-eligibility screen (0/12 eligible) on a different endpoint.

**The corridor hangs on one line.** On the sensitivity reading (yes or
partly) every cell saturates at or above the ceiling and none is kept. The
mapping rule was frozen before the numbers, so the choice was not tuned to
the answer, but the weight sitting on that line is a fact about the study
and travels with it.

Operator spot check of the reader (§2.17.1): twelve rows drawn by fixed
spread from the yes/partly line inside the kept cells, six each way, all
twelve agree. Two limits — the reader states its answer first, so this
confirms rather than reads cold, and no bar is registered for this check
(the 20% M-C2 bar was for the old question).

2026-08-17 operator rulings — calibration CLOSED (draft note §2.18). The
revised endpoint is licensed for selection on the 12/12 spot check, with
its two limits recorded. The powering baseline is the measured 23/48 =
0.479 — a recorded deviation from the frozen upper-bound rule, in the
direction of a larger sample (about 95 dialogues per version of the tutor
for a 20-point lift, 172 for 15 points). None of the 11 remaining capped
rows are spent; the five n=5 cells stay dropped. Main-block cells:
question_flood_sustained, rote_parroting_sustained, boredom_claimheld,
rote_parroting_guarded.

2026-08-17 main-block registration FROZEN (draft note Part 3, operator
approved). Minimum effect of interest +20 points (0.479 to 0.679), ~95
dialogues per version of the tutor, ~285 rows over three arms, roughly 7
attended hours at 4 lanes. Arms: A = cell 207 (adaptive-edged, two-pass),
B = cell 208 (yoked warm delivery), C = cell 206 (byte-identical to the
calibration arm). Primary: A versus C on the model reader's yes, exact
test. Secondary: A versus B at the first edge moment. Pins recorded in
§3.5; the GO note re-computes them all and fails the launch on any drift.

Next: the GO note, headed DRAFT FOR HUMAN REVIEW — commands copied from
the runner's own usage output, seeds enumerated against the burned
ledger, pins re-computed. Launch needs explicit human approval on top of
the committed note. No paid call is licensed yet.

Owed before the main block (draft note §2.14): **fixed 2026-08-17.** The
runner overwrote the state file from memory on exit, which could silently
discard a ruling recorded by another process. Saving now re-reads the file
and merges the fields another process owns — rulings, guardrail
resolutions, killed cells — before the write. Five tests cover it; four
fail without the merge. The working rule stands anyway: never record a
ruling until the runner has fully exited.

2026-08-17 main-block runner support BUILT (commit 7df6ebf6, zero-call).
The plan builder computes the exact-test size the registration promised:
104 rows per version of the tutor (26 per cell, even split), 312 rows
over three arms, power .8035 (100 gives .790 and fails), hard cap 350.
This supersedes the ~95/~285 normal approximation above. Jobs interleave
so every consecutive dozen covers all 12 arm-by-cell pairs. Main plan
SHA-256 5fdae244543c7e017be4901a95db47a46095df8553df0f394813c0bd90e9d31d;
the calibration plan SHA is unchanged. `--dry-run-main` writes the
artifact the GO note copies from (one example command per arm);
`--main-block` sits behind the same GO-note + clean-commit gates. 41
edged-register tests pass; the two failing tutor-stub tests fail
identically at the parent commit. Still next: the GO note, human-gated
as above. No paid call is licensed yet.

2026-08-17 first main-block launch ABANDONED, and the harm matcher
re-registered (draft note §3.7, amendment 1). The block launched at
05:32 UTC and latched at 05:40 after four rows: two of the four raised a
harm flag, both on the same two words `your capacity`, neither an attack
— one turn states what would count as evidence, the other restates the
learner's claim. Those are the same two words behind all 11 calibration
matches in 109 rows. Under the calibration rule a 312-row block would
have stopped about every twelfth row, for eight hours, over a phrase the
tutor uses to teach. Six paid rows exist and are dropped.

The amendment touches the main block only and changes what a match
*does*, never the word list. Every match still runs on every turn and is
written to the record; a model reader
(`services/edgedRegisterHarmReader.js`) then answers one question — does
this turn attack the learner as a person — and only its yes pauses the
block. The three resume options are unchanged. It fails closed on a
failed call, an unparsable reply, an unreadable log, or a match past the
priced ceiling of 700 reader calls. Five validator checks refuse a plan
that drops the reader, opens the fail path, narrows the families or
lowers the ceiling. `EDGED_REGISTER_CALIBRATION.guardrail` is
byte-identical, so the calibration plan SHA stays `121b55d1…`; the main
plan SHA moves to
`31b7d77bfe7832a3e8b8f729753128432760ed5d7dbf151ac85c5519d52ed607`,
which is why the launched batch is abandoned rather than resumed.

The other half of §2.11 — "a model reads every edged turn" — lands
after the block, not inside it:
`scripts/read-edged-register-harm-sweep.js` reads every tutor turn of
the edged arm, match or no match, and reports the two channels apart
(attacks the list missed, matches the reader cleared). Arm A holds
exactly 104 of the 312 jobs at a measured 4 tutor turns per row, so the
sweep is bounded at 416 calls; the 350-row cap counts attempts, not
completed rows, and does not raise it.
What this gives up, plainly: a confirmed attack in the edged arm is seen
after the block rather than during it. 15 new zero-call tests; hermetic
suite 8801/8806 with the two known tutor-stub failures unchanged.

2026-08-17 amendment 2 — the GO gate read a word, not a signature (draft
note §3.8). Found while writing the replacement GO note, before any
launch. The runner's check matched `\bGO\b` anywhere in the text, which
every draft's own title carries, so a note headed DRAFT FOR HUMAN REVIEW
— NOT SIGNED passed it. Fourth instance of the same defect class in this
study, after the stance phrase list (§2.11), the conversion classifier
(§2.15) and the harm word list (§3.7): a surface match standing in for
the thing meant. Fix is deterministic and zero-call — `GO` must sit on a
line of its own, and a note carrying its draft banner is refused. All
three historical signed notes still pass. Both plan SHAs unchanged; the
runner moves to blob `429db35f`.

Replacement GO note drafted at
`notes/2026-08-17-edged-register-main-block-go-2.md`, headed DRAFT FOR
HUMAN REVIEW: new plan SHA `31b7d77b…`, fresh batch id
`batch-main-2-2026-08-17`, pins re-computed, the harm reader and the
post-block sweep priced. It carries signing instructions and by design
fails the gate until signed. No paid call is licensed yet.

2026-08-17/18 main block COMPLETE. The operator signed the replacement
note and launched at eval commit `0c37ac7f`. 312 rows attempted, 312
completed, no retries, cap 350 untouched, 8h32m at 4 lanes, 104 rows per
version (adaptive-edged 207, yoked warm delivery 208, router-warm
control 206). Amendment 1 held: the word list matched 16 times, every
one on `your capacity`, the reader cleared all 16, the block never
paused, 16 of 700 reader calls used. Under the old rule it would have
stopped 16 times. Archived to the private repo at `9aa0e508` (run) and
`b3c81dc9` (ledger) — nothing pushed.

Transcript-loss trap found before it bit: `archive-run-artifacts.js`
copies the batch folder, but this runner writes dialogues to the shared
data root, so the script alone saves the job logs and loses the
transcripts. The 312 transcripts were selected by `dialogue_id` for this
batch's row ids and copied by hand (54 MB). Written into the private
repo's `RUN-LEDGER.md` for later batches.

Post-block harm sweep run over both two-pass versions — the edged one as
priced (390 turns, bound 416) and the yoked warm one on the operator's
separate approval in chat (390 more, outside the priced bound,
disclosed in draft note §3.9). Result: 8 turns called an attack out of
780, split 4 edged / 4 yoked warm, all eight the same figure — the tutor
names the learner an "answer vending machine". The word list fired on
none of them, and the reader cleared all 11 turns the list did fire on,
so the two channels overlap on nothing. That is the fifth measured
instance of the surface-match defect class. A free grep over the 312
archived transcripts puts the figure in 14/104 edged, 20/104 yoked warm
and 0/104 control dialogues, so it rides in the shared content payload
rather than the edged delivery, and warm delivery keeps it.

Operator ruling 2026-08-18: record as a finding, keep all 312 rows. No
dialogue dropped, no cell killed. The endpoint is untouched — §2.11
keeps harm reading out of the measured outcome. Next: the endpoint
analysis on the frozen rules (edged-versus-control exact test on the
reader's yes; edged-versus-yoked read at the first edge moment), which
the signed note licenses without new approval.

Endpoint analysis run 2026-08-18. The registered primary — edged menu
against warm control, exact test on the reader's yes — rejects, and it
rejects against the study's bet: 59/104 = 0.567 for the edged version
against 74/104 = 0.712 for the warm control, difference -0.144, two-sided
p = 0.043. Yes-plus-partly saturates in both (0.952 against 0.962,
p = 1.0) and selects nothing, as registered. The loss sits in two of the
four scenarios. The block was powered against a control baseline of
0.479 and the control converted at 0.712, so the powering basis did not
hold.

The registered secondary cannot be run. The yoked delivery swap never
fired: 0 of 390 turns in either two-pass version carry an edge-moment
mark or a delivery swap, and the yoked version delivered edged manner as
often as the edged one (49% against 45%). Cause: both the swap and the
edge mark are gated on a state stamp that only the older assigned-arm
path writes, and cells 207/208 use the widened router menu instead, so
the gate never opens and `yoked_delivery_swap: true` is inert. Cell 208
ran as cell 208's twin of 207. The unit test passed because it fed the
stamp in by hand, so nothing checked the shipped cells. Full evidence,
cause and consequences in draft note §3.10.

What this costs: the primary prices the router's register MENU, not
delivered manner. The claim "edged delivery lowered conversion" is not
available; "an edged-inclusive menu lowered conversion" is. The yoked
version becomes an unplanned replicate (66/104 = 0.635 against control,
p = 0.301; against the edged version p = 0.396). Pooling the two edged
samples gives 125/208 = 0.601 against control, p = 0.061 — recorded as
descriptive, not promoted to an endpoint.

One descriptive reading worth keeping: the edged menu did not silence
the learner. It produced the most new material of the three versions
(86% against 80% warm) and the fewest completions, and all five of its
refusals still carried new questions. The learner moved into questioning
and open refusal rather than stopping. `fresh_work` was never registered
and is not promoted here.

Next: re-register arm B so the swap actually fires, then re-run that
version alone (~104 dialogues). Needs a fresh GO note and operator
sign-off on cost. Handed to a separate session 2026-08-18.

Surface-style check on the 312 archived transcripts, free, 2026-08-18.
Null: the edged menu did not change how the learner writes. Words per
turn 59.1 sharp against 59.9 warm; questions as a share of sentences 12%
against 13%; refusing, answering back and hedging all within noise (7, 4
and 5 turns out of 182). Flat in all four scenarios, including the two
where conversion diverged. The measured conversion difference lives in
what the reply does with the task, not in its surface. Descriptive only,
never registered, not promoted.

Confound, recorded in draft note §3.10.1. The primary is clean — the
version was randomised. The turn-level question is not: the router
issues a sharp register ONLY after the learner signals resistance (0 of
326 non-resisting turns across both edged versions drew one), so sharp
turns follow more resistant learners by construction. Restricting to
resisting turns does not repair it — the router still chose warm on 91
of them for unrecorded reasons. Three fixes named: randomise the
register at eligible moments (the older assigned-arm path already does
this, and cells 207/208 lost it by moving to the widened menu); yoke the
content and randomise delivery alone (arm B as designed); counterfactual
replay from one prefix, which is the only design that prices a single
turn's tone. The first two belong in the re-registered arm B.

Correction to that confound entry, and a defect in the read window,
recorded in draft note §3.10.2, 2026-08-18. The first split turn IS
matched: turn 0 is `brisk` in all 312 dialogues, resistance at turn 1 is
near-identical across versions, and the register then splits by version
almost perfectly (sharp on 104 of 104 in A, 102 of 104 in B, warm on 104
of 104 in C). The confound applies to turns 2 and 3 only. Separately,
locating each scored turn from the reader's own stored quote (301 of 312
located) shows 75 rows scored at turn index 1 — all of them
`rote_parroting_guarded`, spread evenly across versions — where the
learner writes before any sharp register has been delivered. Those rows
cannot carry a tone effect and score ~0.88 in every version. The
re-registration must move that scenario's window past the split.

Post-hoc restriction, descriptive only, never promoted. Dropping the 75
pre-split rows: sharp 35/76 = 0.461, twin 44/75 = 0.587, warm 50/75 =
0.667, exact test sharp against warm p = 0.0138. The gap widens from
-0.144 to -0.206. The registered primary stands unchanged at 0.567
against 0.712, p = 0.043.

What the learner does differently: it hands in an incomplete answer, it
does not refuse. The movement is between yes and partly; refusals are 5
against 2 on the restricted set. A reading that the sharp learner states
a test but withholds the verdict did NOT survive counting — conditional
words run 2.62 / 2.09 / 1.88 per 100 words (right direction, small) but
replies naming a verdict run 13% sharp, 25% twin, 12% warm, with the
twin highest. Recorded as rejected so it is not rediscovered. Which of
the task's three parts drops would need a second, priced read of the
transcripts already on disk — not proposed, not approved.

Both follow-ups (re-registered arm B, counterfactual replay) are handed
to a separate session, 2026-08-18.

Second read of the 312 archived transcripts, done 2026-08-18, recorded in
draft note §3.10.3. A blind reader split the tutor's task into its parts
and judged each part on its own. Result is null and it weakens the
headline. The sharp tutor does not ask for more (2.94 parts against 2.94,
p = 1.00), so "partly" is not a longer task. No kind of part drops. The
one measure that looked like an answer — stating a verdict, sharp 0.300
against warm 0.508, p = 0.025 post-split — fails its own control, because
the two same-treatment repeats differ at p = 0.011, wider than the claim.
Cells 207 and 208 differ only by the dead `yoked_delivery_swap` flag, so
the block ran the sharp condition twice; pooling both repeats gives the
primary at 0.601 against 0.712, p = 0.061, and every part-level measure
null (p = 0.13 to 0.83). The registered A-against-C test stands as
registered at p = 0.043, but the effect showed in one repeat of two.
Further reads of this block are not worth buying. Only a fresh
registration with a working delivery swap can price delivered manner.
Reader script `scripts/read-edged-register-task-parts.js`; sheet
`task-parts-readings.jsonl` in the batch directory.

Power check, 2026-08-18, added to draft note §3.10.3. The block cannot
resolve the effect it saw. Against the observed control rate of 0.712,
one repeat of 104 against 104 catches a 20-point drop at 80% power and
both repeats together catch 17 points; the observed drops are 14.5, 7.7
and 11.1 pooled. Power against the pooled observed drop is 48%. So one
repeat clearing .05 and the other not is what a half-powered block does,
not a sign the effect is spurious. The two sharp repeats both sit below
the warm control (0.567 and 0.635 against 0.712), same direction twice.
Reading: a small harm, unresolved, no mechanism found. Any follow-up
must be powered off the real baseline of 0.712, not the registered 0.479.
