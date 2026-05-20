// A17 — the single audited outcome module.
//
// Every number the construct is judged on is computed HERE, by pure
// functions, with no LLM and no tutor-authored input. The smoke (task #2) and
// the post-paid-run analyzer (task #5) both import these — so the outcome
// predicate exists in exactly one inspectable place. This is the operational
// core of §2's "structurally impossible to grade yourself": the gate is this
// file, the tutor never calls it, and it only reads a server-scored probe log.
//
// References: notes/design-a17-speech-act-lock-prototype.md §3.3 (unlock
// predicate), §8 (primary outcome + D1/D2 decision rule), §7 step 1 + D3
// (analytic power table — unlock is binary, so the contrast is a difference
// of proportions and the variance is analytic p(1−p)/n, NOT mock-estimated).

// ── Unlock predicate (§3.3, decision D4) ──────────────────────────────────
//
// probeLog: ordered per-turn entries, each { turn, allCorrect:boolean }.
// Unlock = the panel is all-correct for k CONSECUTIVE turns. Returns the
// earliest such turn (the run-length completes) so distance-to-unlock and
// session-slope analyses share one definition.
export function deriveUnlock(probeLog, k) {
  if (!Array.isArray(probeLog) || probeLog.length === 0 || !k || k < 1) {
    return { unlocked: false, unlockTurn: null, maxRun: 0 };
  }
  const ordered = [...probeLog].sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0));
  let run = 0;
  let maxRun = 0;
  for (const e of ordered) {
    run = e.allCorrect ? run + 1 : 0;
    if (run > maxRun) maxRun = run;
    if (run >= k) {
      return { unlocked: true, unlockTurn: e.turn, maxRun };
    }
  }
  return { unlocked: false, unlockTurn: null, maxRun };
}

// ── Stream trajectory ─────────────────────────────────────────────────────
//
// sessions: ordered array of { sessionIndex, unlocked: 0|1 } for ONE arm on
// the held-out stream. Returns the raw 0/1 series, a cumulative running rate
// (what "rises across the stream" means visually), and the binned rate over
// `bins` equal segments (for a stable end-vs-start read).
export function unlockRateTrajectory(sessions, { bins = 4 } = {}) {
  const ordered = [...sessions].sort((a, b) => a.sessionIndex - b.sessionIndex);
  const series = ordered.map((s) => (s.unlocked ? 1 : 0));
  const n = series.length;
  const overallRate = n ? series.reduce((a, b) => a + b, 0) / n : 0;

  const cumulative = [];
  let acc = 0;
  series.forEach((v, i) => {
    acc += v;
    cumulative.push(acc / (i + 1));
  });

  const binned = [];
  if (n > 0) {
    const size = Math.max(1, Math.floor(n / bins));
    for (let b = 0; b < bins; b++) {
      const start = b * size;
      const end = b === bins - 1 ? n : Math.min(n, start + size);
      if (start >= end) break;
      const seg = series.slice(start, end);
      binned.push({ bin: b, rate: seg.reduce((a, c) => a + c, 0) / seg.length, nSessions: seg.length });
    }
  }
  return { series, overallRate, cumulative, binned, n };
}

// OLS slope of y on x. Used for §8 D2 ("A2 unlock-rate-vs-session slope > 0")
// and the smoke's flatness check on A1 ("|slope| ≈ 0"). Bootstrap CI for the
// confirmatory D2 rule is a task-#5 concern; the smoke only needs the point
// slope to verify the qualitative floor/rise/ceiling signature.
export function olsSlope(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// Slope of the cumulative running unlock rate across sessions — the smoke's
// operational "rises (A2) vs flat (A1)" discriminator.
export function streamRiseSlope(sessions) {
  const { cumulative } = unlockRateTrajectory(sessions);
  const xs = cumulative.map((_, i) => i);
  return olsSlope(xs, cumulative);
}

// ── Analytic power (§7 step 1, D3) ────────────────────────────────────────
//
// Acklam's rational approximation to the inverse normal CDF. Pure, ~1e-9
// accurate on (0,1) — enough for sample-size planning. Kept inline so the
// outcome module has zero runtime deps.
export function invNorm(p) {
  if (p <= 0 || p >= 1) throw new Error(`invNorm domain (0,1), got ${p}`);
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q;
  let r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// Required N PER ARM for a two-proportion test (Fleiss normal approximation,
// equal allocation), to detect p2 − p1 at two-sided α and power 1−β. This is
// the analytic variance the design rests on — p1/p2 are inputs (D1 fixes the
// margin; the mock only supplies a plausible baseline p1), NOT estimated from
// mock noise.
export function twoProportionNPerArm(p1, p2, { alpha = 0.05, power = 0.8 } = {}) {
  if (p1 === p2) return Infinity;
  const zA = invNorm(1 - alpha / 2);
  const zB = invNorm(power);
  const pbar = (p1 + p2) / 2;
  const num = zA * Math.sqrt(2 * pbar * (1 - pbar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil(num ** 2 / (p2 - p1) ** 2);
}

// Cluster design effect: puzzles are clusters, runs within a puzzle are
// correlated, so the effective N inflates by 1 + (m − 1)·ICC where m =
// runs/puzzle. D3's 12 puzzles × 8 runs ⇒ m = 8.
export function clusterDesignEffect(runsPerCluster, icc) {
  return 1 + (Math.max(1, runsPerCluster) - 1) * Math.max(0, icc);
}

// The analytic power table the smoke prints in place of a "variance estimate".
// For the locked margin Δ* (D1) and a grid of plausible A1 baselines, the
// per-arm dialogue count needed, then inflated by the cluster design effect.
// D3's proposed 96/arm is checked against the table — the smoke reports
// whether 12×8 clears the worst-case baseline at Δ*.
export function powerTable({
  deltaStar,
  baselines = [0.1, 0.2, 0.3, 0.4, 0.5],
  alpha = 0.05,
  power = 0.8,
  runsPerCluster = 8,
  icc = 0.05,
  proposedNPerArm = 96,
} = {}) {
  const deff = clusterDesignEffect(runsPerCluster, icc);
  const rows = baselines.map((p1) => {
    const p2 = Math.min(0.999, p1 + deltaStar);
    const nIid = twoProportionNPerArm(p1, p2, { alpha, power });
    const nEff = Math.ceil(nIid * deff);
    return {
      p1,
      p2,
      nIidPerArm: nIid,
      designEffect: Number(deff.toFixed(3)),
      nClusteredPerArm: nEff,
      proposedClears: proposedNPerArm >= nEff,
    };
  });
  const worst = rows.reduce((w, r) => (r.nClusteredPerArm > w.nClusteredPerArm ? r : w), rows[0]);
  return {
    deltaStar,
    alpha,
    power,
    runsPerCluster,
    icc,
    designEffect: Number(deff.toFixed(3)),
    proposedNPerArm,
    rows,
    worstCase: worst,
    proposedClearsWorstCase: proposedNPerArm >= worst.nClusteredPerArm,
  };
}

export default {
  deriveUnlock,
  unlockRateTrajectory,
  olsSlope,
  streamRiseSlope,
  invNorm,
  twoProportionNPerArm,
  clusterDesignEffect,
  powerTable,
};
