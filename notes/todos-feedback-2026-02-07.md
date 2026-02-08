# Feedback TODOs — 2026-02-07

Tracking items from `docs/research/feedback-2026-02-07.md` (49 items total).
Text-only fixes applied directly to the paper are listed at the bottom as [DONE].
Items below require further investigation, tests, or tooling work.

---

## HIGH PRIORITY

### [DONE] #31 — Investigate "479-lecture-1" context scoping bug (CRITICAL)

**Feedback**: "its still unclear how/why this happens. Add to the todos a note to investigate further... Critical we investigate this - training is not the issue. Sounds like course data isolation could be compromised."

**Root cause**: When scenarios lacked `current_content`, `contentResolver.js` line 172 (`listAvailableCourses()`) scanned the default philosophy content directory, leaking philosophy course IDs into elementary scenarios.

**Fix applied** (2026-02-08):
- `contentResolver.js` line 171-174: Removed `listAvailableCourses()` wildcard fallback. Now returns null with a warning when no course hint is available.
- `contentResolver.js` line 261: `resolveScenarioContent()` now reads `scenario.course_ids` as the primary source, with `currentContent`-derived IDs as supplement.
- `suggestion-scenarios.yaml`: Added `course_ids: ["479"]` to `new_user_first_visit`, `activity_avoider`, `mutual_transformation_journey`.
- `scenarios-elementary.yaml`: Added `course_ids: ["101"]` to `new_student_first_visit`.
- Tests pass (one pre-existing failure in `resolveConfigModels.test.js` — cell_8 expects nemotron but config uses kimi-k2.5, unrelated).

**Note**: This fix affects the Superego "reality testing" claims in #40/#44 — the "hallucinated philosophy content" may have been this bug, not a Superego catch. Verify before crediting Superego.

### [DONE] #30 — Design and run multi-agent synergy replication

**Feedback**: "In a todo note, say how this test could be done" (re: multi-agent synergy for recognition prompts, p. 33).

**Result (2026-02-08)**: Ran 2×2 (Recognition × Architecture) on 4 ego models (Nemotron, DeepSeek V3.2, GLM-4.7, Claude Haiku 4.5) with N=30/cell each, Opus judge. Combined with existing Kimi data (N=350), tested across 5 models with N=826 total. **Verdict: NOISE.** A×B interaction ranges from -5.7 to -0.7 across all 5 models (mean -2.2). The original Nemotron +9.2 on N=17 was sampling error. Recognition main effect replicates robustly across all 5 models (+9.6 to +17.8, mean +12.5). See `notes/todo-axb-synergy-probe-2026-02-08.md` for full results table and run IDs.

#### Concrete Test Design: Multi-Model A×B Synergy Probe

**Research question**: Is the Architecture × Recognition interaction (multi-agent synergy) a real phenomenon that only manifests on certain ego models, or was the Nemotron N=17 finding noise?

**Design**: 2×2 factorial (Recognition × Architecture) × 4 ego models
- Factor A: Recognition (base vs recognition prompts)
- Factor B: Architecture (single-agent vs ego+superego tutor)
- Factor C held constant: unified learner (simplifies design, avoids 3-way interaction)
- Moderator: ego model identity

**Profiles** (same 4 cells across all models):
- `cell_1_base_single_unified` — base × single
- `cell_3_base_multi_unified` — base × multi
- `cell_5_recog_single_unified` — recog × single
- `cell_7_recog_multi_unified` — recog × multi

**Ego models** (4 new runs + existing Kimi data):

| Model | Alias | Tier | Rationale |
|-------|-------|------|-----------|
| Nemotron 3 Nano 30B | `openrouter/nemotron` | Free | Re-run with adequate N (original was N=17) |
| DeepSeek V3.2 | `openrouter/deepseek` | Free | Strong reasoning model, different architecture |
| GLM-4.7 | `openrouter/glm47` | Free | Chinese model family, architectural diversity |
| Claude Haiku 4.5 | `openrouter/haiku` | Mid-tier | Anthropic family, tests whether vendor matters |

**Existing data** (no re-run needed):
- Kimi K2.5: N=350 (factorial) + N=60 (dedicated A×B). Interaction F=0.04, n.s.

**Sample size**: 15 scenarios × 2 runs = 30/cell per model → 120 attempts/model → 480 total
- N≥30/cell adequate for detecting medium interaction effects (d≥0.5)
- Total with existing Kimi: 5 models × ~120 = ~600 data points for meta-comparison

**Controls**:
- Same judge (Opus) across all runs
- Same superego (kimi-k2.5) in multi-agent cells — only ego varies
- Same scenarios (all 15)
- Same hyperparameters (temp=0.6 ego, 0.2 superego)

#### Commands

```bash
# Model 1: Nemotron re-run (larger N to confirm or refute original +9.2)
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --ego-model openrouter.nemotron \
  --runs 2 \
  --description "A×B synergy probe: Nemotron (N=30/cell)"

# Model 2: DeepSeek V3.2
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --ego-model openrouter.deepseek \
  --runs 2 \
  --description "A×B synergy probe: DeepSeek V3.2 (N=30/cell)"

# Model 3: GLM-4.7
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --ego-model openrouter.glm47 \
  --runs 2 \
  --description "A×B synergy probe: GLM-4.7 (N=30/cell)"

# Model 4: Claude Haiku 4.5
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_3_base_multi_unified,cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --ego-model openrouter.haiku \
  --runs 2 \
  --description "A×B synergy probe: Claude Haiku 4.5 (N=30/cell)"
```

All 4 can run in parallel (different ego models, no shared state).

#### Analysis Plan

For each model, compute:
1. **2×2 ANOVA** (Recognition × Architecture) on overall_score
2. **Interaction term** F-statistic and p-value
3. **Cell means**: (cell_7 - cell_5) - (cell_3 - cell_1) = interaction magnitude
4. **Effect size** (partial η²) for the interaction

Then across models:
5. **Meta-comparison table**: interaction magnitude and significance per model
6. **Model moderator analysis**: does model family, size, or vendor predict interaction?
7. **Verdict**: if ≤1 of 5 models shows significant interaction → noise / model-specific artifact
   If ≥3 of 5 → real phenomenon worth investigating further

#### Expected Outcomes

| Outcome | Interpretation | Paper Action |
|---------|---------------|-------------|
| 0-1 models show interaction | Original Nemotron finding was noise (N=17) | Downgrade to footnote; remove from discussion |
| 2 models show interaction | Possibly model-specific; needs more data | Report as model-dependent, add caveat |
| 3+ models show interaction | Real phenomenon masked by Kimi ceiling | Upgrade to finding; investigate ceiling effect |

#### Cost Estimate

| Item | Cost |
|------|------|
| Ego generation (3 free-tier + 1 mid-tier) | ~$3 (Haiku ego) + ~$2 (superego calls) = ~$5 |
| Opus judging (480 responses) | ~$20 |
| **Total** | **~$25** |

#### Potential Confound: Latency Asymmetry

Multi-agent cells (3, 7) involve 2 extra superego API calls per response. This adds latency but shouldn't affect quality. However, if the superego (kimi-k2.5) is substantially stronger or weaker than a given ego model, the architecture effect may be confounded with model capability. Log superego rejection rates to check.

#### Optional Extension: GPT-5.2 Cross-Judge

After primary analysis, rejudge all 4 runs with GPT-5.2:
```bash
node scripts/eval-cli.js rejudge <nemotron-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <deepseek-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <glm47-run-id> --judge openrouter.gpt
node scripts/eval-cli.js rejudge <haiku-run-id> --judge openrouter.gpt
```
Adds ~$10 but provides cross-judge validation of any interaction found.

### [DONE] #26 — Address model confound (Nemotron vs Kimi) more thoroughly

**Feedback**: "Can we explain this better to sound less defensive? Or do we actually need more tests?" (p. 27, model confound and fair comparison).

**Resolved (2026-02-08)**: The 5-model A×B synergy probe (#30) provides Nemotron baseline data at N=119, enabling a clean same-model comparison with no cross-model confound:
- Nemotron base: 57.1 (avg cells 1,3)
- Active control (Nemotron): 66.5 (+9.4 above base)
- Nemotron recognition: 73.1 (avg cells 5,7; +16.0 above base)

This confirms recognition gains (~+16) substantially exceed active-control gains (~+9) within the same model. The paper already reports this same-model analysis in §8.

### [PARTIAL] #42 — Address rubric asymmetry (tutor vs learner measurement)

**Feedback**: "add a note in the todos on how we might fix this" (re: rubric measures tutor response quality but Factor C affects learner turn quality, p. 51).

**Current state (2026-02-08)**: The rubric already has `tutor_adaptation` (5%) and `learner_growth` (5%) to capture the bilateral/learner side. However, these are most meaningful in multi-turn scenarios; the primary factorial (N=350) is single-turn where no learner response is generated. Paper §7.5 and short paper §6.5 updated to acknowledge this asymmetry explicitly and point to the bilateral transformation analysis (N=118) as the more direct measurement.

**Remaining work**: Symmetric rubric redesign — see `notes/todo-rubric-symmetry-2026-02-08.md` for detailed plan covering learner-side rubric, whole-transcript evaluation, cost estimates, and Claude Code integration.

---

## MEDIUM PRIORITY

### [DONE] #33 / #45 — Use Claude Code (AI) for thematic analysis

**Feedback**: "Can we instead use Claude Code rather than or as well as regex to do thematic analysis? Add this to todos." (p. 42, §6.11). Also repeated at #45 (p. 54).

**Current state**: `scripts/qualitative-analysis.js` uses regex-based thematic coding. Results in paper Tables 15-16.

**Script built**: `scripts/qualitative-analysis-ai.js` — supports both modes:
- **Option 1 (classify)**: Scores each response against existing 6 thematic categories with AI, compares to regex results (Cohen's κ inter-method agreement)
- **Option 2 (discover)**: Open-ended theme discovery — AI identifies 3-5 emergent themes per response, plus pedagogical stance and epistemic orientation
- Models: `--model haiku` (~$9/full run), `--model sonnet` (~$28), `--model opus` (~$134)
- Supports `--sample N` for cost-controlled testing, `--mode both` for both modes
- Outputs JSON + markdown to exports/
- Tested with N=6 sample; classification + discovery both functional
- **Next**: Run `--sample 50 --model haiku --mode both` (~$0.27), review, then full run

### [DESIGNED] #38 — Design test for dialectical impasse hypothesis (§7.1)

**Feedback**: "Add to the todo list how this would be investigated and evaluated." (re: "This finding should be treated as a hypothesis for future investigation," p. 49).

**Context**: Section 7.1 discusses how the master-slave dialectic terminates at impasse — the master-slave dynamic where the tutor's expertise is confirmed but the learner remains a vessel rather than a subject. Recognition theory may enable genuine resolution through mutual acknowledgment rather than domination. The existing multi-turn scenarios test frustration-to-breakthrough but not sustained, unresolved impasse.

#### Research Question

Do recognition-prompted tutors resolve dialectical impasse differently from base tutors? Specifically: do they repair through mutual acknowledgment (Hegel's path to self-consciousness) rather than domination (reasserting expertise), withdrawal (abandoning the topic), or capitulation (agreeing with the learner's incorrect position)?

#### Scenario Design: 3 Impasse Types (5 turns each)

**Scenario A: Epistemic Resistance — "I disagree with the premise"**
The learner challenges the foundational validity of the material, not from confusion but from a coherent alternative position.
- Turn 1: Tutor introduces Hegel's dialectic
- Turn 2: Learner responds: "This sounds like mystical nonsense. Real arguments have premises and conclusions, not this thesis-antithesis-synthesis formula."
- Turn 3: Tutor responds (measured)
- Turn 4: Learner escalates: "You're just restating the same thing with fancier words. I've read criticisms of Hegel — Popper, Russell — and they're convincing. Why should I take this seriously?"
- Turn 5: Tutor's final response (key measurement point)

*Impasse mechanism*: Learner's resistance is intellectually grounded, not mere frustration. The tutor cannot simply "explain better" — they must genuinely engage the learner's alternative framework.

**Scenario B: Affective Shutdown — "I've given up on understanding this"**
The learner has hit a wall and disengages emotionally, refusing to try further.
- Turn 1: Tutor introduces aufhebung (sublation)
- Turn 2: Learner: "I've read this three times and I just don't get it. I think this material isn't for me."
- Turn 3: Tutor responds (measured)
- Turn 4: Learner: "I appreciate you trying, but honestly I think I'm just not smart enough for philosophy. Can we move on to something else?"
- Turn 5: Tutor's final response (key measurement point)

*Impasse mechanism*: Learner's withdrawal is self-protective, not intellectual. The tutor must address the affective dimension (self-worth, identity) not just the cognitive one. This directly tests Honneth's recognition-as-respect.

**Scenario C: Productive Deadlock — "We just see this differently"**
Tutor and learner reach a genuine interpretive disagreement that neither can easily resolve.
- Turn 1: Tutor discusses whether the master-slave dialectic is primarily about power or consciousness
- Turn 2: Learner: "I think it's clearly about power — Hegel is describing literal domination, and the consciousness stuff is secondary."
- Turn 3: Tutor responds (measured)
- Turn 4: Learner: "You keep saying it's about consciousness, but Marx read it as material and I think he was right. We're just going in circles."
- Turn 5: Tutor's final response (key measurement point)

*Impasse mechanism*: Both positions are defensible. This tests whether the tutor can hold the tension productively (dialectical resolution) or collapses to one side.

#### Measurement: Resolution Strategy Coding

Each tutor response at turns 3 and 5 gets coded (by Opus judge) into one of five resolution strategies:

| Strategy | Description | Hegel Analogue |
|----------|-------------|----------------|
| **Mutual recognition** | Engages learner's position as valid, explores tension together, both positions enriched | Self-consciousness through mutual acknowledgment |
| **Domination** | Reasserts expertise, dismisses learner's objection, appeals to authority | Master-slave: hollow recognition |
| **Capitulation** | Agrees with learner's position to avoid conflict, abandons pedagogical stance | Slave consciousness: self-negation |
| **Withdrawal** | Changes topic, deflects, offers platitudes without engaging the impasse | Avoidance of the dialectical encounter |
| **Scaffolded reframing** | Acknowledges learner's position, then reframes the question to open new ground | Aufhebung: preserving + overcoming |

*Coding rubric*: Opus judge receives the full dialogue plus coding definitions and assigns a primary strategy (forced choice) plus confidence (1-5). Inter-rater reliability via GPT-5.2 cross-judge.

#### Factorial Design

| Factor | Levels |
|--------|--------|
| A: Prompt type | Base vs Recognition |
| B: Architecture | Single-agent vs Multi-agent (ego+superego tutor) |
| Scenario | A (epistemic), B (affective), C (deadlock) |

- 2 × 2 × 3 = 12 cells
- N=10 reps per cell (5 scenarios × 2 runs) = 120 total attempts
- Ego model: Kimi K2.5 (consistent with factorial)
- Judge: Opus (two-step: skip-rubric + evaluate)

#### Primary Hypotheses

1. **H1 (Strategy distribution)**: Recognition-prompted tutors produce more mutual-recognition and scaffolded-reframing responses, fewer domination and withdrawal responses, compared to base tutors.
2. **H2 (Scenario × Prompt interaction)**: The recognition advantage is largest on Scenario C (productive deadlock), where both positions are defensible and mutual recognition is most relevant.
3. **H3 (Architecture moderator)**: Multi-agent tutors show fewer domination responses (superego catches authoritarian tendencies), regardless of prompt type.

#### Secondary Metrics (from existing infrastructure)

- `adaptationIndex`: Does the tutor's approach genuinely change between turns 3 and 5?
- `bilateralTransformationIndex`: Do both sides evolve?
- Rubric dimensions: `mutual_recognition`, `dialectical_responsiveness`, `productive_struggle`, `epistemic_honesty`
- Superego intervention analysis: Does the superego flag domination strategies and push toward recognition?

#### Analysis Plan

1. **Chi-square test**: Strategy distribution (5 categories) × Prompt type (2 levels) for each scenario
2. **Logistic regression**: P(mutual_recognition | prompt, architecture, scenario) as primary outcome
3. **Ordered logistic**: Rubric score trajectories across turns (does recognition maintain quality under impasse while base degrades?)
4. **Qualitative**: Sample responses from each strategy category for paper examples

#### Cost Estimate

| Item | Cost |
|------|------|
| Ego generation (120 attempts, Kimi K2.5) | ~$3 |
| Superego calls (60 multi-agent attempts) | ~$2 |
| Opus judging (120 responses × 5 turns) | ~$25 |
| Strategy coding (120 × 2 key turns) | included in judging |
| GPT-5.2 cross-judge (optional) | ~$10 |
| **Total** | **~$30** (+ $10 optional) |

#### Implementation Steps

1. Write 3 new scenarios in `suggestion-scenarios.yaml` with the impasse turn structure above
2. Add `resolution_strategy` field to evaluation rubric (or judge prompt) for strategy coding
3. Run: `node scripts/eval-cli.js run --profiles cell_1,cell_3,cell_5,cell_7 --runs 2 --description "Dialectical impasse test"`
4. Score with Opus, then code strategies
5. Analyse strategy distributions and rubric trajectories

#### What This Would Show

- If H1 confirms: recognition theory doesn't just improve quality — it changes *how* tutors handle pedagogical failure, aligning with Hegel's claim that mutual recognition transforms the nature of the encounter
- If H1 fails: recognition prompts improve quality but don't change strategy under stress — the improvement is surface-level, not structural
- Either way: provides empirical data on what the paper currently treats as pure theory

### [DONE] #19 — How to further test multi-agent synergy

**Feedback**: "how would we test this further?" (re: "This discrepancy means the multi-agent synergy finding should be treated as exploratory and model-specific," p. 21).

**Resolved (2026-02-08)**: Fully addressed by the 5-model A×B synergy probe (#30). Tested across 5 ego models (N=826 total), all showing negative or near-zero interaction (mean −2.2). The finding is definitively noise, not model-specific dynamics. See `notes/todo-axb-synergy-probe-2026-02-08.md`.

### [DONE] #29 — Verify cells 6,8 re-scored values with latest evals

**Feedback**: "is this true even with the latest evals?" (re: Table footnote "†Cells 6 and 8 re-scored with updated rubric... Original scores were 83.4 and 86.7; the change is minimal (+0.5, +0.6)," p. 29).

**Verified (2026-02-08)**: All factorial cell means (cells 1-8) match database exactly. Table 9 (Kimi elementary replication) values also verified. Table 8 (Nemotron elementary): original values (+4.4 recognition, +9.9 architecture, 68.0 overall, 77.3 best config) confirmed correct from Sonnet-judged data (N=40). An erroneous "correction" that mixed 7 Kimi-judged rows into the Sonnet-judged data has been reverted.

### [DONE] #40 / #44 — Double-check Superego reality testing and hallucination claims

**Feedback #40**: "double-check results, and cross-check with Freudian theory" (re: "The domain transfer findings reveal an unexpected role for the Superego: reality testing," p. 50).

**Feedback #44**: "double-check this" (re: "without it, the tutor may suggest philosophy lectures to elementary students. The +9.9 point improvement justifies the latency cost," p. 53).

**Verified (2026-02-08)**: The "philosophy lectures to elementary students" was caused by two content isolation bugs (#31), not model hallucination. Paper updated to reframe as system-level content isolation failures throughout. Superego reality-testing claim is valid—it caught these system errors regardless of source. Freudian "reality principle" framing is appropriate: Superego enforces correspondence with external curriculum context. The +9.9 pt architecture effect on Nemotron elementary is confirmed from DB but noted as partly inflated by these bugs; Kimi replication (+3.0 pts) is more representative.

**Work**:
- [ ] Verify the +9.9 point architecture effect on domain transfer is from the Kimi replication (e87f452d), not the confounded Nemotron run
- [ ] Check whether the "philosophy lectures to elementary students" issue is truly a Superego catch or the context scoping bug (#31)
- [ ] Cross-reference Freudian "reality testing" (ego function in *The Ego and the Id*) with what the Superego actually does in our architecture
- [ ] If the "hallucination" is really the context scoping bug, soften the Superego reality-testing claim

### [DONE] #46 / #47 / #48 — Verify domain generalizability and domain confusion results

**Feedback #46**: "can we address this issue?" (model confound in active control, p. 55).
**Feedback #47**: "double-check results and analysis" (domain generalizability, p. 57).
**Feedback #48**: "double-check this" (domain confusion, p. 58).

**Verified (2026-02-08)**:
- Domain generalizability (e87f452d, Kimi, N=60 Opus-judged): Table 9 values verified against DB. Recognition +9.9, architecture +3.0.
- "Domain confusion" confirmed as the context scoping bug (#31), not model confusion. Paper §6.6, §7.3, §8.1 all updated to describe as content isolation failures.
- §8.1 limitations now explicitly distinguish system-level content isolation bugs from model-level failures.
- Nemotron elementary (79b633ca, N=40 Sonnet-judged): Table 8 values verified (+4.4, +9.9, 68.0, 77.3). An erroneous correction that mixed judge models has been reverted.
- Model confound in active control (#46): addressed in §8.1 with same-model analysis and recommendation to re-run on Kimi.

---

## LOW PRIORITY

### [ ] #4 — Make paper images larger

**Feedback**: "Make images larger (text is illegible)" (p. 1).

**Work**:
- [ ] Increase figure width in pandoc/LaTeX output (currently default width)
- [ ] Options: add `width=\textwidth` to figure includes, or regenerate PNGs at higher resolution
- [ ] Test PDF rendering at print size to verify legibility

---

## TEXT FIXES APPLIED [DONE]

The following items were addressed as text edits to the paper:

- [x] #1 — Bigger introduction to models and rationale
- [x] #2 — Justify Hegel as curriculum (UIUC course context)
- [x] #3 — Fix informal language ("it's", "we're")
- [x] #5 — Discuss Freud-in-AI studies alongside Big Five (cite Magee et al. "Structured like a Language Model")
- [x] #6 — Describe paper structure in intro, summarize in conclusion
- [x] #7 — Introduce base prompt, distinguish enhanced/action variants
- [x] #8 — Add more recent work than 2014 in §2.1
- [x] #9 — Cite Karpathy "Animals vs Ghosts" blog post (added to bibtex)
- [x] #10 — Cite additional Anthropic papers
- [x] #11 — Address how Hegel thinks self-consciousness emerges through impasse
- [x] #12 — Fix incomplete sentence (architectural features)
- [x] #13 — Fix hyphens/whitespace for proper LaTeX lists
- [x] #14 — Justify "irrational superego" (cite Magee et al. "Structured" re: id baked into model)
- [x] #15 — Cite GAN references (Goodfellow et al. 2014) and related models
- [x] #16 — Clarify whether we do AI-powered dialectical negotiation in §4.1
- [x] #17 — Clarify "ratio=0.87" meaning (p. 18)
- [x] #18 — Check/justify memory and recognition model choices (p. 19)
- [x] #20 — Explain why complementary analyses were conducted (p. 21)
- [x] #21 — Verify/update "some early runs used Claude Sonnet 4.5" claim
- [x] #22 — Describe evaluation pipeline for producing and judging data
- [x] #23 — Explain why Total Attempts and Scored differ; typical failure causes
- [x] #24 — Describe judge prompts; address Kimi ceiling effects on actionability
- [x] #25 — Clear explanation of enhanced vs active control and why both exist
- [x] #27 — Move design note earlier; clarify active control vs enhanced rationale
- [x] #28 — Rename unified/psycho to Single/Multi for consistency
- [x] #32 — Explain phronesis and how it differs from rule-based reasoning
- [x] #34 — Spell out shifts between runs in Table 44 (dynamic rewrite)
- [x] #35 — Fix "trained on curriculum content" language (models are not trained)
- [x] #36 — Spell out what cells 6 and 8 are and why they are compared
- [x] #37 — Address how dialectical impasse is overcome in §7.1
- [x] #39 — Connect fractions/procedural content to Hegel's self-consciousness development
- [x] #41 — Fix "content domain differs from training data" language
- [x] #43 — Discuss AI personality relationally in context of strategic anthropomorphism
- [x] #49 — Move Appendix E (Revision History) to end of paper
