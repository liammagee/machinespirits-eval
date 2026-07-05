# D6 Orientation-Family Matrix for the D2-D6 Arc

Date: 2026-06-24
Branch: `codex/d2-d6-followups`
Status: second D2-D6 slice; freezes the family map used by later D2/D4 work.

## Decision

Do not add new pedagogical-orientation families for the D2-D6 arc yet. Use the
families already registered in `config/tutor-agents.yaml` and treat D6 as a
matrix/metadata discipline: every future run must say whether it is comparing
within a family, between families, or across architecture variants that inherit
their orientation from another prompt.

This keeps the Paper 2.0 result legible. The current finding is not "recognition
words win." It is that an intersubjective-pedagogy family, represented by
recognition and matched constructivist descendants, outperforms an orthogonal
transmission/behaviorist family under the current synthetic-learner, LLM-judge
harness. D6's job is to stop future work from blurring that unit of analysis.

## Registered matrix

| Empirical role | Family | Prompt types | How to use it |
|---|---|---|---|
| Treatment family | `intersubjective` | `recognition`, `matched_pedagogical`, `recognition_nomem` | Use for recognition-family and constructivist-descendant comparisons. Within-family differences are not evidence that Hegelian vocabulary is uniquely active unless they clear the existing density threshold. |
| Orthogonal comparison family | `transmission` | `base`, `matched_behaviorist`, `enhanced`, `naive`, `hardwired`, `memory` | Use for between-family contrasts. Distinguish generic baselines from rigorously authored behaviorist/explicit-instruction controls. |
| Active control, not a theory family | `neutral` | `placebo` | Use as a length/responsiveness control only. Do not treat placebo as a third pedagogical theory. |
| Architecture wrapper, not an orientation | `architectural_variant` | `dialectical_*`, `divergent_*` | Do not compare as a pedagogical family. Resolve the paired ego orientation first, then ask what the architecture changed. |

## Extension criteria

A new orientation family should not be added merely because a theory is
interesting. It needs all of the following before it becomes a run candidate:

1. Axis separation.
   - A distinct answer to learner ontology, tutor role, and causal learning
     mechanism.
   - It must not be a relabelled intersubjective or transmission prompt.

2. Matched authoring discipline.
   - Prompt length and instruction density are close to the existing matched
     prompts.
   - Structural format is comparable enough that judge preference for tone or
     layout is not the whole contrast.

3. Machine metadata.
   - New `pedagogical_orientations` entry in `config/tutor-agents.yaml`.
   - Prompt file path, lineage, vocabulary, learner view, tutor role, and key
     mechanism filled in before any cell is run.

4. Evaluation role.
   - The workplan item must say whether the family is a between-family control,
     a within-family density test, or a new external-validity application.

5. Scoring and judge plan.
   - Cross-judge reporting is required for family-ranking claims.
   - If a claim uses Paper 2.0 comparability, use v2.2 per the D5 gate.

## Candidate families, parked

These are plausible future extensions, but none should be opened inside this arc
without a separate item and acceptance gate.

| Candidate | Why it might matter | Why it is parked |
|---|---|---|
| Metacognitive / self-regulated learning | Tests whether explicit planning, monitoring, and reflection can match intersubjective scaffolding without Hegelian or constructivist lineage. | Needs a clean distinction from current `enhanced` and `hardwired` prompt-engineering variants. |
| Culturally responsive / funds-of-knowledge pedagogy | Tests whether learner identity and community knowledge form a different orientation rather than an intersubjective subfamily. | Higher ethical and design burden; likely human-pilot adjacent. |
| Inquiry / Socratic tutoring | Tests whether question-led discipline alone explains part of the recognition effect. | Risk of collapsing into constructivist/ICAP unless the causal mechanism is authored distinctly. |
| Cognitive-load / worked-example instruction | Sharpens the transmission family beyond behaviorist reinforcement. | Could be a useful D4/D2 control, but only after deciding whether it is a subfamily of transmission or a separate family. |

## Consequences for the remaining D items

D2 should treat application role and pedagogical orientation as separate axes.
Changing from tutor to coach/reviewer/peer-support agent does not automatically
create a new orientation family. The design must say whether each role is tested
under an intersubjective prompt, a transmission prompt, both, or a role-neutral
rubric.

D4 should not treat `dialectical_*` or `divergent_*` labels as orientation
families. They are architecture/disposition variants. For an architecture-matched
SEL replication, the first cut should ask whether the base-vs-recognition
orientation pairing and the suspicious/adversary/advocate disposition are
separated cleanly enough to interpret any gradient.

D3 is also architecture-first, not family-first. Bridge mechanisms can inherit a
base or recognition orientation, but the bridge question is whether reflection
changes action. It should not be reported as a new orientation-family result.

## Stop condition for D6

D6 is resolved for this arc when the branch records a matrix that:

- identifies the registered empirical families,
- separates pedagogical families from architectural variants,
- defines criteria for adding new families, and
- states the consequences for D2, D4, and D3.

That condition is met by this note. The next item in the D2-D6 order is D2:
recover or reconstruct the true cross-application role-reframed design with
application role and pedagogical orientation kept as separate axes.
