# Response to the Dialogical-Felicity experimental design

**Responds to:** `docs/critique/dialogical-felicity-experimental-design.md` (dated 2026-05-19)
**Author:** Claude (Opus 4.7), feasibility review at maintainer request
**Date:** 2026-05-19
**Status:** review artifact. Introduces **no** empirical claim. Every assertion traces to an existing section of `docs/research/paper-full-2.0.md` (§6.7–§6.10, §7.9), to the in-flight A17 prototype (`notes/design-a17-speech-act-lock-prototype.md`, `config/lock-puzzle-scenarios.yaml`), or to the project's authoring discipline (CLAUDE.md "Paper Authoring Discipline"). If any recommendation below is acted on, the resulting work lands as a numbered §-extension of `paper-full-2.0.md`, not as a standalone study.

---

## One-sentence verdict

The design is **feasible to build** — the machinery already exists — but as written it is a **methodological regression** against the A17 lock-puzzle prototype currently uncommitted on this branch, and it is **framed as a spin-off study**, which the project's authoring discipline does not permit; the version worth running keeps A17's deterministic outcome and adds felicity as a *secondary, descriptive* channel.

## 1. The synthesis that matters: felicity vs. A17

The working tree on `experiment/speech-act-lock-prototype` is the **A17 speech-act-lock** prototype. Its methodological spine:

| Property | A17 (in flight) | Dialogical-felicity (proposed) |
|---|---|---|
| Primary outcome | **Deterministic unlock predicate** — panel all-correct for k=2 turns, scored by `pilotItemBank.js` exact-match | 8-dimension **LLM holistic rubric** (Dialogical Felicity Index) |
| LLM in the outcome channel? | **No** | Yes |
| Memorisation discriminator | **Yes** — held-out stream (unseen surface, same misconception) | No |
| Answer key withheld from tutor | **Yes** (§3.1/§3.2 of the A17 design) | n/a |

A17's design is the strongest spine this project has produced against the closed-loop tells that sank the adaptive-persona prototype (same-model-in-all-roles; architecture-aligned rubric; gate redefinition) — precisely because its outcome is non-LLM, deterministic, and carries a learning-vs-memorisation discriminator.

The felicity doc swaps that hard outcome back out for an LLM rubric. Philosophically it is richer (Aristotle/Hegel/Freud reframed as **discourse-reading, not mind-reading**; the anti-overinterpretation penalty and the evidence-warrant judge are genuinely well-built). But methodologically it gives back the one property A17 was constructed to win. It is the intellectual *successor* to A17's speech-act framing and the methodological *predecessor* of it.

## 2. Two structural issues to resolve before committing

### 2.1 Prompt–rubric circularity → only the interaction is informative

The "dialogical-felicity" prompt condition and the felicity rubric are written in the **same vocabulary** (uptake, recognition, reversal, making-suppressed-speakable). A prompt instructed to do X, scored by a rubric that rewards X, wins **by construction** — and that win merely re-expresses the already-established in-context recognition **level** effect (the paper's most robust positive: recognition/intersubjective framing raises level and narrows variance, for free, in one forward pass — §6.3 level pole, §7.9), not a new finding.

The doc's controls (shuffled-turn, cue-ablation, false-depth) test *"the rubric measures dialogue, not polish."* They do **not** test the live risk: that the manipulation adds anything beyond the recognition effect the paper already owns. This matters because the paper's central explanatory motif across six convergent negatives (§6.7 / §6.8.8 / §6.9.7 / §6.9.8 / §6.10) is that gains come from **new signal or genuine opposition**, never from **re-encoding what a strong base already infers in-context** — and an LLM rubric cannot, by itself, distinguish the two.

Consequence: the main-effect hypothesis (`dialogical-felicity > recognition-only > baseline`) is pre-determined and uninformative. Only the **interaction** prediction (felicity advantage *concentrated* in latent-tension / rupture / false-compliance scenarios, absent in ordinary content — the doc's own lines 681–688) can carry weight, and it should be pre-registered as *the* test, with the main effect declared expected-and-uninformative up front. The rubric must be frozen, and its vocabulary deliberately **non-nested** with the winning prompt's.

### 2.2 It is framed as a spin-off, and cannot be one

"Study name," "Working title," "Alternative title," its own success criteria, and an explicit claim to constitute "a new evaluative ontology." The project's authoring discipline (single source of truth = `paper-full-2.0.md`; no spin-off papers) means this enters as a numbered §-extension, inherits the manifest / prose-N-count validation, and must **reconcile with §7.9** ("Adaptation as a measured construct") rather than declare a fresh ontology that routes around it. §7.9 already holds a symmetric-honesty line — the adaptation nulls do *not* license "architectures failed to adapt richly," *and* proxy-inadequacy is *not* a rescue. "Dialogue as public form" is a legitimate construct, but it must be positioned *with respect to* that line, as §X.Y, not as a parallel study with independent standing.

## 3. The version worth running

Do not replace A17's outcome — **layer felicity on top of it.** Same lock-puzzle transcripts; A17's deterministic unlock + held-out transfer remains the **primary** outcome; the felicity rubric is added as a **secondary, descriptive, blinded-transcript** channel (the project already has `assess-transcripts.js --blinded` and the `blinded_qualitative_assessment` column).

This converts the soft, circular question ("does a felicity prompt score higher on a felicity rubric?") into a hard, non-gameable one:

> **Does dialogical felicity track the deterministic unlock, or dissociate from it?**

A dissociation (high felicity, no unlock — or unlock without felicity) is novel, cannot be manufactured by prompt–rubric vocabulary nesting, and bears directly on the paper's level-vs-rate distinction. That study needs the doc's **192-dialogue minimal pilot**, not the 1,152-dialogue three-model grand factorial.

## 4. The open fork (maintainer decision)

This is a genuine fork, not a detail to be assumed:

- **(A) Layer on A17** *(recommended)* — deterministic unlock primary, felicity secondary; novel dissociation question; non-circular; ~192 pilot; lands as a § of `paper-full-2.0.md`.
- **(B) Felicity standalone** — build the doc as written; richer construct, but regresses on the architecture-independent-outcome property A17 was built to win, and the main effect is prompt–rubric circular.
- **(C) Pause both, synthesise first** — write the defensible-vs-unestablished synthesis of the speech-act/lock + felicity line into the paper before running anything new, given the closed adaptation arc (§6.7–§6.10, §7.9).

## What this review does *not* do

It does not endorse a new empirical claim, a new rubric version, or a new cell. The felicity rubric, if adopted, is a new instrument that must be frozen and version-tagged under `config/rubrics/` before any scoring, and must not be applied retroactively to historical data (cross-version contamination). Any numbers it produces are reportable only inside `paper-full-2.0.md`.
