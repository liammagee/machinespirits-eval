# A12 M3 Disengagement-Scenario Replication

**Date**: 2026-04-22
**Design**: `notes/design-a12-m3-disengagement-replication.md`
**Analysis script**: `scripts/analyze-a12-disengagement-replication.js`
**Runs**:
- `eval-2026-04-22-d4547979` — Haiku 4.5 ego, 2 cells × 4 runs × 1 scenario, 8 dialogues × 11 turns
- `eval-2026-04-22-f4fb03f1` — Gemini Flash 3.0 ego, same design

## Research question

Does the exploratory disengagement-scenario M3 finding from the original DeepSeek/Sonnet run (ebcd6de0, $d = 1.63$, $n = 12$/condition) replicate on a second generation model and a second judge?

The design note pre-registered:
- $d \geq 1.0$ on slope in **both** replication models → robust replication; promote finding
- $d \geq 1.0$ on **one of two** → partial; keep as conditional emergent
- $d < 0.5$ on **both** → fails to replicate; retire from abstract
- Judge-sensitivity rule (§4.3): if cross-judge $\Delta d > 0.5$ on the same rows, consider the finding unreplicated regardless of primary-judge $d$

## Design

- **Scenario**: `trajectory_disengagement_to_ownership` (10 turns, dual inflection at T4 and T7; same scenario as the original)
- **Cells**: `cell_80_messages_base_single_unified` (M0: no recognition, no superego) vs `cell_84_messages_recog_single_unified` (M1: recognition, no superego). Matches the original M3 isolation architecture.
- **Generation models**: Haiku 4.5, Gemini Flash 3.0 (both ≠ DeepSeek V3.2 of the original)
- **Judges**: GPT-5.4 primary (≠ Sonnet of the original, breaks judge confound); Sonnet 4.6 secondary (for cross-judge sensitivity check)
- **N**: 2 models × 2 cells × 4 runs × 1 scenario = 16 dialogues total, $n = 4$/condition per model

## Result matrix

Cohen's $d$ on per-dialogue OLS slopes (per-turn dim-mean on 1-5 scale; dimensionless, directly comparable to original $d = 1.63$):

| Model | Sonnet 4.6 | GPT-5.4 | $\Delta d$ | Pre-reg verdict |
|---|---|---|---|---|
| Haiku 4.5 | $-0.18$ | $+1.85$ | $2.03$ | Judge-sensitive → unreplicated |
| Gemini Flash 3.0 | $-0.93$ | $-0.11$ | $0.82$ | Judge-sensitive → null |

Raw slopes on 1-5 dim-mean scale and rubric-aggregate levels on 0-100 scale:

**Haiku 4.5 / Sonnet 4.6** ($n = 4$/condition)
- Base slope $-0.023$ (SD $0.043$), recog slope $-0.030$ (SD $0.034$); both trajectories decline. Welch's $t(5.7) = -0.25$.
- Rubric aggregate: base $34.1 \to 15.6$, recog $58.1 \to 40.0$. Gap parallel, both declining ≈18 pts.

**Haiku 4.5 / GPT-5.4** ($n = 4$/condition, SAME dialogues as above)
- Base slope $-0.022$ (SD $0.032$), recog slope $+0.053$ (SD $0.048$); base declines, recog climbs. Welch's $t(5.2) = 2.62$.
- Rubric aggregate: base $40.0 \to 28.4$, recog $48.1 \to 45.6$. Gap widens from $+8.1$ to $+17.2$.

**Gemini Flash 3.0 / Sonnet 4.6** ($n = 4$/condition)
- Base slope $+0.041$ (SD $0.043$), recog slope $-0.047$ (SD $0.128$); base flat, recog declines. Welch's $t(3.7) = -1.31$.
- Rubric aggregate: base $24.7 \to 24.7$, recog $64.4 \to 55.3$. Gap narrows from $+39.7$ to $+30.6$.

**Gemini Flash 3.0 / GPT-5.4** ($n = 4$/condition, SAME dialogues as above)
- Base slope $+0.003$ (SD $0.020$), recog slope $-0.005$ (SD $0.092$); both flat. Welch's $t(3.3) = -0.16$.
- Rubric aggregate: base $30.9 \to 24.4$, recog $60.0 \to 47.8$. Gap narrows from $+29.1$ to $+23.4$.

## Verdict

**Fails to replicate**. Three independent reasons:

1. **Three of four (model × judge) cells are below the $d = 0.5$ "fails" threshold** ($-0.18$, $-0.93$, $-0.11$). Only one cell ($d = +1.85$) reaches "replicates."
2. **The one replicating cell (Haiku/GPT-5.4) is contradicted by the secondary judge on the same 8 dialogues** (Sonnet $d = -0.18$, $\Delta d = 2.03$). The pre-registered §4.3 rule fires: "consider the finding unreplicated regardless of primary-judge $d$."
3. **Gemini Flash/Sonnet shows the effect in the *opposite* direction** ($d = -0.93$), which is consistent with the M3 null + a calibration main effect (recog starts higher, declines more) but explicitly inconsistent with the M3 hypothesis.

The original $d = 1.63$ on DeepSeek/Sonnet is plausibly a DeepSeek × Sonnet-specific artifact — a joint interaction between a particular generation model and a particular judge on a particular 10-turn scenario. Not ruled out as a real effect in those exact conditions, but ruled out as a validated mechanism.

## Judge-sensitivity as a secondary finding

The Haiku $\Delta d = 2.03$ between Sonnet and GPT-5.4 on identical rows is substantially larger than the judge-variation documented in Paper 2.0 §8.3 for the main factorial ($\Delta d$ range $0.47$-$0.58$). This suggests the disengagement-scenario + 10-turn-trajectory combination elicits a judge-specific pattern of trajectory reading that exceeds normal leniency calibration differences:

- Sonnet reads both Haiku conditions as steadily declining (both slopes $\approx -0.02$ on 1-5 scale).
- GPT-5.4 reads base as declining but recognition as climbing (slopes $-0.022$ vs $+0.053$).

Same tutor turns, same 8 dialogues. This is a methodological finding about LLM-as-judge evaluation in extended multi-turn settings: trajectory-slope estimates are substantially less judge-robust than level estimates ($\Delta d$ on levels is ~0.2-0.3 in these data, vs $\Delta d \approx 2$ on slopes). Paper §8.2 and §8.3 already flag judge-model sensitivity as a concern; A12 sharpens that concern specifically for slope-based analyses in extended-turn scenarios.

## Paper implications (v3.0.45)

Under the pre-registered "fails to replicate on both models" branch:
- Retire disengagement hedging from abstract, §1 contribution bullet, §3 preface, §3.2 note-on-evidence, §7 intro, §7.8.2, §9 closer.
- Keep §6.3.2 canonical treatment as descriptive DeepSeek/Sonnet data **plus** an A12 replication-failure paragraph reporting the matrix above.
- Update `figure-disengagement-divergence.png` caption: "This pattern is DeepSeek/Sonnet-specific. A12 replication ($N = 16$, Haiku 4.5 and Gemini Flash 3.0, Sonnet 4.6 and GPT-5.4 judges) failed on 3 of 4 cells; the 1 replicating cell was judge-sensitive ($\Delta d = 2.03$) and thus unreplicated by pre-registered rule."
- §6.4.3 mechanism separability table: move adaptive_responsiveness row from "exploratory conditional" to clean "Not supported."
- Add judge-sensitivity observation to §8.2 LLM-as-judge limitations (new paragraph on slope-estimate robustness).

## Cost

Generation: ~\$3 OpenRouter (small runs on Haiku + Gemini Flash, 160 turns total).
Judging: \$0 Sonnet (Claude Code subscription) + ~\$4 GPT-5.4 rejudge.
Total: ~\$7.

## Reproducibility

```bash
# Haiku sub-run
node scripts/eval-cli.js run \
  --profiles cell_80_messages_base_single_unified,cell_84_messages_recog_single_unified \
  --runs 4 --scenarios trajectory_disengagement_to_ownership \
  --ego-model openrouter.haiku \
  --description "A12 M3 disengagement replication on Haiku 4.5"

# Gemini Flash sub-run
node scripts/eval-cli.js run \
  --profiles cell_80_messages_base_single_unified,cell_84_messages_recog_single_unified \
  --runs 4 --scenarios trajectory_disengagement_to_ownership \
  --ego-model openrouter.gemini-flash \
  --description "A12 M3 disengagement replication on Gemini Flash 3.0"

# Judge both
node scripts/eval-cli.js evaluate eval-2026-04-22-d4547979    # Sonnet
node scripts/eval-cli.js evaluate eval-2026-04-22-f4fb03f1    # Sonnet
node scripts/eval-cli.js rejudge eval-2026-04-22-d4547979 --judge openrouter.gpt
node scripts/eval-cli.js rejudge eval-2026-04-22-f4fb03f1 --judge openrouter.gpt

# Analyze
node scripts/analyze-a12-disengagement-replication.js
```
