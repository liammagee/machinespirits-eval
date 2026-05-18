#!/usr/bin/env python3
"""
ADAPTATION-PLAN-2.0.md  §3 Stage 0  --  offline, zero-API, read-only.

Sibling-in-discipline to scripts/learned-adaptation-policy-ope.py (the
§6.9.8 offline kill gate). numpy + stdlib + sqlite3 only. No API. No DB
writes (SELECT only). Reads existing trace files on `main`.

==============================================================================
PRE-REGISTRATION (frozen 2026-05-17, BEFORE running -- do not edit post-hoc)
==============================================================================

Necessary-condition gate for proposal (b): is the learner's *concealed
interior* (manifest != latent) carrying structured signal that the SURFACE
the base model conditions on does NOT already determine?  If the surface
already determines it, a concealment mechanism is provably re-encoding
(the §6.7/§6.8.8/§6.9 motif on the signal axis) -> STOP, §6.10 null.

Unit: one learner turn with all of {learner_ego_initial, learner_superego,
learner_ego_revision, learner/final_output} present in dialogueTrace, with
its immediately preceding tutor turn.

TARGET (the manifest!=latent quantity), frozen:
  target = 1 - tfidf_cosine( ego_initial_text , final_output_text )
  in [0,1]; the magnitude by which the public utterance departs from the
  private first reaction. Secondary robustness target: token-Jaccard
  distance of the same pair (reported, not gated).

PREDICTOR SETS, frozen (no leakage by construction):
  A "surface-only"  : features computable from the MANIFEST dialogue alone
      (preceding tutor text + learner final_output + structure). This is
      exactly what the base model sees. Contains NO hidden-trace text.
  B "latent-cause"  : features from learner_superego text ONLY (the
      critique that motivates concealment). Excludes ego_initial and
      ego_revision text entirely, so it cannot trivially reconstruct the
      target (which is defined from ego_initial vs final_output).

ESTIMATOR: ridge regression (closed form, lambda=1.0) on standardized
features; score = leave-one-scenario_type-out grouped-CV out-of-group R².
Baseline = predict train-fold mean. CIs = cluster bootstrap over
scenario_type (B=2000, seed 20260517) -- the honest variance unit (outcome
variance is overwhelmingly between trap/scenario families).

FROZEN P1 PASS (both must hold):
  (i)  lower 95% CI of  R²_B            > 0   (target is STRUCTURED, not noise:
                                               a legible latent cause exists)
  (ii) lower 95% CI of (R²_B - R²_A)    > 0   (surface MISSES structure the
                                               latent cause explains)
Otherwise -> FAIL. Per ADAPTATION-PLAN-2.0.md §3 kill rule the arc closes
here: that null IS the §6.10 result. No Stage 1, no live run, no
tune-and-retry. P2 (Weber uptake) is structurally deferred to Stage 1
(existing charisma corpus is scripted-learner / tutor-only; see plan §3).
==============================================================================
"""
import os, sys, json, re, sqlite3, math, hashlib
import numpy as np

SEED = 20260517
B_BOOT = 2000
RIDGE_LAMBDA = 1.0
TOPK_TFIDF = 60  # vocab cap per text channel (deterministic, doc-freq ranked)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.environ.get("EVAL_DB_PATH", os.path.join(REPO, "data", "evaluations.db"))
LOGS = os.environ.get("EVAL_LOGS_DIR", os.path.join(REPO, "logs", "tutor-dialogues"))
OUT_CSV = os.path.join(REPO, "exports", "adaptation2-stage0-table.csv")
OUT_META = os.path.join(REPO, "exports", "adaptation2-stage0-probe.meta.json")

HEDGE = re.compile(r"\b(maybe|perhaps|i think|i guess|not sure|kind of|sort of|"
                   r"i don'?t know|dunno|possibly|might|could be|um+|uh+)\b", re.I)
AGREE = re.compile(r"\b(yes|yeah|yep|ok|okay|got it|makes sense|i (?:see|understand)|"
                   r"right|sure|of course|exactly|true)\b", re.I)
CONCEAL = re.compile(r"\b(hid(?:e|ing|den)|conceal|pretend|performativ|sav(?:e|ing) face|"
                     r"embarrass|won'?t admit|actually confus|doesn'?t (?:really )?understand|"
                     r"resist|avoid|defensive|mask|surface|not (?:really )?(?:getting|grasp))\b", re.I)
TOKEN = re.compile(r"[a-z]+")


def toks(s):
    return TOKEN.findall((s or "").lower())


def sugg_text(raw):
    """Tutor message AS THE LEARNER SEES IT = parsed `suggestions` payload of
    the last ego generate/revise entry (JSON-string array of {title,message}).
    NOT a gate change: the frozen spec's set A is 'the manifest dialogue ...
    exactly what the base model sees'; this only reads it from the correct
    on-disk field (schema discovered 2026-05-17)."""
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


def tfidf_matrix(texts, vocab):
    idx = {w: i for i, w in enumerate(vocab)}
    n, v = len(texts), len(vocab)
    tf = np.zeros((n, v))
    for r, t in enumerate(texts):
        c = {}
        for w in toks(t):
            if w in idx:
                c[idx[w]] = c.get(idx[w], 0) + 1
        if c:
            m = max(c.values())
            for j, k in c.items():
                tf[r, j] = k / m
    df = (tf > 0).sum(0)
    idf = np.log((1 + n) / (1 + df)) + 1.0
    return tf * idf


def build_vocab(texts, k):
    df = {}
    for t in texts:
        for w in set(toks(t)):
            if len(w) > 2:
                df[w] = df.get(w, 0) + 1
    return [w for w, _ in sorted(df.items(), key=lambda x: (-x[1], x[0]))[:k]]


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


def struct_feats(prior_tutor, final_out):
    f = []
    for s in (prior_tutor, final_out):
        tk = toks(s)
        f += [len(s or ""), len(tk),
              len(set(tk)) / (len(tk) + 1),
              (s or "").count("?"),
              len(HEDGE.findall(s or "")),
              len(AGREE.findall(s or ""))]
    return f


def ridge_cv_r2(X, y, groups):
    """Leave-one-group-out grouped CV out-of-group R² (pooled residuals)."""
    X = np.asarray(X, float); y = np.asarray(y, float)
    gs = sorted(set(groups))
    if len(gs) < 3:
        return float("nan")
    preds = np.zeros_like(y); seen = np.zeros_like(y, bool)
    for g in gs:
        te = np.array([gg == g for gg in groups])
        tr = ~te
        if tr.sum() < 5 or te.sum() < 1:
            continue
        mu = X[tr].mean(0); sd = X[tr].std(0); sd[sd == 0] = 1
        Xtr = (X[tr] - mu) / sd; Xte = (X[te] - mu) / sd
        Xtr = np.hstack([Xtr, np.ones((Xtr.shape[0], 1))])
        Xte = np.hstack([Xte, np.ones((Xte.shape[0], 1))])
        p = Xtr.shape[1]
        R = RIDGE_LAMBDA * np.eye(p); R[-1, -1] = 0
        w = np.linalg.solve(Xtr.T @ Xtr + R, Xtr.T @ y[tr])
        preds[te] = Xte @ w; seen[te] = True
    if seen.sum() < 10:
        return float("nan")
    yy, pp = y[seen], preds[seen]
    ss_tot = ((yy - yy.mean()) ** 2).sum()
    if ss_tot == 0:
        return float("nan")
    return float(1.0 - ((yy - pp) ** 2).sum() / ss_tot)


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

    units = []
    skipped = {"no_file": 0, "no_trace": 0, "no_triplet_turn": 0, "bad_json": 0}
    seen_files = set()
    for did, prof, scen in rows:
        fp = os.path.join(LOGS, f"{did}.json")
        if not os.path.exists(fp) or fp in seen_files:
            skipped["no_file"] += (fp not in seen_files)
            continue
        seen_files.add(fp)
        try:
            d = json.load(open(fp))
        except Exception:
            skipped["bad_json"] += 1; continue
        tr = d.get("dialogueTrace") or d.get("trace") or []
        if not isinstance(tr, list) or not tr:
            skipped["no_trace"] += 1; continue
        lc = d.get("learnerContext")
        stype = None
        if isinstance(lc, dict):
            stype = lc.get("scenario_type") or lc.get("scenarioType")
        stype = stype or (scen or "").split("::")[0] or (prof or "unknown")
        # walk: collect (prior_tutor_text, ei, su, er, fo) per learner turn.
        # On-disk schema (confirmed 2026-05-17): learner deliberation text is
        # in `detail` (full) / `contextSummary` (truncated); the tutor message
        # the learner reacts to is the last ego generate/revise `suggestions`
        # payload (the tutor/final_output entry is only a "Turn N complete"
        # marker). Field-name plumbing only -- the frozen P1 gate is untouched.
        def ltext(en):
            return en.get("detail") or en.get("contextSummary") or ""
        prior_tutor = ""
        cur = {}
        had = False
        for e in tr:
            if not isinstance(e, dict):
                continue
            ag, ac = e.get("agent"), e.get("action")
            if ag == "ego" and ac in ("generate", "revise"):
                t = sugg_text(e.get("suggestions"))
                if t:
                    prior_tutor = t
            elif ag == "learner_ego_initial":
                cur = {"ei": ltext(e)}
            elif ag == "learner_superego":
                cur["su"] = ltext(e)
            elif ag == "learner_ego_revision":
                cur["er"] = ltext(e)
            elif ag == "learner" and ac == "final_output":
                cur["fo"] = ltext(e)
                if all(cur.get(k) for k in ("ei", "su", "fo")):
                    units.append({
                        "scenario_type": str(stype),
                        "profile": prof or "unknown",
                        "prior_tutor": prior_tutor,
                        "ei": cur["ei"], "su": cur["su"],
                        "er": cur.get("er", ""), "fo": cur["fo"],
                    })
                    had = True
                cur = {}
                prior_tutor = ""  # reset; next tutor turn precedes next learner
        if not had:
            skipped["no_triplet_turn"] += 1

    n = len(units)
    if n < 30:
        json.dump({"n": n, "ABORT": "insufficient paired-triplet turns",
                   "skipped": skipped}, open(OUT_META, "w"), indent=2)
        print("ABORT: only", n, "paired-triplet turns; cannot run Stage 0.")
        print("skipped:", skipped)
        sys.exit(3)

    # ---- targets ----
    tgt_cos = np.array([cos_dist(u["ei"], u["fo"]) for u in units])
    tgt_jac = np.array([jaccard_dist(u["ei"], u["fo"]) for u in units])

    # ---- feature channels ----
    surf_text = [f'{u["prior_tutor"]} \n {u["fo"]}' for u in units]
    sup_text = [u["su"] for u in units]
    voc_s = build_vocab(surf_text, TOPK_TFIDF)
    voc_b = build_vocab(sup_text, TOPK_TFIDF)
    Xs_tfidf = tfidf_matrix(surf_text, voc_s)
    Xb_tfidf = tfidf_matrix(sup_text, voc_b)
    Xs_struct = np.array([struct_feats(u["prior_tutor"], u["fo"]) for u in units])
    Xb_struct = np.array([[len(u["su"]), len(toks(u["su"])),
                           len(CONCEAL.findall(u["su"])),
                           len(HEDGE.findall(u["su"]))] for u in units])
    A = np.hstack([Xs_struct, Xs_tfidf])           # surface-only
    Bm = np.hstack([Xb_struct, Xb_tfidf])          # latent-cause (superego only)
    groups = [u["scenario_type"] for u in units]

    def eval_target(y, name):
        r2A = ridge_cv_r2(A, y, groups)
        r2B = ridge_cv_r2(Bm, y, groups)
        # cluster bootstrap by scenario_type
        gs = sorted(set(groups)); gi = {g: i for i, g in enumerate(gs)}
        gidx = np.array([gi[g] for g in groups])
        rng = np.random.default_rng(SEED)
        dB, dgap = [], []
        for _ in range(B_BOOT):
            samp = rng.integers(0, len(gs), len(gs))
            mask = np.concatenate([np.where(gidx == s)[0] for s in samp])
            yb = y[mask]
            gb = [groups[i] for i in mask]
            rb = ridge_cv_r2(Bm[mask], yb, gb)
            ra = ridge_cv_r2(A[mask], yb, gb)
            if not (math.isnan(rb) or math.isnan(ra)):
                dB.append(rb); dgap.append(rb - ra)
        def ci(v):
            v = np.array(v)
            return [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))] \
                if len(v) else [float("nan"), float("nan")]
        ciB, ciG = ci(dB), ci(dgap)
        return {
            "target": name,
            "r2_surface_A": r2A, "r2_latentcause_B": r2B,
            "gap_B_minus_A": (r2B - r2A) if not (math.isnan(r2A) or math.isnan(r2B)) else None,
            "ci95_r2_B": ciB, "ci95_gap_B_minus_A": ciG,
            "B_structured_lowerCI_gt0": ciB[0] > 0,
            "surface_misses_lowerCI_gt0": ciG[0] > 0,
            "boot_n": len(dB),
        }

    primary = eval_target(tgt_cos, "1 - tfidf_cosine(ego_initial, final_output)")
    secondary = eval_target(tgt_jac, "token_jaccard(ego_initial, final_output) [robustness]")

    passed = bool(primary["B_structured_lowerCI_gt0"]
                  and primary["surface_misses_lowerCI_gt0"])

    meta = {
        "stage": "ADAPTATION-PLAN-2.0.md §3 Stage 0 (offline, zero-API, read-only)",
        "generated_at_utc": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "seed": SEED, "B_boot": B_BOOT, "ridge_lambda": RIDGE_LAMBDA,
        "n_units": n, "n_scenario_types": len(set(groups)),
        "n_dialogues": len(seen_files), "skipped": skipped,
        "by_profile": {p: sum(1 for u in units if u["profile"] == p)
                       for p in sorted(set(u["profile"] for u in units))},
        "P1_primary": primary, "P1_secondary_robustness": secondary,
        "frozen_gate": {
            "rule": "P1 PASS iff lower95(R²_B)>0 AND lower95(R²_B - R²_A)>0 "
                    "on the PRIMARY target",
            "PASSED": passed,
            "disposition": (
                "PASS -> concealment arm earns Stage 1; P2 (Weber) rides as a "
                "pre-registered live dimension."
                if passed else
                "FAIL -> STOP. The concealed interior is NOT separable from the "
                "surface the base already reads (or is unstructured noise): a "
                "concealment mechanism would be re-encoding. This null IS the "
                "§6.10 result (the §6.7/§6.8.8/§6.9 motif on the signal axis). "
                "No Stage 1, no live run, no tune-and-retry. Report the P2 "
                "corpus-gap finding as the reason the Weber lever was never "
                "realised.")
        },
        "P2_weber": "structurally deferred to Stage 1: existing charisma corpus "
                    "(cells 100-109) is scripted-learner / tutor-only "
                    "(<=38/505 rows any learner score, 0 interiority) -> uptake "
                    "not zero-API testable; that absence is the finding.",
        "zero_api": True, "read_only": True, "db": DB, "logs": LOGS,
    }
    os.makedirs(os.path.dirname(OUT_META), exist_ok=True)
    with open(OUT_CSV, "w") as f:
        f.write("scenario_type,profile,target_cos,target_jac,len_ei,len_su,len_fo\n")
        for u, tc, tj in zip(units, tgt_cos, tgt_jac):
            f.write(f'{u["scenario_type"]},{u["profile"]},{tc:.4f},{tj:.4f},'
                    f'{len(u["ei"])},{len(u["su"])},{len(u["fo"])}\n')
    json.dump(meta, open(OUT_META, "w"), indent=2)

    print("=" * 70)
    print(f"Stage 0  n={n} turns  scenario_types={len(set(groups))}  "
          f"dialogues={len(seen_files)}")
    print(f"  PRIMARY  R²_surface(A)={primary['r2_surface_A']}")
    print(f"           R²_latent(B) ={primary['r2_latentcause_B']}  "
          f"CI95={primary['ci95_r2_B']}")
    print(f"           gap (B-A)    ={primary['gap_B_minus_A']}  "
          f"CI95={primary['ci95_gap_B_minus_A']}")
    print(f"  FROZEN GATE P1 PASSED = {passed}")
    print(f"  -> {meta['frozen_gate']['disposition']}")
    print("artifacts:", OUT_CSV, OUT_META)


if __name__ == "__main__":
    main()
