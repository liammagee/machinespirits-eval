#!/usr/bin/env python3
"""
Track B · Stage 0 — score the HUMAN-anchored gate.

Parses the filled `exports/adaptation-conformity-gate-human.md` (keying on the
event_id in each `EVENT n · id <hex>` header and the following `LABEL ▶` line),
writes the human gold to `exports/adaptation-conformity-gate-gold-human.jsonl`,
and recomputes κ against the GPT-5.2 predictions
(`exports/adaptation-conformity-gate-pred.jsonl`).

This is the human-anchor step of the frozen pre-reg
(`notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md`): the gate
verdict is κ(classifier, HUMAN gold) ≥ 0.60. Pass iff unweighted Cohen's κ ≥
0.60 (the nominal-correct, stricter operationalisation of the frozen "weighted
κ ≥ 0.60"); quadratic-weighted κ reported alongside for completeness only.

Also reports, for context (not the gate):
  κ(GPT, Opus pre-labels), κ(Opus, human), so you can see how the human anchor
  relates to each machine annotator.

stdlib only. No network, no DB. Idempotent: re-run after editing the sheet.

Usage:
    python3 scripts/adaptation-conformity-score-human.py
"""

import json
import os
import re
import sys
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Prefer the review-and-correct sheet (Opus pre-labels the operator edits); fall
# back to the fully-blind sheet if only that exists. Whichever the operator
# actually filled is the one we score — the parser is identical for both.
_REVIEW_MD = os.path.join(REPO, "exports", "adaptation-conformity-gate-review.md")
_BLIND_MD = os.path.join(REPO, "exports", "adaptation-conformity-gate-human.md")
HUMAN_MD = _REVIEW_MD if os.path.exists(_REVIEW_MD) else _BLIND_MD
HUMAN_GOLD = os.path.join(REPO, "exports", "adaptation-conformity-gate-gold-human.jsonl")
OPUS_GOLD = os.path.join(REPO, "exports", "adaptation-conformity-gate-gold.jsonl")
PRED = os.path.join(REPO, "exports", "adaptation-conformity-gate-pred.jsonl")
GATE = os.path.join(REPO, "exports", "adaptation-conformity-gate.jsonl")

CLASSES = ("persuasion", "conformity", "instability")
ORD = {"instability": 0, "conformity": 1, "persuasion": 2}
KAPPA_FLOOR = 0.60

HDR_RE = re.compile(r"^EVENT\s+(\d+)\s+·\s+id\s+([0-9a-f]+)", re.IGNORECASE)
LABEL_RE = re.compile(r"^LABEL\s*▶[^:]*:\s*(.*)$", re.IGNORECASE)


def read_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def parse_human_md(path):
    """Return {event_id: (pos, label_or_None)} and a list of unparsed lines."""
    labels = {}
    cur_id = None
    cur_pos = None
    problems = []
    with open(path, encoding="utf-8") as fh:
        for ln in fh:
            m = HDR_RE.match(ln.strip())
            if m:
                cur_pos = int(m.group(1))
                cur_id = m.group(2)
                labels.setdefault(cur_id, (cur_pos, None))
                continue
            lm = LABEL_RE.match(ln.strip())
            if lm and cur_id is not None:
                raw = lm.group(1).strip().lower()
                found = [c for c in CLASSES if c in raw]
                if len(found) == 1:
                    labels[cur_id] = (cur_pos, found[0])
                elif raw:
                    problems.append((cur_pos, cur_id, raw))
                # blank stays None
                cur_id = None  # consume; next header resets
    return labels, problems


def cohen_kappa(pairs, weighted=False):
    n = len(pairs)
    if n == 0:
        return None, [[0] * 3 for _ in range(3)]
    idx = {c: i for i, c in enumerate(CLASSES)}
    k = len(CLASSES)
    obs = [[0] * k for _ in range(k)]
    row = [0] * k
    col = [0] * k
    for a, b in pairs:
        ai, bi = idx[a], idx[b]
        obs[ai][bi] += 1
        row[ai] += 1
        col[bi] += 1
    if not weighted:
        po = sum(obs[i][i] for i in range(k)) / n
        pe = sum((row[i] / n) * (col[i] / n) for i in range(k))
        return ((po - pe) / (1 - pe) if (1 - pe) else 1.0), obs
    ordv = [ORD[c] for c in CLASSES]
    maxd = (max(ordv) - min(ordv)) or 1
    w = [[((ordv[i] - ordv[j]) / maxd) ** 2 for j in range(k)] for i in range(k)]
    num = sum(w[i][j] * obs[i][j] for i in range(k) for j in range(k))
    den = sum(w[i][j] * (row[i] * col[j] / n) for i in range(k) for j in range(k))
    return ((1 - num / den) if den else 1.0), obs


def print_confusion(obs, rowname, colname):
    print(f"\nconfusion (rows = {rowname}, cols = {colname}):")
    print("            " + "".join(f"{c[:5]:>8}" for c in CLASSES))
    for i, c in enumerate(CLASSES):
        print(f"  {c:>10}" + "".join(f"{obs[i][j]:>8}" for j in range(len(CLASSES))))


def main():
    if not os.path.exists(HUMAN_MD):
        sys.exit("no human sheet found — run adaptation-conformity-make-review-sheet.py "
                 "(review-and-correct) or adaptation-conformity-make-human-sheet.py (blind) first")
    print(f"reading human labels from {os.path.basename(HUMAN_MD)}")

    gate_ids = [e["event_id"] for e in read_jsonl(GATE)]
    human, problems = parse_human_md(HUMAN_MD)

    filled = {eid: lab for eid, (pos, lab) in human.items() if lab}
    missing = [eid for eid in gate_ids if not human.get(eid, (None, None))[1]]

    print(f"parsed {len(human)} event headers; {len(filled)}/{len(gate_ids)} labelled.")
    if problems:
        print(f"UNRECOGNISED label text ({len(problems)}): {problems}")
    if missing:
        print(f"STILL BLANK ({len(missing)}): "
              f"{[human.get(e, (None,))[0] for e in missing]}")
        print("Fill every LABEL ▶ line, then re-run. (κ below uses only the labelled ones.)")

    # write human gold for the record
    pred = {r["event_id"]: r for r in read_jsonl(PRED)}
    opus = {r["event_id"]: r for r in read_jsonl(OPUS_GOLD)}
    with open(HUMAN_GOLD, "w", encoding="utf-8") as out:
        for eid in gate_ids:
            pos, lab = human.get(eid, (None, None))
            out.write(json.dumps({
                "event_id": eid, "pos": pos, "gold_label": lab,
                "annotator": "human-operator", "status": "human-anchored",
            }) + "\n")
    print(f"wrote {HUMAN_GOLD}")

    # ---- the gate: κ(GPT pred, human gold) ----
    gate_pairs = []
    gate_disagree = []
    for eid in gate_ids:
        h = filled.get(eid)
        p = pred.get(eid, {}).get("pred_label")
        if h and p in CLASSES:
            gate_pairs.append((h, p))
            if h != p:
                gate_disagree.append((human[eid][0], eid, h, p,
                                      pred[eid].get("raw", "")[:150]))

    print("\n" + "=" * 72)
    print("TRACK B · STAGE 0 — HUMAN-ANCHORED GATE")
    print("=" * 72)
    print(f"gate statistic: κ(GPT-5.2 classifier, HUMAN gold), n = {len(gate_pairs)}")
    if gate_pairs:
        hdist = Counter(h for h, _ in gate_pairs)
        pdist = Counter(p for _, p in gate_pairs)
        print(f"human distribution : {dict(hdist)}")
        print(f"pred  distribution : {dict(pdist)}")
        k_un, obs = cohen_kappa(gate_pairs, weighted=False)
        k_w, _ = cohen_kappa(gate_pairs, weighted=True)
        agree = sum(obs[i][i] for i in range(3))
        print(f"raw agreement      : {agree}/{len(gate_pairs)} = {agree/len(gate_pairs):.3f}")
        print(f"Cohen's κ (UNWEIGHTED, GATE)                : {k_un:.3f}")
        print(f"Cohen's κ (quadratic-weighted, reported-only): {k_w:.3f}")
        print_confusion(obs, "human", "GPT")
        if gate_disagree:
            print(f"\ngate disagreements ({len(gate_disagree)}):")
            for pos, eid, h, p, praw in sorted(gate_disagree):
                print(f"  pos {pos:>2} {eid}  human={h:<11} GPT={p:<11}")
                print(f"        GPT-why: {praw}")

    # ---- context (not the gate) ----
    print("\n" + "-" * 72)
    print("context (NOT the gate):")
    for aname, a, bname, b in (
        ("GPT", pred, "Opus", opus),
        ("Opus", opus, "human", filled),
    ):
        pairs = []
        for eid in gate_ids:
            av = a.get(eid, {}).get("pred_label") if aname == "GPT" else \
                 (a.get(eid, {}).get("gold_label") if aname == "Opus" else a.get(eid))
            bv = b.get(eid, {}).get("gold_label") if bname == "Opus" else \
                 (b.get(eid) if bname == "human" else b.get(eid, {}).get("pred_label"))
            if av in CLASSES and bv in CLASSES:
                pairs.append((av, bv))
        kk, _ = cohen_kappa(pairs, weighted=False)
        kstr = f"{kk:.3f}" if kk is not None else "n/a"
        print(f"  κ({aname}, {bname}) = {kstr}   (n={len(pairs)})")

    if gate_pairs and not missing:
        k_un, _ = cohen_kappa(gate_pairs, weighted=False)
        print("\n" + "-" * 72)
        verdict = "PASS" if k_un >= KAPPA_FLOOR else "FAIL"
        print(f"GATE (unweighted κ ≥ {KAPPA_FLOOR:.2f}): {verdict}  (κ = {k_un:.3f})")
        if verdict == "FAIL":
            print("Per the frozen kill rule: κ < 0.60 → Track B dropped, null is the")
            print("result, NO tune-and-retry. Lands as ≈§6.12.")
        print("-" * 72)
    else:
        print("\n(label all 60 events, then re-run for the final gate verdict.)")


if __name__ == "__main__":
    main()
