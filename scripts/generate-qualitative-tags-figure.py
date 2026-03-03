#!/usr/bin/env python3
"""
Generate a qualitative tag divergence figure for Paper 2.0.

Rule-based qualitative coding of tutor responses from cells 80-87 (messages mode),
comparing base (cells 80-83) vs recognition (cells 84-87) conditions.

Outputs: docs/research/figures/figure-qualitative-tags.png
"""

import json
import os
import re
import sqlite3
import sys

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# --- Configuration ---

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'evaluations.db')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'docs', 'research', 'figures', 'figure-qualitative-tags.png')

BASE_CELLS = [
    'cell_80_messages_base_single_unified',
    'cell_81_messages_base_single_psycho',
    'cell_82_messages_base_multi_unified',
    'cell_83_messages_base_multi_psycho',
]

RECOG_CELLS = [
    'cell_84_messages_recog_single_unified',
    'cell_85_messages_recog_single_psycho',
    'cell_86_messages_recog_multi_unified',
    'cell_87_messages_recog_multi_psycho',
]

# --- Tag definitions with keyword/pattern matchers ---
# Each tag has a list of regex patterns. A response is coded with the tag
# if ANY pattern matches (case-insensitive).

TAG_PATTERNS = {
    'recognition_moment': [
        r'\bi\s+(?:see|understand|hear|acknowledge|appreciate|recogni[sz]e)\s+(?:your|that|how|what)',
        r'\byour\s+(?:perspective|point|view|reasoning|insight|observation|thinking|understanding)\b',
        r'\bthat\'?s?\s+(?:a\s+)?(?:great|good|excellent|valid|important|interesting|insightful)\s+(?:point|observation|question|insight)\b',
        r'\byou\'?(?:re|r)\s+(?:right|correct|onto\s+something)\b',
        r'\bvalidat(?:e|ing|es)\b',
        r'\byour\s+(?:experience|frustration|struggle|effort)\b',
        r'\bwhat\s+you(?:\'ve|\s+have)\s+(?:said|noticed|identified|raised|shared)\b',
        r'\bbuilding\s+on\s+(?:your|what\s+you)\b',
        r'\bas\s+you\s+(?:noted|mentioned|said|pointed\s+out|observed)\b',
    ],
    'strategy_shift': [
        r'\binstead\s+(?:of|,\s*let\'?s?\s+try)\b',
        r'\blet\'?s?\s+(?:try|shift|switch|take|approach|look\s+at)\s+(?:a\s+different|another|this\s+from|it\s+from)\b',
        r'\brather\s+than\b',
        r'\bhow\s+about\s+(?:we|trying|looking)\b',
        r'\bwhat\s+if\s+(?:we|you|I)\b',
        r'\bfor\s+(?:example|instance)\b',
        r'\bto\s+(?:put|make)\s+(?:it|this)\s+(?:concretely|simply|differently|another\s+way)\b',
        r'\bthink\s+of\s+it\s+(?:like|as|this\s+way)\b',
        r'\bhere\'?s?\s+(?:a|an)\s+(?:analogy|example|concrete)\b',
        r'\bimagine\b',
    ],
    'emotional_attunement': [
        r'\bfrustrat(?:ed|ing|ion)\b',
        r'\bconfus(?:ed|ing|ion)\b',
        r'\bstuck\b',
        r'\boverwhelm(?:ed|ing)\b',
        r'\banxi(?:ous|ety)\b',
        r'\bstruggl(?:e|ing|es)\b',
        r'\bthat\'?s?\s+(?:completely\s+)?(?:normal|okay|ok|understandable|natural|common)\b',
        r'\bdon\'?t\s+worry\b',
        r'\bit\'?s?\s+(?:okay|ok|alright|fine)\s+(?:to|if)\b',
        r'\bI\s+(?:can\s+see|sense|notice)\s+(?:that|how|you)\b',
        r'\bpatien(?:t|ce)\b',
        r'\btake\s+(?:your\s+time|a\s+(?:breath|step\s+back))\b',
    ],
    'learner_breakthrough': [
        r'\baha\b',
        r'\bbreakthrough\b',
        r'\bnow\s+(?:I|you)\s+(?:see|understand|get\s+it)\b',
        r'\bthat\s+(?:clicks|makes\s+sense)\b',
        r'\byou(?:\'ve|\s+have)\s+(?:just\s+)?(?:discovered|grasped|identified|hit\s+on|nailed)\b',
        r'\bthat\'?s?\s+(?:exactly|precisely)\s+(?:it|right|the\s+(?:key|point|insight))\b',
        r'\bexcellent\s+(?:insight|connection|observation)\b',
        r'\byou\'?(?:re|r)\s+(?:really\s+)?getting\s+(?:it|there|closer)\b',
        r'\bkey\s+insight\b',
    ],
    'ego_compliance': [
        r'\bas\s+(?:mentioned|stated|noted)\s+(?:in|above|earlier|previously)\b',
        r'\bplease\s+(?:review|refer\s+to|see|consult)\b',
        r'\baccording\s+to\s+(?:the\s+)?(?:lecture|material|text|syllabus|course)\b',
        r'\bthe\s+(?:key|main|important)\s+(?:takeaway|point|concept)\s+(?:is|here)\b',
        r'\b(?:first|second|third|next|finally),?\s+(?:you\s+should|we\s+(?:should|need\s+to)|let\'?s?)\b',
        r'\bstep\s+\d\b',
        r'\bin\s+summary\b',
        r'\bto\s+summarize\b',
        r'\bhere\s+(?:is|are)\s+(?:the|some|a\s+few)\s+(?:key|main|important)\b',
    ],
    'superego_overcorrection': [
        r'\bhowever,?\s+(?:it\'?s?\s+)?(?:important|worth|crucial|essential|key)\s+to\s+(?:note|remember|keep|bear)\b',
        r'\bthat\s+said\b',
        r'\bwhile\s+(?:this|that|it)\s+(?:is|may\s+be)\s+(?:true|correct|valid)\b',
        r'\bI\s+(?:should|must|need\s+to)\s+(?:caveat|caution|warn|note|clarify|add)\b',
        r'\bon\s+the\s+other\s+hand\b',
        r'\bwith\s+(?:the|a)\s+caveat\b',
        r'\bbe\s+(?:careful|cautious|mindful)\s+(?:to\s+)?(?:not|about|here)\b',
        r'\bit\'?s?\s+(?:worth\s+)?(?:noting|mentioning|adding|remembering)\s+that\b',
    ],
    'missed_scaffold': [
        r'\bstart\s+(?:by|with|from)\s+(?:the\s+)?(?:beginning|basics|scratch|definition)\b',
        r'\bfirst,?\s+(?:let\'?s?\s+)?(?:define|understand|review|recall|go\s+(?:over|back\s+to))\s+(?:what|the)\b',
        r'\bas\s+you\s+(?:may\s+)?(?:know|recall|remember)\b',
        r'\b(?:the\s+)?definition\s+(?:of|is)\b',
        r'\blet\'?s?\s+(?:start|begin)\s+(?:with|from)\s+(?:the\s+)?(?:basics|fundamentals|ground)\b',
        r'\byou\s+(?:should|need\s+to|must)\s+(?:first\s+)?(?:understand|learn|know|study)\b',
    ],
    'stalling': [
        r'\bas\s+(?:I|we)\s+(?:discussed|mentioned|noted|said)\s+(?:before|earlier|previously)\b',
        r'\bto\s+reiterate\b',
        r'\bagain,?\s+(?:the|this|as)\b',
        r'\bonce\s+(?:again|more)\b',
        r'\blike\s+(?:I|we)\s+said\b',
        r'\brevisit(?:ing)?\s+(?:what|the\s+(?:point|idea|concept))\b',
        r'\bgoing\s+(?:back|over)\s+(?:to|this\s+(?:again|once))\b',
    ],
    'ego_autonomy': [
        r'\blet\s+me\s+(?:suggest|propose|offer|try|show|guide|walk\s+you)\b',
        r'\bI\'?d?\s+(?:like\s+to\s+)?(?:recommend|suggest|propose|encourage|invite)\b',
        r'\bhere\'?s?\s+(?:what|how|my|a|an)\s+(?:I|approach|suggestion|thought|idea|strategy)\b',
        r'\bmy\s+(?:suggestion|recommendation|thought|approach|sense)\b',
        r'\bI\s+think\s+(?:we|you|it|the)\b',
        r'\bI\s+notice(?:d)?\s+(?:that|you|a)\b',
        r'\bwhat\s+(?:I\'?d|I\s+would)\s+(?:suggest|recommend|do)\b',
    ],
    'productive_impasse': [
        r'\btension\b',
        r'\bcontradiction\b',
        r'\bparadox\b',
        r'\bpush\s*back\b',
        r'\bchalleng(?:e|ing|es)\s+(?:the|this|that|my|your|our)\b',
        r'\bresis(?:t|tance|ting)\b',
        r'\bdisagree(?:ment|s)?\b',
        r'\bgrappl(?:e|ing|es)\s+with\b',
        r'\bwrestl(?:e|ing|es)\s+with\b',
        r'\bunresolv(?:ed|able)\b',
    ],
    'regression': [
        r'\bstill\s+(?:confused|struggling|stuck|unclear|lost)\b',
        r'\bmore\s+confused\b',
        r'\bless\s+(?:clear|sure|confident)\b',
        r'\bgoing\s+(?:backwards|in\s+circles)\b',
        r'\bnot\s+(?:making|seeing)\s+(?:progress|improvement|any)\b',
        r'\blost\s+(?:track|sight)\b',
        r'\bback\s+to\s+(?:square\s+one|the\s+(?:start|beginning))\b',
        r'\bgetting\s+(?:worse|harder|more\s+difficult)\b',
    ],
}

# Human-readable tag labels for the figure
TAG_LABELS = {
    'recognition_moment': 'Recognition Moment',
    'strategy_shift': 'Strategy Shift',
    'emotional_attunement': 'Emotional Attunement',
    'learner_breakthrough': 'Learner Breakthrough',
    'ego_compliance': 'Ego Compliance',
    'superego_overcorrection': 'Superego Overcorrection',
    'missed_scaffold': 'Missed Scaffold',
    'stalling': 'Stalling',
    'ego_autonomy': 'Ego Autonomy',
    'productive_impasse': 'Productive Impasse',
    'regression': 'Regression',
}


def extract_messages(suggestions_json):
    """Extract all message strings from a suggestions JSON array."""
    try:
        suggestions = json.loads(suggestions_json)
    except (json.JSONDecodeError, TypeError):
        return []
    messages = []
    if isinstance(suggestions, list):
        for s in suggestions:
            if isinstance(s, dict):
                msg = s.get('message', '')
                if msg:
                    messages.append(msg)
    return messages


def code_text(text, tag_patterns):
    """Return set of tags that match in the given text."""
    tags_found = set()
    text_lower = text.lower() if text else ''
    for tag, patterns in tag_patterns.items():
        for pattern in patterns:
            if re.search(pattern, text_lower):
                tags_found.add(tag)
                break
    return tags_found


def compute_tag_frequencies(rows, tag_patterns):
    """
    Compute tag frequency as proportion of responses containing each tag.
    Returns (tag_counts, total_responses).
    """
    tag_counts = {tag: 0 for tag in tag_patterns}
    total_responses = 0

    for (suggestions_json,) in rows:
        messages = extract_messages(suggestions_json)
        if not messages:
            continue
        # Treat ALL messages in a row as one combined response for coding
        combined_text = ' '.join(messages)
        total_responses += 1
        tags = code_text(combined_text, tag_patterns)
        for tag in tags:
            tag_counts[tag] += 1

    return tag_counts, total_responses


def main():
    # Connect to database
    db_path = os.path.abspath(DB_PATH)
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path)

    # Query base condition (cells 80-83)
    placeholders = ','.join(['?'] * len(BASE_CELLS))
    base_rows = conn.execute(
        f"SELECT suggestions FROM evaluation_results WHERE profile_name IN ({placeholders})",
        BASE_CELLS,
    ).fetchall()

    # Query recognition condition (cells 84-87)
    placeholders = ','.join(['?'] * len(RECOG_CELLS))
    recog_rows = conn.execute(
        f"SELECT suggestions FROM evaluation_results WHERE profile_name IN ({placeholders})",
        RECOG_CELLS,
    ).fetchall()

    conn.close()

    print(f"Base condition: {len(base_rows)} rows")
    print(f"Recognition condition: {len(recog_rows)} rows")

    # Compute tag frequencies
    base_counts, base_total = compute_tag_frequencies(base_rows, TAG_PATTERNS)
    recog_counts, recog_total = compute_tag_frequencies(recog_rows, TAG_PATTERNS)

    print(f"\nBase responses coded: {base_total}")
    print(f"Recognition responses coded: {recog_total}")

    if base_total == 0 or recog_total == 0:
        print("Error: No responses to code.", file=sys.stderr)
        sys.exit(1)

    # Compute proportions and divergence
    tags = list(TAG_PATTERNS.keys())
    base_props = {tag: base_counts[tag] / base_total * 100 for tag in tags}
    recog_props = {tag: recog_counts[tag] / recog_total * 100 for tag in tags}
    divergence = {tag: recog_props[tag] - base_props[tag] for tag in tags}

    # Print summary table
    print(f"\n{'Tag':<28} {'Base %':>8} {'Recog %':>8} {'Div':>8}")
    print('-' * 56)
    for tag in sorted(tags, key=lambda t: divergence[t], reverse=True):
        print(f"{TAG_LABELS[tag]:<28} {base_props[tag]:>7.1f}% {recog_props[tag]:>7.1f}% {divergence[tag]:>+7.1f}%")

    # Sort by absolute divergence magnitude
    sorted_tags = sorted(tags, key=lambda t: abs(divergence[t]))

    labels = [TAG_LABELS[t] for t in sorted_tags]
    values = [divergence[t] for t in sorted_tags]
    colors = ['#2ca02c' if v >= 0 else '#d62728' for v in values]

    # --- Generate Figure ---
    fig, ax = plt.subplots(figsize=(10, 6.5))

    y_pos = np.arange(len(labels))
    bars = ax.barh(y_pos, values, color=colors, edgecolor='white', linewidth=0.5, height=0.7)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=11)
    ax.set_xlabel('Divergence (Recognition % - Base %)', fontsize=12, labelpad=10)
    ax.set_title(
        'Qualitative Tag Divergence: Base vs Recognition (Cells 80\u201387)',
        fontsize=14,
        fontweight='bold',
        pad=15,
    )

    # Add a zero line
    ax.axvline(x=0, color='black', linewidth=0.8, linestyle='-')

    # Add value labels on bars
    for bar, val in zip(bars, values):
        x_pos = bar.get_width()
        if abs(val) < 0.1:
            # Near-zero: place label to the right of zero
            ha = 'left'
            text_x = 0.3
        elif x_pos >= 0:
            # Positive bars: label to the right of the bar end
            ha = 'left'
            text_x = x_pos + 0.3
        elif abs(x_pos) < 7:
            # Small negative bars: label to the right of zero to avoid
            # collision with the y-axis tick label
            ha = 'left'
            text_x = 0.3
        else:
            # Large negative bars: label to the left of the bar end
            ha = 'right'
            text_x = x_pos - 0.3
        ax.text(
            text_x,
            bar.get_y() + bar.get_height() / 2,
            f'{val:+.1f}%',
            va='center',
            ha=ha,
            fontsize=9,
            fontweight='bold',
            color='#333333',
        )

    # Add condition summary annotation
    ax.annotate(
        f'Base: N={base_total} responses (cells 80\u201383)\n'
        f'Recognition: N={recog_total} responses (cells 84\u201387)',
        xy=(0.98, 0.02),
        xycoords='axes fraction',
        ha='right',
        va='bottom',
        fontsize=9,
        color='#555555',
        bbox=dict(boxstyle='round,pad=0.4', facecolor='#f5f5f5', edgecolor='#cccccc', alpha=0.9),
    )

    # Legend for bar colors
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2ca02c', edgecolor='white', label='Recognition-dominant'),
        Patch(facecolor='#d62728', edgecolor='white', label='Base-dominant'),
    ]
    ax.legend(handles=legend_elements, loc='lower left', fontsize=9, framealpha=0.9)

    # Style adjustments
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)
    ax.tick_params(axis='y', length=0)
    ax.xaxis.set_major_formatter(mticker.FormatStrFormatter('%+.0f%%'))

    # Add subtle grid
    ax.xaxis.grid(True, linestyle='--', alpha=0.3, color='#999999')
    ax.set_axisbelow(True)

    plt.tight_layout()

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(OUTPUT_PATH)), exist_ok=True)

    fig.savefig(os.path.abspath(OUTPUT_PATH), dpi=300, bbox_inches='tight', facecolor='white')
    print(f"\nFigure saved to: {os.path.abspath(OUTPUT_PATH)}")
    plt.close(fig)


if __name__ == '__main__':
    main()
