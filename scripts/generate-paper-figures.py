#!/usr/bin/env python3
"""Generate all paper figures from data.

Usage:
    python scripts/generate-paper-figures.py

Outputs 5 PNGs to docs/research/figures/
"""

import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'docs', 'research', 'figures')
os.makedirs(OUTPUT_DIR, exist_ok=True)

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
    """Interaction plot emphasizing the synergy effect (slopes) rather than
    absolute score levels.  Recognition prompts gain +9.2 from multi-agent;
    Enhanced prompts gain +0.0.  An interaction plot makes this visually
    obvious, while the old horizontal-bar version made recognition look worse
    than enhanced because absolute scores dominated the visual."""

    fig, ax = plt.subplots(figsize=(9, 5.5))

    # Data — preliminary N=36 Nemotron analysis
    x = [0, 1]
    x_labels = ['Single-Agent', 'Multi-Agent']
    recog = [72.2, 81.5]     # +9.2
    enhanced = [83.3, 83.3]  # +0.0

    # Lines
    ax.plot(x, recog, 'o-', color='#27AE60', linewidth=2.5, markersize=10,
            label='Recognition Prompts', zorder=3)
    ax.plot(x, enhanced, 's--', color='#2471A3', linewidth=2.5, markersize=10,
            label='Enhanced Prompts', zorder=3)

    # Score labels offset above/below points
    for xi, yr, ye in zip(x, recog, enhanced):
        ax.text(xi, yr - 2.2, f'{yr}', ha='center', va='top', fontsize=12,
                fontweight='bold', color='#1E8449')
        ax.text(xi, ye + 1.5, f'{ye}', ha='center', va='bottom', fontsize=12,
                fontweight='bold', color='#1A5276')

    # Delta annotations on right side
    ax.annotate(r'$\Delta$ +9.2 (p < .05)',
                xy=(1.02, np.mean(recog)), xycoords=('axes fraction', 'data'),
                fontsize=12, fontweight='bold', color='#C0392B', va='center')
    ax.annotate(r'$\Delta$ +0.0 (n.s.)',
                xy=(1.02, np.mean(enhanced)), xycoords=('axes fraction', 'data'),
                fontsize=12, fontweight='bold', color='#888888', va='center')

    ax.set_xlim(-0.3, 1.3)
    ax.set_ylim(65, 92)
    ax.set_xticks(x)
    ax.set_xticklabels(x_labels, fontsize=13)
    ax.set_ylabel('Mean Score', fontsize=14)
    ax.set_title('Figure 4: Multi-Agent Synergy by Prompt Type\n(Preliminary N=36, Nemotron)',
                 fontsize=15, fontweight='bold')
    ax.legend(loc='upper left', fontsize=12, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.text(0.10, 0.02,
             'Synergy effect (+9.2) did not replicate in the 5-model probe '
             '(N=655, mean interaction = −1.8 pts).',
             fontsize=11, fontstyle='italic', color='#777777')

    fig.tight_layout(rect=[0, 0.08, 0.88, 1])
    fig.savefig(os.path.join(OUTPUT_DIR, 'figure4.png'))
    plt.close(fig)
    print('  figure4.png')


# ── Figure 5: Factor Effects Invert by Domain ────────────────────────────────

def figure5():
    fig, ax = plt.subplots(figsize=(10, 5.5))

    factors = ['A: Recognition\nEffect', 'B: Multi-Agent\nEffect', 'C: Learner\nEffect']
    phil = [15.4, -0.8, 2.1]
    elem = [4.4, 9.9, 0.75]

    y = np.arange(len(factors))
    bar_height = 0.3

    bars_phil = ax.barh(y + bar_height/2, phil, bar_height, color='#5DADE2',
                        edgecolor='#2471A3', linewidth=1.5, label='Philosophy')
    bars_elem = ax.barh(y - bar_height/2, elem, bar_height, color='#F0B27A',
                        edgecolor='#CA6F1E', linewidth=1.5, label='Elementary Math')

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
    ax.set_title('Figure 5: Factor Effects Invert by Domain',
                 fontsize=15, fontweight='bold')
    ax.legend(loc='lower right', fontsize=12, framealpha=0.9)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    fig.text(0.12, 0.02,
             'Factor dominance inverts: Philosophy favors recognition (A); Elementary favors architecture (B).\n'
             'Elementary recognition partially model-dependent (Kimi shows d ≈ 0.61).',
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


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    print('Generating paper figures...')
    figure1()
    figure2()
    figure3()
    figure4()
    figure5()
    figure6()
    print(f'Done. Output: {os.path.abspath(OUTPUT_DIR)}/')
