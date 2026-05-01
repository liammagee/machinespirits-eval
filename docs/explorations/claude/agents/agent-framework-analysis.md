# Agent Framework Analysis for the Adaptive Tutor / Psyche-v2 Stack

**Date:** 2026-04-30
**Status:** Canonical decision document. Consolidates three earlier analyses into one.
**Scope:** Framework evaluation against the consolidated-plan.md requirements (Phase 1 shipped on LangGraph.js, A13 real-LLM gate next, Psyche-v2 conditional on A13).

This document supersedes three earlier exploratory passes — the LangGraph-vs-Inspect-AI hybrid framing, the pattern-mining frame, and the seven-framework comparison — and folds the additive material from each into a single reference.

---

## 1. Bottom Line Up Front

**Stay on LangGraph.js. Do not port.** Optionally hybridize with **XState** for the recognition FSM and policy selector, and with **LiteLLM** for the multi-provider/cost-ceiling layer. Adopt **Inspect AI** as a separate evaluation harness for pre-registered A13/A14 runs.

The seven frameworks in scope split into three groups against the consolidated plan's eleven requirements:

- **Strong fit:** LangGraph.js (incumbent), XState (as a hybridization for the recognition FSM only).
- **Credible but wrong shape:** OpenAI Agents SDK, AutoGen v0.4 / Microsoft Agent Framework. Both fight the externalised-learner-model strategy by pulling toward conversational or handoff-as-tool control flow.
- **Actively misaligned:** Letta (auto-managed memory violates pre-registration), CrewAI (role/message metaphor not first-class on typed shared state), Claude Agent SDK (single-provider, biased toward filesystem/terminal coding agents).

The negative case for porting is dominated by two facts: (1) a port now would forfeit the existing checkpointing + `counterfactual_divergence` machinery, which is the project's measurement substrate, and (2) every alternative either downgrades typed state, forces a chat-conversation paradigm, introduces auto-magic incompatible with pre-registration, or removes LLM-native primitives. The positive case for staying has been strengthened by LangGraph.js v1.0 (October 2025): Standard-Schema-compliant `StateSchema`, deferred nodes, node caching, pre/post model hooks, built-in cost tracking.

The interesting frameworks are not migration candidates but **pattern sources** for capabilities you have not yet built — Voyager's skill-library indexing for the 14 pedagogical actions, Generative Agents' memory-stream retrieval for `workingThroughMemory`, Burr's checkpoint-as-eval-case workflow for failed strategy shifts. These are covered in §6.

---

## 2. What the Project Actually Needs

Eleven requirements, derived from the consolidated plan:

1. **Typed structured state across turns.** The learner profile is a JSON schema that must validate; state is the central object passed between nodes. Frameworks that treat state as a flat conversation transcript or implicit chat history fail this.
2. **Conditional edges / explicit control flow.** Policy selector chooses one of 14 named actions based on state; the recognition state machine and finite-state dialog manager are explicit.
3. **Checkpointing with rewind/replay.** Strategy 4 (counterfactual divergence) requires forking a dialog at turn N, perturbing hidden state, and replaying.
4. **Multi-provider model swapping.** Must work cleanly with Anthropic Claude (Sonnet 4.6, Haiku 4.5, Opus thinking), OpenAI (GPT-5.5, o-series), DeepSeek V3.2, Gemini Flash 3.0.
5. **Trace persistence to a SQL-backed `evaluation_results` table.** Each scenario run writes one row with profile_name, dialogue, suggestions, deliberation trace JSON.
6. **Bilateral (mirror) architecture.** The learner side is itself an ego/superego pair. A13/A14 may need to run the same architecture twice against each other.
7. **Tracing & observability.** Structured per-node logs, navigable in development, exportable for analysis.
8. **Operational footprint.** Library preferred over SaaS; minimal external services; reproducible across machines and over time.
9. **Cost ceiling enforcement.** `--max-cost <USD>` flag, pre-call estimation, hard abort.
10. **Pre-registration discipline.** Frameworks that do "automatic" things (auto-summarization, auto-memory-management, auto-tool-selection) are at odds with the commitment that all behavior must be explicitly declared.
11. **Strict non-leakage rule.** Internal deliberation must NOT appear in learner-facing tutor responses. ≤5% leakage rate is an A14 success criterion.

---

## 3. Comparison Table

✅ first-class fit · 🟡 workable with explicit effort · ❌ structurally awkward or absent.

| Requirement | LangGraph.js | Letta | AutoGen v0.4 / AG2 / MS Agent Fwk | CrewAI | OpenAI Agents SDK | Claude Agent SDK | XState |
|---|---|---|---|---|---|---|---|
| **1. Typed state across turns** | ✅ `StateSchema` w/ Zod/Valibot/ArkType (v1, 2025); reducers explicit | 🟡 Stateful but state model is *memory blocks* (core/archival), not a typed JSON profile | ✅ AgentChat msgs typed; v0.4 has full type support | 🟡 Pydantic structured outputs per task; shared state via `Flow[State]`, not crew-level | 🟡 `RunContextWrapper.context` is dependency-injection, not validated state | ❌ State is the agent's *file system + transcript*; no typed profile primitive | ✅ Statecharts have first-class typed `context`; TS inference excellent |
| **2. Conditional edges / explicit control flow** | ✅ `addConditionalEdges` is core; FSM-shaped graphs idiomatic | ❌ Control flow is the agent's tool-call loop | 🟡 v0.4 event-driven actor model + `SelectorGroupChat`; conversational | 🟡 `Flow` `@router` decorators give branching; `Crew` itself sequential/hierarchical | 🟡 Handoffs are tool-calls the LLM picks; "code-first" rather than declared graph | ❌ Control flow lives inside Claude's agent loop | ✅ This is XState's reason to exist — guards, transitions, hierarchy, parallel states |
| **3. Checkpointing with rewind/replay** | ✅ `MemorySaver`/`SqliteSaver`/`PostgresSaver`, `getStateHistory`, fork-from-checkpoint documented | 🟡 Agent state persisted to DB; `.af` agent-file format; not designed for mid-dialog perturbation forks | 🟡 v0.4 has serializable state; checkpoint primitives less mature | 🟡 Flows persist execution + state; fork/replay not first-class | ❌ "Sessions" are conversation history; no public fork-and-perturb API | 🟡 `enable_file_checkpointing` + `rewind_files()` for *files*, not for typed dialog state | ✅ Statecharts deterministic; persist `state.value + context` and resume trivially |
| **4. Multi-provider model swapping** | ✅ Native `@langchain/anthropic`, `@langchain/openai`, `@langchain/google-genai`; DeepSeek via OpenAI-compat | ✅ Model-agnostic via LiteLLM | ✅ `OpenAIChatCompletionClient` + custom clients | ✅ Provider-agnostic via LiteLLM | 🟡 Provider-agnostic only via `LitellmModel` extension; otherwise OpenAI-biased | ❌ Claude-only (Anthropic/Bedrock/Vertex Claude); no GPT/Gemini/DeepSeek | N/A (substrate; you bring your own LLM client) |
| **5. Trace persistence to SQL** | ✅ Checkpointer is a SQL backend; node outputs are state deltas you can serialize per-row | 🟡 Letta Evals writes structured run results to its own store; SQL export custom | ✅ OpenTelemetry built into v0.4; SQL via OTel collector | 🟡 Real-time tracing built-in; custom SQL needs glue | 🟡 Built-in tracing UI; SQL export requires OpenAI traces ingestion or custom hooks | 🟡 W3C trace context, OpenTelemetry; SQL is glue | ✅ You write logging in actions/effects — full control |
| **6. Bilateral / mirror architecture** | ✅ Subgraphs + same `StateGraph` instantiated twice with different state slots is idiomatic | ❌ "Agent" is a top-level entity with its own DB row | 🟡 GroupChat metaphor pulls toward one shared conversation | ❌ "Crew" is a top-level concept; nesting one crew inside another isn't idiomatic | 🟡 `agent.asTool()` enables nesting, but the runner assumes a single root agent | ❌ Designed around a single `query()` agent with subagents | ✅ Spawn-able actors; running two copies of the same machine is canonical |
| **7. Tracing & observability** | ✅ LangSmith integration + native streaming events; structured per-node | ✅ ADE shows transparent reasoning; Letta Evals for systematic testing | ✅ OpenTelemetry first-class (a major v0.4 selling point) | ✅ Real-time tracing, LangSmith/AgentOps integrations | ✅ Built-in tracing dashboard, OpenAI-hosted; provider-agnostic via OTel | ✅ Distributed tracing, W3C trace context | 🟡 Stately Inspect for state transitions; you build LLM-call observability yourself |
| **8. Operational footprint** | ✅ Library (npm package); zero external service required | 🟡 Library + **server** (Postgres-backed); Docker recommended | 🟡 Library; AutoGen Studio is optional GUI; MS Agent Fwk leans Azure | 🟡 Library; CrewAI AMP is the SaaS upsell | ✅ Library; Agent Builder is optional SaaS | 🟡 Library that **bundles the Claude Code CLI as a subprocess** | ✅ Pure library; <5KB; zero deps |
| **9. Cost ceiling enforcement** | ✅ Programmatic LLM calls; cost-tracking shipped July 2025 | 🟡 LLM calls happen inside Letta's loop; pre-call budget check requires hooks | ✅ Programmatic; you own the call site | ✅ Programmatic; tracking via callbacks | 🟡 Runner abstracts the loop; `RunHooks.on_llm_start` allows pre-call gating | 🟡 `max_budget_usd` option exists; you cede control of the inner loop | ✅ You make the LLM call inside an action — total control |
| **10. Pre-registration discipline** | ✅ Nothing happens that you didn't declare in a node | ❌ Auto memory paging, auto archival, sleep-time compute, self-editing memory blocks | 🟡 Speaker-selection LLM in GroupChat is implicit; v0.4 actor model more explicit | 🟡 Default memory system, dynamic delegation; can be disabled but on by default | 🟡 Auto-conversation-history, auto-context Sessions; can override but defaults add behaviour | ❌ Auto context compaction, auto Skills discovery, auto MCP, auto subagent spawning | ✅ Statecharts are total: every transition is declared. Gold standard for pre-registration |
| **11. Strict non-leakage** | ✅ State separates internal from `final_response` channel; trivial to enforce | 🟡 Reasoning visible in transcript by design; requires post-hoc filtering | 🟡 Inner monologue patterns leak into shared GroupChat unless partitioned | 🟡 Agents' `thoughts` may surface unless suppressed | 🟡 Default tracing exposes intermediate reasoning | ❌ Subagent transcripts designed to be readable end-to-end; "thinking" tokens are first-class | ✅ Internal context is internal unless you emit it |

---

## 4. Per-Framework Analysis

### 4.1 LangGraph.js (current scaffold)

**Status.** v1.0 GA October 2025 (both Python and JS shipped together with the explicit "no breaking changes" promise). MIT-licensed npm package `@langchain/langgraph`. Maintained by LangChain Inc., now the default runtime for all LangChain agents. The Python-vs-JS parity gap that worried teams in 2023–2024 has materially closed: as of mid-2025 LangChain reports rolling features to JS and Python in the same changelog (node caching, deferred nodes, pre/post model hooks, built-in provider tools, cost tracking). The v1 line introduced `StateSchema` with Standard-Schema support (Zod 4, Valibot, ArkType) — the JS equivalent of Python's `TypedDict`/Pydantic state, with full type inference. A residual gap remains in *ecosystem breadth*: LangGraph Python still has more checkpointer backends (Couchbase, MongoDB, Redis ports land in Python first), more example notebooks, and the official courses are Python-only. For a research project of this size, the gap is cosmetic, not structural.

**Fit for this project:**
- **Best architectural match in the set.** The four most load-bearing requirements — typed state, conditional edges, checkpoint/replay, structured trace export — are the framework's *primary* selling points, not bolt-ons.
- The `getStateHistory` API + thread-scoped checkpointer is exactly the primitive A13's `analyze-strategy-shift.js` `counterfactual_divergence` metric needs: fork at turn N, mutate `hidden_learner_state`, resume.
- Subgraphs make the bilateral mirror architecture (Gate D Psyche-v2: 6 agents × 2 sides) idiomatic rather than awkward — you instantiate the same compiled graph twice with different state namespaces.
- The `mockLLM.callRole` / `realLLM.callRole` swap point you already have is a perfectly orthodox provider-agnostic pattern; LangGraph does not force you to use its `@langchain/anthropic` adapters if you'd rather call providers directly.
- *Sharp edge:* the Python and JS state-update semantics differ (Python `state['messages'].append(...)` mutates; JS reducer concatenates) — easy to trip on if you cross-reference Python tutorials. Stick to the JS docs.

### 4.2 Letta (formerly MemGPT)

**Status.** Apache 2.0; v1 agent loop announced September 2025 ("Rearchitecting Letta's Agent Loop"); TypeScript and Python SDKs shipped April 2025; `letta-evals` open-sourced October 2025; `.af` (Agent File) format April 2025. Run as a Postgres-backed server (`docker run … letta/letta:latest`), with an Agent Development Environment GUI at app.letta.com. The framing is "LLM-as-OS": agents manage their own memory tiers (core / recall / archival) via tool calls, with sleep-time compute for asynchronous memory consolidation.

**Fit for this project:**
- **Conceptually misaligned with pre-registration.** Letta's flagship features — self-editing memory blocks, automatic context paging, sleep-time agents, the "memory omni-tool" with Sonnet 4.5 — are precisely the kind of implicit behaviour the paper has committed to *not* having. You would spend most of your effort disabling defaults.
- The "stateful agent" metaphor is about a *single agent's* persistent identity, not about a typed JSON learner profile passed between specialised sub-agents. Mapping the 6-agent Psyche-v2 stack onto Letta would require treating each agent as a separate Letta agent talking via its multi-agent message-passing layer, losing the typed shared state.
- `letta-evals` (Oct 2025) does support reproducible runs with `.af` files as targets and `--num-runs N` for variance, which is genuinely useful — but counterfactual replay (perturb hidden state at turn N, resume) is not the primitive it offers; it offers regression testing, not state-perturbation experiments.
- Server-mode operational footprint is heavier than needed for a single-researcher academic project.
- **Useful as a comparison baseline** for the paper itself (Letta-style auto-memory vs. externalised typed state), not as the implementation substrate. See §6.3 for the Letta *patterns* worth lifting.

### 4.3 AutoGen v0.4 / AG2 / Microsoft Agent Framework

**Status.** Microsoft released AutoGen v0.4 in January 2025 as a from-scratch rewrite (asynchronous event-driven actor model, OpenTelemetry, layered API: `autogen-core` / `autogen-agentchat` / `autogen-ext`). The original AutoGen creators forked into the community-led **AG2** (Apache 2.0, on a v1.0 roadmap with deprecation cycles). In **October 2025**, Microsoft announced the **Microsoft Agent Framework**, a unification of AutoGen and Semantic Kernel; **v1.0 GA shipped April 2026** for Python and .NET. AutoGen v0.4 and Semantic Kernel are now in maintenance mode; new investment is in MS Agent Framework. The migration is therefore a *moving target* mid-paper.

**Fit for this project:**
- **Stability risk.** v0.2 → v0.4 was a hard rewrite; v0.4 → MS Agent Framework is the second migration in 18 months. For an academic paper that needs to be reproducible 2–3 years later, this is a substantive risk.
- The conversational/GroupChat metaphor (`SelectorGroupChat`, speaker-selection-by-LLM) fights the "explicit policy selector picks one of 14 named actions" requirement. v0.4's `Core` actor layer is more explicit but the productive abstraction (`AgentChat`) is conversation-shaped.
- OpenTelemetry tracing is genuinely best-in-class in this set, which would pay off at A14 scale.
- Python + .NET only; no first-class TypeScript story, which would force a rewrite away from the current scaffold.
- *Verdict:* if you were starting in Python from scratch *and* needed enterprise observability, MS Agent Framework would be defensible. From a smoke-passing LangGraph.js scaffold, the migration cost and stability risk are not justified. The **GroupChat selector pattern** is worth lifting as a reference for the egoMediator (see §6.4).

### 4.4 CrewAI

**Status.** MIT-licensed Python framework; standalone (no LangChain dependency); rebuilt unified Memory class in 2025; `Flow` (event-driven, `@start`/`@listen`/`@router` decorators with `Flow[StateModel]`) is the production layer beneath the role-based `Crew` abstraction. Active community, CrewAI AMP is the SaaS upsell.

**Fit for this project:**
- The role/goal/backstory abstraction is a *prompt-engineering* metaphor, not a state-management one. Tasks pass outputs sequentially; "shared state" between roles is not first-class at the `Crew` level.
- `Flow` *does* provide typed shared state (Pydantic models), structured routing (`@router`), and is what experienced practitioners reach for in production. But at that point you have essentially a worse LangGraph: the graph is implicit in decorator order, and the role/agent metaphor inside each step still pushes prompts toward "you are a Researcher with 20 years of experience…" rather than "execute pedagogical action `mirror_and_extend`."
- Multiple 2026 production reviews flag CrewAI as "fine for prototyping, teams migrate to LangGraph for production state management."
- Community itself reports recurring problems with consistent structured outputs.
- Python-only; would force a rewrite from TypeScript.
- *Verdict:* not a good architectural match. Skip.

### 4.5 OpenAI Agents SDK (March 2025; Python and JS/TS)

**Status.** MIT-licensed; production-ready upgrade of the experimental Swarm. Available in both Python (`openai-agents`) and TypeScript (`@openai/agents`). Provider-agnostic claim is technically true (custom `ModelProvider` or `LitellmModel` extension supports 100+ LLMs) but the developer ergonomics, tracing UI, and built-in tools are OpenAI-first. Primitives: `Agent`, `handoff()`, `RunContextWrapper`, `Sessions`, `Guardrails`, `Tracing`. Sandbox Agents and Realtime Agents added in 2025.

**Fit for this project:**
- **Handoff is a tool call the LLM chooses to make.** This is structurally incompatible with the project's "policy selector deterministically picks one of 14 named actions based on state" requirement. You'd be fighting the framework's grain.
- `RunContextWrapper.context` is dependency injection, not validated state; the SDK's docs explicitly say "use `input_type` for metadata the model decides at handoff time, not for application state." This is the opposite of what the project needs.
- `Sessions` does automatic conversation-history management — implicit behaviour incompatible with pre-registration unless explicitly disabled.
- The TypeScript SDK uses Zod for tool-call validation, which is at least familiar.
- Cost ceiling and provider-swap can be implemented but require going through `LitellmModel` or custom `ModelProvider` — non-trivial glue if you also want OpenAI's tracing.
- *Verdict:* a credible thin wrapper for OpenAI-centric projects with handoff-shaped control flow. Wrong shape for this project.

### 4.6 Anthropic Claude Agent SDK (Sep 29, 2025)

**Status.** Renamed from Claude Code SDK; Python (`claude-agent-sdk`) and TypeScript (`@anthropic-ai/claude-agent-sdk`) packages, both actively released through 2026 (e.g., v0.1.68, April 2026; v0.2.123 TypeScript, late April 2026). Bundles the Claude Code CLI as a subprocess. Supports Anthropic API, Bedrock, Vertex, Azure Foundry. Agentic loop = "gather context → take action → verify work → repeat", optimized for filesystem/terminal/coding work, with subagents for parallelization, MCP integration, Skills, and structured outputs. v0.1.x added `max_budget_usd`, file-checkpointing with `rewind_files()`, and SessionStore adapters (S3/Redis/Postgres reference implementations).

**Fit for this project:**
- **Locked to Claude.** This violates Requirement 4 outright — you cannot run DeepSeek V3.2, Gemini Flash 3.0, GPT-5.5, or o-series through this SDK. For a 4-condition design that depends on cross-provider comparison, this is disqualifying.
- The agent harness is opinionated toward *coding work*: filesystem access, bash, edit/read tools. None of that is what an adaptive tutor needs.
- Default behaviour includes auto context compaction, auto Skills discovery, dynamic system-prompt sections (working dir, git status). Promptfoo docs explicitly note that `exclude_dynamic_sections: true` is required to keep the prompt-caching prefix stable for evals — illustrating the pre-registration problem.
- *Prompt caching note:* Anthropic introduced automatic prompt caching API-wide in 2025. **You get this benefit on Sonnet/Haiku/Opus 4.x regardless of which framework you use** — including LangGraph.js — provided you place `cache_control` correctly. Claude Agent SDK does not give you a unique caching advantage relative to a direct Anthropic SDK call from inside a LangGraph node.
- *Verdict:* wrong tool. The **`max_budget_usd` parameter** is the only thing worth lifting (see §6.6).

### 4.7 XState (Stately)

**Status.** MIT, mature (v5.x), zero-dependency, ~1.3k stars on the Stately monorepo; statecharts library descended from Harel's formalism. The Stately team also publishes `@statelyai/agent` (small library; integrates XState with Vercel AI SDK across OpenAI/Anthropic/Google/Mistral/Groq/Perplexity), explicitly designed for state-machine-powered LLM agents with observations/feedback/insights. Recent industry analyses (late 2025 / early 2026) treat statecharts + orchestrators as the production pattern for agent reliability.

**Fit for this project:**
- **Best-in-class for the recognition state machine and 14-action FSM specifically.** Statecharts give you exhaustive transition checking, hierarchical states (e.g., `engaged.deepening`, `engaged.repairing`), parallel regions (e.g., `tutor_recognition` ‖ `learner_state_tracking`), and visual diagram export — all of which directly improve the pre-registration story for the paper.
- *But* XState alone is not an LLM framework. You'd still write the LLM-call orchestration, checkpointing, trace persistence, and provider-swapping yourself. That is *more* code than the LangGraph.js scaffold currently has.
- `@statelyai/agent` is small and not a substitute for LangGraph's checkpointing — designed for guided decision-making, not for forked-counterfactual replay measurement.
- **The strongest hybridization candidate.** Use XState *inside* a LangGraph node to model the recognition state machine and policy selector; keep LangGraph for the graph, checkpointing, multi-provider, and trace persistence. The XState diagram can ship as a figure in the paper's methods section.

---

## 5. Evaluation Harness: Inspect AI

This is a separate concern from the agent framework itself. The seven frameworks above are runtimes for the tutor; **none of them is a research-grade evaluation harness**. They all assume you will plug into LangSmith, Logfire, AgentOps, or a custom dashboard for *operational* observability — which is not the same thing as a factorial experiment with model-graded scorers, hidden-state injection, per-turn behaviour assertions, and bootstrapped statistics.

**Inspect AI** (UK AI Security Institute) is the strongest match for this layer. Open-source Python framework (`pip install inspect-ai`, MIT, Python ≥ 3.10). Primitives: dataset → Task → Solver → Scorer. Multi-turn / agent workflows with tools. Sandboxed execution (Docker built-in). Web-based Inspect View + VS Code extension. ~200 pre-built evals. Used by METR, Apollo Research, peer AISIs, and at frontier labs (Anthropic's UK AISI alignment evaluation case study, December 2025, evaluated Opus 4.1/4.5, Sonnet 4.5, GPT-5 in Inspect).

The dataset/Task/Solver/Scorer abstraction is exactly what A13's strategy-shift-correctness analyzer wants: a pinned dataset of trap scenarios, a Solver that runs your tutor over each scenario, a Scorer that computes the analyzer's output. Pre-registration becomes "here is the Task definition; here is the Solver; here is the Scorer; here is the dataset hash" — much more defensible than ad hoc CLI outputs.

**The recommended split:** keep the existing `eval-cli.js` for inner-loop iteration; for the pre-registered A13/A14 runs, expose your tutor as an HTTP endpoint and write the Inspect Solver in a Python sidecar that calls the bridge. This adds one cross-language boundary; it gains substantial methodological credibility (Solver/Scorer separation, dataset hashes, navigable logs, peer-comparable artifacts).

The bridge is roughly 30 LOC of Express/Hono in TypeScript and 100–200 LOC of Inspect tasks/scorers in Python. Total addition is comparable to the size of the existing scaffold; the break-even is fast.

---

## 6. Pattern Sources Beyond the Framework Choice

These are patterns to lift into the existing LangGraph.js scaffold. They are not framework adoptions.

### 6.1 Generative Agents (Park et al. 2023) — the highest-leverage import

**Pattern.** Memory stream architecture: every event is a natural-language record with `created_at`, `last_accessed_at`, and an LLM-scored `importance`. Retrieval combines **recency × importance × relevance** (cosine similarity) as a weighted sum. **Reflection** synthesises high-level inferences from accumulated memories when their cumulative importance exceeds a threshold. Planning translates reflections into action.

**Why it matters here.** This is the cleanest pattern source for `workingThroughMemory` (Phase 4). Your "durable memory of failed predictions across the dialogue" is a memory stream. The retrieval triad is precisely what you want when the otherEgoAgent needs to surface "the time three turns ago when I predicted the learner would accept this scaffold and they didn't."

**Cost to lift.** ~50 LOC for the retrieval triad + ~50 LOC for the reflection trigger. The Park architecture is *the* canonical reference and is widely cited in 2025–2026 agent-memory surveys.

### 6.2 Voyager (Wang et al. 2023) — for the 14 pedagogical actions

**Pattern.** Three components — automatic curriculum, skill library, iterative prompting with self-verification. The skill library is the part that matters: each skill is code indexed by an embedding of its natural-language description; on a new task, top-K similar skills are retrieved and injected into the prompt. Self-verification is a second LLM call asking "did this work?"

**Why it matters here.** Your 14 named pedagogical actions with trigger conditions, contraindications, and expected next learner signals **are** a skill library — just hand-curated rather than agent-discovered. The Voyager pattern is what your library *grows into* if you ever let the agent propose new pedagogical actions.

**Three sub-patterns worth lifting:**
1. **Embedding-indexed retrieval over skill descriptions.** Even with only 14 actions, retrieving top-K by description-embedding similarity (against the current state summary) is a cleaner selection mechanism than enumerating all 14 every turn. It also scales when you grow the library.
2. **Self-verification as a second LLM call.** Map this onto the superegoAgent: a "did the proposed move actually satisfy the skill's postcondition?" check before committing.
3. **Skill composition / hierarchical skills.** Voyager builds compound skills from primitives; your `mirror_and_extend` may decompose into `mirror` + `extend_with_scaffolded_question`.

**Skip the codebase.** The Voyager repo is Minecraft-specific. There is no general-purpose, maintained Voyager skill-library library in 2026 worth depending on. Treat as pattern source only.

### 6.3 Letta — memory-block design only

**Pattern.** Letta's core memory is in-context and agent-editable via tool calls; recall memory is searchable conversation history; archival memory is cold storage retrieved via tool calls. The agent reasons about its own memory through tool calls.

**Why it matters here.** Your `workingThroughMemory` should expose append/edit tools to the otherEgoAgent and superegoAgent. The Letta core/recall/archival split maps onto: core = current learner-model JSON in state, recall = within-dialogue history, archival = (deferred) cross-session.

**Skip the runtime.** As established in §4.2, the auto-managed memory features are pre-registration liabilities. The *design* of typed, agent-editable memory blocks is the part worth importing.

### 6.4 AutoGen — GroupChat selector pattern

**Pattern.** A function `select_next_speaker(state, history) -> agent_id`. The closest mental model to the egoMediator selecting between id / superego / otherEgo candidates.

**Why it matters here.** Read AutoGen v0.4's `SelectorGroupChat` source as a reference for how to structure speaker rotation, termination conditions, and round-robin fallbacks — but do not import the library.

### 6.5 Burr (DAGWorks → Apache Burr)

**Pattern.** State snapshots as evaluation cases. When your agent fails or behaves interestingly, snapshot the state and add it as a test case.

**Why it matters here.** You can do this with LangGraph checkpoints — but Burr's docs frame it as a first-class workflow worth copying. **Adopt the workflow:** any time your A13 analyzer flags a strategy-shift error, persist that checkpoint with a label and replay it in `eval-cli`. This is roughly a `--save-failures-as-cases` flag on the analyzer; ~40 LOC.

### 6.6 Anthropic Claude Agent SDK — `max_budget_usd` pattern

**Pattern.** A budget-cap parameter that totals provider-reported usage and aborts the run when a threshold is crossed.

**Why it matters here.** This is the cost-ceiling primitive your Gate B P0 #1 task needs. Implement as a budget-guard wrapper around your provider client (whether that's `realLLM.callRole` directly or a LiteLLM layer beneath it). ~30 LOC.

---

## 7. Future-Phase Memory Architectures (Cross-Session)

These become relevant only if cross-session adaptation comes back into scope after A14. The consolidated plan (§5) defers this explicitly. Listed for completeness.

- **Mem0.** Vector + optional graph memory, organised by `user_id` / `agent_id` / `run_id` / `session_id` — a four-scope hierarchy. Sub-second p95 retrieval. YC-backed, $24M Series A in October 2025. v1.0 shipped. Framework-agnostic. The **scope hierarchy** is the pattern worth borrowing when cross-session re-enters scope.
- **Zep / Graphiti.** Bi-temporal knowledge graph (every edge has `t_valid` and `t_invalid` plus `t_created` / `t_expired`), built on Neo4j, hybrid retrieval. The Zep paper (arXiv 2501.13956) reports 94.8% on DMR vs MemGPT's 93.4%. The genuine differentiator is **temporal reasoning**: tracks not just facts but when facts became true and when they were superseded. Conceptually attractive for modelling the learner's evolving belief state as a temporal graph (e.g., "learner believed X about variance until turn 14, then revised"). Adds operational weight (Neo4j, embedding pipelines).
- **LangMem.** LangChain's official memory SDK (launched February 2025). Native LangGraph integration via `BaseStore`. Independent benchmarks report ~60s p95 search latency on LOCOMO — unacceptable in the hot path, usable in a background-extraction path. The **procedural-memory-as-prompt-update** pattern is the only piece worth lifting now, and only if cross-session adaptation enters scope.

Re-evaluate each on benchmarks against your actual learner-modeling needs at that point — there are real 15-point accuracy gaps between memory architectures on temporal queries, so this decision will matter and should be made empirically, not now.

---

## 8. Opinionated Recommendation

**Stay on LangGraph.js. Do not port.** Hybridize with XState for the recognition FSM and with LiteLLM for the multi-provider/cost layer. Add Inspect AI as a separate evaluation harness for pre-registered runs.

### Why not port

A port would have to clear two bars: (1) substantively better fit on at least three of the eleven requirements; (2) low enough migration cost to not consume the time budget for Gate B. No framework in this set clears bar (1):

- **Microsoft Agent Framework** is Python/.NET only and would force language migration; v1.0 only shipped April 2026 with one prior rewrite (v0.2→v0.4) within 18 months — stability risk for an academic paper.
- **OpenAI Agents SDK / CrewAI / Letta / Claude Agent SDK** are all worse fits on Requirement 1 (typed state) and/or Requirement 2 (explicit control flow).
- **XState alone** loses LLM-native primitives the project depends on (checkpointer backends, model adapters).

### Concrete hybridization (recommended, low-cost)

Three surgical additions, none requiring porting:

1. **XState for the recognition FSM and policy selector** (inside the existing LangGraph node). The 14 named pedagogical actions map cleanly to XState transitions; `assign` actions update the typed `context`, which you then reflect into LangGraph state. Benefits: exhaustive coverage proofs, statechart figures for the paper's methods section, and a stronger pre-registration claim ("every transition is declared and visualizable"). Cost: 1–2 days. The FSM is currently inline in `services/adaptiveTutor/policyActions.js` and is the natural extraction point. **Do a half-day spike first** to verify the existing 14 actions factor cleanly into a statechart without ambiguous transitions; if any of them has overlapping or non-deterministic trigger conditions, that's a finding the paper should report regardless of framework.

2. **LiteLLM as a thin layer beneath `realLLM.callRole`.** This centralizes (a) cost ceiling enforcement (`max_budget` per run, lifted from the Claude Agent SDK pattern in §6.6), (b) provider abstraction across Anthropic/OpenAI/DeepSeek/Gemini, and (c) a single point for prompt-caching headers and retries. Cost: minimal; LiteLLM's OpenAI-compatible interface drops in.

3. **Inspect AI as the pre-registered evaluation harness** (Python sidecar; HTTP bridge to the LangGraph tutor). Cost: ~30 LOC of bridge + ~150–200 LOC of Inspect tasks/scorers. Buys methodological credibility and a clean pre-registration story.

Plus the §6 pattern lifts (Generative Agents memory stream for `workingThroughMemory`; Voyager retrieval + self-verification for the policy selector; Burr's checkpoint-as-eval-case workflow). None of these are framework adoptions; they're ~50–200 LOC each.

### If A13 (Gate B) succeeds → Psyche-v2 (Gate D)

When you scale to 6 agents × 2 sides × 8 scenarios × 4 conditions × 2 generators × N runs, the per-call overhead of LangGraph is irrelevant compared to LLM latency, but three things become load-bearing:

- **Subgraphs become essential.** Define the ego/superego/realityAgent block as a compiled subgraph; instantiate it twice (tutor side, learner side) with namespaced state slots. Idiomatic LangGraph and the cleanest expression in any framework in this set.
- **Switch checkpointer to `PostgresSaver`** (or `SqliteSaver` if scale stays modest). The `MemorySaver` will not survive the scenario × condition × run sweep.
- **Add per-turn cost telemetry** via LangGraph's July 2025 cost-tracking feature, on top of LiteLLM's per-call accounting. Two-layer cost tracking (LangChain-level for graph costs, LiteLLM-level for provider/model breakdown) is what the `--max-cost <USD>` flag should hit.
- *Do not* introduce CrewAI/AutoGen/Letta at this point; the bilateral architecture would be measurably harder to express in any of them than in nested LangGraph subgraphs.

### If A13 (Gate B) fails → substrate probe or negative-result writeup (Gate C)

If real-LLM strategy-shift correctness still doesn't move with the externalised state + adaptive policy + validator, three things change:

- **The framework choice becomes nearly irrelevant** — what's failing is the substrate (frontier LLMs cannot do turn-by-turn pedagogical adaptation under prompt-engineering-grade interventions), not the orchestration layer. Porting to AutoGen or CrewAI will not rescue the result.
- For the substrate probe (extended-thinking models / DPO-tuned tutors / multi-session memory), LangGraph remains the right substrate: you swap the model adapter at the existing `realLLM.callRole` site; pre/post model hooks (added 2025) make injecting thinking-token configuration a one-liner.
- For the negative-result writeup, the *strongest* methodological argument is that the recognition state machine and policy actions were *fully specified and statechart-verifiable* — exactly what an XState hybridization would buy you. Therefore, **even in the failure branch, the XState addition is defensible work**.
- **Letta becomes interesting as a comparison baseline only.** A small ablation — "does Letta's self-managed memory architecture help where externalised typed state did not?" — would be a publishable contrast and would not require a port; you'd run Letta as a separate condition reusing the same scenario harness.

### Things that would change the recommendation

- If the project needed a *Python* substrate for downstream RL/DPO work, **Microsoft Agent Framework** (now v1.0 GA April 2026) becomes the natural Python equivalent of LangGraph.js, with stronger OpenTelemetry. A port at that point is defensible.
- If the project pivoted to a single-provider Claude-only design with extended-thinking experiments as the main contribution, **Claude Agent SDK** with its `enable_file_checkpointing`, `rewind_files`, and `max_budget_usd` becomes more competitive — but only in that narrow scenario.
- If the bilateral architecture were dropped (single-side experiment only), **OpenAI Agents SDK** would become marginally more competitive because handoff-as-tool maps acceptably to a unidirectional tutor.

---

## 9. Caveats / Things This Analysis Does Not Settle

1. **Empirical performance per call.** No load testing was conducted. Published claims (e.g., CrewAI's 5.76× over LangGraph on a QA task) are unverified for this workload and unlikely to dominate at LLM-call latencies anyway.

2. **Long-term API stability.** All seven frameworks have shipped breaking-or-near-breaking changes in the last 18 months (LangGraph 1.0 was the most disciplined: zero breaking changes; AutoGen and the AutoGen→MS Agent Framework migration was the most disruptive). For a paper that needs to remain reproducible in 2027–2028, **pinning exact versions in `package.json` and a Docker image, and including a `.af`-style or LangGraph checkpoint snapshot of the experimental state, is more important than the framework choice itself.**

3. **The non-leakage rule (≤5%) is a discipline question, not a framework question.** No framework prevents leakage by construction. LangGraph and XState make it *easier* (separate channels for internal vs. learner-facing state); Claude Agent SDK and Letta make it *harder* (transparent reasoning is a feature). A small leakage detector (regex + classifier) running on `final_response` against `id_candidates`/`sg_critique` is needed regardless.

4. **The "judge variance" controlled-for in the original paper is independent of framework choice.** No framework here helps. Continue using whatever judge protocol Phase 1 already validated.

5. **Multi-session memory** (the deferred substrate probe) is the one place where Letta has a genuine architectural advantage. If that branch becomes the main story, a Letta condition becomes worth implementing — but as a *parallel* track, not a replacement scaffold.

6. **The XState hybridization claim is partially speculative.** The half-day spike in §8 is required before committing to it. If any of the 14 actions has overlapping or non-deterministic trigger conditions, that finding has its own value but changes the implementation path.

7. **Provider availability and pricing for the specific models named** were not re-verified for this analysis; the current `mockLLM`/`realLLM` swap-point design protects against any single provider's deprecations and remains the right abstraction.

8. **The Inspect AI bridge may have non-trivial latency overhead** for long sweeps. Budget a day for the bridge itself; if HTTP-bridge latency is materially slowing iteration, the cleanest single-language fallback is to port the tutor to LangGraph Python (the port is mechanical at 250 LOC) and call Inspect from the same repo with no IPC. This is a fallback, not a default.

9. **None of this analysis substitutes for re-reading the consolidated plan's gating logic.** The fact that the LangGraph.js scaffold is ~250 LOC and smoke-passing means migration-cost estimates are crisp; trust them over any third-party framework benchmark.
