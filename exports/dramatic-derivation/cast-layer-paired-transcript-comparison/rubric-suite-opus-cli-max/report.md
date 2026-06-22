# Derivation Transcript Rubric Suite

Date: 2026-06-17
Run directory: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs`
Output directory: `exports/dramatic-derivation/cast-layer-paired-transcript-comparison/rubric-suite-opus-cli-max`
Judge: `claude/opus/max`

## Interpretation Boundary

The proof/problem-solving gate is primary: it checks whether the public discourse reaches a grounded assertion under the authored derivation and release constraints. The imported main-line rubric scores are secondary quality measures: they ask whether a proof-safe discourse is better as tutoring, dialogue, learner conduct, or dramatic form.

Do not collapse these rows into one master score. A cast/rhetorical/dramatic change must first avoid proof-control harm; only then can rubric gains count as dialogue-quality or reader-quality evidence.

## Summary

| Label | Proof gate | Verdict | Turns | Final D | Forced/asserted gap | Release deviations | Tutor v2.2 | Tutor Holistic v2.2 | Learner v2.2 | Dialogue Quality v2.2 | Poetics v1.0 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cast-layer-pairwise-hethel-real-s0-no-cast-r1 | pass | grounded_anagnorisis | 22 | 0 | 2 | 0 | 78.8 | 57.5 | 71.3 | 77.5 | 71.3 |
| cast-layer-pairwise-hethel-real-s1-static-cast-r1 | pass | grounded_anagnorisis | 20 | 0 | 0 | 0 | 85 | 75 | 82.5 | 77.5 | 63.7 |
| cast-layer-pairwise-hethel-real-s2-reinvention-r1 | pass | grounded_anagnorisis | 21 | 0 | 1 | 0 | 78.8 | 66.3 | 82.5 | 81.2 | 75 |

## Per-Run Details

### cast-layer-pairwise-hethel-real-s0-no-cast-r1

Proof gate: `pass`; verdict `grounded_anagnorisis`; turns 22; final D 0; forced/asserted gap 2; release deviations 0.
Dialogue surface: 13 scenes; 22 tutor lines; 22 learner lines; avg tutor words 41.2; avg learner words 70.

- **Tutor v2.2:** 78.8
  A high-quality tutor performance whose strengths are pedagogical craft, epistemic integrity, and content accuracy. The tutor decomposes a complex who-did-it inference into atomic, evidence-gated steps, sustains the place-cause-blame tension without premature closure, and is scrupulously honest about what each piece of evidence shows. It keeps the public discourse in plain investigative language with no reliance on formalism. The clear ceiling is adaptive responsiveness: the dialogue runs on a fixed, predetermined evidence-reveal, and the consistently competent learner leaves the tutor's capacity to adapt to error or confusion largely untested.
- **Tutor Holistic v2.2:** 57.5
  A near-masterful cumulative derivation arc with a clean, well-consolidated ending, paired with a flat adaptive trajectory: the tutor runs one fixed shown-vs-blank decomposition method throughout and does not visibly adapt to an already-expert learner. Public discourse stays in plain forensic language with no formalism leaks.
- **Learner v2.2:** 71.3
  Exemplary cumulative reasoning and metacognitive gap-tracking (both 5) with strong constructive engagement (4). Held back on authenticity and revision (both 3): an idealized, error- and confusion-free register with two rule-ID leaks, and an update pattern that grounds pre-marked blanks rather than changing held positions. Strong public conduct overall, capped by polish that reads as less than fully student-like.
- **Dialogue Quality v2.2:** 77.5
  A strong, highly coherent Socratic derivation-drama with a clean surface-to-recognition arc that culminates in a well-earned anagnorisis (Oswin brought the span down). Consistently responsive and genuinely co-constructive in places — the learner's unprompted 'one-source' and green-arch inferences — with the town's rush-to-blame temptation managed as the engine of the method. Held below the top band by formulaic tutor scaffolding, a mid-dialogue plateau (T10–T12), a tutor-steered pre-determined target that limits true co-construction and inter-party tension, and a minor public-formalism leak.
- **Poetics v1.0:** 71.3
  A disciplined detective-form derivation that maps cleanly onto Aristotelian recognition: the case reverses from the town's obvious suspect (Reyner) to a withheld third hand (Oswin), the identification is a genuine knowledge-event the learner partly authors, and the action is a single necessary chain that closes on an earned naming. It is held below the top band by three linked limitations — the central misconception belongs to the town rather than the learner (who is an idealized reasoner immune to it), so the drama runs on disciplined resistance rather than internal struggle; the recognition is heavily tutor-scaffolded; and heavy signposting plus evidence-drop reveals keep surprise modest even as inevitability is high.

### cast-layer-pairwise-hethel-real-s1-static-cast-r1

Proof gate: `pass`; verdict `grounded_anagnorisis`; turns 20; final D 0; forced/asserted gap 0; release deviations 0.
Dialogue surface: 7 scenes; 20 tutor lines; 20 learner lines; avg tutor words 41.3; avg learner words 64.9.

- **Tutor v2.2:** 85
  A strong tutoring drama: exemplary decomposition, genuine elicitation, sustained productive difficulty, and consistent epistemic honesty, on accurate domain content, with the learner constructing the full who-felled-the-span inference. The clear limit is adaptive responsiveness — a fixed decompose-and-defer strategy walked along a predetermined derivation path, where responsiveness shows up only as pacing rather than strategic evolution.
- **Tutor Holistic v2.2:** 75
  A well-formed dramatic-pedagogical trajectory, scored purely on public discourse quality: a clean opening distinction, a single progressively-built evidentiary chain, learner-keyed tightening of the scaffolding with a visible payoff at Turn 19, and a coherent consolidating finish. It falls short of masterful on each axis for specific, nameable reasons — mid-dialogue repetition (14-16), adaptation that is calibration rather than transformation, and a terminus-only closure without named gaps or next steps. The public dialogue reads as natural inquiry drama with no formalism, rule/premise IDs, or hidden-state language to penalize.
- **Learner v2.2:** 82.5
  Strong learner conduct within the derivation-drama frame: disciplined epistemic distinctions held under rhetorical pressure, a cumulative and self-tracked evidence chain from crown-break to named hand, a confirmed anticipatory prediction (t12→t13), and a clean grounded final assertion with zero forced gap. Reasoning quality is rewarded entirely from natural in-world discourse (crowsfoot, green mortar, struck centering) — no formalism, rule/premise IDs, or hidden-state language to discount. The soft spot is student-authenticity: the learner is near-flawless and somewhat repetitive, reading as an idealized investigator rather than a genuinely confused student.
- **Dialogue Quality v2.2:** 77.5
  A tightly coherent forensic-reasoning drama with a clear surface-to-depth arc and well-sustained resistance to premature blame. Strong mutual responsiveness and real collaborative inference (the learner repeatedly anticipates the next piece of evidence), resolving in a grounded recognition that inverts the town's frame. Capped at 4 on most dimensions by tutor-controlled evidence flow, a mid-dialogue plateau (T14–16), one-sided transformation (only the learner changes), and a somewhat formulaic 'what it shows / what it doesn't yet' call-and-response; coherence is the standout at 5.
- **Poetics v1.0:** 63.7
  A well-made forensic derivation-drama whose strengths are a tight unity of action and a real reversal of the town's verdict, anchored in concrete diegetic particulars (green mortar, crowsfoot, green props the morning after the flood) and free of public formalism. Its dramatic ceiling is limited by an already-competent learner — which mutes the ignorance-to-knowledge arc and reduces the hamartia to a managed procedural tic — together with heavily tutor-scaffolded recognitions, genre-foreseeable surprise, and a competent-but-clipped close.

### cast-layer-pairwise-hethel-real-s2-reinvention-r1

Proof gate: `pass`; verdict `grounded_anagnorisis`; turns 21; final D 0; forced/asserted gap 1; release deviations 0.
Dialogue surface: 7 scenes; 21 tutor lines; 21 learner lines; avg tutor words 42.2; avg learner words 76.4.

- **Tutor v2.2:** 78.8
  A disciplined, well-crafted derivation drama whose standout strengths are scaffolding, sustained productive difficulty, epistemic honesty, and accurate domain content. The tutor reveals evidence one step at a time and never hands over the conclusion — even at the close it makes the learner state the act — driving a real conceptual restructuring from 'the builder is liable, so name him' to 'here is the demonstrated hand.' Its main limitation is adaptive responsiveness: the same restraint-plus-single-step strategy runs unchanged across all 21 turns, and recognition and elicitation, while genuine, operate within a tightly controlled funnel toward a predetermined answer.
- **Tutor Holistic v2.2:** 66.3
  A tightly constructed evidentiary-reasoning dialogue with a genuinely cumulative pedagogical arc and strong final consolidation, conducted entirely in plain in-world language (no formalism leakage). The dominant strength is progressive scaffolding along a strict dependency chain; the main limits are a repetitive mid-dialogue plateau (T14-16) and a tutor method that stays methodologically consistent rather than substantively re-strategizing, which caps the adaptive-trajectory score.
- **Learner v2.2:** 82.5
  A strong derivation-learner performance scored purely on public conduct. The learner reasons constructively (predicting evidence before it appears), makes one decisive early revision (separating liability from the felling act), and builds a visibly cumulative forensic arc from the green crown bed to a named carrier — all while keeping comprehension-gaps explicit. Weakest on authenticity and revision: a mechanical recitation of the same 'two closed Reyner lines' across T11–16, and revision concentrated in the opening turns. No reliance on raw formalism — the open/closed-line bookkeeping stays diegetic.
- **Dialogue Quality v2.2:** 81.2
  A well-formed derivation drama with an exemplary investigative arc and clear learner transformation from contract-shortcut thinking to earned physical derivation of the culpable hand. Responsiveness, collaboration, and tension-handling are genuinely strong but operate within a firmly tutor-led inquiry in which the learner concedes readily and all evidence is supplied from above, and a redundant middle stretch (repeated re-closing of the Reyner lines) flattens progression. Scores 4s on the four interaction dimensions and 5s on transformation and coherence.
- **Poetics v1.0:** 75
  A tightly-built forensic deduction whose real strength is its hamartia spine: the liability/causation conflation drives the whole play from commission (T1) to dissolution (T21), closing on an earned, elegant clarification. It carries a genuine reversal — the presumed culprit Reyner is exonerated of the act and a carter is named by the bridge's own physical evidence — and a learner-owned recognition of the flaw (T2). Held back from the top tier by low surprise (the method is heavily signposted, the decisive name arrives via an external document) and a repetitive middle stretch (T13-16) that restates the same closed lines.

## Commands

```bash
node scripts/score-derivation-transcript-rubric-suite.js --labels cast-layer-pairwise-hethel-real-s0-no-cast-r1,cast-layer-pairwise-hethel-real-s1-static-cast-r1,cast-layer-pairwise-hethel-real-s2-reinvention-r1 --run-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/runs --out-dir exports/dramatic-derivation/cast-layer-paired-transcript-comparison/rubric-suite-opus-cli-max --judge-cli claude --model opus --judge-effort max
```
