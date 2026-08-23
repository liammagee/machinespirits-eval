#!/usr/bin/env node
// Power for the v8 boredom design, on the test v8 registers.
//
// v8 asks a different question from v6 and v7. Those compared two tutor moves,
// both of them matched to a bored learner, and both returned rates near 0.46.
// v8 compares making a move against making none: the reference tutor carries on
// with the proof and says nothing about the learner at all. So one rate is
// measured and the other has never been measured by anything.
//
// The treatment rate is fixed at what v7 measured for the same move on the same
// window, 21 of 41. The reference rate is scanned, because there is no prior
// for it. Reading the table needs both numbers held in mind: the study is well
// powered if carrying on recovers a quarter of bored learners and badly powered
// if it recovers four in ten.
//
// The blocked test's two arms are still named plainN and warmN inside a block.
// That is a leftover from v4 and v5, when the contrast was manner. The function
// reads them as reference and treatment whatever the contrast is called, and
// renaming them would move bytes the v4 to v7 reports are pinned to.
//
// Everything here is pure computation. No model call, no database read, no
// production write.

import {
  exactBlockedScoreOneSidedPValue,
  exactBlockedScorePValue,
} from '../services/tutorStubBoredomActionRegisterProofDagPreflight.js';

// v7's five-turn recovery count for ask_discriminating_question: 21 of 41
// scored units, pooled over both manners. v7 passed every gate it could pass
// and is a clean registered null, so this rate may be quoted.
const V7_ASK_QUESTION_RATE = 21 / 41;

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
// What carrying on might recover. 0.51 is the treatment rate itself, which is
// the no-difference case and should come out near alpha.
const REFERENCE_RATES = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.51];
// Sizes the programme safeguard can still pay for. The ledger stands at 4684
// after v7, the per-dialogue never-exceed figure is 123, and the safeguard is
// 15000, so 83 dialogues is the arithmetic limit and 72 is the largest size
// that divides evenly into six worlds and four move-and-manner cells.
const SIZES = [5, 6, 7, 8];

console.log(`blocked exact conditional score test, ${WORLDS} worlds, alpha 0.05`);
console.log(`treatment fixed at v7's measured ask-a-question rate ${V7_ASK_QUESTION_RATE.toFixed(3)}`);
console.log(`estimated from ${DRAWS} draws per cell\n`);

console.log('reference rate is what carrying on with the proof might recover\n');
const header = SIZES.map((perArm) => `${String(perArm * WORLDS * 2).padStart(3)} dlg`).join('  ');
console.log(`  carry-on rate | difference | ${header}`);
console.log(`  ${''.padEnd(14, '-')}|${''.padEnd(12, '-')}|${''.padEnd(SIZES.length * 9, '-')}`);

for (const reference of REFERENCE_RATES) {
  const cells = SIZES.map((perArm) => {
    const value = power({
      perArmPerWorld: perArm,
      worlds: WORLDS,
      referenceRate: reference,
      treatmentRate: V7_ASK_QUESTION_RATE,
      sided: 'one',
      draws: DRAWS,
      seed: 8000 + perArm * 13 + Math.round(reference * 100),
    });
    return ` ${value.toFixed(3)}`.padStart(9);
  });
  const difference = V7_ASK_QUESTION_RATE - reference;
  console.log(`  ${reference.toFixed(2).padStart(13)} | ${difference.toFixed(3).padStart(10)} |${cells.join('')}`);
}

console.log('\ntwo-sided, at the chosen size, for the record\n');
for (const reference of REFERENCE_RATES) {
  const value = power({
    perArmPerWorld: 6,
    worlds: WORLDS,
    referenceRate: reference,
    treatmentRate: V7_ASK_QUESTION_RATE,
    sided: 'two',
    draws: DRAWS,
    seed: 9000 + Math.round(reference * 100),
  });
  console.log(`  carry-on ${reference.toFixed(2)}   72 dialogues   two-sided ${value.toFixed(3)}`);
}
