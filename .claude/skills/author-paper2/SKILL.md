---
name: author-paper2
description: Reproducible recipe for authoring Paper 2.0 sections with maximum traceability
argument-hint: "<section> [--verify-only] [--claims-only] [--diff]"
allowed-tools: Bash, Read, Grep, Glob, Write, Edit, Agent
---

Reproducible authoring recipe for Paper 2.0 sections that do not depend on evaluation runs.

Every claim in Paper 2.0 must be traceable. This skill enforces a **claim discipline** where every paragraph is annotated with its evidence status, and every quantitative or theoretical claim gets a corresponding provable-discourse YAML entry.

## Parse Arguments

- Positional arg is the **section** to author (see Section Map below)
- `--verify-only` — skip authoring, just verify existing claims for the section
- `--claims-only` — generate provable-discourse YAML stubs without writing prose
- `--diff` — show what changed vs. Paper 1.0 for this section
- `--outline` — generate structured outline only, no prose
- No argument — show the full section map and ask which to author

## Section Map (Data-Independent)

These sections can be authored WITHOUT running any evaluations:

| Section | Name | Source Materials | Status |
|---------|------|-----------------|--------|
| `abstract` | Abstract (framework only) | strategy.md, Paper 1.0 abstract | Framework draft |
| `s1` | Introduction: The Explanatory Gap | Paper 1.0 §1, strategy.md | Reframe needed |
| `s2` | Related Work (expanded) | Paper 1.0 §2, new refs | Add process tracing lit |
| `s3` | Theoretical Framework: From Recognition to Mechanisms | section-3-theoretical-reframing.md | **Draft exists** |
| `s4` | System Architecture (condensed) | Paper 1.0 §4, tutor-agents.yaml, code | Condense + observability focus |
| `s5` | Methodology: Process Tracing + Quantitative Confirmation | section-5-methodology.md | **Draft exists** |
| `s7` | Discussion: Apparatus as Method | section-7-apparatus-as-method.md | **Draft exists** |
| `s8` | Limitations | Paper 1.0 §8, bug-registry.md | Update needed |
| `s9` | Conclusion | strategy.md | New draft |
| `refs` | References (bibliography additions) | references.bib | Add new refs |
| `all` | Full pass over all data-independent sections | All of the above | Sequential |

**Data-DEPENDENT sections (NOT authored by this skill):**
- `s6.1`–`s6.6` (Results) — require completed evaluation runs
- Tables and figures with empirical numbers
- Any claim with a `[PENDING]` tag that references future data

## Claim Discipline

### The Five Evidence States

Every claim in Paper 2.0 prose MUST be annotated (in markdown comments) with one of:

| Tag | Meaning | Provable Discourse? |
|-----|---------|---------------------|
| `<!-- [VERIFIED: source] -->` | Backed by existing code, config, or infrastructure | Yes — assertion passes now |
| `<!-- [THEORETICAL: derivation] -->` | Derived from theory; testable prediction | Yes — assertion type `theoretical` |
| `<!-- [PILOT: runId, finding] -->` | From Paper 1.0 frozen pilot data | Yes — epoch: pilot |
| `<!-- [PENDING: what-is-needed] -->` | Needs future data/runs to verify | Yes — assertion type `pending` |
| `<!-- [DESIGN: rationale] -->` | Architectural/design decision (not empirical) | No — documented in code |

### Claim Annotation Rules

1. **Every paragraph** that makes a factual, theoretical, or empirical claim gets at least one annotation
2. **Quantitative claims** (N=X, d=Y, p<Z) MUST have a provable-discourse entry
3. **Theoretical predictions** MUST be phrased as testable hypotheses with explicit observable predictions
4. **Cross-references to Paper 1.0** MUST cite the specific section, table, and run ID
5. **Architectural claims** ("the system does X") MUST reference specific code paths
6. **No unattributed claims** — if you can't tag it, it shouldn't be in the paper

### Provable Discourse YAML Format

For each new claim, generate an entry in this format for `config/provable-discourse-mechanisms.yaml`:

```yaml
- id: paper2.<section>.<claim_name>
  description: "<human-readable description>"
  source_keys:
    - "<kind>|<priority>|<label>"   # kind: n, stat, theoretical, design
  statement:
    pattern: "<regex matching the claim text in paper>"
    flags: "i"
    min_occurrences: 1
  evidence:
    type: <adapter_type>           # See adapter types below
    # ... adapter-specific config
  assertion:
    op: <operator>                  # eq, approx, gte, lte, exists, theoretical, pending
    expected: <value>
  remediation:
    - "<what to do if this claim fails>"
  tags: [<section>, <mechanism>, <evidence_state>]
```

**Adapter types for data-independent claims:**
- `code_path` — Verify a code path exists (file + function/class)
- `config_exists` — Verify a YAML config field exists
- `theoretical` — No automated check; marks a testable prediction
- `pending` — Marks a claim waiting for future data
- `manifest_total` — Check paper-manifest.json counts
- `db_count` — Count rows matching filters
- `cross_reference` — Verify another claim still passes

## Per-Section Authoring Recipe

### General Workflow (for each section)

1. **READ SOURCE MATERIALS** — Read all files listed in the Source Materials column
2. **READ EXISTING PROSE** — Read the corresponding section in `docs/research/paper-full.md`
3. **READ EXISTING CLAIMS** — Read `config/provable-discourse-mechanisms.yaml` for existing claim entries
4. **IDENTIFY DELTA** — What must change from Paper 1.0 → Paper 2.0?
5. **DRAFT OUTLINE** — Section headers, key claims per subsection, evidence state for each
6. **WRITE PROSE** — With inline claim annotations
7. **GENERATE CLAIMS** — Provable-discourse YAML entries for new claims
8. **VERIFY** — Run `node scripts/validate-provable-discourse.js` to check no existing claims broke

### Section-Specific Recipes

---

#### `s1` — Introduction: The Explanatory Gap

**Source materials:**
- `docs/research/paper-full.md` §1 (lines 22-71)
- `notes/paper-2-0/strategy.md` (The Pivot, What Remains Unexplained)

**Reframing delta from Paper 1.0:**
- Paper 1.0 intro asks "does recognition produce measurable differences?" → Paper 2.0 asks "through what mechanisms?"
- Keep: recognition theory motivation, sycophancy connection, architecture overview
- Add: explanatory gap framing — "finding differences ≠ understanding mechanisms"
- Add: three-mechanism preview (calibration, error correction, adaptive responsiveness)
- Add: process tracing methodology preview
- Add: apparatus-as-method preview
- Update: contributions list (shift from effect sizes to mechanism accounts)
- Retain: all Paper 1.0 empirical claims as `[PILOT]` references

**Key claims to annotate:**
1. Recognition produces measurable differences → `[PILOT: factorial, d=1.11]`
2. Three separable mechanisms → `[THEORETICAL: section-3-theoretical-reframing.md]`
3. Architecture observability enables process tracing → `[VERIFIED: trace logging code]`
4. Provable discourse as method → `[VERIFIED: validate-provable-discourse.js]`

**Traceability checks:**
- Every Paper 1.0 number cited must have a `[PILOT]` tag with run ID
- Every theoretical claim must cross-reference §3
- Every methodology claim must cross-reference §5

---

#### `s2` — Related Work (expanded)

**Source materials:**
- `docs/research/paper-full.md` §2 (all subsections)
- `docs/research/references.bib`

**Reframing delta from Paper 1.0:**
- Retain: §2.1 (AI tutoring), §2.2 (prompt engineering), §2.3 (LLM-as-judge), §2.4 (Drama Machine), §2.5 (sycophancy)
- Add §2.6: **Process tracing in social science** — Bennett & Checkel (2015), Beach & Pedersen (2019), causal process tracing methodology
- Add §2.7: **Mechanism-oriented AI research** — interpretability (what prompts do inside models), mechanistic interpretability, causal mediation in LLMs
- Add §2.8: **Adaptive tutoring mechanism research** — what is known about HOW tutoring works, not just whether it works
- Expand §2.5: **Self-correction literature** — Kamoi et al. already cited, add Huang et al. (2024) survey, connect to error correction mechanism
- Expand §2.2: **Intersubjective prompts** — distinguish from Constitutional AI, persona prompts, chain-of-thought

**Key claims to annotate:**
1. Process tracing methodology origin → `[THEORETICAL: Bennett & Checkel 2015]`
2. Self-correction requires external feedback → `[VERIFIED: Kamoi et al. citation]`
3. No prior work traces mechanisms INSIDE AI tutoring → `[THEORETICAL: literature gap]`

**Traceability checks:**
- Every citation must exist in `references.bib`
- Every "gap in the literature" claim must be qualified ("to our knowledge")
- New references must be added to `references.bib` before writing prose

---

#### `s3` — Theoretical Framework: From Recognition to Mechanisms

**Source materials:**
- `notes/paper-2-0/section-3-theoretical-reframing.md` (**primary draft**)
- `docs/research/paper-full.md` §3 (Paper 1.0 framework)

**Reframing delta from Paper 1.0:**
- Paper 1.0 §3: Hegel → pedagogy → Freud → architecture mapping
- Paper 2.0 §3: Same foundation + three testable mechanism predictions

**Subsection structure (from existing draft):**
- §3.1 The Explanatory Challenge (5 unexplained findings from Paper 1.0)
- §3.2 Three Mechanisms Predicted by Recognition Theory
  - Mechanism 1: Calibration (prompt-level)
  - Mechanism 2: Error Correction (architecture-level)
  - Mechanism 3: Adaptive Responsiveness (interaction-level)
- §3.3 The Three-Mechanism Interaction Model (ASCII diagram, separability prediction)
- §3.4 Recognition Theory Predicts the Failures (4 failure predictions)
- §3.5 Connecting Mechanisms to Recognition Theory (Hegelian concept → mechanism mapping)

**Key claims to annotate:**
1. Calibration is observable without superego → `[THEORETICAL: prediction, test with single-agent cells]`
2. Error correction requires recognition for ego receptivity → `[THEORETICAL: prediction, test with baseline multi-agent]`
3. Adaptive responsiveness is emergent → `[THEORETICAL: prediction, test with multi-turn trajectory]`
4. Cognitive overload in weak models → `[PILOT: cells 66-68, Nemotron -15 pts]`
5. Adversary over-deference → `[PILOT: cells 28-33, recognition + adversary = 54.0]`
6. Advocate ceiling → `[PILOT: recognition + advocate Δ = +0.0]`
7. Model-dependent architecture → `[PILOT: Haiku/Kimi eta² reversal]`

**Critical traceability requirement:**
Every mechanism prediction MUST state:
- The observable prediction (what we should see in the data)
- The null hypothesis (what we'd see if the mechanism doesn't exist)
- The existing evidence (from Paper 1.0 pilot, tagged `[PILOT]`)
- The missing evidence (tagged `[PENDING]`)

---

#### `s4` — System Architecture (condensed, observability focus)

**Source materials:**
- `docs/research/paper-full.md` §4
- `config/tutor-agents.yaml` (cell definitions)
- `services/evaluationRunner.js` (execution flow)
- `services/learnerTutorInteractionEngine.js` (bilateral architecture)

**Reframing delta from Paper 1.0:**
- Condense: less detail on implementation, more on observability
- Add: **Trace logging architecture** — what is recorded at each step
- Add: **Mechanism isolation conditions** — how the 2×2 factorial maps to mechanism tests
- Add: **Observability for process tracing** — every ego→superego→ego_revised chain is logged

**Key claims to annotate:**
1. Every ego-superego exchange is logged → `[VERIFIED: code path in tutor-core runDialogue()]`
2. Per-turn scores are recorded → `[VERIFIED: evaluationStore.js updateResultScores()]`
3. Trace contains agent, action, detail, turnIndex → `[VERIFIED: trace schema]`
4. 2×2 factorial maps to mechanism isolation → `[DESIGN: section-6-results-framework.md Table]`

**Traceability checks:**
- Every "the system does X" claim must reference a specific file:line
- Architecture diagrams must match actual code flow (check against tests)

---

#### `s5` — Methodology: Process Tracing + Quantitative Confirmation

**Source materials:**
- `notes/paper-2-0/section-5-methodology.md` (**primary draft**)
- `config/evaluation-rubric.yaml` (v2.2 rubric)
- `config/evaluation-rubric-deliberation.yaml` (deliberation rubric)
- `scripts/classify-superego-critiques.js` (taxonomy classifier)
- `scripts/analyze-trajectory-curves.js` (trajectory analysis)

**Subsection structure (from existing draft):**
- §5.1 Superego Critique Taxonomy (classification method)
- §5.2 Revision Delta Analysis (ego v1 → v2 comparison)
- §5.3 Turn-by-Turn Trajectory Analysis (adaptation curves)
- §5.4 The Measurement Paradox as Methodology
- §5.5 Cross-Model Mechanism Replication
- §5.6 Provable Discourse Extension (new adapter types)
- §5.7 The Apparatus as Method (reflexive methodology)

**Key claims to annotate:**
1. Taxonomy uses 10 categories → `[VERIFIED: classify-superego-critiques.js taxonomy]`
2. Trajectory uses linear regression per conversation → `[VERIFIED: analyze-trajectory-curves.js]`
3. 4 new provable-discourse adapter types → `[DESIGN: provenance-plan.md]`
4. Rubric v2.2 consolidates 14→8 dims → `[VERIFIED: config/rubrics/v2.2/ files]`
5. Each hypothesis H1-H5 → `[PENDING: need balanced multi-turn data under v2.2]`

**Traceability checks:**
- Every analysis method must reference the script that implements it
- Every hypothesis must be stated in testable form (prediction, null, test statistic)
- Rubric dimension names must match actual YAML config

---

#### `s7` — Discussion: Apparatus as Method

**Source materials:**
- `notes/paper-2-0/section-7-apparatus-as-method.md` (**primary draft**)
- `notes/major-bugs.md` (9 corrections narrative)
- `scripts/validate-provable-discourse.js` (provable discourse)
- `tests/` directory (test suite as analytical provenance)

**Key argument structure:**
1. Error correction parallel: architecture ↔ research process
2. Nine corrections as superego interventions (table from draft)
3. Provable discourse as transferable method
4. Rubric iteration as construct refinement
5. Test suite as analytical provenance
6. Reflexive structure: methodology illuminates subject matter

**Key claims to annotate:**
1. 354 claims tracked by provable discourse → `[VERIFIED: validate-provable-discourse.js output]`
2. 9 post-extraction corrections → `[VERIFIED: major-bugs.md + paper-full.md revision history]`
3. 44/44 provenance tests passing → `[VERIFIED: tests/provenance.test.js]`
4. Rubric v1→v2→v2.1→v2.2 iteration → `[VERIFIED: config/rubrics/ version history]`
5. Reflexive structure argument → `[THEORETICAL: meta-methodological claim]`

**Traceability checks:**
- N-counts for provable discourse must be current (run validator)
- Bug descriptions must match `notes/major-bugs.md`
- Test count must match actual `npm test` output

---

#### `s8` — Limitations

**Source materials:**
- `docs/research/paper-full.md` §8
- `notes/paper-2-0/strategy.md` (Model transience, synthetic learners)
- `notes/major-bugs.md` (known issues)

**Key limitations to address:**
1. Synthetic learners → mechanisms traced in tutor, not learner
2. LLM-as-Judge → mechanism claims depend on judge accuracy
3. Model transience → findings are model-version-specific
4. Process tracing with LLMs → internal states are generated, not "real"
5. Single-system study → transferability to other architectures unclear
6. Rubric iteration → v2.2 not yet validated on large-scale data
7. Pilot data quality → 4 bugs discovered and fixed (transparent)

---

#### `s9` — Conclusion

**Source materials:**
- `notes/paper-2-0/strategy.md` (final paragraph)
- All section drafts (for summary)

**Structure:**
1. From "recognition matters" to "here's how recognition works"
2. Three mechanisms, separable and testable
3. The apparatus as contribution
4. Future work: human learners, longer timescales, other domains

---

#### `refs` — References

**Source materials:**
- `docs/research/references.bib`

**New references to add for Paper 2.0:**
- Process tracing: Bennett & Checkel (2015), Beach & Pedersen (2019)
- Mechanism research in AI: relevant interpretability papers
- Adaptive tutoring mechanisms: VanLehn (2011), Graesser et al.
- Self-correction survey: Huang et al. (2024)
- Rubric literature: GuideEval, ICAP framework, MathTutorBench

**Verification:** Every `@cite_key` in prose must resolve in `references.bib`

---

## Output Format

For each section, produce THREE outputs:

### 1. Section Prose (written to a staging file)

Write to `notes/paper-2-0/drafts/section-{N}-draft.md`, NOT directly to paper-full.md.

The staging file contains:
- Section heading and subsection structure
- Full prose with inline claim annotations as HTML comments
- `<!-- TODO: [PENDING] ... -->` markers for data-dependent content

### 2. Claim Registry (appended to provable-discourse-mechanisms.yaml)

New YAML entries for claims introduced in this section.
Before appending, read the existing file and check for ID conflicts.

### 3. Traceability Report (printed to console)

```
=== Traceability Report: Section {N} ===

Claims by evidence state:
  VERIFIED:    {count} (backed by code/config/infrastructure)
  THEORETICAL: {count} (testable predictions)
  PILOT:       {count} (Paper 1.0 frozen data)
  PENDING:     {count} (need future data)
  DESIGN:      {count} (architectural decisions)

Cross-references:
  To other sections: {list}
  To Paper 1.0:      {list of §/Table refs}
  To code:           {list of file:line refs}
  To config:         {list of YAML paths}

Validation:
  Provable discourse: {pass/fail count}
  Missing annotations: {list of uncovered paragraphs}
  Stale references:    {list}
```

## Verification Mode (`--verify-only`)

Skip authoring. Instead:

1. Read the existing draft (if any) in `notes/paper-2-0/drafts/`
2. Read Paper 1.0 corresponding section
3. Read provable-discourse-mechanisms.yaml
4. Run: `node scripts/validate-provable-discourse.js`
5. Check every `[PILOT]` claim against the DB
6. Check every `[VERIFIED]` claim against the referenced code path
7. Report: which claims pass, which fail, which are stale

## Full Authoring Sequence (`all`)

When invoked with `all`, process sections in this order:

1. `s3` — Theoretical framework (establishes the mechanisms; everything else depends on this)
2. `s1` — Introduction (references §3 for mechanism preview)
3. `s4` — Architecture (referenced by §3 for observability claims)
4. `s5` — Methodology (references §3 for hypotheses, §4 for data sources)
5. `s2` — Related work (positioned by §3's theoretical gaps)
6. `s7` — Discussion (references all previous sections)
7. `s8` — Limitations
8. `s9` — Conclusion
9. `abstract` — Last (summarizes everything)
10. `refs` — Bibliography additions

Between each section, run `node scripts/validate-provable-discourse.js` to catch regressions.

## Safety Rules

- **NEVER modify `docs/research/paper-full.md` directly** — write to staging files only
- **NEVER fabricate data** — every number must come from DB, code, or Paper 1.0 with citation
- **NEVER write `[VERIFIED]` for a claim you haven't checked** — read the code/config first
- **NEVER claim mechanism evidence exists** if it's tagged `[PENDING]` — state what's needed
- **Every provable-discourse entry must have a remediation step** — what to do when it fails
- **Preserve Paper 1.0 framing in `[PILOT]` references** — don't retroactively reinterpret frozen data

## Quick Reference: Existing Drafts

| File | Section | Quality |
|------|---------|---------|
| `notes/paper-2-0/section-3-theoretical-reframing.md` | §3 | Good — needs claim annotations |
| `notes/paper-2-0/section-5-methodology.md` | §5 | Good — needs claim annotations + script refs |
| `notes/paper-2-0/section-6-results-framework.md` | §6 framework | Evidence map only (no prose) |
| `notes/paper-2-0/section-7-apparatus-as-method.md` | §7 | Good — needs N-count verification |
| `notes/paper-2-0/strategy.md` | Overview | Strategy doc, not prose |
