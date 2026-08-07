// Two-sided Fisher exact test on a 2x2 table.
//
// Extracted from scripts/analyze-sarcasm-determinate-gate-decomposition.js so
// the register/stance reports on this arc cannot drift into disagreeing
// statistics. Counts here are small (tens of rows), so the exact test is both
// affordable and correct where chi-square is not.

function logFactorial(n) {
  let total = 0;
  for (let i = 2; i <= n; i += 1) total += Math.log(i);
  return total;
}

/**
 * Two-sided Fisher exact test, computed by summing every table with the same
 * margins whose probability is no greater than the observed table's.
 *
 * @param {number} a successes in group 1
 * @param {number} b failures in group 1
 * @param {number} c successes in group 2
 * @param {number} d failures in group 2
 * @returns {number|null} the p-value, or null for an empty table
 */
export function fisherExactTwoSided(a, b, c, d) {
  const n = a + b + c + d;
  if (!n) return null;
  const tableProb = (w, x, y, z) =>
    Math.exp(
      logFactorial(w + x) +
        logFactorial(y + z) +
        logFactorial(w + y) +
        logFactorial(x + z) -
        logFactorial(n) -
        logFactorial(w) -
        logFactorial(x) -
        logFactorial(y) -
        logFactorial(z),
    );
  const observed = tableProb(a, b, c, d);
  let total = 0;
  for (let i = 0; i <= Math.min(a + b, a + c); i += 1) {
    const j = a + b - i;
    const k = a + c - i;
    const l = n - i - j - k;
    if (j < 0 || k < 0 || l < 0) continue;
    const prob = tableProb(i, j, k, l);
    if (prob <= observed + 1e-12) total += prob;
  }
  return Math.min(1, total);
}

export default { fisherExactTwoSided };
