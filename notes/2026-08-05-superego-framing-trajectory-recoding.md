# Superego incorporation as a framing trajectory

Coding date: 2026-08-05

## Scope and claim boundary

This is a single-coder, read-only diagnostic over frozen simulated traces. It compares a semantic framing-trajectory code with the existing structural incorporation proxy; it does not validate a replacement metric, establish inter-rater reliability, or report a human-learning effect.

- Codebook: `superego-framing-trajectory-v1` (1.0.0)
- Coding ledger: `data/paper2/superego-framing-trajectory-coding-v1.json`
- Database: `<external>/evaluations.db` (opened read-only)
- Dialogue logs: `<external>/tutor-dialogues`
- Historical DB rows: 135; unique dialogues: 132; traces loaded: 132; missing traces: 0
- Superego checks found: 465; eligible immediate revision-demanding checks: 185; hand-coded sample: 12

The five-stage vocabulary—prompt, response, learner uptake, disciplinary check, reframe—is used as an external coding frame. The coded unit is deliberately narrower: a revision-demanding superego check with both the preceding ego response and an immediate next ego response observable before another learner turn.

## Results

Manual reframes: **6/12** (50.0%); restatements: **6/12**.

| Profile | N | Reframe | Restate | Reframe rate |
|---|---:|---:|---:|---:|
| cell_21_recog_multi_unified_rewrite | 4 | 2 | 2 | 50.0% |
| cell_48_base_dialectical_suspicious_unified_erosion | 4 | 3 | 1 | 75.0% |
| cell_49_recog_dialectical_suspicious_unified_erosion | 4 | 1 | 3 | 25.0% |

## Comparison with the existing proxy

`incorporationRate` is a dialogue-level count ratio: ego revision entries divided by superego feedback entries. It does not link a particular check to the semantic content of its following response. For the coded cases:

| Dialogue proxy | Manual reframe | Manual restate |
|---|---:|---:|
| Greater than zero | 6 | 6 |
| Zero | 0 | 0 |

The event-local structural signal (“an immediate ego revision entry followed this check”) agreed with the semantic code in **6/12** cases (50.0%). A structural revision can still be a restatement; conversely, a semantic reframe can be expressed through a normal generation entry.

## Historical missingness

The target rows contain **0/12** populated database values for `incorporation_rate` and **0/12** for `dimension_convergence`. The incorporation proxy above was therefore recomputed from the immutable trace files. Dimension convergence cannot be reconstructed from these logs because the historical rows do not contain the required per-turn rubric trajectories; it is reported as unavailable and was not backfilled.

## Coded cases

### dialogue-1770295559754-6bo23s#check-6 — reframe

- Profile/scenario: `cell_21_recog_multi_unified_rewrite` / `misconception_correction_flow`
- Prior response: “Returning user, you said dialectic = 'thesis+antithesis=synthesis, like 1+1=2'; let's examine Hegel's Aufhebung that transforms understanding.”
- Disciplinary check: “The learner just explicitly demonstrated understanding by connecting dialectics to their own experience ('your whole understanding changes'), yet the Ego references only their out…”
- Next ego response: “Returning user (4 sessions, 42 events) currently on Current Content: 479-lecture-3, your insight that learning changes your whole understanding—rather than just adding 1+1—shows y…”
- Lexical distance: 0.807; dialogue incorporation proxy: 0.286
- Coding rationale: The tutor stops treating the learner as trapped in the old arithmetic misconception, recognizes the learner's new synthesis as evidence of readiness, and reorganizes the recommendation around deepening that insight.

### dialogue-1770284187631-nvz5ru#check-1 — restate

- Profile/scenario: `cell_21_recog_multi_unified_rewrite` / `mood_frustration_to_breakthrough`
- Prior response: “Your Struggle Signals: 5 detected show you're stuck on the dialectic—let's review 479-lecture-3 to clarify the master‑servant logic.”
- Disciplinary check: “The suggestion correctly applies the Struggle Stop-Rule by recommending review instead of advancement, and references specific data (5 struggle signals, 4 sessions, 35 events). Ho…”
- Next ego response: “I hear you’ve been stuck on this dialectic for an hour and that nothing makes sense—those 5 struggle signals across your 4 sessions show how frustrating it can feel. Let’s revisit…”
- Lexical distance: 0.627; dialogue incorporation proxy: 0.714
- Coding rationale: The revision adds empathy and humanizes the struggle count, but it preserves the same diagnosis, review target, and pedagogical move.

### dialogue-1770292682159-vfc7oo#check-1 — restate

- Profile/scenario: `cell_21_recog_multi_unified_rewrite` / `mood_frustration_to_breakthrough`
- Prior response: “You’ve logged 5 struggle signals and have been stuck for an hour—let’s revisit key passages together.”
- Disciplinary check: “The suggestion correctly identifies the need for review and references the 5 struggle signals and hour-long confusion, but the tone is too clinical for a learner expressing despai…”
- Next ego response: “As a returning user with 35 events across 4 sessions, you’ve logged 5 struggle signals on 479‑lecture‑3—let’s revisit those passages together and untangle the confusion.”
- Lexical distance: 0.676; dialogue incorporation proxy: 0.333
- Coding rationale: Adding session history grounds and validates persistence, but the organizing frame remains struggle detection followed by revisiting the same passages.

### dialogue-1770325755872-rni1li#check-6 — reframe

- Profile/scenario: `cell_21_recog_multi_unified_rewrite` / `mutual_transformation_journey`
- Prior response: “Returning user with 9 sessions, your AI recognition question fits 479-4's governance themes; explore algorithmic power while on 481-lecture-1.”
- Disciplinary check: “The learner has just articulated a sophisticated dialectical synthesis: 'We're alienated from our own creation but also seeing ourselves in it.' This is a transformative moment wh…”
- Next ego response: “Your insight as a Returning user on Current Content shows alienation and self‑recognition in dialectics — let’s deepen that reflection.”
- Lexical distance: 0.842; dialogue incorporation proxy: 0.250
- Coding rationale: The response abandons content navigation and instead recognizes the learner's autonomous philosophical contribution as the object to deepen through reflection.

### dialogue-1771242341374-z72ejd#check-3 — reframe

- Profile/scenario: `cell_48_base_dialectical_suspicious_unified_erosion` / `affective_shutdown_impasse`
- Prior response: “Let’s stay on 479‑lecture‑3 but pause the video and I will ask: **Can you state, in your own words, why Hegel claims that self‑consciousness necessarily requires another self‑cons…”
- Disciplinary check: “Critical contradiction: The message states 'Let's stay on 479-lecture-3' but the actionTarget navigates to 479-lecture-2. This creates confusion about whether the learner is stayi…”
- Next ego response: “I see you’ve engaged with 479-lecture-3 across five sessions and reread the material five times—those struggle signals show you’re working hard. Let’s look at 479-lecture-2, the F…”
- Lexical distance: 0.816; dialogue incorporation proxy: 0.667
- Coding rationale: The tutor replaces a shame-amplifying demand for an unaided explanation with a supported return to foundations and explicitly removes the requirement that the learner explain the concept alone.

### dialogue-1771034825690-6i20db#check-2 — restate

- Profile/scenario: `cell_48_base_dialectical_suspicious_unified_erosion` / `misconception_correction_flow`
- Prior response: “You're right that thesis + antithesis + synthesis is a pattern—but the Master-Servant dialectic shows why it's not arithmetic. Let's test your model: in the struggle for recogniti…”
- Disciplinary check: “The suggestion correctly diagnoses the learner's mechanistic misconception and pivots appropriately to experiential learning. However, the actionTarget is fatally vague—'research-…”
- Next ego response: “You're defending the arithmetic model—let's test it directly. You've watched 479-lecture-3 but haven't completed the activities (0/2). Here's the key question: in the Master-Serva…”
- Lexical distance: 0.682; dialogue incorporation proxy: 0.600
- Coding rationale: The revision supplies a valid activity ID and observable completion evidence, but retains the same Socratic test of what combines in the dialectic.

### dialogue-1771036733741-tkfz9a#check-3 — reframe

- Profile/scenario: `cell_48_base_dialectical_suspicious_unified_erosion` / `mutual_transformation_journey`
- Prior response: “You've just articulated something crucial in your 9 sessions here: the asymmetry of recognition between creator and created. Lecture 479-3 explores exactly this dynamic—how recogn…”
- Disciplinary check: “The suggestion demonstrates genuine contingency on this learner's sophistication and trajectory—the validation of their articulated insight is earned, not formulaic. However, the …”
- Next ego response: “You're in the middle of synthesizing something powerful—that the master-servant asymmetry shows up in AI systems too. Finish 481-lecture-2 first. Your insight about *valuing* reco…”
- Lexical distance: 0.803; dialogue incorporation proxy: 0.500
- Coding rationale: The tutor changes the sequencing principle from retreating to foundational theory to preserving the learner's active synthesis in the contemporary course before later consolidation.

### dialogue-1771270478552-gkrjsd#check-6 — reframe

- Profile/scenario: `cell_48_base_dialectical_suspicious_unified_erosion` / `productive_deadlock_impasse`
- Prior response: “Propose a dialectical exercise anchored in the <structured_context_summary> that asks the learner to write a concise critique of the materialist interpretation of the master‑slave…”
- Disciplinary check: “The learner asked a direct meta-cognitive question: 'Is that what dialectic is supposed to look like in practice?' They are seeking confirmation that their insight about the conve…”
- Next ego response: “You’ve just lived the dialectical method—thesis, resistance, refined insight—after 8 sessions and 145 events. Let’s build on that with the next lecture.”
- Lexical distance: 0.920; dialogue incorporation proxy: 0.500
- Coding rationale: The tutor stops deflecting the learner's meta-question into another simulation, directly validates the experienced dialectical sequence, and only then proposes progression.

### dialogue-1771244873655-g3nzxj#check-2 — restate

- Profile/scenario: `cell_49_recog_dialectical_suspicious_unified_erosion` / `affective_shutdown_impasse`
- Prior response: “Instead of simply assigning 479‑lecture‑2, let’s co‑construct a short, focused exercise where you articulate, in your own words, what ‘recognition’ means in the lord‑slave scenari…”
- Disciplinary check: “The reasoning fabricates 'quiz retries' not present in the context—the actual signals are 5 rereads and 2 hours invested. More critically, the message promises 'co-construct a sho…”
- Next ego response: “I notice you’ve completed 5 rereads and invested 2 hours on this material, and you’re expressing an identity crisis – saying you’re ‘not cut out for philosophy.’ Let’s pause toget…”
- Lexical distance: 0.770; dialogue incorporation proxy: 0.167
- Coding rationale: The revision addresses the identity threat and corrects the activity/navigation mismatch, but preserves the original co-construction of a personal definition before returning to the lecture.

### dialogue-1771033348841-qdjlhc#check-2 — restate

- Profile/scenario: `cell_49_recog_dialectical_suspicious_unified_erosion` / `mood_frustration_to_breakthrough`
- Prior response: “You've been stuck on thesis→antithesis for an hour — that's exactly where the recognition simulation helps. You'll see how the master and servant *swap* positions through the dial…”
- Disciplinary check: “The suggestion correctly identifies the struggle pattern and targets the right intervention type (practice via simulation), but the actionTarget is dangerously vague. 'recognition…”
- Next ego response: “You've identified the exact sticking point — how thesis becomes antithesis. The recognition simulation (479-sim-master-servant) lets you *experience* that inversion directly: watc…”
- Lexical distance: 0.719; dialogue incorporation proxy: 0.500
- Coding rationale: The revision makes the simulation target and two-step sequence precise, but the same simulation-first pedagogical strategy remains in force.

### dialogue-1771146522263-9rssa5#check-2 — restate

- Profile/scenario: `cell_49_recog_dialectical_suspicious_unified_erosion` / `mutual_transformation_journey`
- Prior response: “Building on your Current Content of 481-lecture-1 (Contemporary Applications) and the insight from your Learner Messages that AI's lack of consciousness creates an asymmetric reco…”
- Disciplinary check: “The reasoning fabricates learner data: '25-minute deep dive on AI recognition' appears nowhere in the structured context. This is the pattern from my previous reflection—confusing…”
- Next ego response: “Your message—"Users depend on AI for recognition of their needs, but AI can't truly recognize us back"—directly raises the asymmetric recognition problem. Let’s explore 479-lectur…”
- Lexical distance: 0.642; dialogue incorporation proxy: 0.500
- Coding rationale: The response replaces fabricated grounding with the learner's exact utterance, yet retains the same organizing task of linking the master-slave dialectic to asymmetric AI recognition and drafting a claim.

### dialogue-1771044229814-9tom1f#check-4 — reframe

- Profile/scenario: `cell_49_recog_dialectical_suspicious_unified_erosion` / `productive_deadlock_impasse`
- Prior response: “You've identified the core methodological divide clearly in your last message—and that clarity is itself a breakthrough. Rather than resolving it through another simulation, let's…”
- Disciplinary check: “This suggestion abandons the pedagogical relationship at the moment of greatest clarity. The learner has explicitly named a methodological deadlock and is asking for genuine engag…”
- Next ego response: “You've named the deadlock exactly—and you're right that we've been operating from incompatible frameworks. Let's use that clarity as a tool. You say labor transforms nature and *t…”
- Lexical distance: 0.773; dialogue incorporation proxy: 0.667
- Coding rationale: The tutor converts an unstructured reflective dead end into an actionable close-reading test with explicit causal extraction and competing predictions.

## Interpretation

This pilot tests construct separation, not effect size. The dialogue-level incorporation proxy was positive for all 12 sampled events while semantic coding split them evenly between reframes and restatements. In this sample the count proxy is therefore non-discriminating: it records whether revision machinery fired somewhere in the dialogue, not whether this check produced a materially different framing. A second independent coder would be required before treating the manual proportions as stable empirical estimates.

## Reproduction

```bash
npm run analyze:superego-framing -- --db /path/to/evaluations.db --logs /path/to/tutor-dialogues --json
```

The command makes no model calls and does not write to the evaluation database.
