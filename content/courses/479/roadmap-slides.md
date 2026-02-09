---
title: "Learning Features Roadmap"
subtitle: "Developing Philosophers & Critical AI Thinkers"
type: presentation
---

# Machine Spirits
## Learning Features Roadmap

**Developing Philosophers & Critical AI Thinkers**

*Synthesized Analysis - December 2024*

---

## The Challenge

Our courses teach **philosophically dense material**:
- Hegel's *Phenomenology of Spirit*
- Master-servant dialectic
- Recognition theory
- Critical AI perspectives

**But**: Can undergraduates engage with 19th-century German philosophy without scaffolding?

```notes
The core challenge: we have sophisticated infrastructure (multi-agent tutoring, simulations, qualitative analysis) but it's not well-connected to the actual course content. Students can click through lectures without ever being genuinely challenged.
```

---

## Current State

### What We Have

| Feature | Status |
|---------|--------|
| Multi-agent tutor | Built, but generic |
| Simulations | Built, but hidden |
| Qualitative analysis | Built, but disconnected |
| Learning map | Built, but activity-focused |
| 14 activity types | Built, but buried in YAML |

### The Gap

Infrastructure exists. **Content integration doesn't.**

```notes
Both Claude and ChatGPT analyses identified the same core problem: we have the technical capability but haven't wired it to the actual learning experience. Features are buried rather than surfaced at moments of need.
```

---

## Guiding Principles

1. **The learner must struggle**
   - Passive consumption ≠ philosophy

2. **Content and infrastructure must connect**
   - Features without grounding fail

3. **Scaffolding, not simplification**
   - Make difficulty navigable

4. **From consumption to construction**
   - Build arguments, don't just read them

5. **Dialectical practice**
   - Thesis → Antithesis → Synthesis

```notes
These principles come from the course content itself. If we're teaching Hegelian philosophy, shouldn't our platform embody Hegelian pedagogy? The servant becomes educated through labor on difficult texts, not through passive reception.
```

---

## Phase 0: Infrastructure Wiring
### Weeks 1-2

**Before adding features, make existing systems coherent.**

- [ ] Align text analysis to Markdown sources
- [ ] Generate and integrate `tutor-content.json`
- [ ] Create shared content index
- [ ] Verify tutor references real lecture IDs
- [ ] Fix simulation-content mismatches

**Success**: All existing features work with current content.

```notes
This is the pragmatic first step that ChatGPT emphasized. No point building new features if the pipeline is broken. Two weeks of pure infrastructure work pays dividends for everything that follows.
```

---

## Phase 1: Comprehension Foundation
### Weeks 3-6

### Living Glossary

Every complex term becomes clickable:
- Plain English explanation
- Original philosophical definition
- Historical context
- "I still don't get it" → deeper explanation

### Multi-Lens Summarization

- One-sentence summary
- Technical lens
- Philosophical lens
- "ELI5" lens
- Policy lens

```notes
This is the lowest-friction way to make dense philosophy accessible. Every barrier to understanding terminology is a potential dropout moment. Multiple summary lenses accommodate different learner backgrounds.
```

---

## Phase 1 Continued

### Reading Checkpoints

1-2 micro-questions per section:
- Low stakes
- Immediate feedback
- "Review this section" if struggling

### Lecture Summary Panel

Persistent sidebar showing:
- Key concepts
- Prerequisites (linked)
- Connections to other lectures
- Learning objectives

**Metrics**: Terms clicked: 5+ | Summary usage: 60%+

```notes
Reading checkpoints are micro-assessments that help learners calibrate their understanding without high-stakes pressure. The summary panel keeps context visible as learners scroll through dense material.
```

---

## Phase 2: Active Reading & Personas
### Weeks 7-12

### The Philosopher's Lens (NEW)

*From Gemini: "Transforming passive reading into active critical analysis."*

Toggle different **critical lenses** while reading:

| Lens | Highlights |
|------|------------|
| **Phenomenologist** | Recognition, breakdown moments |
| **Materialist** | Labor, power, infrastructure |
| **Techno-Optimist** | Capabilities, potential |
| **Skeptic** | Assumptions, evidence gaps |

LLM re-analyzes current paragraph from that perspective.

```notes
This is a key Gemini contribution. Instead of just reading passively, students can actively switch perspectives and see how different philosophical traditions would interpret the same text. Temporary highlights with commentary tooltips appear.
```

---

## Philosopher Personas & The Seminar

### Personas in Chat

| Persona | Perspective |
|---------|-------------|
| **Hegel** | Dialectic, recognition, Spirit |
| **Marx** | Alienation, labor, ideology |
| **Freud** | Unconscious, ego/superego |
| **Turing** | Machine intelligence |
| **Claude** | AI self-reflection |

### "The Seminar" (NEW from Gemini)

Multi-agent discussion: Student + 2-3 AI philosophers

> *Student reads "The Bitter Lesson"*
> *Agent A (Sutton):* Defends scaling
> *Agent B (Hegel):* Critiques lack of self-movement
> *Student:* Mediates or chooses a side

```notes
The Seminar extends personas from one-on-one chat to group discussion. This simulates the experience of a real philosophical seminar where different thinkers engage with each other and the student must navigate competing perspectives.
```

---

## Phase 2 Continued

### Roleplay Activities

Learner takes a role:
- Philosopher defending a position
- Policymaker evaluating AI regulation
- Educator designing curriculum
- Critic challenging an argument

### "Teach Me" Mode

- Learner explains a concept
- AI diagnoses gaps
- Targeted follow-up
- Builds metacognition

**Metrics**: Persona switches: 2+ | Roleplay completed: 1/course

```notes
"Teach me" mode flips the traditional dynamic. Instead of the AI explaining to the learner, the learner explains to the AI, which then identifies misconceptions. This is powerful for developing true understanding vs. surface familiarity.
```

---

## Metacognitive Prompts (NEW from Gemini)

### Reading Behavior Detection

The system observes:
- Scroll speed (rapid vs. careful)
- Time-on-section
- Re-reading patterns
- Selection and annotation behavior

### Intelligent Interventions

When rapid scrolling detected:
> *"You've covered a lot of ground. Can you explain sublation in your own words?"*

When struggling on a section:
> *"This is dense material. Would you like to try a different lens?"*

Prompts based on behavior, not just content.

```notes
Gemini's insight: Use reading behavior to trigger metacognitive interventions. If a student is flying through Hegel without pausing, that's a signal - they may not be engaging deeply. A well-timed "stop and reflect" prompt can transform passive scrolling into active learning.
```

---

## Phase 3: Simulation Integration
### Weeks 11-16

### Current Problem

Simulations exist (recognition, alienation, dialectic, emergence)

**But**:
- Hidden in Research Lab
- Not connected to reading
- No guided observation

### Solution: Simulation Discovery

"See this in action" button on relevant paragraphs:
- Pre-set parameters matching concept
- Observation prompts tied to lecture
- Compare simulation to philosophical claim

```notes
We have beautiful agent-based models of Hegelian concepts, but learners don't know they exist when they're struggling with the text. Surfacing simulations at the moment of relevance transforms them from hidden tools to learning catalysts.
```

---

## Phase 3 Continued

### Low-Code ABM Builder

Visual tool to create simulations:
1. Choose template (recognition, alienation...)
2. Map concepts to parameters
3. Auto-generate hypothesis
4. Observation checklist
5. Save and share

### Natural Language ABM (NEW from Gemini)

Describe simulation in plain English:

> *"Show me agents that only learn if recognized by a high-status agent"*

System generates simulation code with:
- `recognition_threshold` parameter
- `status_distribution` parameter

**Metrics**: Simulations from content: 3x | User-created ABMs: 10+

```notes
Gemini proposed natural language to code generation for simulations. This lowers the barrier even further - students don't need to understand YAML or parameters, they just describe what they want to see. Requires sandboxed JS execution.
```

---

## Phase 4: Dialectical Practice
### Weeks 17-22

### The Missing Antithesis

| Hegel's Dialectic | Current Platform | Needed |
|-------------------|------------------|--------|
| Thesis | Present info | Present info |
| Antithesis | ??? | **Challenge understanding** |
| Synthesis | ??? | **Support integration** |

We teach dialectics but don't practice them!

```notes
There's an irony: we teach dialectical philosophy through a platform that doesn't embody dialectical learning. When a learner thinks they understand sublation, where is the challenge that tests and refines that understanding?
```

---

## Dialectical Challenge System

After reading, structured challenge:

1. **Thesis**: "What is Hegel's main claim about recognition?"

2. **Evidence**: "Find 2-3 supporting quotes"

3. **Antithesis**: AI presents counterargument

4. **Defense**: Learner responds

5. **Synthesis**: AI helps integrate understanding

**AI evaluates engagement quality, not correctness.**

```notes
This is the core of philosophical practice - not just comprehending arguments but constructing, defending, and refining them. The dialectical challenge makes visible the invisible skill of philosophical thinking.
```

---

## Visual Argument Builder

```
[CLAIM] ────────────────────────────────
    │
    ├── [EVIDENCE 1] ── [WARRANT]
    │        └── Source: Lecture 3
    │
    ├── [EVIDENCE 2] ── [WARRANT]
    │
    └── [COUNTERARGUMENT] ── [REBUTTAL]
```

- **Drag evidence from ArticleReader** (NEW from Gemini)
- Link to lecture sources
- Export as essay outline

### AI Critic (NEW from Gemini)

An agent that specifically attacks:
- Weak warrants
- Missing counterarguments
- Evidence gaps
- Logical incoherence

**Metrics**: Challenges completed: 70%+ | Arguments built: 3+

```notes
Gemini added two key UX details: evidence dragging from the reader, and an AI Critic that specifically targets weaknesses. The Critic isn't just giving feedback - it's adversarially attacking the argument to make it stronger.
```

---

## Phase 5: Thematic Analysis
### Weeks 23-28

### Lecture-First Analysis

One-click "Analyze this lecture":
- Generate themes and codes
- Accept/reject suggestions
- Train personal theme vocabulary
- Compare to course themes

### "My Themes" Sidebar (NEW from Gemini)

Shows how current reading connects to:
- Student's ongoing research questions
- Theme relevance scores
- Related annotations

### Auto-Link with Vector Search (NEW from Gemini)

- Flag paragraphs matching student's themes
- Match **even without keyword overlap**
- Background semantic matching

```notes
Gemini's key insight: connect the research dashboard to the reading experience. As students highlight text, the system auto-suggests codes from their existing taxonomy. Vector search finds conceptually related content even when exact words differ.
```

---

## Phase 6: AI System Analysis Lab
### Weeks 29-34

### Apply Philosophy to Real AI

1. **Select System**: ChatGPT, Claude, DALL-E...

2. **Select Framework**: Recognition, alienation, phenomenology

3. **Guided Analysis**: Prompts for framework application

4. **Collect Evidence**: Screenshots, transcripts

5. **Synthesize**: AI-assisted writeup

6. **Peer Review**: Share with classmates

**Metrics**: Analyses completed: 1/learner | Frameworks used: 2+

```notes
This is where theory meets practice. Students aren't just learning about Hegelian recognition in the abstract - they're applying it to analyze actual AI systems they use every day. This creates genuine critical AI thinkers.
```

---

## Phase 7: Mastery Overhaul
### Weeks 35-42

### Problem with Current Progress

Learning map shows:
- Activities completed ✓
- Lectures opened ✓

Learning map doesn't show:
- Concept understanding ✗
- Skill development ✗
- Epistemic growth ✗

**Completion ≠ Comprehension**

```notes
Our current progress tracking is essentially a checklist. You can "complete" a course by clicking through everything without understanding anything. We need to track what actually matters.
```

---

## Concept Mastery System

### Mastery Levels
Exposed → Developing → Proficient → Mastered

### Spaced Repetition
- Concepts decay without review
- System prompts re-engagement
- Connection challenges

### Progress Beyond Completion
- Reading depth (not just opens)
- Concept confidence
- Explanation quality
- Argument construction

**Metrics**: Concepts at "Proficient": 60%+

```notes
Spaced repetition is well-established for factual knowledge, but we're applying it to philosophical concepts. "Sublation" fades if not revisited and applied. The system should remind learners to re-engage with decaying concepts.
```

---

## "Grand Narrative" View (NEW from Gemini)

### Beyond Course Progress

The Learning Map currently shows:
- Lectures completed
- Activities finished
- Nodes unlocked

### The Student's Intellectual Journey

A new map mode showing:
- **Evolution of ideas** - How student's thinking has changed
- **Position shifts** - Tracked epistemic stances over time
- **Key insights** - Breakthrough moments captured
- **Personal themes** - What the learner cares about

*Not just "what did I click" but "how have I grown?"*

```notes
Gemini's insight: "A version of the Learning Map that visualizes the evolution of the student's own ideas, not just course progress." This transforms progress visualization from a checklist into a narrative of intellectual development.
```

---

## Phase 8: Community
### Weeks 43-52

### Philosophy Thrives on Dialogue

**Collaborative Wiki**
- Student explanations
- Worked examples
- Peer curation
- Archive across cohorts

**Dialogue Simulator**
- Defend thesis against AI examiner
- Historical scenarios (Turing vs Jefferson)
- Peer spectator mode

**Study Groups**
- Complementary strengths
- Debate pairing

```notes
The Western philosophical tradition is fundamentally dialogical - Socrates to Plato, Hegel responding to Kant. Our platform should facilitate genuine intellectual exchange, not just individual consumption.
```

---

## Timeline Overview

| Phase | Weeks | Focus |
|-------|-------|-------|
| 0 | 1-2 | Infrastructure wiring |
| 1 | 3-6 | Comprehension foundation |
| 2 | 7-10 | Philosopher personas |
| 3 | 11-16 | Simulation integration |
| 4 | 17-22 | Dialectical practice |
| 5 | 23-28 | Thematic analysis |
| 6 | 29-34 | AI analysis lab |
| 7 | 35-42 | Mastery overhaul |
| 8 | 43-52 | Community features |

```notes
This is roughly a year-long roadmap. Each phase builds on the previous. We start with infrastructure (necessary but not sufficient), build comprehension tools, then progressively enable deeper philosophical practice.
```

---

## Key Metrics

| What | Target |
|------|--------|
| Terms clicked/session | 5+ |
| Summary usage | 60%+ learners |
| Persona switches | 2+ per session |
| Simulations from content | 3x baseline |
| Arguments constructed | 3+ per learner |
| Dialectical challenges | 70%+ completed |
| Concepts "Proficient" | 60%+ |
| Course completion | +10% vs baseline |
| Satisfaction | 4.2/5.0 |
| AI cost/learner/week | <$5 |

```notes
Metrics help us know if features are working. But note the balance: engagement metrics (clicks, usage) AND outcome metrics (completion, satisfaction). We care about both activity and results.
```

---

## Risks

| Risk | Mitigation |
|------|------------|
| LLM cost explosion | Caching, model tiering |
| Content pipeline breaks | Phase 0 fixes, testing |
| Feature overwhelm | Progressive disclosure |
| Low feature adoption | In-context suggestions |
| AI feedback quality | Human review loops |

```notes
The biggest risk is probably feature overwhelm. We're proposing many new capabilities. Without careful curation and progressive disclosure, learners may feel lost rather than supported. Each feature needs to surface at the right moment.
```

---

## Immediate Next Steps
### Week 1

1. **Fix content pipeline**
   - Align text analysis to Markdown

2. **Generate tutor content**
   - Run and integrate tutor-content.json

3. **Deploy glossary MVP**
   - Term detection + basic explanations

4. **Pilot one persona**
   - "Ask Hegel" in chat for EPOL 479

5. **Add one simulation hook**
   - Recognition simulation in Lecture 3

```notes
Start small, prove value, then expand. Week 1 should produce visible improvements that learners can experience immediately. The glossary and first persona are high-impact, low-risk starting points.
```

---

## The Ultimate Goal

Our learners should finish these courses:

- **Constructing** arguments, not just consuming them

- **Challenging** AI systems, not just using them

- **Recognizing** their own assumptions

- **Entering** philosophical conversations, not just observing

The platform's job is to create the conditions for this transformation.

```notes
This is what it means to develop philosophers and critical AI thinkers. Not just knowledge transfer, but capability development. Not just completion, but transformation. The features are means to this end.
```

---

## What Would Hegel Say?

> "The individual who has not risked his life may admittedly be recognized as a *person*, but he has not achieved the truth of being recognized as a self-sufficient self-consciousness."

The learner must **struggle**.
The platform must **scaffold that struggle**.

Not eliminate difficulty—
make it **navigable**.

```notes
Returning to the course content itself for final guidance. Hegel's insight is that genuine development requires genuine challenge. Our job isn't to make philosophy easy - it's to make the difficulty productive rather than destructive.
```

---

## Questions?

**Full Documents**:
- `LEARNING_FEATURES_ANALYSIS.md` (Claude)
- `plan-gpt.md` (ChatGPT)
- `ROADMAP_SYNTHESIZED.md` (Combined)

**Next Review**: Implementation priorities for Phase 0-1

```notes
Three documents capture the full analysis. The synthesized roadmap combines Claude's philosophical depth with ChatGPT's operational pragmatism. Ready to discuss priorities and begin implementation.
```
