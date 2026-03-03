#!/usr/bin/env python3
"""
Generate Paper 2.0 figures from evaluation data.

Creates publication-quality charts from cells 80-87, v2.2 rubric data.
All figures are written to docs/research/figures/ with descriptive names.

Run: python3 scripts/generate-paper2-figures.py

Figures generated:
  1. figure-calibration-variance.png      - Within-response dimension variance (§6.1.1)
  2. figure-dimension-lifting.png         - Floor-lifting by dimension (§6.1.2)
  3. figure-architecture-interaction.png   - 2x2 factorial interaction (§6.1.3, §6.4.1)
  4. figure-error-correction.png          - Superego approval rates + critique shift (§6.2)
  5. figure-trajectory-curves.png         - Tutor score trajectories across turns (§6.3.2)
  6. figure-tutor-learner-asymmetry.png   - Effect size gap (§6.5.1)
  7. figure-cross-model-replication.png   - DeepSeek vs Haiku mechanism replication (§6.6)
  8. figure-variance-reduction.png        - Unified variance reduction pattern (§6.4.4)
  9. figure-development-trajectories.png  - First-to-last turn development (§6.3.1)
  10. figure-scenario-effects.png         - Scenario-dependent calibration (§6.1.4)
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import sqlite3
import json
import os
import sys
from collections import defaultdict

# ── Configuration ────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'evaluations.db')
FIGURES_DIR = os.path.join(SCRIPT_DIR, '..', 'docs', 'research', 'figures')

# Consistent publication styling
plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.sans-serif': ['Helvetica Neue', 'Arial', 'DejaVu Sans'],
    'font.size': 11,
    'axes.titlesize': 13,
    'axes.titleweight': 'bold',
    'axes.labelsize': 12,
    'xtick.labelsize': 10,
    'ytick.labelsize': 10,
    'legend.fontsize': 10,
    'figure.facecolor': 'white',
    'axes.facecolor': 'white',
    'axes.grid': True,
    'grid.alpha': 0.3,
    'grid.linewidth': 0.5,
    'savefig.facecolor': 'white',
    'savefig.bbox': 'tight',
    'savefig.dpi': 200,
})

# Color palette
BASE_COLOR = '#95a5a6'       # Gray for baseline
RECOG_COLOR = '#2ecc71'      # Green for recognition
DEEPSEEK_COLOR = '#3498db'   # Blue for DeepSeek
HAIKU_COLOR = '#e67e22'      # Orange for Haiku
SINGLE_COLOR = '#9b59b6'     # Purple for single-agent
MULTI_COLOR = '#1abc9c'      # Teal for multi-agent
TUTOR_COLOR = '#2980b9'      # Blue for tutor
LEARNER_COLOR = '#e74c3c'    # Red for learner
DARK_GREEN = '#1a7a3a'
DARK_RED = '#c0392b'


# ── Data Loading ─────────────────────────────────────────────────────────────

def get_db():
    """Open read-only connection to evaluation database."""
    conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def load_factorial_data():
    """Load all v2.2 cells 80-87 data for DeepSeek and Haiku."""
    db = get_db()
    rows = db.execute("""
        SELECT id, profile_name, ego_model,
               tutor_first_turn_score, tutor_last_turn_score,
               tutor_overall_score,
               learner_overall_score, learner_holistic_overall_score,
               dialogue_quality_score,
               tutor_scores, learner_scores,
               scores_with_reasoning,
               tutor_deliberation_scores, tutor_deliberation_score,
               scenario_id
        FROM evaluation_results
        WHERE tutor_rubric_version = '2.2'
          AND tutor_first_turn_score IS NOT NULL
          AND profile_name LIKE 'cell_8%'
          AND (ego_model LIKE '%deepseek%' OR ego_model LIKE '%haiku%')
    """).fetchall()
    db.close()
    return rows


def classify_row(row):
    """Extract condition labels from a row."""
    profile = row['profile_name']
    model = 'DeepSeek' if 'deepseek' in row['ego_model'] else 'Haiku'
    condition = 'recog' if 'recog' in profile else 'base'
    arch = 'multi' if 'multi' in profile else 'single'
    return model, condition, arch


def extract_dimension_scores(row):
    """Extract per-dimension scores from scores_with_reasoning JSON."""
    try:
        data = json.loads(row['scores_with_reasoning'] or '{}')
        return {dim: info['score'] for dim, info in data.items() if 'score' in info}
    except (json.JSONDecodeError, TypeError):
        return {}


def extract_per_turn_scores(row, column='tutor_scores'):
    """Extract per-turn overall scores from tutor_scores/learner_scores JSON."""
    try:
        data = json.loads(row[column] or '{}')
        turns = {}
        for turn_key, turn_data in data.items():
            if isinstance(turn_data, dict) and 'overallScore' in turn_data:
                turns[int(turn_key)] = turn_data['overallScore']
        return turns
    except (json.JSONDecodeError, TypeError):
        return {}


def extract_per_turn_dimension_scores(row, column='tutor_scores'):
    """Extract per-turn per-dimension scores from tutor_scores JSON."""
    try:
        data = json.loads(row[column] or '{}')
        turns = {}
        for turn_key, turn_data in data.items():
            if isinstance(turn_data, dict) and 'scores' in turn_data:
                scores = {}
                for dim, info in turn_data['scores'].items():
                    if isinstance(info, dict) and 'score' in info:
                        scores[dim] = info['score']
                if scores:
                    turns[int(turn_key)] = scores
        return turns
    except (json.JSONDecodeError, TypeError):
        return {}


# ── Figure 1: Calibration — Within-Response Dimension Variance (§6.1.1) ─────

def figure_calibration_variance(rows):
    """Within-response dimension SD comparison across conditions and models."""
    # Compute within-response SD for each row
    data = defaultdict(list)
    for row in rows:
        model, condition, arch = classify_row(row)
        dim_scores = extract_dimension_scores(row)
        if len(dim_scores) >= 6:
            sd = np.std(list(dim_scores.values()))
            data[(model, condition, arch)].append(sd)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharey=True)

    for idx, model in enumerate(['DeepSeek', 'Haiku']):
        ax = axes[idx]
        conditions = ['base\nsingle', 'base\nmulti', 'recog\nsingle', 'recog\nmulti']
        keys = [(model, 'base', 'single'), (model, 'base', 'multi'),
                (model, 'recog', 'single'), (model, 'recog', 'multi')]
        colors = [BASE_COLOR, BASE_COLOR, RECOG_COLOR, RECOG_COLOR]
        hatches = ['', '//', '', '//']

        means = [np.mean(data[k]) if data[k] else 0 for k in keys]
        stds = [np.std(data[k]) / np.sqrt(len(data[k])) if len(data[k]) > 1 else 0 for k in keys]
        ns = [len(data[k]) for k in keys]

        bars = ax.bar(range(4), means, color=colors, edgecolor='gray', linewidth=0.5,
                      yerr=stds, capsize=4, error_kw={'linewidth': 1})
        for bar, h in zip(bars, hatches):
            bar.set_hatch(h)

        for i, (m, n) in enumerate(zip(means, ns)):
            ax.text(i, m + stds[i] + 0.01, f'{m:.3f}\n(N={n})',
                    ha='center', va='bottom', fontsize=9)

        ax.set_xticks(range(4))
        ax.set_xticklabels(conditions, fontsize=10)
        ax.set_title(f'{model}', fontsize=13, fontweight='bold')
        ax.set_ylabel('Within-Response Dim SD' if idx == 0 else '')

        # Add calibration d annotation
        base_vals = data[(model, 'base', 'single')] + data[(model, 'base', 'multi')]
        recog_vals = data[(model, 'recog', 'single')] + data[(model, 'recog', 'multi')]
        if base_vals and recog_vals:
            pooled_sd = np.sqrt((np.var(base_vals) + np.var(recog_vals)) / 2)
            if pooled_sd > 0:
                d = (np.mean(base_vals) - np.mean(recog_vals)) / pooled_sd
                ax.text(0.95, 0.95, f'Calibration\nd = {d:.2f}',
                        transform=ax.transAxes, ha='right', va='top',
                        fontsize=11, fontweight='bold', color=DARK_GREEN,
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='#e8f5e9', alpha=0.8))

    fig.suptitle('Within-Response Dimension Variance by Condition',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'Recognition narrows dimension profiles (lower SD = more uniform scores). '
             'Hatched bars = multi-agent architecture.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-calibration-variance.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 2: Dimension-Specific Floor Lifting (§6.1.2) ─────────────────────

def figure_dimension_lifting(rows):
    """Per-dimension means showing floor-lifting pattern."""
    DIMS_ORDER = [
        'productive_difficulty', 'elicitation_quality', 'recognition_quality',
        'perception_quality', 'epistemic_integrity', 'pedagogical_craft',
        'content_accuracy', 'adaptive_responsiveness'
    ]
    DIM_LABELS = [d.replace('_', '\n') for d in DIMS_ORDER]

    dim_data = defaultdict(lambda: defaultdict(list))
    for row in rows:
        model, condition, arch = classify_row(row)
        per_turn = extract_per_turn_dimension_scores(row, 'tutor_scores')
        # Use turn 0 scores for first-turn calibration analysis
        if 0 in per_turn:
            for dim, score in per_turn[0].items():
                dim_data[(model, condition)][dim].append(score)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6), sharey=True)

    for idx, model in enumerate(['DeepSeek', 'Haiku']):
        ax = axes[idx]
        base_means = [np.mean(dim_data[(model, 'base')].get(d, [0])) for d in DIMS_ORDER]
        recog_means = [np.mean(dim_data[(model, 'recog')].get(d, [0])) for d in DIMS_ORDER]
        lifts = [r - b for r, b in zip(recog_means, base_means)]

        x = np.arange(len(DIMS_ORDER))
        width = 0.35

        ax.bar(x - width/2, base_means, width, label='Base', color=BASE_COLOR,
               edgecolor='white', linewidth=0.5)
        bars_r = ax.bar(x + width/2, recog_means, width, label='Recognition',
                        color=RECOG_COLOR, edgecolor='white', linewidth=0.5)

        # Add lift annotations
        for i, (lift, rm) in enumerate(zip(lifts, recog_means)):
            color = DARK_GREEN if lift > 0.8 else '#666'
            weight = 'bold' if lift > 0.8 else 'normal'
            ax.text(i + width/2, rm + 0.08, f'+{lift:.2f}',
                    ha='center', va='bottom', fontsize=8, color=color, fontweight=weight)

        ax.set_xticks(x)
        ax.set_xticklabels(DIM_LABELS, fontsize=8)
        ax.set_title(f'{model}', fontsize=13, fontweight='bold')
        ax.set_ylabel('Mean Dimension Score (1-5)' if idx == 0 else '')
        ax.set_ylim(0, 5)
        ax.legend(loc='upper left', fontsize=9)

    fig.suptitle('Dimension-Specific Recognition Lift: Floor-Lifting Pattern',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'Weakest baseline dimensions (left) show largest recognition lift. '
             'Strongest baseline dimensions (right) show smallest lift.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-dimension-lifting.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 3: Architecture Interaction — The Substitution Pattern (§6.1.3) ──

def figure_architecture_interaction(rows):
    """2x2 factorial interaction plot showing substitution pattern.
    Uses tutor_overall_score (all-turn average) to match paper §6.1.3 numbers."""
    data = defaultdict(list)
    for row in rows:
        model, condition, arch = classify_row(row)
        # Use tutor_overall_score (all-turn average) as in the paper drafts
        score = row['tutor_overall_score'] if row['tutor_overall_score'] is not None else row['tutor_first_turn_score']
        data[(model, condition, arch)].append(score)

    fig, axes = plt.subplots(1, 2, figsize=(12, 5.5), sharey=False)

    for idx, model in enumerate(['DeepSeek', 'Haiku']):
        ax = axes[idx]

        # Means for the 2x2
        bs = np.mean(data[(model, 'base', 'single')])
        bm = np.mean(data[(model, 'base', 'multi')])
        rs = np.mean(data[(model, 'recog', 'single')])
        rm = np.mean(data[(model, 'recog', 'multi')])

        # Architecture delta labels
        base_delta = bm - bs
        recog_delta = rm - rs

        # Interaction plot (lines connecting single to multi)
        ax.plot([0, 1], [bs, bm], 'o-', color=BASE_COLOR, linewidth=2.5,
                markersize=10, label='Base', markeredgecolor='white', markeredgewidth=1.5)
        ax.plot([0, 1], [rs, rm], 's-', color=RECOG_COLOR, linewidth=2.5,
                markersize=10, label='Recognition', markeredgecolor='white', markeredgewidth=1.5)

        # Value annotations
        for x_pos, base_val, recog_val in [(0, bs, rs), (1, bm, rm)]:
            ax.annotate(f'{base_val:.1f}', (x_pos, base_val),
                       textcoords='offset points', xytext=(-25, -15),
                       fontsize=10, color='#555')
            ax.annotate(f'{recog_val:.1f}', (x_pos, recog_val),
                       textcoords='offset points', xytext=(-25, 10),
                       fontsize=10, color=DARK_GREEN, fontweight='bold')

        # Delta annotations
        mid_y_base = (bs + bm) / 2
        mid_y_recog = (rs + rm) / 2
        ax.annotate(f'$\\Delta$ = {base_delta:+.1f}',
                   xy=(0.5, mid_y_base), fontsize=11, color='#555',
                   ha='center', fontweight='bold',
                   bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))
        ax.annotate(f'$\\Delta$ = {recog_delta:+.1f}',
                   xy=(0.5, mid_y_recog), fontsize=11, color=DARK_GREEN,
                   ha='center', fontweight='bold',
                   bbox=dict(boxstyle='round,pad=0.2', facecolor='#e8f5e9', alpha=0.8))

        ax.set_xticks([0, 1])
        ax.set_xticklabels(['Single-Agent', 'Multi-Agent'], fontsize=11)
        ax.set_ylabel('Mean Tutor Score (0-100)' if idx == 0 else '')
        n_total = sum(len(data[(model, c, a)]) for c in ['base', 'recog'] for a in ['single', 'multi'])
        ax.set_title(f'{model} (N={n_total})', fontsize=13, fontweight='bold')
        ax.legend(loc='lower right' if model == 'DeepSeek' else 'lower left', fontsize=10)

    fig.suptitle('Architecture Interaction: Superego Benefit Collapses Under Recognition',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'Under base conditions, multi-agent adds +9 to +15 points. '
             'Under recognition, the benefit collapses to near-zero in both models.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-architecture-interaction.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 4: Error Correction — Approval Rates and Critique Shift (§6.2) ──

def figure_error_correction(rows):
    """Superego approval rate and critique category comparison."""
    # Hardcoded from verified data in §6.2 (extracted from dialogue logs)
    models = ['DeepSeek V3.2', 'Haiku 4.5']

    # Approval rates (%)
    base_approval = [13.3, 51.6]
    recog_approval = [55.1, 66.1]

    # Deliberation quality scores (0-100)
    base_delib = [45.7, 51.5]
    recog_delib = [27.2, 45.9]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # Panel A: Approval rates
    x = np.arange(len(models))
    width = 0.3

    bars_base = ax1.bar(x - width/2, base_approval, width, label='Base',
                        color=BASE_COLOR, edgecolor='white')
    bars_recog = ax1.bar(x + width/2, recog_approval, width, label='Recognition',
                         color=RECOG_COLOR, edgecolor='white')

    for bars, vals in [(bars_base, base_approval), (bars_recog, recog_approval)]:
        for bar, val in zip(bars, vals):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                    f'{val}%', ha='center', va='bottom', fontsize=10, fontweight='bold')

    # Add shift arrows
    for i in range(len(models)):
        shift = recog_approval[i] - base_approval[i]
        ax1.annotate(f'+{shift:.0f}pp',
                    xy=(i, max(base_approval[i], recog_approval[i]) + 6),
                    ha='center', fontsize=10, color=DARK_RED, fontweight='bold')

    ax1.set_xticks(x)
    ax1.set_xticklabels(models, fontsize=10)
    ax1.set_ylabel('Superego Approval Rate (%)')
    ax1.set_title('(a) Superego Approval Rate', fontsize=12, fontweight='bold')
    ax1.legend(loc='upper left', fontsize=10)
    ax1.set_ylim(0, 80)

    # Panel B: Deliberation quality
    bars_base2 = ax2.bar(x - width/2, base_delib, width, label='Base',
                         color=BASE_COLOR, edgecolor='white')
    bars_recog2 = ax2.bar(x + width/2, recog_delib, width, label='Recognition',
                          color=RECOG_COLOR, edgecolor='white')

    for bars, vals in [(bars_base2, base_delib), (bars_recog2, recog_delib)]:
        for bar, val in zip(bars, vals):
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                    f'{val:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

    # Add delta annotations
    for i in range(len(models)):
        delta = recog_delib[i] - base_delib[i]
        ax2.annotate(f'{delta:+.1f}',
                    xy=(i, max(base_delib[i], recog_delib[i]) + 4),
                    ha='center', fontsize=10, color=DARK_RED, fontweight='bold')

    ax2.set_xticks(x)
    ax2.set_xticklabels(models, fontsize=10)
    ax2.set_ylabel('Deliberation Quality Score (0-100)')
    ax2.set_title('(b) Deliberation Quality', fontsize=12, fontweight='bold')
    ax2.legend(loc='upper left', fontsize=10)
    ax2.set_ylim(0, 65)

    fig.suptitle('Error Correction: Recognition Pre-empts the Superego',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'When calibration handles the basics, the superego approves more (a) '
             'and deliberation becomes perfunctory (b).',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-error-correction.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 5: Trajectory Curves (§6.3.2) ────────────────────────────────────

def figure_trajectory_curves(rows):
    """Turn-by-turn tutor and learner score trajectories."""
    tutor_trajectories = defaultdict(lambda: defaultdict(list))
    learner_trajectories = defaultdict(lambda: defaultdict(list))

    for row in rows:
        model, condition, arch = classify_row(row)
        # Tutor per-turn scores
        tutor_turns = extract_per_turn_scores(row, 'tutor_scores')
        for turn, score in tutor_turns.items():
            tutor_trajectories[condition][turn].append(score)

        # Learner per-turn scores
        learner_turns = extract_per_turn_scores(row, 'learner_scores')
        for turn, score in learner_turns.items():
            learner_trajectories[condition][turn].append(score)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.5), sharey=True)

    # Panel A: Tutor trajectories
    for condition, color, label in [('recog', RECOG_COLOR, 'Recognition'),
                                     ('base', BASE_COLOR, 'Base')]:
        turns_data = tutor_trajectories[condition]
        turns = sorted(turns_data.keys())
        means = [np.mean(turns_data[t]) for t in turns]
        sems = [np.std(turns_data[t]) / np.sqrt(len(turns_data[t])) for t in turns]
        ns = [len(turns_data[t]) for t in turns]

        ax1.plot(turns, means, 'o-', color=color, linewidth=2, markersize=7, label=label)
        ax1.fill_between(turns,
                        [m - s for m, s in zip(means, sems)],
                        [m + s for m, s in zip(means, sems)],
                        alpha=0.2, color=color)

    ax1.set_xlabel('Turn Number')
    ax1.set_ylabel('Mean Score (0-100)')
    ax1.set_title('(a) Tutor Trajectories', fontsize=12, fontweight='bold')
    ax1.legend(loc='upper left', fontsize=10)

    # Panel B: Learner trajectories
    for condition, color, label in [('recog', RECOG_COLOR, 'Recognition'),
                                     ('base', BASE_COLOR, 'Base')]:
        turns_data = learner_trajectories[condition]
        turns = sorted(turns_data.keys())
        if not turns:
            continue
        means = [np.mean(turns_data[t]) for t in turns]
        sems = [np.std(turns_data[t]) / np.sqrt(len(turns_data[t])) for t in turns]

        ax2.plot(turns, means, 'o-', color=color, linewidth=2, markersize=7, label=label)
        ax2.fill_between(turns,
                        [m - s for m, s in zip(means, sems)],
                        [m + s for m, s in zip(means, sems)],
                        alpha=0.2, color=color)

    ax2.set_xlabel('Turn Number')
    ax2.set_title('(b) Learner Trajectories', fontsize=12, fontweight='bold')
    ax2.legend(loc='upper left', fontsize=10)

    fig.suptitle('Score Trajectories Across Turns (Pooled, N=309)',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'Recognition raises tutor level (+20 pts) but not slope (d = -0.00). '
             'Learner trajectories converge regardless of tutor condition.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-trajectory-curves.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 6: Tutor-Learner Asymmetry (§6.5.1) ─────────────────────────────

def figure_tutor_learner_asymmetry(rows):
    """Effect size comparison: tutor vs learner recognition effect."""
    data = defaultdict(lambda: defaultdict(list))
    for row in rows:
        model, condition, arch = classify_row(row)
        # Use tutor_overall_score (all-turn average) to match paper §6.5 numbers
        score = row['tutor_overall_score'] if row['tutor_overall_score'] is not None else row['tutor_first_turn_score']
        data[(model, condition)]['tutor'].append(score)
        if row['learner_overall_score'] is not None:
            data[(model, condition)]['learner'].append(row['learner_overall_score'])
        if row['dialogue_quality_score'] is not None:
            data[(model, condition)]['dialogue'].append(row['dialogue_quality_score'])

    fig, ax = plt.subplots(figsize=(10, 6))

    models = ['DeepSeek', 'Haiku']
    measures = ['Tutor', 'Learner', 'Dialogue']
    x = np.arange(len(measures))
    width = 0.3

    for i, model in enumerate(models):
        effect_sizes = []
        for measure_key in ['tutor', 'learner', 'dialogue']:
            base_vals = data[(model, 'base')][measure_key]
            recog_vals = data[(model, 'recog')][measure_key]
            if base_vals and recog_vals:
                pooled_sd = np.sqrt((np.var(base_vals, ddof=1) + np.var(recog_vals, ddof=1)) / 2)
                d = (np.mean(recog_vals) - np.mean(base_vals)) / pooled_sd if pooled_sd > 0 else 0
            else:
                d = 0
            effect_sizes.append(d)

        color = DEEPSEEK_COLOR if model == 'DeepSeek' else HAIKU_COLOR
        offset = -width/2 if i == 0 else width/2
        bars = ax.bar(x + offset, effect_sizes, width, label=model,
                      color=color, edgecolor='white', linewidth=0.5)

        for bar, d_val in zip(bars, effect_sizes):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.03,
                    f'd={d_val:.2f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

    # Reference lines
    ax.axhline(y=0.8, color='gray', linestyle='--', linewidth=0.7, alpha=0.5)
    ax.text(2.7, 0.83, 'large', fontsize=8, color='gray', style='italic')
    ax.axhline(y=0.5, color='gray', linestyle='--', linewidth=0.7, alpha=0.5)
    ax.text(2.7, 0.53, 'medium', fontsize=8, color='gray', style='italic')
    ax.axhline(y=0.2, color='gray', linestyle='--', linewidth=0.7, alpha=0.5)
    ax.text(2.7, 0.23, 'small', fontsize=8, color='gray', style='italic')

    ax.set_xticks(x)
    ax.set_xticklabels(measures, fontsize=12)
    ax.set_ylabel("Cohen's d (Recognition vs. Base)")
    ax.set_title('Tutor-Learner Asymmetry: Recognition Effect Sizes',
                 fontsize=14, fontweight='bold')
    ax.legend(loc='upper right', fontsize=10)

    fig.text(0.5, -0.02,
             'Recognition produces 7-12x larger effects on tutor quality than on learner quality. '
             'Dialogue quality tracks tutor quality.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-tutor-learner-asymmetry.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 7: Cross-Model Mechanism Replication (§6.6) ──────────────────────

def figure_cross_model_replication(rows):
    """Side-by-side mechanism indicator comparison across models."""
    # Hardcoded verified indicators from §6.6.2-6.6.3
    indicators = [
        'Recognition\nmain effect (d)',
        'Architecture\ncollapse (recog)',
        'Calibration\neffect (d)',
        'Approval rate\nshift (pp)',
        'Tutor-learner\nasymmetry ratio',
    ]

    # DeepSeek values (normalized to comparable scale)
    deepseek_vals = [1.88, 0.2, 0.52, 41.8, 7.5]
    haiku_vals = [1.84, -0.7, 0.64, 14.5, 11.5]

    fig, ax = plt.subplots(figsize=(12, 6))
    x = np.arange(len(indicators))
    width = 0.3

    bars1 = ax.bar(x - width/2, deepseek_vals, width, label='DeepSeek V3.2',
                   color=DEEPSEEK_COLOR, edgecolor='white')
    bars2 = ax.bar(x + width/2, haiku_vals, width, label='Haiku 4.5',
                   color=HAIKU_COLOR, edgecolor='white')

    for bars, vals in [(bars1, deepseek_vals), (bars2, haiku_vals)]:
        for bar, val in zip(bars, vals):
            y_pos = max(bar.get_height() + 0.3, 0.3) if val >= 0 else val - 0.5
            va = 'bottom' if val >= 0 else 'top'
            ax.text(bar.get_x() + bar.get_width()/2, y_pos,
                    f'{val:.1f}' if val != int(val) else f'{val:.0f}',
                    ha='center', va=va, fontsize=9, fontweight='bold')

    # Visual grouping: replicates vs model-dependent
    ax.axvspan(-0.5, 2.5, alpha=0.05, color='green')
    ax.axvspan(2.5, 4.5, alpha=0.05, color='orange')
    ax.text(1.0, ax.get_ylim()[1] * 0.92, 'REPLICATES',
            ha='center', fontsize=9, color=DARK_GREEN, fontweight='bold', alpha=0.7)
    ax.text(3.5, ax.get_ylim()[1] * 0.92, 'MODEL-DEPENDENT\nMAGNITUDE',
            ha='center', fontsize=8, color='#b8860b', fontweight='bold', alpha=0.7)

    ax.set_xticks(x)
    ax.set_xticklabels(indicators, fontsize=9)
    ax.set_ylabel('Indicator Value')
    ax.axhline(y=0, color='gray', linewidth=0.5)
    ax.set_title('Cross-Model Mechanism Replication: What Replicates vs. What Varies',
                 fontsize=13, fontweight='bold')
    ax.legend(loc='upper right', fontsize=10)

    fig.text(0.5, -0.02,
             'Direction replicates across models; magnitude varies with model capability.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-cross-model-replication.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 8: Unified Variance Reduction Pattern (§6.4.4) ───────────────────

def figure_variance_reduction(rows):
    """Multiple variance reduction indicators under recognition."""
    # Compute actual within-response dim SD from data
    dim_sd_data = defaultdict(lambda: defaultdict(list))
    score_data = defaultdict(lambda: defaultdict(list))

    for row in rows:
        model, condition, arch = classify_row(row)
        dim_scores = extract_dimension_scores(row)
        if len(dim_scores) >= 6:
            dim_sd_data[(model, condition)]['dim_sd'].append(np.std(list(dim_scores.values())))
        score_data[(model, condition)]['tutor'].append(row['tutor_first_turn_score'])

    indicators = ['Within-Response\nDim SD', 'Tutor Score SD']
    models = ['DeepSeek', 'Haiku']

    fig, ax = plt.subplots(figsize=(10, 6))

    x = np.arange(len(indicators))
    bar_width = 0.18

    for m_idx, model in enumerate(models):
        for c_idx, (condition, color) in enumerate([('base', BASE_COLOR), ('recog', RECOG_COLOR)]):
            offset = (m_idx * 2 + c_idx - 1.5) * bar_width

            vals = []
            # Dim SD
            dim_vals = dim_sd_data[(model, condition)]['dim_sd']
            vals.append(np.mean(dim_vals) if dim_vals else 0)

            # Score SD
            tutor_vals = score_data[(model, condition)]['tutor']
            vals.append(np.std(tutor_vals) if tutor_vals else 0)

            hatch = '//' if model == 'Haiku' else ''
            label_parts = [model, 'Recog' if condition == 'recog' else 'Base']
            bars = ax.bar(x + offset, vals, bar_width, color=color,
                         edgecolor='gray', linewidth=0.5, hatch=hatch,
                         label=f'{" / ".join(label_parts)}')

            for bar, val in zip(bars, vals):
                ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.15,
                        f'{val:.2f}' if val < 1 else f'{val:.1f}',
                        ha='center', va='bottom', fontsize=8, rotation=0)

    ax.set_xticks(x)
    ax.set_xticklabels(indicators, fontsize=11)
    ax.set_ylabel('Variance / Standard Deviation')
    ax.set_title('Variance Reduction Under Recognition: Multiple Indicators',
                 fontsize=13, fontweight='bold')
    ax.legend(loc='upper right', fontsize=8, ncol=2)

    fig.text(0.5, -0.02,
             'Recognition narrows the output distribution across multiple measures simultaneously.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-variance-reduction.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 9: Development Trajectories (§6.3.1) ────────────────────────────

def figure_development_trajectories(rows):
    """First-to-last turn development by condition and model."""
    data = defaultdict(list)
    for row in rows:
        model, condition, arch = classify_row(row)
        first = row['tutor_first_turn_score']
        last = row['tutor_last_turn_score']
        if first is not None and last is not None:
            dev = last - first
            data[(model, condition, arch)].append(dev)

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))

    for idx, model in enumerate(['DeepSeek', 'Haiku']):
        ax = axes[idx]
        conditions = [
            ('base', 'single'), ('base', 'multi'),
            ('recog', 'single'), ('recog', 'multi')
        ]
        labels = ['Base\nSingle', 'Base\nMulti', 'Recog\nSingle', 'Recog\nMulti']
        colors = [BASE_COLOR, BASE_COLOR, RECOG_COLOR, RECOG_COLOR]
        hatches = ['', '//', '', '//']

        means = []
        sems = []
        for cond, arch in conditions:
            vals = data[(model, cond, arch)]
            means.append(np.mean(vals) if vals else 0)
            sems.append(np.std(vals) / np.sqrt(len(vals)) if len(vals) > 1 else 0)

        bars = ax.bar(range(4), means, color=colors, edgecolor='gray', linewidth=0.5,
                      yerr=sems, capsize=4, error_kw={'linewidth': 1})
        for bar, h in zip(bars, hatches):
            bar.set_hatch(h)

        for i, (m, s) in enumerate(zip(means, sems)):
            color = DARK_GREEN if m > 0 else DARK_RED
            ax.text(i, m + s + 0.5 if m >= 0 else m - s - 0.5,
                    f'{m:+.1f}', ha='center',
                    va='bottom' if m >= 0 else 'top',
                    fontsize=10, fontweight='bold', color=color)

        ax.axhline(y=0, color='gray', linewidth=1)
        ax.set_xticks(range(4))
        ax.set_xticklabels(labels, fontsize=10)
        ax.set_ylabel('Development (Last - First Turn)' if idx == 0 else '')
        ax.set_title(f'{model}', fontsize=13, fontweight='bold')

    fig.suptitle('Tutor Development Trajectories: Model-Dependent, Not Prompt-Dependent',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'DeepSeek shows mixed development; Haiku shows consistently positive development. '
             'Hatched = multi-agent.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-development-trajectories.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 10: Scenario-Dependent Calibration (§6.1.4) ─────────────────────

def figure_scenario_effects(rows):
    """Recognition effect by scenario, showing impasse dominance."""
    scenario_data = defaultdict(lambda: defaultdict(list))
    for row in rows:
        model, condition, arch = classify_row(row)
        scenario = row['scenario_id']
        if scenario:
            # Use tutor_overall_score (all-turn average) to match paper §6.1.4 numbers
            score = row['tutor_overall_score'] if row['tutor_overall_score'] is not None else row['tutor_first_turn_score']
            scenario_data[(model, scenario, condition)]['tutor'].append(score)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    for idx, model in enumerate(['DeepSeek', 'Haiku']):
        ax = axes[idx]

        # Collect all scenarios for this model
        scenarios = set()
        for (m, s, c) in scenario_data.keys():
            if m == model:
                scenarios.add(s)

        scenario_deltas = []
        for s in scenarios:
            base_vals = scenario_data[(model, s, 'base')]['tutor']
            recog_vals = scenario_data[(model, s, 'recog')]['tutor']
            if base_vals and recog_vals:
                delta = np.mean(recog_vals) - np.mean(base_vals)
                base_mean = np.mean(base_vals)
                recog_mean = np.mean(recog_vals)
                n = len(base_vals) + len(recog_vals)
                # Clean up scenario name
                label = s.replace('_', ' ').replace('multi turn ', '').title()
                if len(label) > 30:
                    label = label[:27] + '...'
                scenario_deltas.append((label, delta, base_mean, recog_mean, n))

        # Sort by delta descending
        scenario_deltas.sort(key=lambda x: x[1], reverse=True)

        if not scenario_deltas:
            ax.text(0.5, 0.5, 'No scenario data', ha='center', va='center',
                    transform=ax.transAxes)
            continue

        labels = [s[0] for s in scenario_deltas]
        deltas = [s[1] for s in scenario_deltas]
        ns = [s[4] for s in scenario_deltas]

        # Color bars by type (impasse = red tones, others = blue tones)
        colors = []
        for label in labels:
            if 'impasse' in label.lower() or 'epistemic' in label.lower() or 'deadlock' in label.lower():
                colors.append('#e74c3c')
            elif 'mood' in label.lower() or 'frustration' in label.lower():
                colors.append('#3498db')
            else:
                colors.append('#9b59b6')

        y = np.arange(len(labels))
        bars = ax.barh(y, deltas, color=colors, edgecolor='white', linewidth=0.5)

        for bar, delta, n in zip(bars, deltas, ns):
            ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
                    f'+{delta:.1f} (N={n})', ha='left', va='center', fontsize=8)

        ax.set_yticks(y)
        ax.set_yticklabels(labels, fontsize=8)
        ax.set_xlabel('Recognition Delta (points)')
        ax.set_title(f'{model}', fontsize=13, fontweight='bold')
        ax.axvline(x=0, color='gray', linewidth=0.5)

    # Legend
    impasse_patch = mpatches.Patch(color='#e74c3c', label='Impasse scenarios')
    mood_patch = mpatches.Patch(color='#3498db', label='Mood scenarios')
    other_patch = mpatches.Patch(color='#9b59b6', label='Other scenarios')
    fig.legend(handles=[impasse_patch, mood_patch, other_patch],
              loc='lower center', ncol=3, fontsize=9, bbox_to_anchor=(0.5, -0.06))

    fig.suptitle('Scenario-Dependent Calibration: Impasse Scenarios Show Largest Effects',
                 fontsize=14, fontweight='bold', y=1.02)

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-scenario-effects.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(FIGURES_DIR, exist_ok=True)

    if not os.path.exists(DB_PATH):
        print(f'ERROR: Database not found at {DB_PATH}')
        sys.exit(1)

    print('Loading evaluation data...')
    rows = load_factorial_data()
    print(f'  Loaded {len(rows)} rows from cells 80-87 (DeepSeek + Haiku, v2.2)')

    # Classify and summarize
    summary = defaultdict(int)
    for row in rows:
        model, condition, arch = classify_row(row)
        summary[(model, condition, arch)] += 1
    print('\n  Data summary:')
    for (model, cond, arch), n in sorted(summary.items()):
        print(f'    {model} / {cond} / {arch}: N={n}')

    print(f'\nGenerating Paper 2.0 figures to {FIGURES_DIR}/\n')

    figure_calibration_variance(rows)
    figure_dimension_lifting(rows)
    figure_architecture_interaction(rows)
    figure_error_correction(rows)
    figure_trajectory_curves(rows)
    figure_tutor_learner_asymmetry(rows)
    figure_cross_model_replication(rows)
    figure_variance_reduction(rows)
    figure_development_trajectories(rows)
    figure_scenario_effects(rows)

    print(f'\nDone. 10 figures generated in {FIGURES_DIR}/')

    print('\n--- Figure Plan Summary ---')
    print('''
Paper 2.0 Figure Mapping:

  Paper 1.0 Figures (can be reused as-is for architecture):
    figure1.png - Ego/Superego Architecture    -> REUSE (architecture unchanged)
    figure2.png - Recognition vs Baseline Flow -> REUSE (flow unchanged)

  Paper 1.0 Figures (replaced with new data):
    figure3.png  -> figure-calibration-variance.png     (new: dim variance, not decomposition)
    figure4.png  -> figure-architecture-interaction.png  (new: 2x2 interaction, 2 models)
    figure5.png  -> figure-scenario-effects.png          (new: per-scenario, not per-domain)
    figure7.png  -> figure-error-correction.png          (new: approval rates, not persona)
    figure8.png  -> figure-cross-model-replication.png   (new: mechanism replication, not mech spread)

  New Paper 2.0 Figures (no Paper 1.0 equivalent):
    figure-dimension-lifting.png          (§6.1.2: floor-lifting pattern)
    figure-trajectory-curves.png          (§6.3.2: turn-by-turn trajectories)
    figure-tutor-learner-asymmetry.png    (§6.5.1: effect size gap)
    figure-variance-reduction.png         (§6.4.4: unified variance reduction)
    figure-development-trajectories.png   (§6.3.1: first-to-last development)

  Paper 1.0 Figures NOT regenerated (require non-DB sources):
    figure6.png  - Word clouds (requires qualitative coding rerun)
    figure9.png  - Qualitative tag divergence (requires qualitative rerun)
    figure10.png - Naive vs Base transcript (Paper 1.0 specific)
    figure11.png - Bilateral transcript comparison (use generate-paper-figures.js)
''')


if __name__ == '__main__':
    main()
