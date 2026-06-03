---
name: ms-discuss-paper
description: Load the latest canonical paper version and synthesize a four-lens briefing (philosophy, pedagogy, methodology, technology) to prime an in-chat discussion. Use when the user wants to talk through the paper, review its argument, or prepare for a meeting/seminar about it.
argument-hint: "[philosophy|pedagogy|methodology|technology|all] [--depth brief|deep] [--check]"
allowed-tools: Bash, Read, Grep, Glob
---

Prime an in-chat discussion of the canonical paper across four lenses: **philosophy**, **pedagogy**, **methodology**, **technology**.

The canonical paper (`docs/research/paper-full-2.0.md`) is ~195K tokens — too large to hold verbatim while leaving room to actually talk. This skill resolves the current version, loads a cheap orientation layer, synthesizes a per-lens briefing, and leaves the conversation able to dive into any section *by § number on demand*. It does NOT cat the whole file.

## When to use

- "Let's discuss the paper" / "walk me through the argument" / "I have a seminar on this tomorrow."
- Preparing to defend or critique the paper across philosophy / pedagogy / methodology / technology.
- Re-orienting after time away — "what does the paper currently claim and what changed recently?"

## When NOT to use

- Building the PDF → `/ms-build-paper`.
- Authoring or editing a section → `/ms-author-paper2` (this skill is read-only; it never edits the paper).
- A literature question spanning the PDF corpus → `/ms-litreview`.
- A specific data/number lookup → `/ms-query-db` or `/ms-analyze-data`.

## Parse arguments

- Positional lens: `philosophy` | `pedagogy` | `methodology` | `technology` | `all` (default `all`). Restricts the briefing to one lens; orientation layer always loads.
- `--depth brief` (default): read spine sections in passes, synthesize the briefing, do **not** retain them verbatim — navigate by § on demand. Lean context.
- `--depth deep`: additionally hold the lens's spine sections verbatim in context. Heavy; use only when the user wants line-level discussion of a specific lens.
- `--check`: run the integrity gate (Step 1c) and stop — report version/drift/manifest status without producing the briefing.

## Step 1 — Resolve the canonical paper

a. **Source of truth is `docs/research/paper-full-2.0.md`.** NOT `paper-full.md` (legacy Paper 1.0), NOT the short paper, slides, or spin-offs. Per CLAUDE.md, spin-offs introduce no claims, so the full paper is the only valid discussion anchor.

b. Read the version from frontmatter and find the matching built PDF:
   ```bash
   grep -m1 '^version:' docs/research/paper-full-2.0.md
   ls -t docs/research/paper-2.0-v*.pdf | head -1
   ```

c. **Drift check** (always run; the whole point of `--check`): if the newest PDF's version ≠ the `.md` `version:` field, the built artifact is stale — say so explicitly so the discussion doesn't cite numbers from a paper the user can't open. Optionally surface manifest health:
   ```bash
   node scripts/validate-paper-manifest.js 2>&1 | tail -5
   ```
   Report drift as a one-line status; do not attempt to rebuild (that's `/ms-build-paper`).

## Step 2 — Load the orientation layer (always, ~5K tokens)

This is cheap and high-value. Read:

- The **Abstract** (the current headline claim — it changes meaningfully across versions).
- The **section map**: `grep -nE '^#{2,3} ' docs/research/paper-full-2.0.md` — gives every §/§.§ with a *current* line number. This is the navigation index for the rest of the discussion. Re-derive it every invocation; never trust line numbers from a previous run or this file.
- The **latest ~6 revision-history entries**: tail of `## Appendix E: Revision History`. What changed recently is usually what the user wants to discuss.

## Step 3 — Theme → section navigation map

Section *numbers* are stable across versions; line numbers are not. Use this table to know which §s carry each lens, then resolve their line numbers from the Step 2 grep.

**Philosophy** (Hegel, recognition, dialectics, *Geist*; what the theory does and does not explain):
- §2.5 Recognition Theory in Education
- §3 Theoretical Framework: From Recognition to Mechanisms (3.1 Explanatory Challenge · 3.2 Three Candidate Mechanisms · 3.3 Mechanism Interaction Model · 3.4 Recognition Predicts the Failures · 3.5 Connecting Mechanisms to Recognition)
- §7.9 What Recognition Theory Explains and What It Does Not (A10/A10b: recognition vs constructivist descendants vs behaviorist family; the "most explicit philosophical articulation" claim)
- §7.10 Mechanism location: form versus substance
- Appendix A.1/A.2 — the recognition-enhanced ego/superego prompts (philosophy operationalised)

**Pedagogy** (tutoring, scaffolding, intersubjective-pedagogy orientation, learner outcomes):
- §2.1 AI Tutoring and ITS · §2.6 ToM and Constructivist Pedagogy · §2.9 Adaptive Tutoring: From "Whether" to "How"
- §6.5 Tutor-Learner Asymmetry · §7.2 The Tutor-Learner Asymmetry Explained
- §7.9 (intersubjective-pedagogy as the active ingredient; Vygotsky/Piaget/Kapur/Chi/VanLehn/Graesser cognates)
- §3.4 Recognition Theory Predicts the Failures (pedagogical failure modes)

**Methodology** (process tracing, rubric, taxonomy, provable discourse, statistics, pre-registration discipline):
- §2.3 LLM-as-Judge · §2.7 Process Tracing in Social Science · §2.8 Mechanism-Oriented AI Research
- §5 entire (5.1 Overview · 5.2 Rubric v2.2 · 5.3 Superego Critique Taxonomy · 5.4 Trajectory Analysis · 5.5 Within-Test Change · 5.6 Measurement Paradox · 5.7 Model Selection · 5.8 Cross-Model Replication · 5.9 Provable Discourse · 5.10 Statistical Approach · 5.11 Reproducibility · 5.12 Pre-registration Drift)
- §7.4 The Apparatus as Method · §7.5 The Reflexive Structure · §7.6 Implications for AI Evaluation
- §8.2 LLM-as-Judge (limitation) · §8.4 Process Tracing with LLMs (limitation)

**Technology** (ego-superego architecture, trace logging, adaptive runner, id-director, optimisation):
- §2.2 Multiagent Design and Self-Correction
- §4 entire (4.1 Ego/Superego · 4.2 Bilateral Learner · 4.3 Trace Logging · 4.4 Provenance · 4.5 Scoring Pipeline · 4.6 Factorial as Mechanism Isolation · 4.7 Observability)
- §6.7 Id-Director & Charismatic Pedagogy · §6.8 Adaptive Runner & Trap Scenarios · §6.9 Evidence-Bound Hypothesis Tracking (A14) · §6.10 Modelling the Concealed Interior
- §7.3 Universal Substitution · §7.7 Rubric as Optimisation Signal · §7.8 Dimension-Targeted Optimisation
- Appendix A (prompts) · Appendix D (key run IDs)

**Cross-cutting — always skim for orientation regardless of lens:** Abstract, §1 Introduction, §6.1–6.4 (the three core mechanism results + interaction), §9 Conclusion.

If the section map from Step 2 shows a heading not in this table (the paper grew), fold it into the nearest lens by topic and note it in the briefing as new.

## Step 4 — Depth-dependent load

- **`brief` (default):** for the requested lens(es), Read each spine section's line range once, extract the claim/tension, then move on. Do not keep them verbatim. The Step 2 section map remains as the on-demand index.
- **`deep`:** additionally Read and retain verbatim the spine sections for the *single* requested lens (don't do this for `all` — it defeats the context budget). Tell the user the sections are now loaded for line-level discussion.

Skip the appendix prompt dumps and Appendix B reproducibility command lists unless the lens is philosophy/technology and the user wants the operationalised prompts — those are large and rarely needed for argument-level discussion.

## Step 5 — Produce the discussion briefing (the deliverable)

Output in chat (do **not** write a file unless the user asks). Structure:

```
# Paper discussion brief — v{X.Y.Z}
{one line: title; PDF drift status from Step 1c}

**Current headline claim** (from Abstract): {2–3 sentences in your own words}

**Changed recently** (last revisions): {2–4 bullets from Appendix E — what a returning reader needs}

## Philosophy   ·  §3, §7.9, §2.5
- Position: {what the paper now argues}
- Live tension: {the sharpest open question or vulnerability — e.g. "recognition vs. its constructivist descendants: is the Hegelian vocabulary load-bearing or interchangeable?"}
- Discuss-by-§: {the 1–2 sections to open if this thread goes deep}

## Pedagogy   ·  §2.1, §6.5, §7.2, §7.9
{same shape}

## Methodology   ·  §5, §7.4
{same shape}

## Technology   ·  §4, §6.7–6.10
{same shape}

**Threads worth pulling:** {2–3 cross-lens questions the briefing surfaces — these seed the discussion}
```

Each lens's "Live tension" must be a real, current tension drawn from what you read (e.g. the null third mechanism, the model-dependent additivity deficit, the synthetic-learner limitation, the pre-registration drift) — not a generic prompt. The brief is useless if it doesn't name where the argument is actually contestable.

If a single lens was requested, produce only that section plus the headline/changed-recently header.

## Step 6 — Hand into the discussion

Close the briefing with one line inviting the user to pick a thread, and note that any `§N.M` can be opened verbatim on request (or re-run with `--depth deep <lens>` for line-level work). From here, respond to the user's discussion using the section map as your index: when a thread needs the actual text, Read that §'s line range — don't reconstruct it from memory or the abstract.

## Conventions & safety

- **Read-only.** This skill never edits `paper-full-2.0.md`. Authoring is `/ms-author-paper2`; building is `/ms-build-paper`.
- **Anchor on the canonical full paper only.** Do not pull claims from the short paper, slides, or blog spin-offs into the discussion — per CLAUDE.md they contain no original claims and may lag the full paper.
- **Numbers come from the paper, not memory.** When the discussion turns to a specific d/N/p, open the § that states it rather than recalling it — versions move and stale recall is the main failure mode here.
- **Re-derive the section map every invocation.** Line numbers in Step 3's commentary are illustrative; the authoritative index is the fresh Step 2 grep.
- **Don't conflate judge panels.** Per Appendix E, pilot-era entries (Opus judge) are not the Paper 2.0 headline panel (Sonnet 4.6 / Gemini 3.1 Pro / GPT-5.4). Flag this if the discussion touches effect sizes.
