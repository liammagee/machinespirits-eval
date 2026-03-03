#!/usr/bin/env python3
"""
Generate side-by-side word cloud figures comparing base vs recognition
tutor language in messages-mode cells (80-87).

Usage:
    python scripts/generate-word-clouds.py

Output:
    docs/research/figures/figure-word-clouds.png
"""

import json
import os
import sqlite3
import sys

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from wordcloud import WordCloud

# --- Configuration ---

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'evaluations.db')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), '..', 'docs', 'research', 'figures', 'figure-word-clouds.png')

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

# Stopwords: English common words + generic pedagogical terms
# that appear equally across both conditions
STOPWORDS = {
    # Common English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
    'our', 'their', 'mine', 'yours', 'ours', 'theirs',
    'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
    'against', 'before', 'below', 'between', 'during', 'into', 'through',
    'under', 'until', 'up', 'down', 'out', 'off', 'over', 'then',
    'once', 'here', 'there', 'any', 'if', 'as', 'because', 'while',

    # Generic pedagogical terms (equally frequent in both conditions)
    'student', 'students', 'learning', 'learn', 'learned', 'learner',
    'question', 'questions', 'answer', 'answers', 'let', 'also', 'one',
    'use', 'using', 'used', 'make', 'making', 'made', 'like', 'know',
    'get', 'go', 'going', 'see', 'look', 'take', 'come', 'think',
    'thing', 'things', 'way', 'ways', 'well', 'right', 'much', 'many',
    'even', 'still', 'back', 'first', 'new', 'now', 'try', 'keep',
    'help', 'want', 'say', 'said', 'tell', 'work', 'give', 'two',
    'good', 'really', 'something', 're', 've', 'll', 'don', 'doesn',
    'didn', 'isn', 'aren', 'wasn', 'weren', 'won', 'wouldn', 'couldn',
    'shouldn', 's', 't', 'e', 'g', 'etc', 'example',

    # Scenario-structural terms (artifacts of simulation setup, not pedagogy)
    'lecture', 'simulation', 'minute', 'minutes', 'session', 'sessions',
    'review', 'module', 'topic', 'course', 'content', 'material',
    'week', 'today', 'time', 'ready', 'start', 'next', 'last',
    'great', 'sure', 'okay', 'yes', 'please', 'thanks', 'thank',
    'youve', 'youre', 'ive', 'im', 'thats', 'dont', 'cant', 'wont',
    'heres', 'lets', 'whats', 'theres', 'doesnt', 'isnt', 'havent',
    'youll', 'theyre', 'weve', 'ill', 'id',

    # Markdown / formatting artifacts
    'http', 'https', 'www', 'com', 'org', 'html',
}


def extract_messages(db_path, cell_names):
    """Extract tutor message text from suggestions JSON for given cells."""
    conn = sqlite3.connect(db_path)
    placeholders = ','.join('?' for _ in cell_names)
    query = f"""
        SELECT suggestions
        FROM evaluation_results
        WHERE profile_name IN ({placeholders})
          AND suggestions IS NOT NULL
          AND suggestions != '[]'
    """
    cursor = conn.execute(query, cell_names)
    rows = cursor.fetchall()
    conn.close()

    texts = []
    n_responses = 0
    for (suggestions_json,) in rows:
        try:
            suggestions = json.loads(suggestions_json)
            if isinstance(suggestions, list):
                for suggestion in suggestions:
                    if isinstance(suggestion, dict) and 'message' in suggestion:
                        msg = suggestion['message']
                        if msg and isinstance(msg, str):
                            texts.append(msg)
                            n_responses += 1
        except (json.JSONDecodeError, TypeError):
            continue

    # Normalize case so "Master"/"master", "Servant"/"servant" etc. merge
    combined = ' '.join(texts).lower()
    return combined, n_responses


def create_word_cloud(text, colormap, max_words=200):
    """Create a WordCloud object with specified parameters."""
    wc = WordCloud(
        width=800,
        height=600,
        max_words=max_words,
        stopwords=STOPWORDS,
        colormap=colormap,
        background_color='white',
        min_font_size=8,
        max_font_size=80,
        relative_scaling=0.5,
        prefer_horizontal=0.7,
        random_state=42,
        collocations=False,  # Avoid duplicate bigrams
    )
    wc.generate(text)
    return wc


def main():
    print("Extracting tutor messages from database...")

    base_text, base_n = extract_messages(DB_PATH, BASE_CELLS)
    recog_text, recog_n = extract_messages(DB_PATH, RECOG_CELLS)

    print(f"  Base condition:        {base_n:,} responses, {len(base_text):,} chars")
    print(f"  Recognition condition: {recog_n:,} responses, {len(recog_text):,} chars")

    if not base_text.strip() or not recog_text.strip():
        print("ERROR: No text extracted. Check database and cell names.", file=sys.stderr)
        sys.exit(1)

    # Custom colormaps
    # Base: blues/grays
    base_cmap = LinearSegmentedColormap.from_list(
        'base_blues',
        ['#4A6FA5', '#2C3E50', '#7B8D9E', '#1A365D', '#5B7BA3', '#34495E'],
        N=256
    )
    # Recognition: greens/teals
    recog_cmap = LinearSegmentedColormap.from_list(
        'recog_greens',
        ['#1B7A4E', '#0D4B2E', '#2EAA6E', '#145A3A', '#3CB371', '#0F7B5F'],
        N=256
    )

    print("Generating word clouds...")
    base_wc = create_word_cloud(base_text, base_cmap)
    recog_wc = create_word_cloud(recog_text, recog_cmap)

    # Create figure
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7), dpi=300)

    # Base panel
    ax1.imshow(base_wc, interpolation='bilinear')
    ax1.set_title('Base Condition', fontsize=16, fontweight='bold', pad=12, color='#2C3E50')
    ax1.axis('off')

    # Recognition panel
    ax2.imshow(recog_wc, interpolation='bilinear')
    ax2.set_title('Recognition Condition', fontsize=16, fontweight='bold', pad=12, color='#1B7A4E')
    ax2.axis('off')

    # Figure title and subtitle
    fig.suptitle(
        'Tutor Language Word Clouds by Condition',
        fontsize=20, fontweight='bold', y=0.98, color='#1a1a1a'
    )
    fig.text(
        0.5, 0.92,
        f'Messages-mode cells (80\u201387)  |  Base: N={base_n}  |  Recognition: N={recog_n}',
        ha='center', fontsize=12, color='#555555', style='italic'
    )

    plt.tight_layout(rect=[0, 0.02, 1, 0.90])

    # Save
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    fig.savefig(OUTPUT_PATH, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close(fig)

    print(f"Saved to: {OUTPUT_PATH}")

    # Print top words for verification
    print("\nTop 15 words per condition:")
    base_freq = base_wc.words_
    recog_freq = recog_wc.words_
    print(f"\n  {'Base':<30s} {'Recognition':<30s}")
    print(f"  {'─' * 28}   {'─' * 28}")
    base_items = list(base_freq.items())[:15]
    recog_items = list(recog_freq.items())[:15]
    for i in range(15):
        b_word, b_freq = base_items[i] if i < len(base_items) else ('', 0)
        r_word, r_freq = recog_items[i] if i < len(recog_items) else ('', 0)
        print(f"  {b_word:<22s} {b_freq:.3f}   {r_word:<22s} {r_freq:.3f}")


if __name__ == '__main__':
    main()
