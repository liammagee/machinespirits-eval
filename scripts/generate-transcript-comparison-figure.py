#!/usr/bin/env python3
"""
Generate a side-by-side transcript comparison figure for Paper 2.0.

Queries the evaluation database for a high-scoring recognition dialogue and a
low-scoring base dialogue from the same scenario, then renders them as a
two-column panel figure showing the qualitative difference.

Output: docs/research/figures/figure-transcript-comparison.png

Run: python3 scripts/generate-transcript-comparison-figure.py
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np
import sqlite3
import json
import os
import sys
import textwrap

# ── Configuration ────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'evaluations.db')
FIGURES_DIR = os.path.join(SCRIPT_DIR, '..', 'docs', 'research', 'figures')
OUTPUT_FILE = os.path.join(FIGURES_DIR, 'figure-transcript-comparison.png')

# Specific dialogue IDs chosen for maximum contrast within the same scenario
# Both use Haiku ego model, Misconception Correction (4-turn) scenario, Sonnet judge
BASE_DIALOGUE_ID = 'dialogue-1772458383658-xt00eg'
BASE_PROFILE = 'cell_80%'
RECOG_DIALOGUE_ID = 'dialogue-1772277175942-x124vu'
RECOG_PROFILE = 'cell_86%'
RECOG_SCORE_FILTER = 87.5  # Disambiguate from duplicate row

# Number of tutor turns to display
NUM_TURNS = 3

# Max characters per turn message
MAX_CHARS = 280

# ── Colors ───────────────────────────────────────────────────────────────────

BASE_HEADER_BG = '#c0392b'       # Dark red
BASE_HEADER_TEXT = '#ffffff'
BASE_CARD_BG = '#fdf2f2'         # Very light red/pink
BASE_CARD_BORDER = '#e74c3c'     # Red border
BASE_SCORE_BG = '#e74c3c'
BASE_TURN_LABEL = '#95a5a6'

RECOG_HEADER_BG = '#1a7a3a'      # Dark green
RECOG_HEADER_TEXT = '#ffffff'
RECOG_CARD_BG = '#f0faf0'        # Very light green
RECOG_CARD_BORDER = '#27ae60'    # Green border
RECOG_SCORE_BG = '#27ae60'
RECOG_TURN_LABEL = '#95a5a6'

SUBTITLE_COLOR = '#7f8c8d'
BODY_COLOR = '#2c3e50'
META_COLOR = '#95a5a6'
BADGE_TEXT = '#ffffff'
FIG_BG = '#ffffff'


def get_db():
    """Open read-only connection to evaluation database."""
    conn = sqlite3.connect(f'file:{DB_PATH}?mode=ro', uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def fetch_dialogue(conn, dialogue_id, profile_like, score_filter=None):
    """Fetch dialogue data from the database."""
    sql = """
        SELECT dialogue_id, profile_name, scenario_name,
               tutor_first_turn_score, suggestions, ego_model, judge_model
        FROM evaluation_results
        WHERE dialogue_id = ? AND profile_name LIKE ?
    """
    params = [dialogue_id, profile_like]
    if score_filter is not None:
        sql += " AND tutor_first_turn_score = ?"
        params.append(score_filter)
    sql += " LIMIT 1"

    row = conn.execute(sql, params).fetchone()
    if not row:
        print(f"ERROR: No row found for dialogue_id={dialogue_id}, profile={profile_like}")
        sys.exit(1)

    suggestions = json.loads(row['suggestions'])
    return {
        'dialogue_id': row['dialogue_id'],
        'profile_name': row['profile_name'],
        'scenario_name': row['scenario_name'],
        'score': row['tutor_first_turn_score'],
        'ego_model': row['ego_model'],
        'judge_model': row['judge_model'],
        'suggestions': suggestions,
    }


def truncate_message(msg, max_chars=MAX_CHARS):
    """Truncate message to max_chars, ending at a word boundary."""
    # Replace em-dashes and other special chars for clean rendering
    msg = msg.replace('\u2014', '--').replace('\u2013', '-')
    msg = msg.replace('\u2018', "'").replace('\u2019', "'")
    msg = msg.replace('\u201c', '"').replace('\u201d', '"')
    # Strip markdown emphasis
    msg = msg.replace('*', '')
    if len(msg) <= max_chars:
        return msg
    # Find last space before max_chars
    cut = msg[:max_chars].rfind(' ')
    if cut < max_chars // 2:
        cut = max_chars
    return msg[:cut] + '...'


def format_model_name(ego_model):
    """Extract readable model name from OpenRouter model string."""
    if not ego_model:
        return 'Unknown'
    parts = ego_model.split('/')
    name = parts[-1] if parts else ego_model
    # Clean up common patterns
    name = name.replace('openrouter.', '')
    return name


def format_cell_label(profile_name):
    """Create a readable cell label."""
    # cell_80_messages_base_single_unified -> Base / Single-Agent
    parts = profile_name.split('_')
    cell_num = parts[1] if len(parts) > 1 else '?'
    condition = 'Recognition' if 'recog' in profile_name else 'Base'
    arch = 'Multi-Agent' if 'multi' in profile_name else 'Single-Agent'
    return f"Cell {cell_num} ({condition}, {arch})"


def draw_column(ax, data, num_turns, x_start, col_width,
                header_bg, header_text, card_bg, card_border,
                score_bg, turn_label_color, condition_label):
    """Draw one column of the transcript comparison."""
    ax_height = 1.0  # normalized
    ax_width = 1.0

    # ── Header bar ──
    header_height = 0.08
    header_y = ax_height - header_height
    header = FancyBboxPatch(
        (x_start, header_y), col_width, header_height,
        boxstyle="round,pad=0.005", facecolor=header_bg,
        edgecolor='none', transform=ax.transAxes, zorder=5
    )
    ax.add_patch(header)

    # Condition label in header
    ax.text(
        x_start + col_width / 2, header_y + header_height / 2,
        condition_label,
        transform=ax.transAxes, fontsize=14, fontweight='bold',
        color=header_text, ha='center', va='center', zorder=6
    )

    # ── Score badge ──
    badge_y = header_y - 0.05
    badge_width = 0.12
    badge_height = 0.035
    badge_x = x_start + col_width / 2 - badge_width / 2
    badge = FancyBboxPatch(
        (badge_x, badge_y), badge_width, badge_height,
        boxstyle="round,pad=0.005", facecolor=score_bg,
        edgecolor='none', transform=ax.transAxes, zorder=5
    )
    ax.add_patch(badge)
    ax.text(
        x_start + col_width / 2, badge_y + badge_height / 2,
        f"Score: {data['score']:.1f}/100",
        transform=ax.transAxes, fontsize=9, fontweight='bold',
        color=BADGE_TEXT, ha='center', va='center', zorder=6
    )

    # ── Metadata line ──
    meta_y = badge_y - 0.025
    cell_label = format_cell_label(data['profile_name'])
    model_name = format_model_name(data['ego_model'])
    ax.text(
        x_start + col_width / 2, meta_y,
        f"{cell_label}  |  Model: {model_name}",
        transform=ax.transAxes, fontsize=7.5, color=META_COLOR,
        ha='center', va='center', zorder=6, style='italic'
    )

    # ── Turn cards ──
    card_top = meta_y - 0.03
    card_margin = 0.015
    # Distribute turns evenly in remaining space
    remaining = card_top - 0.02  # leave bottom margin
    card_height = (remaining - (num_turns - 1) * card_margin) / num_turns
    card_inner_pad = 0.012

    suggestions = data['suggestions'][:num_turns]

    for i, sugg in enumerate(suggestions):
        cy = card_top - i * (card_height + card_margin)

        # Card background
        card = FancyBboxPatch(
            (x_start + 0.01, cy - card_height), col_width - 0.02, card_height,
            boxstyle="round,pad=0.008", facecolor=card_bg,
            edgecolor=card_border, linewidth=1.2,
            transform=ax.transAxes, zorder=3
        )
        ax.add_patch(card)

        # Turn number label
        turn_badge_w = 0.06
        turn_badge_h = 0.022
        ax.text(
            x_start + 0.025, cy - 0.012,
            f"Turn {i + 1}",
            transform=ax.transAxes, fontsize=7.5, fontweight='bold',
            color=turn_label_color, ha='left', va='center', zorder=6,
            bbox=dict(boxstyle='round,pad=0.15', facecolor='white',
                      edgecolor=turn_label_color, linewidth=0.7, alpha=0.9)
        )

        # Suggestion type tag
        stype = sugg.get('type', '?')
        ax.text(
            x_start + 0.095, cy - 0.012,
            f"[{stype}]",
            transform=ax.transAxes, fontsize=7, fontweight='bold',
            color=card_border, ha='left', va='center', zorder=6
        )

        # Title
        title = sugg.get('title', '')
        if len(title) > 55:
            title = title[:52] + '...'
        ax.text(
            x_start + 0.025, cy - 0.038,
            title,
            transform=ax.transAxes, fontsize=8.5, fontweight='bold',
            color=BODY_COLOR, ha='left', va='center', zorder=6
        )

        # Message text (wrapped)
        msg = truncate_message(sugg.get('message', ''), MAX_CHARS)
        # Wrap to fit card width (approximate chars per line)
        wrapped = textwrap.fill(msg, width=62)
        lines = wrapped.split('\n')
        # Limit lines to fit in card
        max_lines = 6
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            if len(lines[-1]) > 3:
                lines[-1] = lines[-1][:-3] + '...'

        text_y_start = cy - 0.055
        line_spacing = 0.018
        for j, line in enumerate(lines):
            ax.text(
                x_start + 0.025, text_y_start - j * line_spacing,
                line,
                transform=ax.transAxes, fontsize=7.8,
                color=BODY_COLOR, ha='left', va='center', zorder=6,
                family='serif'
            )


def generate_figure():
    """Generate the transcript comparison figure."""
    conn = get_db()

    # Fetch data
    base_data = fetch_dialogue(conn, BASE_DIALOGUE_ID, BASE_PROFILE)
    recog_data = fetch_dialogue(conn, RECOG_DIALOGUE_ID, RECOG_PROFILE,
                                score_filter=RECOG_SCORE_FILTER)
    conn.close()

    print(f"Base: {base_data['profile_name']} | {base_data['scenario_name']} | "
          f"Score: {base_data['score']:.1f}")
    print(f"Recog: {recog_data['profile_name']} | {recog_data['scenario_name']} | "
          f"Score: {recog_data['score']:.1f}")
    print(f"Score delta: {recog_data['score'] - base_data['score']:.1f} points")

    # ── Create figure ──
    fig, ax = plt.subplots(1, 1, figsize=(14, 12))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    fig.patch.set_facecolor(FIG_BG)

    # ── Title ──
    fig.text(
        0.5, 0.97,
        'Transcript Comparison: Base vs Recognition',
        fontsize=16, fontweight='bold', ha='center', va='top',
        color=BODY_COLOR
    )

    # ── Subtitle ──
    fig.text(
        0.5, 0.945,
        f'Scenario: {base_data["scenario_name"]}  |  '
        f'Score delta: +{recog_data["score"] - base_data["score"]:.1f} points  |  '
        f'Judge: {recog_data["judge_model"]}',
        fontsize=9.5, ha='center', va='top', color=SUBTITLE_COLOR, style='italic'
    )

    # Column layout
    col_gap = 0.03
    col_width = (1.0 - col_gap - 0.04) / 2  # 0.02 margin each side
    left_x = 0.02
    right_x = left_x + col_width + col_gap

    # Draw columns
    draw_column(
        ax, base_data, NUM_TURNS, left_x, col_width,
        BASE_HEADER_BG, BASE_HEADER_TEXT, BASE_CARD_BG, BASE_CARD_BORDER,
        BASE_SCORE_BG, BASE_TURN_LABEL,
        'Base Condition'
    )
    draw_column(
        ax, recog_data, NUM_TURNS, right_x, col_width,
        RECOG_HEADER_BG, RECOG_HEADER_TEXT, RECOG_CARD_BG, RECOG_CARD_BORDER,
        RECOG_SCORE_BG, RECOG_TURN_LABEL,
        'Recognition Condition'
    )

    # ── Vertical divider ──
    divider_x = left_x + col_width + col_gap / 2
    ax.plot(
        [divider_x, divider_x], [0.02, 0.90],
        transform=ax.transAxes, color='#bdc3c7', linewidth=1,
        linestyle='--', zorder=2
    )

    # ── Annotations at bottom ──
    note_y = 0.008
    fig.text(
        0.5, note_y,
        'First 3 tutor turns shown. Messages truncated for readability. '
        'Both dialogues use the same ego model (Claude Haiku 4.5) and scenario.',
        fontsize=7.5, ha='center', va='bottom', color=META_COLOR, style='italic'
    )

    # Save
    os.makedirs(FIGURES_DIR, exist_ok=True)
    fig.savefig(OUTPUT_FILE, dpi=300, bbox_inches='tight', facecolor=FIG_BG)
    plt.close(fig)
    print(f"\nSaved: {OUTPUT_FILE}")
    print(f"Size: {os.path.getsize(OUTPUT_FILE) / 1024:.0f} KB")


if __name__ == '__main__':
    generate_figure()
