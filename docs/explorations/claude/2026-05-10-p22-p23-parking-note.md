# P2.2 / P2.3 — parked at cell_119, resume next week

**Parked:** 2026-05-10 ~10:35 CDT
**Reason:** Weekly token allowance pressure. Stopped after cell_119 completion to preserve quota for the rest of the week.
**Companion docs:** `p2-followup-pre-registration.md` (locked design), `p21-N24-results.md` (P2.1 results).

---

## What completed

| Cell | Status | Rows | LOG_DIR |
|---|---|---|---|
| cell_118_state_policy_minimal_profile | **Done** (32/32, 0 errored) | 32 | `~/.p22-p23-fanout-MmVtv` |
| cell_119_state_policy_no_misconceptions | **Done** (32/32, 0 errored) | 32 | `~/.p22-p23-fanout-MmVtv` |

cell_118 run_ids: `eval-2026-05-10-24268254`, `eval-2026-05-10-556b5243`, `eval-2026-05-10-8aedb51d`, `eval-2026-05-10-8fb6e098`
cell_119 run_ids: `eval-2026-05-10-201b9ef3`, `eval-2026-05-10-72b7b862`, `eval-2026-05-10-bf4821c9`, `eval-2026-05-10-d144de7a`

Strategy-shift exports: `exports/p22-cell118.json`, `exports/p22-cell119.json`, `exports/p22-cell110-baseline.json` (N=23, May 5 baseline run `eval-2026-05-05-486d7d1e`).

### Headline: dose-response reversal of H2.1

| Cell | n | strict shift% | family% | fields kept |
|---|---|---|---|---|
| cell_110 (full state, May 5 baseline) | 23 | **47.8%** (11/23) | 87.0% (20/23) | confidence, misconceptions, agencySignal, zpdEstimate, lastEvidence |
| cell_119 (no misconceptions) | 32 | **53.1%** (17/32) | 84.4% (27/32) | confidence, agencySignal, zpdEstimate, lastEvidence |
| cell_118 (minimal) | 32 | **68.8%** (22/32) | 96.9% (31/32) | confidence, lastEvidence |

Pre-reg H2.1 predicted: `cell_110 ≥ cell_119 ≥ cell_120 ≥ cell_118` with `cell_110 - cell_118 ≥ 15pp`. Observed (with cell_120 still parked): `cell_118 (68.8) > cell_119 (53.1) > cell_110 (47.8)` — **graded inversion**. Each field removal monotonically increases strict_shift, with the largest jump (+15.7pp) from cell_119 → cell_118 (dropping `agencySignal + zpdEstimate`). The artifact-free comparison (cell_118 vs cell_119, both N=32, same day, same model routing) shows +15.7pp by itself, so the reversal is not entirely a baseline-contamination artifact. The cell_110 contamination question still applies to the headline 21pp gap; see "Open questions" below.

---

## Graded results (Option-2 adaptive grader, 2026-05-10)

Bespoke 4-dim graded rubric (1-5 each) applied to all 87 rows via `scripts/grade-adaptive-dialogue.js` (codex CLI / GPT-5, no marginal $). The graded path **complements** the binary `strategy_shift_correctness` signal: binary asks "did the right family fire at trigger+window?"; graded asks "given an action fired, was it well-executed, calibrated, and pedagogically coherent?"

### Per-cell means

| Cell | n | trigger | execution | quality | coherence | overall | binary shift% |
|---|---|---|---|---|---|---|---|
| cell_110 (full state, May 5) | 23 | **4.26** | **4.30** | 3.96 | 3.61 | 4.03 | 47.8% |
| cell_119 (no_misc) | 32 | 4.09 | 3.78 | 4.25 | 4.13 | 4.06 | 53.1% |
| cell_118 (minimal) | 32 | 4.34 | 4.28 | **4.41** | **4.34** | **4.34** | 68.8% |

### Distribution of `strategy_execution` (the dim that diverges most across cells)

| Cell | s1 | s2 | s3 | s4 | s5 | ≤3 | ≥4 |
|---|---|---|---|---|---|---|---|
| cell_110 (N=23) | 0 | 0 | 1 | 14 | 8 | **4.3%** | 95.7% |
| cell_119 (N=32) | 1 | 6 | 4 | 9 | 12 | **34.4%** | 65.6% |
| cell_118 (N=32) | 0 | 5 | 1 | 6 | 20 | 18.8% | 81.2% |

### Reading

1. **Graded and binary agree on cell_118's win.** cell_118 leads on overall graded mean (4.34) and on the binary signal (68.8%). It also has the highest count of "5"s on execution (20/32). The minimal profile is genuinely the best architecture here.
2. **Graded and binary DISAGREE on cell_110 vs cell_119 ordering.** Binary: cell_119 (53.1%) clearly above cell_110 (47.8%). Graded overall: tied (4.06 vs 4.03). On `strategy_execution` specifically, cell_110 (4.30) substantially beats cell_119 (3.78), the largest single-dim gap in the whole table. **The binary signal was hiding heterogeneity** — cell_119 fires the right family more often, but executes it less crisply when it does.
3. **cell_119 has a heavy left tail on execution** (11/32 rows score ≤3 vs cell_110's 1/23 and cell_118's 6/32). Removing `misconceptions` while keeping `agencySignal+zpdEstimate` doesn't just fail to match the minimal profile — it actively destabilises strategy execution in roughly a third of trials. cell_119 is **worse than cell_110 on the dimension the binary signal can't measure**.
4. **cell_110 is consistent but capped.** Best trigger/execution scores, but worst quality (3.96) and coherence (3.61). The "full state" architecture picks well but produces bloated or muddied responses — the policy is good, the prose is noisy.
5. **cell_118 is balanced.** Top scores on quality (4.41) and coherence (4.34); equal to or slightly above cell_110 on the other two. The minimal profile doesn't trade speed of recognition for quality of execution; it gets both.

### Implication for cell_120 (parked)

Pre-reg dose-response prediction (`cell_110 ≥ cell_119 ≥ cell_120 ≥ cell_118` on binary) still falsified — the graded data sharpens, not softens, the inversion. cell_120's pre-reg role (does dropping `agencySignal` alone recover most of cell_118's binary gain?) now has an additional graded dimension: **does cell_120 keep execution quality up, the way the minimal profile does, or does it inherit cell_119's left-tail instability?**

Updated prediction for resume: if `agencySignal` alone is the destabilising field, cell_120 (drops it, keeps `misconceptions+zpdEstimate`) lands near cell_118 on both binary AND graded `execution`. If `zpdEstimate` is doing the work, cell_120 looks like cell_119.

### Limits of this analysis

- N=23 for cell_110 vs N=32 for the others; cell_110 confidence intervals are wider.
- ~~Single judge (codex CLI / GPT-5); no inter-rater check yet.~~ **Inter-rater check done 2026-05-11** — all 87 rows re-graded by Gemini (same prompt builder `scripts/lib/adaptiveGraderPrompt.js`, same rubric, via `scripts/rejudge-adaptive-inter-rater.js`). The graded *overall* cell ordering survives (cell_118 > cell_119 > cell_110 under both judges); absolute-score agreement is only fair (pooled QWκ=.35, Pearson r=.44, exact 43%, within-1 91%, Gemini ~0.56pt more lenient); the `strategy_execution` left-tail story does **not** survive (Gemini ceiling effect — cell_119's 11/32 ≤3 collapses to 2/32). Folded into `paper-full-2.0.md` §5.12.4 (v3.0.66). Report: `exports/adaptive-inter-rater-2026-05-11.md`.
- Grader version `1.0`; no rubric revision after seeing the first ~10 rows. If a re-grade is wanted with a tweaked rubric, increment `GRADER_VERSION` in the script and use `--overwrite`.

Raw per-row scores are in `evaluation_results` columns `adaptive_trigger_recognition`, `adaptive_strategy_execution`, `adaptive_strategy_quality`, `adaptive_pedagogical_coherence`, with reasoning in `adaptive_grader_reasoning` (JSON). Batch log: `/tmp/grade-adaptive-logs/batch1.log`.

### Engineering vs noise — what's actually driving the result?

Three competing explanations for the cell_118 > cell_110 finding. Listed roughly in the order I currently weight them. **Original weights: ~55% real effect / ~25% engineering artefact / ~20% small-N noise. Updated 2026-05-11 after the inter-rater rejudge** — the graded *overall* ordering replicated under a second judge (Gemini), nudging the headline-ordering weights to roughly **~65% real / ~20% artefact / ~15% small-N**; but the `strategy_execution` left-tail sub-claim is now GPT-5-only (Gemini's ceiling effect can't resolve it), so confidence in *that specific mechanism story* is lower than it was.

**Pointing toward "this is a real effect":**

1. Direction consistent across binary and graded paths. Two independent measurement systems agree on cell_118 > cell_119 and cell_118 > cell_110. Harder to write off as sampling noise than a single-metric result.
2. The execution-dim distribution shift is clean (not just a mean difference). cell_119's left tail (11/32 ≤3) vs cell_110's (1/23) is a categorical change in error mode — not the shape you'd expect from sampling noise alone. **(Caveat 2026-05-11: this distribution shift is GPT-5-only. The Gemini rejudge compresses almost everything to 4–5 and shows no such tail — cell_119's ≤3 count drops to 2/32. Either the tail is a GPT-5 idiosyncrasy or Gemini's ceiling effect can't see it; this data can't distinguish. The point above is correspondingly weaker.)**
3. A priori plausible from LLM literature. Categorical structured context (named misconceptions, fixed-vocab agency tags) makes LLMs more rigid; prose context (lastEvidence) is the format they handle best.

**Pointing toward "too much engineering" (most worrying):**

1. **The graded rubric was written after the binary results were known.** Claude wrote `scripts/grade-adaptive-dialogue.js` having already seen cell_118's binary lead. The four dimensions were chosen to be orthogonal to the binary signal, but the rubric is not blind — so the graded path does not fully replicate the result independently.
2. **`expected_strategy_shift` annotations are experimenter-defined.** They encode our intuition about correct moves, presumably shaped by inspecting cell_110 dialogues. The binary metric is implicitly calibrated to the failure modes we saw in cell_110. Minimal-state cells could win partly because they produce different errors than the ones we calibrated against.
3. ~~**Single judge for the graded path; no inter-rater reliability check.**~~ **Partly addressed 2026-05-11.** Gemini second-judge rejudge of all 87 rows: graded *overall* cell ordering replicates (cell_118 > cell_119 > cell_110 under both judges), so the headline isn't a single-judge artefact. But agreement is only fair (pooled QWκ=.35), so absolute graded *levels* aren't reliable; and GPT-5's `strategy_execution` left-tail on cell_119 doesn't replicate (Gemini ceiling effect). Still unaddressed: the rubric was non-blind for *both* judges (same rubric) — point 1 above stands. GPT-5 may still have preferences (brevity, decisive tone) that align with what the minimal profile produces — but if so, an independent vendor's judge with very different idiosyncrasies shares the bias on the *ordering*, which is the relevant claim.

**Pointing toward "small N":**

1. Wilson 95% CIs overlap substantially: cell_118 binary 22/32 = 47%-82%, cell_110 11/23 = 28%-68%. By inferential standards, this is a single weekend of evidence.
2. cell_110 N=23 is the weakest leg of the table — one fan-out, May 5, not replicated.
3. Effect could plausibly halve on replication. Not the same as disappearing, but it would change the headline from "minimal beats full by 21pp" to "minimal beats full by ~10pp."

**Cheapest checks that move the needle:**

| Check | Wallclock | Addresses | Status |
|---|---|---|---|
| Rejudge the existing 87 rows with a second judge (Gemini via CLI bridge) | ~25 min actual | Engineering-artefact (single-judge) | **DONE 2026-05-11** — `exports/adaptive-inter-rater-2026-05-11.md`. Qualified pass: graded *overall* ordering replicates; agreement fair (QWκ=.35); execution-left-tail sub-claim GPT-5-only |
| One more N=32 cell_110 run under fresh model state | ~60 min | Small-N for the weakest leg | not done |
| cell_120 (already in plan) | ~60 min | Field-isolation mechanism story | parked |

The rejudge (done 2026-05-11) was the highest-value single addition and it landed a **qualified pass** — the comparative ordering replicated under an independent vendor's judge, the execution-tail sub-claim did not, and absolute-score agreement is only fair. It does *not* close the rubric-not-blind concern (same rubric for both judges). Running the other two would still be the strongest validation of the small-N and field-isolation questions respectively.

---

## What we can actually conclude about the state-machine arc

Stepping back from cell-by-cell results to the broader architectural question. Synthesis as of 2026-05-10:

### Defensible findings

1. **Bilateral ToM machinery adds nothing measurable.** P2.1 was a clean null on N=24 across four v2 cells. The bilateral elaboration over recognition_only didn't show up in `strategy_shift_correctness`. Real finding — negative, but real.
2. **Within the state machine, less learner state is more.** P2.2 shows cell_118 (minimal) beats cell_110 (full) on both binary and graded scoring — and the graded *overall* ordering (cell_118 > cell_119 > cell_110) replicates under an independent second judge (Gemini, 2026-05-11), so it is not a single-judge artefact. Caveats in the engineering-vs-noise section above; in particular the `strategy_execution`-left-tail sub-story is GPT-5-only and the cross-judge absolute-score agreement is only fair. Within the architectural family, simpler wins.
3. **The trap-scenario methodology itself works.** Externally-defined `expected_strategy_shift` + counterfactual replay + binary correctness gave us a measurable phenomenon to study. That methodology is a contribution, distinct from the architecture it was used to test.

### What is **not** established

1. **The state machine has never been tested against the dialogue engine.** The trap-scenario suite (`config/adaptive-trap-scenarios.yaml`) was never run through tutor-core's dialogue engine. Cells 1-99 (dialogue engine) all use `config/suggestion-scenarios.yaml` — zero overlap with the trap suite. The id-director architecture (cells 101-109) has thin overlap: cell_106 N=6 via `scripts/run-id-director-trap-pilot.js`.

    **A second discovery sharpens this** (2026-05-10): the A13 pre-reg's design table (`docs/explorations/claude/2026-05-01-a13-pre-registration.md`) specifies C1 (cell_111) and C2 (cell_112) as `runner: standard` cells — i.e., dialogue-engine baselines on trap scenarios. The pre-reg doc reads as if the comparison exists. **But the YAML and the running code disagree with the pre-reg.** Both cell_111 and cell_112 carry `runner: adaptive` in `config/tutor-agents.yaml` (lines ~1234 and ~1257); `services/adaptiveTutor/graph.js` dispatches them through the LangGraph runner with `architecture: recognition_only` (single LLM call, no profile, no superego, no constraints) and `architecture: ego_superego` (two-pass tutor but no profile, no constraints) respectively. Cell_113 (`state_policy_with_validator`) and cell_110 (`state_policy`) are the richer LangGraph variants. **All four A13 conditions are LangGraph ablations.** The "dialogue engine vs state machine" head-to-head implied by the pre-reg was never actually run.

    So: we can compare cells within the LangGraph family freely; we have a thin (N=6) comparison against id-director; we have no comparison against the dialogue engine at any N. Any claim about architectural superiority for the state machine has to either (a) re-run cell_106 at N=32 (~60 min wallclock, no new engineering — `scripts/run-id-director-trap-pilot.js` already exists), or (b) build a dialogue-engine-on-trap-scenarios adapter (see "Closing the dialogue-engine gap" section below for the run plan).

2. **The mechanisms we hypothesised mostly aren't doing the work we thought.** Architectural commitments were: rich externalized learner state, programmatic policy actions, counterfactual replay. P2.1 falsified the bilateral elaboration. P2.2 reversed the prediction about state richness. The counterfactual-divergence numbers were modest in A13. Each individually is a finding; collectively they suggest the additions don't behave the way the design assumed.

### How these findings fold into `paper-full-2.0.md`

All of the above belongs in the single canonical paper, not a spin-off. The substantive moves are:

- **Reframe the contribution** from "we built a better tutor" toward "we built an experimental harness — externalized state, programmatic policy, counterfactual replay, trap scenarios with pre-registered expected shifts — and used it to probe what does and doesn't carry weight inside an adaptive-tutor architecture." The harness *is* a contribution; the architectural elaborations it allowed us to test produced mostly null / negative / inverted results, which is also a contribution. Both go into the same paper.
- **Add a methodology section** that documents the procedural twists honestly (see "Methodology section: procedural drift" below for the specific narrative the section needs to carry).
- **Add a scope-narrowing limitations subsection** acknowledging: (i) the dialogue-engine baseline on trap scenarios was never run, so cross-architecture claims are limited to LangGraph internals plus a thin id-director comparison at N=6; (ii) the A13 pre-reg's `runner: standard` cells were not actually run with the standard runner; (iii) the bespoke graded rubric was not blinded to binary-shift results.
- **Replace any prior abstract / intro language** about "the state machine fixes the adaptive-responsiveness null" with the more limited claim: "within the LangGraph adaptive family, full-state configurations show strategy shifts on trap scenarios that are absent for the simpler `recognition_only` variant; the comparison against the dialogue engine remains open."

The exact sections to touch in `paper-full-2.0.md` are TBD — fold these as a coordinated revision after cell_120 (and ideally cell_106 N=32 + dialogue-engine baseline) close out.

### Re-prioritisation for resume

Worth doing:
- ~~**Inter-rater rejudge**~~ **DONE 2026-05-11.** Gemini second judge, all 87 rows. Result: graded *overall* ordering replicates (cell_118 > cell_119 > cell_110); agreement fair (pooled QWκ=.35, r=.44); execution-left-tail sub-claim GPT-5-only; Gemini ~0.56pt more lenient. Folded into `paper-full-2.0.md` §5.12.4 (v3.0.66). Report: `exports/adaptive-inter-rater-2026-05-11.md`. Does *not* close the rubric-not-blind concern.
- **cell_120** (~60 min). Closes the field-isolation mechanism question. Defensible as the last mechanism step.
- **Re-run cell_106 (id-director) at N=32 on the 6 trap scenarios** (~60 min, no new engineering — `scripts/run-id-director-trap-pilot.js` already exists). Gives us a real architecture-vs-architecture comparison data point (LangGraph state machine vs id-director) at adequate N. The existing N=6 is too thin to anchor any cross-architecture claim.
- **Build the dialogue-engine-on-trap-scenarios adapter and run it.** See "Closing the dialogue-engine gap" below for the full plan. This is the single most consequential addition for the paper's central claim about adaptive responsiveness, since without it we can only compare LangGraph variants to each other.

Not worth doing without rethinking:
- **cells 121, 122** (P2.3 crossover). Test a hypothesis the prior data has substantially weakened. Running them as scheduled would be sunk-cost behaviour. If they run at all, it should follow a fresh decision about what question they're now answering — not a default "next on the fan-out."

---

## Closing the dialogue-engine gap (run plan for the cross-architecture baseline)

Minimal plan to actually get a dialogue-engine baseline on the trap scenarios, so cross-architecture claims have something to lean on. Estimated total: **~half a day engineering + ~60 min wallclock + ~$5-15 LLM**, dependent on which provider runs it.

### Scope

The trap suite was designed for the LangGraph adaptive runner. A dialogue-engine baseline requires an adapter that:
- Loads `config/adaptive-trap-scenarios.yaml` (the 6 trap scenarios with `hidden.actualMisconception`, `hidden.triggerTurn`, `hidden.triggerSignal`, `expectedStrategyShift`).
- Drives a scripted learner whose turns come from the scenario's `opening_turns` plus a fixed `triggerTurn` insertion. The learner does NOT react to the tutor across turns — same simplification used by `scripts/run-id-director-trap-pilot.js`. This isolates "does the tutor recognise and respond to the trap signal" as the only measured dependent variable; the learner's behaviour is fixed across architectures, so any cross-architecture differences are tutor-side.
- Runs each tutor turn through tutor-core's existing dialogue engine (the path used by cells 1-99 — i.e., `services/evaluationRunner.js` plus the tutor-core ego/superego pipeline). The dialogue engine sees the visible learner turns only; the hidden trap metadata never reaches the tutor prompt.
- Writes a `logs/tutor-dialogues/dialogue-engine-trap-<scenario>-<ts>.json` trace in the same JSON shape the adaptive runner produces (top-level `scenario`, `original.dialogue`, `original.perTurn` — minus the LangGraph-specific `learnerProfile` and `tutorInternal.policyAction` fields, which simply won't be present).
- Persists rows to `evaluation_results` with the same column set the adaptive runner uses (`dialogue_id`, `scenario_id`, `profile_name`, `run_id`, etc.) so `scripts/analyze-strategy-shift.js` and `scripts/grade-adaptive-dialogue.js` can both score the output without modification.

### What to build

1. **New script:** `scripts/run-dialogue-engine-trap-baseline.js`. Modelled directly on `scripts/run-id-director-trap-pilot.js` (~360 lines) — substitute the id-director engine call for tutor-core's standard dialogue-engine entrypoint. Most of the structure (scenario loading, dialogue ID generation, log writing, DB persistence) carries over verbatim.

2. **New cell registration:** `cell_114_dialogue_engine_trap_baseline` (next free ID — verify with `grep -E "^  cell_" config/tutor-agents.yaml | tail -10` first per the cell-ID discipline memory). Recommended config: matches cell_111's prompt and model choice (`prompt_type: adaptive_recognition_only` analogue but routed through the dialogue engine), so the cross-architecture comparison varies *only* the runner, not the prompt or model. **Crucially:** declare `runner: standard` in the YAML AND make sure the script actually dispatches via the standard runner — this is exactly the discrepancy that bit A13.

3. **`EVAL_ONLY_PROFILES` registration:** Add `cell_114_dialogue_engine_trap_baseline` to the array in `services/evaluationRunner.js` (~line 102), per the "Adding New Cells" rule in `CLAUDE.md`.

### Cross-architecture controls

Keep the comparison clean by holding constant:
- **Same 6 scenarios**, same scripted learner script (verbatim opening_turns + same trigger).
- **Same scoring pipeline**: binary `strategy_shift_correctness` via `analyze-strategy-shift.js`, plus 4-dim graded via `grade-adaptive-dialogue.js`. Both already work on any row that points at a trap-scenario dialogue log.
- **Same N as cell_110/111/112**: K=4 → N=24 (4 runs × 6 scenarios). Adequate for paired comparison; matches the within-LangGraph cell sizing.
- **Same model** as cell_110 (the LangGraph reference cell) for the headline comparison. Cell_111 uses `claude-code:sonnet`; cell_110 uses `openrouter:nemotron`. Pick one and apply to cell_114 to control for model effects.

### Run sequence (after script is in place)

```bash
# 1. Verify cell is registered.
grep "cell_114_dialogue_engine_trap_baseline" services/evaluationRunner.js  # must return a match

# 2. Fan out K=4 in parallel (per parallel-adaptive-pilots memory).
LOG_DIR=$(mktemp -d ~/.cell114-baseline-XXXXX)
for i in 1 2 3 4; do
  node scripts/run-dialogue-engine-trap-baseline.js \
    --profile=cell_114_dialogue_engine_trap_baseline --runs=1 \
    > "$LOG_DIR/cell_114_${i}.log" 2>&1 &
done
wait

# 3. Capture run_ids and run both scoring passes.
CELL_114_IDS=$(grep -h 'runId=' "$LOG_DIR"/*.log | sed -E 's/.*runId=([^ ]+).*/\1/' | tr '\n' ',' | sed 's/,$//')
node scripts/analyze-strategy-shift.js --run-id "$CELL_114_IDS" \
  --profile cell_114_dialogue_engine_trap_baseline --out exports/cell114-baseline.json
node scripts/grade-adaptive-dialogue.js --run-id "$CELL_114_IDS"

# 4. Compare against cell_110, cell_111, cell_112 on the same metrics.
sqlite3 data/evaluations.db "
  SELECT profile_name,
         COUNT(*) AS n,
         ROUND(AVG(adaptive_trigger_recognition), 2) AS trig,
         ROUND(AVG(adaptive_strategy_execution), 2) AS exec,
         ROUND(AVG(adaptive_strategy_quality), 2) AS qual,
         ROUND(AVG(adaptive_pedagogical_coherence), 2) AS coh
  FROM evaluation_results
  WHERE profile_name IN ('cell_110_langgraph_adaptive',
                         'cell_111_a13_C1_recognition_only',
                         'cell_112_a13_C2_egosuperego',
                         'cell_114_dialogue_engine_trap_baseline')
    AND adaptive_trigger_recognition IS NOT NULL
  GROUP BY profile_name;
"
```

### What this answers

- **Does the state machine improve over the dialogue engine on trap scenarios?** Direct comparison cell_110 vs cell_114 on both binary and graded scoring.
- **Is the A13 "C1 recognition_only" condition actually the same as the dialogue engine?** Compare cell_111 (`recognition_only` inside LangGraph: single LLM call, no profile, no superego, no constraints — basically a stripped state machine) against cell_114 (true dialogue engine). If they score the same, the LangGraph scaffolding alone adds nothing when stripped of its mechanisms; if cell_114 differs, the difference isolates the LangGraph framework overhead from its mechanisms.
- **Does the previous paper's "null on adaptive responsiveness" replicate on trap scenarios?** cell_114's strategy_shift_correctness gives a direct answer.

### Risks / gotchas

- **Pre-reg drift bookkeeping.** Cell 114 is a new condition not covered by the A13 pre-reg. Add a single-page addendum noting it's a post-hoc baseline added 2026-05-X to address the absent dialogue-engine comparison, with an explicit "this is exploratory, not pre-registered" flag.
- **Scripted learner symmetry.** The trap scenarios were designed assuming a partly-LLM learner. Forcing a fully scripted learner could produce different trap signal latencies. Spot-check cell_114 dialogues against cell_111 dialogues to confirm the visible learner turns are identical (they should be — both pull from `opening_turns`); any difference indicates a bug in the new script, not a real architecture difference.
- **Dialogue-engine prompt selection.** Tutor-core has many prompt variants. Default cell_114 to the closest analogue of cell_111's prompt — likely `prompt_type: base` with a single-agent ego config. Document the choice; don't sneak in a recognition-prompt or psycho-prompt that would confound the comparison.

---

## §6 Results integration plan for `paper-full-2.0.md`

Two weeks of experimental work (2026-05-01 → 2026-05-10) is sitting in `docs/explorations/claude/` and the database but is not in §6 of the paper. This is the plan for folding it in. §5.12 (the new methodology subsection added 2026-05-10) is already in place and references everything below; §6 needs the corresponding results subsections.

### Where the new material goes

§6 currently runs §6.1–§6.7. §6.3 (*Adaptive Responsiveness*) ends with §6.3.9 (*The Insight-Action Gap is Structural Under Lightweight Intervention; Partially Mitigable Only by Expensive Search*). §6.7 is *Architectural Extension: The Id-Director Family and Charismatic Pedagogy* — the precedent for adding a parallel "architectural extension" results section.

Following that precedent, the adaptive-runner work lands as a **new §6.8 *Architectural Extension: The Adaptive Runner and Trap-Scenario Methodology***. The id-director section (§6.7) and the adaptive-runner section (§6.8) become the two architecture-extension siblings.

§6.3.9 gets a forward pointer added: a single sentence noting that §6.8 reports a heavier intervention than best-of-N selection, and that the §6.8.8 closing synthesis does not reverse §6.3.9's lightweight-intervention-resistant finding.

### Proposed §6.8 structure

| Sub-subsection | Source data | Pending? |
|---|---|---|
| 6.8.1 Motivation: closing Paper 1.0's adaptive-responsiveness null | `docs/explorations/claude/2026-05-01-comprehensive-strategy.md` (motivation prose) + §6.3.9 (the null itself) | No |
| 6.8.2 Method: trap scenarios + externalised learner state + counterfactual replay | `config/adaptive-trap-scenarios.yaml`; `services/adaptiveTutor/*`; §5.12.4 (graded rubric caveats) | No |
| 6.8.3 cell_110 headline: state machine produces strategy shifts on trap scenarios | `eval-2026-05-05-486d7d1e` (N=23); `exports/p22-cell110-baseline.json`; graded means already computed | No |
| 6.8.4 A13 within-LangGraph ablation (C1–C4) | cells 110/111/112/113; §5.12.2 framing (within-LangGraph, not cross-runner) | Depends on whether C4 / validator runs at adequate N |
| 6.8.5 P2.1: bilateral ToM elaboration adds no measurable value | `p21-N24-results.md` (clean null at N=24 across four v2 cells) | No |
| 6.8.6 P2.2: state-richness reversal (less learner state is more) | cells 110, 118, 119 binary + graded; `p22-p23-parking-note.md` headline tables | Depends on cell_120 for the dose-response disambiguator |
| 6.8.7 Cross-architecture comparison: status outstanding | cell_106 N=6 thin overlap; cell_114 plan above; cell_106 N=32 re-run if it happens | Strong dependency on cell_114 and/or cell_106-N=32 |
| 6.8.8 Closing synthesis: harness as contribution; mechanism elaborations mostly null or inverted | All of the above | Depends on 6.8.6 and 6.8.7 closing out |

Each sub-subsection's lede applies the §5.12.6 three-tier reporting convention. Most subsections are exploratory or re-classified-exploratory rather than confirmatory (only the headline §6.8.3 cell_110 figure is pre-registered confirmatory; §6.8.5 P2.1 is pre-registered confirmatory but the result is a null on a heavier-intervention hypothesis).

### Sub-subsection content sketches (one paragraph each)

**§6.8.1 Motivation.** Pull two sentences from `comprehensive-strategy.md` ("The current paper documents a clean null on adaptive responsiveness... The LangGraph adaptive cell is the first architectural attempt to close that gap"). Anchor in §6.3.9. State that the intervention crosses two levels at once: (a) externalising learner state out of the prompt and into a structured object, and (b) replacing the dialogue engine's free-form turn loop with a programmatic policy graph.

**§6.8.2 Method.** Describe the trap-scenario instrument (`config/adaptive-trap-scenarios.yaml`, 6 scenarios with `hidden.actualMisconception` / `hidden.triggerTurn` / `hidden.triggerSignal` / `expectedStrategyShift`). Describe the LangGraph runner (`services/adaptiveTutor/*`) — contextInput → tutorEgo → (optional superego, profile update, constraint check, validator) → done. Describe the two scoring paths: binary `strategy_shift_correctness` from `scripts/analyze-strategy-shift.js`, and the 4-dimension graded rubric from `scripts/grade-adaptive-dialogue.js` (forward to §5.12.4 for caveats). Note the counterfactual replay design (deterministic re-execution under perturbed learner profile fields), and the K=4 N=24 standard fan-out size.

**§6.8.3 cell_110 headline result.** Single short table: cell_110 N=23, strict shift 47.8%, family shift 87.0%, graded means (trigger 4.26, execution 4.30, quality 3.96, coherence 3.61, overall 4.03). One paragraph framing: this is the first architectural intervention that produces measurable strategy shifts on the trap-scenario instrument — the cross-architecture question (does the dialogue engine produce the same shifts?) is addressed in §6.8.7.

**§6.8.4 A13 within-LangGraph ablation.** Apply §5.12.6 *re-classified exploratory* reporting convention in the lede. Report binary `strategy_shift_correctness` and graded means for cells 110/111/112/113. The within-LangGraph contrasts isolate (i) the effect of adding a superego pass (C1 → C2) and (ii) the effect of adding profile + policy + constraint check (C2 → C3) and (iii) the effect of adding a validator (C3 → C4). The H1.1 contrast (C1 → C3) is the headline pre-registered comparison; report as the pre-reg framed it but with the §5.12.2 caveat that "C1" here means *recognition_only* (a LangGraph sub-graph), not a dialogue-engine baseline.

**§6.8.5 P2.1 bilateral ToM null.** Re-prosecute the result from `p21-N24-results.md`: across four v2 cells testing the bilateral ToM elaboration over recognition_only at N=24 each, `strategy_shift_correctness` shows no measurable lift. This was pre-registered (Pre-reg P2 lines on H1.1); the null is confirmatory and reported as such. One short table with the four cells' shift% and 95% CIs.

**§6.8.6 P2.2 state-richness reversal.** This is the longest sub-subsection. Apply §5.12.6 *re-classified exploratory* (the pre-reg's H2.1 dose-response prediction `cell_110 ≥ cell_119 ≥ cell_120 ≥ cell_118` is reversed in observation). Three tables: (a) per-cell binary shift% (cell_110 47.8 → cell_119 53.1 → cell_118 68.8); (b) per-cell graded 4-dim means with cell_119's left-tail-on-execution noted **as a GPT-5-only observation** (the §5.12.4 Gemini calibration does not reproduce it — ceiling effect); (c) within-experiment same-day comparison (cell_118 vs cell_119 +15.7pp, artefact-free). Discuss the engineering-vs-noise question from the parking note (post-rejudge weights ~65/20/15 for the headline ordering, which replicated under a second judge per §5.12.4 limitation 2) but trimmed to one paragraph rather than the full breakdown in the parking note. State that the graded *overall* ordering is two-judge-robust while absolute graded levels (cross-judge QWκ ≈ .35) and the execution-tail sub-story are not. Defer the cell_120 disambiguator question to whenever cell_120 closes; if it doesn't close before publication, the section reports cells 110/118/119 only with the cell_120 dependency explicit.

**§6.8.7 Cross-architecture comparison.** State plainly that the cross-architecture comparison is the most consequential open question for the §6.8 arc and that the current evidence is thin. One short table: cell_106 (id-director) N=6 on the 6 trap scenarios; cell_114 (dialogue-engine baseline) N=24 if it runs, else "outstanding". Two-paragraph treatment: paragraph one summarises what the existing data does and does not support; paragraph two states the §5.12.5 stimulus-suite divergence (trap vs suggestion scenarios) and why claims of the form "the state machine fixes Paper 1.0's null" are unsupported by the current evidence base.

**§6.8.8 Closing synthesis.** Mirror the parking note's "What we can actually conclude about the state-machine arc" section, condensed. Three defensible findings: (i) bilateral ToM machinery adds nothing measurable (P2.1 null); (ii) within the state machine, less learner state is more (P2.2 reversal, with §5.12.4 caveats); (iii) the trap-scenario methodology itself is a contribution distinct from the architectural intervention it was used to test. Two not-established items: (i) the state machine has not been tested against the dialogue engine on shared scenarios; (ii) the originally-hypothesised mechanisms are mostly not doing the work they were designed to do. Forward pointer to §8 limitations and §9 conclusion for the broader reframing.

### Dependencies and ordering

The order this can actually be written in:

1. **Independent of pending runs:** §6.8.1, §6.8.2, §6.8.3, §6.8.5 (P2.1 was complete before parking). Could be drafted now from existing data and existing parking-note prose.
2. **Depends on cell_120 closing:** §6.8.6's "dose-response disambiguator" treatment. If cell_120 doesn't run before publication, §6.8.6 reports cells 110/118/119 only with an explicit "cell_120 dependency open".
3. **Depends on cell_114 (and ideally cell_106 N=32):** §6.8.7. Without these, §6.8.7 has to be framed as "this question is open" rather than as a result. The §5.12.5 stimulus-suite-divergence treatment can still be written without the runs.
4. **Depends on 6.8.6 and 6.8.7 closing:** §6.8.8 closing synthesis (since its claims summarise the preceding sections).

If token-budgeted, the drafting order is: 1 first (independent), 2 next once cell_120 closes, 3 + 4 last once cell_114 (or its decision to skip) is resolved.

### Edits beyond §6.8 itself

- **§6.3.9 forward pointer.** One sentence added at the end of §6.3.9 directing the reader to §6.8 for the heavier-intervention attempt and to §6.8.8 for whether that attempt reversed the §6.3.9 finding.
- **§8 Limitations.** Add a new sub-subsection (~§8.9 or §8.10, after the existing id-director limitations) covering: (a) the within-LangGraph nature of A13's comparison; (b) the non-blind graded rubric — note that single-judge *variance* is now bounded by the §5.12.4 Gemini calibration (graded *overall* ordering replicates), but rubric-not-blind is unaddressed (same rubric for both judges), cross-judge absolute agreement is only fair (QWκ ≈ .35), and the `strategy_execution` left-tail is GPT-5-only; (c) the stimulus-suite divergence between adaptive and non-adaptive cells. All three already have §5.12.X descriptions; §8 needs the reader-facing acknowledgment that these constrain the strength of §6.8's claims.
- **§9 Conclusion.** One paragraph addition: position the §6.8 arc as a methodology-and-falsification result alongside the §6.7 id-director extension, both as architectural extensions whose mechanism-level commitments did not behave as designed but whose harness-level contributions are real.
- **Abstract.** Probably one sentence near the existing abstract's architectural-extension treatment, summarising the adaptive-runner findings in the same compressed form §6.7's id-director extension already gets. Skip if the abstract is already near its target length.
- **Reproducibility appendix.** Add the relevant run-ids (cell_110 May 5 baseline, cell_115/116/117 P2.1, cells 118/119 P2.2) and any pending-cell run-ids once they close.

### Estimated drafting effort

Prose-only (no new analyses), assuming the tables in `p22-p23-parking-note.md`, `p21-N24-results.md`, and the various explorations docs are the source material:

- §6.8.1, §6.8.2, §6.8.3, §6.8.5 (independent block): ~2-3 hours of focused writing.
- §6.8.6 (state-richness reversal, longest): ~1.5 hours.
- §6.8.4, §6.8.7, §6.8.8 (depend on pending runs or design decisions): ~2 hours once dependencies resolve.
- §6.3.9 forward pointer, §8 limitations, §9 conclusion, abstract: ~1 hour together.
- Reproducibility appendix: ~30 minutes mechanical.

Total: ~6-8 hours of writing across multiple sessions. None of it is token-heavy on its own, but it accumulates if done in one pass.

---

## What's parked

| Cell | Pre-reg section | What it tests | Wallclock estimate |
|---|---|---|---|
| `cell_120_state_policy_no_agency_signal` | P2.2-C | drops `agencySignal`; tests H2.2 (family-specific drop on repair_affective scenarios) | ~60 min K=4 |
| `cell_121_bilateral_tom_id_director_v1` | P2.3-A | bilateral_tom × id_director crossover, single-pass ego | ~90-120 min K=4 (heaviest cell) |
| `cell_122_bilateral_tom_id_director_v2` | P2.3-B | bilateral_tom × id_director crossover, full ego/superego/revision | ~90-120 min K=4 (heaviest cell) |

Also parked:
- **cell_110 re-baseline.** Open question from cell_118 results — see "Open questions" below.

---

## Why this is sane to resume

The pre-reg's "Order of execution" (line 235) ordered P2.1 → P2.2 → P2.3 partly so that *if* P2.1 produced a null, the case for the latter two could be re-evaluated without sunk cost. P2.1 did produce a null (see `p21-N24-results.md`). The P2.2 partial result is now sharper:

- **cell_118 vs cell_119 (both N=32, both today): +15.7pp gap, artifact-free.** Same model routing window; the reversal cannot be explained by baseline contamination. Whatever is driving the effect, it lives in the field-projection difference (`agencySignal + zpdEstimate` removal).
- **cell_118 vs cell_110 (across-day): +21.0pp gap, partly contaminated.** Same direction, larger magnitude. The +15.7pp same-day floor sets a lower bound on the true effect; the +21pp upper bound includes any May-5-to-May-10 drift.
- **cell_119 vs cell_110: +5.3pp.** Only modestly above cell_110, consistent with `misconceptions` being a small contributor and the bulk of the noise coming from `agencySignal + zpdEstimate`.

Reading: H2.1 is graded-reversed. cell_120 (drops `agencySignal` only, keeps `misconceptions + zpdEstimate`) becomes the key disambiguator — if it lands near cell_119 (~53%), the dominant noisy field is `agencySignal`; if it lands near cell_118 (~69%), `agencySignal` and `zpdEstimate` are jointly responsible. The cell_110 re-baseline only matters if you need the absolute headline number for a paper claim; for the within-experiment dose-response logic, cell_118-vs-cell_119-vs-cell_120 is self-contained.

P2.3 (cells 121, 122) is independent and can be picked up after P2.2 closes out — but with H1.1 falsified and H2.1 reversed, the prior on bilateral_tom × id_director adding value is now lower.

---

## Open questions to resolve before resume

1. **Is the cell_110 baseline contaminated?** The pre-reg said "reuse N=24 cell_110 data from the N=24 follow-up." The May 5 run `eval-2026-05-05-486d7d1e` is the only substantial historical cell_110 dataset (N=23); earlier rows are 1-8-row probes. Whether this is the canonical follow-up baseline is unverified — `a13-followup-N24-granular-results.md` doesn't list cell_110 in its run-id table. The within-experiment cell_118-vs-cell_119 gap (+15.7pp) is artifact-free and survives without it. The +21pp cell_118-vs-cell_110 gap is the only number that depends on baseline cleanliness.
2. ~~Does cell_119 confirm the cell_118 reversal?~~ **Answered.** cell_119 = 53.1% strict shift, intermediate between cell_110 (47.8%) and cell_118 (68.8%). The reversal is graded, not binary: removing more fields monotonically increases strategy_shift. cell_120 becomes the key disambiguator (does dropping `agencySignal` alone recover most of the cell_118 gain, or only some of it?).
3. **Does P2.3 still merit running?** With H1.1 falsified (P2.1) and H2.1 graded-reversed (P2.2 partial), the prior on bilateral_tom × id_director adding value is now lower. The pre-reg's H3.4 null ("architectures cancel") becomes the modal expectation. P2.3 may still merit running for the charisma + accuracy endpoints, which are partly independent of strategy_shift. Defer the call until cell_120 closes out — the field-projection result will sharpen the prior.

---

## Methodological note — scenario subset and cost cuts

This section is locked-in guidance for the resume, written 2026-05-10 after the cell_118/cell_119 dose-response result.

### Q: Should cell_120 (and cell_110 re-baseline) restrict to the 4 "sensitive" scenarios?

**Answer: No. Run all 8 scenarios.** The "saturation" pattern that motivated the question was an artifact of comparing only cell_118 to cell_119. With cell_110's May-5 baseline data folded in, every scenario subset discriminates between cells:

| Cell | Full 8-scen | Sensitive 4 | "Ceiling" 2 (`affective_shutdown`, `metaphor_boundary_case`) | "Floor" 2 (`resistance_to_insight`, `sophistication_upgrade`) |
|---|---|---|---|---|
| cell_110 (May 5, N=23) | 47.8% (11/23) | 58.3% (7/12) | **33.3% (2/6)** | 40.0% (2/5) |
| cell_119 (no_misc, N=32) | 53.1% (17/32) | 50.0% (8/16) | 87.5% (7/8) | 25.0% (2/8) |
| cell_118 (minimal, N=32) | 68.8% (22/32) | 81.2% (13/16) | 87.5% (7/8) | 25.0% (2/8) |

Three things invalidate the saturation premise:
1. The "ceiling" scenarios are **not** scenario-saturated — cell_110 hits only 33% on them. The largest single subset gap (+54.2pp cell_118-over-cell_110) lives in the supposedly-ceiling subset. Excluding those scenarios from cell_120 would drop the most discriminating data.
2. The "floor" scenarios show cell_110 (40%) **above** cell_118/cell_119 (25%). cell_120 keeps `misconceptions + zpdEstimate` (lacking only `agencySignal`) — it might do better still on floor scenarios. Excluding them risks missing the very signal cell_120 was designed to detect.
3. The 4-scenario subset reveals a non-monotonicity hidden in the 8-scenario aggregate: cell_119 (50%) is **below** cell_110 (58.3%) on the sensitive subset alone. The dose-response from cell_110 → cell_119 → cell_118 is not strictly monotonic; the apparent monotonicity comes from offsetting movement on the ceiling/floor subsets. cell_120 closes this gap or widens it — needs all 8 scenarios to test.

### Pre-specified analysis plan for cell_120 + cell_110 re-baseline

- **Primary endpoint:** strict_shift_correctness on full 8-scenario set, K=4 (N=32 per cell), matches pre-reg.
- **Secondary endpoint:** scenario-type decomposition reported as 4-row breakdown (sensitive / ceiling-labelled / floor-labelled / aggregate). The decomposition is descriptive, not a separate hypothesis test; do not apply alpha correction to the four subsets.
- **H2.1 threshold:** unchanged from pre-reg (cell_110 - cell_118 ≥ 15pp on full 8-scenario), since the dose-response prediction was specified across all scenarios. The current observed gap is +21pp; cell_120 should land between cell_119 and cell_118 if the dose-response holds, regardless of whether per-subset patterns differ.
- **H2.2 threshold:** unchanged (cell_120 family-specific drop on `repair_affective` ≥ 15pp).

### Cost-cut order if token budget is the binding constraint

If next-week's token allowance won't cover the full P2.2 + P2.3 plan (4 cells × K=4 × 8 scenarios + heavier P2.3 cells), trim in this order:

1. **Drop cell_122 entirely** (full ego/superego/revision bilateral_tom × id_director, ~5× LLM burn). This is the heaviest single cell in the design and tests the same H3 as cell_121 with extra mediating mechanisms. Saves ~90-120 min wallclock + the largest LLM cost line.
2. **Drop cell_121** (single-pass ego bilateral_tom × id_director, ~5× LLM burn). If cell_122 is dropped, the H3 crossover test is partly preserved by cell_121 alone, but with weaker power. Drop only if both 121+122 can't be afforded.
3. **Run cell_120 + cell_110 re-baseline at K=3** instead of K=4 (24 rows instead of 32 per cell). Saves ~25% per cell. Acceptable if H2 is already strong on N=32 cells we have.

Do **not** trim by restricting the scenario set — see Q above.

---

## How to resume

### Step 1 — Sanity-check the parked state (already-done verification)

cell_118, cell_119, and the May-5 cell_110 baseline are already analyzed and on disk. Re-confirm before doing new work:
```bash
cd ~/Dev/machinespirits/machinespirits-eval
ls -la exports/p22-cell{110-baseline,118,119}.json
# Should show three files dated 2026-05-10, ~45kB each.

# Re-print the headline numbers:
for f in exports/p22-cell110-baseline.json exports/p22-cell118.json exports/p22-cell119.json; do
  python3 -c "import json,sys; d=json.load(open('$f')); p=d['byProfile'][0]; print(f\"{p['key']:<55} n={p['n']:>3}  shift={p['strategy_shift_correctness']*100:.1f}%  fam={p['family_match_rate']*100:.1f}%\")"
done
```
Expected: cell_110=47.8%/87.0%, cell_118=68.8%/96.9%, cell_119=53.1%/84.4%. If different, the DB has changed since 2026-05-10 and you need to investigate before continuing.

### Step 2 — Run the bespoke adaptive grader on existing rows (~35-45 min)

**Note (2026-05-10):** The original plan was to point the v2.2 evaluator at adaptive rows via `eval-cli evaluate --judge-cli codex`. That path doesn't work — `services/evalConfigLoader.js` `getScenario()` looks up scenarios in `config/suggestion-scenarios.yaml` only, not `config/adaptive-trap-scenarios.yaml`. Adaptive rows return `SKIP (scenario not found)` from every v2.2 entrypoint. This is structural, not a bug: the v2.2 rubric scores tutor responses against a single-turn "suggestion" scaffold; adaptive scenarios don't fit that contract.

Instead, use the bespoke grader `scripts/grade-adaptive-dialogue.js` (added 2026-05-10), which scores adaptive dialogues against a 4-dimension graded rubric (1-5 per dim) tailored to the trap-scenario structure:

| Dimension | Question |
|---|---|
| `trigger_recognition` | Did the tutor identify the trap signal at/near `triggerTurn`? |
| `strategy_execution` | Was the post-trigger action aligned with `expectedStrategyShift`? |
| `strategy_quality` | Given an action fired, was it well-crafted (specific, calibrated, non-leaky)? |
| `pedagogical_coherence` | Does the whole trajectory cohere as teaching? |

The grader complements (does not replace) `analyze-strategy-shift.js`. The latter answers binary mechanism questions (did the right family fire at trigger+window?); this grader answers the next-level graded quality questions.

**Running it.** Uses the same `codex exec -` pattern as `eval-cli`'s codex bridge (ChatGPT subscription, no marginal API $). ~24s/row, sequential.

```bash
node scripts/grade-adaptive-dialogue.js \
  --run-id eval-2026-05-10-24268254,eval-2026-05-10-8fb6e098,eval-2026-05-10-556b5243,eval-2026-05-10-8aedb51d,\
eval-2026-05-10-201b9ef3,eval-2026-05-10-72b7b862,eval-2026-05-10-bf4821c9,eval-2026-05-10-d144de7a,\
eval-2026-05-05-486d7d1e
# 87 rows: cell_118 (32) + cell_119 (32) + cell_110 (23). Already-graded rows skip by default.
# Per-row stdout shows: trig= exec= qual= coh= |  ms
# Total wallclock ~35min.
```

**Where the scores live.** New columns in `evaluation_results` (added by the migration at `services/evaluationStore.js:323-356`):
- `adaptive_trigger_recognition`, `adaptive_strategy_execution`, `adaptive_strategy_quality`, `adaptive_pedagogical_coherence` (each REAL, 1-5)
- `adaptive_grader_scores` (JSON snapshot), `adaptive_grader_reasoning` (JSON with per-dim text + summary)
- `adaptive_grader_judge_model`, `adaptive_grader_version` (currently `1.0`)

**Sanity-check after the batch:**
```bash
sqlite3 data/evaluations.db "
  SELECT profile_name,
         COUNT(*) AS n,
         ROUND(AVG(adaptive_trigger_recognition), 2) AS trig_mean,
         ROUND(AVG(adaptive_strategy_execution), 2) AS exec_mean,
         ROUND(AVG(adaptive_strategy_quality), 2) AS qual_mean,
         ROUND(AVG(adaptive_pedagogical_coherence), 2) AS coh_mean
  FROM evaluation_results
  WHERE profile_name IN ('cell_110_langgraph_adaptive',
                         'cell_118_state_policy_minimal_profile',
                         'cell_119_state_policy_no_misconceptions')
    AND adaptive_trigger_recognition IS NOT NULL
  GROUP BY profile_name;
"
```

Expect cell_118 means to land above cell_119 means above cell_110 means **if** the graded result preserves the binary dose-response — but the graded path can also reveal *quality* differences that the binary path missed (e.g. cells that fire the right family at the wrong moment, or with the wrong tone).

### Step 3 — Decide on cell_110 re-baseline

The May-5 baseline is N=23 (one row short of N=24); whether it's the canonical pre-reg baseline is unverified — see Open Question #1. The within-experiment cell_118-vs-cell_119 gap (+15.7pp on full 8-scenario, +31.2pp on the sensitive subset) is artifact-free without it. Decide based on whether the +21pp cell_118-vs-cell_110 number needs to be in the headline of `p22-N24-results.md` or is fine as a secondary comparison.

To re-baseline cell_110 (K=4 fresh, ~60 min, 8 scenarios per pre-reg):
```bash
LOG_DIR=$(mktemp -d ~/.p22-cell110-rebaseline-XXXXX)
for i in 1 2 3 4; do
  ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
    --profiles cell_110_langgraph_adaptive --runs 1 \
    > "$LOG_DIR/cell_110_${i}.log" 2>&1 &
done
wait
grep -h '^\[adaptive\] cell_110_langgraph_adaptive: runId=' "$LOG_DIR"/*.log
```

### Step 4 — Run cell_120 (full 8 scenarios per Methodological Note)

```bash
LOG_DIR=$(mktemp -d ~/.p22-cell120-XXXXX)
for i in 1 2 3 4; do
  ADAPTIVE_TUTOR_LLM=real node scripts/eval-cli.js run \
    --profiles cell_120_state_policy_no_agency_signal --runs 1 \
    > "$LOG_DIR/cell_120_${i}.log" 2>&1 &
done
wait
grep -h '^\[adaptive\] cell_120_state_policy_no_agency_signal: runId=' "$LOG_DIR"/*.log
```

Then run graded scoring on cell_120 too (mirror Step 2):
```bash
CELL_120_RUNIDS=$(grep -h '^\[adaptive\] cell_120_state_policy_no_agency_signal: runId=' "$LOG_DIR"/*.log | sed -E 's/.*runId=([^ ]+).*/\1/')
for runid in $CELL_120_RUNIDS; do
  node scripts/eval-cli.js evaluate "$runid" --judge-cli codex
done
```

### Step 5 — Run analyze-strategy-shift + 2D scenario score

Strategic-correctness (binary) per cell:
```bash
CELL_118_IDS=$(sqlite3 data/evaluations.db "SELECT DISTINCT run_id FROM evaluation_results WHERE profile_name = 'cell_118_state_policy_minimal_profile' AND created_at > '2026-05-10';" | tr '\n' ',' | sed 's/,$//')
CELL_119_IDS=$(sqlite3 data/evaluations.db "SELECT DISTINCT run_id FROM evaluation_results WHERE profile_name = 'cell_119_state_policy_no_misconceptions' AND created_at > '2026-05-10';" | tr '\n' ',' | sed 's/,$//')
CELL_120_IDS=$(sqlite3 data/evaluations.db "SELECT DISTINCT run_id FROM evaluation_results WHERE profile_name = 'cell_120_state_policy_no_agency_signal' AND created_at > '2026-05-17';" | tr '\n' ',' | sed 's/,$//')
CELL_110_IDS=<canonical May 5 id 'eval-2026-05-05-486d7d1e' OR re-baseline ids from Step 3>

node scripts/analyze-strategy-shift.js --run-id "$CELL_110_IDS" --profile cell_110_langgraph_adaptive --out exports/p22-cell110.json
node scripts/analyze-strategy-shift.js --run-id "$CELL_120_IDS" --profile cell_120_state_policy_no_agency_signal --out exports/p22-cell120.json
node scripts/analyze-strategy-shift.js --run-id "${CELL_110_IDS},${CELL_118_IDS},${CELL_119_IDS},${CELL_120_IDS}" --out exports/p22-N32-granular.json
```

**2D scenario score (graded × strategic, joins judge scores from Step 2/4 with strategy_shift output).** This analyzer doesn't exist yet — write it as part of the resume:
```bash
# Sketch (to be implemented):
# scripts/analyze-2d-scenario.js
#   For each dialogue_id in the four cells, join:
#     - strategic correctness (from analyze-strategy-shift output, binary)
#     - graded quality (from evaluation_results.tutor_overall_score, 1-5)
#   Output: per-scenario 2D coordinate (correctness, quality)
#   Aggregate: per-cell mean quality on correct/incorrect strategic decisions separately
#   Plot: scatter or 2x2 heatmap
node scripts/analyze-2d-scenario.js --run-ids "${CELL_110_IDS},${CELL_118_IDS},${CELL_119_IDS},${CELL_120_IDS}" --out exports/p22-2d-scenario.json
```

The 2D analyzer will let you say "cell_120 wins/loses on strategic correctness AND on message quality" or "cell_120 ties on strategic correctness but pulls ahead on quality" — the more interesting story.

### Step 6 — Apply pre-reg's H2.1 / H2.2 thresholds

Per pre-reg lines 97-108:
- H2.1 prediction: `cell_110 ≥ cell_119 ≥ cell_120 ≥ cell_118`, with `cell_110 − cell_118 ≥ 15pp`
- H2.3 null: `cell_118 ≈ cell_110` (<5pp gap) means the structured profile is cosmetic
- H2.2: `cell_120` drops on repair_affective by ≥15pp

Already known from cell_118/cell_119 data: H2.1 is graded-reversed; cell_118 - cell_110 = +21pp (opposite sign of pre-reg prediction). cell_120 will determine whether `agencySignal` alone or the `agencySignal × zpdEstimate` interaction is the dominant noisy field.

Write `p22-N32-results.md` (mirroring `p21-N24-results.md`) once all four cells have full data: strategic correctness + graded quality + 2D scenario score.

### Step 7 — P2.3 decision

Look at P2.2's combined picture and decide whether to launch cells 121, 122. The pre-reg leaves this open after a P2.2 null/reversal. Estimated cost: ~$50-100 extra (pre-reg line 246-ish) — P2.3 cells are bilateral_tom × id_director, the heaviest single combination in the codebase. With H1.1 falsified and H2.1 reversed, the prior on bilateral_tom × id_director adding value is now lower; consider running only cell_121 (skip cell_122) if budget is tight.

---

## Reminder

A cron-based reminder is scheduled for **2026-05-17 10:07 CDT** (next Sunday morning). If this Claude session dies before then, the reminder will be lost — set a manual calendar reminder as a backup. The full state needed to resume is in this file plus `p2-followup-pre-registration.md`.
