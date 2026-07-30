/**
 * All-channel dashboard for the tutor instrumentation A/B.
 *
 * The bench now scores the same frozen replies through four channels that
 * share nothing with each other: the deterministic guard audit, the PR
 * benchmark rubric, the blind pairwise judge, and the clue-shown pairwise
 * judge. Their verdicts live in different files and different shapes, so the
 * question "what does everything say about this version" takes an afternoon
 * of file spelunking to answer. This module merges the four into one model
 * and renders one page: a verdict matrix per version, every pairwise verdict
 * with its stated reason, and the transcripts themselves with each channel's
 * reading attached to the reply it read.
 *
 * The merge never pools verdicts across candidate texts. A deterministic or
 * PR-benchmark verdict attaches to a card only when run directory, case,
 * version and model lane all match; pairwise verdicts stay in their own
 * section because the older files do not record which run's replies were
 * judged, and pinning them to the wrong text would manufacture agreement.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA,
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from './machineSpiritsHouseStyle.js';

export const TUTOR_STUB_AB_DASHBOARD_SCHEMA = 'machinespirits.tutor-stub.ab-dashboard.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/gu,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function plainLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/gu, ' ')
    .trim();
}

function round(value, places = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * The two pairwise file generations name the contestants differently: the
 * first run recorded only which side was the bare tutor, later runs carry an
 * explicit version list. Both normalize to { versions, winner, ... }.
 */
export function normalizeTutorStubAbPairwiseRow(row) {
  if (!row || typeof row !== 'object') return null;
  const versions =
    Array.isArray(row.versions) && row.versions.length === 2 ? row.versions : ['baseline', 'contract_only'];
  const slotText = String(row.slot || row.id || '');
  const [scenarioId, turnLabel] = slotText.split(':');
  const chars =
    row.chars && typeof row.chars === 'object'
      ? row.chars
      : { baseline: row.bareChars ?? null, contract_only: row.contractChars ?? null };
  return {
    slot: slotText,
    scenarioId: scenarioId || null,
    turn: turnLabel ? Number(String(turnLabel).replace(/^t/u, '')) : null,
    versions,
    winner: row.winner || null,
    reason: row.reason || '',
    chars,
    runs: row.runs && typeof row.runs === 'object' ? row.runs : null,
    showDue: Boolean(row.showDue),
    mock: Boolean(row.mock),
  };
}

function tallyPairwise(rows) {
  const byVersion = {};
  let refused = 0;
  let decided = 0;
  for (const row of rows) {
    if (row.mock) continue;
    if (!row.winner || row.winner === 'refused') {
      refused += 1;
      continue;
    }
    byVersion[row.winner] = (byVersion[row.winner] || 0) + 1;
    decided += 1;
  }
  return { judged: rows.length, decided, refused, byVersion };
}

function laneKey(armId, modelId) {
  return `${armId}__${modelId}`;
}

/**
 * Merge the four channels into one model. Inputs are already-parsed
 * artifacts; no file access happens here so the merge is unit-testable.
 *
 * reports:    [{ dir, report }] — A/B run reports (deterministic channel)
 * prBenchmark: parsed pr-benchmark merged file, or null
 * pairwiseFiles: [{ file, rows }] — raw jsonl rows per pairwise corpus
 */
export function buildTutorStubAbDashboardModel({ reports = [], prBenchmark = null, pairwiseFiles = [] } = {}) {
  const lanes = new Map();
  const lane = (armId, armLabel, modelId) => {
    const key = laneKey(armId, modelId);
    if (!lanes.has(key)) {
      lanes.set(key, {
        armId,
        armLabel,
        modelId,
        runDirs: new Set(),
        det: { turns: 0, pass: 0, hard: 0, clusters: 0 },
        pr: { turns: 0, deliveryPass: 0, hardAxisPass: 0, brokenRules: 0 },
        blind: { wins: 0, losses: 0 },
        due: { wins: 0, losses: 0 },
      });
    }
    return lanes.get(key);
  };

  const scenarios = new Map();
  const armLabels = new Map();
  const prRowsByKey = new Map();
  const prRows = Array.isArray(prBenchmark?.rows) ? prBenchmark.rows : [];
  for (const row of prRows) {
    prRowsByKey.set(`${row.runDir}__${row.caseId}__${row.armId}__${row.modelId}`, row);
  }

  for (const { dir, report } of reports) {
    for (const arm of report?.plan?.arms || []) armLabels.set(arm.id, arm.label || arm.id);
    for (const scenario of report?.plan?.scenarios || []) {
      if (!scenarios.has(scenario.id)) {
        scenarios.set(scenario.id, {
          id: scenario.id,
          label: scenario.label || scenario.id,
          criterion: scenario.criterion || '',
          turns: new Map(),
        });
      }
      const target = scenarios.get(scenario.id);
      for (const turn of scenario.turns || []) {
        if (!target.turns.has(turn.turn)) {
          target.turns.set(turn.turn, { turn: turn.turn, learnerText: turn.learnerText || '', groups: [] });
        }
      }
    }

    const baselineArmId = report?.summary?.baselineArmId || 'baseline';
    const groupsByScenarioTurn = new Map();
    for (const result of report?.results || []) {
      if (!result || result.status === 'blocked') continue;
      const armLabel = armLabels.get(result.armId) || result.armId;
      const entry = lane(result.armId, armLabel, result.modelId);
      entry.runDirs.add(dir);
      entry.det.turns += 1;
      if (result.status === 'pass') entry.det.pass += 1;
      entry.det.hard += (result.hardFailureClusters || []).length;
      entry.det.clusters += (result.failureClusters || []).length;

      const prRow = prRowsByKey.get(`${dir}__${result.caseId}__${result.armId}__${result.modelId}`) || null;
      if (prRow && prRow.success !== false) {
        entry.pr.turns += 1;
        entry.pr.brokenRules += prRow.brokenRules ?? 0;
        if (prRow.axes?.overall_delivery?.label === 'pass') entry.pr.deliveryPass += 1;
        if (prRow.hardAxisVerdict === 'pass') entry.pr.hardAxisPass += 1;
      }

      const scenario = scenarios.get(result.scenarioId);
      if (!scenario) continue;
      const slot = scenario.turns.get(result.turn);
      if (!slot) continue;
      const groupKey = `${result.scenarioId}__${result.turn}__${dir}`;
      if (!groupsByScenarioTurn.has(groupKey)) {
        const group = { runDir: dir, cards: [] };
        groupsByScenarioTurn.set(groupKey, group);
        slot.groups.push(group);
      }
      groupsByScenarioTurn.get(groupKey).cards.push({
        armId: result.armId,
        armLabel,
        modelId: result.modelId,
        baseline: result.armId === baselineArmId,
        text: result.candidate || '',
        det: {
          status: result.status,
          hard: result.hardFailureClusters || [],
          clusters: result.failureClusters || [],
        },
        pr:
          prRow && prRow.success !== false
            ? {
                brokenRules: prRow.brokenRules ?? null,
                hardAxisVerdict: prRow.hardAxisVerdict || null,
                axes: Object.fromEntries(
                  Object.entries(prRow.axes || {}).map(([axis, verdict]) => [axis, verdict?.label || 'unsure']),
                ),
              }
            : null,
      });
    }
  }

  const pairwise = pairwiseFiles.map(({ file, rows }) => {
    const normalized = rows.map(normalizeTutorStubAbPairwiseRow).filter(Boolean);
    const showDue = normalized.some((row) => row.showDue);
    for (const row of normalized) {
      if (row.mock || !row.winner || row.winner === 'refused') continue;
      const [left, right] = row.versions;
      const loser = row.winner === left ? right : left;
      for (const [armId, outcome] of [
        [row.winner, 'wins'],
        [loser, 'losses'],
      ]) {
        for (const [key, entry] of lanes) {
          if (key.startsWith(`${armId}__`)) entry[showDue ? 'due' : 'blind'][outcome] += 1;
        }
      }
    }
    return { file, showDue, tally: tallyPairwise(normalized), rows: normalized };
  });

  const matrix = [...lanes.values()]
    .map((entry) => ({
      armId: entry.armId,
      armLabel: entry.armLabel,
      modelId: entry.modelId,
      runCount: entry.runDirs.size,
      det: {
        turns: entry.det.turns,
        passRate: entry.det.turns ? round(entry.det.pass / entry.det.turns) : null,
        hardPerTurn: entry.det.turns ? round(entry.det.hard / entry.det.turns) : null,
      },
      pr: {
        turns: entry.pr.turns,
        deliveryPass: entry.pr.deliveryPass,
        hardAxisPass: entry.pr.hardAxisPass,
        brokenPerTurn: entry.pr.turns ? round(entry.pr.brokenRules / entry.pr.turns) : null,
      },
      blind: entry.blind,
      due: entry.due,
    }))
    .sort((a, b) => a.armId.localeCompare(b.armId) || a.modelId.localeCompare(b.modelId));

  return {
    schema: TUTOR_STUB_AB_DASHBOARD_SCHEMA,
    matrix,
    pairwise,
    scenarios: [...scenarios.values()].map((scenario) => ({
      ...scenario,
      turns: [...scenario.turns.values()].sort((a, b) => a.turn - b.turn),
    })),
  };
}

const CHANNEL_NOTES = [
  ['Deterministic guard audit', 'code counts broken rules per turn; no judge; the frozen replay grades on this'],
  ['PR benchmark rubric', 'a Sonnet judge scores seven axes with the authored obligations in hand'],
  [
    'Blind pairwise judge',
    'a different model picks the better next turn from the public scene alone — no plan, no rules',
  ],
  [
    'Clue-shown pairwise judge',
    'the blind judge, plus the clue the world schedules for that turn, alike for both candidates',
  ],
];

function matrixTable(matrix) {
  const rows = matrix
    .map((entry) => {
      const blind = entry.blind.wins + entry.blind.losses ? `${entry.blind.wins}–${entry.blind.losses}` : '—';
      const due = entry.due.wins + entry.due.losses ? `${entry.due.wins}–${entry.due.losses}` : '—';
      return `<tr>
        <td>${escapeHtml(entry.armLabel)}</td>
        <td><code>${escapeHtml(entry.modelId)}</code></td>
        <td class="ab-num">${entry.runCount}</td>
        <td class="ab-num">${entry.det.turns}</td>
        <td class="ab-num">${entry.det.hardPerTurn ?? '—'}</td>
        <td class="ab-num">${entry.pr.turns ? `${entry.pr.deliveryPass}/${entry.pr.turns}` : '—'}</td>
        <td class="ab-num">${entry.pr.brokenPerTurn ?? '—'}</td>
        <td class="ab-num">${blind}</td>
        <td class="ab-num">${due}</td>
      </tr>`;
    })
    .join('');
  return `<table class="ab-table">
    <thead><tr><th>Version</th><th>Model lane</th><th>Runs</th><th>Turns</th><th>Guard rules broken /turn</th><th>PR bench delivery pass</th><th>PR rules broken /turn</th><th>Blind W–L</th><th>Clue-shown W–L</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="ab-note">Pairwise records count every judged corpus a version appears in and are not per-run; read exact matchups in the pairwise sections below. A dash means that channel has not read this version.</p>`;
}

function pairwiseSection(section) {
  const tallyLine = Object.entries(section.tally.byVersion)
    .map(([version, count]) => `${escapeHtml(plainLabel(version))} ${count}`)
    .join(' · ');
  const rows = section.rows
    .filter((row) => !row.mock)
    .map(
      (row) => `<tr>
        <td><code>${escapeHtml(row.slot)}</code></td>
        <td>${escapeHtml(plainLabel(row.winner || ''))}</td>
        <td class="ab-reason">${escapeHtml(row.reason)}</td>
      </tr>`,
    )
    .join('');
  return `<details class="ab-panel ab-pairwise">
    <summary><b>${escapeHtml(path.basename(section.file))}</b> — ${section.tally.decided} decided, ${section.tally.refused} refused${section.showDue ? ' · scheduled clue shown' : ' · blind'} · ${tallyLine || 'no decisions'}</summary>
    <table class="ab-table"><thead><tr><th>Slot</th><th>Preferred</th><th>Judge's stated reason</th></tr></thead><tbody>${rows}</tbody></table>
  </details>`;
}

function cardChips(card) {
  const det =
    card.det.status === 'pass'
      ? '<span class="ab-chip ab-chip--pass">guards pass</span>'
      : `<span class="ab-chip ab-chip--fail">guards: ${card.det.hard.length} hard</span>`;
  const pr = card.pr
    ? `<span class="ab-chip ${card.pr.hardAxisVerdict === 'pass' ? 'ab-chip--pass' : 'ab-chip--fail'}">PR bench ${escapeHtml(card.pr.hardAxisVerdict || 'unsure')} · ${card.pr.brokenRules ?? '—'} broken</span>`
    : '<span class="ab-chip ab-chip--missing">PR bench: not read</span>';
  const axes = card.pr
    ? Object.entries(card.pr.axes)
        .filter(([, label]) => label !== 'pass')
        .map(
          ([axis, label]) =>
            `<span class="ab-chip ab-chip--cluster">${escapeHtml(plainLabel(axis))}: ${escapeHtml(label)}</span>`,
        )
        .join('')
    : '';
  return `${det}${pr}${axes}`;
}

function transcriptSections(scenarios) {
  return scenarios
    .map((scenario) => {
      const turns = scenario.turns
        .map((slot) => {
          const groups = slot.groups
            .map((group) => {
              const cards = group.cards
                .map(
                  (card) => `<article class="ab-card${card.baseline ? ' ab-card--baseline' : ''}">
                    <header class="ab-card-head">
                      <span class="ab-arm-name">${escapeHtml(card.armLabel)}</span>
                      <span class="ab-metrics">${escapeHtml(card.modelId)} · ${card.text.length} chars</span>
                    </header>
                    <div class="ab-speech">${escapeHtml(card.text) || '<em class="ab-empty">no candidate</em>'}</div>
                    <footer class="ab-card-foot">${cardChips(card)}</footer>
                  </article>`,
                )
                .join('');
              return `<div class="ab-run-group">
                <p class="ab-meta">run <code>${escapeHtml(group.runDir)}</code></p>
                <div class="ab-lanes" style="--ab-lane-count: ${Math.min(group.cards.length, 3)}">${cards}</div>
              </div>`;
            })
            .join('');
          return `<section class="ab-turn">
            <div class="ab-spine-row">
              <b class="ab-turn-badge">t${escapeHtml(slot.turn)}</b>
              <article class="ab-card ab-card--learner">
                <header class="ab-card-head"><span class="ab-arm-name">learner (frozen)</span><span class="ab-metrics">identical for every version</span></header>
                <div class="ab-speech">${escapeHtml(slot.learnerText)}</div>
              </article>
            </div>
            ${groups}
          </section>`;
        })
        .join('');
      return `<details class="ab-scenario">
        <summary class="ab-scenario-head"><h2>${escapeHtml(scenario.label)}</h2><p class="ab-note">${escapeHtml(scenario.criterion)}</p></summary>
        ${turns}
      </details>`;
    })
    .join('');
}

export function renderTutorStubAbDashboardHtml(model, { generatedAt = '' } = {}) {
  const channelList = CHANNEL_NOTES.map(
    ([name, note]) => `<li><b>${escapeHtml(name)}</b> — ${escapeHtml(note)}</li>`,
  ).join('');
  return `<!doctype html>
<html lang="en" data-machine-spirits-house-style="${MACHINE_SPIRITS_HOUSE_STYLE_SCHEMA}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Tutor instrumentation — all-channel dashboard</title>
${renderMachineSpiritsHouseStyleTag()}
<style>
  body { margin: 0; font-family: var(--ms-font-reading); color: var(--ms-text); }
  .ab-wrap { position: relative; z-index: 1; max-width: 1400px; margin: 0 auto; padding: 32px 24px 96px; }
  h1 { font-family: var(--ms-font-sans); font-size: 28px; margin: 0 0 4px; }
  h2 { font-family: var(--ms-font-sans); font-size: 20px; margin: 0; display: inline; }
  .ab-note, .ab-meta { color: var(--ms-text-muted); font-size: 13px; margin: 0 0 4px; }
  .ab-meta code, .ab-note code { font-family: var(--ms-font-mono); font-size: 12px; }
  .ab-panel { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 16px 18px; margin: 0 0 24px; }
  .ab-masthead { padding: 20px 18px 16px; }
  .ab-masthead ul { margin: 8px 0 0; padding-left: 18px; font-size: 13px; }
  .ab-table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: var(--ms-font-sans); }
  .ab-table th, .ab-table td { border-bottom: 1px solid var(--ms-border-subtle); padding: 6px 8px; text-align: left; vertical-align: top; }
  .ab-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ms-text-muted); }
  .ab-num { text-align: right; font-family: var(--ms-font-mono); }
  .ab-reason { font-size: 12px; color: var(--ms-text-muted); max-width: 70ch; }
  .ab-pairwise summary { cursor: pointer; font-size: 14px; }
  .ab-pairwise table { margin-top: 12px; }
  .ab-scenario { margin: 0 0 24px; }
  .ab-scenario-head { background: var(--ms-surface); border: 1px solid var(--ms-border); padding: 14px 18px; cursor: pointer; }
  .ab-turn { border-top: 2px solid var(--ms-ink); padding: 16px 0 24px; }
  .ab-spine-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: start; margin-bottom: 12px; }
  .ab-turn-badge { display: block; width: 34px; height: 34px; background: var(--ms-ink); color: var(--ms-white); font: 700 12px/34px var(--ms-font-mono); text-align: center; }
  .ab-run-group { margin: 0 0 16px 56px; }
  .ab-lanes { display: grid; grid-template-columns: repeat(var(--ab-lane-count), minmax(0, 1fr)); gap: 12px; }
  .ab-card { background: var(--ms-surface-elevated); border: 1px solid var(--ms-border); padding: 12px 14px; box-sizing: border-box; }
  .ab-card--learner { background: var(--ms-paper-2); border-left: 3px solid var(--ms-ochre); }
  .ab-card--baseline { border-left: 3px solid var(--ms-border); }
  .ab-card-head { display: flex; justify-content: space-between; gap: 8px; font: 11px/1.6 var(--ms-font-mono); color: var(--ms-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .ab-arm-name { color: var(--ms-text); font-weight: 700; }
  .ab-speech { font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
  .ab-empty { color: var(--ms-text-muted); }
  .ab-card-foot { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
  .ab-chip { font: 10px/1.8 var(--ms-font-mono); text-transform: uppercase; letter-spacing: 0.05em; padding: 0 6px; border: 1px solid var(--ms-border); }
  .ab-chip--pass { background: var(--ms-moss); color: var(--ms-white); border-color: var(--ms-moss-deep); }
  .ab-chip--fail { background: var(--ms-red); color: var(--ms-white); border-color: var(--ms-red-dark); }
  .ab-chip--missing { background: var(--ms-paper-3); color: var(--ms-text-muted); }
  .ab-chip--cluster { background: transparent; color: var(--ms-text-muted); }
  @media (max-width: 900px) { .ab-lanes { grid-template-columns: 1fr; } .ab-run-group { margin-left: 0; } }
</style>
</head>
<body>
${renderMachineSpiritsHouseBackdrop()}
<div class="ab-wrap">
  <div class="ab-panel ab-masthead">
    <h1>Tutor instrumentation — all-channel dashboard</h1>
    <p class="ab-note">One page over the frozen A/B pool: every scoring channel's reading of every version, kept side by side and never averaged across channels. Where the channels disagree, the disagreement is the finding.</p>
    <ul>${channelList}</ul>
    ${generatedAt ? `<p class="ab-meta">generated <code>${escapeHtml(generatedAt)}</code></p>` : ''}
  </div>

  <div class="ab-panel"><h2>Verdict matrix</h2>${matrixTable(model.matrix)}</div>

  ${model.pairwise.map(pairwiseSection).join('')}

  ${transcriptSections(model.scenarios)}

  <p class="ab-note ab-panel">Turns after the first are counterfactual for every version except the one that produced the recording. Pairwise verdicts are one judge's reading; the deterministic and PR-benchmark channels grade against the authored obligations, which the blind judge never sees. No number on this page combines two channels.</p>
</div>
</body>
</html>`;
}

export function writeTutorStubAbDashboardHtml({ model, outPath, generatedAt = '' } = {}) {
  const target = path.resolve(outPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderTutorStubAbDashboardHtml(model, { generatedAt }), 'utf8');
  return target;
}
