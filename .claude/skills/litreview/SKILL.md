---
name: litreview
description: Synthesize the local PDF corpus into an architecture-aimed literature review for a specific topic, cross-referenced against current project decisions
argument-hint: <topic-and-questions> [--out <path>] [--areas <01,05,09>] [--depth quick|standard|deep]
allowed-tools: Bash, Read, Grep, Glob, Write, Agent
---

Synthesize a literature review for the topic in `$ARGUMENTS`. Cross-reference findings against the project's current architectural targets (`docs/explorations/claude/comprehensive-strategy.md`) and substrate decisions (`docs/explorations/claude/agents/agent-framework-analysis.md`). Output a structured markdown report to `docs/explorations/literature/synthesis/`.

The corpus is local: `docs/explorations/literature/pdfs/` (≈68 PDFs across 10 sub-areas).

## When to use this skill

- Before starting a Phase 2/3 pilot from `comprehensive-strategy.md` (P2 bilateral ToM, P3 charisma, P4 CIKT-iteration, P5 combined renovation) — synthesize the literature for that primitive into a focused review that informs the pre-registration doc.
- When the user asks "what does the literature say about X?" where X spans multiple papers in `docs/explorations/literature/pdfs/`.
- When drafting a new spin-off paper section that needs a defensible related-work paragraph backed by the local corpus.

## When NOT to use

- General "read this one paper for me" — just use Read.
- Web search for papers not in the local corpus — use WebSearch directly. (This skill is corpus-grounded, not exhaustive.)
- Refactoring the strategy doc itself — that's a direct edit.

## Parse arguments

- Free-text **topic-and-questions** is the primary signal. Extract:
  - **Topic** (1-3 words for the slug, e.g. `bilateral-tom`, `charisma-pedagogy`, `cikt-iteration`)
  - **Specific questions** the review must answer (treat as a checklist for the agent)
- `--out <path>` overrides the default output `docs/explorations/literature/synthesis/{slug}.md`
- `--areas <list>` constrains which corpus subdirs to read (otherwise auto-pick from the topic). Format: comma-separated `01..10` IDs.
- `--depth quick|standard|deep` controls reading effort:
  - `quick` — abstract + intro of each relevant paper, ≤8 papers, ~10 min
  - `standard` (default) — abstract + key sections + tables for ≤15 papers, ~20 min
  - `deep` — full reads on top 5, abstracts on the rest, ~40 min

## Corpus map (subdir → topic keywords)

| Subdir | Topic keywords |
|--------|---------------|
| `01-knowledge-tracing` | KT, learner state, profile inference, CIKT, LBM, student simulation, persona |
| `02-its-foundations` | ITS history, conversational tutor, AI2T, scaffolding theory |
| `03-dialogue-acts` | dialogue acts, talk moves, TalkMoves, BiPed, tutor-move taxonomy |
| `04-scaffolding` | scaffolding, ZPD, fading, contingent feedback |
| `05-llm-agents` | agent architecture, multi-agent, generative agents, Voyager, Letta, CrewAI, Burr, agent frameworks |
| `06-counterfactual-eval` | counterfactual reasoning, simulation-based eval, causal intervention |
| `07-llm-as-judge` | judge reliability, multi-judge jury, MathTutorBench, BEA 2025, position bias, debiasing |
| `08-educational-datasets` | MathDial, Bridge, MRBench, EduDial, transfer evaluation |
| `09-theory-of-mind` | ToM, FANToM, BigToM, OpenToM, ExploreToM, mind-reading, illusory ToM |
| `10-long-term-memory` | memory streams, MemGPT, retrieval scoring, memory architecture, working-through |

When in doubt about which areas apply, use Grep to scan the topic against the file-name corpus:
```bash
find docs/explorations/literature/pdfs -name "*.pdf" | grep -i "<keyword>"
```

## Cross-reference targets (always include)

Every synthesis must cross-check claims against:
1. **`docs/explorations/claude/comprehensive-strategy.md`** — what architectural primitives the project is committing to. Flag literature that contradicts or strengthens the current plan.
2. **`docs/explorations/claude/agents/agent-framework-analysis.md`** — substrate decisions (LangGraph/XState/LiteLLM/Inspect AI). Flag literature suggesting a different substrate would be better.
3. **`docs/research/paper-full-2.0.md`** — the canonical paper. Flag literature that bears on existing claims (especially §6 findings, §7 methodology).
4. **CLAUDE.md** — project conventions. Don't propose changes that violate the bilateral-symmetry principle or the rubric-versioning discipline.

## Workflow

### Step 1 — confirm scope (in chat, before dispatch)

Before spending agent time, restate to the user:
- The topic slug you'll use
- Which corpus subdirs you'll read (and why)
- Which questions you've extracted from `$ARGUMENTS`
- The depth setting
- The output path

If the user disagrees, adjust before dispatch.

### Step 2 — dispatch ONE general-purpose agent

A single sequential dispatch is correct here — the synthesis is naturally inter-paper, so parallel agents would duplicate context-building. Use this prompt template (substitute the bracketed fields):

```
Synthesize a literature review on [TOPIC] for the project at /Users/lmagee/Dev/machinespirits/machinespirits-eval.

The review must answer these specific questions:
[QUESTIONS — bulleted list]

CORPUS — read these PDFs from docs/explorations/literature/pdfs/:
[LIST OF FILES — paths only, ≤15 for standard depth, ≤8 for quick, top-5-deep for deep]

DEPTH: [quick|standard|deep]
- quick: abstract + intro only
- standard: abstract + key sections + tables
- deep: full read on listed top-5; abstracts only for others

CROSS-REFERENCE — after reading the corpus, check claims against:
- docs/explorations/claude/comprehensive-strategy.md (current architectural targets)
- docs/explorations/claude/agents/agent-framework-analysis.md (substrate decisions)
- docs/research/paper-full-2.0.md (canonical paper claims)

OUTPUT — return a markdown document with these sections (do NOT write the file; return the markdown as your final message):

# Literature review: [TOPIC]
**Date:** [today]
**Depth:** [setting]
**Corpus read:** [N papers, list paths]
**Cross-referenced docs:** [list]

## Question 1: [first question]
[2-4 paragraph synthesis. Cite papers by short tag (e.g. "FANToM", "CIKT", "LBM"). Quote sparingly. End with a direct architectural recommendation: "implement X", "avoid Y", "open question Z".]

## Question 2: ...
[...repeat per question...]

## Cross-reference findings
- **Strengthens existing plan:** [list of strategy-doc claims supported by the corpus, with paper tags]
- **Contradicts or qualifies:** [list of strategy-doc claims the corpus pushes back on, with paper tags]
- **Gaps the corpus does not address:** [questions the local PDFs cannot answer; flag if WebSearch may help]

## Concrete recommendations for the codebase
- [bulleted list. Each item names a specific file path, function, or config field that should change, plus the paper tag justifying it.]

## Open questions for follow-up
- [list of questions the synthesis raises, suitable for further /litreview or WebSearch]

GROUNDING RULES:
- Every claim must trace to a specific paper in the corpus or to a specific section of the cross-referenced docs. No speculation.
- If two papers disagree, name both and recommend which the project should follow given its current architecture.
- Recommend NO changes that violate CLAUDE.md (bilateral symmetry, rubric versioning, paper-source-of-truth discipline).
- Be concise. Target 2-4 KB total markdown. Architecture-aimed reviews are useless if too long to act on.

Return only the markdown document.
```

### Step 3 — write the report

Take the agent's returned markdown and write it to `docs/explorations/literature/synthesis/{slug}.md` (or the `--out` path). Verify with Read before reporting back to the user.

### Step 4 — surface the most actionable items in chat

In your reply to the user (after writing the file):
- One sentence: "Wrote synthesis to {path}. {N} papers read. Top recommendation: {single most actionable item from the report}."
- If the cross-reference found contradictions with the strategy doc, name the contradiction in one sentence — the user needs to know before reading the file.
- Offer follow-up: another `/litreview` for any "Open questions" the report raised, or WebSearch if the corpus had gaps.

## Examples

```
/litreview bilateral theory of mind for tutor agents — does FANToM-style probing actually work, what's the right state representation, how do small models fail
# → reads 09-theory-of-mind subdir + LBM (01) + relevant 05-llm-agents
# → output: docs/explorations/literature/synthesis/bilateral-tom.md
# → cross-checks strategy doc P2 (cell_115_bilateral_tom) claims

/litreview charisma in pedagogy: is staged anti-recognition supported by any tutor-move taxonomy, what counts as productive provocation --depth deep
# → reads 03-dialogue-acts + 04-scaffolding + 02-its-foundations
# → output: docs/explorations/literature/synthesis/charisma-pedagogy.md
# → flags that the Tutor Move Taxonomy paper (Zhou et al. 2026) is the key cross-check

/litreview CIKT-style iterative analyst-predictor — does iteration without preference learning matter --areas 01,05
# → reads only 01-knowledge-tracing + 05-llm-agents
# → output: docs/explorations/literature/synthesis/cikt-iteration.md
# → answers strategy doc P4 open question

/litreview judge reliability for multi-turn pedagogical dialogues --depth quick
# → reads 07-llm-as-judge subdir
# → quick scan, ~8 papers
# → output: docs/explorations/literature/synthesis/judge-reliability-multi-turn.md
```

## Output directory convention

All synthesis files land in `docs/explorations/literature/synthesis/`. Filenames are kebab-case slugs derived from the topic. If a slug already exists, suffix with a date stamp (`-2026-05-01`) to avoid clobbering prior work — earlier reviews carry useful context for how the project's understanding of the area has evolved.

## What violates the rule of this skill

- Writing the report directly without dispatching the agent (defeats the context-isolation purpose; the corpus reads bloat the main conversation).
- Skipping the cross-reference step (a litreview that doesn't connect to the project's current decisions is just a summary, not a review).
- Recommending changes to `paper-full-2.0.md` from a litreview (per CLAUDE.md, paper changes go through the canonical-paper authoring path, not via spin-off recommendations).
- Outputs longer than ~4 KB. Architecture-aimed reviews must be actionable, not exhaustive.
