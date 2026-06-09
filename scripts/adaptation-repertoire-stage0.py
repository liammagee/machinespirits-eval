#!/usr/bin/env python3
"""
Track A -- Repertoire-Ceiling Diagnostic -- Stage 0  (offline, zero-API, read-only)

Pre-registration: notes/adaptation-repertoire-stage0-preregistration.md
(FROZEN 2026-06-09, before any query of the evaluation data; user signed off
on the "Option A" matched-learner design that day).

Sibling-in-discipline to scripts/adaptation2-stage0.py (the ADAPTATION-PLAN-2.0
§6.10 offline kill gate) and scripts/learned-adaptation-policy-ope.py (§6.9.8).
numpy + stdlib + sqlite3 only. No API. No DB writes (SELECT only, mode=ro).
Reads existing trace files. Lands as §6.11 of docs/research/paper-full-2.0.md,
positive or negative, no spin-off.

==============================================================================
THE QUESTION (one question; §2 of notes/adaptation-exploration-plan.md)
==============================================================================
Is the adaptation ceiling a *mechanism* failure or a *repertoire* failure? The
five convergent negatives (§6.7, §6.8.8, §6.9.7, §6.9.8, §6.10) all assumed the
mechanism stacked on the tutor was the bottleneck. The rival never tested: the
tutor's OUTPUT DISTRIBUTION is itself collapsed -- much the same explanatory
moves regardless of who the learner is -- so there is little learner-conditioned
variation for any mechanism to amplify. If so, the five negatives are
*explained*, not merely extended.

==============================================================================
DESIGN (matched-learner symmetry; frozen). See pre-reg for full prose.
==============================================================================
Corpus: evaluation_results rows with learner_architecture LIKE 'ego_superego%'
and a dialogue_id whose trace file exists. The ego-superego restriction is
forced -- a scripted `unified` learner emits identical text every run, so its
cross-run dispersion is zero and the matched yardstick is undefined.

Externalised text per turn (what the *other* side sees):
  tutor   = the ego generate/revise `suggestions` payload (title+message);
            within a turn the LAST one wins (revise overrides generate).
  learner = the learner's final externalised message, by label priority
            learner/final_output (detail) > learner_synthesis/response (detail)
            > user/turn_action (contextSummary). user/final_output is a
            "Turn N complete" MARKER, never learner text.

Turn model (schema discovered 2026-06-09; field-name plumbing only -- the gate
below is untouched): every dialogue in this corpus is TUTOR-FIRST (unanimous
over a 293-file probe): seed -> T0 -> L0 -> T1 -> L1 -> ... So each EXCHANGE k
(k>=1) is (input = L_{k-1}, response = T_k); T0 answers the fixed seed. This is
how the frozen "pair the tutor response with the learner message it responds
to" maps onto tutor-first traces. (The pre-reg text wrote the echo-strip
formula under a learner-first index convention; the *principle* -- strip the
immediately preceding turn, pair the response with its input -- is what is
frozen, and is implemented faithfully here.)

Echo-stripping (control the parroting confound), symmetric both sides:
  tutor_own(T_k)   = tokens(T_k)     - tokens(L_{k-1})   (strip the input it answers)
  learner_own(L_k) = tokens(L_k)     - tokens(T_k)       (strip the tutor it answers)

Stratum = (scenario_id x profile_name x exchange_index k). Across the runs of a
stratum, on echo-stripped token sets:
  D_out = mean pairwise token-set cosine distance among the tutor turns  (T_k)
  D_in  = mean pairwise token-set cosine distance among the learner turns(L_{k-1})
cosine distance = scripts/adaptation2-stage0.py's `cos_dist` verbatim (binary
token-set cosine); token-Jaccard is the frozen robustness target.

Inclusion (frozen): a stratum enters the primary contrast iff >= 3 runs AND
D_in > 0.05 (the learner actually varies; below this "does the tutor track the
learner" is ill-posed). The share excluded for D_in <= 0.05 is itself reported.

TWO FROZEN QUANTITIES (each a natural zero boundary):
  delta = mean_strata( D_out - D_in )          boundary 0; <0 => tutor compresses
  rho   = partialSpearman( D_out, D_in | k )   boundary 0; >0 => tutor tracks learner

INFERENCE (frozen): cluster bootstrap by scenario_id (B=2000, seed 20260609) --
the honest variance unit (dispersion is overwhelmingly between scenarios; a
stratum-level bootstrap would manufacture a false pass; the §6.10/§6.9.8 rule).
95% percentile CI. No alpha correction (delta and rho are two facets -- level vs
coupling -- deliberately combined into one read, not two tests of one hypothesis).

FROZEN READS -- the 2x2 (a null / either outcome IS the §6.11 result):
  COLLAPSE     iff upper95(delta) < 0  AND  95%CI(rho) includes 0
               -> §6.11: the ceiling is, in part, a *repertoire* ceiling -- the
                  tutor compresses diverse learners into less-varied output and
                  does not track input diversity; the five mechanism negatives
                  are explained, not merely extended.
  NO COLLAPSE  iff lower95(rho) > 0  OR  delta CI reaches/exceeds 0
               -> §6.11: Track A null -- output repertoire diversifies with and
                  tracks the learner; the bottleneck sits on the mechanism/signal
                  axes already closed in §6.7-§6.10.
  INDETERMINATE: any other CI configuration. Report the partial result.

DISPOSITION (frozen, executed without relitigation): whatever the read, NO
tune-and-retry, NO Stage 1, NO live/paid run. Track A is diagnostic; neither
outcome licenses a new cell (a "repertoire-expansion" mechanism would be a sixth
mechanism, foreclosed by the brief). Both land as §6.11.

BOUND (§7.9 symmetric honesty): the measure is lexical token-set dispersion, a
noisy proxy for strategic-move diversity. A COLLAPSE read does NOT license "the
tutor cannot adapt"; a NO-COLLAPSE read does NOT license "rich adaptation
occurs". No embeddings / no semantic model -- a deliberate anti-thrash choice.
==============================================================================
"""
import os, sys, json, re, sqlite3, math
from datetime import datetime, timezone
import numpy as np

SEED = 20260609
B_BOOT = 2000
MIN_RUNS = 3            # frozen: a stratum needs >=3 runs
DIN_FLOOR = 0.05        # frozen: learner must actually vary

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.environ.get("EVAL_DB_PATH", os.path.join(REPO, "data", "evaluations.db"))
OUT_CSV = os.path.join(REPO, "exports", "adaptation-repertoire-stage0-table.csv")
OUT_META = os.path.join(REPO, "exports", "adaptation-repertoire-stage0.meta.json")

TOKEN = re.compile(r"[a-z]+")


def resolve_logs():
    """tutor-dialogues trace dir. EVAL_LOGS_DIR may point at .../logs (with a
    tutor-dialogues/ subdir) or directly at the trace dir; fall back to repo."""
    env = os.environ.get("EVAL_LOGS_DIR")
    cands = []
    if env:
        cands += [os.path.join(env, "tutor-dialogues"), env]
    cands += [os.path.join(REPO, "logs", "tutor-dialogues"), os.path.join(REPO, "logs")]
    for c in cands:
        if os.path.isdir(c):
            return c
    return cands[0]


LOGS = resolve_logs()


def toks(s):
    return TOKEN.findall((s or "").lower())


def sugg_text(raw):
    """Tutor message AS THE LEARNER SEES IT = title+message of the parsed
    `suggestions` payload (JSON-string array of {title,message,...}). Excludes
    `reasoning` (internal). Schema as in adaptation2-stage0.py."""
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


# ---- frozen distance functions (cos_dist verbatim from adaptation2-stage0.py;
#      jaccard_dist likewise). Operate on token-strings (already echo-stripped). ----
def cos_dist(a, b):
    A, B = " ".join(toks(a)), " ".join(toks(b))
    if not A or not B:
        return 1.0
    sa, sb = set(toks(a)), set(toks(b))
    voc = sorted(sa | sb)
    if not voc:
        return 1.0
    va = np.array([1.0 if w in sa else 0.0 for w in voc])
    vb = np.array([1.0 if w in sb else 0.0 for w in voc])
    d = (np.linalg.norm(va) * np.linalg.norm(vb))
    if d == 0:
        return 1.0
    return float(max(0.0, min(1.0, 1.0 - va.dot(vb) / d)))


def jaccard_dist(a, b):
    sa, sb = set(toks(a)), set(toks(b))
    if not sa and not sb:
        return 0.0
    u = len(sa | sb)
    return 1.0 - (len(sa & sb) / u if u else 0.0)


# ---------------------------------------------------------------------------
# trace walk: ordered tutor / learner externalised turns (tutor-first corpus)
# ---------------------------------------------------------------------------
# learner label priority -> which field carries the real message
LEARNER_SRC = {
    ("learner", "final_output"): "detail",
    ("learner_synthesis", "response"): "detail",
    ("user", "turn_action"): "contextSummary",
}
LEARNER_PRIORITY = {("learner", "final_output"): 3,
                    ("learner_synthesis", "response"): 2,
                    ("user", "turn_action"): 1}


def classify(e):
    """Return ('T', text) for a tutor externalised turn, ('L', text, priority)
    for a learner externalised turn, or None. user/final_output and
    tutor/final_output are 'Turn N complete' markers -> None."""
    ag, ac = e.get("agent"), e.get("action")
    if ag == "ego" and ac in ("generate", "revise"):
        return ("T", sugg_text(e.get("suggestions")))
    key = (ag, ac)
    if key in LEARNER_SRC:
        return ("L", e.get(LEARNER_SRC[key]) or "", LEARNER_PRIORITY[key])
    return None


def walk(trace):
    """Collapse the trace into ordered tutor_seq / learner_seq. Tutor-first
    interleaving: a tutor entry after a learner-run commits the learner turn,
    and vice-versa. Within a tutor-run the LAST text wins (revise > generate);
    within a learner-run the HIGHEST-priority label wins (dedup synthesis vs
    turn_action, which carry the same message)."""
    tutor_seq, learner_seq = [], []
    cur_t, cur_l, cur_l_pri = None, None, -1
    last = None
    for e in trace:
        if not isinstance(e, dict):
            continue
        c = classify(e)
        if c is None:
            continue
        role = c[0]
        if role == "T":
            if last == "L":
                if cur_l is not None:
                    learner_seq.append(cur_l)
                cur_l, cur_l_pri = None, -1
            if c[1]:
                cur_t = c[1]      # last tutor text in the run wins
            last = "T"
        else:  # learner
            if last == "T":
                if cur_t is not None:
                    tutor_seq.append(cur_t)
                cur_t = None
            txt, pri = c[1], c[2]
            if txt and pri >= cur_l_pri:   # highest-priority label, last wins on ties
                cur_l, cur_l_pri = txt, pri
            last = "L"
    if cur_t is not None:
        tutor_seq.append(cur_t)
    if cur_l is not None:
        learner_seq.append(cur_l)
    return tutor_seq, learner_seq


def strip_set(text, prev_text):
    """Echo-strip: this turn's own token set = tokens(text) - tokens(prev_text)."""
    return set(toks(text)) - set(toks(prev_text))


def set_to_str(s):
    return " ".join(sorted(s))


def mean_pairwise(strs, distfn):
    n = len(strs)
    if n < 2:
        return None
    tot, cnt = 0.0, 0
    for i in range(n):
        for j in range(i + 1, n):
            tot += distfn(strs[i], strs[j]); cnt += 1
    return tot / cnt if cnt else None


# ---------------------------------------------------------------------------
# partial Spearman( x, y | z ) = partial correlation on ranks
# ---------------------------------------------------------------------------
def _rank(a):
    """Average (tie-corrected) ranks, 0-indexed."""
    a = np.asarray(a, float)
    _, inv, cnt = np.unique(a, return_inverse=True, return_counts=True)
    csum = np.cumsum(cnt)
    start = np.concatenate([[0], csum[:-1]])
    avg = start + (cnt - 1) / 2.0      # mean rank of each tie group
    return avg[inv]


def _pearson(x, y):
    x = np.asarray(x, float); y = np.asarray(y, float)
    if len(x) < 3:
        return float("nan")
    sx, sy = x.std(), y.std()
    if sx == 0 or sy == 0:
        return float("nan")
    return float(((x - x.mean()) * (y - y.mean())).mean() / (sx * sy))


def partial_spearman(x, y, z):
    rx, ry, rz = _rank(x), _rank(y), _rank(z)
    r_xy, r_xz, r_yz = _pearson(rx, ry), _pearson(rx, rz), _pearson(ry, rz)
    if any(math.isnan(v) for v in (r_xy, r_xz, r_yz)):
        return float("nan")
    den = math.sqrt(max(0.0, (1 - r_xz ** 2) * (1 - r_yz ** 2)))
    if den == 0:
        return float("nan")
    return (r_xy - r_xz * r_yz) / den


def ci(vals):
    v = np.array([x for x in vals if not (x is None or math.isnan(x))])
    if not len(v):
        return [float("nan"), float("nan")]
    return [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))]


def main():
    if not os.path.exists(DB):
        print("NO DB at", DB); sys.exit(2)
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT dialogue_id, profile_name, scenario_id FROM evaluation_results "
        "WHERE learner_architecture LIKE 'ego_superego%' AND dialogue_id IS NOT NULL "
        "GROUP BY dialogue_id"
    ).fetchall()
    con.close()

    # cell -> exchange_index k -> {'T':[stripped_str per run], 'L':[..],
    #                              'Traw':[..], 'Lraw':[..], 'empty_T':int}
    cells = {}
    skipped = {"no_file": 0, "bad_json": 0, "no_trace": 0, "single_turn": 0,
               "no_exchange": 0}
    seen = set()
    n_dialogues = 0
    empty_own_T = empty_own_L = total_own = 0
    for did, prof, scen in rows:
        fp = os.path.join(LOGS, f"{did}.json")
        if fp in seen:
            continue
        seen.add(fp)
        if not os.path.exists(fp):
            skipped["no_file"] += 1; continue
        try:
            d = json.load(open(fp))
        except Exception:
            skipped["bad_json"] += 1; continue
        tr = d.get("dialogueTrace") or d.get("trace") or []
        if not isinstance(tr, list) or not tr:
            skipped["no_trace"] += 1; continue
        tutor_seq, learner_seq = walk(tr)
        if len(learner_seq) == 0:
            skipped["single_turn"] += 1; continue
        # exchanges k = 1 .. min(len(T)-1, len(L)): response T_k, input L_{k-1}
        K = min(len(tutor_seq) - 1, len(learner_seq))
        if K < 1:
            skipped["no_exchange"] += 1; continue
        n_dialogues += 1
        key0 = (str(scen), prof or "unknown")
        cell = cells.setdefault(key0, {})
        for k in range(1, K + 1):
            Tk = tutor_seq[k]
            Lkm1 = learner_seq[k - 1]
            Tkm1 = tutor_seq[k - 1]
            t_own = strip_set(Tk, Lkm1)        # tutor's own tokens at exchange k
            l_own = strip_set(Lkm1, Tkm1)      # learner's own tokens (the input)
            total_own += 1
            if not t_own:
                empty_own_T += 1
            if not l_own:
                empty_own_L += 1
            slot = cell.setdefault(k, {"T": [], "L": [], "Traw": [], "Lraw": []})
            slot["T"].append(set_to_str(t_own))
            slot["L"].append(set_to_str(l_own))
            slot["Traw"].append(Tk)            # un-stripped (sensitivity)
            slot["Lraw"].append(Lkm1)

    # ---- build strata ----
    # stratum: (scenario, profile, k) with D_out/D_in (echo-stripped) + raw + jac
    strata = []           # primary (echo-stripped cosine), passing inclusion
    excluded_din = 0      # excluded for D_in <= floor
    excluded_runs = 0     # excluded for < MIN_RUNS
    all_eval = []         # every (scenario,profile,k) with >=2 runs, for reporting
    for (scen, prof), kmap in cells.items():
        for k, slot in kmap.items():
            n_runs = len(slot["T"])
            d_out = mean_pairwise(slot["T"], cos_dist)
            d_in = mean_pairwise(slot["L"], cos_dist)
            d_out_j = mean_pairwise(slot["T"], jaccard_dist)
            d_in_j = mean_pairwise(slot["L"], jaccard_dist)
            d_out_raw = mean_pairwise(slot["Traw"], cos_dist)
            d_in_raw = mean_pairwise(slot["Lraw"], cos_dist)
            rec = {"scenario": scen, "profile": prof, "k": k, "n_runs": n_runs,
                   "d_out": d_out, "d_in": d_in, "d_out_j": d_out_j, "d_in_j": d_in_j,
                   "d_out_raw": d_out_raw, "d_in_raw": d_in_raw}
            all_eval.append(rec)
            if n_runs < MIN_RUNS:
                excluded_runs += 1; continue
            if d_in is None or d_in <= DIN_FLOOR:
                excluded_din += 1; continue
            strata.append(rec)

    n_strata = len(strata)
    if n_strata < 10:
        meta = {"ABORT": "insufficient strata after inclusion", "n_strata": n_strata,
                "skipped": skipped, "n_dialogues": n_dialogues,
                "excluded_din_le_floor": excluded_din, "excluded_lt_minruns": excluded_runs}
        os.makedirs(os.path.dirname(OUT_META), exist_ok=True)
        json.dump(meta, open(OUT_META, "w"), indent=2)
        print("ABORT: only", n_strata, "strata after inclusion; cannot run Stage 0.")
        print(json.dumps(meta, indent=2)); sys.exit(3)

    scen_of = [s["scenario"] for s in strata]
    d_out_arr = np.array([s["d_out"] for s in strata])
    d_in_arr = np.array([s["d_in"] for s in strata])
    k_arr = np.array([s["k"] for s in strata])
    d_out_j_arr = np.array([s["d_out_j"] for s in strata])
    d_in_j_arr = np.array([s["d_in_j"] for s in strata])

    def compute(out, inn, kk):
        delta = float(np.mean(out - inn))
        rho = partial_spearman(out, inn, kk)
        return delta, rho

    delta_cos, rho_cos = compute(d_out_arr, d_in_arr, k_arr)
    delta_jac, rho_jac = compute(d_out_j_arr, d_in_j_arr, k_arr)

    # ---- cluster bootstrap by scenario_id ----
    scenarios = sorted(set(scen_of))
    by_scen = {sc: [i for i, s in enumerate(scen_of) if s == sc] for sc in scenarios}
    rng = np.random.default_rng(SEED)
    boot_delta_cos, boot_rho_cos = [], []
    boot_delta_jac, boot_rho_jac = [], []
    nS = len(scenarios)
    for _ in range(B_BOOT):
        pick = rng.integers(0, nS, nS)
        idx = np.concatenate([np.array(by_scen[scenarios[p]], int) for p in pick])
        bd, br = compute(d_out_arr[idx], d_in_arr[idx], k_arr[idx])
        boot_delta_cos.append(bd); boot_rho_cos.append(br)
        bdj, brj = compute(d_out_j_arr[idx], d_in_j_arr[idx], k_arr[idx])
        boot_delta_jac.append(bdj); boot_rho_jac.append(brj)

    ci_delta = ci(boot_delta_cos)
    ci_rho = ci(boot_rho_cos)
    ci_delta_j = ci(boot_delta_jac)
    ci_rho_j = ci(boot_rho_jac)

    # ---- frozen reads (literal definitions from the pre-reg) ----
    def read_gate(cid, cir):
        hi_delta_lt0 = cid[1] < 0
        lo_rho_gt0 = cir[0] > 0
        rho_incl_0 = cir[0] <= 0 <= cir[1]
        delta_reaches_0 = cid[1] >= 0
        collapse = hi_delta_lt0 and rho_incl_0
        no_collapse = lo_rho_gt0 or delta_reaches_0
        if collapse and not no_collapse:
            return "COLLAPSE"
        if no_collapse and not collapse:
            return "NO_COLLAPSE"
        return "INDETERMINATE"

    read_primary = read_gate(ci_delta, ci_rho)
    read_robust = read_gate(ci_delta_j, ci_rho_j)

    # ---- reported-alongside (interpretive, not gated) ----
    abs_levels = {
        "mean_D_out_cos": float(d_out_arr.mean()), "mean_D_in_cos": float(d_in_arr.mean()),
        "mean_D_out_raw_cos": float(np.mean([s["d_out_raw"] for s in strata
                                             if s["d_out_raw"] is not None])),
        "mean_D_in_raw_cos": float(np.mean([s["d_in_raw"] for s in strata
                                            if s["d_in_raw"] is not None])),
        "mean_D_out_jac": float(d_out_j_arr.mean()), "mean_D_in_jac": float(d_in_j_arr.mean()),
    }
    # raw (un-stripped) sensitivity gate
    d_out_raw_arr = np.array([s["d_out_raw"] for s in strata], float)
    d_in_raw_arr = np.array([s["d_in_raw"] for s in strata], float)
    delta_raw, rho_raw = compute(d_out_raw_arr, d_in_raw_arr, k_arr)

    # between-scenario vs within-scenario tutor dispersion (TOPIC-CONFOUNDED),
    # echo-stripped tutor turns at matched exchange index k. within = mean D_out.
    # between = mean pairwise cos_dist of tutor turns drawn from DIFFERENT
    # (scenario) cells at the same k (one representative per cell: first run).
    by_k = {}
    for (scen, prof), kmap in cells.items():
        for k, slot in kmap.items():
            if slot["T"]:
                by_k.setdefault(k, []).append((scen, slot["T"][0]))
    between_vals = []
    rng2 = np.random.default_rng(SEED + 1)
    for k, lst in by_k.items():
        # cross-scenario pairs only
        reps = [(sc, t) for sc, t in lst]
        m = len(reps)
        if m < 2:
            continue
        pairs = [(i, j) for i in range(m) for j in range(i + 1, m) if reps[i][0] != reps[j][0]]
        if len(pairs) > 400:
            sel = rng2.choice(len(pairs), 400, replace=False)
            pairs = [pairs[s] for s in sel]
        for i, j in pairs:
            between_vals.append(cos_dist(reps[i][1], reps[j][1]))
    between_scen_tutor = float(np.mean(between_vals)) if between_vals else float("nan")

    # per-profile breakdown
    by_profile = {}
    for prof in sorted(set(s["profile"] for s in strata)):
        idx = [i for i, s in enumerate(strata) if s["profile"] == prof]
        if len(idx) < 5:
            by_profile[prof] = {"n_strata": len(idx), "delta": None, "rho": None}
            continue
        o = d_out_arr[idx]; inn = d_in_arr[idx]; kk = k_arr[idx]
        dd, rr = compute(o, inn, kk)
        by_profile[prof] = {"n_strata": len(idx), "delta": dd, "rho": rr,
                            "mean_D_out": float(o.mean()), "mean_D_in": float(inn.mean())}

    # per-exchange-index breakdown
    by_k_stats = {}
    for kk in sorted(set(int(x) for x in k_arr)):
        idx = [i for i, s in enumerate(strata) if s["k"] == kk]
        o = d_out_arr[idx]; inn = d_in_arr[idx]
        by_k_stats[str(kk)] = {"n_strata": len(idx), "mean_D_out": float(o.mean()),
                               "mean_D_in": float(inn.mean()),
                               "mean_delta": float((o - inn).mean())}

    meta = {
        "stage": "Track A Repertoire-Ceiling Stage 0 (offline, zero-API, read-only)",
        "preregistration": "notes/adaptation-repertoire-stage0-preregistration.md",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "seed": SEED, "B_boot": B_BOOT, "min_runs": MIN_RUNS, "din_floor": DIN_FLOOR,
        "zero_api": True, "read_only": True, "db": DB, "logs": LOGS,
        "corpus": {
            "rows_ego_superego": len(rows), "dialogues_used": n_dialogues,
            "skipped": skipped, "n_cells_scenario_x_profile": len(cells),
            "n_strata_eligible_ge2runs": len(all_eval),
            "n_strata_primary": n_strata,
            "excluded_lt_minruns": excluded_runs,
            "excluded_din_le_floor": excluded_din,
            "din_floor_excluded_share": (excluded_din / (n_strata + excluded_din)
                                         if (n_strata + excluded_din) else None),
            "n_scenarios_in_primary": len(scenarios),
            "empty_own_set_share_tutor": (empty_own_T / total_own) if total_own else None,
            "empty_own_set_share_learner": (empty_own_L / total_own) if total_own else None,
        },
        "PRIMARY_cosine": {
            "delta_compression": delta_cos, "ci95_delta": ci_delta,
            "rho_coupling_partialSpearman": rho_cos, "ci95_rho": ci_rho,
            "READ": read_primary,
        },
        "ROBUSTNESS_jaccard": {
            "delta_compression": delta_jac, "ci95_delta": ci_delta_j,
            "rho_coupling_partialSpearman": rho_jac, "ci95_rho": ci_rho_j,
            "READ": read_robust,
        },
        "SENSITIVITY_raw_unstripped_cosine": {
            "delta_compression": delta_raw, "rho_coupling_partialSpearman": rho_raw,
            "note": "no echo-strip; if delta_raw >> delta_cos the apparent tutor "
                    "diversity is learner-echo, not own contribution",
        },
        "reported_alongside": {
            "absolute_levels": abs_levels,
            "between_scenario_tutor_dispersion_TOPIC_CONFOUNDED": between_scen_tutor,
            "within_scenario_tutor_dispersion": float(d_out_arr.mean()),
            "between_over_within_ratio": (between_scen_tutor / float(d_out_arr.mean())
                                          if d_out_arr.mean() else None),
            "by_profile": by_profile,
            "by_exchange_index": by_k_stats,
        },
        "frozen_gate": {
            "rule": "COLLAPSE iff upper95(delta)<0 AND 95%CI(rho) includes 0; "
                    "NO_COLLAPSE iff lower95(rho)>0 OR delta CI reaches/exceeds 0; "
                    "else INDETERMINATE. PRIMARY = echo-stripped cosine.",
            "READ_primary": read_primary,
            "READ_robustness_jaccard": read_robust,
            "robustness_agrees": (read_primary == read_robust),
            "disposition": (
                "Whatever the read: NO tune-and-retry, NO Stage 1, NO live/paid run. "
                "Track A is diagnostic; neither outcome licenses a new cell (a "
                "repertoire-expansion mechanism would be a sixth mechanism, "
                "foreclosed by the brief). Lands as §6.11."),
            "bound": (
                "Lexical token-set dispersion proxy. COLLAPSE does NOT license "
                "'the tutor cannot adapt'; NO_COLLAPSE does NOT license 'rich "
                "adaptation occurs' (§7.9 symmetric honesty)."),
        },
    }

    os.makedirs(os.path.dirname(OUT_META), exist_ok=True)
    with open(OUT_CSV, "w") as f:
        f.write("scenario,profile,k,n_runs,d_out_cos,d_in_cos,d_out_jac,d_in_jac,"
                "d_out_raw,d_in_raw\n")
        for s in strata:
            f.write(f'{s["scenario"]},{s["profile"]},{s["k"]},{s["n_runs"]},'
                    f'{s["d_out"]:.4f},{s["d_in"]:.4f},{s["d_out_j"]:.4f},{s["d_in_j"]:.4f},'
                    f'{(s["d_out_raw"] or 0):.4f},{(s["d_in_raw"] or 0):.4f}\n')
    json.dump(meta, open(OUT_META, "w"), indent=2)

    print("=" * 74)
    print("Track A -- Repertoire-Ceiling Stage 0  (offline, zero-API, read-only)")
    print("=" * 74)
    c = meta["corpus"]
    print(f"corpus: {c['dialogues_used']} multi-turn dialogues, "
          f"{c['n_strata_primary']} primary strata over {c['n_scenarios_in_primary']} scenarios")
    print(f"        skipped={c['skipped']}")
    print(f"        excluded <{MIN_RUNS} runs={c['excluded_lt_minruns']}, "
          f"D_in<= {DIN_FLOOR}={c['excluded_din_le_floor']} "
          f"({(c['din_floor_excluded_share'] or 0)*100:.0f}% of would-be strata)")
    print(f"        empty own-set share: tutor={c['empty_own_set_share_tutor']:.3f} "
          f"learner={c['empty_own_set_share_learner']:.3f}")
    print()
    p = meta["PRIMARY_cosine"]
    print(f"PRIMARY (echo-stripped cosine):")
    print(f"  delta (compression, D_out-D_in) = {p['delta_compression']:+.4f}  "
          f"CI95={[round(x,4) for x in p['ci95_delta']]}")
    print(f"  rho   (coupling, partial Spearman) = {p['rho_coupling_partialSpearman']:+.4f}  "
          f"CI95={[round(x,4) for x in p['ci95_rho']]}")
    r = meta["ROBUSTNESS_jaccard"]
    print(f"ROBUSTNESS (Jaccard): delta={r['delta_compression']:+.4f} "
          f"CI={[round(x,4) for x in r['ci95_delta']]}  "
          f"rho={r['rho_coupling_partialSpearman']:+.4f} CI={[round(x,4) for x in r['ci95_rho']]}")
    s = meta["SENSITIVITY_raw_unstripped_cosine"]
    print(f"SENSITIVITY (raw, no echo-strip): delta={s['delta_compression']:+.4f} "
          f"rho={s['rho_coupling_partialSpearman']:+.4f}")
    a = meta["reported_alongside"]
    print(f"levels: D_out={a['absolute_levels']['mean_D_out_cos']:.3f} "
          f"D_in={a['absolute_levels']['mean_D_in_cos']:.3f} "
          f"| between-scenario tutor (topic-confounded)={a['between_scenario_tutor_dispersion_TOPIC_CONFOUNDED']:.3f}")
    print()
    print(f"FROZEN READ (primary)   = {read_primary}")
    print(f"FROZEN READ (robustness)= {read_robust}  "
          f"(agrees={meta['frozen_gate']['robustness_agrees']})")
    print(f"-> {meta['frozen_gate']['disposition']}")
    print("artifacts:", OUT_CSV, OUT_META)


if __name__ == "__main__":
    main()
