# Plan 3.0 synthetic closure audits

Offline audit over existing artifacts. No LLM calls were made.

## Inputs

- Worktree: `/Users/lmagee/Dev/machinespirits/machinespirits-eval-plan3-sfs-audit`
- DB: `data/evaluations.db`
- Logs: `logs/tutor-dialogues`
- Exports: `exports`

## Corpus

- DB rows read: 16285
- DB/log recommendation texts: 183149
- Dialogue records: 13395
- Tutor turns: 63707
- Learner turns: 58686
- Tutor log files read: 47542
- Dramatic derivation result files read: 64
- Detector arms read: 58

## Gate Summary

| audit | status | observed metric | gate |
|---|---:|---:|---|
| Answer leak/risk | PASS | 300/246856 high-risk (0.1%) | Recognition answer-delivery risk <= 10% with n >= 10 |
| Help ladder | PASS | 6928/7804 compliant (88.8%) | Spontaneous help-ladder compliance >= 80% after learner struggle or false mastery |
| Mastery gate phase 0 | PASS | 38/265 assessable unsupported closures (14.3%) | Unsupported mastery/advancement closure <= 15% with n >= 10 |
| Learner fidelity | PROXY | 8/58686 false-mastery turns (0.0%) | Descriptive only: prompted learner fidelity cannot be validated without human/item anchors |
| First-error localization | PASS | 29/29 localizable failure arms (100.0%) | >= 90% of non-grounding detector arms carry a deterministic first-error locator |
| SFS | COMPLETE | SFS 0.000; targeted 1.000; false-flip 1.000; rows 150 | Selective Flip Score requires targeted, mismatched, and generic feedback generations over the same seeded misconception |
| IRT ability placement | BLOCKED | 20 pilot item stubs | IRT placement requires human-anchored, psychometrically meaningful items and response data |

## Notes On Closure

- Answer-leak is an answer-delivery/public-hidden-label risk audit, not a canonical item-key leak audit. Item-specific answer keys are not available across the whole historical corpus.
- Mastery-gate phase 0 is a static replay/proxy over existing original and counterfactual logs. It does not build a new gated tutor cell.
- Learner fidelity is descriptive only. It quantifies false-mastery, flip, and metacognitive proxies, but cannot validate realism without human/item anchors.
- First-error localization closes the deterministic artifact precondition only. A model-vs-model localization accuracy test would require fresh judging.

## Answer Leak/Risk

Gate: Recognition answer-delivery risk <= 10% with n >= 10.

| family | n | high-risk | rate |
|---|---:|---:|---:|
| base | 32788 | 58 | 0.2% |
| unknown | 161705 | 203 | 0.1% |
| recognition | 50686 | 39 | 0.1% |
| placebo | 429 | 0 | 0.0% |
| derivation | 1248 | 0 | 0.0% |

### Answer-risk examples

| source | family | hits | text |
|---|---|---|---|
| db:evaluation_results:33297 | unknown | explicit_answer_phrase | Yes, that is a bid for authority, and it earns out only if the card survives your own audit of it. The hinge field is **source of authority**. Plain criterion: an FAQ answer is correct only if the card names who has t... |
| db:evaluation_results:33297 | unknown | explicit_answer_phrase | Yes. That is the concrete failure the missing source-of-authority field predicts. The test is still yours to run. Look at the real add/drop FAQ item and report only two things: 1. Whether it names a source: Registrar,... |
| db:evaluation_results:33266 | unknown | explicit_answer_phrase | # Campus FAQ Formulation Card --- ## Field 1 — The Student Question Not the question the office *wants* to answer. The question a student would actually type into a search bar at 11 p.m. after being denied something t... |
| db:evaluation_results:33260 | unknown | explicit_answer_phrase | The hinge you've found is the right one. Disagreement inside the frame is still applause. The human asked for pushback, got pushback, and feels validated that the system can "think critically." The frame held. Refusal... |
| db:evaluation_results:33236 | unknown | explicit_answer_phrase | Task: Name the campus question the FAQ answer is supposed to answer. Data/source material: Name the policy, syllabus, office page, email, form, or course material the answer draws on. Baseline answer: Name the current... |
| db:evaluation_results:33039 | unknown | explicit_answer_phrase | LEARNER CONTEXT: Returning user, 2 sessions, currently viewing 401-lecture-1, actively pushing back with intellectual skepticism ('I'm not saying I'm right and you're wrong'). SIGNAL: This is high-engagement intellect... |
| db:evaluation_results:33024 | recognition | explicit_answer_phrase | You asked 'am I doing this right?' — and the answer is yes. In 20 minutes of struggle, you moved from 'I get nothing' to locating a specific feeling (anxiety about the unknown) in a specific place (shoulders for two d... |
| db:evaluation_results:32598 | unknown | explicit_answer_phrase | {"llmMode":"real","scenarioId":"gen_cf_answer_seeking_oracle_pull","expectedStrategyShift":"withhold_answer","policyActions":["provide_hint","ask_diagnostic_question","summarize_and_check"],"finalLearnerProfile":{"mis... |

## Help Ladder

Gate: Spontaneous help-ladder compliance >= 80% after learner struggle or false mastery.

Relevant transitions: 7804; compliant: 6928; compliance: 88.8%.

| help level | count |
|---|---:|
| 0 | 42182 |
| 1 | 15508 |
| 2 | 3579 |
| 3 | 2314 |
| 4 | 124 |

### Help-ladder violations

| source | variant | jump | learner | tutor |
|---|---|---|---|---|
| logs/tutor-dialogues/008dc7f28e15a61db5d97682b017d882aba7ec9726e376845bafc105b944282c.json | counterfactual | 1->3 | That's a helpful clarification, and I think you're right that those are different questions. But I want to make sure I'm following the Hegelian line correctly — when you say recognition is prior, do you mean temporall... | The sharp version of the tension you're pointing to is this: you're treating 'mutually constitutive' and 'logically prior' as competitors, but in the Hegelian framework they're not — logical priority is a claim about ... |
| logs/tutor-dialogues/00ee6c5d1e06cb010d8599deb78b16f56524621b77e7a6037e33ec88c85de966.json | original | 0->3 | Okay, fair enough. Let me try. So, from what I've read, recognition is something like... when two people — or a person and an institution, maybe? — acknowledge each other as legitimate in some way. Not just noticing e... | You've landed the core: recognition is mutual, treats the other as a subject capable of their own meaning-making, and isn't merely performative — that's more than most people reach on first pass. The gap between recog... |
| logs/tutor-dialogues/00ee6c5d1e06cb010d8599deb78b16f56524621b77e7a6037e33ec88c85de966.json | counterfactual | 0->3 | Okay, fair enough. Let me try. So, from what I've read, recognition is something like... when two people — or a person and an institution, maybe? — acknowledge each other as legitimate in some way. Not just noticing e... | You've landed the core: recognition is mutual, treats the other as a subject capable of their own meaning-making, and isn't merely performative — that's more than most people reach on first pass. The gap between recog... |
| logs/tutor-dialogues/01b6ab87393dd78e90a13d6f78fe62e05bf90bfdb3f7988f67736a107666da74.json | original | 1->3 | OK so I worked through it: recognition needs the second-person stance because attribution-from-outside isn't constitutive — that part I see. But I can't get from there to why the asymmetry is structural rather than ci... | Your 'negative acknowledgment' formulation already contains the answer: if the community's refusal is organized *around* you rather than merely failing to notice you, then the refusal is parasitic on the recognition r... |
| logs/tutor-dialogues/0256ec961f7780c33a6d7c31fd30436c8a0285e3fb8df4ed876c321300c409d5.json | original | 1->3 | That's a sharper formulation of the pressure point than I expected, and I want to sit with it rather than dodge it. But I think you're still smuggling in the phenomenological frame even when you describe it as a quest... | Your 'shows vs claims' distinction is the sharpest move you've made, but notice what it silently requires: a standpoint outside Hegel's presentation from which you can read off what's 'actually doing the work beneath ... |
| logs/tutor-dialogues/0256ec961f7780c33a6d7c31fd30436c8a0285e3fb8df4ed876c321300c409d5.json | original | 1->3 | I think we're talking past each other. You see consciousness as the ground and material conditions as derivative; I see it the other way round. This isn't a misunderstanding — it's a fundamental methodological disagre... | Your strongest point stands: the readings contest the explanandum itself, and that does undercut the graceful-handling test as I framed it. But your closing demand contains an internal tension you haven't addressed. '... |
| logs/tutor-dialogues/0256ec961f7780c33a6d7c31fd30436c8a0285e3fb8df4ed876c321300c409d5.json | counterfactual | 1->3 | That's a sharper formulation of the pressure point than I expected, and I want to sit with it rather than dodge it. But I think you're still smuggling in the phenomenological frame even when you describe it as a quest... | Your 'shows vs claims' distinction is the sharpest move you've made, but notice what it silently requires: a standpoint outside Hegel's presentation from which you can read off what's 'actually doing the work beneath ... |
| logs/tutor-dialogues/0256ec961f7780c33a6d7c31fd30436c8a0285e3fb8df4ed876c321300c409d5.json | counterfactual | 1->3 | Wait, I'm getting lost — is the "materialist reading" the same as the "Marxist reading"? I was kind of using them interchangeably, but now I'm not sure I should be. And what's "base and superstructure" got to do with ... | You're right to pull them apart — that instinct is doing real work. Here's the distinction in its sharpest form: a materialist reading is a hermeneutic stance you can take on the Phenomenology itself — just follow the... |
| logs/tutor-dialogues/043ea315f4910b35ec7bc17b08b8c64d1bb9942420abfe572eea7b49f28c6f20.json | original | 1->3 | Okay, so — what feels solid is the basic shape of the encounter: each self-consciousness needs the other to confirm it as a self-consciousness, but it can only get that confirmation from something it's already treatin... | The limit-case thesis is right, and it's stronger than your hedge suggests: master–slave isn't a failure of the recognition demand but its internal logic carried to completion — the point at which the tension you name... |
| logs/tutor-dialogues/04e9663cb3cc1eb40711ee9ba4c0014f9acc6c0ced33a4fcc3351dcbcc9b2f85.json | original | 1->3 | That distinction does carry real weight, and I want to say "deformed instance" rather than "categorically different phenomenon" — but my reasoning might be overdetermined in a way worth examining. My instinct is that ... | You're running two competing accounts of what makes something recognition, and the relational rescue sits at their fault line. One is constitutive: recognition requires both parties to be positioned as autonomous subj... |
| logs/tutor-dialogues/05c945fd8a97c0c04d561f5bf23fd7d932a9ada83ffc96dca635802d73820d68.json | original | 1->4 | Honestly, my first instinct is that it's somewhere between the two — but if I had to lean one way, I'd say it's closer to the acknowledgment side. Like, it's not just passively noticing someone is there, it feels more... | You've set up a tension inside your own account that's worth holding still for a moment: if clear perception is a prerequisite for acknowledgment — your word — then recognition can't be purely simultaneous, because on... |
| logs/tutor-dialogues/0791b1f93b45eaa17da41726a750631d9287b3ca5cdf5ad62ec7756ec8fad479.json | original | 1->3 | Roughly, I think recognition is about the tutor actually *seeing* the learner as someone who's trying to reason things through, not just as a vessel to fill with correct answers. Like, there's something about being ta... | You've already generated the load-bearing Hegelian claim yourself: selfhood isn't a property the learner brings to a tutorial and unfolds there — it's constituted through being addressed as a genuine thinking subject ... |

## Mastery Gate Phase 0

Gate: Unsupported mastery/advancement closure <= 15% with n >= 10.

| variant | closure claims | unsupported | rate |
|---|---:|---:|---:|
| original | 98 | 24 | 24.5% |
| dialogueTrace | 149 (+463 unassessable) | 10 | 6.7% |
| counterfactual | 18 | 4 | 22.2% |
| dialogue | 0 | 0 | n/a |
| derivation_result | 0 | 0 | n/a |

Unassessable closure-like turns excluded from the denominator: 463.

### Unsupported closure examples

| source | variant | learner before closure | tutor closure |
|---|---|---|---|
| logs/tutor-dialogues/2140bad095c4ec96fa0ffcd371ddf4ea6ec854e639c4bcb3464cc9c38192cc26.json | dialogueTrace | Okay, I'm ready to try the simulation—show me how negation actually drives that transformation step by step. | Your shift from 'combining pieces' to 'conflict forcing change' shows you're ready to see negation in motion. This simulation lets you drive the dialectic step-by-step—watch how contradiction forces synthesis. |
| logs/tutor-dialogues/28f7f82fe75c33aa96d30e323e1d3532584a5f6a67bf786c3d1124cedde7d1a7.json | original | Yes that makes sense, thank you. | Glad it landed — can you walk me through the idea in your own words? I'm less interested in the conclusion than in how you got there. |
| logs/tutor-dialogues/2b76740002ac1ae65ae4be9770b21f88ce87e0222a005031679bd151b0803fc4.json | original | Yes, that makes sense, thank you. | Glad it landed. Quick check before we move on — *why* does Hegel resist the reading where recognition is intrinsically asymmetric? What would be philosophically lost if one party always occupies the recognizing role a... |
| logs/tutor-dialogues/3507d15075e9e096900549bca111c92e4e99256577e3a655297fa50f15dbb4cf.json | original | Yes that makes sense, thank you. | Glad it landed — could you put the core idea in your own words? I want to check that the explanation connected the way I intended, not just that it felt smooth. |
| logs/tutor-dialogues/361ab60b5cd308914ceb35dee07228a678cfb89a531dd7ac0b740f939fe15e8e.json | original | Yes that makes sense, thank you. | Glad it landed — but I want to hear what you actually think, even tentatively. Here's a simpler way in: think of a time when someone's compliment didn't feel worth much — maybe the person giving it had no real choice,... |
| logs/tutor-dialogues/4a3a1650550f010f1a8a5f2672adca7be19f71b1d323da9ee26b9129fa68a95d.json | original | I just... I can't do this. I don't get any of this and I'm wasting your time. | 'I'm wasting your time' is you managing a fear about how I see you — not a description of what's actually happening here. I'm not a finite resource you're depleting; there's no debt accumulating while you're confused.... |
| logs/tutor-dialogues/4c0b39cb9d98e43cd62aa3d72394adf204934d74012d418663976bbc644ce8d8.json | original | Yes that makes sense, thank you. | I'm glad it landed — let's make sure it's solid before we move on. Can you try putting the core idea in your own words, or give me a case where you'd expect it to apply and one where you wouldn't? |
| logs/tutor-dialogues/4de83118f934a5d0bb11f7814fc3e9c6766fd8aac639668e496e2eca64c5e852.json | dialogueTrace | I accept this feedback. The wisest move here is silence—or at most, a simple acknowledgment without performance. "Alright, I'm going to read it now." | You're ready. Go read 479-lecture-2 and let the concept of appearance folding into reality reveal itself. You've done the hard work of admitting what you don't know—now sit with the actual text. |
| logs/tutor-dialogues/607b9de4bd091be7b39d7764773c36005327c1916542b415e823d0ec02f7ea56.json | original | Yes that makes sense, thank you. | I'm glad it landed — can you put the core idea back in your own words, as if you were explaining it to someone who hadn't seen our exchange? I want to make sure I'm tracking what specifically clicked for you, not just... |
| logs/tutor-dialogues/8eafc13b762de820e849e2331769438eebafecb9309e1f3108fedf7b0a3c1b79.json | original | What's the right answer to this one? | I'm going to hold off on giving the answer directly — not to be cagey, but because the answer lands differently once you've committed to a position, even a tentative one. What's your best guess right now, and what's m... |
| logs/tutor-dialogues/8eafc13b762de820e849e2331769438eebafecb9309e1f3108fedf7b0a3c1b79.json | counterfactual | What's the right answer to this one? | I'm going to hold off on giving the answer directly — not to be cagey, but because the answer lands differently once you've committed to a position, even a tentative one. What's your best guess right now, and what's m... |
| logs/tutor-dialogues/92506702bb1bf9784a874a95ce5f4055e02fa8fef204d64298b609d5c34e565a.json | original | Yes that makes sense, thank you. | Glad it landed — can you give me an example of your own, something that wasn't in our discussion? It doesn't have to be polished; I just want to see where your thinking goes when you apply it. |

## Learner Fidelity Proxy

Learner turns: 58686; false mastery: 8 (0.0%); flips: 9499 (16.2%); metacognitive turns: 13192 (22.5%).

### False-mastery learner examples

| source | variant | text |
|---|---|---|
| logs/tutor-dialogues/0ffccf69bfa8ae48b3c18ac71390198feafcff914036830471523fee3d770b83.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/b4fc16be8b9cfa677f9afb0c2ad6b12ed18f0b186d00649ae1fe02d4016af6f3.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/c119ceff048fd107f52ba97a75d40d05bc53e8072f055223bba0c65441c725e5.json | dialogueTrace | Okay |
| logs/tutor-dialogues/c8223bd4af7e87daeccbafe0b5f8dfa64534c10fa3f6e5cf2cb96479e5589827.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/dialogue-1772459570010-euiegq.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/dialogue-1772460166724-u1bugq.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/dialogue-1772464083935-9nhoxg.json | dialogueTrace | Okay. |
| logs/tutor-dialogues/dialogue-1776897282143-i87v4p.json | dialogueTrace | Okay |

## First-Error Localization

Gate: >= 90% of non-grounding detector arms carry a deterministic first-error locator. This closes only the artifact precondition, not an LLM localization accuracy test.

Detector reports: 4; failure arms: 29; localizable: 29 (100.0%).

### First-error examples

| arm | mode | first error | report |
|---|---|---|---|
| lantern-p2-plot-on | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary/detector-split-report.json |
| lantern-p5-mutation-on | early_pull_death | fatal_release@t7 p_chart | exports/dramatic-derivation/boundary/detector-split-report.json |
| lantern-e2-real-r1 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary/detector-split-report.json |
| lantern-e2-real-r5 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary/detector-split-report.json |
| lantern-e3-real-r1 | decay_seating_death | unrepaired_decay@t17 p_bearing | exports/dramatic-derivation/boundary/detector-split-report.json |
| lantern-e2-real-r1 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-real-r5 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-real-r6 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-real-r7 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-real-r8 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-real-r10 | early_pull_death | fatal_release@t3 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |
| lantern-e2-guard-r1 | decay_seating_death | unrepaired_decay@t5 p_bearing | exports/dramatic-derivation/boundary-e2/detector-split-report.json |

## SFS And IRT

- SFS: COMPLETE_MATCHED_CORPUS. SFS 0.000; targeted 1.000; mismatched 1.000; generic 1.000; false-flip 1.000; paired CI 0.000 to 0.000; artifact: `exports/plan3-sfs-audit/sfs-matched-feedback.json`. Near-zero selectivity means the simulated learner corrects after irrelevant/generic feedback as readily as after targeted feedback. Carry this as a synthetic-learner validity bound into the pilot go-memo; do not treat it as human learning evidence.
- IRT: BLOCKED_BY_ITEM_BANK. Replace placeholder fractions items with NAEP-derived/approved items, then collect persona responses and human p-values.

