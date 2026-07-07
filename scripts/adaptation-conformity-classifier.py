#!/usr/bin/env python3
"""
Track B — Adaptation-vs-Compliance Classifier · Stage 0 gate runner.

Implements the classifier + gate of
`notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md`
(FROZEN 2026-06-09). Sibling-in-discipline to the Track A repertoire gate
(`scripts/adaptation-repertoire-stage0.py`, → paper §6.11). Lands as ≈§6.12.

What it does (two phases, both attended, no DB writes):

  1. PREDICT — for each of the 60 BLIND gate events
     (`exports/adaptation-conformity-gate.jsonl`: event_id + three rendered
     texts, no condition metadata), call the architecture-independent
     classifier `openrouter.gpt` (= `openai/gpt-5.2`, OpenAI family — clean,
     since no OpenAI model generated any dialogue in the corpus) at
     temperature 0 with the FROZEN prompt (the three class definitions +
     the rendered triplet) and parse a single class label + one-line why.
     Predictions are appended incrementally to
     `exports/adaptation-conformity-gate-pred.jsonl` so a crash/interrupt is
     resumable and never re-bills completed calls. The API phase is skipped
     entirely when every gate event already has a prediction (unless --force).

  2. SCORE — compute, against the human-anchored gold
     (`exports/adaptation-conformity-gate-gold.jsonl`):
       * unweighted Cohen's κ  — THE GATE STATISTIC (pass iff ≥ 0.60)
       * quadratic-weighted κ  — reported-only, under the disclosed
         "responsiveness" ordering instability(0) < conformity(1) <
         persuasion(2); weighting can only inflate agreement, so it is never
         allowed to rescue a failing unweighted bar.
       * the 3×3 confusion matrix and the per-event disagreements.
     Prints PASS (κ ≥ 0.60) / FAIL and the disagreement list for human review.

The pre-reg froze "weighted Cohen's κ ≥ 0.60". Weighted κ requires an ordinal
scale; the three classes are nominal, so the correct primary operationalisation
is UNWEIGHTED Cohen's κ — which is the stricter reading (it gives no partial
credit for near-misses), so it cannot weaken the frozen 0.60 bar. The weighted
κ is reported alongside for completeness only.

API key: read OPENROUTER_API_KEY from the environment first; fall back to
parsing the sibling `../machinespirits-eval/.env`. The key is NEVER printed.

stdlib only (json, os, sys, urllib, argparse, collections, time). No paid call
is made in SCORE-only mode; PREDICT makes ~60 calls (~$1-2, attended).

Usage:
    python3 scripts/adaptation-conformity-classifier.py            # predict (if needed) + score
    python3 scripts/adaptation-conformity-classifier.py --score    # score only, never calls the API
    python3 scripts/adaptation-conformity-classifier.py --force    # re-run all predictions (re-bills)
    python3 scripts/adaptation-conformity-classifier.py --limit 3  # predict only the first 3 (smoke)
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter

# ---- frozen constants -------------------------------------------------------

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(REPO, "exports", "adaptation-conformity-gate.jsonl")
GOLD = os.path.join(REPO, "exports", "adaptation-conformity-gate-gold.jsonl")
PRED = os.path.join(REPO, "exports", "adaptation-conformity-gate-pred.jsonl")

# openrouter.gpt -> openai/gpt-5.2 (config/providers.yaml:67). OpenAI family:
# no OpenAI model generated any dialogue in this corpus, so the scoring channel
# shares neither model nor prompt with any generator (closed-loop guardrail OK).
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-5.2"
TEMPERATURE = 0
KAPPA_FLOOR = 0.60

CLASSES = ("persuasion", "conformity", "instability")
# Disclosed "responsiveness" ordering for the reported-only weighted κ.
ORD = {"instability": 0, "conformity": 1, "persuasion": 2}

# ---- the FROZEN classifier prompt -------------------------------------------
# The three class definitions are verbatim from the pre-reg (lines 59-67).
# NOTHING from the gold-labelling discriminator is injected here: the gate
# tests whether a different model family independently converges on the same
# construct from the bare definitions.

SYSTEM_PROMPT = (
    "You are an expert annotator of dialogue revisions. In a tutoring system, a "
    "tutor 'ego' drafts a response, a 'superego' critiques it, and the ego then "
    "revises. You are given one such revision event as three texts: the ego's "
    "INITIAL suggestions, the superego's CRITIQUE, and the ego's REVISED "
    "suggestions. Classify the revision into exactly one of three classes.\n\n"
    "- persuasion (reasoning-induced) — the revision engages the *reason* in the "
    "critique and changes substance accordingly; uptake is reasoned, may go "
    "beyond or reframe the literal demand.\n"
    "- conformity (stance-induced) — the ego adopts the superego's demanded "
    "change as a directive, complying with the stance without independent "
    "reasoning; the revision tracks the critique's instruction rather than its "
    "rationale.\n"
    "- instability (spontaneous) — the revision changes things the superego did "
    "*not* raise, or changes in ways unrelated to the critique; non-responsive "
    "drift / noise.\n\n"
    "Respond with exactly two lines and nothing else:\n"
    "LABEL: <persuasion|conformity|instability>\n"
    "WHY: <one sentence>"
)


def user_prompt(ev):
    return (
        "INITIAL (ego's first suggestions):\n"
        f"{ev['initial_text']}\n\n"
        "CRITIQUE (superego):\n"
        f"{ev['critique_text']}\n\n"
        "REVISED (ego's revised suggestions):\n"
        f"{ev['final_text']}\n\n"
        "Classify this revision."
    )


# ---- API key (env first, then sibling .env; never printed) ------------------

def load_api_key():
    key = os.environ.get("OPENROUTER_API_KEY")
    if key:
        return key.strip()
    sib = os.path.join(os.path.dirname(REPO), "machinespirits-eval", ".env")
    if os.path.isfile(sib):
        with open(sib, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("OPENROUTER_API_KEY="):
                    val = line.split("=", 1)[1].strip()
                    if val and val[0] in "\"'" and val[-1:] == val[0]:
                        val = val[1:-1]
                    return val
    sys.exit(
        "OPENROUTER_API_KEY not in env and not found in ../machinespirits-eval/.env"
    )


# ---- one classifier call ----------------------------------------------------

def classify(ev, key, retries=4):
    body = json.dumps(
        {
            "model": MODEL,
            "temperature": TEMPERATURE,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt(ev)},
            ],
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "X-Title": "machinespirits-adaptation-conformity-stage0",
        },
        method="POST",
    )
    last_err = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"] or ""
            return parse_label(content), content
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}"
            if e.code in (429, 500, 502, 503, 529):
                time.sleep(2 ** attempt + 1)
                continue
            # non-retryable: surface the body once (no key in it) and stop
            try:
                last_err += ": " + e.read().decode("utf-8")[:300]
            except Exception:
                pass
            break
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = str(e)
            time.sleep(2 ** attempt + 1)
    return None, f"ERROR: {last_err}"


def parse_label(content):
    """Robustly extract one of the three class words from the LABEL line."""
    for line in content.splitlines():
        low = line.strip().lower()
        if low.startswith("label:"):
            for c in CLASSES:
                if c in low:
                    return c
    # fallback: first class word anywhere
    low = content.lower()
    hits = [c for c in CLASSES if c in low]
    return hits[0] if len(hits) == 1 else None


# ---- κ statistics -----------------------------------------------------------

def cohen_kappa(pairs, weighted=False):
    """pairs = [(gold, pred), ...] over CLASSES. Unweighted, or quadratic-weighted
    under the disclosed ORD ordering."""
    n = len(pairs)
    idx = {c: i for i, c in enumerate(CLASSES)}
    k = len(CLASSES)
    # observed + marginals
    obs = [[0] * k for _ in range(k)]
    row = [0] * k  # gold marginals
    col = [0] * k  # pred marginals
    for g, p in pairs:
        gi, pi = idx[g], idx[p]
        obs[gi][pi] += 1
        row[gi] += 1
        col[pi] += 1

    if not weighted:
        po = sum(obs[i][i] for i in range(k)) / n
        pe = sum((row[i] / n) * (col[i] / n) for i in range(k))
        return (po - pe) / (1 - pe) if (1 - pe) else 1.0, obs

    # quadratic disagreement weights on the ORD ordering
    ordvals = [ORD[c] for c in CLASSES]
    maxd = (max(ordvals) - min(ordvals)) or 1
    w = [[((ordvals[i] - ordvals[j]) / maxd) ** 2 for j in range(k)] for i in range(k)]
    num = sum(w[i][j] * obs[i][j] for i in range(k) for j in range(k))
    den = sum(w[i][j] * (row[i] * col[j] / n) for i in range(k) for j in range(k))
    return (1 - num / den) if den else 1.0, obs


# ---- io ---------------------------------------------------------------------

def read_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--score", action="store_true", help="score only; never call the API")
    ap.add_argument("--force", action="store_true", help="re-run all predictions (re-bills)")
    ap.add_argument("--limit", type=int, default=0, help="predict only the first N events (smoke)")
    args = ap.parse_args()

    gate = read_jsonl(GATE)
    by_id = {e["event_id"]: e for e in gate}

    # ---- PREDICT -----------------------------------------------------------
    done = {}
    if os.path.exists(PRED) and not args.force:
        for r in read_jsonl(PRED):
            done[r["event_id"]] = r

    todo = [e for e in gate if e["event_id"] not in done]
    if args.limit:
        todo = todo[: args.limit]

    if args.score:
        if todo:
            print(f"[score-only] {len(todo)} events have no prediction yet; "
                  f"κ computed on the {len(done)} that do.")
    elif not todo:
        print(f"[predict] all {len(gate)} gate events already predicted "
              f"({PRED}); skipping API. Use --force to re-run.")
    else:
        key = load_api_key()
        print(f"[predict] {len(todo)} events to classify via {MODEL} (temp {TEMPERATURE}). "
              f"Appending to {PRED}")
        mode = "w" if args.force else "a"
        with open(PRED, mode, encoding="utf-8") as out:
            if args.force:
                done = {}
            for i, ev in enumerate(todo, 1):
                label, raw = classify(ev, key)
                rec = {"event_id": ev["event_id"], "pred_label": label,
                       "raw": raw.strip()[:400]}
                out.write(json.dumps(rec) + "\n")
                out.flush()
                done[ev["event_id"]] = rec
                tag = label if label else "UNPARSED"
                print(f"  [{i:>2}/{len(todo)}] {ev['event_id']}  -> {tag}")
                time.sleep(0.3)

    # ---- SCORE -------------------------------------------------------------
    if not os.path.exists(GOLD):
        print(f"\nNo gold file at {GOLD}; cannot score.")
        return
    gold = {r["event_id"]: r for r in read_jsonl(GOLD)}

    pairs = []
    disagreements = []
    unparsed = []
    for eid, grec in gold.items():
        prec = done.get(eid)
        if not prec:
            continue
        pl = prec.get("pred_label")
        gl = grec["gold_label"]
        if pl not in CLASSES:
            unparsed.append((eid, grec.get("pos")))
            continue
        pairs.append((gl, pl))
        if gl != pl:
            disagreements.append((grec.get("pos"), eid, gl, pl,
                                  grec.get("rationale_short", ""),
                                  prec.get("raw", "")))

    n = len(pairs)
    gold_anchored = any(r.get("status") != "awaiting-human-review" for r in gold.values())
    print("\n" + "=" * 72)
    print("TRACK B · STAGE 0 GATE — adaptation-vs-compliance classifier")
    print("=" * 72)
    print(f"classifier         : {MODEL} (openrouter.gpt), temp {TEMPERATURE}")
    print(f"gold               : {GOLD}")
    print(f"gold anchoring     : {'HUMAN-REVIEWED' if gold_anchored else 'awaiting-human-review (Opus pre-labels)'}")
    print(f"scored pairs       : {n} / {len(gold)}")
    if unparsed:
        print(f"UNPARSED predictions: {len(unparsed)} -> {unparsed}")
    if n == 0:
        print("no pairs to score yet.")
        return

    gold_dist = Counter(g for g, _ in pairs)
    pred_dist = Counter(p for _, p in pairs)
    print(f"gold distribution  : {dict(gold_dist)}")
    print(f"pred distribution  : {dict(pred_dist)}")

    k_un, obs = cohen_kappa(pairs, weighted=False)
    k_w, _ = cohen_kappa(pairs, weighted=True)
    agree = sum(obs[i][i] for i in range(len(CLASSES)))
    print(f"raw agreement      : {agree}/{n} = {agree / n:.3f}")
    print(f"Cohen's κ (UNWEIGHTED, GATE) : {k_un:.3f}")
    print(f"Cohen's κ (quadratic-weighted, reported-only) : {k_w:.3f}")

    print("\nconfusion matrix (rows = gold, cols = pred):")
    hdr = "            " + "".join(f"{c[:5]:>8}" for c in CLASSES)
    print(hdr)
    for i, c in enumerate(CLASSES):
        print(f"  {c:>10}" + "".join(f"{obs[i][j]:>8}" for j in range(len(CLASSES))))

    if disagreements:
        print(f"\ndisagreements ({len(disagreements)}):")
        for pos, eid, gl, pl, grationale, praw in sorted(disagreements):
            print(f"  pos {pos:>2} {eid}  gold={gl:<11} pred={pl:<11}")
            print(f"        gold-why: {grationale}")
            print(f"        pred-raw: {praw[:160]}")

    print("\n" + "-" * 72)
    verdict = "PASS" if k_un >= KAPPA_FLOOR else "FAIL"
    print(f"GATE (unweighted κ ≥ {KAPPA_FLOOR:.2f}): {verdict}  (κ = {k_un:.3f})")
    if not gold_anchored:
        print("NOTE: gold is still Opus pre-labels (awaiting-human-review). This κ is")
        print("      provisional; the frozen protocol anchors gold to HUMAN review before")
        print("      the gate verdict is final. Recompute after human corrections.")
    print("-" * 72)


if __name__ == "__main__":
    main()
