#!/usr/bin/env python3
"""
Track B -- Adaptation-vs-Compliance -- Stage 0 HARVEST  (offline, zero-API, read-only)

Pre-registration: notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md
(FROZEN 2026-06-09, before any classifier call or kappa computation).

Sibling-in-discipline to scripts/adaptation-repertoire-stage0.py (Track A, §6.11)
and the §6.10 / §6.9.8 offline kill gates. stdlib + sqlite3 only. No API. No DB
writes (SELECT only, mode=ro). Reads existing trace files. This script does the
HARVEST + GATE-SAMPLE half only -- it emits no class labels. The classifier
(scripts/adaptation-conformity-classifier.py) and the human-anchored gold come
after, and the kappa>=0.60 gate decides whether the full run is bought. Lands as
≈§6.12 of docs/research/paper-full-2.0.md, positive or negative, no spin-off.

==============================================================================
THE UNIT (frozen; §"Unit" of the pre-reg)
==============================================================================
One REVISION EVENT = the triplet (ego initial suggestions, superego critique,
ego revised suggestions) from one tutor turn in which the superego pushed back
and the ego subsequently revised.

Extraction (schema verified 2026-06-09 on a dialectical_suspicious trace; this
is field-name / rendering plumbing -- the frozen gate is untouched):
  - Walk the flat `dialogueTrace` array. A revision event is anchored on a
    NON-APPROVING `agent='superego' action='review'` entry S.
  - initial = the nearest PRECEDING ego entry (agent='ego',
    action in {generate,revise,incorporate-feedback}) within the same turn
    (search stops at a `tutor/context_input` turn boundary).
  - revision = the nearest FOLLOWING ego entry within the same turn (search
    stops at the next `context_input` OR the next `superego/review`).
  - A turn with two superego rounds yields two events (S1 pairs gen->rev1,
    S2 pairs rev1->rev2): each is a genuine pushback+revision.

Text rendering (frozen, identical for gold annotator and GPT-5.2 classifier):
  initial_text = title+message across the initial ego `suggestions` payload;
  final_text   = title+message across the revised ego `suggestions` payload;
  critique_text= superego `feedback` (fallback `verdict.feedback`) + the
                 `suggestedChanges.rejectionReason` if distinct.
  Each truncated to 1500 chars. NO cell/profile/score is shown (blind).

Substantive-change restriction (frozen, model-free): an event is SUBSTANTIVE
iff token-Jaccard distance(initial, final) > 0.05. Events at/below the floor are
RESISTANCE (the ego held its ground) and are recorded with substantive=false,
reported as a separate rate, never forced into a class. Only substantive events
enter the gate sample and (later) the full run.

==============================================================================
WHAT THIS SCRIPT EMITS
==============================================================================
  exports/adaptation-conformity-harvest.jsonl  -- one line per revision event
        (substantive AND resistance), with event_id + full metadata + the three
        blind-rendered texts. The full-run sample (if the gate passes) is drawn
        from here.
  exports/adaptation-conformity-gate.jsonl      -- the seeded stratified 60-event
        gold sample, BLIND fields only (event_id + the three texts). This is what
        the annotator labels and the classifier scores. Condition metadata is
        deliberately absent.
  exports/adaptation-conformity-harvest.meta.json -- corpus counts, per-family
        yields, resistance rate, gate-sample composition.

Gate sample (frozen): deterministic, seed 20260609. Stratified by superego
FAMILY (suspicious / adversary / advocate / standard_multi / dialectical_mechanism
/ other), drawn ROUND-ROBIN across families (each family's pool shuffled with the
seed, sorted by event_id first for determinism) until 60 substantive events are
collected -- equal representation so the divergent families (the §"primary
contrast" targets) are well-covered in the gold set.

DISPOSITION (frozen): this script never decides anything. The kappa gate in
scripts/adaptation-conformity-classifier.py does, and a null there is the result
(no tune-and-retry). Both outcomes land as ≈§6.12.
==============================================================================
"""
import os, sys, json, re, sqlite3, hashlib, random
from datetime import datetime, timezone

SEED = 20260609
JACCARD_FLOOR = 0.05      # frozen: substantive-change threshold
GATE_N = 60               # frozen: gold-set size
TRUNC = 1500              # frozen: per-field render truncation

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.environ.get("EVAL_DB_PATH", os.path.join(REPO, "data", "evaluations.db"))
OUT_HARVEST = os.path.join(REPO, "exports", "adaptation-conformity-harvest.jsonl")
OUT_GATE = os.path.join(REPO, "exports", "adaptation-conformity-gate.jsonl")
OUT_META = os.path.join(REPO, "exports", "adaptation-conformity-harvest.meta.json")

TOKEN = re.compile(r"[a-z]+")


def resolve_logs():
    """tutor-dialogues trace dir. EVAL_LOGS_DIR may point at .../logs (with a
    tutor-dialogues/ subdir) or directly at the trace dir. Falls back to the
    sibling machinespirits-eval repo (the current log-dir stopgap for this fork),
    then to the repo's own logs/."""
    env = os.environ.get("EVAL_LOGS_DIR")
    cands = []
    if env:
        cands += [os.path.join(env, "tutor-dialogues"), env]
    cands += [
        os.path.join(REPO, "logs", "tutor-dialogues"),
        os.path.join(REPO, "logs"),
        os.path.join(os.path.dirname(REPO), "machinespirits-eval", "logs", "tutor-dialogues"),
    ]
    for c in cands:
        if os.path.isdir(c):
            return c
    return cands[0]


LOGS = resolve_logs()


def toks(s):
    return TOKEN.findall((s or "").lower())


def jaccard_dist(a, b):
    """Token-set Jaccard distance (model-free). Same definition as Track A."""
    sa, sb = set(toks(a)), set(toks(b))
    if not sa and not sb:
        return 0.0
    u = len(sa | sb)
    return 1.0 - (len(sa & sb) / u if u else 0.0)


def sugg_text(raw):
    """Ego message AS RENDERED = title+message of the parsed `suggestions`
    payload (JSON-string array of {title,message,...}). Excludes `reasoning`
    (internal). Same extraction as scripts/adaptation-repertoire-stage0.py."""
    if not raw:
        return ""
    try:
        arr = json.loads(raw) if isinstance(raw, str) else raw
    except Exception:
        return raw if isinstance(raw, str) else ""
    if isinstance(arr, dict):
        arr = [arr]
    if not isinstance(arr, list):
        return str(arr)
    parts = []
    for it in arr:
        if isinstance(it, dict):
            seg = f'{it.get("title") or ""}. {it.get("message") or ""}'.strip()
            parts.append(seg)
        else:
            parts.append(str(it))
    return " ".join(p for p in parts if p)


def as_dict(x):
    """Coerce a trace field to a dict. Some traces carry `verdict` /
    `suggestedChanges` as a JSON string or a list; anything that is not a
    (parseable) dict becomes {} so .get() is always safe."""
    if isinstance(x, dict):
        return x
    if isinstance(x, str):
        try:
            v = json.loads(x)
            return v if isinstance(v, dict) else {}
        except Exception:
            return {}
    return {}


def critique_text(e):
    """Superego critique = `feedback` (fallback `verdict.feedback`) plus the
    `suggestedChanges.rejectionReason` if it adds anything not already in the
    feedback."""
    fb = e.get("feedback") or as_dict(e.get("verdict")).get("feedback") or ""
    rr = as_dict(e.get("suggestedChanges")).get("rejectionReason") or ""
    parts = [fb] if fb else []
    if rr and rr[:80] not in fb:
        parts.append("Rejection reason: " + rr)
    return " ".join(parts).strip()


def trunc(s):
    s = s or ""
    return s[:TRUNC] + ("…" if len(s) > TRUNC else "")


def is_ego(e):
    return e.get("agent") == "ego" and e.get("action") in (
        "generate", "revise", "incorporate-feedback")


def is_boundary(e):
    return e.get("agent") == "tutor" and e.get("action") == "context_input"


def is_superego_review(e):
    return e.get("agent") == "superego" and e.get("action") == "review"


def is_nonapproving(e):
    """Did the superego push back? Directly observed `approved` first (the trace
    field seen in recon = False on a reject), then `verdict.approved`, then a
    change-requesting `interventionType`."""
    ap = e.get("approved")
    if ap is False:
        return True
    if ap is True:
        return False
    va = as_dict(e.get("verdict")).get("approved")
    if va is False:
        return True
    if va is True:
        return False
    it = (e.get("interventionType") or "").lower()
    return it not in ("", "none", "approve", "endorse", "accept", "pass")


def superego_family(*profiles):
    """Coarse family for stratification + the divergent-vs-advisory contrast.
    Derived from any available profile string (DB cell name OR trace base
    profile). Order matters: suspicious/adversary/advocate are checked before
    the generic 'multi'/dialectical buckets."""
    p = " ".join(x for x in profiles if x).lower()
    if "suspicious" in p:
        return "suspicious"
    if "adversary" in p:
        return "adversary"
    if "advocate" in p:
        return "advocate"
    dial_marks = ("selfreflect", "profile", "intersubjective", "combined",
                  "quantitative", "erosion", "prosthesis", "coupling",
                  "behaviorist", "directive", "two_pass", "best_of_n",
                  "dialectical")
    if any(m in p for m in dial_marks):
        return "dialectical_mechanism"
    if "multi" in p:
        return "standard_multi"
    return "other"


def extract_events(trace, did, db_profile, trace_profile, scenario):
    """Yield revision-event dicts from one dialogueTrace."""
    fam = superego_family(db_profile, trace_profile)
    n = len(trace)
    out = []
    for i, e in enumerate(trace):
        if not isinstance(e, dict):
            continue
        if not (is_superego_review(e) and is_nonapproving(e)):
            continue
        # initial: nearest preceding ego within the turn
        init = None
        for j in range(i - 1, -1, -1):
            ej = trace[j]
            if not isinstance(ej, dict):
                continue
            if is_boundary(ej):
                break
            if is_ego(ej):
                init = ej
                break
        # revision: nearest following ego within the turn (stop at next boundary
        # or next superego review -- a review with no ego before it produced no
        # direct revision)
        rev = None
        for j in range(i + 1, n):
            ej = trace[j]
            if not isinstance(ej, dict):
                continue
            if is_boundary(ej) or is_superego_review(ej):
                break
            if is_ego(ej):
                rev = ej
                break
        if init is None or rev is None:
            continue
        init_text = sugg_text(init.get("suggestions"))
        final_text = sugg_text(rev.get("suggestions"))
        crit = critique_text(e)
        if not init_text or not final_text or not crit:
            continue
        jd = jaccard_dist(init_text, final_text)
        event_id = hashlib.sha1(
            f"{did}|{init.get('round')}|{i}|{rev.get('round')}".encode()
        ).hexdigest()[:16]
        out.append({
            "event_id": event_id,
            "dialogue_id": did,
            "db_profile": db_profile,
            "trace_profile": trace_profile,
            "scenario_id": scenario,
            "superego_family": fam,
            "round_initial": init.get("round"),
            "round_superego": e.get("round"),
            "round_revision": rev.get("round"),
            "intervention_type": e.get("interventionType"),
            "ego_action_initial": init.get("action"),
            "ego_action_revision": rev.get("action"),
            "jaccard_dist": round(jd, 4),
            "substantive": jd > JACCARD_FLOOR,
            "initial_text": trunc(init_text),
            "critique_text": trunc(crit),
            "final_text": trunc(final_text),
        })
    return out


def main():
    if not os.path.exists(DB):
        print("NO DB at", DB)
        sys.exit(2)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT dialogue_id, profile_name, scenario_id FROM evaluation_results "
        "WHERE dialogue_id IS NOT NULL GROUP BY dialogue_id"
    ).fetchall()
    con.close()

    skipped = {"no_file": 0, "bad_json": 0, "no_trace": 0}
    events = []
    seen = set()
    dialogues_with_superego = 0
    dialogues_with_event = 0
    for did, prof, scen in rows:
        if did in seen:
            continue
        seen.add(did)
        fp = os.path.join(LOGS, f"{did}.json")
        if not os.path.exists(fp):
            skipped["no_file"] += 1
            continue
        try:
            d = json.load(open(fp))
        except Exception:
            skipped["bad_json"] += 1
            continue
        tr = d.get("dialogueTrace") or d.get("trace") or []
        if not isinstance(tr, list) or not tr:
            skipped["no_trace"] += 1
            continue
        has_superego = any(
            isinstance(e, dict) and is_superego_review(e) for e in tr)
        if has_superego:
            dialogues_with_superego += 1
        trace_profile = d.get("profileName")
        evs = extract_events(tr, did, prof, trace_profile, str(scen) if scen is not None else None)
        if evs:
            dialogues_with_event += 1
            events.extend(evs)

    substantive = [e for e in events if e["substantive"]]
    resistance = [e for e in events if not e["substantive"]]

    # ---- per-family yields ----
    fam_counts, fam_subst = {}, {}
    for e in events:
        fam_counts[e["superego_family"]] = fam_counts.get(e["superego_family"], 0) + 1
    for e in substantive:
        fam_subst[e["superego_family"]] = fam_subst.get(e["superego_family"], 0) + 1

    # ---- seeded stratified round-robin gate sample over substantive events ----
    by_fam = {}
    for e in substantive:
        by_fam.setdefault(e["superego_family"], []).append(e)
    rng = random.Random(SEED)
    for fam in by_fam:
        by_fam[fam].sort(key=lambda e: e["event_id"])   # determinism before shuffle
        rng.shuffle(by_fam[fam])
    fams_sorted = sorted(by_fam.keys())
    gate, cursors = [], {f: 0 for f in fams_sorted}
    while len(gate) < GATE_N and any(cursors[f] < len(by_fam[f]) for f in fams_sorted):
        for f in fams_sorted:
            if len(gate) >= GATE_N:
                break
            if cursors[f] < len(by_fam[f]):
                gate.append(by_fam[f][cursors[f]])
                cursors[f] += 1
    gate_fam_comp = {}
    for e in gate:
        gate_fam_comp[e["superego_family"]] = gate_fam_comp.get(e["superego_family"], 0) + 1

    # ---- write artifacts ----
    os.makedirs(os.path.dirname(OUT_META), exist_ok=True)
    with open(OUT_HARVEST, "w") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")
    # gate.jsonl: BLIND fields only (annotator + classifier see no condition)
    with open(OUT_GATE, "w") as f:
        for e in gate:
            f.write(json.dumps({
                "event_id": e["event_id"],
                "initial_text": e["initial_text"],
                "critique_text": e["critique_text"],
                "final_text": e["final_text"],
            }) + "\n")

    meta = {
        "stage": "Track B Adaptation-vs-Compliance Stage 0 HARVEST (offline, zero-API, read-only)",
        "preregistration": "notes/2026-06-09-adaptation-conformity-classifier-stage0-preregistration.md",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "seed": SEED, "jaccard_floor": JACCARD_FLOOR, "gate_n": GATE_N, "trunc": TRUNC,
        "zero_api": True, "read_only": True, "db": DB, "logs": LOGS,
        "corpus": {
            "db_dialogues_scanned": len(seen),
            "skipped": skipped,
            "dialogues_with_any_superego_review": dialogues_with_superego,
            "dialogues_with_revision_event": dialogues_with_event,
            "revision_events_total": len(events),
            "revision_events_substantive": len(substantive),
            "revision_events_resistance": len(resistance),
            "resistance_rate": (len(resistance) / len(events)) if events else None,
        },
        "per_family_all_events": fam_counts,
        "per_family_substantive": fam_subst,
        "gate_sample": {
            "n": len(gate),
            "family_composition": gate_fam_comp,
            "file": OUT_GATE,
        },
        "artifacts": {
            "harvest_jsonl": OUT_HARVEST,
            "gate_jsonl": OUT_GATE,
        },
        "next": (
            "Annotate exports/adaptation-conformity-gate.jsonl into the three "
            "classes (blind), write exports/adaptation-conformity-gate-gold.jsonl, "
            "THEN run scripts/adaptation-conformity-classifier.py. kappa>=0.60 gate."),
    }
    json.dump(meta, open(OUT_META, "w"), indent=2)

    print("=" * 74)
    print("Track B -- Adaptation-vs-Compliance Stage 0 HARVEST (offline, read-only)")
    print("=" * 74)
    c = meta["corpus"]
    print(f"DB dialogues scanned : {c['db_dialogues_scanned']}  skipped={c['skipped']}")
    print(f"with superego review : {c['dialogues_with_any_superego_review']}")
    print(f"with revision event  : {c['dialogues_with_revision_event']}")
    print(f"revision events      : {c['revision_events_total']}  "
          f"(substantive={c['revision_events_substantive']}, "
          f"resistance={c['revision_events_resistance']}, "
          f"resistance_rate={(c['resistance_rate'] or 0):.3f})")
    print()
    print("substantive events by superego family:")
    for fam in sorted(fam_subst, key=lambda k: -fam_subst[k]):
        print(f"  {fam:24s} {fam_subst[fam]:5d}")
    print()
    print(f"GATE SAMPLE (seed {SEED}, n={len(gate)}): {gate_fam_comp}")
    print("artifacts:", OUT_HARVEST, OUT_GATE, OUT_META)


if __name__ == "__main__":
    main()
