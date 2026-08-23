#!/usr/bin/env node
// Size the v7 boredom design from the v6 turn-by-turn data.
//
// v6 is a spent screening run that failed its interpretability gate. Its
// numbers may not be reported as a finding. Using them to size a later study
// is a different use, and it is the use v6's own registration named:
// "The five-turn rate this run produces is the number a larger design would
// be sized on."
//
// Everything here is pure computation. No model call, no database read, no
// production write.

const V6 = {
  // first turn on which recovery was seen, or null for no recovery in 5 turns
  ask_question: { byTurn: { 1: 3, 3: 2, 4: 3 }, censored: 10, n: 18 },
  shrink_step: { byTurn: { 1: 2, 2: 5, 3: 3, 4: 3, 5: 1 }, censored: 4, n: 18 },
};

const HORIZON = 5;

// ---------------------------------------------------------------- utilities

function makeRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hazardsFromCounts({ byTurn, censored, n }) {
  // Discrete hazard: of those still un-recovered entering turn t, what share
  // recover on t. Read straight off the v6 counts.
  const h = [];
  let atRisk = n;
  for (let t = 1; t <= HORIZON; t += 1) {
    const events = byTurn[t] || 0;
    h.push(atRisk > 0 ? events / atRisk : 0);
    atRisk -= events;
  }
  return { hazards: h, leftover: atRisk, censored };
}

function drawTurn(hazards, rng) {
  for (let t = 1; t <= HORIZON; t += 1) {
    if (rng() < hazards[t - 1]) return t;
  }
  return null; // no recovery inside the horizon
}

// Fisher exact test on a 2x2, returning the p-value.
function logFactorial(n, cache) {
  if (cache[n] !== undefined) return cache[n];
  let v = 0;
  for (let i = 2; i <= n; i += 1) v += Math.log(i);
  cache[n] = v;
  return v;
}

function fisher(a, b, c, d, sided, lf) {
  // table [[a,b],[c,d]] ; a = reference successes, c = treatment successes
  const n = a + b + c + d;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const c2 = b + d;
  const base = lf(r1) + lf(r2) + lf(c1) + lf(c2) - lf(n);
  const prob = (x) => {
    const y = r1 - x;
    const z = c1 - x;
    const w = r2 - z;
    if (y < 0 || z < 0 || w < 0) return 0;
    return Math.exp(base - lf(x) - lf(y) - lf(z) - lf(w));
  };
  const observed = prob(a);
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  let p = 0;
  for (let x = lo; x <= hi; x += 1) {
    const px = prob(x);
    if (sided === 'two') {
      if (px <= observed * (1 + 1e-9)) p += px;
    } else if (x <= a + 1e-9) {
      // one-sided: treatment better than reference means FEWER reference
      // successes than expected, so the tail runs down from the observed a
      p += px;
    }
  }
  return Math.min(1, p);
}

// Permutation test on mean recovery turn with non-recoverers ranked last.
// This is the graded reading: recovering on turn 1 beats recovering on turn 5,
// and both beat not recovering at all.
function rankScore(turn) {
  return turn === null ? HORIZON + 1 : turn;
}

function permutationP(refScores, trtScores, rng, draws) {
  const all = refScores.concat(trtScores);
  const nRef = refScores.length;
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const observed = mean(refScores) - mean(trtScores); // positive favours treatment
  let hits = 0;
  for (let i = 0; i < draws; i += 1) {
    const shuffled = all.slice();
    for (let j = shuffled.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rng() * (j + 1));
      const tmp = shuffled[j];
      shuffled[j] = shuffled[k];
      shuffled[k] = tmp;
    }
    const a = shuffled.slice(0, nRef);
    const b = shuffled.slice(nRef);
    if (mean(a) - mean(b) >= observed - 1e-12) hits += 1;
  }
  return (hits + 1) / (draws + 1); // one-sided
}

// McNemar exact on paired binary outcomes.
function mcnemarP(b, c, sided, lf) {
  // b = reference recovered & treatment did not, c = the other way round
  const n = b + c;
  if (n === 0) return 1;
  const pk = (k) => Math.exp(lf(n) - lf(k) - lf(n - k) - n * Math.log(2));
  let p = 0;
  for (let k = 0; k <= b; k += 1) p += pk(k);
  if (sided === 'two') p = Math.min(1, 2 * p);
  return Math.min(1, p);
}

// ---------------------------------------------------------------- scenarios

const lfCache = [];
const lf = (n) => logFactorial(n, lfCache);

function shrinkHazards(hazards, factor) {
  // Pull the treatment hazards toward the reference by `factor`.
  // factor 0 keeps v6's observed gap, factor 1 removes it entirely.
  const ref = hazardsFromCounts(V6.ask_question).hazards;
  return hazards.map((h, i) => h + (ref[i] - h) * factor);
}

function simulate({ nPerMove, sided, test, shrink, paired, rho, draws, seed }) {
  const rng = makeRng(seed);
  const refH = hazardsFromCounts(V6.ask_question).hazards;
  const trtH = shrinkHazards(hazardsFromCounts(V6.shrink_step).hazards, shrink);
  let rejects = 0;
  for (let rep = 0; rep < draws; rep += 1) {
    const refTurns = [];
    const trtTurns = [];
    for (let i = 0; i < nPerMove; i += 1) {
      if (paired) {
        // shared prefix: with probability rho the pair shares one draw of the
        // underlying "how ready is this learner" variable, which makes the two
        // outcomes agree more often.
        const shared = rng();
        const useShared = rng() < rho;
        const r1 = useShared ? shared : rng();
        const r2 = useShared ? shared : rng();
        refTurns.push(drawTurnFrom(refH, r1));
        trtTurns.push(drawTurnFrom(trtH, r2));
      } else {
        refTurns.push(drawTurn(refH, rng));
        trtTurns.push(drawTurn(trtH, rng));
      }
    }
    let p;
    if (test === 'binary' && !paired) {
      const a = refTurns.filter((t) => t !== null).length;
      const c = trtTurns.filter((t) => t !== null).length;
      p = fisher(a, nPerMove - a, c, nPerMove - c, sided, lf);
    } else if (test === 'binary' && paired) {
      let b = 0;
      let cc = 0;
      for (let i = 0; i < nPerMove; i += 1) {
        const rOk = refTurns[i] !== null;
        const tOk = trtTurns[i] !== null;
        if (rOk && !tOk) b += 1;
        if (!rOk && tOk) cc += 1;
      }
      p = mcnemarP(b, cc, sided, lf);
    } else {
      p = permutationP(refTurns.map(rankScore), trtTurns.map(rankScore), rng, 400);
    }
    if (p <= 0.05) rejects += 1;
  }
  return rejects / draws;
}

// Draw a turn from a single uniform value, so a shared value makes a pair agree.
function drawTurnFrom(hazards, u) {
  let survive = 1;
  for (let t = 1; t <= HORIZON; t += 1) {
    const before = survive;
    survive *= 1 - hazards[t - 1];
    if (u >= survive && u < before) return t;
  }
  return null;
}

// ---------------------------------------------------------------- report

const refH = hazardsFromCounts(V6.ask_question);
const trtH = hazardsFromCounts(V6.shrink_step);
const cum = (h) => {
  let s = 1;
  for (const x of h) s *= 1 - x;
  return 1 - s;
};

console.log('v6 observed, five-turn window');
console.log(`  ask a discriminating question   ${18 - refH.censored}/18 = ${cum(refH.hazards).toFixed(3)}`);
console.log(`  simplify to one workable step   ${18 - trtH.censored}/18 = ${cum(trtH.hazards).toFixed(3)}`);
console.log('');

const DRAWS = 4000;
const shrinkages = [
  { label: 'v6 gap as observed (0.44 vs 0.78)', shrink: 0 },
  { label: 'gap cut by a third   (0.44 vs 0.68)', shrink: 0.33 },
  { label: 'gap cut by a half    (0.44 vs 0.62)', shrink: 0.5 },
];

for (const sc of shrinkages) {
  const trt = shrinkHazards(trtH.hazards, sc.shrink);
  console.log(`${sc.label}  [treatment rate ${cum(trt).toFixed(3)}]`);
  for (const n of [18, 24, 30, 40]) {
    const row = [];
    row.push(
      `binary two-sided ${simulate({ nPerMove: n, sided: 'two', test: 'binary', shrink: sc.shrink, paired: false, draws: DRAWS, seed: 1000 + n }).toFixed(2)}`,
    );
    row.push(
      `binary one-sided ${simulate({ nPerMove: n, sided: 'one', test: 'binary', shrink: sc.shrink, paired: false, draws: DRAWS, seed: 2000 + n }).toFixed(2)}`,
    );
    row.push(
      `turn-graded one-sided ${simulate({ nPerMove: n, sided: 'one', test: 'graded', shrink: sc.shrink, paired: false, draws: 1200, seed: 3000 + n }).toFixed(2)}`,
    );
    console.log(`  n=${n}/move   ${row.join('   ')}`);
  }
  console.log('');
}

console.log('paired on a shared prefix against independent units, binary, one-sided');
console.log('(n pairs = n per move = 2n dialogues, so the cost is the same either way)');
for (const sc of shrinkages) {
  console.log(`${sc.label}`);
  for (const n of [30, 40, 50]) {
    const unpaired = simulate({
      nPerMove: n,
      sided: 'one',
      test: 'binary',
      shrink: sc.shrink,
      paired: false,
      draws: DRAWS,
      seed: 5000 + n,
    });
    const cells = [`independent ${unpaired.toFixed(2)}`];
    for (const rho of [0.3, 0.6]) {
      const paired = simulate({
        nPerMove: n,
        sided: 'one',
        test: 'binary',
        shrink: sc.shrink,
        paired: true,
        rho,
        draws: DRAWS,
        seed: 4000 + n + rho * 100,
      });
      cells.push(`paired@${rho} ${paired.toFixed(2)}`);
    }
    console.log(`  n=${n}   ${cells.join('   ')}`);
  }
  console.log('');
}
