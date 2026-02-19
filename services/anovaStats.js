/**
 * ANOVA Statistics Module
 *
 * Three-way ANOVA for 2×2×2 factorial designs.
 * Extracted from benchmarkService to be reusable by the main evaluation pipeline.
 *
 * Factors:
 *   A: Recognition (standard vs recognition-enhanced prompts)
 *   B: Multi-agent tutor (single vs ego+superego dialogue)
 *   C: Multi-agent learner (unified vs ego_superego)
 */

// ---- F-distribution p-value via regularized incomplete beta function ----

/**
 * Log-gamma function using Lanczos approximation (g=7, n=9 coefficients).
 * Accurate to ~15 decimal digits for positive real arguments.
 * Uses the reflection formula for z < 0.5.
 */
function lnGamma(z) {
  if (z <= 0) return Infinity;

  // Reflection formula: Gamma(z)*Gamma(1-z) = pi/sin(pi*z)
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }

  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Regularized incomplete beta function I_x(a, b) via the continued fraction
 * representation from Numerical Recipes (betacf). Uses modified Lentz's method.
 *
 * The continued fraction is:
 *   I_x(a,b) = prefactor * (1/1+) (d1/1+) (d2/1+) (d3/1+) ...
 * where d_{2m+1} = -(a+m)(a+b+m)x / ((a+2m)(a+2m+1))
 *       d_{2m}   = m(b-m)x / ((a+2m-1)(a+2m))
 */
function regularizedBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use the symmetry relation when x > (a+1)/(a+b+2) for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedBeta(1 - x, b, a);
  }

  // Compute the prefactor: x^a * (1-x)^b / (a * Beta(a,b))
  const lnPrefactor = a * Math.log(x) + b * Math.log(1 - x) - Math.log(a) - lnGamma(a) - lnGamma(b) + lnGamma(a + b);
  const prefactor = Math.exp(lnPrefactor);

  // Evaluate the continued fraction using modified Lentz's method
  // Following Numerical Recipes "betacf" algorithm
  const maxIter = 200;
  const eps = 3e-14;
  const fpmin = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even step: d_{2m}
    let aa = (m * (b - m) * x) / ((qam + 2 * m) * (a + 2 * m));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;

    // Odd step: d_{2m+1}
    aa = (-(a + m) * (qab + m) * x) / ((a + 2 * m) * (qap + 2 * m));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < eps) break;
  }

  return prefactor * h;
}

/**
 * Compute p-value for the F-distribution: P(F > x | d1, d2).
 *
 * @param {number} F - The F-statistic
 * @param {number} d1 - Numerator degrees of freedom
 * @param {number} d2 - Denominator degrees of freedom
 * @returns {number} p-value (upper tail probability)
 */
function fDistPValue(F, d1, d2) {
  if (F <= 0 || d1 <= 0 || d2 <= 0) return 1;
  if (!isFinite(F)) return 0;

  const x = (d1 * F) / (d1 * F + d2);
  return 1 - regularizedBeta(x, d1 / 2, d2 / 2);
}

/**
 * Run a three-way ANOVA on factorial cell data.
 *
 * @param {Object} data - Map of cellKey → [scores]
 *   Cell keys encode factor levels: "r{0|1}_t{0|1}_l{0|1}"
 *   e.g. { "r0_t0_l0": [55, 62, 58], "r0_t0_l1": [60, 65, 63], ... }
 * @returns {Object} ANOVA results with main effects, interactions, and diagnostics
 */
export function runThreeWayANOVA(data) {
  const cells = {};

  // Accept both cellKey format ("r0_t0_l0") and profile-name format
  for (const [key, scores] of Object.entries(data)) {
    if (key.match(/^r[01]_t[01]_l[01]$/)) {
      cells[key] = scores;
    }
  }

  // If no cell-keyed data, return error
  if (Object.keys(cells).length === 0) {
    return { error: 'No data available for ANOVA. Data must use cell keys like "r0_t0_l0".' };
  }

  const allData = Object.values(cells).flat();
  const N = allData.length;
  if (N === 0) {
    return { error: 'No data available for ANOVA' };
  }

  const grandMean = allData.reduce((a, b) => a + b, 0) / N;

  const getByFactors = (r, t, l) => cells[`r${r}_t${t}_l${l}`] || [];

  // Calculate marginal means
  const getMarginalMean = (factor, level) => {
    let values = [];
    if (factor === 'recognition') {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          values = values.concat(getByFactors(level, t, l));
        }
      }
    } else if (factor === 'tutor') {
      for (const r of [0, 1]) {
        for (const l of [0, 1]) {
          values = values.concat(getByFactors(r, level, l));
        }
      }
    } else if (factor === 'learner') {
      for (const r of [0, 1]) {
        for (const t of [0, 1]) {
          values = values.concat(getByFactors(r, t, level));
        }
      }
    }
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : grandMean;
  };

  const meanR0 = getMarginalMean('recognition', 0);
  const meanR1 = getMarginalMean('recognition', 1);
  const meanT0 = getMarginalMean('tutor', 0);
  const meanT1 = getMarginalMean('tutor', 1);
  const meanL0 = getMarginalMean('learner', 0);
  const meanL1 = getMarginalMean('learner', 1);

  // Sample sizes per level
  const getN = (factor, level) => {
    let count = 0;
    if (factor === 'recognition') {
      for (const t of [0, 1]) {
        for (const l of [0, 1]) {
          count += getByFactors(level, t, l).length;
        }
      }
    } else if (factor === 'tutor') {
      for (const r of [0, 1]) {
        for (const l of [0, 1]) {
          count += getByFactors(r, level, l).length;
        }
      }
    } else if (factor === 'learner') {
      for (const r of [0, 1]) {
        for (const t of [0, 1]) {
          count += getByFactors(r, t, level).length;
        }
      }
    }
    return count;
  };

  // Sum of Squares
  const SST = allData.reduce((acc, x) => acc + (x - grandMean) ** 2, 0);

  const nR0 = getN('recognition', 0);
  const nR1 = getN('recognition', 1);
  const nT0 = getN('tutor', 0);
  const nT1 = getN('tutor', 1);
  const nL0 = getN('learner', 0);
  const nL1 = getN('learner', 1);

  const SS_R = nR0 * (meanR0 - grandMean) ** 2 + nR1 * (meanR1 - grandMean) ** 2;
  const SS_T = nT0 * (meanT0 - grandMean) ** 2 + nT1 * (meanT1 - grandMean) ** 2;
  const SS_L = nL0 * (meanL0 - grandMean) ** 2 + nL1 * (meanL1 - grandMean) ** 2;

  // Two-way interaction means
  const getTwoWayMean = (f1, l1, f2, l2) => {
    let values = [];
    if (f1 === 'recognition' && f2 === 'tutor') {
      for (const l of [0, 1]) values = values.concat(getByFactors(l1, l2, l));
    } else if (f1 === 'recognition' && f2 === 'learner') {
      for (const t of [0, 1]) values = values.concat(getByFactors(l1, t, l2));
    } else if (f1 === 'tutor' && f2 === 'learner') {
      for (const r of [0, 1]) values = values.concat(getByFactors(r, l1, l2));
    }
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : grandMean;
  };

  let SS_RT = 0,
    SS_RL = 0,
    SS_TL = 0;
  for (const r of [0, 1]) {
    for (const t of [0, 1]) {
      const cellMean = getTwoWayMean('recognition', r, 'tutor', t);
      const expected = (r === 1 ? meanR1 : meanR0) + (t === 1 ? meanT1 : meanT0) - grandMean;
      const cellN = getByFactors(r, t, 0).length + getByFactors(r, t, 1).length;
      SS_RT += cellN * (cellMean - expected) ** 2;
    }
  }
  for (const r of [0, 1]) {
    for (const l of [0, 1]) {
      const cellMean = getTwoWayMean('recognition', r, 'learner', l);
      const expected = (r === 1 ? meanR1 : meanR0) + (l === 1 ? meanL1 : meanL0) - grandMean;
      const cellN = getByFactors(r, 0, l).length + getByFactors(r, 1, l).length;
      SS_RL += cellN * (cellMean - expected) ** 2;
    }
  }
  for (const t of [0, 1]) {
    for (const l of [0, 1]) {
      const cellMean = getTwoWayMean('tutor', t, 'learner', l);
      const expected = (t === 1 ? meanT1 : meanT0) + (l === 1 ? meanL1 : meanL0) - grandMean;
      const cellN = getByFactors(0, t, l).length + getByFactors(1, t, l).length;
      SS_TL += cellN * (cellMean - expected) ** 2;
    }
  }

  // Three-way interaction
  let SS_cells = 0;
  for (const r of [0, 1]) {
    for (const t of [0, 1]) {
      for (const l of [0, 1]) {
        const cellData = getByFactors(r, t, l);
        if (cellData.length > 0) {
          const cellMean = cellData.reduce((a, b) => a + b, 0) / cellData.length;
          SS_cells += cellData.length * (cellMean - grandMean) ** 2;
        }
      }
    }
  }
  const SS_RTL = Math.max(0, SS_cells - SS_R - SS_T - SS_L - SS_RT - SS_RL - SS_TL);

  // Error SS (within cells)
  let SS_E = 0;
  for (const r of [0, 1]) {
    for (const t of [0, 1]) {
      for (const l of [0, 1]) {
        const cellData = getByFactors(r, t, l);
        if (cellData.length > 0) {
          const cellMean = cellData.reduce((a, b) => a + b, 0) / cellData.length;
          SS_E += cellData.reduce((acc, x) => acc + (x - cellMean) ** 2, 0);
        }
      }
    }
  }

  // Degrees of freedom
  const df_R = 1,
    df_T = 1,
    df_L = 1;
  const df_RT = 1,
    df_RL = 1,
    df_TL = 1;
  const df_RTL = 1;
  const df_E = N - 8;
  const df_T_total = N - 1;

  // Mean Squares
  const MS_R = SS_R / df_R;
  const MS_T = SS_T / df_T;
  const MS_L = SS_L / df_L;
  const MS_RT = SS_RT / df_RT;
  const MS_RL = SS_RL / df_RL;
  const MS_TL = SS_TL / df_TL;
  const MS_RTL = SS_RTL / df_RTL;
  const MS_E = df_E > 0 ? SS_E / df_E : 1;

  // F ratios
  const F_R = MS_R / MS_E;
  const F_T = MS_T / MS_E;
  const F_L = MS_L / MS_E;
  const F_RT = MS_RT / MS_E;
  const F_RL = MS_RL / MS_E;
  const F_TL = MS_TL / MS_E;
  const F_RTL = MS_RTL / MS_E;

  // Compute p-values from the F distribution CDF
  const getP = (F, df1, df2) => fDistPValue(F, df1, df2);

  const etaSq = (SS) => (SST > 0 ? SS / SST : 0);

  return {
    grandMean,
    N,
    marginalMeans: {
      recognition: { standard: meanR0, recognition: meanR1 },
      tutor: { single: meanT0, multi: meanT1 },
      learner: { unified: meanL0, ego_superego: meanL1 },
    },
    mainEffects: {
      recognition: { SS: SS_R, df: df_R, MS: MS_R, F: F_R, p: getP(F_R, df_R, df_E), etaSq: etaSq(SS_R) },
      tutor: { SS: SS_T, df: df_T, MS: MS_T, F: F_T, p: getP(F_T, df_T, df_E), etaSq: etaSq(SS_T) },
      learner: { SS: SS_L, df: df_L, MS: MS_L, F: F_L, p: getP(F_L, df_L, df_E), etaSq: etaSq(SS_L) },
    },
    interactions: {
      recognition_x_tutor: {
        SS: SS_RT,
        df: df_RT,
        MS: MS_RT,
        F: F_RT,
        p: getP(F_RT, df_RT, df_E),
        etaSq: etaSq(SS_RT),
      },
      recognition_x_learner: {
        SS: SS_RL,
        df: df_RL,
        MS: MS_RL,
        F: F_RL,
        p: getP(F_RL, df_RL, df_E),
        etaSq: etaSq(SS_RL),
      },
      tutor_x_learner: { SS: SS_TL, df: df_TL, MS: MS_TL, F: F_TL, p: getP(F_TL, df_TL, df_E), etaSq: etaSq(SS_TL) },
      three_way: { SS: SS_RTL, df: df_RTL, MS: MS_RTL, F: F_RTL, p: getP(F_RTL, df_RTL, df_E), etaSq: etaSq(SS_RTL) },
    },
    error: { SS: SS_E, df: df_E, MS: MS_E },
    total: { SS: SST, df: df_T_total },
  };
}

/**
 * Convert profile factor tags to ANOVA cell keys.
 *
 * @param {Object} factors - { recognition: bool, multi_agent_tutor: bool, multi_agent_learner: bool }
 * @returns {string} Cell key like "r0_t1_l0"
 */
export function factorsToCellKey(factors) {
  const r = factors.recognition ? 1 : 0;
  const t = factors.multi_agent_tutor ? 1 : 0;
  const l = factors.multi_agent_learner ? 1 : 0;
  return `r${r}_t${t}_l${l}`;
}

/**
 * Format ANOVA results as a text report.
 *
 * @param {Object} anovaResults - Output of runThreeWayANOVA()
 * @param {Object} [options] - Formatting options
 * @param {string} [options.scoreLabel] - Label for the score type (e.g. "Base Score", "Recognition Score")
 * @returns {string} Formatted report
 */
export function formatANOVAReport(anovaResults, options = {}) {
  const { scoreLabel } = options;

  if (typeof anovaResults.error === 'string') {
    return `ANOVA Error: ${anovaResults.error}`;
  }

  const lines = [];
  const title = scoreLabel
    ? `THREE-WAY ANOVA: ${scoreLabel.toUpperCase()}`
    : 'THREE-WAY ANOVA: 2x2x2 FACTORIAL ANALYSIS';

  lines.push('');
  lines.push('='.repeat(70));
  lines.push(`  ${title}`);
  lines.push('='.repeat(70));
  lines.push(`  Grand Mean: ${anovaResults.grandMean.toFixed(2)}  |  N = ${anovaResults.N}`);
  lines.push('');

  // Marginal means
  const mm = anovaResults.marginalMeans;
  lines.push('-'.repeat(70));
  lines.push('  MARGINAL MEANS');
  lines.push('-'.repeat(70));
  lines.push(
    `  Recognition:   Standard = ${mm.recognition.standard.toFixed(2)},  Recognition = ${mm.recognition.recognition.toFixed(2)}`,
  );
  lines.push(`  Tutor:         Single = ${mm.tutor.single.toFixed(2)},  Multi-Agent = ${mm.tutor.multi.toFixed(2)}`);
  lines.push(
    `  Learner:       Unified = ${mm.learner.unified.toFixed(2)},  Ego/Superego = ${mm.learner.ego_superego.toFixed(2)}`,
  );
  lines.push('');

  // ANOVA table
  lines.push('-'.repeat(70));
  lines.push('  ANOVA TABLE');
  lines.push('-'.repeat(70));
  lines.push('  Source                    SS       df       MS        F        p       eta2');
  lines.push('  ' + '-'.repeat(66));

  const formatRow = (name, data) => {
    const ss = data.SS.toFixed(2).padStart(8);
    const df = data.df.toString().padStart(6);
    const ms = data.MS.toFixed(2).padStart(8);
    const f = data.F.toFixed(3).padStart(8);
    const p = data.p < 0.001 ? '< .001' : data.p.toFixed(3);
    const eta = data.etaSq.toFixed(3).padStart(6);
    const sig = data.p < 0.05 ? '***' : data.p < 0.1 ? '*' : '';
    return `  ${name.padEnd(22)}  ${ss}  ${df}  ${ms}  ${f}  ${p.padStart(8)}  ${eta}  ${sig}`;
  };

  const me = anovaResults.mainEffects;
  const ia = anovaResults.interactions;

  lines.push(formatRow('Recognition (A)', me.recognition));
  lines.push(formatRow('Tutor Architecture (B)', me.tutor));
  lines.push(formatRow('Learner Arch. (C)', me.learner));
  lines.push('  ' + '-'.repeat(66));
  lines.push(formatRow('A x B', ia.recognition_x_tutor));
  lines.push(formatRow('A x C', ia.recognition_x_learner));
  lines.push(formatRow('B x C', ia.tutor_x_learner));
  lines.push(formatRow('A x B x C', ia.three_way));
  lines.push('  ' + '-'.repeat(66));

  const err = anovaResults.error;
  lines.push(
    `  ${'Error'.padEnd(22)}  ${err.SS.toFixed(2).padStart(8)}  ${err.df.toString().padStart(6)}  ${err.MS.toFixed(2).padStart(8)}`,
  );
  lines.push('');
  lines.push('  Significance: *** p < .05, * p < .10');
  lines.push('');

  // Interpretation
  lines.push('-'.repeat(70));
  lines.push('  INTERPRETATION');
  lines.push('-'.repeat(70));

  const formatP = (p) => (p < 0.001 ? '< .001' : `= .${p.toFixed(3).slice(2)}`);

  if (me.recognition.p < 0.05) {
    const effect = mm.recognition.recognition - mm.recognition.standard;
    lines.push(
      `  * Recognition prompts: SIGNIFICANT (F = ${me.recognition.F.toFixed(2)}, p ${formatP(me.recognition.p)})`,
    );
    lines.push(
      `    Effect: ${effect >= 0 ? '+' : ''}${effect.toFixed(2)} points, eta2 = ${me.recognition.etaSq.toFixed(3)}`,
    );
  } else {
    lines.push(
      `  - Recognition prompts: not significant (F = ${me.recognition.F.toFixed(2)}, p ${formatP(me.recognition.p)})`,
    );
  }

  if (me.tutor.p < 0.05) {
    const effect = mm.tutor.multi - mm.tutor.single;
    lines.push(`  * Multi-agent tutor: SIGNIFICANT (F = ${me.tutor.F.toFixed(2)}, p ${formatP(me.tutor.p)})`);
    lines.push(`    Effect: ${effect >= 0 ? '+' : ''}${effect.toFixed(2)} points, eta2 = ${me.tutor.etaSq.toFixed(3)}`);
  } else {
    lines.push(`  - Multi-agent tutor: not significant (F = ${me.tutor.F.toFixed(2)}, p ${formatP(me.tutor.p)})`);
  }

  if (me.learner.p < 0.05) {
    const effect = mm.learner.ego_superego - mm.learner.unified;
    lines.push(`  * Multi-agent learner: SIGNIFICANT (F = ${me.learner.F.toFixed(2)}, p ${formatP(me.learner.p)})`);
    lines.push(
      `    Effect: ${effect >= 0 ? '+' : ''}${effect.toFixed(2)} points, eta2 = ${me.learner.etaSq.toFixed(3)}`,
    );
  } else {
    lines.push(`  - Multi-agent learner: not significant (F = ${me.learner.F.toFixed(2)}, p ${formatP(me.learner.p)})`);
  }

  // Interactions
  lines.push('');
  const interactions = [
    { key: 'recognition_x_tutor', label: 'Recognition x Tutor' },
    { key: 'recognition_x_learner', label: 'Recognition x Learner' },
    { key: 'tutor_x_learner', label: 'Tutor x Learner' },
    { key: 'three_way', label: 'Three-way' },
  ];
  for (const { key, label } of interactions) {
    if (ia[key].p < 0.05) {
      lines.push(`  * ${label} interaction: SIGNIFICANT (F = ${ia[key].F.toFixed(2)}, p ${formatP(ia[key].p)})`);
    }
  }

  lines.push('');
  lines.push('='.repeat(70));

  return lines.join('\n');
}

export default {
  runThreeWayANOVA,
  factorsToCellKey,
  formatANOVAReport,
};
