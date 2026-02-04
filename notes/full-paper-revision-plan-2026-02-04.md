# full-paper.md Revision Plan

**Date:** 2026-02-04
**Source:** full-paper-2026-01-28.md (136 lines, ~35KB)
**Target:** full-paper-2026-02-XX.md

## Paper Character

This is a **humanities/theoretical** paper distinct from PAPER-UNIFIED (technical/empirical):

| Aspect | full-paper | PAPER-UNIFIED |
|--------|------------|---------------|
| Style | Humanities, flowing prose | Technical, structured |
| Theory | Derrida, Honneth, Adorno | Architecture-focused |
| Framing | "Vibe scholarship", AI co-research | Factorial evaluation |
| Audience | Philosophy/critical theory | CS/Ed-tech |
| Unique | Meta-reflection on method | Detailed effect sizes |

**Key strength:** The philosophical depth and critical theory framing should be preserved.

## Current Structure

1. Introduction (brief)
2. The Drama of Teaching (Hegel, Freud, master-slave)
3. Towards 'Machinagogy': Recognition and Acting Out
4. Construction of a 'Paper' (method)
5. Results (brief, cites F=43.27, p<.001)
6. Interpreting the 'paper'
7. Conclusion (Honneth, critical theory)

## New Findings to Incorporate

### 1. Recognition Theory Validation

**Current:** Claims recognition prompts improve performance (F=43.27)

**Update:** The three-way comparison (base vs enhanced vs recognition) now isolates:
- Total recognition effect: +20.1 points
- Prompt engineering alone: +11.4 points (57%)
- **Recognition theory unique value: +8.7 points (43%)**

**Philosophical significance:** This validates that Hegelian recognition is not merely
"better instructions" but a distinct relational orientation with measurable effects.
Aligns with Honneth's claim that recognition cannot be demanded or performed.

### 2. The A×B Interaction: Recognition Creates Conditions

**New finding:** Multi-agent synergy (+9.2 pts) is specific to recognition prompts.
Enhanced prompts show zero benefit from multi-agent architecture.

**Philosophical interpretation:** Recognition theory creates a *deliberative space*
that the Freudian architecture (ego/superego) can meaningfully engage with. The
superego needs recognition-framed dialogue to contribute. This connects to the
Hegel-Freud synthesis: internal self-evaluation enables external recognition.

### 3. Domain Sensitivity: Where Recognition Matters

**New finding:** Recognition effects are domain-sensitive:
- Philosophy content: Recognition +13.9, Multi-agent +0.5
- Elementary math: Recognition +4.4, Multi-agent +9.9

**Philosophical interpretation:** Recognition's value depends on content characteristics.
Abstract, interpretive content (Hegel, consciousness) benefits most from recognition
framing. Concrete procedural content (fractions) benefits less—the relational depth
recognition enables may be less relevant for procedural learning.

**Critical theory angle:** This suggests limits to recognition-theoretic pedagogy.
Not all learning encounters are equally amenable to the mutual transformation
Honneth describes. The "struggle for recognition" may be most relevant where
the learning itself involves identity-constitutive understanding.

### 4. Multi-Agent as Error Correction

**New finding:** On new content domains, models hallucinate trained-on content.
The superego catches these errors—essential for domain transfer.

**Philosophical interpretation:** The superego's function extends beyond critique
to *reality testing*. It anchors the ego's responses to the actual curriculum
context, preventing drift into familiar but inappropriate content. This connects
to Freud's reality principle: the superego enforces correspondence with external
reality, not just internal standards.

### 5. Hardwired Rules vs Dynamic Dialogue

**New finding:** Static rules capture ~50% of superego benefit. Dynamic dialogue
adds unique value on challenging scenarios (struggling learner, frustrated learner).

**Philosophical interpretation:** This distinguishes *procedural* from *contextual*
judgment. The superego's value is partially in enforcing known rules (codifiable)
and partially in recognizing edge cases (requiring judgment). This maps onto
debates about rule-following vs. practical wisdom in moral philosophy.

## Suggested Revisions

### Section 2: The Drama of Teaching
- Keep core Hegel/Freud framing
- Add note on domain sensitivity: the drama is more intense for identity-constitutive learning

### Section 3: Towards 'Machinagogy'
- Update to reflect recognition theory validation
- Add A×B interaction finding and its significance for the Hegel-Freud synthesis

### Section 5: Results
- Update effect sizes with robust evaluation (N=3,000+)
- Add recognition theory validation (43% unique value)
- Add domain generalizability findings
- Discuss hardwired rules finding in relation to practical wisdom

### Section 6: Interpreting the 'paper'
- Expand on "citation effect" with recognition validation data
- Add critical discussion of domain limits
- Discuss multi-agent as reality-testing (Freudian frame)

### Section 7: Conclusion
- Strengthen Honneth connection with validation data
- Add nuance: recognition-theoretic pedagogy has domain limits
- Discuss implications for "machinagogy" across disciplines

## New Sections to Consider

### Domain Limits of Recognition-Theoretic Pedagogy
A philosophical discussion of why recognition matters more for some content:
- Identity-constitutive vs procedural learning
- Abstract interpretation vs concrete procedure
- The "struggle" in different disciplines

### The Superego as Reality Principle
Expand the Freudian framing with the domain transfer finding:
- Superego enforces correspondence with curriculum reality
- Prevents hallucinatory drift into familiar content
- The "ghost" anchors the ego to the present encounter

## Writing Approach

Given the humanities style, revisions should:
1. Preserve flowing prose style (not bullet points)
2. Weave empirical findings into theoretical discussion
3. Use findings to deepen (not replace) philosophical argument
4. Maintain critical distance ("these results suggest..." not "we prove...")
5. Keep the meta-reflective voice about AI co-research

## Timeline

1. Update Results section with new empirical data
2. Revise Section 3 (Machinagogy) with A×B interpretation
3. Add domain limits discussion to Section 6
4. Expand Conclusion with nuanced Honneth connection
5. Review for consistency of voice and argument

## Dependencies

- full-paper-2026-01-28.md (source)
- PAPER-UNIFIED-2026-02-04.md (empirical reference)
- paper-revision-plan-2026-02-04.md (findings summary)
- Evaluation runs: eval-2026-02-03-86b159cd, eval-2026-02-04-79b633ca
