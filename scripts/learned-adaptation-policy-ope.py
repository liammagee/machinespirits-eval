#!/usr/bin/env python3
"""
learned-adaptation-policy-ope.py — Steps 2+3 of the Learned-Adaptation arc.

Step 2: fit the simplest policy  state-features -> action-family
        (multinomial logistic, numpy; no sklearn dependency).
Step 3: off-policy evaluation as the HARD KILL GATE.

Reads exports/learned-adaptation-table.csv (Step 1 output; fidelity-asserted
strict_shift). ZERO API, pure computation.

Design (see LEARNED-ADAPTATION-PLAN.md §2 Steps 2-3):

  - Context = state-only features (NO scenario_type / scenario_id /
    expected_*). Held-out testing is leave-one-scenario_type-out (grouped CV)
    so train/test never share a family — the policy must work from STATE, not
    from memorising which family it is in.
  - Reward (independent label): primary = strict_shift (the §6.9.7 binary
    instrument); secondary = graded_mean (the §6.8/§6.9 graded channel).
  - No logged action propensities exist (behaviour = LLM forward pass /
    hand-authored node). IPS/SNIPS is NOT identified. Estimators reported:
      (a) Direct Method (DM): reward model r_hat(state,family) fit on train
          folds; V_hat(pi) = sum_x sum_f pi(f|x) r_hat(x,f) on held-out.
      (b) On-policy-agreement (assumption-light): empirical reward on the
          held-out subset where logged action family == argmax pi(.|x). No
          extrapolation; small n by construction (the honest power story).
  - CIs: cluster bootstrap resampling scenario_type (the dominant variance
    unit). Row-level bootstrap would fabricate a false 'pass'.

KILL GATE (verbatim, plan §2 Step 3): if OPE does not show the fitted policy
beating BOTH cell_110 (implicit baseline) AND cell_126 (A14 hand-authored)
on the independent label, STOP. Null is the §6.9.8 closing paragraph. No
live run, no tuning retry. This script does ONE fit and ONE gate.
"""

import csv
import json
import os
import sys
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(REPO, "exports", "learned-adaptation-table.csv")
META = os.path.join(REPO, "exports", "learned-adaptation-ope.meta.json")
RNG = np.random.default_rng(20260517)

FAMILIES = ["substantive_engagement", "diagnostic", "scaffolding", "repair_affective"]
NUM_FEATS = [
    "confidence", "n_misconceptions", "zpd_estimate_len", "n_hypotheses",
    "n_hyp_validated", "n_hyp_tentative", "n_hyp_contradicted", "mean_hyp_confidence",
    "n_evidence", "n_evidence_validated", "evidence_recency", "n_constraint_violations",
]
AGENCY = ["compliant", "questioning", "engaged", "withdrawn", "resistant", "missing"]

# Baselines the fitted policy must beat (plan §2 Step 2/3).
IMPLICIT_BASELINE = "cell_110"   # policy implicit in the LLM forward pass
A14_BASELINE = "cell_126"        # A14 hand-authored graph nodes


def fnum(v):
    if v is None or v == "":
        return np.nan
    try:
        return float(v)
    except ValueError:
        return np.nan


def load():
    rows = list(csv.DictReader(open(TABLE)))
    X_num, agency, fam_idx, reward_bin, reward_grd, cell, stype = [], [], [], [], [], [], []
    for r in rows:
        X_num.append([fnum(r[f]) for f in NUM_FEATS])
        a = (r.get("agency_signal") or "missing").strip().lower()
        agency.append(a if a in AGENCY else "missing")
        fam = r.get("action_family")
        fam_idx.append(FAMILIES.index(fam) if fam in FAMILIES else -1)
        reward_bin.append(fnum(r["strict_shift"]))
        reward_grd.append(fnum(r["graded_mean"]))
        cell.append(r["cell"])
        stype.append(r["scenario_type"])
    Xn = np.array(X_num, float)
    # missingness flags for the three terminal-gap features, then mean-impute
    miss_cols = [NUM_FEATS.index(c) for c in ("confidence", "mean_hyp_confidence", "evidence_recency")]
    flags = np.isnan(Xn[:, miss_cols]).astype(float)
    col_mean = np.nanmean(np.where(np.isnan(Xn), np.nan, Xn), axis=0)
    col_mean = np.where(np.isnan(col_mean), 0.0, col_mean)
    inds = np.where(np.isnan(Xn))
    Xn[inds] = np.take(col_mean, inds[1])
    # z-score numeric (guard zero variance)
    mu, sd = Xn.mean(0), Xn.std(0)
    sd[sd == 0] = 1.0
    Xn = (Xn - mu) / sd
    Ag = np.array([[1.0 if a == k else 0.0 for k in AGENCY] for a in agency])
    X = np.hstack([np.ones((len(rows), 1)), Xn, flags, Ag])
    return {
        "X": X, "fam": np.array(fam_idx), "rb": np.array(reward_bin, float),
        "rg": np.array(reward_grd, float), "cell": np.array(cell),
        "stype": np.array(stype), "n": len(rows),
    }


# ---- multinomial logistic regression (L2), numpy full-batch GD -------------
def softmax(Z):
    Z = Z - Z.max(1, keepdims=True)
    E = np.exp(Z)
    return E / E.sum(1, keepdims=True)


def fit_multinomial(X, y, n_cls, lam=1.0, iters=600, lr=0.3):
    n, d = X.shape
    W = np.zeros((d, n_cls))
    Y = np.zeros((n, n_cls))
    Y[np.arange(n), y] = 1.0
    for _ in range(iters):
        P = softmax(X @ W)
        G = X.T @ (P - Y) / n + lam * W / n
        W -= lr * G
    return W


def predict_proba(W, X):
    return softmax(X @ W)


# ---- reward model for Direct Method (per-family logistic on strict_shift) --
def fit_reward_model(X, fam, r, binary=True, lam=1.0, iters=500, lr=0.3):
    """r_hat(x, f) with family one-hot appended. Logistic for the binary
    strict_shift reward; ridge-linear (closed form) for the 1-5 graded
    reward — a logistic on a 1-5 target saturates and is a modeling
    artifact, not a result."""
    n = len(X)
    F = np.zeros((n, len(FAMILIES)))
    ok = fam >= 0
    F[np.arange(n)[ok], fam[ok]] = 1.0
    Xr = np.hstack([X, F])
    m = ~np.isnan(r)
    Xm, rm = Xr[m], r[m]
    if not binary:
        d = Xr.shape[1]
        w = np.linalg.solve(Xm.T @ Xm + lam * np.eye(d), Xm.T @ rm)
        return w
    w = np.zeros(Xr.shape[1])
    for _ in range(iters):
        p = 1.0 / (1.0 + np.exp(-(Xm @ w)))
        g = Xm.T @ (p - rm) / len(rm) + lam * w / len(rm)
        w -= lr * g
    return w


def r_hat_all_families(w_r, X, binary=True):
    """Return (n, |F|) predicted reward for each family choice at each x."""
    n = len(X)
    out = np.zeros((n, len(FAMILIES)))
    for f in range(len(FAMILIES)):
        F = np.zeros((n, len(FAMILIES)))
        F[:, f] = 1.0
        Xr = np.hstack([X, F])
        z = Xr @ w_r
        out[:, f] = 1.0 / (1.0 + np.exp(-z)) if binary else z
    return out


# ---- grouped leave-one-scenario_type-out OPE ------------------------------
def grouped_ope(D, reward_key):
    X, fam, stype, cell = D["X"], D["fam"], D["stype"], D[reward_key]
    r = D[reward_key]
    binary = reward_key == "rb"
    types = sorted(set(D["stype"]))
    per_traj = []  # (scenario_type, dm_pi, agree_flag, r, cell)
    for held in types:
        te = D["stype"] == held
        tr = ~te
        ytr = fam[tr]
        keep = ytr >= 0
        if keep.sum() < 10 or te.sum() == 0:
            continue
        W = fit_multinomial(X[tr][keep], ytr[keep], len(FAMILIES))
        w_r = fit_reward_model(X[tr], fam[tr], r[tr], binary=binary)
        Pte = predict_proba(W, X[te])
        rhat_te = r_hat_all_families(w_r, X[te], binary=binary)
        dm_pi = (Pte * rhat_te).sum(1)            # DM value of pi per held-out x
        pi_arg = Pte.argmax(1)
        agree = (pi_arg == fam[te]) & (fam[te] >= 0)
        for i, gi in enumerate(np.where(te)[0]):
            per_traj.append({
                "stype": held, "dm_pi": float(dm_pi[i]),
                "agree": bool(agree[i]),
                "r": (None if np.isnan(r[gi]) else float(r[gi])),
                "cell": str(cell[gi]) if False else str(D["cell"][gi]),
            })
    return per_traj


def cluster_bootstrap_diff(per_traj, baseline_vals, B=2000):
    """95% CI for V_hat(pi) - V(baseline), clustering on scenario_type.
    V_hat(pi) = DM mean; on-policy-agreement reported separately."""
    types = sorted(set(p["stype"] for p in per_traj))
    by_t = {t: [p for p in per_traj if p["stype"] == t] for t in types}

    def stat(sample_types):
        pool = []
        for t in sample_types:
            pool.extend(by_t[t])
        dm = np.mean([p["dm_pi"] for p in pool]) if pool else np.nan
        ag = [p["r"] for p in pool if p["agree"] and p["r"] is not None]
        ag_v = np.mean(ag) if ag else np.nan
        return dm, ag_v, len(ag)

    dm0, ag0, ag_n0 = stat(types)
    out = {"dm_value": dm0, "agree_value": ag0, "agree_n": ag_n0, "vs": {}}
    for name, bval in baseline_vals.items():
        dboot = []
        for _ in range(B):
            s = list(RNG.choice(types, size=len(types), replace=True))
            dm, _, _ = stat(s)
            dboot.append(dm - bval)
        lo, hi = np.percentile(dboot, [2.5, 97.5])
        out["vs"][name] = {
            "baseline_value": bval,
            "dm_minus_baseline": dm0 - bval,
            "ci95": [float(lo), float(hi)],
            "beats": bool(lo > 0),
        }
    return out


def main():
    if not os.path.exists(TABLE):
        print(f"[ope] missing {TABLE} — run learned-adaptation-harvest.js first", file=sys.stderr)
        sys.exit(2)
    D = load()
    report = {"n": D["n"], "channels": {}}

    for rk, label in (("rb", "strict_shift (binary, §6.9.7 instrument)"),
                       ("rg", "graded_mean (§6.8/§6.9 graded channel)")):
        r = D[rk]
        base = {}
        for c in (IMPLICIT_BASELINE, A14_BASELINE):
            m = (D["cell"] == c) & (~np.isnan(r))
            base[c] = float(r[m].mean()) if m.sum() else float("nan")
        per_traj = grouped_ope(D, rk)
        boot = cluster_bootstrap_diff(per_traj, base)
        report["channels"][rk] = {
            "label": label,
            "baseline_on_policy_value": base,
            "fitted_policy_dm_value": boot["dm_value"],
            "fitted_policy_agreement_value": boot["agree_value"],
            "agreement_subset_n": boot["agree_n"],
            "vs_baselines": boot["vs"],
            "evaluable_families": sorted(set(p["stype"] for p in per_traj)),
        }

    # ---- KILL GATE: primary = strict_shift; must beat BOTH baselines -------
    pri = report["channels"]["rb"]["vs_baselines"]
    beats_implicit = pri[IMPLICIT_BASELINE]["beats"]
    beats_a14 = pri[A14_BASELINE]["beats"]
    passed = bool(beats_implicit and beats_a14)
    report["kill_gate"] = {
        "primary_channel": "strict_shift",
        "rule": "fitted policy DM value must beat BOTH cell_110 and cell_126 "
                "(lower 95% cluster-bootstrap CI of difference > 0) on the "
                "independent label",
        "beats_cell_110_implicit": beats_implicit,
        "beats_cell_126_a14": beats_a14,
        "PASSED": passed,
        "disposition": (
            "PASS -> proceed to Step 4 (counterfactual paired check), then "
            "the single pre-registered live confirmation (Step 5)."
            if passed else
            "FAIL -> STOP. This null is the §6.9.8 closing paragraph: the "
            "learned-policy lever — the last distinct one — does not pay "
            "either, on the same independent instruments as §6.9.7. No live "
            "run, no tuning retry (plan §2 ruthless kill criteria)."
        ),
    }

    json.dump(report, open(META, "w"), indent=2)

    print(f"[ope] N={D['n']}  (Steps 2+3, zero-API, grouped leave-one-family-out)")
    for rk in ("rb", "rg"):
        c = report["channels"][rk]
        print(f"\n== {c['label']} ==")
        print(f"  baseline on-policy: cell_110={c['baseline_on_policy_value']['cell_110']:.3f}  "
              f"cell_126={c['baseline_on_policy_value']['cell_126']:.3f}")
        dv = c["fitted_policy_dm_value"]
        av = c["fitted_policy_agreement_value"]
        print(f"  fitted policy: DM={dv:.3f}  on-policy-agreement={av if av!=av else round(av,3)} "
              f"(agree n={c['agreement_subset_n']})")
        for b, v in c["vs_baselines"].items():
            print(f"   vs {b}: Δ={v['dm_minus_baseline']:+.3f}  "
                  f"95%CI[{v['ci95'][0]:+.3f},{v['ci95'][1]:+.3f}]  beats={v['beats']}")
    g = report["kill_gate"]
    print(f"\n[KILL GATE] beats cell_110(implicit)={g['beats_cell_110_implicit']}  "
          f"beats cell_126(A14)={g['beats_cell_126_a14']}  -> "
          f"{'PASS' if g['PASSED'] else 'FAIL'}")
    print(f"  {g['disposition']}")
    print(f"\n[ope] meta: {os.path.relpath(META, REPO)}")


if __name__ == "__main__":
    main()
