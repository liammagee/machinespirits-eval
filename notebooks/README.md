# Reproducibility Notebook

`reproduce-paper-findings.ipynb` independently reproduces all 17 tables and key statistical findings from the paper using the raw SQLite database and dialogue log files.

## Prerequisites

- Python 3.10+
- Jupyter (or JupyterLab)
- Required packages: `numpy`, `pandas`, `scipy`, `statsmodels`, `matplotlib`, `seaborn`

```bash
pip install numpy pandas scipy statsmodels matplotlib seaborn jupyterlab
```

## Obtaining the data

The evaluation database and dialogue logs are distributed as a GitHub Release artifact (~19 MB compressed). They are not included in the git repository.

1. Download `machinespirits-eval-data-v0.2.0.tar.gz` from the [v0.2.0 release](https://github.com/liammagee/machinespirits-eval/releases/tag/v0.2.0).

2. Extract from the repository root:

```bash
cd /path/to/machinespirits-eval
tar xzf machinespirits-eval-data-v0.2.0.tar.gz
```

This populates:
- `data/evaluations.db` — 3,458 scored evaluation rows across 21 experimental runs
- `logs/tutor-dialogues/*.json` — 654 dialogue log files with superego traces and transformation metrics

## Running the notebook

```bash
cd notebooks
jupyter lab reproduce-paper-findings.ipynb
```

Run all cells in order. The first code cell checks for the data files and prints download instructions if they are missing.

## What it reproduces

| Section | Paper Table | Content |
|---------|------------|---------|
| 1 | Table 1 | Model configuration per run |
| 2 | Table 2 | Sample summary |
| 3 | Table 3 | Inter-judge reliability |
| 4 | Table 4 | Recognition validation (N=36) |
| 5 | Table 5 | Full factorial ANOVA (N=342) |
| 6 | Table 6 | A x B interaction |
| 7 | Tables 7-8 | Domain generalizability |
| 8 | Table 9 | Superego rejection patterns |
| 9 | Table 10 | Dimension effect sizes |
| 10 | Table 11 | Standard dimensions only |
| 11 | Table 12 | Multi-turn scenarios |
| 12 | Table 13 | Bilateral transformation |
| 13 | Tables 14-15 | Lexical analysis |
| 14 | Table 16 | Thematic coding |
| 15 | Table 17 | Cost-benefit analysis |
| 16 | — | Transcript excerpts |
| 17 | — | Concordance check (computed vs paper values) |
