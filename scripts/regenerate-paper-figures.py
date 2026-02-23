#!/usr/bin/env python3
"""
Regenerate paper figures 4, 5, 7, 8 with corrected data/labels.

Figures use data from paper tables (hardcoded to match verified values).
Run: python scripts/regenerate-paper-figures.py
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import os

FIGURES_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'research', 'figures')

# Consistent styling
plt.rcParams.update({
    'font.size': 11,
    'axes.titlesize': 13,
    'axes.titleweight': 'bold',
    'figure.facecolor': 'white',
    'axes.facecolor': 'white',
    'savefig.facecolor': 'white',
    'savefig.bbox': 'tight',
    'savefig.dpi': 200,
})

GREEN = '#2ecc71'
RED = '#e74c3c'
BLUE = '#3498db'
ORANGE = '#f39c12'
LIGHT_GREEN = '#a8e6cf'
LIGHT_RED = '#ffb3b3'


def figure4():
    """Figure 4: Multi-Model A×B Probe (Table 8, N=655)"""
    models = ['Kimi K2.5', 'Nemotron', 'DeepSeek V3.2', 'GLM-4.7', 'Claude Haiku 4.5']
    ns = [179, 119, 120, 117, 120]
    recog_effect = [15.7, 16.0, 14.0, 17.8, 9.6]
    axb_interaction = [-2.3, -5.7, -1.4, -0.7, -1.6]

    fig, ax = plt.subplots(figsize=(10, 5.5))
    x = np.arange(len(models))
    width = 0.35

    bars1 = ax.bar(x - width/2, recog_effect, width, label='Recognition Effect (A)',
                   color=GREEN, edgecolor='white', linewidth=0.5)
    bars2 = ax.bar(x + width/2, axb_interaction, width, label='A×B Interaction',
                   color=RED, edgecolor='white', linewidth=0.5)

    # Value labels
    for bar, val in zip(bars1, recog_effect):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'+{val}', ha='center', va='bottom', fontsize=10, color='#1a7a3a', fontweight='bold')
    for bar, val in zip(bars2, axb_interaction):
        y = val - 0.5 if val < 0 else val + 0.5
        ax.text(bar.get_x() + bar.get_width()/2, y,
                f'{val}', ha='center', va='top' if val < 0 else 'bottom',
                fontsize=10, color='#c0392b', fontweight='bold')

    ax.set_ylabel('Effect Size (points)', fontsize=12)
    ax.set_title('Figure 4: Architecture is Additive, Not Synergistic\n'
                 '(Multi-Model A×B Probe, N=655, Opus Judge)', fontsize=13, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([f'{m}\n(N={n})' for m, n in zip(models, ns)], fontsize=10)
    ax.legend(loc='upper right', fontsize=10)
    ax.axhline(y=0, color='gray', linewidth=0.5)
    ax.set_ylim(-8, 22)

    mean_axb = np.mean(axb_interaction)
    fig.text(0.5, 0.01,
             f'Recognition effect replicates across all 5 models (+9.6 to +17.8). '
             f'A×B interaction is negligible (mean {mean_axb:.1f} pts).',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout(rect=[0, 0.04, 1, 1])
    path = os.path.join(FIGURES_DIR, 'figure4.png')
    plt.savefig(path)
    plt.close()
    print(f'  -> {path}')


def figure5():
    """Figure 5: Factor Effects by Domain (Table 9, Kimi K2.5)"""
    factors = ['A: Recognition\nEffect', 'B: Multi-Agent\nEffect']
    philosophy = [15.7, 1.0]
    elementary = [8.2, 2.3]

    fig, ax = plt.subplots(figsize=(9, 4.5))
    y = np.arange(len(factors))
    height = 0.3

    bars1 = ax.barh(y - height/2, philosophy, height, label=f'Philosophy (Kimi, N=179)',
                    color=BLUE, edgecolor='white')
    bars2 = ax.barh(y + height/2, elementary, height, label=f'Elementary Math (Kimi, N=60)',
                    color=ORANGE, edgecolor='white')

    for bar, val in zip(bars1, philosophy):
        ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                f'+{val}', ha='left', va='center', fontsize=11, fontweight='bold', color='#2471a3')
    for bar, val in zip(bars2, elementary):
        ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                f'+{val}', ha='left', va='center', fontsize=11, fontweight='bold', color='#b8860b')

    ax.set_xlabel('Effect Size (points)', fontsize=12)
    ax.set_title('Figure 5: Factor Effects by Domain (Kimi K2.5)', fontsize=13, fontweight='bold')
    ax.set_yticks(y)
    ax.set_yticklabels(factors, fontsize=11)
    ax.legend(loc='lower right', fontsize=10)
    ax.set_xlim(0, 18.5)

    fig.text(0.5, 0.01,
             'Recognition dominates in both domains. Architecture provides small additive benefit\n'
             'on elementary content (+2.3 pts) and negligible effect on philosophy (+1.0 pts).',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout(rect=[0, 0.06, 1, 1])
    path = os.path.join(FIGURES_DIR, 'figure5.png')
    plt.savefig(path)
    plt.close()
    print(f'  -> {path}')


def figure7():
    """Figure 7: Persona × Recognition (Table 14, Dialectical Multi-Turn, N=90)"""
    personas = ['Suspicious', 'Adversary', 'Advocate']
    base = [67.9, 68.6, 67.5]
    recog = [68.8, 74.8, 73.9]
    deltas = [r - b for r, b in zip(recog, base)]

    fig, ax = plt.subplots(figsize=(9, 5.5))
    x = np.arange(len(personas))
    width = 0.3

    bars_base = ax.bar(x - width/2, base, width, label='Base', color='#95a5a6', edgecolor='white')
    bars_recog = ax.bar(x + width/2, recog, width, label='Recognition', color=GREEN, edgecolor='white')

    for bar, val in zip(bars_base, base):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
                f'{val}', ha='center', va='bottom', fontsize=10, color='#555')
    for bar, val, delta in zip(bars_recog, recog, deltas):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
                f'{val}', ha='center', va='bottom', fontsize=10, color='#1a7a3a', fontweight='bold')
        # Delta label below
        ax.text(bar.get_x() + bar.get_width()/2, 75.5,
                f'+{delta:.1f}', ha='center', va='bottom', fontsize=10, color=RED, fontweight='bold')

    ax.set_ylabel('Mean Score', fontsize=12)
    ax.set_title('Figure 7: Superego Persona × Recognition\n'
                 '(Dialectical Multi-Turn, N=90, Opus Judge)', fontsize=13, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels(personas, fontsize=11)
    ax.legend(loc='upper left', fontsize=10)
    ax.set_ylim(65, 78)

    fig.text(0.5, 0.01,
             'Adversary (+6.2) and advocate (+6.4) benefit from recognition; '
             'suspicious shows minimal change (+0.9).\n'
             'Multi-turn interaction rescues adversary from single-turn inversion (−11.3 → +6.2).',
             ha='center', fontsize=9, color='gray', style='italic')

    plt.tight_layout(rect=[0, 0.06, 1, 1])
    path = os.path.join(FIGURES_DIR, 'figure7.png')
    plt.savefig(path)
    plt.close()
    print(f'  -> {path}')


def figure8():
    """Figure 8: Mechanism Differentiation — Scripted vs Dynamic (Tables 18 & 19)"""
    # Scripted learner recognition scores (Table 18, sorted ascending)
    scripted_mechs = [
        'Self-reflect\n(advocate)', 'Erosion\ndetection', 'Intersubjective',
        'Self-reflect\n(suspicious)', 'Combined', 'Profiling\n(tutor-only)',
        'Quantitative\ndisposition', 'Self-reflect\n(adversary)', 'Profiling\n(bidirectional)'
    ]
    scripted_recog = [90.3, 90.8, 91.7, 92.1, 92.4, 92.4, 92.6, 92.6, 92.7]

    # Dynamic learner recognition scores (Table 19, sorted ascending)
    dynamic_mechs = ['Intersubjective', 'Self-reflect', 'Combined', 'Profiling']
    dynamic_recog = [82.8, 85.9, 87.8, 88.8]
    dynamic_colors = [RED, ORANGE, ORANGE, GREEN]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # Scripted panel
    scripted_range = max(scripted_recog) - min(scripted_recog)
    colors_s = [plt.cm.Greens(0.3 + 0.5 * (v - min(scripted_recog)) / scripted_range) for v in scripted_recog]
    bars1 = ax1.barh(range(len(scripted_mechs)), scripted_recog, color=colors_s, edgecolor='white')
    for bar, val in zip(bars1, scripted_recog):
        ax1.text(bar.get_width() + 0.2, bar.get_y() + bar.get_height()/2,
                 f'{val}', ha='left', va='center', fontsize=9)
    ax1.set_xlim(80, 96)
    ax1.set_xlabel('Mean Score (Recognition)', fontsize=10)
    ax1.set_title(f'Scripted Learner (N=360)\n{scripted_range:.1f}-pt range', fontsize=12, fontweight='bold')
    ax1.set_yticks(range(len(scripted_mechs)))
    ax1.set_yticklabels(scripted_mechs, fontsize=9)
    # Shade the range band
    ax1.axvspan(min(scripted_recog), max(scripted_recog), alpha=0.08, color='green')

    # Dynamic panel
    dynamic_range = max(dynamic_recog) - min(dynamic_recog)
    bars2 = ax2.barh(range(len(dynamic_mechs)), dynamic_recog, color=dynamic_colors, edgecolor='white')
    for bar, val in zip(bars2, dynamic_recog):
        ax2.text(bar.get_width() + 0.2, bar.get_y() + bar.get_height()/2,
                 f'{val}', ha='left', va='center', fontsize=10, fontweight='bold')
    ax2.set_xlim(80, 96)
    ax2.set_xlabel('Mean Score (Recognition)', fontsize=10)
    ax2.set_title(f'Dynamic Learner (N=300)\n{dynamic_range:.1f}-pt range', fontsize=12, fontweight='bold')
    ax2.set_yticks(range(len(dynamic_mechs)))
    ax2.set_yticklabels(dynamic_mechs, fontsize=10)
    # Shade the range band
    ax2.axvspan(min(dynamic_recog), max(dynamic_recog), alpha=0.08, color='#f5deb3')

    fig.suptitle('Figure 8: Mechanism Differentiation — Scripted vs Dynamic Learner',
                 fontsize=14, fontweight='bold', y=1.02)

    plt.tight_layout()
    path = os.path.join(FIGURES_DIR, 'figure8.png')
    plt.savefig(path)
    plt.close()
    print(f'  -> {path}')


if __name__ == '__main__':
    os.makedirs(FIGURES_DIR, exist_ok=True)
    print('Regenerating corrected figures...\n')
    figure4()
    figure5()
    figure7()
    figure8()
    print('\nDone. 4 figures regenerated.')
