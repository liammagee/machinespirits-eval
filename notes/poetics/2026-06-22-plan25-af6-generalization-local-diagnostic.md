# Plan 2.5 AF6 Generalization — Local Diagnostic Result

Date: 2026-06-22

Status: local diagnostic only; not a paper-bearing generalization claim.

This note records the first execution pass against
`notes/poetics/2026-06-22-plan25-af6-generalization-and-efficacy-plan.md`.

## Review Findings

The plan's main distinction is correct: fresh-scene instrument generalization
and broad autonomous tutor efficacy are different claims. The executable gaps
were in Stage 0:

1. `scripts/analyze-plan25-branch-screen.js` checked required learner numbers
   against the full transcript, which could let prefix-visible or tutor-visible
   numbers satisfy the gate. It now checks the learner suffix only.
2. Required-number aliases were hard-coded to the original 94 / 16.7 AF6 scene.
   The analyzer now accepts YAML number specs with aliases plus a fallback
   number-to-words matcher.
3. The runner was single-critic and single-score-file. It now accepts
   comma-separated `--score-model` values, writes `manifest.outputs.scores`,
   and records learner / critic family provenance.
4. The old `--score-mock` path is useful for rendering and leak-audit preflight
   only. It cannot validate the recognition gate because the mock scorer returns
   flat / 50 rows.
5. `OPENROUTER_API_KEY` is unset, so hosted Gemini / DeepSeek could not be used
   as a second non-author critic family. Gemini CLI is installed but exits with
   an ineligible-tier authentication error. Local Ollama models are available
   and were tested as a substitute non-author family; see the stricter gate
   below.

## Implemented Stage 0 Artifacts

- `config/poetics-calibration/plan25-af6-generalization/scene-set.yaml`
- `config/poetics-calibration/plan25-af6-generalization/branch-template.yaml`
- `config/poetics-calibration/plan25-af6-generalization/rendered/`
- `scripts/render-plan25-generalization-scenes.js`
- `scripts/replay-plan25-prefix-branches.js`
- `scripts/analyze-plan25-branch-screen.js`
- `scripts/score-poetics-calibration.js` (`ollama:<model>` bridge + terminal
  control sanitizing for local model output)
- `tests/recognitionOriginSubtype.test.js`

Focused validation:

```bash
node --test tests/recognitionOriginSubtype.test.js
```

Result: 8/8 passing.

## Local Diagnostic Runs

Mock preflight rendered all five scenes and ran control leak audits:

```bash
node scripts/render-plan25-generalization-scenes.js \
  --scene-set config/poetics-calibration/plan25-af6-generalization/scene-set.yaml \
  --out-dir config/poetics-calibration/plan25-af6-generalization/rendered \
  --force
```

The live local diagnostic used a Codex learner and Codex + Claude Code critics.
This is not promotion-grade because the scene set is Codex-authored and one
critic is therefore same-family.

| Scene | Tier | Local Gate | Notes |
|---|---:|---:|---|
| `tier_a_null_floor_96_recall_20` | A | PASS | First attempt exposed a scene bug: counts gave 920/1000, not 960/1000. Corrected to TP=8, FN=32, FP=8, TN=952, then passed 2/2. |
| `tier_a_null_floor_90_recall_15` | A | PASS | Passed 2/2 across all branches. |
| `tier_a_below_floor_recall_14` | A | FAIL | Evidence branch only 1/2 and refusal branch only 1/2. Characterized break: when headline accuracy is already below the null floor, the correction is obvious enough that origin attribution drifts organic. |
| `tier_b_precision_recall_confusion` | B | PASS after one redesign | Initial evidence branch was 1/2; tightened Gate A to make the tutor's strategy reversal explicit, then passed 2/2. |
| `tier_b_specificity_recall_confusion` | B | PASS | Passed 2/2 across all branches. |

Claim-bearing local rate under the diagnostic scorer is therefore 4/5 after the
single predeclared-style repair to the precision/recall branch, with the
below-null-floor scene retained as a boundary case rather than hidden.

Key reports:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_null_floor_90_recall_15/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_below_floor_recall_14/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-b-precision-tightened-codex-learner-codex-claude-critics-20260622/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_b_specificity_recall_confusion/screen-analysis.md`

## Conclusion

The Stage 1 design is now executable and locally promising, but it does not yet
license the broad Plan 2.5 efficacy claim or the strict fresh-scene
generalization claim.

Licensed now:

> A local Codex-learner / Codex+Claude-critic diagnostic battery separates the
> AF6 origin mechanisms on 4/5 fresh Tier A+B scenes after harness hardening,
> while identifying a principled boundary case where below-null-floor arithmetic
> shifts origin attribution toward organic repair.

Not licensed:

- A paper-bearing fresh-scene generalization claim.
- A broad Plan 2.5 efficacy claim.
- A main-harness autonomous tutor effect.
- A non-author multi-critic claim, because Gemini / DeepSeek were unavailable.

## Next Gate

To promote Claim G, rerun the five-scene battery with author-family control:

1. Use non-Codex-authored scene prefixes or split scene authors across families.
2. Score every scene with two non-author critics, e.g. Codex + Gemini for
   Claude-authored scenes or Claude + Gemini for Codex-authored scenes.
3. Retain the below-null-floor scene as a boundary case unless a predeclared
   rationale removes it from the promotion-bearing denominator.
4. Promote only if Tier A+B remains at least 4/5 with zero control leaks and no
   induced evidence-route attribution in controls.

Stage 2 efficacy remains closed until Claim G passes under that stricter gate
and a power estimate says an autonomous tutor contrast is detectable.

## Stricter Non-Author Critic Reruns

After the first local diagnostic, I tested whether the claim could be promoted
without external API keys by replacing same-family Codex critic scoring with
local Ollama critics. This keeps the Codex-authored scene set but asks two
non-author critics to agree: Claude Code + Ollama.

### Claude Code + Ollama/Phi-4

All five scenes were rescored with `ollama:phi4` and analyzed using only
`poetics-phase2-claude-code.json` plus `poetics-phase2-ollama_phi4.json`.

Result: 0/5 scenes pass the required 2/2 gate.

Pattern: Phi-4 often credits learner recontextualization but assigns low or
zero tutor mechanism / mechanism-quality scores, so evidence-route and
refusal/ownership branches fail origin attribution even when Claude Code passes.
The hold control usually remains safe.

Reports:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-phi4-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_null_floor_90_recall_15/non-author-claude-phi4-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_below_floor_recall_14/non-author-claude-phi4-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-b-precision-tightened-codex-learner-codex-claude-critics-20260622/non-author-claude-phi4-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_b_specificity_recall_confusion/non-author-claude-phi4-analysis/screen-analysis.md`

### Claude Code + Ollama/DeepSeek-R1 8B Smoke

Because Phi-4 was systematically conservative, I ran a single known-good scene
smoke with `ollama:deepseek-r1:8b`:

- scene: `tier_a_null_floor_96_recall_20`, corrected counts
- analyzer: Claude Code + Ollama/DeepSeek-R1 8B
- result: FAIL

DeepSeek-R1 8B scored the evidence branch as flat / none and the refusal branch
as trap / false-closure, so a full DeepSeek battery would not be a reasonable
promotion path.

Report:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-deepseek8b-analysis/screen-analysis.md`

### Claude Code + Ollama/DeepSeek-R1 14B Smoke

I then repeated the same known-good-scene smoke with
`ollama:deepseek-r1:14b`:

- scene: `tier_a_null_floor_96_recall_20`, corrected counts
- analyzer: Claude Code + Ollama/DeepSeek-R1 14B
- result: FAIL

DeepSeek-R1 14B agreed with Claude Code only on the organic silent-hold
control. It scored the evidence branch as flat / none and the refusal branch as
flat / none, so the corrected scene still fails the required 2/2 branch gate
under this stricter non-author pairing.

Report:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-deepseek14b-analysis/screen-analysis.md`

### Ollama/DeepSeek-R1 32B Practicality Check

I attempted the same corrected-scene smoke with `ollama:deepseek-r1:32b`.
After more than ten minutes it had not produced the first of three required
judgments, so I interrupted the run. No score JSON or analyzer report was
produced.

This makes 32B impractical as a local promotion critic on the current machine:
even if its judgments were better, the per-scene gate would be too slow to
support the five-scene battery and subsequent iteration loop.

### Claude Code + Antigravity CLI (`agy`) Smokes

After confirming that the local `agy` CLI can run non-interactively, I added an
`agy:` scorer bridge and tested the strongest non-Claude / non-Codex profiles it
exposes on the corrected known-good scene:

- `agy:gemini-3.1-pro-high`: FAIL. Gemini Pro recognized the evidence-route
  branch as FORM but attributed it to organic learner repair, falsely attributed
  the organic silent-hold control to induced refusal/authority, and passed only
  the refusal-ownership branch with Claude Code.
- `agy:gemini-3.5-flash-high`: FAIL. Gemini Flash kept the control safe but
  scored the evidence-route and refusal-ownership branches below the required
  mechanism gate.
- `agy:gpt-oss-120b-medium`: FAIL. After parser retry hardening, GPT-OSS parsed
  cleanly but attributed all three branches to organic recognition rather than
  the intended induced mechanisms.

Reports:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-agy-gemini31pro-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-agy-gemini35flash-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-agy-gptoss120b-analysis/screen-analysis.md`

### Claude Code + OpenRouter GLM 5.2

After confirming `OPENROUTER_API_KEY` is available from `.env`, I tested
`z-ai/glm-5.2` as a stronger hosted non-author critic. The corrected
`tier_a_null_floor_96_recall_20` smoke passed, so I escalated to the five-scene
battery using Claude Code + GLM 5.2.

Result: 3/5 scenes pass, 13/15 branch gates pass.

| Scene | Gate | Branch detail |
|---|---:|---|
| `tier_a_null_floor_96_recall_20` corrected | PASS | 3/3 branches pass. |
| `tier_a_null_floor_90_recall_15` | FAIL | Evidence-route and refusal-ownership pass; organic silent-hold control fails because GLM over-attributes induced refusal/authority. |
| `tier_a_below_floor_recall_14` | FAIL | Evidence-route and organic control pass; refusal-ownership remains 1/2. |
| `tier_b_precision_recall_confusion` tightened | PASS | 3/3 branches pass. |
| `tier_b_specificity_recall_confusion` | PASS | 3/3 branches pass. |

The GLM result is the strongest evidence for a model-power effect so far:
unlike Phi-4, DeepSeek 8B/14B, `agy` Gemini, and `agy` GPT-OSS, GLM 5.2
recovers all five evidence-route branches and all five refusal-ownership
branches in its own row-level origin assignments. It does not clear the
pre-existing scene-level promotion gate because it still over-calls one organic
control and the below-null-floor scene remains unstable.

Reports:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_null_floor_90_recall_15/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_below_floor_recall_14/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-b-precision-tightened-codex-learner-codex-claude-critics-20260622/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_b_specificity_recall_confusion/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`

## Updated Conclusion

The fresh-scene design remains locally promising under strong hosted critics
available in the repo session. Codex + Claude gives 4/5. Claude + GLM 5.2 gives
3/5 scenes and 13/15 branches. This is stronger than the local / `agy`
substitute critics, but it still does not support the earlier paper-bearing
fresh-scene generalization claim because the scene-level gate remains below the
4/5 promotion bar.

Preservation decision: keep this as a model-power / critic-calibration finding
for now, not as a fresh-scene generalization result. The clean finding is that
critic capability and calibration materially change AF6 origin adjudication:
weak/local substitute critics miss or flatten the mechanisms, `agy` profiles
either miss mechanisms or over/under-attribute origin, while GLM 5.2 recovers
nearly all intended mechanism branches but still exposes strict-control
instability.

Promotion blocker: redesign the strict origin/control gate before trying to
promote the broad claim. The current gate mixes two separable demands: detecting
the intended mechanism branch and enforcing a no-over-attribution organic
control. GLM 5.2 suggests the mechanism detector can work, but the control/origin
thresholding is too brittle to bear a broad paper claim without an explicit
redesign and re-freeze.

Write-up recommendation: write this up as a short diagnostic / calibration
finding, either as a bounded note in the poetics section or as an ancillary
appendix-style result. Do not promote it into the main empirical claim language
until the redesigned origin/control gate passes prospectively.

Write-up created:
`notes/poetics/2026-06-22-plan25-af6-critic-calibration-writeup.md`.

The locally tested non-author alternatives are now exhausted:

- Phi-4: full five-scene rerun, 0/5 pass.
- DeepSeek-R1 8B: known-good corrected-scene smoke fails.
- DeepSeek-R1 14B: known-good corrected-scene smoke fails.
- DeepSeek-R1 32B: known-good corrected-scene smoke is operationally
  impractical on this machine.
- Antigravity CLI / `agy` Gemini 3.1 Pro High: known-good corrected-scene smoke
  fails the origin gate.
- Antigravity CLI / `agy` Gemini 3.5 Flash High: known-good corrected-scene
  smoke fails the mechanism branches.
- Antigravity CLI / `agy` GPT-OSS 120B Medium: known-good corrected-scene smoke
  fails the origin gate after parser retry hardening.
- OpenRouter GLM 5.2: five-scene battery gives 3/5 scenes and 13/15 branches;
  strong evidence for a model-power effect, but not enough for the broad
  scene-level claim.

Other installed Ollama models were checked and excluded rather than treated as
claim-bearing critics:

- `mario:latest` is a Qwen2 32.8B model but has a fixed Mario-persona system
  prompt, so it is not a sober critic surface for a paper gate.
- `llama3.2:1b` / `llama3.2:3b` are weaker than the failed 8B/Phi substitutes.
- `vanilj/Phi-4:latest` is effectively a second Phi-4 surface, not an
  independent stronger critic family.

Reasonable next routes:

1. Rerun the five-scene battery only if a new stronger non-author critic becomes
   available or the scoring rubric is explicitly redesigned. The currently
   available `agy` Gemini/GPT-OSS profiles do not pass the corrected-scene
   promotion smoke, and GLM 5.2 falls short at scene level.
2. Generate a non-Codex-authored scene set and use Codex + another non-author
   hosted critic. Claude-only authorship plus Codex-only scoring is still one
   critic short.
3. If no second reliable non-author critic can be made available, preserve the
   result as a diagnostic bound: the instrument shows 4/5 under Codex+Claude but
   fails under weaker local critics, so the critic-family dependency itself is a
   finding rather than a claim to hide.
