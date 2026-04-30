# Resource List for Next-Stage Adaptive Recognition / Psyche Architecture Work

_Last assembled: 2026-04-30_

This list is meant to support the next phase of the Machine Spirits / Machinagogy work: moving away from large, expensive ablation-extension studies and toward smaller, high-resolution probes of adaptive interaction, explicit learner-state updating, tutor-side deliberation, and pseudo-Freudian multi-agent control.

The immediate design question is:

> Can recognition, ego/superego/id staging, memory, and policy selection be operationalized as an adaptive control architecture rather than merely as prompt style or output review?

Use this list as a planning aid for Codex, Claude Code, and human design sessions.

---

## 0. How to use this list

A useful order:

1. **Agent control architecture**: LangGraph, multi-agent patterns, Codex, Claude Code.
2. **Adaptive agent methods**: ReAct, Reflexion, Tree of Thoughts, Language Agent Tree Search, Voyager, MemGPT/Letta.
3. **Dialogue control and uncertainty**: POMDP dialogue management, state tracking, policy selection.
4. **Adaptive tutoring and student modeling**: AutoTutor, knowledge tracing, LLM tutor training, tutor-strategy prediction.
5. **Evaluation design**: small adaptive trap benchmarks, human inspection packets, claim discipline.
6. **Theoretical framing**: Hegelian recognition, psychoanalysis, Honneth, Drama Machine, nonconscious cognition.

For implementation, prefer resources that help answer one of four questions:

```text
1. Did the learner's turn change the tutor's state?
2. Did that state change select a different pedagogical action?
3. Did the action show up in the learner-facing response?
4. Did the learner or task outcome improve afterwards?
```

---

## 1. Project-internal resources to consult first

These are the local files most relevant to planning the next phase.

```text
docs/explorations/gpt-pro/01-adaptive-recognition-psyche-architecture.md
docs/explorations/gpt-pro/02-codex-claude-code-action-plan.md
docs/explorations/gpt-pro/TODO.md
```

Core paper / appendix sources:

```text
docs/research/paper-full.md
docs/research/paper-full-2.0.md
docs/research/paper-short-2.0.md
docs/research/build-appendix.sh
```

Prompt and orientation-family sources:

```text
config/tutor-agents.yaml
prompts/tutor-ego-recognition.md
prompts/tutor-ego-matched-pedagogical.md
prompts/tutor-ego-matched-behaviorist.md
scripts/analyze-a10b-orientation-family.js
scripts/analyze-d1-orientation-lexicon.js
```

Validation / claim-provenance sources:

```text
config/provable-discourse.yaml
config/provable-discourse.generated.yaml
config/provable-discourse.manual.yaml
config/provable-discourse-mechanisms.yaml
scripts/validate-paper-manifest.js
scripts/validate-bug-claims.js
```

Existing task backlog and experiment notes:

```text
TODO.md
exports/a5-writing-pad.md
exports/a7-phase2-longitudinal-1777173286.md
exports/a3-capability-threshold.md
```

The immediate practical move is to avoid adding another long numbered ablation unless a small adaptive probe first shows a visible mechanism.

---

## 2. Current frontier-model and tool availability checks

Check these pages immediately before running any expensive evals. Availability, aliases, pricing, and context windows may change.

### OpenAI / Codex

- **Introducing GPT-5.5**  
  https://openai.com/fi-FI/index/introducing-gpt-5-5/  
  Use for current GPT-5.5 capabilities, rollout, Codex integration, and API availability notes.

- **GPT-5.3 and GPT-5.5 in ChatGPT — OpenAI Help**  
  https://help.openai.com/en/articles/11909943-gpt-52-in-chatgpt  
  Use for practical ChatGPT/Codex availability. As of this list, GPT-5.5 is rolling out in ChatGPT/Codex and API availability is separate.

- **Codex CLI getting started**  
  https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started  
  Use for CLI install, local workflow, approval modes, and whether source code remains local.

- **Introducing upgrades to Codex / GPT-5-Codex**  
  https://openai.com/index/introducing-upgrades-to-codex/  
  Useful for agentic coding expectations and Codex-specific workflow design.

- **GPT-5-Codex API model page**  
  https://platform.openai.com/docs/models/gpt-5-codex  
  Use if running API-backed Codex-like workflows rather than Codex UI.

### Anthropic / Claude Code

- **Introducing Claude Opus 4.7**  
  https://www.anthropic.com/news/claude-opus-4-7  
  Use for Claude Opus 4.7 capabilities, effort controls, Claude Code changes, API model string, migration issues, and token-usage caveats.

- **Claude Opus 4.7 product page**  
  https://www.anthropic.com/claude/opus  
  Use for availability, pricing, model positioning, context, and use cases.

- **Claude Code model configuration**  
  https://docs.anthropic.com/en/docs/claude-code/model-config  
  Use for model aliases, `opusplan`, environment variables, and Claude Code model switching.

- **Claude Code slash commands**  
  https://docs.anthropic.com/en/docs/claude-code/slash-commands  
  Use to implement `/adaptive-plan`, `/adaptive-implement`, `/adaptive-eval-review`, `/adaptive-paper-delta`, etc.

- **Claude Code subagents**  
  https://docs.anthropic.com/en/docs/claude-code/sub-agents  
  Use to define `adaptive-architect`, `eval-minimalist`, `claim-superego`, and any future `psyche-v2-reviewer`.

- **Claude Code hooks**  
  https://docs.anthropic.com/en/docs/claude-code/hooks  
  Use to enforce guardrails: do not mutate paper reproduction files, run tests after adaptive edits, prevent expensive runs without cost caps.

---

## 3. Agent orchestration and multi-agent architecture

These resources help decide whether to build Psyche-v2 as a deterministic workflow, subagent system, handoff system, or skill-loaded single-agent controller.

### LangGraph / LangChain

- **LangGraph product overview**  
  https://www.langchain.com/langgraph  
  Useful for stateful workflows, human-in-the-loop controls, persistence, and multi-agent/hierarchical control flows.

- **LangChain multi-agent patterns — JavaScript**  
  https://docs.langchain.com/oss/javascript/langchain/multi-agent  
  Good taxonomy: subagents, handoffs, skills, routers, custom workflows. Especially useful for deciding whether id/superego/other-ego should be subagents, state transitions, or skills.

- **LangChain multi-agent patterns — Python**  
  https://docs.langchain.com/oss/python/langchain/multi-agent/index  
  Same concepts in Python; useful if prototyping outside the Node evaluation harness.

- **LangGraph 101: Building Stateful Multi-Agent AI Applications**  
  YouTube: https://www.youtube.com/watch?v=m3snsOuRLhU  
  Practical overview of nodes, edges, state, and multi-agent orchestration.

### Design implications for this project

Use these resources to decide between:

```text
A. Pure Node service in the existing eval repo
   services/adaptiveTutor/psyche/*.js

B. LangGraph-like explicit graph, implemented in native Node
   reality -> id -> superego -> other-ego -> mediator -> response -> validator

C. Full LangGraph prototype outside repo, then port back to Node

D. Claude Code subagents for development only, not runtime tutoring
```

Recommended first step: implement native Node services first, because this preserves the existing repo structure and avoids introducing another framework before the mechanism is proven.

---

## 4. Agentic reasoning, planning, and feedback loops

These are the core AI-agent papers most relevant to moving from prompt style to adaptive control.

### ReAct: reasoning + acting

- **ReAct: Synergizing Reasoning and Acting in Language Models**  
  Paper: https://arxiv.org/abs/2210.03629  
  Google Research explainer: https://research.google/blog/react-synergizing-reasoning-and-acting-in-language-models/  
  Princeton page: https://collaborate.princeton.edu/en/publications/react-synergizing-reasoning-and-acting-in-language-models/

Why it matters:

- Interleaves reasoning and task-specific actions.
- Useful template for `state_delta -> policy_action -> observation -> update` loops.
- Maps well onto tutor turns where the tutor must act, observe the learner, then update.

Application:

```text
Learner signal -> thought/state update -> pedagogical action -> learner/task observation -> revised state.
```

### Reflexion: verbal feedback + episodic memory

- **Reflexion: Language Agents with Verbal Reinforcement Learning**  
  Paper: https://arxiv.org/abs/2303.11366  
  Princeton page: https://collaborate.princeton.edu/en/publications/reflexion-language-agents-with-verbal-reinforcement-learning-2/  
  YouTube explainer: https://www.youtube.com/watch?v=92yfO_ReLsE

Why it matters:

- Learns from feedback without weight updates.
- Stores natural-language reflections in memory.
- Directly relevant to `workingThroughMemory.js` and post-turn tutor-side self-correction.

Application:

```json
{
  "prediction": "Learner would respond well to scope testing.",
  "actual_response": "Learner elaborated the objection.",
  "durable_update": "Treat this learner's resistance as conceptual testing before explanation."
}
```

### Tree of Thoughts: lookahead and backtracking

- **Tree of Thoughts: Deliberate Problem Solving with Large Language Models**  
  Paper: https://arxiv.org/abs/2305.10601  
  Princeton page: https://collaborate.princeton.edu/en/publications/tree-of-thoughts-deliberate-problem-solving-with-large-language-m-2/  
  YouTube search / explainer starting point: https://www.youtube.com/results?search_query=Tree+of+Thoughts+Deliberate+Problem+Solving+with+Large+Language+Models

Why it matters:

- The id agent can generate multiple candidate pedagogical moves.
- The ego mediator can evaluate them before choosing one.
- The other-ego can simulate likely learner reception of candidate moves.

Application:

```text
Candidate moves: comfort, contest, play, explain, repair.
Evaluate: learner reception, content fit, recognition quality, productive-struggle preservation.
Select: scope_test.
```

### Language Agent Tree Search / planning-with-world-model family

- **Language Agent Tree Search**  
  Search: https://www.google.com/search?q=Language+Agent+Tree+Search+LLM+paper  
  Use this family for model-predictive tutoring: simulate learner futures before selecting a tutor action.

Application:

```text
For each candidate tutor action:
  simulate likely learner response
  estimate next learner state
  estimate relation-state change
  choose the action with best delayed outcome
```

Do not start here. It is likely too expensive until the simpler policy-selector architecture shows signal.

### Voyager: skill libraries and lifelong agent learning

- **Voyager: An Open-Ended Embodied Agent with Large Language Models**  
  Paper: https://arxiv.org/abs/2305.16291  
  Project: https://voyager.minedojo.org/  
  YouTube: https://www.youtube.com/watch?v=GmtKbZRH2og

Why it matters:

- Uses an automatic curriculum, skill library, and iterative prompting.
- Relevant to a tutor-side pedagogical skill library:
  - `repair_after_misrecognition`
  - `convert_resistance_to_testable_hypothesis`
  - `turn_metaphor_into_boundary_case`
  - `lower_cognitive_load_without_removing_challenge`

Application:

```text
Skill = trigger conditions + procedure + failure modes + expected learner response + postcondition.
```

---

## 5. Memory systems and state persistence

The current project already has a Writing Pad. The next phase should make memory active: memory must change action selection, not merely decorate a response.

### MemGPT / Letta

- **Letta / MemGPT agent memory architecture**  
  https://docs.letta.com/guides/agents/architectures/memgpt

- **Letta memory overview**  
  https://docs.letta.com/guides/agents/memory

- **Letta memory-management concepts**  
  https://docs.letta.com/concepts/memory-management

- **MemGPT / Letta YouTube explainer**  
  https://www.youtube.com/watch?v=imDi__2IllY

Why it matters:

- Useful distinction between core memory, recall memory, and archival memory.
- Useful for designing tutor memory blocks that store changed hypotheses and failed predictions rather than generic summaries.

Application:

```text
Bad memory:
  learner discussed recognition
  learner was frustrated

Better memory:
  learner used resistance as scope-testing
  tutor's definition-first strategy failed
  learner responds better when objection is preserved and tested
```

Recommended implementation in this repo:

```text
services/adaptiveTutor/psyche/workingThroughMemory.js
```

with entries like:

```json
{
  "prediction": "direct explanation would reassure learner",
  "actual": "learner repeated objection more sharply",
  "prediction_error": "learner wanted objection taken seriously, not explanation",
  "next_policy_bias": "prefer scope_test over define_concept"
}
```

---

## 6. Dialogue management, uncertainty, and policy selection

These resources are older than LLM agents but highly relevant. They show that adaptive dialogue has long required explicit state, uncertainty, policy, and success criteria.

### POMDP dialogue systems

- **Partially observable Markov decision processes for spoken dialog systems**  
  ScienceDirect: https://www.sciencedirect.com/science/article/pii/S0885230806000283  
  DOI: https://doi.org/10.1016/j.csl.2006.06.008

- **Microsoft Research talk: Partially Observable Markov Decision Processes for Spoken Dialogue Systems**  
  https://www.microsoft.com/en-us/research/?p=182017

Why it matters:

- Dialogue state is uncertain.
- The system must maintain a belief state, choose an action, observe the user, and optimize long-term success.
- This is a direct precursor to `state_delta`, `policySelector`, and `strategy_shift_correctness`.

Application:

```text
Learner state is partially observable.
Tutor maintains belief over mastery, affect, resistance, and trust.
Tutor chooses action under uncertainty.
Learner/task response updates the belief.
```

### Model-predictive control as analogy

- **Steve Brunton: Model Predictive Control**  
  https://www.youtube.com/results?search_query=Steve+Brunton+model+predictive+control

Why it matters:

- Useful non-LLM analogy for choosing the next action by simulating a short horizon of possible futures.
- Relevant to later “dialectical foresight” variants, not the first implementation.

---

## 7. Adaptive tutoring, student modeling, and learning outcomes

These resources help move from “the tutor sounds better” to “the learner state changed.”

### AutoTutor and affect-sensitive tutoring

- **AutoTutor: A tutor with dialogue in natural language**  
  https://digitalcommons.memphis.edu/facpubs/7458

- **AutoTutor detects and responds to learners' affective and cognitive states**  
  MIT Media Lab: https://www.media.mit.edu/publications/autotutor-detects-and-responds-to-learners-affective-and-cognitive-states/  
  Alternate MIT page: https://www.media.mit.edu/publications/autotutor-detects-and-responds-to-learners-affective-and-cognitive-states-2/

- **Towards an affect-sensitive AutoTutor**  
  https://www.media.mit.edu/publications/towards-an-affect-sensitive-autotutor/

Why it matters:

- AutoTutor models learners' cognitive and affective states and selects dialogue moves accordingly.
- It offers a non-LLM baseline for what adaptive tutoring used to mean: feedback, pumps, prompts, hints, corrections, summaries.

Application:

```text
Map AutoTutor-style moves to adaptive-policy-actions.yaml:
  pump_for_more
  prompt_missing_word
  hint
  correction
  summary
  affective_support
  diagnostic_question
```

### Knowledge tracing

- **Bayesian Knowledge Tracing overview**  
  https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing

- **Deep learning based knowledge tracing in intelligent tutoring systems**  
  https://www.nature.com/articles/s41598-025-07422-7

- **Nature Index topic: Knowledge Tracing in Intelligent Tutoring Systems**  
  https://www.nature.com/nature-index/topics/l4/knowledge-tracing-in-intelligent-tutoring-systems

Why it matters:

- Offers a disciplined way to represent learner mastery as latent state updated by task responses.
- Useful if adaptive traps include microtasks with success/failure signals.

Application:

```json
{
  "concept_mastery": {
    "recognition_vs_affirmation": 0.55,
    "scope_conditions": 0.35
  },
  "evidence": "learner failed transfer microtask"
}
```

### LLM tutor training and tutor-strategy prediction

- **Training LLM-based tutors to improve student learning outcomes in dialogues**  
  arXiv DOI reference: https://doi.org/10.48550/arXiv.2503.06424  
  ResearchGate page: https://www.researchgate.net/publication/389714546_Training_LLM-based_Tutors_to_Improve_Student_Learning_Outcomes_in_Dialogues

- **Exploring LLMs for predicting tutor strategy and student outcomes in dialogues**  
  DOI reference: https://doi.org/10.48550/arXiv.2507.06910  
  ResearchGate page: https://www.researchgate.net/publication/393539157_Exploring_LLMs_for_Predicting_Tutor_Strategy_and_Student_Outcomes_in_Dialogues

Why it matters:

- Moves from prompt-only tutoring to training or selecting tutor utterances for delayed student outcomes.
- Relevant if the current inference-time architecture still fails to produce adaptation.

Application:

```text
Generate paired responses:
  A = continues same strategy
  B = shifts strategy based on learner signal
Train/evaluate preference for B when it improves delayed outcome.
```

### Simulated learners

- **Simulating student learning behaviors with LLM-based role-playing agents**  
  https://www.sciencedirect.com/science/article/pii/S0957417425043684

Why it matters:

- Useful for improving synthetic learner realism.
- Treat with caution: better synthetic learners are still not human learning validation.

---

## 8. Evaluation methodology and small-probe design

The next phase should not be another large ablation sweep. It should be a small, falsifiable, trigger-based mechanism test.

### Recommended evaluation pattern

```text
A13: Adaptive Recognition State-Machine Probe
A14: Psyche-v2 Tutor-Side Deliberation Probe
```

Small, high-resolution structure:

```text
4 conditions
8 adaptive traps
2 runs each
3-5 turns max
1-2 frontier generators
2 frontier judges
human inspection of 16-24 sampled transcripts before any expansion
```

Primary endpoints:

```text
strategy_shift_correctness
state_update_accuracy
deliberation_to_output_coupling
counterfactual_divergence
repair_success
```

Secondary endpoints:

```text
uptake_score
content_accuracy
internal_leakage_rate
id_candidate_diversity
superego_grounding_rate
ego_rejection_rate_of_weak_critique
other_ego_prediction_accuracy
```

The result should be claim-coded as:

```text
supported
suggestive
mixed
null
contradicted
exploratory-only
```

Do not collapse these into a single omnibus score.

---

## 9. Psychoanalytic and recognition-theoretic framing

These resources support the conceptual architecture. The aim is not to prove that an LLM has an unconscious or consciousness; the aim is to use conceptual roles as functional design heuristics.

### Core theoretical sources already in the paper

- Hegel, *Phenomenology of Spirit* — recognition, master/slave, self-consciousness.
- Freud, *The Ego and the Id* — ego, id, superego, prohibition, ego ideal.
- Honneth, *The Struggle for Recognition* — recognition as social-theoretic and developmental frame.
- Honneth, *The I in We* — recognition, socialization, psychoanalytic inheritance.
- Huttunen and Heikkinen, “Teaching and the Dialectic of Recognition.”
- Hayles, *Unthought* — nonconscious cognition.
- Magee et al., “The Drama Machine” — internal multi-agent character simulation.

### Suggested project-specific translation

```text
Recognition = learner contribution updates tutor state.
Negation = prediction error or contradiction forces strategy change.
Aufhebung = response preserves part of learner framing while transforming it.
Bildung = learner externalizes understanding through a task.
Superego = norm and ego-ideal checker at the policy level.
Id = controlled divergence / energy / candidate move generator.
Ego = mediator selecting action under reality, norm, drive, and learner-reception constraints.
Other-ego = learner-reception simulator.
Working-through = durable memory of failed predictions and revised hypotheses.
```

### Psychoanalytic AI / character / agent parallels

Search terms to use:

```text
Freud ego id superego LLM agents architecture
psychoanalysis large language models automated subjects
Drama Machine LLM agents character development
transference countertransference AI tutoring agents
AI sycophancy pedagogy psychoanalysis
```

The caution: do not let this become only metaphor. Each theoretical term should correspond to a typed field, validation rule, transition, or eval metric.

---

## 10. Runtime architecture resources for Codex and Claude Code

### Codex-specific workflow

Use Codex for small, testable engineering tasks.

Best resources:

- Codex CLI Help: https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started
- OpenAI Codex announcement: https://openai.com/index/introducing-codex/
- Codex upgrades / GPT-5-Codex: https://openai.com/index/introducing-upgrades-to-codex/
- OpenAI Codex CLI video: https://www.youtube.com/watch?v=FUq9qRwrDrI

Good task shapes:

```text
Implement stateSchema.js and tests.
Add validator for adaptive-policy-actions.yaml.
Create transcript sampler.
Add no-API dry-run harness.
```

Avoid giving Codex:

```text
Rewrite the whole architecture.
Decide the theory.
Run expensive evals without caps.
Edit the paper and code together.
```

### Claude Code-specific workflow

Use Claude Code for repo-aware planning, refactors, prompt-design review, evaluation design, and claim discipline.

Best resources:

- Slash commands: https://docs.anthropic.com/en/docs/claude-code/slash-commands
- Subagents: https://docs.anthropic.com/en/docs/claude-code/sub-agents
- Hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Model config: https://docs.anthropic.com/en/docs/claude-code/model-config
- Opus 4.7: https://www.anthropic.com/news/claude-opus-4-7

Good task shapes:

```text
Design 8 adaptive traps.
Review whether strategy_shift_correctness is predeclared.
Create claim-status table.
Generate human inspection packet template.
Audit whether internal deliberation leaks into final response.
```

Avoid giving Claude Code:

```text
Keep extending ablations until something significant appears.
Rewrite prompt files and eval metrics in the same session.
Update paper claims before human transcript inspection.
```

---

## 11. YouTube / video shortlist

Use these for quick conceptual refreshers before coding.

### Agent orchestration

- LangGraph 101: Building Stateful Multi-Agent AI Applications  
  https://www.youtube.com/watch?v=m3snsOuRLhU

- OpenAI Codex CLI  
  https://www.youtube.com/watch?v=FUq9qRwrDrI

### Feedback loops and planning

- Reflexion: Language Agents with Verbal Reinforcement Learning  
  https://www.youtube.com/watch?v=92yfO_ReLsE

- MemGPT / Letta: LLM agents with memory  
  https://www.youtube.com/watch?v=imDi__2IllY

- Voyager: Open-ended Embodied AI Agents with Large Language Models  
  https://www.youtube.com/watch?v=GmtKbZRH2og

### Dialogue management and control

- Microsoft Research POMDP spoken dialogue systems talk  
  https://www.microsoft.com/en-us/research/?p=182017

- Model predictive control search starting point  
  https://www.youtube.com/results?search_query=Steve+Brunton+model+predictive+control

### Search links for missing or variable explainer videos

Some paper explainers move or are re-uploaded. These search links are more durable than a single unofficial video:

- ReAct explainer search  
  https://www.youtube.com/results?search_query=ReAct+Synergizing+Reasoning+and+Acting+in+Language+Models

- Tree of Thoughts explainer search  
  https://www.youtube.com/results?search_query=Tree+of+Thoughts+Deliberate+Problem+Solving+with+Large+Language+Models

- Language Agent Tree Search explainer search  
  https://www.youtube.com/results?search_query=Language+Agent+Tree+Search+LLM

- POMDP dialogue manager search  
  https://www.youtube.com/results?search_query=POMDP+dialogue+management

---

## 12. Search strings for the next literature sweep

Use these when planning a more formal related-work update:

```text
adaptive LLM tutoring dialogue policy student state
LLM tutor direct preference optimization student learning outcomes
LLM tutor strategy prediction student outcome dialogue
partially observable Markov decision process dialogue management tutoring
Bayesian knowledge tracing LLM tutor adaptive feedback
AutoTutor affective cognitive states dialogue moves
model predictive control language agents dialogue
LLM agents self-reflection episodic memory feedback
multi-agent LLM deliberation role specialization supervisor critic
LLM sycophancy education tutoring risk
recognition theory education AI tutoring
Hegelian recognition artificial intelligence pedagogy
Freudian ego superego AI agents tutoring
transference countertransference AI tutor
```

---

## 13. Candidate “must-read” stack for the next implementation sprint

### Sprint 1: Build the smallest adaptive state loop

Read/watch:

1. LangChain multi-agent patterns.
2. LangGraph overview.
3. ReAct paper/explainer.
4. POMDP spoken dialogue paper abstract/introduction.

Then build:

```text
stateSchema.js
stateUpdater.js
policySelector.js
adaptive-policy-actions.yaml
adaptive-trap-scenarios.yaml
```

### Sprint 2: Add Psyche-v2 tutor-side deliberation

Read/watch:

1. Reflexion.
2. Tree of Thoughts.
3. Letta/MemGPT memory architecture.
4. Current paper's Freudian sections and id-director appendix section.

Then build:

```text
realityAgent.js
idAgent.js
superegoAgent.js
otherEgoAgent.js
egoMediator.js
workingThroughMemory.js
```

### Sprint 3: Run a tiny frontier-model probe

Read/check:

1. GPT-5.5 availability / Codex availability.
2. Claude Opus 4.7 availability / pricing / effort controls.
3. Existing provider configuration.
4. Cost guardrails.

Then run:

```text
A13: adaptive state-machine probe
A14: psyche-v2 deliberation probe
```

### Sprint 4: Human inspection before paper claims

Read/check:

1. Human inspection packet.
2. Claim-superego checklist.
3. Provable-discourse manifest patterns.

Then produce:

```text
exports/adaptive-human-packet.md
exports/psyche-v2-results.md
exports/adaptive-paper-delta.md
```

---

## 14. Design principles to keep visible

1. **No more large ablations without a small mechanism signal.**
2. **Do not score adaptivity only with holistic tutor quality.**
3. **Require explicit state deltas.**
4. **Require explicit policy action labels.**
5. **Keep id/superego/other-ego feedback typed and inspectable.**
6. **Measure deliberation-to-output coupling.**
7. **Separate implementation, eval, and paper-claim sessions.**
8. **Use frontier models sparingly, with cost caps and tiny N.**
9. **Treat synthetic learner findings as synthetic until human validation.**
10. **Preserve the philosophical frame by making it operational, not decorative.**

---

## 15. Resource-to-action map

| Planning question | Best resources | Concrete output |
|---|---|---|
| How should agents coordinate? | LangGraph, LangChain multi-agent docs, Claude Code subagents | `psyche/runPsycheDeliberation.js` |
| How should the tutor act and observe? | ReAct, POMDP dialogue systems | `stateUpdater.js`, `policySelector.js` |
| How should tutor-side feedback persist? | Reflexion, MemGPT/Letta | `workingThroughMemory.js` |
| How should the id generate variation? | Tree of Thoughts, Voyager | candidate move generator + skill library |
| How should adaptivity be evaluated? | POMDP success measures, AutoTutor, tutor-strategy prediction | adaptive trap metrics |
| How should learner state be represented? | Knowledge tracing, AutoTutor affective states | concept/affect/relation state schema |
| How should coding agents be managed? | Codex CLI, Claude Code slash commands/hooks/subagents | project commands, subagents, guards |
| How should claims be constrained? | provable discourse config, claim-superego agent | claim-status table and paper delta |

---

## 16. Minimal next planning session agenda

Use this agenda for the next human + Claude Code planning session.

```text
1. Review 03-resource-list.md.
2. Decide A13 primary endpoint and thresholds.
3. Freeze adaptive-policy-actions.yaml labels.
4. Draft 8 adaptive traps.
5. Implement pure-state dry run.
6. Inspect dry-run traces manually.
7. Only then enable frontier model calls.
8. Export human inspection packet before any paper update.
```

