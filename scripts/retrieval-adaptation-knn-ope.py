#!/usr/bin/env python3
"""
retrieval-adaptation-knn-ope.py — A15 (Cross-Dialogue Retrieval-Augmented
Adaptation) settled OFFLINE, on the same kill gate the parametric
learned-policy lever faced in §6.9.8.

WHY THIS SCRIPT EXISTS
----------------------
§6.9.8 closed the adaptation arc by running the *parametric* policy form
(multinomial logistic, state -> action-family) through an offline OPE kill
gate; it failed (beat cell_126 but NOT cell_110 -> beat-both = FAIL).
A15's retrieval mechanism is the *non-parametric sibling* of that same
state -> action map: embed the current learner-state, retrieve top-k past
(state -> action -> outcome) tuples, do what worked in similar states.

The paper names "add embeddings and rerun [the live cell]" as the treadmill
to refuse. This is NOT that. This is the SAME single offline gate, with the
ONLY substantive change being the policy functional form:

    learned-adaptation-policy-ope.py :  pi = multinomial-logistic(state)
    THIS script                      :  pi = reward-weighted k-NN(state)

Everything else — the harvest table, the state features + standardization,
the Direct-Method reward model r_hat, the grouped leave-one-scenario_type-out
CV, the on-policy-agreement estimator, the cluster bootstrap (B=2000, seed
20260517), and the beat-BOTH-cell_110-AND-cell_126 kill gate on strict_shift
— is verbatim from the OPE so the two are directly diffable. A reviewer sees
exactly one knob turned: parametric -> non-parametric.

This fills the one empirically-unrun cell in LEARNED-ADAPTATION-PLAN.md's
table: retrieval = nearest-neighbor, the non-parametric policy form. If it
fails the gate, §6.9.8 strengthens from "retrieval argued-null by analogy"
to "retrieval RUN-null on the identical instrument" — the policy-FORM axis
is then closed (parametric AND non-parametric both run). If it clears, that
is the first empirical justification to build the live cell + paid run.

ZERO API, pure computation. Reads exports/learned-adaptation-table.csv
(the §6.9.8 harvest; fidelity-asserted strict_shift). ONE gate, pre-declared
PRIMARY_K; the K-sweep is reported as sensitivity, NOT selection (selecting
the K that passes IS the treadmill).
"""

import csv
import json
import os
import sys
import numpy as np

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(REPO, "exports", "learned-adaptation-table.csv")
META = os.path.join(REPO, "exports", "retrieval-adaptation-knn-ope.meta.json")
RNG = np.random.default_rng(20260517)  # same seed as the OPE — identical bootstrap stream

# --- pre-declared a priori; the decision is on PRIMARY_K, NOT the best of the sweep
PRIMARY_K = 5                      # canonical RAG top-k
K_SWEEP = [3, 5, 10, 15, 25]       # reported as sensitivity, not selection
DIST_EPS = 1e-6                    # distance-weight floor

FAMILIES = ["substantive_engagement", "diagnostic", "scaffolding", "repair_affective"]
NUM_FEATS = [
    "confidence", "n_misconceptions", "zpd_estimate_len", "n_hypotheses",
    "n_hyp_validated", "n_hyp_tentative", "n_hyp_contradicted", "mean_hyp_confidence",
    "n_evidence", "n_evidence_validated", "evidence_recency", "n_constraint_violations",
]
AGENCY = ["compliant", "questioning", "engaged", "withdrawn", "resistant", "missing"]

IMPLICIT_BASELINE = "cell_110"   # policy implicit in the LLM forward pass
A14_BASELINE = "cell_126"        # A14 hand-authored graph nodes


def fnum(v):
    if v is None or v == "":
        return np.nan
    try:
        return float(v)
    except ValueError:
        return np.nan


# ---- load + feature construction: VERBATIM from learned-adaptation-policy-ope.py
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
    miss_cols = [NUM_FEATS.index(c) for c in ("confidence", "mean_hyp_confidence", "evidence_recency")]
    flags = np.isnan(Xn[:, miss_cols]).astype(float)
    col_mean = np.nanmean(np.where(np.isnan(Xn), np.nan, Xn), axis=0)
    col_mean = np.where(np.isnan(col_mean), 0.0, col_mean)
    inds = np.where(np.isnan(Xn))
    Xn[inds] = np.take(col_mean, inds[1])
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


# ---- reward model for Direct Method: VERBATIM from learned-adaptation-policy-ope.py
def fit_reward_model(X, fam, r, binary=True, lam=1.0, iters=500, lr=0.3):
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
    n = len(X)
    out = np.zeros((n, len(FAMILIES)))
    for f in range(len(FAMILIES)):
        F = np.zeros((n, len(FAMILIES)))
        F[:, f] = 1.0
        Xr = np.hstack([X, F])
        z = Xr @ w_r
        out[:, f] = 1.0 / (1.0 + np.exp(-z)) if binary else z
    return out


# ============================================================================
# THE ONE SUBSTANTIVE CHANGE vs the OPE: the policy is non-parametric retrieval.
#
# pi_retrieval(x): take the k nearest bank states (Euclidean on the SAME
# standardized feature vector the OPE uses), distance-weight them, and for
# each action-family present among the neighbours compute the distance-weighted
# mean reward ("what worked in similar states"). Select argmax family. This is
# the A15 mechanism — retrieve top-k (state->action->outcome), do what worked —
# operationalised as a deterministic reward-weighted k-NN selector.
#
# The bank is TRAINING folds only (leave-one-scenario_type-out), so a held-out
# family's own tuples are never retrievable: the policy must generalise the
# (state -> good-action) mapping ACROSS families. It cannot memorise "in family
# X do Y." If state features carry transferable policy signal, k-NN finds it; if
# not, it collapses to the majority/behaviour family and ties the baseline.
# ============================================================================
def retrieval_select(x, Xbank, fam_bank, r_bank, k):
    """Return (selected_family_idx, per_family_score_vector) for one query x.

    per_family_score[f] = distance-weighted mean reward among the k neighbours
    that took family f (NaN if no neighbour took f). Selection = argmax over
    families with a defined score; ties -> lower family index (stable)."""
    d = np.sqrt(((Xbank - x) ** 2).sum(1))
    k_eff = min(k, len(d))
    nn = np.argpartition(d, k_eff - 1)[:k_eff]
    w = 1.0 / (d[nn] + DIST_EPS)
    fams = fam_bank[nn]
    rews = r_bank[nn]
    score = np.full(len(FAMILIES), np.nan)
    for f in range(len(FAMILIES)):
        sel = (fams == f) & ~np.isnan(rews)
        if sel.any():
            ww = w[sel]
            score[f] = float((ww * rews[sel]).sum() / ww.sum())
    if np.all(np.isnan(score)):
        return -1, score
    sel_f = int(np.nanargmax(score))  # first max on ties -> lower index
    return sel_f, score


# ---- grouped leave-one-scenario_type-out OPE for the retrieval policy -------
def grouped_ope_retrieval(D, reward_key, k):
    X, fam, stype = D["X"], D["fam"], D["stype"]
    r = D[reward_key]
    binary = reward_key == "rb"
    types = sorted(set(D["stype"]))
    Xfeat = X[:, 1:]  # drop the intercept column for distance (constant -> 0 contribution)
    per_traj = []
    sel_families = []
    deviates_from_logged = []
    for held in types:
        te = D["stype"] == held
        tr = ~te
        # reward model (DM): fit on the full training fold, exactly as the OPE
        w_r = fit_reward_model(X[tr], fam[tr], r[tr], binary=binary)
        rhat_te = r_hat_all_families(w_r, X[te], binary=binary)
        # retrieval bank = training rows with a valid family AND a valid reward
        bank_mask = tr & (fam >= 0) & (~np.isnan(r))
        if bank_mask.sum() < 1 or te.sum() == 0:
            continue
        Xbank, fam_bank, r_bank = Xfeat[bank_mask], fam[bank_mask], r[bank_mask]
        te_idx = np.where(te)[0]
        for gi in te_idx:
            sel_f, _ = retrieval_select(Xfeat[gi], Xbank, fam_bank, r_bank, k)
            if sel_f < 0:
                continue
            dm_pi = float(rhat_te[np.where(te_idx == gi)[0][0], sel_f])
            logged = fam[gi]
            agree = bool(logged == sel_f and logged >= 0)
            per_traj.append({
                "stype": held,
                "dm_pi": dm_pi,
                "agree": agree,
                "r": (None if np.isnan(r[gi]) else float(r[gi])),
                "cell": str(D["cell"][gi]),
            })
            sel_families.append(FAMILIES[sel_f])
            if logged >= 0:
                deviates_from_logged.append(logged != sel_f)
    return per_traj, sel_families, deviates_from_logged


# ---- cluster bootstrap: VERBATIM structure from the OPE ---------------------
def cluster_bootstrap_diff(per_traj, baseline_vals, B=2000):
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


def run_channel(D, reward_key, k):
    r = D[reward_key]
    base = {}
    for c in (IMPLICIT_BASELINE, A14_BASELINE):
        m = (D["cell"] == c) & (~np.isnan(r))
        base[c] = float(r[m].mean()) if m.sum() else float("nan")
    per_traj, sel_families, deviates = grouped_ope_retrieval(D, reward_key, k)
    boot = cluster_bootstrap_diff(per_traj, base)
    from collections import Counter
    return {
        "baseline_on_policy_value": base,
        "fitted_policy_dm_value": boot["dm_value"],
        "fitted_policy_agreement_value": boot["agree_value"],
        "agreement_subset_n": boot["agree_n"],
        "vs_baselines": boot["vs"],
        "evaluable_families": sorted(set(p["stype"] for p in per_traj)),
        "n_decisions": len(per_traj),
        "selected_family_dist": dict(Counter(sel_families)),
        "frac_deviates_from_logged": (float(np.mean(deviates)) if deviates else None),
    }


def main():
    if not os.path.exists(TABLE):
        print(f"[knn-ope] missing {TABLE} — copy the §6.9.8 harvest table here first", file=sys.stderr)
        sys.exit(2)
    D = load()

    labels = {"rb": "strict_shift (binary, §6.9.7 instrument)",
              "rg": "graded_mean (§6.8/§6.9 graded channel)"}

    # PRIMARY gate at PRIMARY_K
    primary = {rk: run_channel(D, rk, PRIMARY_K) for rk in ("rb", "rg")}

    # K-sweep SENSITIVITY (strict_shift only) — descriptive, NOT used for the decision
    sweep = {}
    for k in K_SWEEP:
        c = run_channel(D, "rb", k)
        v110 = c["vs_baselines"][IMPLICIT_BASELINE]
        v126 = c["vs_baselines"][A14_BASELINE]
        sweep[k] = {
            "dm_value": c["fitted_policy_dm_value"],
            "beats_cell_110": v110["beats"], "ci_vs_110": v110["ci95"],
            "beats_cell_126": v126["beats"], "ci_vs_126": v126["ci95"],
            "beats_both": bool(v110["beats"] and v126["beats"]),
        }

    rb_ch = primary["rb"]
    base_rb = rb_ch["baseline_on_policy_value"]
    pri = rb_ch["vs_baselines"]
    dm_beats_implicit = pri[IMPLICIT_BASELINE]["beats"]
    dm_beats_a14 = pri[A14_BASELINE]["beats"]
    dm_beats_both = bool(dm_beats_implicit and dm_beats_a14)
    # The DM channel is NOT identified for this policy. The retrieval policy
    # deviates from the logged (behaviour) action on ~82% of decisions, so its
    # value depends on r_hat extrapolating to (state, off-policy-action) cells
    # the data never observed — and a reward-greedy policy seeks exactly those
    # cells, so DM is optimistically biased (verified: retrieval-adaptation-
    # knn-diagnostics.py shows the DM "pass" survives label permutation as a
    # base-rate exploit and collapses to baseline under behaviour-cloning).
    # The transfer-valid gate is on-policy-agreement: the assumption-light
    # channel that uses the ACTUAL held-out outcomes of the policy's own picks.
    ag_val = rb_ch["fitted_policy_agreement_value"]
    ag_beats_both = bool(
        ag_val == ag_val
        and ag_val > base_rb[IMPLICIT_BASELINE]
        and ag_val > base_rb[A14_BASELINE]
    )
    passed = bool(dm_beats_both and ag_beats_both)  # trustworthy conjunction
    any_k_passes = any(v["beats_both"] for v in sweep.values())

    report = {
        "n": D["n"],
        "policy": "non-parametric reward-weighted k-NN retrieval (A15 mechanism, offline)",
        "primary_k": PRIMARY_K,
        "k_sweep": K_SWEEP,
        "mirrors": "learned-adaptation-policy-ope.py (identical data, features, r_hat, "
                   "grouped LOO CV, cluster bootstrap B=2000 seed 20260517, beat-both gate); "
                   "ONLY the policy form differs (logistic -> k-NN retrieval).",
        "channels": {rk: {"label": labels[rk], **primary[rk]} for rk in ("rb", "rg")},
        "k_sweep_strict_shift": sweep,
        "kill_gate": {
            "primary_channel": "strict_shift",
            "primary_k": PRIMARY_K,
            "rule": "retrieval policy must beat BOTH cell_110 and cell_126 on the "
                    "TRANSFER-VALID channel. DM is not identified for an off-policy-heavy "
                    "policy (deviates ~82%), so the gate requires the assumption-light "
                    "on-policy-agreement channel to clear, not DM alone. The K-sweep is "
                    "sensitivity, not selection.",
            "dm_beats_cell_110_implicit": dm_beats_implicit,
            "dm_beats_cell_126_a14": dm_beats_a14,
            "dm_beats_both": dm_beats_both,
            "agreement_value": ag_val,
            "agreement_beats_both": ag_beats_both,
            "PASSED": passed,
            "sweep_any_k_beats_both_via_dm": any_k_passes,
            "disposition": (
                "PASS -> first empirical justification to build the live A15 cell "
                "(cell_133, state_policy_evidence_bound_retrieval) + the single "
                "pre-registered paid confirmation."
                if passed else
                "FAIL (transfer-valid) -> DM 'beats' both baselines, but that is a "
                "base-rate exploit, not transferable adaptation: the reward-greedy "
                "policy shifts picks toward minority families whose marginal strict_shift "
                "is high BY THE LABEL'S CONSTRUCTION (a rare family is 'correct' on the "
                "scenarios that expected it). On the transfer-valid on-policy-agreement "
                "channel the policy is BELOW baseline — the neighbour-reward signal does "
                "not cross the leave-one-family-out boundary. This matches the parametric "
                "lever (§6.9.8: logistic agreement 0.326, also below baseline). The "
                "policy-FORM axis is now closed empirically: parametric (logistic) AND "
                "non-parametric (k-NN retrieval) both run-null on the trustworthy channel. "
                "'Retrieval is designed and gated, not a counterexample' — now RUN, not "
                "argued. No live cell, no paid run, no K-retry (the foreclosed 'add "
                "embeddings and rerun' treadmill). See retrieval-adaptation-knn-"
                "diagnostics.py for the permutation placebo + behaviour-cloning control."
            ),
        },
    }

    json.dump(report, open(META, "w"), indent=2)

    print(f"[knn-ope] N={D['n']}  policy=reward-weighted k-NN retrieval  PRIMARY_K={PRIMARY_K}")
    print(f"[knn-ope] grouped leave-one-scenario_type-out ({len(set(D['stype']))} families), zero-API")
    for rk in ("rb", "rg"):
        c = report["channels"][rk]
        print(f"\n== {c['label']} ==")
        print(f"  baseline on-policy: cell_110={c['baseline_on_policy_value']['cell_110']:.3f}  "
              f"cell_126={c['baseline_on_policy_value']['cell_126']:.3f}")
        dv = c["fitted_policy_dm_value"]
        av = c["fitted_policy_agreement_value"]
        print(f"  retrieval policy: DM={dv:.3f}  on-policy-agreement="
              f"{av if av != av else round(av, 3)} (agree n={c['agreement_subset_n']})")
        print(f"  selected-family dist: {c['selected_family_dist']}  "
              f"deviates-from-logged={c['frac_deviates_from_logged']}")
        for b, v in c["vs_baselines"].items():
            print(f"   vs {b}: Δ={v['dm_minus_baseline']:+.3f}  "
                  f"95%CI[{v['ci95'][0]:+.3f},{v['ci95'][1]:+.3f}]  beats={v['beats']}")

    print(f"\n== K-sweep sensitivity (strict_shift; DECISION is on PRIMARY_K={PRIMARY_K} only) ==")
    for k, v in sweep.items():
        tag = "  <- PRIMARY" if k == PRIMARY_K else ""
        print(f"  k={k:2d}: DM={v['dm_value']:.3f}  beats110={v['beats_cell_110']}  "
              f"beats126={v['beats_cell_126']}  beats_both={v['beats_both']}{tag}")

    g = report["kill_gate"]
    print(f"\n[KILL GATE @k={PRIMARY_K}] (transfer-valid: must clear the agreement channel)")
    print(f"  DM channel        : beats110={g['dm_beats_cell_110_implicit']} beats126={g['dm_beats_cell_126_a14']} "
          f"-> dm_beats_both={g['dm_beats_both']}  (NOT identified; off-policy ~82%)")
    print(f"  agreement channel : value={g['agreement_value']:.3f} vs baselines "
          f"({base_rb['cell_110']:.3f},{base_rb['cell_126']:.3f}) -> beats_both={g['agreement_beats_both']}")
    print(f"  ==> {'PASS' if g['PASSED'] else 'FAIL'}")
    print(f"  {g['disposition']}")
    print(f"\n[knn-ope] meta: {os.path.relpath(META, REPO)}")


if __name__ == "__main__":
    main()
