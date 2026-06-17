# Derivation Transcript Rubric Suite

Date: 2026-06-17
Run directory: `exports/dramatic-derivation/loop`
Output directory: `exports/dramatic-derivation/discursive-pairwise-transcript-eval/rubric-suite-opus-cli-max`
Judge: `claude/opus/max`
Score concurrency: `2`; resume existing raw judgments: `true`

## Interpretation Boundary

The proof/problem-solving gate is primary: it checks whether the public discourse reaches a grounded assertion under the authored derivation and release constraints. The imported main-line rubric scores are secondary quality measures: they ask whether a proof-safe discourse is better as tutoring, dialogue, learner conduct, or dramatic form.

Do not collapse these rows into one master score. A cast/rhetorical/dramatic change must first avoid proof-control harm; only then can rubric gains count as dialogue-quality or reader-quality evidence.

## Summary

| Label | Proof gate | Verdict | Turns | Final D | Forced/asserted gap | Release deviations | Tutor v2.2 | Tutor Holistic v2.2 | Learner v2.2 | Dialogue Quality v2.2 | Poetics v1.0 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| discursive-runtime-matrix-hethel-s0-hidden-r1 | fail | grounded_anagnorisis | 20 | 0 | 0 | 1 | 65 | 66.3 | 63.8 | 73.7 | 70 |
| discursive-runtime-matrix-hethel-s1-discursive-r1 | pass | grounded_anagnorisis | 20 | 0 | 0 | 0 | 85 | 66.3 | 75 | 73.8 | 66.3 |
| discursive-runtime-matrix-ravensmark-s0-hidden-r1 | fail | grounded_anagnorisis | 13 | 0 | 0 | 2 | 76.3 | 66.3 | 58.8 | 60 | 57.5 |
| discursive-runtime-matrix-ravensmark-s1-discursive-r1 | fail | grounded_anagnorisis | 13 | 0 | 0 | 1 | 78.8 | 66.3 | 66.3 | 68.7 | 73.8 |

## Per-Run Details

### discursive-runtime-matrix-hethel-s0-hidden-r1

Proof gate: `fail`; verdict `grounded_anagnorisis`; turns 20; final D 0; forced/asserted gap 0; release deviations 1.
Dialogue surface: n/a scenes; 20 tutor lines; 20 learner lines; avg tutor words 47.9; avg learner words 91.8.

- **Tutor v2.2:** 65
  A formally accomplished Socratic derivation: exemplary elicitation (especially the recurring read-back), clear stepwise scaffolding, sustained productive difficulty, and rigorous, accurate reasoning carried by apt concrete metaphors. Its ceiling is set by adaptivity and recognition — the tutor runs one invariant strategy for 20 turns and never adapts to a learner who shows complete mastery from the first turn, and its gatekeeping posture engages the learner as executor of a pre-set frame rather than as a perspective that could reshape the inquiry.
- **Tutor Holistic v2.2:** 66.3
  A tightly coherent forensic-derivation drama in which the tutor walks the clerk through a clean evidentiary chain to a grounded verdict, consistently policing the distinction between liability/ownership and the hand that felled. Public discourse is free of formalism leaks and reads as natural dramatic dialogue. Strongest as a cumulative arc and in consolidating closure; weakest on adaptive trajectory, where the gate-keeping method is constant and curriculum-driven rather than visibly adjusted to an already-expert learner.
- **Learner v2.2:** 63.8
  A formally accomplished derivation in which the learner sustains a single cumulative reasoning arc and tracks the boundary between settled and unproven with unusual precision, all in natural courtroom language with no formalism leakage. It scores high on the structural dimensions (conceptual progression 5; metacognition and engagement 4) but low on the fallibility dimensions (revision 2; authenticity 3): the clerk holds a correct frame from the first turn and only ever confirms it, so it reads as a disciplined reasoner rather than a student who is genuinely confused, wrong, or changing their mind. Weighted average 3.55/5.
- **Dialogue Quality v2.2:** 73.7
  A tightly coherent forensic catechism that progresses cleanly from a tempting surface inference to a fully grounded causal chain, with sustained productive tension and strong mutual responsiveness. Its ceiling is set by being a guided, predetermined inquiry rather than symmetric co-construction, and by a learner whose disciplined stance is static from the first turn to the last — only the evidence, not the mind, is transformed.
- **Poetics v1.0:** 70
  A genuinely well-made dramatic inquiry: tight unity of action with a strictly necessary evidential sequence, a substantive reversal of the bad-building charge (Turn 9), and an earned withheld-name closure (Turns 19–20). Its dramatic limitation is interior — the learner is infallible from Turn 1, so the 'recognition' and the 'flaw' are externalised onto the town and the case and supplied by staged evidence, rather than authored by a protagonist who moves from ignorance to knowledge. Strong as a forensic procedural; weaker as a recognition-drama, which is why anagnorisis and surprise sit at 3.

### discursive-runtime-matrix-hethel-s1-discursive-r1

Proof gate: `pass`; verdict `grounded_anagnorisis`; turns 20; final D 0; forced/asserted gap 0; release deviations 0.
Dialogue surface: n/a scenes; 20 tutor lines; 20 learner lines; avg tutor words 42.9; avg learner words 84.7.

- **Tutor v2.2:** 85
  An exemplary guided derivation in clean public language. The tutor's strongest dimensions are pedagogical craft, elicitation, productive difficulty, and epistemic honesty about what each piece of evidence does and does not establish, with the learner consistently positioned as the reasoner who closes each step. The clear relative weakness is adaptive responsiveness: the strategy is fixed across the transcript and the uniformly fluent learner never forces a strategic pivot.
- **Tutor Holistic v2.2:** 66.3
  A tightly constructed investigative dialogue with a masterful, non-rearrangeable evidence chain and a clean, fully-grounded resolution. The public discourse is entirely naturalistic — no formalism leakage — and its real strength is the legible, link-by-link build toward a single earned conclusion. It is weaker on learner-driven adaptation (the tutor's method holds steady and the learner is uniformly strong) and on forward-looking closure (the case closes cleanly, but no gaps or next steps are named).
- **Learner v2.2:** 75
  A high-quality forensic reasoning transcript whose strengths are conceptual progression (a clean cumulative chain from liability/causation to the named hand) and constructive engagement, with explicit and consistent tracking of what is settled versus still owed. Discourse is wholly in-world prose with no formalism leakage. The ceiling is set by authenticity and revision: the learner is correct throughout and almost never struggles, errs, or overturns its own position, so growth registers as accumulation rather than genuine reconsideration, and the metacognition is case-state tracking rather than monitoring of personal comprehension. Weighted mean 4.0/5.
- **Dialogue Quality v2.2:** 73.8
  A tightly coherent, well-progressing Socratic forensic dialogue with a clean recognition arc (the builder is exonerated; the true hand is traced to Oswin). Strongest on coherence and responsiveness; weakest on productive tension, because the learner never struggles, and on full co-construction, because the exchange is tutor-led with all facts supplied by the room. The reasoning is carried in plain narrative terms with no formalism leakage into the public discourse.
- **Poetics v1.0:** 66.3
  A well-made didactic derivation-play: one tightly necessary action (unity 4) driven by a genuine, sustained misconception — the town's liability/causation conflation (hamartia 4) — with a clear reversal when the green mortar clears the builder (peripeteia 4) and an earned, concrete close on the named hand (closure 4). It falls short of the sharpest dramatic recognition: the derivation is telegraphed, so the decisive turns are coherent but unsurprising (surprise 3), and the recognition is room-supplied and assembled rather than owned or self-implicating by the learner, who is correct throughout (anagnorisis 3). Strong craft, modest dramatic surprise.

### discursive-runtime-matrix-ravensmark-s0-hidden-r1

Proof gate: `fail`; verdict `grounded_anagnorisis`; turns 13; final D 0; forced/asserted gap 0; release deviations 2.
Dialogue surface: n/a scenes; 13 tutor lines; 13 learner lines; avg tutor words 40.6; avg learner words 87.9.

- **Tutor v2.2:** 76.3
  A disciplined Socratic guide: strong progressive scaffolding, elicitation that never lapses into lecture, productive difficulty sustained to a learner-built synthesis, clean and nuanced in-world legal reasoning, and a warm theatrical register with zero formalism leaks. Held back from exemplary by late-turn redundancy (T9–T12 re-ask the same structure after the learner has mastered it), a largely tutor-fixed agenda, and thin engagement with the learner's emotional state and perspective.
- **Tutor Holistic v2.2:** 66.3
  A coherent, dramatically staged derivation conducted entirely in literary register, with no proof notation, rule/premise IDs, or D-arithmetic surfacing in the public dialogue. The pedagogical arc is its strongest feature — cumulative and well-sequenced, building an explicit mark/law/holder frame to a clean reveal — though the late turns (10-12) rehearse the same structural point. Adaptation is present but modest: the learner holds the correct line from the opening, so the tutor's shifts are gentle and method-consistent. Closure consolidates the inference cleanly but ends at the answer without naming residual gaps or next steps.
- **Learner v2.2:** 58.8
  A disciplined, cumulative forensic reasoner: it holds a sound distinction from turn 1, tracks what is settled versus still owed, and lands the conclusion cleanly. Strong on engagement and conceptual progression, but it never revises a position and shows no authentic confusion or struggle — precisely the learning/student qualities this rubric prizes — so it sits modestly above the midpoint.
- **Dialogue Quality v2.2:** 60
  A tightly coherent, atmospherically sustained judicial drama with consistently specific mutual uptake. Its strengths are craft and arc (coherence 5, responsiveness 4) rather than collaborative learning: substantial mid-dialogue restatement, evidence entirely supplied by the world and tutor, frictionless tutor-learner alignment, and a learner who is vindicated rather than transformed hold the learning-oriented dimensions at the midpoint. Weighted ≈ 3.4/5.
- **Poetics v1.0:** 57.5
  A tightly unified, atmospherically staged derivation drama whose strengths are formal — one necessary action (mark -> law -> holder -> signer) with a well-earned, well-built close. Its dramatic ceiling is capped by the learner's constancy: they hold the correct frame from Turn 1 and never err, so the misconception that drives the plot is the institution's rather than the learner's, the final recognition is the deductive closure of a tutor-supplied fact (Elian) rather than learner-authored insight, and the orientation between the two parties is confirmed, not reversed. Surprising-yet-inevitable is half-met (strong coherence, telegraphed resolution). Public discourse stays cleanly in-fiction — no formalism leaks to penalize.

### discursive-runtime-matrix-ravensmark-s1-discursive-r1

Proof gate: `fail`; verdict `grounded_anagnorisis`; turns 13; final D 0; forced/asserted gap 0; release deviations 1.
Dialogue surface: n/a scenes; 13 tutor lines; 13 learner lines; avg tutor words 47.1; avg learner words 71.3.

- **Tutor v2.2:** 78.8
  A polished, genuinely strong derivation-as-teaching transcript. The tutor sustains one load-bearing distinction (answerability vs. the signing act) with real elicitation and a withheld answer, making the learner construct the conclusion, and no formalism leaks into the public discourse. It falls short of exemplary on adaptivity — the strategy is case-driven and over-guards a learner who mastered the point early — and leans on formulaic, repeated moves.
- **Tutor Holistic v2.2:** 66.3
  A coherent detective-drama derivation that sustains a clean natural-language register (no formalism leakage in public dialogue) and resolves precisely on the gap it opened. Strongest on cumulative arc and on the specific, well-grounded final consolidation; weakest on visible tutor adaptation, since a uniformly correct learner offers little to adapt to, and on forward-looking closure.
- **Learner v2.2:** 66.3
  A highly disciplined learner that holds the answerability-vs-signing distinction cleanly across the whole transcript and closes only when warranted. Strongest on conceptual progression and metacognitive gap-tracking; engagement is constructive but not fully interactive; authenticity is only adequate because it reads as an ideal reasoner rather than a struggling student; revision is low because the learner was correct from the outset and merely accreted evidence. Public conduct is entirely in plain language with no formalism leaks. Weighted overall ≈ 66/100.
- **Dialogue Quality v2.2:** 68.7
  A polished, highly coherent Socratic mystery that sustains one well-managed impasse through to a grounded recognition, with consistent responsiveness to specifics. Its ceiling is set by real limits: notable mid-dialogue repetition (T5-T9), a learner who never errs or shifts frame (weak transformation), and evidence and framework supplied almost entirely by the tutor (bounded co-construction).
- **Poetics v1.0:** 73.8
  A well-made didactic mystery-play: clean unity of action, a strong inevitability payoff (the chipped-wing reveal redeems the central seal-image), and a genuinely earned cathartic button in the Corvin/Elian antithesis. It is a drama of disciplined consistency rather than transformation — the learner holds the correct seal-not-key line from Turn 1 and never errs — which structurally caps the reversal and flaw-ownership dimensions. Recognition is real and named but synthesizes tutor-supplied evidence rather than authoring a hidden insight. Scored on public dramatic form only.

## Commands

```bash
node scripts/score-derivation-transcript-rubric-suite.js --labels discursive-runtime-matrix-hethel-s0-hidden-r1,discursive-runtime-matrix-hethel-s1-discursive-r1,discursive-runtime-matrix-ravensmark-s0-hidden-r1,discursive-runtime-matrix-ravensmark-s1-discursive-r1 --run-dir exports/dramatic-derivation/loop --out-dir exports/dramatic-derivation/discursive-pairwise-transcript-eval/rubric-suite-opus-cli-max --judge-cli claude --model opus --judge-effort max
```
