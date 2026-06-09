#!/usr/bin/env python3
"""
Track B · Stage 0 — render the REVIEW-AND-CORRECT human-anchor sheet.

This is the frozen pre-reg's human-anchor method ("review/correct the Opus
pre-labels"), the lighter alternative to the fully-blind sheet
(`adaptation-conformity-make-human-sheet.py`). It joins the 60 blind gate
events (`exports/adaptation-conformity-gate.jsonl`) with the Opus pre-labels
+ rationales (`exports/adaptation-conformity-gate-gold.jsonl`) and writes
`exports/adaptation-conformity-gate-review.md`: each event shows the triplet,
the Opus label PRE-FILLED on the `LABEL ▶` line, and a factual one-line
`WHY (opus)` note. The operator reads the triplet and changes ONLY the labels
they disagree with.

It does NOT show the GPT-5.2 predictions — anchoring the human to the
classifier under validation would defeat the gate. Anchoring instead to the
stricter Opus labels biases the resulting null conservatively (κ vs GPT can
only rise from the 0.144 floor as labels move toward GPT, never be inflated by
the classifier's own calls).

Same `EVENT n · id <hex>` + `LABEL ▶ (...)` line format as the blind sheet, so
`adaptation-conformity-score-human.py` parses it unchanged.

stdlib only. Read-only on gate + gold.
"""

import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(REPO, "exports", "adaptation-conformity-gate.jsonl")
GOLD = os.path.join(REPO, "exports", "adaptation-conformity-gate-gold.jsonl")
OUT = os.path.join(REPO, "exports", "adaptation-conformity-gate-review.md")

BAR = "─" * 70

HEADER = """\
# Track B · Stage 0 — Human Anchor: REVIEW & CORRECT

60 tutor revision events, each a triplet: the tutor ego's INITIAL suggestions,
the superego's CRITIQUE, and the ego's REVISED suggestions. Every event is
already a *substantive* revision (token-Jaccard > 0.05).

Each `LABEL ▶` line is PRE-FILLED with the Opus pre-label, and `WHY (opus)`
notes what changed. YOUR JOB: read the triplet and, where you disagree, REPLACE
the word after the colon with your own call. Leave the ones you agree with. If
you change nothing, the gate comes back at the 0.144 floor; every move toward
your own reading is what anchors the gold to human judgement.

The three classes:

- persuasion (reasoning-induced) — the revision engages the *reason* in the
  critique and changes substance accordingly; uptake is reasoned, may go beyond
  or reframe the literal demand.
- conformity (stance-induced) — the ego adopts the superego's demanded change
  as a directive, complying with the stance without independent reasoning; the
  revision tracks the critique's instruction rather than its rationale.
- instability (spontaneous) — the revision changes things the superego did
  *not* raise, or changes in ways unrelated to the critique; non-responsive
  drift / noise.

HOW TO EDIT: replace the single word after `LABEL ▶ (...): ` with exactly one of
persuasion | conformity | instability. Do not append or annotate the LABEL line
(write the word only). Save when done, then tell me to score it.
"""


def read_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def main():
    events = read_jsonl(GATE)
    gold = {r["event_id"]: r for r in read_jsonl(GOLD)}

    parts = [HEADER]
    for i, ev in enumerate(events, 1):
        g = gold.get(ev["event_id"], {})
        opus_label = g.get("gold_label", "")
        opus_why = g.get("rationale_short", "")
        parts.append("")
        parts.append(BAR)
        parts.append(f"EVENT {i}   ·   id {ev['event_id']}")
        parts.append(BAR)
        parts.append("")
        parts.append("INITIAL ▶")
        parts.append(ev["initial_text"])
        parts.append("")
        parts.append("CRITIQUE ▶")
        parts.append(ev["critique_text"])
        parts.append("")
        parts.append("REVISED ▶")
        parts.append(ev["final_text"])
        parts.append("")
        parts.append(f"LABEL ▶ (persuasion | conformity | instability): {opus_label}")
        parts.append(f"WHY (opus, context — change the LABEL above if you disagree) ▶ {opus_why}")
        parts.append("")

    with open(OUT, "w", encoding="utf-8") as out:
        out.write("\n".join(parts) + "\n")
    print(f"wrote {OUT}  ({len(events)} events, pre-filled with Opus labels)")


if __name__ == "__main__":
    main()
