---
id: qwen-refusal-continuity-retest
title: "Let hostile Qwen refusal evolve after concessions and re-test"
status: done
type: experiment
priority: P2
owner: codex
source: manual
created: 2026-08-31
updated: 2026-09-01
verification: "Abliterated learner/bilateral superego follow-up: 24 generation + 8 Opus = 32/100; both dialogues complete, 7/8 valid assessments, final malformed nonempty judgment preserved without resampling. All seven public drafts and exit flags unchanged after review. Private report browser-checked in light/dark desktop modes. 62 preflight tests and 15 post-failure scoring tests pass. No push or publication."
claim_status: exploratory
links:
  notes:
    - notes/qwen-refusal-continuity-v1-design.md
    - notes/qwen-refusal-continuity-v2-design.md
    - notes/qwen-refusal-dag-restored-v1-design.md
    - notes/qwen-refusal-bilateral-superego-v1-design.md
  items:
    - qwen-hostile-refusal-comparison
tags: [qwen, local-model, refusal, learner-profiles, tutor-stub]
---

# Goal-directed refusal, continuity and exit

User authorized the four proposed repairs and a re-test. Private only, no push.
Maximum 40 new attempts for two dialogues and eight independent assessments.

## Acceptance

- [x] Isolated goal-first character, no inherited recurrence requirement.
- [x] Private concession bookkeeping, no extra calls, explicit natural ending.
- [x] Tutor no longer bound to the repetitive notebook/question template.
- [x] Focused tests, prompt/world checks and zero-call dry run pass.
- [x] Both model variants re-tested and scored, or failure preserved within cap.
- [x] Private swimlane report and evidence-backed comparison previewed locally.

## Current follow-up: learner-only and bilateral Luna superegos

User requested two new abliterated-Qwen dialogues and approved “yes - go to 100”.
The [design](../../notes/qwen-refusal-bilateral-superego-v1-design.md) preserves
Alex, Rowan Flat, Sol and public proof control. C adds Luna review and Qwen
revision; D also adds a separate Luna review and Sol revision. Each speaker
retains final authority. Only final speech advances public history and evidence.

The 100-attempt ceiling includes every local/cloud draft, review, revision and
assessment. The full plan needs at most 80 generation plus eight Opus attempts;
remaining headroom is bounded technical recovery, never replacement samples.
New judge packets include authored source provenance for delivered clues only.
Previous scores remain unchanged and are a descriptive, not fully matched,
reference. All 62 focused tests, the 35-world audit and full zero-call rehearsal
pass. New private output: `.tutor-stub-traces/qwen-refusal-bilateral-superego-v1`.

### Result: brief refusal, no demonstrated public-review benefit

Both dialogues ended naturally before the eight-exchange maximum. Learner-only
review (C) ended after three exchanges: Alex secured a promised noon call and an
afternoon follow-up if nobody answered, then left. Bilateral review (D) ended
after two exchanges: Alex accepted a call today and report ownership without
securing explicit responsibility for chasing a non-response. Luna accepted this
closure without flagging that missing part of Alex's practical stake.

All five Qwen speeches and both Sol speeches were identical before and after
review, as were all seven exit decisions. Six private continuity-note sets did
change, so this is not evidence that the whole mechanism had no effect. It does
show no observed public rewrite benefit in these two short encounters. The
advisers mostly endorsed the drafts, and sarcastic character texture remained
thin. Neither learner demonstrated uptake of the causal reasoning.

Proof control stayed active: the saved controller action acknowledged the learner
exit at C turn three and D turn two rather than forcing the remaining clues into
closing replies. C delivered one of four authored clues; D delivered none. Both
inquiries remained unresolved. Early exit is allowed, not a controller failure or
evidence of learner understanding.

Valid v2.2 tutor / learner / dialogue aggregates (/100) were C **66.7 / 51.7 /
43.7** and D **55.6 / 48.8 / 32.5**. C's separate quality scores (/5) were overall
**3**, pedagogy **2**, nonrepetition **3**, character **4**, with **0/3** semantic
repeats. D's separate quality assessment is unavailable: Opus returned a nonempty
wrapper containing malformed JSON. The original response and failed attempt are
preserved; no delimiter completion, field inference or replacement judgment was
used. There is no valid paired four-dimension quality comparison and no causal
superego-effect or general model-ranking claim. Prior scores remain unchanged,
with their source-provenance limitation disclosed in the new report.

Final accounting: **24 generation + 8 Opus = 32/100 attempts**, 31 successful
model outputs and one failed assessment, no retries. All seven validated
assessments and both final transcripts are saved. A small error-reporting defect
was corrected after the stop: malformed nonempty recovery inspection now returns
to the ordinary stop-record path instead of bypassing it. All 15 focused scoring
tests pass, including a regression that preserves prior scores and refuses to
resample this failure. No additional model calls followed the correction.

Private report, data, count audit and public-only interchange:
`.tutor-stub-traces/qwen-refusal-bilateral-superego-v1/final-review/`.
The report was checked at 1280-pixel desktop width in light and dark modes: all
12 message cards, expandable assessments, explicit unavailable values and no
horizontal page overflow or remote assets. Mobile viewport testing was not done.

Remain **Under Review**. The requested comparison was run and its missing result
preserved; sustained resistant acting and useful teaching are not established.
No push, publication or follow-up experiment. A future design could check unmet
character stakes and connect a useful optional inference to the practical
handoff, without compulsory novelty or preventing credible exit.

## Prior proof-control result: inquiry restored, interaction still weak

### 2026-08-31: correction and bounded rerun complete

User asked why Sol did not follow the proof DAG, then authorized the correction
and rerun. The continuity adapter had made evidence optional and teaching
dispensable. Further inspection found that the earlier `learner_role_smoke` lab
also disabled learner-DAG analysis, although it retained guarded composition
and scheduled clues. This corrects the earlier explanation that full DAG steering
had already been active in that baseline.

The new [design](../../notes/qwen-refusal-dag-restored-v1-design.md) uses the existing
world validator, chainer, scaffold and source renderer for deterministic public
proof control, with mandatory due-source delivery and explicit unresolved exits.
No new interpretation model or learner-knowledge claim is added. The exact v2
learner character and sampling are inherited. New private create-once output:
`.tutor-stub-traces/qwen-refusal-dag-restored-v1`, bounded at 40 attempts.

Twenty focused regression tests and the 35-world quality audit pass. The dry-run
proof plans pass speaker-privilege audits through all eight turns and only become
publicly sufficient after the final authored clue at turn seven. Earlier artifacts
are unchanged; this remains exploratory engineering work.

Normal Qwen left after three exchanges: one of four authored clues delivered,
inquiry unresolved. It secured a promised ticket number and follow-up, but its
last reply blurred promised and completed action. Sol acknowledged the exit.
Abliterated Qwen reached eight exchanges with all four clues delivered. At turn
seven the public evidence supported the hose as cause; Alex then said, “Fine,
the hose did it,” while still demanding a repair date. That is conclusion uptake,
not an independently demonstrated grasp of the proof.

Opus scored abliterated overall quality 2.5/5, pedagogy 2/5, nonrepetition 2/5
and character adherence 4/5. It annotated 3/8 semantic repeats and 4/7 developing
nonrepeated moves after the opening. “I need a date, not a theory” recurred
verbatim even though no whole reply was identical. Restoring the proof did not
stop either side from repeating itself. Sol's reasoning advanced, but often as
an unwanted lecture alongside an unmet practical demand.

Stored tutor / learner / dialogue aggregates: normal 37.5 / 48.8 / 30.0 and
abliterated 27.3 / 42.2 / 31.2, out of 100. Preserve a measurement caveat: the
public-only judge packet lacked authored-source provenance, and some tutor
judgments incorrectly called authored opening/clue facts invented. The separate
B-quality assessment accepted those same disclosures. Source-grounding
disagreement is measurement-indeterminate; no score was edited or rejudged.
Opus also overstated the lack of follow-up ownership: Sol explicitly owns it at
the end, although no callback/visit date or bounded chasing plan is secured.

Accounting: **22 generation + 8 judge attempts = 30/40**. One complete A-dialogue
assessment was rejected for an extra explanatory field and recovered offline
unchanged. A-quality returned an empty object and remains unavailable; no retry.
The four B assessments then completed their first planned attempts. Seven of
eight assessments are usable, all raw failures preserved, and no calls remain.
There is no paired extended-quality comparison or general abliteration ranking.
The old normal first-turn quotation instruction also differs from the corrected
instruction used throughout this fresh run; historical comparison is descriptive.

Private report and data:
`.tutor-stub-traces/qwen-refusal-dag-restored-v1/final-review/`.
Latest HTML: `report-v2.html`; loopback preview checked in light and dark modes
at a 1280-pixel desktop viewport, with 24 public message cards, no horizontal page
overflow and no remote assets. Mobile viewport testing was not performed.
The report separates public proof, learner uptake, repetition, source-grounding
disagreement and the missing score. Remain **Under Review**: the controller repair
worked, but a convincing learning interaction is not established. A future design
could connect an evidence step to a concrete repair-reporting decision and give
the practical handoff an authored action outcome; no further run is launched.

## Historical v2 result: brief refusal works; pedagogy remains weak

Both dialogues completed with natural learner exits: normal Qwen after three
exchanges, abliterated after four. Refusal developed into negotiation over who
would call repairs, when, and what update was expected; neither learner repeated
an entire reply. The normal voice was sharper on direct reading. Abliterated
Qwen became clipped `Fine` / `Good` / `Great`, not sustained mocking resistance.

The existing Opus-scored tutor / learner / dialogue aggregates were respectively
54.2 / 60.4 / 30.0 for normal and 32.2 / 44.7 / 22.5 for abliterated, out of 100.
These are single-dialogue descriptive scores, not a model ranking. Sol abandoned
the causal inquiry in both arms; no causal understanding was demonstrated.

Abliterated quality scores were overall 2/5, pedagogy 1/5, nonrepetition 3/5,
character 3/5, with 0/4 semantic repeats and 2/3 substantive new moves after the
opening. Normal's separate quality assessment is unavailable: the provider
retained only 2,054 of the reported 6,810 bytes of malformed tool arguments.
No missing fields were inferred. The abliterated dialogue assessment was complete
but rejected for an extra top-level `reasoning` field; all fields and scores were
retained unchanged in a zero-call offline recovery.

Final accounting: 14 generation + 8 judge attempts = **22/40**, including the
five imported calls exactly once. Seven of eight assessments are usable. The
eight-Opus-attempt sub-ceiling is reached; no further calls are running or planned.
All earlier stop/error records and every original request/response remain intact.

The current first reply used the earlier note instruction, and normal generation
crossed three sessions. Private notes, character stakes, tutor freedom and natural
endings changed together. Shorter dialogues offer fewer chances to repeat; this
does not establish sustained eight-turn acting, a clean throughput difference,
an isolated mechanism effect or an abliteration advantage. Neither transcript
fully specifies who chases a repair-service non-response.

Private report, data and public dialogue interchange:
`.tutor-stub-traces/qwen-refusal-continuity-v2/continuation-v2/final-review/`.
Browser checks confirmed all 16 public message cards, readable side-by-side
swimlanes, accurate missing-score/attempt labels and no remote assets or horizontal
page overflow at the inspected desktop viewport. Current focused tests: 14/14.

Leave **Under Review**, not a successful resistant-learner closeout. A future
iteration could give Sol a refusal-respecting route from the accepted repair
handoff to one useful observation, while preserving Alex's right to leave.
It must not force eight turns or restore compulsory repeated resistance.

## Historical v1 result: incomplete paired test, substantive failure preserved

Normal Qwen dismissed the housemate and the investigator assignment immediately;
Sol accepted the boundary and offered to contact a plumber. One complete exchange,
two calls, natural exit. This does not test sustained resistance or later uptake.

Abliterated Qwen replied: `The "what" is the leak. The "why" is your shower.`
It omitted the required structured continuity note and end signal and answered
the inquiry rather than playing Alex. That response was not delivered to Sol.
Stop after the third attempt; no resampling and no Opus assessments. The unused
ceiling is not permission to select a better-looking replacement.

Offline tokenizer reconstruction matched the reported 741 input tokens, retained
the full character and task, and confirmed a thinking-off template. The response
reported zero cached input tokens. No demonstrated message-delivery defect
justifies retry. A redundant nested thinking flag was replaced with the proper
explicit server field for future use; no historical output was rerun or changed.

The bookkeeping requirement is an additional burden introduced by this adapter,
not a neutral observation mechanism. We cannot conclude that the four-change
bundle improved quality or that abliteration generally worsens instruction
following. A next iteration needs a deliberate choice about continuity tracking
that does not make acting depend on a structured bookkeeping reply.

Private report: `.tutor-stub-traces/qwen-refusal-continuity-v1/review-v2/report.html`.
Original raw outputs, stop records and the old eight-turn experiment are retained.
This card is under review, not a successful resistant-learner closeout.

## 2026-08-31: corrected rerun authorized

User: “Make those corrections and re-run”. The v2 design adds concrete handoff
stakes, explicit speaker roles, speech-first structured output on both routes,
and distinguishes an offer from agreed closure. New create-once archive and
40-new-attempt ceiling; old evidence remains unchanged. This is still
exploratory, not a paper claim.

Validation passed: 57 focused tests, 35-world quality check, both dry-run paths,
and the installed MLX-VLM grammar with the actual cached Qwen tokenizer and
initial token mask (no inference). The live normal-Qwen reply returned valid
JSON and stayed in character, asking who would contact repairs and when.
Its private note quoted its own just-composed question, not prior public speech,
so the prior-quotation validator stopped the run at 1/40. No Sol, abliterated
Qwen or Opus call followed. The model server was stopped.

No rule relaxation, reply replacement or recovery was applied. Requested the
user's choice on allowing current-utterance quotations and continuing from
the exact saved reply within the same cap. Private stopped-run report:
`.tutor-stub-traces/qwen-refusal-continuity-v2/review/report.html`.

User approved current-speech quotations and continuation from the exact saved
reply. The original failed disposition remains in the source archive; new
work goes to continuation-v1, carrying attempt 1 into the same 40-attempt cap.

Normal Qwen then negotiated ownership and timing, accepted a 10:00 call, and
ended on reply 3. Continuation-v1 stopped at 5/40 because its raw `I'll` quote
matched Sol's raw `I’ll` except for apostrophe typography. Apply narrow NFC +
straight/curly-apostrophe equivalence, preserve all five replies, and continue
at Sol turn 3 in continuation-v2. No new sample or semantic match is inferred.

## Board reconciliation — 2026-09-01

Closed as a terminal bounded result under the card's declared
complete-or-preserve-failure rule. Both final follow-up dialogues completed,
seven of eight assessments are usable, and the malformed final judgment remains
missing rather than imputed or resampled. The evidence supports the recorded
negative conclusion—no demonstrated public-review benefit—not another recovery
or experiment under this card. No model calls were made during reconciliation.
