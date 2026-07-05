#!/usr/bin/env node
/**
 * Cross-model plan-mode interaction analysis
 * (CROSS-MODEL-PLAN-MODE-PREREGISTRATION.md). Reads two matrix-dir sets —
 * the reused codex plan-mode matrix and the new flash matrix — builds
 * per-(model, world, seed) pair differences on T*, and tests the
 * pre-registered interaction: is the plan-mode delta more favorable on the
 * weaker model? Entirely programmatic; frozen before the paid flash matrix.
 *
 * Usage:
 *   node scripts/analyze-cross-model-interaction.js \
 *     --codex exports/dramatic-derivation/matrix/ledger-plan-mode-hethel-resistant \
 *     --codex exports/dramatic-derivation/matrix/ledger-plan-mode-marrick \
 *     --flash exports/dramatic-derivation/matrix/flash-plan-mode-hethel-resistant \
 *     --flash exports/dramatic-derivation/matrix/flash-plan-mode-marrick \
 *     [--out exports/dramatic-derivation/strategy-ledger/cross-model]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_CAPS = { world_010_hethel_resistant: 26, world_005_marrick: 28, world_000_smoke: 14 };
const SEEDS = [31, 37, 41, 43, 47, 53]; // repeat index rN -> SEEDS[N-1], both matrices

function parseArgs(argv) {
  const opts = {
    codex: [],
    flash: [],
    out: path.join(ROOT, 'exports/dramatic-derivation/strategy-ledger/cross-model'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--codex') opts.codex.push(path.resolve(ROOT, argv[++i]));
    else if (argv[i] === '--flash') opts.flash.push(path.resolve(ROOT, argv[++i]));
    else if (argv[i] === '--out') opts.out = path.resolve(ROOT, argv[++i]);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!opts.codex.length || !opts.flash.length) throw new Error('need --codex and --flash matrix dirs');
  return opts;
}

function loadRuns(model, matrixDirs) {
  const runs = [];
  for (const dir of matrixDirs) {
    const world = path.basename(dir).replace(/^(ledger-plan-mode|flash-plan-mode)-/, '');
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'logs') continue;
      const m = entry.name.match(/^(baseline|plan-mode)-r(\d+)$/);
      if (!m) continue;
      const resultPath = path.join(dir, entry.name, 'result.json');
      if (!fs.existsSync(resultPath)) {
        runs.push({ model, world, arm: m[1], repeat: Number(m[2]), missing: true });
        continue;
      }
      const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      const cap = WORLD_CAPS[r.worldId] ?? r.turnsPlayed;
      const events = r.events || [];
      const count = (type) => events.filter((e) => e.type === type).length;
      const sceneOpenings = count('scene_open');
      const st = r.strategyLedger?.stocktakes || [];
      runs.push({
        model,
        world,
        arm: m[1],
        repeat: Number(m[2]),
        seed: SEEDS[Number(m[2]) - 1] ?? null,
        verdict: r.verdict,
        grounded: r.verdict === 'grounded_anagnorisis' ? 1 : 0,
        tStar: r.assertedGroundedTurn ?? cap + 1,
        aporiaLike: ['aporia', 'disengagement'].includes(r.verdict) ? 1 : 0,
        releases: r.ledger.length,
        leaks: count('leak'),
        guardOverrides: (r.transcript || []).filter(
          (l) =>
            l.role === 'tutor' &&
            l.meta?.releaseDecision?.pacingGuard?.blocked === true &&
            l.meta.releaseDecision.played &&
            l.meta.releaseDecision.played === l.meta.releaseDecision.pacingGuard.candidate,
        ).length,
        stocktakes: st.length,
        correctionsDemanded: st.filter((x) => x.correction).length,
        correctionsAnswered: st.filter((x) => x.correction && x.reorientation).length,
        stocktakeCoverage: sceneOpenings > 1 ? Math.min(1, st.length / Math.max(1, sceneOpenings - 1)) : null,
      });
    }
  }
  return runs;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d));

function mannWhitneyU(a, b) {
  // one-sided: a < b (a = flash deltas, b = codex deltas)
  let u = 0;
  for (const x of a) for (const y of b) u += x < y ? 1 : x === y ? 0.5 : 0;
  // convention note: this counts wins for "a lower"; the criterion applies to
  // U' = n1*n2 - u when comparing against the standard low-tail table, so we
  // report min-form U as in the parent analyses: U_low = n1*n2 - u_wins.
  return { uWins: u, uLow: a.length * b.length - u, uMax: a.length * b.length };
}

function pairDeltas(runs, model) {
  const deltas = [];
  for (const world of [...new Set(runs.map((r) => r.world))]) {
    for (const repeat of [...new Set(runs.map((r) => r.repeat))].sort((a, b) => a - b)) {
      const base = runs.find(
        (r) => r.model === model && r.world === world && r.repeat === repeat && r.arm === 'baseline',
      );
      const plan = runs.find(
        (r) => r.model === model && r.world === world && r.repeat === repeat && r.arm === 'plan-mode',
      );
      if (!base || !plan || base.missing || plan.missing) continue;
      deltas.push({
        model,
        world,
        repeat,
        seed: base.seed,
        delta: plan.tStar - base.tStar,
        deltaGrounded: plan.grounded - base.grounded,
      });
    }
  }
  return deltas;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const runs = [...loadRuns('codex', opts.codex), ...loadRuns('flash', opts.flash)];
  const missing = runs.filter((r) => r.missing);
  const worlds = [...new Set(runs.map((r) => r.world))];

  // guardrails (flash plan-mode arm per the pre-registration; instrument gate both)
  const guardrails = [];
  const g = (id, ok, detail) => guardrails.push({ id, ok: Boolean(ok), detail });
  g('instrument', missing.length === 0, `${missing.length} missing/unparseable run(s)`);
  g(
    'leaks',
    runs.every((r) => r.missing || r.leaks === 0),
    'leak events across all cells',
  );
  g(
    'guard-overrides',
    runs.every((r) => r.missing || r.guardOverrides === 0),
    'pacing-guard overrides across all cells',
  );
  for (const world of worlds) {
    const fBase = runs.filter((r) => r.model === 'flash' && r.world === world && r.arm === 'baseline' && !r.missing);
    const fPlan = runs.filter((r) => r.model === 'flash' && r.world === world && r.arm === 'plan-mode' && !r.missing);
    g(
      `flash-releases-${world}`,
      mean(fPlan.map((r) => r.releases)) >= mean(fBase.map((r) => r.releases)) - 0.5,
      `${world}: flash plan-mode mean releases ${fmt(mean(fPlan.map((r) => r.releases)))} vs baseline ${fmt(mean(fBase.map((r) => r.releases)))}`,
    );
    g(
      `flash-aporia-${world}`,
      fPlan.reduce((s, r) => s + r.aporiaLike, 0) <= fBase.reduce((s, r) => s + r.aporiaLike, 0) + 1,
      `${world}: flash plan-mode aporia-like ${fPlan.reduce((s, r) => s + r.aporiaLike, 0)} vs baseline ${fBase.reduce((s, r) => s + r.aporiaLike, 0)}`,
    );
  }
  const stCov = runs
    .filter((r) => r.model === 'flash' && r.arm === 'plan-mode' && !r.missing)
    .map((r) => r.stocktakeCoverage)
    .filter((v) => v !== null);
  g(
    'flash-stocktake-coverage',
    stCov.length && mean(stCov) >= 0.8,
    `mean flash stock-take coverage ${fmt(mean(stCov))}`,
  );

  // the interaction
  const codexD = pairDeltas(runs, 'codex');
  const flashD = pairDeltas(runs, 'flash');
  const perWorld = worlds.map((world) => {
    const f = flashD.filter((d) => d.world === world).map((d) => d.delta);
    const c = codexD.filter((d) => d.world === world).map((d) => d.delta);
    return {
      world,
      flashMean: mean(f),
      codexMean: mean(c),
      interactionFavorable: mean(f) !== null && mean(c) !== null && mean(f) < mean(c),
    };
  });
  const mw = mannWhitneyU(
    flashD.map((d) => d.delta),
    codexD.map((d) => d.delta),
  );
  const bar1 = perWorld.length >= 2 && perWorld.every((w) => w.interactionFavorable);
  const bar2 = mw.uLow <= 42;
  const bar3 = guardrails.every((x) => x.ok);
  const sensitivity = {
    note: 'seeds 31/37 excluded (previewed by the smoke)',
    flashMean: mean(flashD.filter((d) => d.seed !== 31 && d.seed !== 37).map((d) => d.delta)),
    codexMean: mean(codexD.filter((d) => d.seed !== 31 && d.seed !== 37).map((d) => d.delta)),
  };
  const groundedInteraction = {
    flashMeanDeltaGrounded: mean(flashD.map((d) => d.deltaGrounded)),
    codexMeanDeltaGrounded: mean(codexD.map((d) => d.deltaGrounded)),
  };
  const stocktakeUsage = Object.fromEntries(
    ['codex', 'flash'].map((m2) => [
      m2,
      {
        meanCorrectionsDemanded: mean(
          runs.filter((r) => r.model === m2 && r.arm === 'plan-mode' && !r.missing).map((r) => r.correctionsDemanded),
        ),
        meanCorrectionsAnswered: mean(
          runs.filter((r) => r.model === m2 && r.arm === 'plan-mode' && !r.missing).map((r) => r.correctionsAnswered),
        ),
      },
    ]),
  );

  const report = {
    schema: 'dramatic-derivation.cross-model-interaction.v0',
    preRegistration: 'CROSS-MODEL-PLAN-MODE-PREREGISTRATION.md',
    worlds,
    nDeltas: { flash: flashD.length, codex: codexD.length },
    deltas: { flash: flashD, codex: codexD },
    perWorld,
    mannWhitney: mw,
    promotionBar: { bar1_directionBothWorlds: bar1, bar2_U: bar2, bar3_guardrails: bar3, met: bar1 && bar2 && bar3 },
    guardrails,
    sensitivity,
    groundedInteraction,
    stocktakeUsage,
    runs,
  };
  const lines = [
    '# Cross-model plan-mode interaction — pre-registered contrast',
    '',
    `Pair deltas (T*): flash n=${flashD.length}, codex n=${codexD.length} (codex arm reused whole, declared).`,
    '',
    '| world | flash mean Δ | codex mean Δ | interaction favorable |',
    '|---|---|---|---|',
    ...perWorld.map(
      (w) => `| ${w.world} | ${fmt(w.flashMean)} | ${fmt(w.codexMean)} | ${w.interactionFavorable ? 'YES' : 'no'} |`,
    ),
    '',
    `Pooled one-sided Mann-Whitney on pair deltas (flash lower): U_low = ${mw.uLow}/${mw.uMax} (criterion <= 42).`,
    `Promotion bar: direction=${bar1 ? 'PASS' : 'FAIL'}, U=${bar2 ? 'PASS' : 'FAIL'}, guardrails=${bar3 ? 'PASS' : 'FAIL'} -> ${bar1 && bar2 && bar3 ? '**MET**' : '**NOT MET**'}`,
    '',
    '## Guardrails',
    '',
    '| guardrail | ok | detail |',
    '|---|---|---|',
    ...guardrails.map((x) => `| ${x.id} | ${x.ok ? 'PASS' : 'FAIL'} | ${x.detail} |`),
    '',
    '## Secondary (descriptive)',
    '',
    `Grounded-rate interaction: flash mean Δgrounded ${fmt(groundedInteraction.flashMeanDeltaGrounded)} vs codex ${fmt(groundedInteraction.codexMeanDeltaGrounded)}.`,
    `Sensitivity (${sensitivity.note}): flash mean Δ ${fmt(sensitivity.flashMean)} vs codex ${fmt(sensitivity.codexMean)}.`,
    `Stock-take usage: ${JSON.stringify(stocktakeUsage)}`,
    '',
  ];
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'cross-model-interaction-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(opts.out, 'cross-model-interaction-report.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  console.log(`report at ${path.relative(ROOT, opts.out)}/cross-model-interaction-report.{json,md}`);
}

main();
