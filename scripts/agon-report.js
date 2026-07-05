#!/usr/bin/env node
// Agon report — aggregate episode ledgers from one or more runs into a
// per-arm contrast table. Pure computation over exports JSON; no API, no DB.
//
//   node scripts/agon-report.js exports/agon/<runId> [more run dirs...]
//
// Writes <first-run-dir>/report.md and episodes.csv, prints the table.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import {
  loadGameConfig,
  createEpisode,
  tutorTurnStart,
  classifyTutorMove,
  applyTutorMove,
  adjudicateLearnerTurn,
  wellPosedProbesNow,
} from '../services/agon/referee.js';

export function loadEpisodes(runDirs) {
  const episodes = [];
  for (const dir of runDirs) {
    const episodesDir = path.join(dir, 'episodes');
    if (!fs.existsSync(episodesDir)) continue;
    let config = null;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf-8'));
      config = loadGameConfig(manifest.configPath);
    } catch {
      config = null; // mechanism metrics unavailable for this dir
    }
    for (const file of fs.readdirSync(episodesDir).filter((f) => f.endsWith('.json'))) {
      const payload = JSON.parse(fs.readFileSync(path.join(episodesDir, file), 'utf-8'));
      if (payload?.summary) {
        payload.mechanism = config ? computeMechanismMetrics(payload, config) : null;
        episodes.push(payload);
      }
    }
  }
  return episodes.sort((a, b) => a.episodeId.localeCompare(b.episodeId));
}

// Deterministic replay of a recorded episode through the referee to recover
// per-turn action sets (which probes were well-posed when). Yields the
// consumption metrics: opportunity misses (a well-posed probe existed but the
// tutor did not probe at all) and off-set probes (probed an item that was not
// well-posed). Sanity-checked against the recorded ledger; returns null on
// divergence rather than reporting unreliable numbers.
export function computeMechanismMetrics(ep, config) {
  if (!Array.isArray(ep.turnRecords) || ep.turnRecords.length === 0) return null;
  const state = createEpisode(config, {
    arm: ep.arm,
    episodeId: `replay-${ep.episodeId}`,
    variantSeed: ep.episodeId, // same variants as the recorded episode
  });
  let oppMisses = 0;
  let probesInSet = 0;
  let offSetProbes = 0;
  let setNonemptyTurns = 0;
  try {
    for (const r of ep.turnRecords) {
      tutorTurnStart(state);
      const actionSet = wellPosedProbesNow(state).map((p) => p.itemId);
      if (actionSet.length > 0) setNonemptyTurns += 1;
      const classified = classifyTutorMove(state, r.finalEnvelope || {});
      applyTutorMove(state, classified, { visibleText: r.tutorVisible || '' });
      if (classified.legal && classified.move === 'probe') {
        if (actionSet.includes(classified.itemId)) probesInSet += 1;
        else offSetProbes += 1;
      } else if (actionSet.length > 0) {
        oppMisses += 1;
      }
      adjudicateLearnerTurn(state, {
        envelope: r.learnerEnvelope,
        publicText: r.learnerVisible || '',
      });
    }
  } catch {
    return null;
  }
  const replayOk =
    state.score === ep.summary.score &&
    Object.values(state.concepts).filter((c) => ['demonstrated', 'transferred'].includes(c.status)).length ===
      ep.summary.demonstrated;
  if (!replayOk) return null;
  return { oppMisses, probesInSet, offSetProbes, setNonemptyTurns };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function sd(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function fmt(x, digits = 2) {
  return x == null ? '—' : Number(x).toFixed(digits);
}

export function aggregateByArm(episodes) {
  const byArm = {};
  for (const ep of episodes) {
    (byArm[ep.arm] ||= []).push(ep);
  }
  const rows = {};
  for (const [arm, eps] of Object.entries(byArm)) {
    const s = eps.map((e) => e.summary);
    const reviseRates = eps
      .map((e) => {
        const turns = e.turnRecords?.length || 0;
        if (!turns) return null;
        const revises = e.turnRecords.filter((t) => t.superego?.verdict === 'REVISE').length;
        return revises / turns;
      })
      .filter((x) => x != null);
    const firstDemoTurns = s.map((x) => x.firstDemonstrationTurn).filter((x) => x != null);
    rows[arm] = {
      n: eps.length,
      winRate: mean(s.map((x) => (x.tutorWin ? 1 : 0))),
      meanDemonstrated: mean(s.map((x) => x.demonstrated)),
      sdDemonstrated: sd(s.map((x) => x.demonstrated)),
      meanTransferred: mean(s.map((x) => x.transferred)),
      meanScore: mean(s.map((x) => x.score)),
      sdScore: sd(s.map((x) => x.score)),
      firstDemoTurnMean: mean(firstDemoTurns),
      neverDemonstrated: s.filter((x) => x.firstDemonstrationTurn == null).length,
      meanWastedProbes: mean(s.map((x) => x.wastedProbes)),
      meanDodgesCharged: mean(s.map((x) => x.totalDodgesCharged)),
      meanBounces: mean(s.map((x) => x.bounces)),
      meanLeaks: mean(s.map((x) => x.leaks)),
      meanComplyMismatches: mean(s.map((x) => x.complyMismatches)),
      meanMoveEntropy: mean(s.map((x) => x.moveEntropy)),
      meanReviseRate: mean(reviseRates),
      meanOppMisses: mean(eps.map((e) => e.mechanism?.oppMisses).filter((x) => x != null)),
      totalOffSetProbes: eps.reduce((a, e) => a + (e.mechanism?.offSetProbes ?? 0), 0),
      moveCounts: s.reduce((acc, x) => {
        for (const [m, n] of Object.entries(x.moveCounts || {})) acc[m] = (acc[m] || 0) + n;
        return acc;
      }, {}),
    };
  }
  return rows;
}

export function renderReport(episodes, runDirs) {
  const arms = aggregateByArm(episodes);
  const lines = [];
  lines.push(`# Agon report`);
  lines.push('');
  lines.push(`Runs: ${runDirs.join(', ')} · episodes: ${episodes.length} · generated ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Per-episode ledger');
  lines.push('');
  lines.push(
    '| episode | arm | turns | demo | transfer | score | win | 1st-demo turn | dodges charged | wasted probes | bounces | leaks | entropy | opp-miss | off-set probes |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const ep of episodes) {
    const s = ep.summary;
    const m = ep.mechanism;
    lines.push(
      `| ${ep.episodeId} | ${ep.arm} | ${s.turns} | ${s.demonstrated} | ${s.transferred} | ${s.score} | ${s.tutorWin ? 'W' : 'L'} | ${s.firstDemonstrationTurn ?? '—'} | ${s.totalDodgesCharged} | ${s.wastedProbes} | ${s.bounces} | ${s.leaks} | ${fmt(s.moveEntropy)} | ${m ? m.oppMisses : '—'} | ${m ? m.offSetProbes : '—'} |`,
    );
  }
  lines.push('');
  lines.push(
    '(opp-miss = turns where a well-posed probe existed but the tutor did not probe; off-set = probes issued that were not well-posed. Recovered by deterministic replay; "—" = replay unavailable.)',
  );
  lines.push('');
  lines.push('## Per-arm aggregates');
  lines.push('');
  lines.push(
    '| arm | n | win rate | demo (mean±sd) | score (mean±sd) | 1st-demo turn | never-demo | dodges charged | wasted | move entropy | superego REVISE rate | opp-miss (mean) | off-set (total) |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [arm, r] of Object.entries(arms).sort()) {
    lines.push(
      `| ${arm} | ${r.n} | ${fmt(r.winRate)} | ${fmt(r.meanDemonstrated)}±${fmt(r.sdDemonstrated)} | ${fmt(r.meanScore)}±${fmt(r.sdScore)} | ${fmt(r.firstDemoTurnMean, 1)} | ${r.neverDemonstrated} | ${fmt(r.meanDodgesCharged)} | ${fmt(r.meanWastedProbes)} | ${fmt(r.meanMoveEntropy)} | ${fmt(r.meanReviseRate)} | ${fmt(r.meanOppMisses)} | ${r.totalOffSetProbes} |`,
    );
  }
  lines.push('');
  const armIds = Object.keys(arms).sort();
  const pairs = [
    ['A1', 'A0', 'raw-state scoreboard vs blind'],
    ['A1p', 'A0', 'action-set brief vs blind'],
    ['A1p', 'A1', 'action-set brief vs raw-state scoreboard'],
  ];
  for (const [hi, lo, label] of pairs) {
    if (!armIds.includes(hi) || !armIds.includes(lo)) continue;
    const d = (f) => (arms[hi][f] != null && arms[lo][f] != null ? arms[hi][f] - arms[lo][f] : null);
    lines.push(`## ${hi} − ${lo} (${label}; descriptive at pilot n — not a promotable claim)`);
    lines.push('');
    lines.push(`- Δ demonstrations: ${fmt(d('meanDemonstrated'))}`);
    lines.push(`- Δ score: ${fmt(d('meanScore'))}`);
    lines.push(`- Δ win rate: ${fmt(d('winRate'))}`);
    lines.push(`- Δ wasted probes: ${fmt(d('meanWastedProbes'))} (negative = ${hi} more disciplined)`);
    lines.push(`- Δ dodges charged: ${fmt(d('meanDodgesCharged'))} (positive = ${hi} extracts more of the budget)`);
    lines.push(`- Δ opportunity misses: ${fmt(d('meanOppMisses'))} (negative = ${hi} cashes more legal probes)`);
    lines.push(`- Δ move entropy: ${fmt(d('meanMoveEntropy'))}`);
    lines.push('');
  }
  return lines.join('\n');
}

function toCsv(episodes) {
  const header =
    'episodeId,arm,turns,demonstrated,transferred,score,tutorWin,firstDemonstrationTurn,dodgesCharged,wastedProbes,bounces,leaks,complyMismatches,moveEntropy';
  const rows = episodes.map((ep) => {
    const s = ep.summary;
    return [
      ep.episodeId,
      ep.arm,
      s.turns,
      s.demonstrated,
      s.transferred,
      s.score,
      s.tutorWin,
      s.firstDemonstrationTurn ?? '',
      s.totalDodgesCharged,
      s.wastedProbes,
      s.bounces,
      s.leaks,
      s.complyMismatches,
      s.moveEntropy,
    ].join(',');
  });
  return [header, ...rows].join('\n') + '\n';
}

function main() {
  const runDirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (runDirs.length === 0) {
    console.error('usage: node scripts/agon-report.js <run dir> [more run dirs...]');
    process.exit(1);
  }
  const episodes = loadEpisodes(runDirs);
  if (episodes.length === 0) {
    console.error('no completed episodes found');
    process.exit(1);
  }
  const report = renderReport(episodes, runDirs);
  fs.writeFileSync(path.join(runDirs[0], 'report.md'), report);
  fs.writeFileSync(path.join(runDirs[0], 'episodes.csv'), toCsv(episodes));
  console.log(report);
  console.log(`written: ${path.join(runDirs[0], 'report.md')} + episodes.csv`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();
