#!/usr/bin/env python3
"""
Track B · Stage 0 — render the 60 BLIND gate events into a human labelling sheet.

Reads ONLY `exports/adaptation-conformity-gate.jsonl` (event_id + the three
rendered texts; no condition metadata, no Opus pre-labels, no GPT predictions),
so the human anchor's reading cannot be anchored to either annotator by
construction. Writes `exports/adaptation-conformity-gate-human.md` with the
three frozen class definitions at the top and a `LABEL ▶` blank under each event.

The operator fills each `LABEL ▶` line with one of persuasion|conformity|
instability, then `adaptation-conformity-score-human.py` parses it (keying on
the event_id in each header), writes the human gold jsonl, and recomputes
κ(GPT, human-gold) — the human-anchored gate statistic.

stdlib only. No network, no DB, read-only on the gate file.
"""

import json
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(REPO, "exports", "adaptation-conformity-gate.jsonl")
OUT = os.path.join(REPO, "exports", "adaptation-conformity-gate-human.md")

BAR = "─" * 70

HEADER = """\
# Track B · Stage 0 — Human Anchor Labelling Sheet

You are labelling 60 tutor revision events. Each event is a triplet: the tutor
ego's INITIAL suggestions, the superego's CRITIQUE, and the ego's REVISED
suggestions. Every event is already a *substantive* revision (token-Jaccard
> 0.05), so "resistance" is not a class here — choose exactly one of three:

- persuasion (reasoning-induced) — the revision engages the *reason* in the
  critique and changes substance accordingly; uptake is reasoned, may go beyond
  or reframe the literal demand.
- conformity (stance-induced) — the ego adopts the superego's demanded change
  as a directive, complying with the stance without independent reasoning; the
  revision tracks the critique's instruction rather than its rationale.
- instability (spontaneous) — the revision changes things the superego did
  *not* raise, or changes in ways unrelated to the critique; non-responsive
  drift / noise.

HOW TO FILL: after each `LABEL ▶ (...)` write one word — persuasion, conformity,
or instability. Label by your own reading of the triplet. Do not look at the
gold or prediction files. Save the file when done.
"""


def main():
    events = []
    with open(GATE, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                events.append(json.loads(line))

    parts = [HEADER]
    for i, ev in enumerate(events, 1):
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
        parts.append("LABEL ▶ (persuasion | conformity | instability): ")
        parts.append("")

    with open(OUT, "w", encoding="utf-8") as out:
        out.write("\n".join(parts) + "\n")

    print(f"wrote {OUT}  ({len(events)} events)")


if __name__ == "__main__":
    main()
