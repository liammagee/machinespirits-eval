# AI Tutor Mechanism Taxonomy

Created: 2026-06-18 12:48:20 CDT

## Context

This note records a side-conversation synthesis of the project arc from the first Paper 2.0 commit (`8bafc2d2`, 2026-03-03) through the later shift toward adaptation, trap-scenario instrumentation, and conduct governance.

The short version: the project moved from **"recognition prompts and ego/superego might produce adaptation"** to **"adaptation only becomes reliable when it is externalized as conduct governance: state, action menu, guards, and checkable triggers."**

The first Paper 2.0 commit framed three mechanisms: calibration, error correction, and adaptive responsiveness. The current paper has a sharper position: calibration and error correction are real; ordinary prompt/architecture-driven adaptive responsiveness was mostly null; the later adaptation work succeeds only when the system stops trying to "read the learner's soul" and starts governing the tutor's next move against explicit evidence and criteria.

## A. Integral

These are load-bearing.

- **Intersubjective calibration**: the tutor must orient to the learner's actual contribution rather than deliver generic help. This is the central supported mechanism.
- **External critique / superego, conditionally**: useful where the ego still makes correctable errors. Not always additive under recognition, but integral to the architecture's observability and to weak/baseline cases.
- **Trace logging and per-turn scoring**: not pedagogical magic, but integral to knowing what happened.
- **Event-localized adaptation tests**: trap scenarios, trigger turns, strict-shift scoring. Without these, "adaptation" stays too vague.
- **Explicit learner-state belief plus bounded action selection**: the current real adaptation mechanism.
- **Learner-ownership / control guards**: essential. They prevent the tutor from "adapting" by simply taking over.
- **Criterial conduct governance**: checkable triggers beat advisory prose. This is the big late-stage lesson.
- **Contextual realization of selected actions**: choosing `diagnostic_probe` is not enough; the tutor must realize it differently as the learner state changes.

## B. Beneficial

These help, but are not always necessary.

- **Ego/superego architecture under baseline or weaker models**: beneficial when there is real error headroom; redundant or less useful when calibration already handles the failure.
- **Minimal learner-state schema**: confidence plus quoted evidence seems useful; richer state did not generally pay.
- **Prompt optimization and dimension-targeted tuning**: useful engineering tool, but not the deep mechanism.
- **Cross-judge / cross-model replication**: methodologically beneficial because it prevents one judge/model pair from becoming the whole story.
- **Dialogue-engine baseline comparisons**: useful as floors and sanity checks, even when confounded.
- **Decay / unreliable-learner harnesses**: beneficial because they create real adaptation pressure rather than theatrical "confusion."
- **Human-readable theory framing**: helpful for organizing the paper and making stakes legible, provided it does not overclaim.

## C. Ornamental But Not Harmful

These are not load-bearing for tutor performance, but can help human readers understand the system.

- **Hegelian vocabulary as vocabulary**: the operational family is broader intersubjective pedagogy; Hegel is the clearest articulation, not the unique empirical ingredient.
- **Freudian ego/superego naming**: useful metaphor for roles; the mechanism is external critique, not Freud.
- **Drama / poetics / stage language**: strong as a research narrative and design lens, but not by itself the causal mechanism.
- **Director / critic commentary**: useful for interpretation and iteration, but not a policy unless converted into criterial machinery.
- **Rhetorical figure labels**: useful for diagnosing conduct variety; not inherently better tutoring unless tied to learner movement.
- **Charisma / id-director framing**: interesting side instrument, especially for authorship/style questions, but not central to adaptive tutoring.

## D. Superfluous

These mostly did not add measurable value.

- **Writing Pad / rich memory pad as recognition mechanism**: not load-bearing for the recognition effect.
- **Rich learner-state schemas** beyond the minimal useful fields: named misconceptions, agency enums, extra latent fields often added complexity without lift.
- **Bilateral ToM elaboration**: cleanly tested and mostly null.
- **Modelled concealed interior**: buildable, but usually re-encoded signal already available in context.
- **Counterfactual replay in the adaptive runner**: methodologically interesting, but not clearly responsible for the gains.
- **Learner ego/superego architecture for short synthetic dialogues**: generated more process, not reliably better external learner behavior.
- **Slope-based adaptation as the main measure**: useful negative evidence, but too blunt to detect localized strategic adaptation.

## E. Actively Harmful

These made the target worse, or reliably risk doing so.

- **Advisory "be sparse / vary more / adapt better" instructions**: repeatedly failed; often overfired or worsened lock-in.
- **Free-form conduct notes without authority mapping**: created puppetry or noise, not self-governance.
- **Over-rich mechanism stacks on weaker or already-capable systems**: added cognitive load and degraded output.
- **Bidirectional profiling / cognitive prosthesis variants**: often neutral-to-harmful rather than compensatory.
- **Strong-model superego scaffolding when calibration already works**: can become destructive rather than redundant.
- **Behaviorist matched-specificity prompt family**: not just non-recognition, but empirically below baseline.
- **High-control proof supply / premature answer-giving**: destroys learner ownership; it can look helpful locally while breaking the tutoring objective.
- **Pressure-to-progress overlays without proof-safe ownership gain**: can create negative transfer.

## Governing Distinction

The successful mechanisms are not the ones that make the tutor more elaborate. They are the ones that make the tutor's next action more accountable.

That sentence should probably become central to the "How to build an AI tutor" paper.
