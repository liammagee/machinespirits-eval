#!/usr/bin/env node
// Power for the v7 boredom design, on the test v7 actually registers.
//
// The repo's exact power enumerator walks every state the blocked design can
// reach. That is fine at three units per move per world, which is what v4 to v6
// ran, and it runs out of memory at six. v7 runs seven. So the power here is
// estimated by drawing outcomes and running the real test on each draw, rather
// than by enumerating. The test is the same function the analyzer calls; only
// the way its rejection rate is counted differs.
//
// Everything here is pure computation. No model call, no database read, no
// production write.

import {
  exactBlockedScoreOneSidedPValue,
  exactBlockedScorePValue,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';

// v6's five-turn recovery counts, which are what a later design is sized on.
// v6 failed its own interpretability gate, so these may not be reported as a
// finding. Sizing a later study is the use v6's registration named for them.
const V6_REFERENCE_RATE = 8 / 18; // ask a discriminating question
const V6_TREATMENT_RATE = 14 / 18; // simplify to one workable step

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

function drawSuccesses(n, rate, rng) {
  let count = 0;
  for (let i = 0; i < n; i += 1) if (rng() < rate) count += 1;
  return count;
}

function power({ perArmPerWorld, worlds, referenceRate, treatmentRate, sided, draws, seed }) {
  const rng = makeRng(seed);
  const cache = new Map();
  let rejects = 0;
  for (let draw = 0; draw < draws; draw += 1) {
    const blocks = Array.from({ length: worlds }, () => ({
      plainN: perArmPerWorld,
      warmN: perArmPerWorld,
      plainSuccesses: drawSuccesses(perArmPerWorld, referenceRate, rng),
      warmSuccesses: drawSuccesses(perArmPerWorld, treatmentRate, rng),
    }));
    const p =
      sided === 'one'
        ? exactBlockedScoreOneSidedPValue(blocks, { distributionCache: cache })
        : exactBlockedScorePValue(blocks, { distributionCache: cache });
    if (p <= 0.05) rejects += 1;
  }
  return rejects / draws;
}

const DRAWS = 3000;
const WORLDS = 6;
// v6 measured 0.44 against 0.78 from 18 units per move. A first measured gap
// runs high, so the design is sized on a smaller one and the observed gap is
// shown beside it rather than planned on.
const SCENARIOS = [
  { label: 'v6 gap as observed        0.44 vs 0.78', treatment: V6_TREATMENT_RATE },
  {
    label: 'gap cut by a third        0.44 vs 0.67',
    treatment: V6_REFERENCE_RATE + (V6_TREATMENT_RATE - V6_REFERENCE_RATE) * 0.67,
  },
  {
    label: 'gap cut by a half         0.44 vs 0.61',
    treatment: V6_REFERENCE_RATE + (V6_TREATMENT_RATE - V6_REFERENCE_RATE) * 0.5,
  },
];

console.log(`blocked exact conditional score test, ${WORLDS} worlds, alpha 0.05`);
console.log(`estimated from ${DRAWS} draws per cell\n`);

for (const scenario of SCENARIOS) {
  console.log(`${scenario.label}   [treatment rate ${scenario.treatment.toFixed(3)}]`);
  for (const perArm of [3, 6, 7, 8]) {
    const cells = ['one', 'two'].map((sided) => {
      const value = power({
        perArmPerWorld: perArm,
        worlds: WORLDS,
        referenceRate: V6_REFERENCE_RATE,
        treatmentRate: scenario.treatment,
        sided,
        draws: DRAWS,
        seed: 7000 + perArm * 13 + (sided === 'one' ? 1 : 2),
      });
      return `${sided}-sided ${value.toFixed(3)}`;
    });
    console.log(
      `  ${perArm} per move per world (${perArm * WORLDS} per move, ${perArm * WORLDS * 2} dialogues)   ${cells.join('   ')}`,
    );
  }
  console.log('');
}
