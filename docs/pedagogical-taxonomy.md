# Pedagogical Orientation Taxonomy

A canonical reference for the distinct tutor-orientation variants authored as system prompts in this repository. Each variant operationalises a different tradition's view of what learning *is* and what the tutor's role should be. They share structural format (agent identity → principles → heuristics → output schema) but differ fundamentally on three axes: **view of learner**, **role of tutor**, **primary causal mechanism**.

Written 2026-04-23, during the A10/A10b prompt-density control cycle (see `notes/design-a10-prompt-density-v22-control.md`). Expected consumers: the chat interface (for orientation-labelled cell selection and descriptive tooltips), the paper's §7.9 and §5 construct-validity discussion, and future mechanism-isolation experiments.

---

## The three diagnostic axes

Every tutor prompt in this repository implicitly answers three questions. The answers cluster into pedagogical families.

| Axis | Behaviorist answer | Cognitivist / transmission answer | Intersubjective / constructivist answer |
|---|---|---|---|
| **What is the learner?** | A stimulus-response system to be shaped | An information-processing system to be loaded | An active thinking agent to be engaged |
| **What does the tutor do?** | Manage contingencies (reinforcement, feedback cycles) | Deliver clear content, minimise cognitive load | Diagnose current understanding, scaffold productive struggle |
| **What causes learning?** | Reinforced repetition of correct responses | Well-organised exposure plus retention practice | Cognitive disequilibrium resolved through dialogue |

These are not the only possible taxonomies but they are the ones that best separate the variants we have authored, and they are stable across the usual theorist genealogies (Skinner-Thorndike-Gagné vs Bruner-Atkinson-Sweller vs Hegel-Vygotsky-Piaget-Dewey-Freire-Kapur).

---

## The variants

### 1. `base` — generic pedagogical best-practice (unlabeled tradition)

| | |
|---|---|
| **Prompt file** | `tutor-ego.md` |
| **Cells using it** | cell_1, cell_2, cell_3, cell_4, and many descendants |
| **Length** | ~1,950 words (shorter than the theory-grounded variants) |
| **Lineage** | Anglo-American teacher-trainer tradition; no single named theorist |
| **View of learner** | Implicit; mostly information-recipient with some soft-constructivist framing ("engage with learner input") |
| **Role of tutor** | Provide specific, actionable content suggestions |
| **Vocabulary** | "suggest," "explain," "guide," "engage with" — ordinary pedagogical prose |
| **Evaluation role** | The factorial's minimal-theory baseline. Historically the weakest-scoring variant across all judge panels. |

### 2. `placebo` — length-matched, pedagogically-sensible, no theoretical grounding

| | |
|---|---|
| **Prompt file** | `tutor-ego-placebo.md` |
| **Cells using it** | cells 15-18 (Paper 1.0 active control) |
| **Length** | ~2,390 words (length-matched to the earlier recognition prompt) |
| **Lineage** | Constructed for the Paper 1.0 placebo-control experiment; no specific theorist |
| **View of learner** | "Individual with unique patterns"; generic adaptive-teaching framing |
| **Role of tutor** | Adapt guidance to learner state; be responsive |
| **Vocabulary** | "adapt," "calibrate," "respond to learner input," "appropriate challenge" |
| **Evaluation role** | The first-generation density control. Length-matched but NOT specificity-matched to recognition. Paper 1.0 cells 15-18; under v2.2 rubric the result was that placebo sits between base and recognition. |

### 3. `recognition` — Hegelian mutual-recognition theory, explicitly named

| | |
|---|---|
| **Prompt file** | `tutor-ego-recognition.md` (with `-nomem` and `-dialectical` variants) |
| **Cells using it** | cells 5-8 factorial; 84-91 messages-mode; all "recog" cells |
| **Length** | ~2,810 words |
| **Lineage** | Hegel (*Phenomenology*, master-slave dialectic); Honneth (*Struggle for Recognition*); Taylor on authenticity; Huttunen and Stojanov on recognition in pedagogy |
| **View of learner** | Autonomous subject with valid interpretations; co-constitutive partner |
| **Role of tutor** | Recognise learner contributions; engage dialectically with resistance; maintain productive tension; repair after failures to recognise |
| **Vocabulary** | "recognition," "autonomous subject," "mutual transformation," "dialectical engagement," "productive tension," "repair after misrecognition" |
| **Evaluation role** | The paper's headline intervention. Produces large effects across models and judges ($d \approx 1.6$ pooled, §8.3); operationalises the intersubjective family at its most explicit. |

### 4. `matched_pedagogical` — Hegelian-descendant constructivism without the Hegel labels

| | |
|---|---|
| **Prompt file** | `tutor-ego-matched-pedagogical.md` |
| **Cells using it** | cell_95 (A10 density control) |
| **Length** | ~2,835 words (matched to recognition within 1%) |
| **Lineage** | Vygotsky (ZPD); Piaget (assimilation/accommodation, cognitive disequilibrium); Kapur (productive failure); Chi (ICAP hierarchy); Graesser (AutoTutor affective dynamics); VanLehn (step-level scaffolding) |
| **View of learner** | Active thinking agent with current schema that must be disturbed to learn |
| **Role of tutor** | Diagnose current understanding; scaffold productive struggle at the specific step; prefer minimum effective assistance; push up the ICAP engagement ladder |
| **Vocabulary** | "ZPD," "productive struggle," "scaffolding," "disequilibrium," "step-level intervention," "ICAP," "diagnostic question," "minimum effective assistance" |
| **Evaluation role** | Authored for the A10 density control to test whether recognition's effect is reducible to matched-specificity. **Methodological caveat**: the theoretical lineage of this prompt overlaps with recognition's — Vygotsky was a Hegelian-Marxist, Piaget's disequilibrium is dialectical, Dewey was explicit about Hegel's influence. So this variant tests "Hegelian-family pedagogy without the Hegelian label," not "any sufficiently dense pedagogical prompt." |

### 5. `matched_behaviorist` — a genuinely orthogonal pedagogical orientation (authoring in progress)

| | |
|---|---|
| **Prompt file** | `tutor-ego-matched-behaviorist.md` (to be written) |
| **Cells using it** | cell_96 (A10b density control, planned) |
| **Length** | target ~2,830 words |
| **Lineage** | Skinner (operant conditioning); Gagné (Nine Events of Instruction); Keller (PSI / mastery learning); Thorndike (Laws of Effect, Exercise, Readiness); Rosenshine (Principles of Instruction, explicit-instruction lineage) |
| **View of learner** | An organism whose behaviour is shaped by contingencies; a responder to be reinforced toward mastery criterion |
| **Role of tutor** | Manage learning contingencies; break content into smallest teachable units; sequence simple-to-complex via chaining; immediate corrective feedback; reinforce correct performance; require mastery of each unit before advancement |
| **Vocabulary** | "contingency," "reinforcement," "stimulus," "response," "mastery criterion," "feedback cycle," "worked example," "guided practice," "independent practice," "chaining," "fading," "automaticity," "clear objective," "task analysis" |
| **Evaluation role** | The second-generation density control that `matched_pedagogical` should have been but wasn't. If recognition beats a rigorously-authored behaviorist prompt of matched length and specificity, the density loophole really is closed. If recognition ≈ behaviorist, we have a very different finding: *any* matched-length pedagogical prompt with clear directives produces the effect. |

---

## The A10 design lesson (2026-04-23)

The first A10 run authored `matched_pedagogical` as the density control. Preliminary v2 results (after a profile-resolution bug was discovered and fixed in v3.0.47) suggest recognition and matched-pedagogical produce near-identical scores ($|d| < 0.2$). Before concluding that density alone is sufficient, we recognise that Vygotsky, Piaget, Kapur, Chi, VanLehn, and Graesser are all in the Hegelian-descendant pedagogical family. The "matched ≈ recognition" finding is therefore a test of the *intersubjective family* internally, not a test of recognition against a genuinely different pedagogy. A10b (matched_behaviorist) is the sharper test.

The lesson for future mechanism isolations: a density control is only informative if the comparison prompt is **theoretically orthogonal** to the treatment, not just verbally distinct. Removing the word "recognition" from a Vygotsky-grounded prompt does not make that prompt a density control for recognition.

---

## For the chat UI

The variants above are registered as tutor-core profiles and mapped to eval cells in `config/tutor-agents.yaml`. The chat UI (`public/chat/`, `routes/chatRoutes.js`) reads cells directly from that YAML and can expose them to users.

### Structured metadata (added 2026-04-24)

`config/tutor-agents.yaml` now carries a top-level `pedagogical_orientations:` map keyed by `prompt_type`. Each entry has: `family`, `subfamily` (optional), `short_label`, `lineage`, `view_of_learner`, `role_of_tutor`, `key_mechanism`, `vocabulary[]`, `prompt_file`, `approx_length_words`, `evaluation_effect_pooled_d_vs_base` (where measured), `evaluation_note` (optional). Keys match the `factors.prompt_type` values in cell profiles.

### Consumption pattern (JavaScript example)

```js
import * as evalConfigLoader from '../services/evalConfigLoader.js';

const tutorAgents = evalConfigLoader.loadTutorAgents();
const orientations = tutorAgents.pedagogical_orientations || {};
const profiles = tutorAgents.profiles || {};

// Group cells by pedagogical orientation family
function groupCellsByOrientation() {
  const groups = {};
  for (const [cellName, profile] of Object.entries(profiles)) {
    if (!cellName.startsWith('cell_')) continue;
    const promptType = profile?.factors?.prompt_type;
    const orientation = orientations[promptType];
    if (!orientation) continue;  // cell uses a prompt_type without orientation metadata
    const family = orientation.family;
    (groups[family] ||= []).push({ cellName, profile, orientation });
  }
  return groups;
}

// For a given cell, get its orientation tooltip
function orientationTooltip(cellName) {
  const promptType = profiles[cellName]?.factors?.prompt_type;
  const o = orientations[promptType];
  if (!o) return null;
  return {
    label: o.short_label,
    family: o.family,
    view: o.view_of_learner,
    role: o.role_of_tutor,
    mechanism: o.key_mechanism,
    lineage: o.lineage,
    // For the "why this one?" comparative view:
    effectVsBase: o.evaluation_effect_pooled_d_vs_base,
    note: o.evaluation_note,
  };
}
```

### Suggested UX moves

1. **Family-grouped selector**: In the cell-picker, group cells under headers by `orientation.family`. The taxonomy gives four families: `transmission` (base, matched-behaviorist), `neutral` (placebo), `intersubjective` (recognition, matched-pedagogical). Intersubjective further splits into `hegelian_recognition` and `hegelian_constructivist` subfamilies if finer granularity is wanted.
2. **Tooltip on hover**: Show `short_label`, `view_of_learner`, `role_of_tutor`, `key_mechanism` on cell hover.
3. **Comparative panel**: Offer a "compare orientations" view that shows two cells side-by-side with their respective tutor outputs on the same scenario. The `vocabulary[]` lists are useful for labelling which orientation-distinctive words appeared.
4. **Effect-size chip**: Where `evaluation_effect_pooled_d_vs_base` is populated, display it as a small chip ("$d = 1.21$ vs base" on recognition cells). Grounds the UI in empirical findings rather than just theoretical typology.

The taxonomy is authoritative reference; the YAML metadata is the machine-consumable form; cells point to their orientation via `factors.prompt_type`.

---

## Methodological caveat: structural features confound theoretical content

The three theory-grounded variants (recognition, matched_pedagogical, matched_behaviorist) differ on the diagnostic axes above, but they also differ on **structural features of the prompt** that LLM judges may systematically prefer or penalise independently of theoretical content:

| Structural feature | Recognition | Matched-pedagogical | Matched-behaviorist |
|---|---|---|---|
| Tone | Warm, dialogical, inviting | Specific, diagnostic, respectful | Formal, prescriptive, directive |
| Response structure | Open-ended, scaffolding-within-response | Diagnostic-question-first, step-level | Objective → rule → worked example → practice → criterion |
| Learner-text engagement | High (quoting, building on, repairing) | Moderate (referring to specific state) | Low (targeting response patterns, not interpretations) |
| Instruction density | High (15+ directives) | High (~15 directives) | Highest (specific criteria, event-numbered sequences) |
| Question type preference | Open, dialectical | Diagnostic, ZPD-calibrated | Closed, criterion-checked |

A determined skeptic can argue that **any empirical ordering of these variants** (by LLM judge score, or by downstream outcomes) may reflect *judge preferences for structural features* rather than *theoretical validity of the underlying tradition*. Three concrete possibilities:

- **Judges that prefer warmth and agency language** (common under RLHF trained on human-preferred responses) may rank recognition > matched-pedagogical > matched-behaviorist on those grounds, mimicking the theoretical ordering the paper argues for but for irrelevant reasons.
- **Judges that prefer clear structure and explicit rules** (some cognitive/analytical optimisation targets) may rank behaviorist > matched-pedagogical > recognition, inverting the ordering despite identical content.
- **Judges that tolerate nuance and implicit guidance** (most capable general-purpose judges) may score the three closer together than structurally-attuned judges would.

The existing three-judge panel (Sonnet 4.6, Gemini 3.1 Pro, GPT-5.4) partially addresses this --- Paper 2.0 §8.3 documents judge-mean $d$ ranging from 1.44 to 1.88 on the recognition-vs-base contrast, and we know judges disagree substantially on the disengagement scenario (A12 $\Delta d = 2.03$ between Sonnet and GPT on identical rows). For the pedagogical-orientation comparison specifically, cross-judge divergence is likely to be *larger* than on recognition-vs-base, because the three variants have similar *surface* quality (all are rigorously authored pedagogical prompts) and judges therefore lean more heavily on their idiosyncratic structural preferences when scoring.

**Mitigations** for this family of confound:

1. **Cross-judge reporting as a first-class requirement**, not a sensitivity check. All A10/A10b claims should report per-judge $d$ alongside any pooled number.
2. **Opus 4.7 spot-checking** on a targeted sample of dialogues (say, 10--20 per contrast) — a more capable judge than Sonnet 4.6 may see substantive differences the cheaper judges miss or introduce their own idiosyncrasies. Opus spot-checks also let us examine *qualitative* judge reasoning to diagnose which structural features dominate.
3. **Per-dimension analysis** — if the rubric dimensions behave differently across variants (e.g., behaviorist scores high on `content_accuracy` / `clarity` but low on `adaptive_responsiveness`), that pattern decomposes the "overall score" into judge-detectable orientations.
4. **Independent-observer replication** — ultimately, the human learner pilot (§A1) is the only way to break the judge-preference confound fully. An empirical finding that matched_behaviorist and recognition score identically under LLM judges but produce different *human learning gains* would be the strongest possible evidence that judge preferences misrepresent the theoretical ordering.

This caveat is not a reason to avoid the A10/A10b comparisons --- it is a reason to report them with the full cross-judge decomposition and to treat any ranking as judge-conditional until human validation is available.

---

## What this is not

- **Not a comprehensive taxonomy of educational theory.** Radical constructivism (von Glasersfeld), socio-cultural pedagogy (Rogoff), culturally responsive pedagogy (Ladson-Billings), and many other traditions are absent. The variants here are the ones we have rigorously authored as matched-length prompts for comparative evaluation.
- **Not a ranking.** The evaluation data tells us what scores higher under LLM judging on synthetic learners in the specific scenarios tested; it does not tell us which pedagogy produces better human learning outcomes. See §8.1 of the paper and the A1 pilot runbook.
- **Not philosophical typing.** "Hegelian-descendant constructivism" is a loose genealogical grouping that glosses over real differences (Vygotsky's Marxist materialism vs Piaget's biological naturalism vs Dewey's pragmatism). The grouping is useful for orthogonality analysis in our evaluation context; it is not a claim about philosophical identity.

---

## Evaluation findings to date (living section, update as runs complete)

| Contrast | Effect size | Source run | Status |
|---|---|---|---|
| recognition vs base (pooled 3-judge) | $d \approx 1.63$ | Paper 2.0 main factorial | Established |
| recognition vs placebo (Paper 1.0, v1.0 rubric) | recog > placebo > base | Paper 1.0 §6.2 | Established, cross-version |
| A10 v2 recognition vs matched_pedagogical — three-judge triangulation (full $n$) | Sonnet $d = 0.23$, Opus $d = 0.22$, GPT $d = 0.06$, **pooled $d = 0.17$** | `eval-2026-04-23-42e7acbe` (A10 v2, $n \approx 55$-$63$/cell) | **Density-sufficient within Hegelian-descendant family under pooled-judge reading** |
| A10b four-way three-judge triangulation (full $n$) | Within-Hegelian pooled $d = 0.15$ (per-judge: Sonnet $-0.05$, GPT $0.17$, Opus $0.32$); within-transmission pooled $d = 0.89$ (behaviorist below base); between-family pooled $d = 1.38$ | `eval-2026-04-24-e9a785c0` (A10b, $n \approx 48$-$63$/cell) | **Orientation family is the dominant effect; intersubjective family dominates transmission family; within intersubjective family, density is substitutable; per-judge direction varies at full $n$ on the within-Hegelian contrast** |

---

## Cross-references

- Prompts live in `prompts/` (eval-repo) and `node_modules/@machinespirits/tutor-core/prompts/` (tutor-core). The chat router's `loadPromptFile()` at `routes/chatRoutes.js:~38` checks both locations.
- Cell definitions in `config/tutor-agents.yaml` (eval-repo).
- Profile definitions in `node_modules/@machinespirits/tutor-core/config/tutor-agents.yaml` (tutor-core).
- Paper §7.9 discusses the recognition-content-vs-density question.
- `notes/design-a10-prompt-density-v22-control.md` is the pre-registration for the density test.
- `exports/a10-prompt-density-control.md` holds the analysis-run report (v1 invalidated, v2 in progress).
