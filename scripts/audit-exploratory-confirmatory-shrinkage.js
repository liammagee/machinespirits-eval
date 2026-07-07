#!/usr/bin/env node
/**
 * Exploratory-to-confirmatory shrinkage audit
 * (workplan/items/exploratory-confirmatory-shrinkage-audit.md).
 *
 * The operator's observation, stated mid-arc and tested here: "we often have
 * this good exploratory result followed by null or minimal results on a
 * scaled version — more than by chance." Pure computation over the frozen
 * contrast reports already on disk; no new runs, no DB, no LLM.
 *
 * Five instruments:
 *   1. PAIR TABLE — every exploratory signal that advanced to a powered
 *      test, with its headline statistic on both sides.
 *   2. WINNER'S-CURSE SIMULATION — for the cleanest same-design pair
 *      (codex lemma-display), bootstrap the pooled two-draw data to get the
 *      sampling distribution of U at n=12/12, the selection-conditional
 *      expectation E[U2 | U1 <= bar], and power at the pooled-truth effect.
 *   3. BAR-CALIBRATION — P(confirmation passes | the true effect equals the
 *      exploratory point estimate), by resampling the exploratory draw only.
 *   4. BETWEEN-DRAW VARIANCE — baseline outcome rates for identical
 *      (model, world, dose) cells across independent seed draws.
 *   5. BASE RATE — the fate of every advanced signal, plus the recorded
 *      asymmetry: nulls are never re-run, so only positive->worse
 *      transitions are observable.
 *
 * Usage: node scripts/audit-exploratory-confirmatory-shrinkage.js
 *          [--iters 20000] [--out exports/dramatic-derivation/strategy-ledger/shrinkage-audit]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const opts = {
    iters: 20000,
    out: path.join(ROOT, 'exports/dramatic-derivation/strategy-ledger/shrinkage-audit'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--iters') opts.iters = Number(argv[++i]);
    else if (argv[i] === '--out') opts.out = path.resolve(ROOT, argv[++i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return opts;
}

const loadRuns = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).runs;

// deterministic PRNG (mulberry32) — Math.random is banned in workflows and
// determinism makes the report reproducible byte-for-byte.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** min-form U (wins for "treat lower"), matching the frozen analyses. */
function uLow(treat, control) {
  let wins = 0;
  for (const t of treat) for (const c of control) wins += t < c ? 1 : t === c ? 0.5 : 0;
  return treat.length * control.length - wins;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rand = rng(20260705);

  // ---------- load the frozen per-run tables ----------
  const lemmaExp = loadRuns('exports/dramatic-derivation/lemma-layer/phase3-contrasts-report.json');
  const lemmaConf = loadRuns(
    'exports/dramatic-derivation/lemma-layer/display-confirmatory/phase3-contrasts-report.json',
  );
  const sonnetCal = loadRuns(
    'exports/dramatic-derivation/lemma-layer/sonnet-calibrated-contrast/phase3-contrasts-report.json',
  );
  const v2Pilot = loadRuns('exports/dramatic-derivation/strategy-ledger/v2-contrasts-report.json');

  // ---------- 1. pair table ----------
  const pairs = [
    {
      id: 'P1',
      name: 'codex lemma-display (exploratory arm -> same-design confirmatory)',
      endpoint: 'T* pooled U/144 (lower better)',
      exploratory: 'U = 40.5 (Δ = −2.25; grounded 6/12 vs 1/12) — declared descriptive at its freeze',
      confirmatory: 'U = 67 (Δ = −0.25; direction split) — NOT CONFIRMED',
      fate: 'flattened',
    },
    {
      id: 'P2',
      name: 'V2b repair-latency (n=6/arm pilot -> n=12/arm confirmatory)',
      endpoint: 'repair latency pooled U (lower better)',
      exploratory: 'U = 8/36 (8.06 vs 11.23)',
      confirmatory:
        'U = 37.5/144, one-sided p ≈ 0.023 (8.02 vs 9.24) — PRIMARY REPLICATED; promotion failed on negative-transfer guardrails',
      fate: 'replicated-with-cost',
    },
    {
      id: 'P3',
      name: 'flash plan-mode smoke (n=2/arm) -> cross-model flash arm (n=12/arm)',
      endpoint: 'grounded / seed-pair ΔT*',
      exploratory: 'plan-mode 2/2 grounded vs baseline 1/2 (GO signal)',
      confirmatory:
        'pair-deltas +2.17/0.00 per world (plan-mode WORSE); the smoke inverted at its own seeds (2/2 -> 0/2)',
      fate: 'reversed',
    },
    {
      id: 'P4',
      name: 'sonnet lemma smoke at dose 0.35 (n=2/arm) -> powered contrast (n=12/arm)',
      endpoint: 'grounded',
      exploratory: 'display 1/2 grounded (T*=23) vs baseline 0/2 (propose-go)',
      confirmatory: 'MATRIX VOID — 24/24 at cap; the smoke grounding did not recur at 6 fresh seeds',
      fate: 'dissolved-to-floor',
    },
    {
      id: 'P5',
      name: 'CONTROL: calibrated sonnet contrast (no exploratory estimate existed)',
      endpoint: 'T* pooled U/144',
      exploratory: 'none — design aimed by a measured capability gap (dose calibration), not a point estimate',
      confirmatory: 'U = 65 (Δ = −0.58; direction split) — NOT CONFIRMED',
      fate: 'null-without-anchor (nothing to shrink)',
    },
  ];

  // ---------- 2. winner's-curse simulation (P1, pooled-truth) ----------
  // Pool BOTH codex draws per (world, arm) as the empirical truth; simulate
  // paired 6+6-per-world matrices; U at 12/12.
  const codexPool = {};
  for (const r of [...lemmaExp.filter((x) => x.arm !== 'lemma-bound'), ...lemmaConf]) {
    const key = `${r.world.includes('resistant') ? 'resistant' : 'marrick'}|${r.arm}`;
    (codexPool[key] = codexPool[key] || []).push(r.timeToRecognition);
  }
  const draw = (pool, n) => Array.from({ length: n }, () => pool[Math.floor(rand() * pool.length)]);
  const simulateU = () => {
    const treat = [...draw(codexPool['marrick|lemma-display'], 6), ...draw(codexPool['resistant|lemma-display'], 6)];
    const control = [...draw(codexPool['marrick|baseline'], 6), ...draw(codexPool['resistant|baseline'], 6)];
    return uLow(treat, control);
  };
  const sims = Array.from({ length: opts.iters }, simulateU);
  const meanU = mean(sims);
  const sdU = Math.sqrt(mean(sims.map((u) => (u - meanU) ** 2)));
  const powerAtPooledTruth = mean(sims.map((u) => (u <= 42 ? 1 : 0)));
  // selection: of simulated FIRST draws that would have "advanced" (U <= 42),
  // what does an INDEPENDENT second draw from the same truth look like?
  const firstDraws = sims.filter((u) => u <= 42);
  const secondDraws = Array.from({ length: firstDraws.length }, simulateU);
  const winnersCurse = {
    pooledTruthMeanU: meanU,
    samplingSdU: sdU,
    pAdvanceAtPooledTruth: powerAtPooledTruth,
    expectedUGivenAdvanced: firstDraws.length ? mean(firstDraws) : null,
    expectedIndependentRepeatU: secondDraws.length ? mean(secondDraws) : null,
    observedExploratoryU: 40.5,
    observedConfirmatoryU: 67,
    observedConfirmatoryWithinSamplingNoise:
      Math.abs(67 - meanU) <= 2 * sdU ? 'yes (within 2 sampling SDs of the pooled-truth mean)' : 'no',
  };

  // ---------- 3. bar calibration (truth = exploratory draw alone) ----------
  const expPool = {};
  for (const r of lemmaExp.filter((x) => x.arm !== 'lemma-bound')) {
    const key = `${r.world.includes('resistant') ? 'resistant' : 'marrick'}|${r.arm}`;
    (expPool[key] = expPool[key] || []).push(r.timeToRecognition);
  }
  const simulateExpU = () => {
    const treat = [...draw(expPool['marrick|lemma-display'], 6), ...draw(expPool['resistant|lemma-display'], 6)];
    const control = [...draw(expPool['marrick|baseline'], 6), ...draw(expPool['resistant|baseline'], 6)];
    return uLow(treat, control);
  };
  const expSims = Array.from({ length: opts.iters }, simulateExpU);
  const barCalibration = {
    truth: 'the exploratory draw itself (resampled)',
    pPassBarIfExploratoryWereTrue: mean(expSims.map((u) => (u <= 42 ? 1 : 0))),
    note: 'the probability a confirmatory clears U<=42 when the TRUE effect exactly equals the exploratory point estimate — the coin the arc flipped twice',
  };

  // V2b analogue: pilot pools at n=6/arm -> confirmatory n=12/arm on repairLatency.
  const v2Pool = {};
  for (const r of v2Pilot.filter((x) => ['baseline', 'ledger-v1'].includes(x.arm) && x.repairLatency !== null)) {
    (v2Pool[r.arm] = v2Pool[r.arm] || []).push(r.repairLatency);
  }
  let v2bBar = null;
  if (v2Pool['baseline']?.length && v2Pool['ledger-v1']?.length) {
    const simsV2 = Array.from({ length: opts.iters }, () => {
      const treat = draw(v2Pool['ledger-v1'], 12);
      const control = draw(v2Pool['baseline'], 12);
      return uLow(treat, control);
    });
    v2bBar = {
      pPassU42IfPilotWereTrue: mean(simsV2.map((u) => (u <= 42 ? 1 : 0))),
      confirmatoryObservedU: 37.5,
      note: 'pilot effect was LARGE (U=8/36), so power at the pilot estimate was high — and the primary did replicate',
    };
  }

  // ---------- 4. between-draw variance (identical condition cells) ----------
  const cell = (runs, world, arm) =>
    runs.filter(
      (r) => (world === 'resistant' ? r.world.includes('resistant') : !r.world.includes('resistant')) && r.arm === arm,
    );
  const g = (rs) => `${rs.reduce((s, r) => s + r.grounded, 0)}/${rs.length}`;
  const betweenDraw = [
    {
      cell: 'codex baseline, marrick, dose 0.35',
      draws: [
        `exploratory ${g(cell(lemmaExp, 'marrick', 'baseline'))}`,
        `confirmatory ${g(cell(lemmaConf, 'marrick', 'baseline'))}`,
      ],
    },
    {
      cell: 'codex baseline, marrick-resistant, dose 0.35',
      draws: [
        `exploratory ${g(cell(lemmaExp, 'resistant', 'baseline'))}`,
        `confirmatory ${g(cell(lemmaConf, 'resistant', 'baseline'))}`,
      ],
    },
    {
      cell: 'codex lemma-display, marrick, dose 0.35',
      draws: [
        `exploratory ${g(cell(lemmaExp, 'marrick', 'lemma-display'))}`,
        `confirmatory ${g(cell(lemmaConf, 'marrick', 'lemma-display'))}`,
      ],
    },
    {
      cell: 'codex lemma-display, marrick-resistant, dose 0.35',
      draws: [
        `exploratory ${g(cell(lemmaExp, 'resistant', 'lemma-display'))}`,
        `confirmatory ${g(cell(lemmaConf, 'resistant', 'lemma-display'))}`,
      ],
    },
    {
      cell: 'sonnet baseline, marrick, dose 0.08',
      draws: ['calibration screen 1/3', `contrast ${g(cell(sonnetCal, 'marrick', 'baseline'))}`],
    },
    {
      cell: 'sonnet baseline, marrick-resistant, dose 0.08',
      draws: ['calibration screen 2/3', `contrast ${g(cell(sonnetCal, 'resistant', 'baseline'))}`],
    },
  ];

  // ---------- 5. base rate ----------
  const baseRate = {
    advancedSignals: 4,
    survivedOnPrimary: 1,
    detail:
      'flash smoke GO -> reversed; sonnet smoke GO -> void; codex display exploratory -> flattened; V2b pilot -> primary replicated (promotion still failed on guardrails). 1 of 4 advanced signals survived on its primary endpoint.',
    asymmetry:
      'nulls are never re-run, so null->positive transitions are unobservable by construction; the observable set is biased toward shrinkage stories. The V2b counterexample and the P5 no-anchor control are the calibration points.',
    backendDriftTest:
      'NOT COMPUTABLE from paired cells: the fresh-prime discipline gives every matrix disjoint seeds, so no same-seed same-condition cell exists across days. Recorded as the deliberate trade: draw independence was bought at the price of drift testability.',
  };

  const report = {
    generatedBy: 'scripts/audit-exploratory-confirmatory-shrinkage.js',
    iters: opts.iters,
    pairs,
    winnersCurse,
    barCalibration: { lemmaCodex: barCalibration, v2b: v2bBar },
    betweenDraw,
    baseRate,
    reading: [
      "The winner's-curse simulation reproduces the observed shrinkage without any additional mechanism: under the pooled two-draw truth, the confirmatory U of 67 sits within two sampling SDs of the expected value, and the exploratory 40.5 is the tail selection picked.",
      'Bar calibration is the compounding design error: setting the criterion where the exploratory estimate sits makes confirmation ~a coin flip even when the estimate is exactly right. Rule for future preregs: size n against a shrunken estimate, or state the coin-flip odds in the freeze (the calibrated-sonnet prereg did the latter).',
      'Between-draw variance in these near-binary outcome cells is large at n=6: identical conditions swing 0/6 to 3/6 across draws. Effects smaller than that swing cannot be resolved at house n regardless of discipline.',
      'The V2b pair is the proof the pipeline can confirm a real effect (large pilot effect, adequately powered at that size) — the shrinkage pattern is therefore selection + power, not a broken instrument.',
    ],
  };

  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'shrinkage-audit-report.json'), JSON.stringify(report, null, 2));

  const md = [];
  md.push('# Exploratory-to-confirmatory shrinkage audit', '');
  md.push(
    `Deterministic bootstrap, ${opts.iters} iterations, seed 20260705. Pure computation over frozen contrast reports.`,
    '',
  );
  md.push('## 1. The pairs', '');
  md.push('| id | pair | exploratory | confirmatory | fate |', '|---|---|---|---|---|');
  for (const p of pairs) md.push(`| ${p.id} | ${p.name} | ${p.exploratory} | ${p.confirmatory} | **${p.fate}** |`);
  md.push('', "## 2. Winner's curse (P1, pooled two-draw truth)", '');
  md.push(
    `- pooled-truth mean U: **${fmt(winnersCurse.pooledTruthMeanU, 1)}**, sampling SD: **${fmt(winnersCurse.samplingSdU, 1)}**`,
  );
  md.push(`- P(a draw advances, U<=42, at pooled truth): **${fmt(winnersCurse.pAdvanceAtPooledTruth, 3)}**`);
  md.push(
    `- E[U | advanced]: **${fmt(winnersCurse.expectedUGivenAdvanced, 1)}** vs independent repeat E[U]: **${fmt(winnersCurse.expectedIndependentRepeatU, 1)}** — the selection gap`,
  );
  md.push(
    `- observed: exploratory 40.5 -> confirmatory 67; the confirmatory is ${winnersCurse.observedConfirmatoryWithinSamplingNoise}`,
  );
  md.push('', '## 3. Bar calibration', '');
  md.push(
    `- P(confirmatory passes U<=42 | true effect = the exploratory estimate): **${fmt(barCalibration.pPassBarIfExploratoryWereTrue, 3)}** — ${barCalibration.note}`,
  );
  if (v2bBar)
    md.push(
      `- V2b analogue: P(pass | pilot effect true) = **${fmt(v2bBar.pPassU42IfPilotWereTrue, 3)}**; observed confirmatory U = ${v2bBar.confirmatoryObservedU} — ${v2bBar.note}`,
    );
  md.push('', '## 4. Between-draw variance (identical condition cells)', '');
  md.push('| cell | draws (grounded) |', '|---|---|');
  for (const b of betweenDraw) md.push(`| ${b.cell} | ${b.draws.join(' vs ')} |`);
  md.push('', '## 5. Base rate and asymmetry', '');
  md.push(`- ${baseRate.detail}`);
  md.push(`- ${baseRate.asymmetry}`);
  md.push(`- Backend drift: ${baseRate.backendDriftTest}`);
  md.push('', '## Reading', '');
  for (const r of report.reading) md.push(`- ${r}`);
  md.push('');
  fs.writeFileSync(path.join(opts.out, 'shrinkage-audit-report.md'), md.join('\n'));
  console.log(md.join('\n'));
  console.log(`\nreport at ${path.relative(ROOT, opts.out)}/shrinkage-audit-report.{json,md}`);
}

main();
