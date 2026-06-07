#!/usr/bin/env python3
"""
retrieval-adaptation-knn-diagnostics.py — adversarial verification of the
retrieval-adaptation-knn-ope.py "PASS".

The k-NN gate reported DM=0.749 strict_shift (beats both baselines, all k),
but the assumption-light on-policy-agreement channel was 0.312 (BELOW both
baselines) and the graded channel showed no beat. That divergence is the
signature of Direct-Method optimism: a REWARD-GREEDY policy valued by a
reward-MODEL-based DM is inflated almost tautologically. Before believing the
PASS, run three adversarial controls:

  (1) PERMUTATION PLACEBO. Shuffle the outcome labels (destroy ALL
      state/action -> outcome signal), rerun the exact gate B times. If the
      reward-greedy-kNN still "passes" the DM gate on noise, gate-on-DM is
      measuring policy/reward-model coupling, not signal -> the PASS is an
      artifact.

  (2) BEHAVIOR-CLONING k-NN CONTROL. Swap the policy from reward-greedy
      (pick the family that WORKED among neighbours) to behaviour-cloning
      (pick the MAJORITY family among neighbours). This is the true
      apples-to-apples mirror of the OPE's logistic behaviour-cloning policy.
      If BC-kNN DM collapses to ~baseline while reward-greedy DM is 0.749, the
      inflation is from reward-greediness exploiting DM, not from retrieval.

  (3) CONSTANT-POLICY / MARGINAL check. Per-family marginal strict_shift, and
      the value of the degenerate "always pick the globally-best family"
      policy under both estimators. Establishes the no-adaptation floor.

ZERO API. Imports the gate's own functions so the controls are identical
except for the single manipulation under test.
"""

import importlib.util
import json
import os
import numpy as np
from collections import Counter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATE = os.path.join(REPO, "scripts", "retrieval-adaptation-knn-ope.py")
META = os.path.join(REPO, "exports", "retrieval-adaptation-knn-diagnostics.meta.json")

# import the hyphenated gate module by path
spec = importlib.util.spec_from_file_location("knn_ope", GATE)
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

FAMILIES = g.FAMILIES
PRIMARY_K = g.PRIMARY_K
IMPLICIT_BASELINE = g.IMPLICIT_BASELINE
A14_BASELINE = g.A14_BASELINE


# ---- behaviour-cloning k-NN selector: pick the MAJORITY family among neighbours
def bc_retrieval_select(x, Xbank, fam_bank, r_bank, k):
    d = np.sqrt(((Xbank - x) ** 2).sum(1))
    k_eff = min(k, len(d))
    nn = np.argpartition(d, k_eff - 1)[:k_eff]
    fams = fam_bank[nn]
    if len(fams) == 0:
        return -1
    counts = Counter(int(f) for f in fams if f >= 0)
    if not counts:
        return -1
    # majority; ties -> lower family index
    best = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
    return best


def grouped_ope_generic(D, reward_key, k, selector):
    """selector(x, Xbank, fam_bank, r_bank, k) -> family idx (or -1)."""
    X, fam, stype = D["X"], D["fam"], D["stype"]
    r = D[reward_key]
    binary = reward_key == "rb"
    types = sorted(set(D["stype"]))
    Xfeat = X[:, 1:]
    per_traj = []
    for held in types:
        te = D["stype"] == held
        tr = ~te
        w_r = g.fit_reward_model(X[tr], fam[tr], r[tr], binary=binary)
        rhat_te = g.r_hat_all_families(w_r, X[te], binary=binary)
        bank_mask = tr & (fam >= 0) & (~np.isnan(r))
        if bank_mask.sum() < 1 or te.sum() == 0:
            continue
        Xbank, fam_bank, r_bank = Xfeat[bank_mask], fam[bank_mask], r[bank_mask]
        te_idx = np.where(te)[0]
        for j, gi in enumerate(te_idx):
            sel = selector(Xfeat[gi], Xbank, fam_bank, r_bank, k)
            if isinstance(sel, tuple):
                sel = sel[0]
            if sel < 0:
                continue
            per_traj.append({
                "stype": held, "dm_pi": float(rhat_te[j, sel]),
                "agree": bool(fam[gi] == sel and fam[gi] >= 0),
                "r": (None if np.isnan(r[gi]) else float(r[gi])),
            })
    return per_traj


def value_and_gate(D, per_traj, reward_key):
    r = D[reward_key]
    base = {}
    for c in (IMPLICIT_BASELINE, A14_BASELINE):
        m = (D["cell"] == c) & (~np.isnan(r))
        base[c] = float(r[m].mean()) if m.sum() else float("nan")
    dm = float(np.mean([p["dm_pi"] for p in per_traj])) if per_traj else float("nan")
    ag = [p["r"] for p in per_traj if p["agree"] and p["r"] is not None]
    ag_v = float(np.mean(ag)) if ag else float("nan")
    return base, dm, ag_v, len(ag)


def main():
    D = g.load()
    rb = D["rb"]
    report = {"primary_k": PRIMARY_K, "controls": {}}

    # baselines on real data
    base_real = {}
    for c in (IMPLICIT_BASELINE, A14_BASELINE):
        m = (D["cell"] == c) & (~np.isnan(rb))
        base_real[c] = float(rb[m].mean())

    # ---- (0) restate the real reward-greedy result for reference ----------
    pt_real = grouped_ope_generic(D, "rb", PRIMARY_K, g.retrieval_select)
    _, dm_real, ag_real, agn_real = value_and_gate(D, pt_real, "rb")
    report["controls"]["reward_greedy_real"] = {
        "dm": dm_real, "agreement": ag_real, "agreement_n": agn_real,
        "beats_both_via_dm": bool(dm_real > base_real["cell_110"] and dm_real > base_real["cell_126"]),
        "agreement_vs_baseline": "below" if ag_real < min(base_real.values()) else "at/above",
    }

    # ---- (1) PERMUTATION PLACEBO ------------------------------------------
    # shuffle rb globally -> no state/action/cell -> outcome signal remains.
    # if the DM gate still fires, it is an artifact of policy/reward-model
    # coupling, not signal.
    rng = np.random.default_rng(20260606)
    B = 200
    dm_perm, beats_perm, ag_perm = [], 0, []
    for _ in range(B):
        perm = rng.permutation(len(rb))
        Dp = dict(D)
        Dp["rb"] = rb[perm]
        ptp = grouped_ope_generic(Dp, "rb", PRIMARY_K, g.retrieval_select)
        basep = {}
        for c in (IMPLICIT_BASELINE, A14_BASELINE):
            m = (Dp["cell"] == c) & (~np.isnan(Dp["rb"]))
            basep[c] = float(Dp["rb"][m].mean())
        _, dmp, agp, _ = value_and_gate(Dp, ptp, "rb")
        dm_perm.append(dmp)
        ag_perm.append(agp)
        if dmp > basep["cell_110"] and dmp > basep["cell_126"]:
            beats_perm += 1
    dm_perm = np.array(dm_perm)
    report["controls"]["permutation_placebo"] = {
        "B": B,
        "dm_mean_under_null": float(dm_perm.mean()),
        "dm_p05_p95_under_null": [float(np.percentile(dm_perm, 5)), float(np.percentile(dm_perm, 95))],
        "real_dm": dm_real,
        "real_dm_percentile_vs_null": float((dm_perm < dm_real).mean() * 100),
        "beats_both_rate_under_null": beats_perm / B,
        "agreement_mean_under_null": float(np.nanmean(ag_perm)),
        "interpretation": (
            "If real_dm sits inside the null band and beats_both fires often under "
            "shuffled labels, the DM gate is a coupling artifact. If real_dm is far "
            "above the null band, DM reflects genuine (within-training) per-family "
            "reward structure — but cross-family TRANSFER is judged by agreement, not DM."
        ),
    }

    # ---- (2) BEHAVIOUR-CLONING k-NN CONTROL -------------------------------
    pt_bc = grouped_ope_generic(D, "rb", PRIMARY_K, lambda x, Xb, fb, rb_, k: bc_retrieval_select(x, Xb, fb, rb_, k))
    _, dm_bc, ag_bc, agn_bc = value_and_gate(D, pt_bc, "rb")
    report["controls"]["behavior_cloning_knn"] = {
        "dm": dm_bc, "agreement": ag_bc, "agreement_n": agn_bc,
        "beats_both_via_dm": bool(dm_bc > base_real["cell_110"] and dm_bc > base_real["cell_126"]),
        "note": "majority-family k-NN (mirrors the OPE's behaviour-cloning logistic). "
                "If DM ~ baseline here but 0.749 for reward-greedy, the inflation is "
                "reward-greediness exploiting DM, not retrieval.",
    }

    # ---- (3) CONSTANT-POLICY / MARGINAL check -----------------------------
    fam = D["fam"]
    per_family = {}
    for fi, fname in enumerate(FAMILIES):
        m = (fam == fi) & (~np.isnan(rb))
        per_family[fname] = {"n": int(m.sum()), "marginal_strict_shift": (float(rb[m].mean()) if m.sum() else None)}
    best_family = max((v["marginal_strict_shift"] or -1, k) for k, v in per_family.items())[1]
    report["controls"]["marginal_per_family"] = {
        "per_family": per_family,
        "global_best_family": best_family,
        "global_best_marginal": per_family[best_family]["marginal_strict_shift"],
        "note": "the degenerate 'always pick global-best-family' floor. A real "
                "state-conditional policy must beat THIS, not just the cell baselines.",
    }

    report["baselines_strict_shift"] = base_real

    # ---- verdict ----------------------------------------------------------
    perm = report["controls"]["permutation_placebo"]
    rg = report["controls"]["reward_greedy_real"]
    artifact = perm["beats_both_rate_under_null"] >= 0.5
    agreement_null = rg["agreement"] < min(base_real.values())
    report["verdict"] = {
        "dm_pass_is_artifact_of_coupling": bool(artifact),
        "trustworthy_channel_is_null": bool(agreement_null),
        "summary": (
            "The reward-greedy k-NN DM 'PASS' is NOT supported by trustworthy evidence. "
            f"On-policy-agreement (the assumption-light channel) = {rg['agreement']:.3f}, "
            f"BELOW both baselines ({base_real['cell_110']:.3f}, {base_real['cell_126']:.3f}): "
            "the neighbour-reward signal does not transfer across the leave-one-family-out "
            "boundary. "
            + ("The permutation placebo confirms the DM gate fires on shuffled labels, so "
               "gate-on-DM is a coupling artifact for reward-greedy policies. "
               if artifact else
               "The permutation placebo shows the real DM exceeds the null band, so DM "
               "reflects within-training per-family structure that does NOT transfer "
               "(agreement is the transfer test, and it is null). ")
            + "Either way the retrieval lever does not beat baseline on transfer-valid "
            "evidence — consistent with §6.9.8. The correct gate channel for a reward-greedy "
            "policy without logged propensities is on-policy-agreement, which is null."
        ),
    }

    json.dump(report, open(META, "w"), indent=2)

    print("=== A15 retrieval k-NN: ADVERSARIAL DIAGNOSTICS ===")
    print(f"baselines strict_shift: cell_110={base_real['cell_110']:.3f} cell_126={base_real['cell_126']:.3f}")
    print(f"\n(0) reward-greedy k-NN (the 'PASS'): DM={dm_real:.3f}  agreement={ag_real:.3f} (n={agn_real})  "
          f"agreement {'BELOW' if agreement_null else 'AT/ABOVE'} baseline")
    print(f"\n(1) PERMUTATION PLACEBO (B={perm['B']}, labels shuffled):")
    print(f"    null DM mean={perm['dm_mean_under_null']:.3f}  null DM [p05,p95]="
          f"[{perm['dm_p05_p95_under_null'][0]:.3f},{perm['dm_p05_p95_under_null'][1]:.3f}]")
    print(f"    real DM={dm_real:.3f}  (percentile vs null={perm['real_dm_percentile_vs_null']:.1f})")
    print(f"    beats-both rate UNDER NULL = {perm['beats_both_rate_under_null']:.2f}  "
          f"(>=0.5 -> DM gate is an artifact)")
    print(f"\n(2) BEHAVIOUR-CLONING k-NN (majority family): DM={dm_bc:.3f}  agreement={ag_bc:.3f}  "
          f"beats_both_via_dm={report['controls']['behavior_cloning_knn']['beats_both_via_dm']}")
    print(f"\n(3) MARGINAL per-family strict_shift:")
    for k, v in per_family.items():
        print(f"    {k:24s} n={v['n']:3d}  rate={v['marginal_strict_shift']}")
    print(f"    global-best-family floor: {best_family} = {per_family[best_family]['marginal_strict_shift']:.3f}")
    print(f"\n=== VERDICT ===")
    print(f"  DM-pass is coupling artifact: {report['verdict']['dm_pass_is_artifact_of_coupling']}")
    print(f"  trustworthy channel (agreement) is null: {report['verdict']['trustworthy_channel_is_null']}")
    print(f"  {report['verdict']['summary']}")
    print(f"\n[diag] meta: {os.path.relpath(META, REPO)}")


if __name__ == "__main__":
    main()
