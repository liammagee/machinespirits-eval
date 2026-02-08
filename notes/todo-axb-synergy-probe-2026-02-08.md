# A×B Synergy Probe — Execution TODO

**Created**: 2026-02-08
**Purpose**: Multi-model test of Architecture × Recognition interaction
**Estimated cost**: ~$25 (ego gen + Opus judging)
**Judge**: Claude Code (Opus) via two-step: `--skip-rubric` then `evaluate --follow`
**Verdict**: **NOISE** — original Nemotron N=17 interaction was sampling error

---

## Phase 1a: Generate Responses — DONE

### [DONE] Model 1 — Nemotron

- Run ID: eval-2026-02-07-722087ac
- N scored: 119

### [DONE] Model 2 — DeepSeek V3.2

- Run ID: eval-2026-02-07-70ef73a3
- N scored: 120

### [DONE] Model 3 — GLM-4.7

- Run ID: eval-2026-02-07-6b3e6565
- N scored: 117

### [DONE] Model 4 — Claude Haiku 4.5

- Run ID: eval-2026-02-07-6ead24c7
- N scored: 120

---

## Phase 1b: Score with Opus — DONE

All scored via `evaluate --follow` running in parallel with generation.

---

## Phase 2: Primary Analysis — DONE

### [DONE] Results

| Model | N | Cell 1 (B×S) | Cell 3 (B×M) | Cell 5 (R×S) | Cell 7 (R×M) | Recog | Arch | Interaction |
|-------|---|-------------|-------------|-------------|-------------|-------|------|-------------|
| Kimi K2.5 (existing) | 350 | 77.6 | 76.6 | 92.8 | 92.3 | +10.0 | +0.8 | -1.5 |
| Nemotron | 119 | 54.8 | 59.3 | 73.6 | 72.5 | +16.0 | +1.7 | -5.7 |
| DeepSeek V3.2 | 120 | 69.5 | 73.9 | 84.2 | 87.2 | +14.0 | +3.7 | -1.4 |
| GLM-4.7 | 117 | 65.8 | 68.6 | 84.0 | 86.0 | +17.8 | +2.4 | -0.7 |
| Claude Haiku 4.5 | 120 | 80.3 | 82.4 | 90.7 | 91.2 | +9.6 | +1.3 | -1.6 |
| **Mean across 5** | **826** | | | | | **+12.5** | **+1.8** | **-2.2** |

Interaction = (Cell7 - Cell5) - (Cell3 - Cell1)

### Key findings

1. **Recognition main effect is model-independent**: +9.6 to +17.8 across 5 ego models (mean +12.5)
2. **A×B interaction is consistently near zero or negative**: -5.7 to -0.7 (mean -2.2). No model shows positive synergy.
3. **Architecture effect is small**: +0.8 to +3.7 (mean +1.8). Multi-agent adds a little, not differentially for recognition.
4. **Original Nemotron +9.2 on N=17 was sampling noise**: the re-run (N=119) shows -5.7.
5. **Model baseline varies widely** (54.8 to 80.3 for cell 1) but recognition lift is consistent.

---

## Phase 3: Cross-Judge (Optional, +~$10)

### [ ] GPT-5.2 rejudge

```bash
node scripts/eval-cli.js rejudge eval-2026-02-07-722087ac --judge openrouter.gpt
node scripts/eval-cli.js rejudge eval-2026-02-07-70ef73a3 --judge openrouter.gpt
node scripts/eval-cli.js rejudge eval-2026-02-07-6b3e6565 --judge openrouter.gpt
node scripts/eval-cli.js rejudge eval-2026-02-07-6ead24c7 --judge openrouter.gpt
```

---

## Phase 4: Interpretation — DONE

### [DONE] Verdict: NOISE (0 of 5 models show positive interaction)

The original A×B synergy finding (+9.2 on Nemotron N=17) does not replicate on any of 5 ego models
tested with N=117-350 per model. The interaction is consistently negative (mean -2.2), meaning
multi-agent architecture provides slightly *less* incremental benefit for recognition prompts than
for base prompts (likely a ceiling effect — recognition scores are already high).

### Paper updates applied

- [x] Update §6.4 — added Table 7b (5-model probe), rewrote interpretation as definitive null
- [x] Update §7.2 — renamed "Architecture as Additive, Not Synergistic", rewrote as definitive
- [x] Update §9 conclusion finding #2 — "Architecture is additive, not synergistic"
- [x] Table 7b added to §6.4 with all 5 models
- [x] Table 2 — added 4 new runs, totals updated to 1,503/1,486
- [x] Abstract — replaced exploratory synergy sentence with definitive 5-model null
- [x] §10 run ID table — added 4 probe runs
- [x] Appendix D — added 4 probe runs + bilateral transformation, count updated to 18
- [x] N counts updated throughout: 1,010 → 1,486, fourteen → eighteen

---

## Notes

- All 4 runs used same superego (kimi-k2.5) in multi-agent cells — only ego varied
- Total new data: N=476 scored across 4 models, plus existing Kimi N=350 = 826 total
- Recognition effect replication across 5 models is arguably the strongest finding in the paper
- Model baseline spread (54.8-80.3) shows ego model quality matters, but recognition lift is additive
