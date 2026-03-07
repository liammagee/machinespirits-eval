#!/usr/bin/env python3
"""
Generate M3 trajectory divergence and M1/M2 mechanism isolation figures.

Creates two publication-quality figures for Paper 2.0:
  1. figure-disengagement-divergence.png  - M3 conditional effect (§6.3.2)
  2. figure-mechanism-isolation.png       - M1/M2 2x2 isolation (§6.4.2)

Run: python3 scripts/generate-m3-m2-figures.py
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

# Match generate-paper2-figures.py styling exactly
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

BASE_COLOR = '#95a5a6'
RECOG_COLOR = '#2ecc71'
DARK_GREEN = '#1a7a3a'
SINGLE_COLOR = '#9b59b6'
MULTI_COLOR = '#1abc9c'

M3_RUN = 'eval-2026-03-06-ebcd6de0'
M2_RUN = 'eval-2026-03-06-768ba77b'
M1_RUN = 'eval-2026-03-06-e4abd0df'


def get_db():
    conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn


# ── Figure 1: Disengagement Trajectory Divergence (§6.3.2) ──────────────────

def figure_disengagement_divergence():
    """Two-panel figure: (a) per-turn trajectories, (b) gap widening."""
    db = get_db()

    # Load all rows from the disengagement scenario
    rows = db.execute("""
        SELECT profile_name, tutor_scores
        FROM evaluation_results
        WHERE run_id = ?
          AND scenario_name LIKE '%Disengagement%'
          AND tutor_scores IS NOT NULL
    """, (M3_RUN,)).fetchall()
    db.close()

    # Extract per-turn scores by condition
    base_turns = defaultdict(list)
    recog_turns = defaultdict(list)

    for row in rows:
        profile = row['profile_name']
        ts = json.loads(row['tutor_scores'])
        is_recog = 'recog' in profile
        target = recog_turns if is_recog else base_turns
        for turn_key, turn_data in ts.items():
            if 'overallScore' in turn_data:
                target[int(turn_key)].append(turn_data['overallScore'])

    max_turn = max(max(base_turns.keys()), max(recog_turns.keys()))
    turns = list(range(max_turn + 1))

    base_means = [np.mean(base_turns[t]) for t in turns]
    recog_means = [np.mean(recog_turns[t]) for t in turns]
    base_sems = [np.std(base_turns[t]) / np.sqrt(len(base_turns[t])) for t in turns]
    recog_sems = [np.std(recog_turns[t]) / np.sqrt(len(recog_turns[t])) for t in turns]
    gaps = [r - b for r, b in zip(recog_means, base_means)]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.5),
                                    gridspec_kw={'width_ratios': [3, 2]})

    # ── Panel (a): Per-turn trajectories ──
    ax1.plot(turns, recog_means, 's-', color=RECOG_COLOR, linewidth=2.5,
             markersize=8, label='Recognition', markeredgecolor='white', markeredgewidth=1.5)
    ax1.fill_between(turns,
                     [m - s for m, s in zip(recog_means, recog_sems)],
                     [m + s for m, s in zip(recog_means, recog_sems)],
                     alpha=0.15, color=RECOG_COLOR)

    ax1.plot(turns, base_means, 'o-', color=BASE_COLOR, linewidth=2.5,
             markersize=8, label='Base', markeredgecolor='white', markeredgewidth=1.5)
    ax1.fill_between(turns,
                     [m - s for m, s in zip(base_means, base_sems)],
                     [m + s for m, s in zip(base_means, base_sems)],
                     alpha=0.15, color=BASE_COLOR)

    # Annotate the late-stage surge region
    ax1.axvspan(7.5, 10.5, alpha=0.06, color=RECOG_COLOR, zorder=0)
    ax1.annotate('Late-stage\nrecognition surge',
                xy=(9, 70), fontsize=9, color=DARK_GREEN,
                ha='center', style='italic',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='#e8f5e9', alpha=0.8))

    # Annotate T0 and T10 values
    ax1.annotate(f'{recog_means[0]:.0f}', (0, recog_means[0]),
                textcoords='offset points', xytext=(8, 8),
                fontsize=9, color=DARK_GREEN, fontweight='bold')
    ax1.annotate(f'{recog_means[-1]:.0f}', (10, recog_means[-1]),
                textcoords='offset points', xytext=(8, -5),
                fontsize=9, color=DARK_GREEN, fontweight='bold')
    ax1.annotate(f'{base_means[0]:.0f}', (0, base_means[0]),
                textcoords='offset points', xytext=(8, -12),
                fontsize=9, color='#555')
    ax1.annotate(f'{base_means[-1]:.0f}', (10, base_means[-1]),
                textcoords='offset points', xytext=(8, -5),
                fontsize=9, color='#555')

    ax1.set_xlabel('Turn Number')
    ax1.set_ylabel('Mean Tutor Score (0-100)')
    ax1.set_title('(a) Tutor Trajectories', fontsize=12, fontweight='bold')
    ax1.set_xticks(turns)
    ax1.set_ylim(0, 85)
    ax1.legend(loc='upper left', fontsize=10)

    # ── Panel (b): Gap widening ──
    colors = ['#b0bec5'] * 8 + [RECOG_COLOR] * 3  # Gray early, green late
    bars = ax2.bar(turns, gaps, color=colors, edgecolor='white', linewidth=0.5)

    # Annotate key gaps
    for t in [0, 7, 8, 9, 10]:
        if t <= max_turn:
            ax2.annotate(f'{gaps[t]:+.0f}',
                        (t, gaps[t]), textcoords='offset points',
                        xytext=(0, 5), ha='center', fontsize=8,
                        fontweight='bold' if t >= 8 else 'normal',
                        color=DARK_GREEN if t >= 8 else '#555')

    # Add a horizontal line at mean early gap
    early_gap = np.mean(gaps[:8])
    late_gap = np.mean(gaps[8:])
    ax2.axhline(y=early_gap, color=BASE_COLOR, linestyle='--', linewidth=1, alpha=0.7)
    ax2.annotate(f'T0-T7 avg: {early_gap:+.1f}',
                xy=(3.5, early_gap), textcoords='offset points', xytext=(0, -15),
                fontsize=9, color='#777', ha='center')
    ax2.axhline(y=late_gap, color=DARK_GREEN, linestyle='--', linewidth=1, alpha=0.7)
    ax2.annotate(f'T8-T10 avg: {late_gap:+.1f}',
                xy=(9, late_gap), textcoords='offset points', xytext=(0, 8),
                fontsize=9, color=DARK_GREEN, ha='center', fontweight='bold')

    ax2.set_xlabel('Turn Number')
    ax2.set_ylabel('Recognition - Base Gap (pts)')
    ax2.set_title('(b) Gap Widening', fontsize=12, fontweight='bold')
    ax2.set_xticks(turns)
    ax2.set_ylim(-5, 45)

    fig.suptitle('Disengagement to Ownership: Conditional M3 Effect (10-turn, N=24)',
                 fontsize=14, fontweight='bold', y=1.02)
    fig.text(0.5, -0.02,
             'Recognition produces steeper improvement (d = 1.63, p < .001). '
             'The gap widens from +12 pts (T0) to +35 pts (T8-T10) during the '
             'designed ownership transition.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-disengagement-divergence.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Figure 2: Mechanism Isolation 2×2 (§6.4.2) ──────────────────────────────

def figure_mechanism_isolation():
    """2x2 bar chart: Neither / M2 only / M1 only / Both."""
    db = get_db()

    trajectory_scenarios = [
        'Trajectory: Confusion → Insight Arc (8-turn)',
        'Trajectory: Disengagement → Ownership Arc (10-turn)',
        'Trajectory: Overconfidence → Humility Arc (8-turn)',
    ]

    conditions = {
        'Neither\n(base, single)': {
            'run': M3_RUN, 'cells': ('cell_80%', 'cell_81%'),
        },
        'M2 only\n(base + superego)': {
            'run': M3_RUN, 'cells': ('cell_82%', 'cell_83%'),
        },
        'M1 only\n(recog, no superego)': {
            'run': M3_RUN, 'cells': ('cell_84%', 'cell_85%'),
        },
        'Both\n(recog + superego)': {
            'run': M3_RUN, 'cells': ('cell_86%', 'cell_87%'),
        },
    }

    cond_scores = {}
    for label, spec in conditions.items():
        scores = []
        for cell_pat in spec['cells']:
            for scen in trajectory_scenarios:
                rows = db.execute("""
                    SELECT tutor_first_turn_score FROM evaluation_results
                    WHERE run_id = ? AND profile_name LIKE ? AND scenario_name = ?
                      AND tutor_first_turn_score IS NOT NULL
                """, (spec['run'], cell_pat, scen)).fetchall()
                scores.extend([r['tutor_first_turn_score'] for r in rows])
        cond_scores[label] = scores

    db.close()

    labels = list(cond_scores.keys())
    means = [np.mean(s) for s in cond_scores.values()]
    sems = [np.std(s) / np.sqrt(len(s)) for s in cond_scores.values()]
    ns = [len(s) for s in cond_scores.values()]

    # Colors: gray for neither, teal for M2, green for M1, blend for both
    bar_colors = [BASE_COLOR, MULTI_COLOR, RECOG_COLOR, DARK_GREEN]

    fig, ax = plt.subplots(figsize=(8, 5.5))

    x = np.arange(len(labels))
    bars = ax.bar(x, means, yerr=sems, capsize=5, color=bar_colors,
                  edgecolor='white', linewidth=1.5, width=0.65,
                  error_kw={'linewidth': 1.5, 'color': '#555'})

    # Value labels on bars
    for i, (bar, mean, n) in enumerate(zip(bars, means, ns)):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.5,
                f'{mean:.1f}', ha='center', va='bottom', fontsize=12,
                fontweight='bold', color=bar_colors[i])
        ax.text(bar.get_x() + bar.get_width() / 2, 2,
                f'n={n}', ha='center', va='bottom', fontsize=9, color='white',
                fontweight='bold')

    # Annotate the deltas
    # M2 effect under base: Neither -> M2
    mid_m2 = (means[0] + means[1]) / 2
    ax.annotate('', xy=(1, means[1] - 0.5), xytext=(0, means[0] + 0.5),
               arrowprops=dict(arrowstyle='->', color=MULTI_COLOR, lw=1.5))
    ax.text(0.5, mid_m2 - 4, f'+{means[1]-means[0]:.1f}\nd=1.13',
            ha='center', va='center', fontsize=9, color=MULTI_COLOR,
            fontweight='bold',
            bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.9))

    # M1 effect: Neither -> M1 (arc above)
    ax.annotate('', xy=(2, means[2] + 2), xytext=(0, means[0] + 2),
               arrowprops=dict(arrowstyle='->', color=RECOG_COLOR, lw=1.5,
                              connectionstyle='arc3,rad=-0.3'))
    ax.text(1.0, means[2] + 8, f'+{means[2]-means[0]:.1f}\nd=1.85',
            ha='center', va='center', fontsize=9, color=DARK_GREEN,
            fontweight='bold',
            bbox=dict(boxstyle='round,pad=0.2', facecolor='#e8f5e9', alpha=0.9))

    # M2 effect under recognition: M1 -> Both
    residual = means[3] - means[2]
    ax.annotate(f'+{residual:.1f} (NS)',
               xy=(3, means[3] + 2), xytext=(3, means[3] + 9),
               fontsize=9, color='#777', ha='center',
               arrowprops=dict(arrowstyle='->', color='#999', lw=1),
               bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.8))

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylabel('Mean Tutor Score (0-100)')
    ax.set_ylim(0, 68)

    ax.set_title('Mechanism Isolation: Calibration Dominates, Superego Pre-empted',
                fontsize=13, fontweight='bold')
    fig.text(0.5, -0.02,
             'The superego adds +9.2 pts under base (d = 1.13, p = .002) but only +1.1 '
             'under recognition (NS). Calibration pre-empts 88% of error correction. '
             'DeepSeek V3.2, Sonnet judge, 3 trajectory scenarios.',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure-mechanism-isolation.png')
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print(f'  -> {path}')


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(FIGURES_DIR, exist_ok=True)

    if not os.path.exists(DB_PATH):
        print(f'ERROR: Database not found at {DB_PATH}')
        sys.exit(1)

    print('Generating M3/M2 isolation figures...\n')
    figure_disengagement_divergence()
    figure_mechanism_isolation()
    print(f'\nDone. 2 figures generated in {FIGURES_DIR}/')


if __name__ == '__main__':
    main()
