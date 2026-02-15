#!/usr/bin/env python3
"""Generate all paper figures from data.

Usage:
    python scripts/generate-paper-figures.py

Reads config/paper-manifest.json and queries data/evaluations.db to produce
data-driven figures. Falls back to hardcoded values if DB is unavailable.

Outputs PNGs to docs/research/figures/
"""

import os
import json
import sqlite3
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.join(SCRIPT_DIR, '..')
OUTPUT_DIR = os.path.join(ROOT_DIR, 'docs', 'research', 'figures')
MANIFEST_PATH = os.path.join(ROOT_DIR, 'config', 'paper-manifest.json')
DB_PATH = os.path.join(ROOT_DIR, 'data', 'evaluations.db')

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Data Layer ───────────────────────────────────────────────────────────────

_manifest = None
_db = None

def get_manifest():
    global _manifest
    if _manifest is None and os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            _manifest = json.load(f)
    return _manifest

def get_db():
    global _db
    if _db is None and os.path.exists(DB_PATH):
        _db = sqlite3.connect(DB_PATH)
        _db.row_factory = sqlite3.Row
    return _db

def query_cell_means(run_ids, judge_filter='claude-code%'):
    """Query mean overall_score per profile (cell) for given runs."""
    db = get_db()
    if not db:
        return {}
    placeholders = ','.join('?' * len(run_ids))
    rows = db.execute(f"""
        SELECT profile_name, AVG(overall_score) as mean, COUNT(*) as n,
               -- stdev via manual calculation
               AVG(overall_score * overall_score) - AVG(overall_score) * AVG(overall_score) as var
        FROM evaluation_results
        WHERE run_id IN ({placeholders})
          AND judge_model LIKE ?
          AND overall_score IS NOT NULL
        GROUP BY profile_name
    """, [*run_ids, judge_filter]).fetchall()
    return {r['profile_name']: {'mean': r['mean'], 'n': r['n'],
            'sd': (r['var'] ** 0.5) if r['var'] and r['var'] > 0 else 0}
            for r in rows}

def extract_cell_number(profile_name):
    """Extract cell number from profile_name like 'cell_5_recog_single_unified'."""
    parts = profile_name.split('_')
    if len(parts) >= 2 and parts[0] == 'cell':
        try:
            return int(parts[1])
        except ValueError:
            pass
    return None

def compute_2x2_effects(cell_means, base_single, base_multi, recog_single, recog_multi):
    """Compute recognition effect, architecture effect, and interaction from 4 cell means."""
    bs = cell_means.get(base_single, {}).get('mean')
    bm = cell_means.get(base_multi, {}).get('mean')
    rs = cell_means.get(recog_single, {}).get('mean')
    rm = cell_means.get(recog_multi, {}).get('mean')
    if None in (bs, bm, rs, rm):
        return None
    recog_effect = ((rs + rm) / 2) - ((bs + bm) / 2)
    arch_effect = ((bm + rm) / 2) - ((bs + rs) / 2)
    interaction = (rm - rs) - (bm - bs)
    return {'recog_effect': recog_effect, 'arch_effect': arch_effect,
            'interaction': interaction,
            'means': {'bs': bs, 'bm': bm, 'rs': rs, 'rm': rm}}

# Common styling
plt.rcParams.update({
    'font.size': 13,
    'axes.labelsize': 15,
    'axes.titlesize': 16,
    'xtick.labelsize': 12,
    'ytick.labelsize': 12,
    'legend.fontsize': 12,
    'figure.dpi': 300,
    'savefig.dpi': 300,
    'savefig.bbox': 'tight',
    'savefig.pad_inches': 0.3,
    'font.family': 'sans-serif',
})


def draw_box(ax, xy, width, height, text, facecolor='#E8E8E8', edgecolor='#333333',
             fontsize=12, fontweight='normal', text_color='black', alpha=1.0, zorder=2):
    """Draw a rounded box with centered text."""
    box = FancyBboxPatch(xy, width, height,
                         boxstyle="round,pad=0.02",
                         facecolor=facecolor, edgecolor=edgecolor,
                         linewidth=1.5, alpha=alpha, zorder=zorder)
    ax.add_patch(box)
    cx = xy[0] + width / 2
    cy = xy[1] + height / 2
    ax.text(cx, cy, text, ha='center', va='center',
            fontsize=fontsize, fontweight=fontweight, color=text_color, zorder=zorder + 1)


def draw_arrow(ax, start, end, color='#333333', style='->', lw=1.5, zorder=1):
    """Draw an arrow between two points."""
    ax.annotate('', xy=end, xytext=start,
                arrowprops=dict(arrowstyle=style, color=color, lw=lw),
                zorder=zorder)


# ── Figure 1: Ego/Superego Architecture ──────────────────────────────────────

def figure1():
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 7)
    ax.axis('off')
    ax.set_title('Figure 1: Ego/Superego Architecture', fontsize=16, fontweight='bold', pad=15)

    # Tutor system container
    container = FancyBboxPatch((0.3, 0.5), 8.9, 6.0,
                               boxstyle="round,pad=0.1",
                               facecolor='#F5F5F5', edgecolor='#666666',
                               linewidth=2, linestyle='--', zorder=0)
    ax.add_patch(container)
    ax.text(4.75, 6.2, 'Tutor System', ha='center', va='center',
            fontsize=15, fontweight='bold', color='#444444', zorder=1)

    # Writing Pad (Memory)
    draw_box(ax, (0.8, 3.5), 2.2, 1.2, 'Writing Pad\n(Memory)',
             facecolor='#D4E6F1', fontsize=12, fontweight='bold')

    # Ego
    draw_box(ax, (4.0, 3.5), 2.0, 1.2, 'Ego',
             facecolor='#ABEBC6', fontsize=14, fontweight='bold')

    # Superego
    draw_box(ax, (4.0, 1.2), 2.0, 1.2, 'Superego',
             facecolor='#F9E79F', fontsize=14, fontweight='bold')

    # Accept / Modify / Reject
    draw_box(ax, (7.0, 1.2), 2.0, 1.2, 'Accept /\nModify / Reject',
             facecolor='#FADBD8', fontsize=11, fontweight='bold')

    # Final Suggestion
    draw_box(ax, (7.0, 3.5), 2.0, 1.2, 'Final\nSuggestion',
             facecolor='#D5F5E3', fontsize=12, fontweight='bold')

    # Learner (outside container)
    draw_box(ax, (9.8, 3.5), 1.8, 1.2, 'Learner',
             facecolor='#D7BDE2', fontsize=14, fontweight='bold')

    # Arrows
    # Writing Pad -> Ego
    draw_arrow(ax, (3.0, 4.1), (4.0, 4.1))
    ax.text(3.5, 4.4, 'Memory\ntraces', ha='center', va='bottom', fontsize=10,
            fontstyle='italic', color='#555555')

    # Ego -> Superego
    draw_arrow(ax, (5.0, 3.5), (5.0, 2.4))
    ax.text(5.3, 2.95, 'Proposal', ha='left', va='center', fontsize=10, color='#555555')

    # Superego -> Accept/Modify/Reject
    draw_arrow(ax, (6.0, 1.8), (7.0, 1.8))
    ax.text(6.5, 2.0, 'Verdict', ha='center', va='bottom', fontsize=10, color='#555555')

    # Accept/Modify/Reject -> Ego (feedback loop)
    ax.annotate('', xy=(5.5, 3.5), xytext=(7.5, 2.4),
                arrowprops=dict(arrowstyle='->', color='#C0392B', lw=1.5,
                                connectionstyle='arc3,rad=0.3'),
                zorder=1)
    ax.text(7.0, 3.15, 'Revise', ha='center', va='center', fontsize=10,
            color='#C0392B', fontstyle='italic')

    # Accept -> Final Suggestion
    draw_arrow(ax, (8.0, 2.4), (8.0, 3.5), color='#27AE60')
    ax.text(8.3, 2.95, 'Accept', ha='left', va='center', fontsize=10, color='#27AE60')

    # Final Suggestion -> Learner
    draw_arrow(ax, (9.0, 4.1), (9.8, 4.1))

    # Learner feedback arrow (back to Writing Pad)
    ax.annotate('', xy=(1.9, 3.5), xytext=(10.7, 3.5),
                arrowprops=dict(arrowstyle='->', color='#7D3C98', lw=1.5,
                                connectionstyle='arc3,rad=-0.5',
                                linestyle='dashed'),
                zorder=1)
    ax.text(6.0, 0.85, 'Learner responses shape future encounters',
            ha='center', va='center', fontsize=10, fontstyle='italic', color='#7D3C98')

    fig.savefig(os.path.join(OUTPUT_DIR, 'figure1.png'))
    plt.close(fig)
    print('  figure1.png')


# ── Figure 2: Recognition vs. Baseline Response Flow ─────────────────────────

def figure2():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 8))
    fig.suptitle('Figure 2: Recognition vs. Baseline Response Flow', fontsize=16, fontweight='bold', y=0.97)

    for ax in (ax1, ax2):
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 10)
        ax.axis('off')

    # Common learner quote at top
    learner_quote = '"I think dialectics is\nlike a spiral..."'

    # ── Left: Baseline Flow ──
    ax1.set_title('Baseline Flow', fontsize=14, fontweight='bold', pad=10)
    base_color = '#D5D8DC'
    base_edge = '#5D6D7E'

    # Learner quote
    draw_box(ax1, (1.5, 8.2), 7, 1.1, learner_quote,
             facecolor='#EBF5FB', edgecolor='#2980B9', fontsize=11, fontweight='normal')

    steps = [
        (6.8, 'Acknowledge', '"That\'s an interesting\nobservation..."'),
        (5.4, 'Redirect', '"Let me explain what\ndialectics actually is..."'),
        (4.0, 'Instruct', '"Dialectics involves\nthesis, antithesis,\nsynthesis..."'),
    ]
    for y, label, detail in steps:
        draw_box(ax1, (1.5, y), 3.0, 1.1, label,
                 facecolor=base_color, edgecolor=base_edge, fontsize=12, fontweight='bold')
        ax1.text(6.5, y + 0.55, detail, ha='center', va='center',
                fontsize=10, fontstyle='italic', color='#555555',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#CCCCCC', alpha=0.8))

    # Outcome
    draw_box(ax1, (1.5, 2.2), 7, 1.2, 'WAYPOINT\nLearner acknowledged, then redirected',
             facecolor='#FADBD8', edgecolor='#E74C3C', fontsize=11, fontweight='bold')

    # Arrows
    draw_arrow(ax1, (5.0, 8.2), (3.0, 7.9))
    draw_arrow(ax1, (3.0, 6.8), (3.0, 6.5))
    draw_arrow(ax1, (3.0, 5.4), (3.0, 5.1))
    draw_arrow(ax1, (3.0, 4.0), (3.0, 3.4))

    # ── Right: Recognition Flow ──
    ax2.set_title('Recognition Flow', fontsize=14, fontweight='bold', pad=10)
    recog_color = '#D5F5E3'
    recog_edge = '#27AE60'

    # Learner quote
    draw_box(ax2, (1.5, 8.2), 7, 1.1, learner_quote,
             facecolor='#EBF5FB', edgecolor='#2980B9', fontsize=11, fontweight='normal')

    steps = [
        (6.8, 'Engage', '"A spiral—that\'s a\npowerful metaphor..."'),
        (5.4, 'Explore', '"What makes you see\nit as circular rather\nthan linear?"'),
        (4.0, 'Synthesize', '"Your spiral captures\nsomething the textbook\nmisses..."'),
    ]
    for y, label, detail in steps:
        draw_box(ax2, (1.5, y), 3.0, 1.1, label,
                 facecolor=recog_color, edgecolor=recog_edge, fontsize=12, fontweight='bold')
        ax2.text(6.5, y + 0.55, detail, ha='center', va='center',
                fontsize=10, fontstyle='italic', color='#555555',
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor='#CCCCCC', alpha=0.8))

    # Outcome
    draw_box(ax2, (1.5, 2.2), 7, 1.2, 'SITE OF JOINT INQUIRY\nLearner\'s understanding shapes interaction',
             facecolor='#D5F5E3', edgecolor='#27AE60', fontsize=11, fontweight='bold')

    # Arrows
    draw_arrow(ax2, (5.0, 8.2), (3.0, 7.9))
    draw_arrow(ax2, (3.0, 6.8), (3.0, 6.5))
    draw_arrow(ax2, (3.0, 5.4), (3.0, 5.1))
    draw_arrow(ax2, (3.0, 4.0), (3.0, 3.4))

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure2.png'))
    plt.close(fig)
    print('  figure2.png')


# ── Figure 3: Recognition Effect Decomposition ───────────────────────────────

def figure3():
    fig, ax = plt.subplots(figsize=(10, 4))

    total = 20.1
    prompt_eng = 11.4
    recog_unique = 8.7
    prompt_pct = prompt_eng / total * 100  # 57%
    recog_pct = recog_unique / total * 100  # 43%

    # Stacked horizontal bar
    bar_height = 0.5
    y = 0

    ax.barh(y, prompt_eng, height=bar_height, color='#85C1E9', edgecolor='#2471A3',
            linewidth=1.5, label=f'Prompt Engineering: +{prompt_eng} pts ({prompt_pct:.0f}%)')
    ax.barh(y, recog_unique, height=bar_height, left=prompt_eng, color='#82E0AA',
            edgecolor='#1E8449', linewidth=1.5,
            label=f'Recognition Unique: +{recog_unique} pts ({recog_pct:.0f}%)')

    # Labels on bars
    ax.text(prompt_eng / 2, y, f'+{prompt_eng} pts\n({prompt_pct:.0f}%)',
            ha='center', va='center', fontsize=13, fontweight='bold', color='#1A5276')
    ax.text(prompt_eng + recog_unique / 2, y,
            f'+{recog_unique} pts\n({recog_pct:.0f}%)',
            ha='center', va='center', fontsize=13, fontweight='bold', color='#145A32')

    # Total label
    ax.text(total + 0.3, y, f'Total: +{total} pts',
            ha='left', va='center', fontsize=13, fontweight='bold', color='#333333')

    ax.set_xlim(0, 26)
    ax.set_ylim(-0.8, 0.8)
    ax.set_xlabel('Score Improvement (points)', fontsize=14)
    ax.set_yticks([])
    ax.set_title('Figure 3: Recognition Effect Decomposition\n(Base → Enhanced → Recognition)',
                 fontsize=15, fontweight='bold')
    ax.legend(loc='upper right', fontsize=11, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)

    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure3.png'))
    plt.close(fig)
    print('  figure3.png')


# ── Figure 4: Multi-Agent Synergy by Prompt Type ─────────────────────────────

def figure4():
    """Multi-model A×B interaction probe (Table 8, N=655 across 5 ego models).
    Shows recognition effect and A×B interaction per model, confirming
    architecture is additive, not synergistic."""

    fig, ax = plt.subplots(figsize=(10, 5.5))

    manifest = get_manifest()
    fig4_config = manifest['figures']['figure4'] if manifest else None

    # Try data-driven from DB
    models = []
    recog_effect = []
    ab_interaction = []
    data_driven = False

    if fig4_config and get_db():
        for key in ['kimi', 'nemotron', 'deepseek', 'glm', 'haiku']:
            cfg = fig4_config['runs'][key]
            cell_means = query_cell_means(cfg['run_ids'], fig4_config['judge_filter'])
            if not cell_means:
                break
            effects = compute_2x2_effects(
                cell_means,
                'cell_1_base_single_unified', 'cell_3_base_multi_unified',
                'cell_5_recog_single_unified', 'cell_7_recog_multi_unified')
            if not effects:
                break
            total_n = sum(v['n'] for v in cell_means.values())
            models.append(f"{cfg['label']}\n(N={total_n})")
            recog_effect.append(round(effects['recog_effect'], 1))
            ab_interaction.append(round(effects['interaction'], 1))
        else:
            data_driven = True
            print('    [data-driven from DB]')

    if not data_driven:
        # Fallback hardcoded values
        models = ['Kimi K2.5\n(N=179)', 'Nemotron\n(N=119)', 'DeepSeek\n(N=120)',
                  'GLM-4.7\n(N=117)', 'Haiku 4.5\n(N=120)']
        recog_effect = [15.5, 16.0, 14.0, 17.8, 9.6]
        ab_interaction = [0.5, -5.7, -1.4, -0.7, -1.6]
        print('    [hardcoded fallback]')

    x = np.arange(len(models))
    w = 0.35

    bars_r = ax.bar(x - w/2, recog_effect, w, label='Recognition Effect (A)',
                    color='#27AE60', edgecolor='#1E8449', linewidth=1.2)
    bars_i = ax.bar(x + w/2, ab_interaction, w, label='A×B Interaction',
                    color='#E74C3C', edgecolor='#C0392B', linewidth=1.2)

    # Value labels
    for bar in bars_r:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
                f'+{bar.get_height():.1f}', ha='center', va='bottom',
                fontsize=10, fontweight='bold', color='#1E8449')
    for bar in bars_i:
        val = bar.get_height()
        y_pos = val - 0.5 if val < 0 else val + 0.3
        va = 'top' if val < 0 else 'bottom'
        sign = '+' if val > 0 else ''
        ax.text(bar.get_x() + bar.get_width()/2, y_pos,
                f'{sign}{val:.1f}', ha='center', va=va,
                fontsize=10, fontweight='bold', color='#C0392B')

    ax.axhline(0, color='#999', linewidth=0.8, linestyle='-')
    ax.set_ylim(-8, 22)
    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=11)
    ax.set_ylabel('Effect Size (points)', fontsize=14)
    ax.set_title('Figure 4: Architecture is Additive, Not Synergistic\n'
                 '(Multi-Model A×B Probe, N=655, Opus Judge)',
                 fontsize=15, fontweight='bold')
    ax.legend(loc='upper right', fontsize=12, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.text(0.10, 0.02,
             'Recognition effect replicates across all 5 models (+9.6 to +17.8). '
             'A×B interaction is negligible (mean −1.8 pts).',
             fontsize=11, fontstyle='italic', color='#777777')

    fig.tight_layout(rect=[0, 0.08, 1, 1])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure4.png'))
    plt.close(fig)
    print('  figure4.png')


# ── Figure 5: Factor Effects Invert by Domain ────────────────────────────────

def figure5():
    """Factor effects by domain using Kimi K2.5 for both domains.
    Elementary: eval-2026-02-05-e87f452d (N=60, cells 1,3,5,7).
    Philosophy: factorial cells 1,3,5,7 (N=179)."""

    fig, ax = plt.subplots(figsize=(10, 5.5))

    manifest = get_manifest()
    fig5_config = manifest['figures']['figure5'] if manifest else None

    factors = ['A: Recognition\nEffect', 'B: Multi-Agent\nEffect']
    phil = None
    elem = None
    phil_n = 179
    elem_n = 60
    data_driven = False

    if fig5_config and get_db():
        # Philosophy: factorial single-learner cells
        phil_means = query_cell_means([fig5_config['runs']['philosophy']], fig5_config['judge_filter'])
        elem_means = query_cell_means([fig5_config['runs']['elementary']], fig5_config['judge_filter'])
        if phil_means and elem_means:
            phil_fx = compute_2x2_effects(phil_means,
                'cell_1_base_single_unified', 'cell_3_base_multi_unified',
                'cell_5_recog_single_unified', 'cell_7_recog_multi_unified')
            elem_fx = compute_2x2_effects(elem_means,
                'cell_1_base_single_unified', 'cell_3_base_multi_unified',
                'cell_5_recog_single_unified', 'cell_7_recog_multi_unified')
            if phil_fx and elem_fx:
                phil = [round(phil_fx['recog_effect'], 1), round(phil_fx['arch_effect'], 1)]
                elem = [round(elem_fx['recog_effect'], 1), round(elem_fx['arch_effect'], 1)]
                phil_n = sum(v['n'] for v in phil_means.values())
                elem_n = sum(v['n'] for v in elem_means.values())
                data_driven = True
                print('    [data-driven from DB]')

    if not data_driven:
        phil = [15.4, -0.8]
        elem = [9.9, 3.0]
        print('    [hardcoded fallback]')

    y = np.arange(len(factors))
    bar_height = 0.3

    bars_phil = ax.barh(y + bar_height/2, phil, bar_height, color='#5DADE2',
                        edgecolor='#2471A3', linewidth=1.5, label=f'Philosophy (Kimi, N={phil_n})')
    bars_elem = ax.barh(y - bar_height/2, elem, bar_height, color='#F0B27A',
                        edgecolor='#CA6F1E', linewidth=1.5, label=f'Elementary Math (Kimi, N={elem_n})')

    # Score labels
    for bar, val in zip(bars_phil, phil):
        label = f'+{val}' if val >= 0 else f'{val}'
        offset = 0.3 if val >= 0 else -0.3
        ha = 'left' if val >= 0 else 'right'
        ax.text(val + offset, bar.get_y() + bar.get_height()/2, label,
                va='center', ha=ha, fontsize=12, fontweight='bold', color='#1A5276')
    for bar, val in zip(bars_elem, elem):
        ax.text(val + 0.3, bar.get_y() + bar.get_height()/2, f'+{val}',
                va='center', fontsize=12, fontweight='bold', color='#784212')

    ax.set_xlim(-2, 18)
    ax.axvline(x=0, color='#999999', linewidth=0.8, linestyle='-')
    ax.set_yticks(y)
    ax.set_yticklabels(factors, fontsize=13)
    ax.set_xlabel('Effect Size (points)', fontsize=14)
    ax.set_title('Figure 5: Factor Effects by Domain (Kimi K2.5)',
                 fontsize=15, fontweight='bold')
    ax.legend(loc='lower right', fontsize=12, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.text(0.12, 0.02,
             'Recognition dominates in both domains. Architecture provides small additive benefit\n'
             'on elementary content (+3.0 pts) and negligible effect on philosophy (−0.8 pts).',
             fontsize=11, fontstyle='italic', color='#777777')

    fig.tight_layout(rect=[0, 0.1, 1, 1])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure5.png'))
    plt.close(fig)
    print('  figure5.png')


# ── Figure 6: Tutor Language Word Clouds ──────────────────────────────────────

def figure6():
    """Word clouds from actual tutor transcript text (N=350 factorial responses).
    Shows the raw linguistic differences between base and recognition conditions,
    complementing the AI theme coding in Tables 17b–d."""

    try:
        from wordcloud import WordCloud
    except ImportError:
        print('  figure6.png SKIPPED (pip install wordcloud)')
        return

    import sqlite3
    import json
    import re

    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'evaluations.db')
    if not os.path.exists(db_path):
        print('  figure6.png SKIPPED (database not found)')
        return

    conn = sqlite3.connect(db_path)
    rows = conn.execute("""
        SELECT profile_name, suggestions
        FROM evaluation_results
        WHERE run_id IN ('eval-2026-02-03-f5d4dd93', 'eval-2026-02-06-a933d745')
          AND overall_score IS NOT NULL
          AND judge_model LIKE '%claude%'
    """).fetchall()
    conn.close()

    # Extract message text from JSON suggestions
    base_texts = []
    recog_texts = []
    for profile, suggestions_json in rows:
        try:
            suggestions = json.loads(suggestions_json)
            text_parts = []
            for s in suggestions:
                if isinstance(s, dict):
                    for key in ('message', 'title', 'reason'):
                        if key in s and s[key]:
                            text_parts.append(str(s[key]))
            text = ' '.join(text_parts)
        except (json.JSONDecodeError, TypeError):
            text = str(suggestions_json) if suggestions_json else ''

        if 'recog' in profile:
            recog_texts.append(text)
        else:
            base_texts.append(text)

    base_corpus = ' '.join(base_texts)
    recog_corpus = ' '.join(recog_texts)

    # Pedagogical stop words — remove generic terms common to both conditions
    # so the clouds highlight what *differs*
    stop_words = {
        # Standard English stop words
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
        'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
        'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
        'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
        'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up',
        'that', 'this', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
        'them', 'their', 'we', 'our', 'you', 'your', 'i', 'me', 'my', 'also',
        'which', 'who', 'whom', 'what', 'any', 'much', 'many', 'well',
        'still', 'even', 'back', 'get', 'go', 'make', 'like', 'take',
        'one', 'two', 'first', 'new', 'way', 'us',
        # Common tutoring terms shared by both conditions
        'lecture', 'student', 'course', 'content', 'topic', 'material',
        'next', 'current', 'help', 'suggest', 'review', 'start', 'continue',
        'see', 'know', 'think', 'let', 'look', 'want', 'come',
    }

    def text_to_freq(corpus, stop_words):
        words = re.findall(r'[a-z]{3,}', corpus.lower())
        freq = {}
        for w in words:
            if w not in stop_words:
                freq[w] = freq.get(w, 0) + 1
        return freq

    base_freq = text_to_freq(base_corpus, stop_words)
    recog_freq = text_to_freq(recog_corpus, stop_words)

    if not base_freq or not recog_freq:
        print('  figure6.png SKIPPED (no text extracted)')
        return

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    wc_base = WordCloud(
        width=1200, height=800, background_color='white', colormap='OrRd',
        max_words=50, max_font_size=120, min_font_size=14,
        prefer_horizontal=0.85, relative_scaling=0.5, margin=10,
        collocations=False,
    ).generate_from_frequencies(base_freq)

    wc_recog = WordCloud(
        width=1200, height=800, background_color='white', colormap='YlGn',
        max_words=50, max_font_size=120, min_font_size=14,
        prefer_horizontal=0.85, relative_scaling=0.5, margin=10,
        collocations=False,
    ).generate_from_frequencies(recog_freq)

    ax1.imshow(wc_base, interpolation='bilinear')
    ax1.set_title('Base Condition (N=172)', fontsize=18, fontweight='bold', pad=15)
    ax1.axis('off')

    ax2.imshow(wc_recog, interpolation='bilinear')
    ax2.set_title('Recognition Condition (N=178)', fontsize=18, fontweight='bold', pad=15)
    ax2.axis('off')

    fig.suptitle('Figure 6: Tutor Language Word Clouds (Factorial, N=350)',
                 fontsize=16, fontweight='bold', y=0.98)
    fig.tight_layout(rect=[0, 0.02, 1, 0.94])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure6.png'))
    plt.close(fig)
    print('  figure6.png')


# ── Figure 7: Persona × Recognition (Section 6.8) ───────────────────────────

def figure7():
    """Grouped bar chart: superego persona × recognition for dialectical
    multi-turn modulation (cells 28-33, N=90)."""

    fig, ax = plt.subplots(figsize=(9, 5.5))

    manifest = get_manifest()
    fig7_config = manifest['figures']['figure7'] if manifest else None

    personas = ['Suspicious', 'Adversary', 'Advocate']
    base = None
    recog = None
    total_n = 90
    data_driven = False

    if fig7_config and get_db():
        cell_means = query_cell_means(fig7_config['runs'], 'claude-code%')
        if cell_means:
            # Cells 28-33: base/recog × suspicious/adversary/advocate
            persona_cells = {
                'Suspicious': ('cell_28_base_dialectical_suspicious_unified',
                               'cell_29_recog_dialectical_suspicious_unified'),
                'Adversary':  ('cell_30_base_dialectical_adversary_unified',
                               'cell_31_recog_dialectical_adversary_unified'),
                'Advocate':   ('cell_32_base_dialectical_advocate_unified',
                               'cell_33_recog_dialectical_advocate_unified'),
            }
            base = []
            recog = []
            for persona in personas:
                b_key, r_key = persona_cells[persona]
                b_data = cell_means.get(b_key)
                r_data = cell_means.get(r_key)
                if b_data and r_data:
                    base.append(round(b_data['mean'], 1))
                    recog.append(round(r_data['mean'], 1))
                else:
                    base = None
                    break
            if base and len(base) == 3:
                total_n = sum(v['n'] for v in cell_means.values())
                data_driven = True
                print('    [data-driven from DB]')

    if not data_driven:
        base = [85.7, 88.5, 82.0]
        recog = [90.2, 88.5, 95.6]
        print('    [hardcoded fallback]')

    deltas = [r - b for r, b in zip(recog, base)]

    x = np.arange(len(personas))
    w = 0.35

    bars_b = ax.bar(x - w/2, base, w, label='Base', color='#95A5A6', edgecolor='#7F8C8D', linewidth=1.2)
    bars_r = ax.bar(x + w/2, recog, w, label='Recognition', color='#27AE60', edgecolor='#1E8449', linewidth=1.2)

    # Value labels
    for bar in bars_b:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=11, fontweight='bold', color='#555')
    for bar in bars_r:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=11, fontweight='bold', color='#1E8449')

    # Delta annotations
    for i, d in enumerate(deltas):
        color = '#C0392B' if d > 2 else '#888' if abs(d) <= 2 else '#2471A3'
        sign = '+' if d >= 0 else ''
        ax.text(x[i] + w/2 + 0.08, recog[i] - 2, f'{sign}{d:.1f}',
                fontsize=11, fontweight='bold', color=color, va='center')

    ax.set_ylim(75, 100)
    ax.set_xticks(x)
    ax.set_xticklabels(personas, fontsize=13)
    ax.set_ylabel('Mean Score', fontsize=14)
    ax.set_title(f'Figure 7: Superego Persona × Recognition\n(Dialectical Multi-Turn, N={total_n}, Opus Judge)',
                 fontsize=15, fontweight='bold')
    ax.legend(fontsize=12, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.text(0.10, 0.02,
             'Advocate persona shows largest recognition effect (+13.6); '
             'adversary shows zero effect due to over-deference.',
             fontsize=11, fontstyle='italic', color='#777777')

    fig.tight_layout(rect=[0, 0.08, 1, 1])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure7.png'))
    plt.close(fig)
    print('  figure7.png')


# ── Figure 8: Scripted vs Dynamic Learner Mechanism Spread (Section 6.10) ────

def figure8():
    """Side-by-side comparison of mechanism spread under scripted vs dynamic learners."""

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6), sharey=True)

    manifest = get_manifest()
    fig8_config = manifest['figures']['figure8'] if manifest else None

    scripted_labels = None
    scripted_vals = None
    dynamic_labels = None
    dynamic_vals = None
    scripted_n = 360
    dynamic_n = 240
    data_driven = False

    # Cell-to-mechanism mapping for recognition cells in e0e3a622
    scripted_recog_cells = {
        'cell_41_recog_dialectical_suspicious_unified_superego': 'Self-reflect (susp.)',
        'cell_43_recog_dialectical_adversary_unified_superego': 'Adversary',
        'cell_45_recog_dialectical_advocate_unified_superego': 'Advocate',
        'cell_47_recog_dialectical_suspicious_unified_quantitative': 'Quantitative',
        'cell_49_recog_dialectical_suspicious_unified_erosion': 'Erosion',
        'cell_51_recog_dialectical_suspicious_unified_intersubjective': 'Intersubjective',
        'cell_53_recog_dialectical_suspicious_unified_combined': 'Combined',
        'cell_55_recog_dialectical_profile_tutor': 'Prof. (tutor)',
        'cell_57_recog_dialectical_profile_bidirectional': 'Prof. (bidir)',
    }
    # Dynamic learner recognition cells from 6c033830 + a2b2717c
    dynamic_recog_cells = {
        'cell_61_recog_dialectical_selfreflect_psycho': 'Self-reflect',
        'cell_63_recog_dialectical_profile_bidirectional_psycho': 'Profiling',
        'cell_64_recog_dialectical_intersubjective_psycho': 'Intersubjective',
        'cell_65_recog_dialectical_combined_psycho': 'Combined',
    }

    if fig8_config and get_db():
        # Scripted
        s_means = query_cell_means([fig8_config['runs']['scripted']], 'claude-code%')
        if s_means:
            s_labels = []
            s_vals = []
            for cell, label in scripted_recog_cells.items():
                data = s_means.get(cell)
                if data:
                    s_labels.append(label)
                    s_vals.append(round(data['mean'], 1))
            if len(s_labels) >= 7:
                scripted_labels = s_labels
                scripted_vals = s_vals
                scripted_n = sum(v['n'] for v in s_means.values())

        # Dynamic
        d_run_ids = [fig8_config['runs']['dynamic_60_63'], fig8_config['runs']['dynamic_64_65']]
        d_means = query_cell_means(d_run_ids, 'claude-code%')
        if d_means:
            d_labels = []
            d_vals = []
            for cell, label in dynamic_recog_cells.items():
                data = d_means.get(cell)
                if data:
                    d_labels.append(label)
                    d_vals.append(round(data['mean'], 1))
            if len(d_labels) >= 3:
                dynamic_labels = d_labels
                dynamic_vals = d_vals
                dynamic_n = sum(v['n'] for v in d_means.values())

        if scripted_labels and dynamic_labels:
            data_driven = True
            print('    [data-driven from DB]')

    if not data_driven:
        scripted_labels = ['Prof. (bidir)', 'Quantitative', 'Combined', 'Prof. (tutor)',
                           'Self-reflect', 'Intersubjective', 'Erosion', 'Adversary', 'Advocate']
        scripted_vals = [92.7, 92.6, 92.4, 92.4, 92.1, 91.7, 90.8, 92.6, 90.3]
        dynamic_labels = ['Profiling', 'Combined', 'Self-reflect', 'Intersubjective']
        dynamic_vals = [88.8, 87.8, 85.9, 82.8]
        print('    [hardcoded fallback]')

    # Sort both by value descending
    s_order = np.argsort(scripted_vals)[::-1]
    scripted_labels = [scripted_labels[i] for i in s_order]
    scripted_vals = [scripted_vals[i] for i in s_order]

    d_order = np.argsort(dynamic_vals)[::-1]
    dynamic_labels = [dynamic_labels[i] for i in d_order]
    dynamic_vals = [dynamic_vals[i] for i in d_order]

    # Scripted panel
    colors_s = ['#27AE60'] * len(scripted_vals)
    bars_s = ax1.barh(range(len(scripted_vals)), scripted_vals, color=colors_s, edgecolor='#1E8449', alpha=0.8)
    ax1.set_yticks(range(len(scripted_labels)))
    ax1.set_yticklabels(scripted_labels, fontsize=11)
    ax1.set_xlim(80, 96)
    ax1.set_xlabel('Mean Score (Recognition)', fontsize=12)
    s_range = max(scripted_vals) - min(scripted_vals)
    ax1.set_title(f'Scripted Learner (N={scripted_n})\n{s_range:.1f}-pt range', fontsize=14, fontweight='bold')
    for i, v in enumerate(scripted_vals):
        ax1.text(v + 0.2, i, f'{v:.1f}', va='center', fontsize=10, fontweight='bold')
    # Highlight the band
    ax1.axvspan(min(scripted_vals), max(scripted_vals), alpha=0.1, color='green')
    ax1.spines['top'].set_visible(False)
    ax1.spines['right'].set_visible(False)

    # Dynamic panel
    colors_d = ['#27AE60' if v > 86 else '#F39C12' if v > 84 else '#E74C3C' for v in dynamic_vals]
    bars_d = ax2.barh(range(len(dynamic_vals)), dynamic_vals, color=colors_d, edgecolor='#333', alpha=0.8)
    ax2.set_yticks(range(len(dynamic_labels)))
    ax2.set_yticklabels(dynamic_labels, fontsize=11)
    ax2.set_xlim(80, 96)
    ax2.set_xlabel('Mean Score (Recognition)', fontsize=12)
    d_range = max(dynamic_vals) - min(dynamic_vals)
    ax2.set_title(f'Dynamic Learner (N={dynamic_n})\n{d_range:.1f}-pt range', fontsize=14, fontweight='bold')
    for i, v in enumerate(dynamic_vals):
        ax2.text(v + 0.2, i, f'{v:.1f}', va='center', fontsize=10, fontweight='bold')
    ax2.axvspan(min(dynamic_vals), max(dynamic_vals), alpha=0.1, color='orange')
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)

    fig.suptitle('Figure 8: Mechanism Differentiation — Scripted vs Dynamic Learner',
                 fontsize=16, fontweight='bold', y=1.02)
    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure8.png'))
    plt.close(fig)
    print('  figure8.png')


# ── Figure 9: Qualitative Tag Divergence (Section 6.11) ─────────────────────

def figure9():
    """Diverging bar chart: tag frequency difference (recognition - base)
    from bilateral run qualitative assessment."""

    fig, ax = plt.subplots(figsize=(10, 5.5))

    tags = ['recognition_moment', 'ego_autonomy', 'emotional_attunement',
            'strategy_shift', 'learner_breakthrough',
            'ego_compliance', 'superego_overcorrection', 'missed_scaffold',
            'stalling']
    # Note: missed_scaffold was 101.7% due to duplicate tag counting per dialogue;
    # capped at 100.0% (deduplicated per dialogue).
    tags = ['recognition_moment', 'strategy_shift', 'emotional_attunement',
            'learner_breakthrough',
            'ego_compliance', 'superego_overcorrection', 'missed_scaffold',
            'stalling']
    base_pct = [0.0, 0.0, 6.9, 80.0, 70.7, 69.0, 100.0, 100.0]
    recog_pct = [51.7, 30.0, 36.7, 80.0, 60.0, 50.0, 68.3, 45.0]

    diff = [r - b for r, b in zip(recog_pct, base_pct)]

    # Sort by difference
    order = np.argsort(diff)
    tags = [tags[i] for i in order]
    diff = [diff[i] for i in order]

    colors = ['#27AE60' if d > 0 else '#E74C3C' for d in diff]

    bars = ax.barh(range(len(tags)), diff, color=colors, edgecolor='#333', alpha=0.85)

    # Clean tag names
    clean = [t.replace('_', ' ').title() for t in tags]
    ax.set_yticks(range(len(clean)))
    ax.set_yticklabels(clean, fontsize=11)
    ax.set_xlabel('Percentage Point Difference (Recognition − Base)', fontsize=12)
    ax.axvline(0, color='black', linewidth=0.8)

    # Value labels
    for i, d in enumerate(diff):
        sign = '+' if d > 0 else ''
        ha = 'left' if d >= 0 else 'right'
        offset = 1.5 if d >= 0 else -1.5
        ax.text(d + offset, i, f'{sign}{d:.0f}%', va='center', ha=ha, fontsize=10, fontweight='bold')

    ax.set_title('Figure 9: Qualitative Tag Divergence\n(Bilateral Run, N=118, Base vs Recognition)',
                 fontsize=15, fontweight='bold')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.tight_layout()
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure9.png'))
    plt.close(fig)
    print('  figure9.png')


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('Generating paper figures...')
    if get_manifest() and get_db():
        print(f'  Manifest: {MANIFEST_PATH}')
        print(f'  Database: {DB_PATH}')
    else:
        print('  WARNING: manifest or DB not found, using hardcoded fallbacks')
    figure1()
    figure2()
    figure3()
    figure4()
    figure5()
    figure6()
    figure7()
    figure8()
    figure9()
    if _db:
        _db.close()
    print(f'Done. Output: {os.path.abspath(OUTPUT_DIR)}/')
