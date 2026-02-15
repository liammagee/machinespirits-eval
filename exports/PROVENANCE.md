# Export Provenance Index

Generated: 2026-02-16

This document records the provenance of each export artifact: its source run(s),
coding/assessment model, scope, and which paper section it supports.

## Paper-Aligned Exports

### Transcript Assessments (Tables 20-21, 21b)

| File | Run ID | Model | Blinded | N | Paper Section |
|------|--------|-------|---------|---|---------------|
| transcript-assessment-eval-2026-02-07-b6d75e87.{json,jsonl,md} | eval-2026-02-07-b6d75e87 | claude-code (Opus) | No (unblinded); blinded replication in DB | 118 dialogues | 6.15, Tables 20-21, 21b |
| transcript-assessment-eval-2026-02-14-e0e3a622.{json,md} | eval-2026-02-14-e0e3a622 | claude-code (Opus) | No | 359 dialogues | 6.10 |

### Impasse Strategy Coding (Table 23, Figure 6)

| File | Run ID | Model | N | Paper Section |
|------|--------|-------|---|---------------|
| impasse-strategy-coding-2026-02-08T06-15-07.{json,md} | eval-2026-02-08-f896275d | claude-code (Opus) | 24 dialogues | 6.20 |
| impasse-strategy-coding-2026-02-08T08-41-44.{json,md} | eval-2026-02-08-f896275d | gpt (GPT-5.2) | 23 dialogues | 6.20 (cross-judge) |
| impasse-per-turn-coding-2026-02-08T08-09-21.{json,md} | eval-2026-02-08-f896275d | claude-code (Opus) | 24 dialogues, 2 turns each | 6.20 |

### Dialectical Modulation Coding (Section 6.8)

| File | Run ID | Model | N | Paper Section |
|------|--------|-------|---|---------------|
| dialectical-modulation-2026-02-12T03-52-00.{json,md} | eval-2026-02-11-a54235ea | claude-code (Opus) | 90 dialogues (complete) | 6.8 |

### AI Thematic Analysis (Section 6.11)

| File | Run ID | Model | N | Paper Section |
|------|--------|-------|---|---------------|
| qualitative-ai-claude-code-sample300-2026-02-08.{json,md} | Multiple key runs | claude-code (Opus) | 300 responses (stratified sample) | 6.11 |

### Mechanism Process Traces (Section 6.10)

| File | Run ID | Model | N | Paper Section |
|------|--------|-------|---|---------------|
| mechanism-traces-eval-2026-02-14-e0e3a622.{json,md} | eval-2026-02-14-e0e3a622 | N/A (trace extraction) | 360 dialogues | 6.10 |
| mechanism-traces-eval-2026-02-14-6c033830.{json,md} | eval-2026-02-14-6c033830 | N/A (trace extraction) | 240 dialogues | 6.10 |

### Dynamic Rewrite Evolution Exports (Section 6.18)

| File | Run ID | N | Paper Section |
|------|--------|---|---------------|
| eval-eval-2026-02-05-49bb2017.md | eval-2026-02-05-49bb2017 | 27 scored | 6.18 |
| eval-eval-2026-02-05-daf60f79.md | eval-2026-02-05-daf60f79 | 26 scored | 6.18 |

### Dialogue Sequence Visualizations

HTML visualizations of individual dialogue sequences for qualitative inspection.

| File | Cell | Scenario | Source Run |
|------|------|----------|------------|
| sequence-cell_1_base_single_unified-mood_frustration_to_breakthrough-62.html | 1 (base) | Mood frustration | eval-2026-02-07-b6d75e87 |
| sequence-cell_6_recog_single_psycho-mutual_transformation_journey-86.html | 6 (recog) | Mutual transformation | eval-2026-02-07-b6d75e87 |
| sequence-cell_6_recog_single_psycho-mutual_transformation_journey-89.html | 6 (recog) | Mutual transformation | eval-2026-02-07-b6d75e87 |
| sequence-cell_8_recog_multi_psycho-mutual_transformation_journey-85.html | 8 (recog) | Mutual transformation | eval-2026-02-07-b6d75e87 |
| sequence-cell_8_recog_multi_psycho-mutual_transformation_journey-98.html | 8 (recog) | Mutual transformation | eval-2026-02-07-b6d75e87 |
| sequence-cell_62_base_dialectical_profile_bidirectional_psycho-misconception_correction_flow-89.html | 62 (base) | Misconception correction | eval-2026-02-14-6c033830 |

## Legacy Exports (exports/legacy/)

These artifacts were generated during development and are not directly referenced
by the current paper. They are preserved for historical completeness.

| File | Reason for Legacy Status |
|------|-------------------------|
| qualitative-analysis.{json,md} | Generated from full DB without run ID filter (N~8,430); paper tables use run-scoped assessments instead |
| dialectical-modulation-2026-02-12T01-28-51.{json,md} | Superseded by 03-52-00 (N=77 incomplete vs N=90 complete) |
| eval-eval-2026-02-01-b7d6dbbe-*.md | Development run, not in key evaluations |
| eval-eval-2026-02-02-b36ca803.md | Development run, not in key evaluations |
| eval-eval-2026-02-02-c4e9ddc3.md | Development run, deleted from DB |
| eval-eval-2026-02-02-c66019cb.md | Development run, not in key evaluations |
| eval-eval-2026-02-05-3a08cebf.md | Development run, deleted from DB |
| eval-eval-2026-02-06-43d185ac.md | Development run, deleted from DB |
| eval-eval-2026-02-06-f8fa7327.md | Nemotron confound run (DROPPED) |
