#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';

import { resolveEngagementRegister } from '../services/engagementRegisterRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DB_PATH = path.join(ROOT, 'data', 'evaluations.db');
const CACHE_PATH = path.join(ROOT, 'exports', 'charisma-desire-adaptation-slices.json');
const JSON_PATH = path.join(ROOT, 'exports', 'charisma-desire-register-effects.json');
const REPORT_PATH = path.join(ROOT, 'exports', 'charisma-desire-register-effects-summary.md');

const SWITCH_SCENARIO = 'charisma_desire_instruction_to_engagement_switch';
const TARGET_RUN_IDS = [
  'eval-2026-06-27-1ecb6a90',
  'eval-2026-06-27-a9e8e0ed',
  'eval-2026-06-27-bf8bc904',
  'eval-2026-06-27-a9a4c920',
  'eval-2026-06-27-e3fb5eb2',
  'eval-2026-06-27-a07768fe',
  'eval-2026-06-27-49aeaa2c',
  'eval-2026-06-27-eb5f4244',
];

const ROUTER_CELLS = new Set(['180', '181', '182', '183', '184']);
const NON_ROUTER_CONTROL_CELLS = new Set(['163', '169']);

const TUTOR_DIMS = [
  'perception_quality',
  'pedagogical_craft',
  'elicitation_quality',
  'adaptive_responsiveness',
  'recognition_quality',
  'productive_difficulty',
  'epistemic_integrity',
  'content_accuracy',
];

const TUTOR_HOLISTIC_DIMS = ['pedagogical_arc', 'adaptive_trajectory', 'pedagogical_closure'];

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cellId(profileName) {
  if (profileName === 'budget') return 'budget';
  return /^cell_(\d+)/.exec(profileName || '')?.[1] || 'unknown';
}

function profileLabel(profileName) {
  const id = cellId(profileName);
  return id === 'budget' ? 'budget' : `cell ${id}`;
}

function profileGroup(profileName) {
  const id = cellId(profileName);
  if (id === 'budget') return 'budget_floor';
  if (NON_ROUTER_CONTROL_CELLS.has(id)) return 'non_router_charisma_control';
  if (ROUTER_CELLS.has(id)) return 'router_register_family';
  return 'other';
}

function fmt(value, digits = 1) {
  return value == null || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits);
}

function pct(value) {
  return value == null || Number.isNaN(Number(value)) ? '' : `${(Number(value) * 100).toFixed(0)}%`;
}

function mean(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function sampleSd(values) {
  const nums = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  if (nums.length < 2) return null;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (nums.length - 1));
}

function boolMean(values) {
  return mean(values.map((value) => (value === true ? 1 : value === false ? 0 : null)));
}

function dimScore(tutorScores, turn, dim) {
  const turnScore = tutorScores?.[String(turn)] || tutorScores?.[turn];
  return turnScore?.scores?.[dim]?.score ?? null;
}

function overallScore(tutorScores, turn) {
  const turnScore = tutorScores?.[String(turn)] || tutorScores?.[turn];
  return turnScore?.overallScore ?? turnScore?.overall_score ?? null;
}

function holisticDim(row, dim) {
  const scores = parseJson(row.tutor_holistic_scores, {});
  return scores?.[dim]?.score ?? null;
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return { version: 1, scores: {} };
  return parseJson(fs.readFileSync(CACHE_PATH, 'utf8'), { version: 1, scores: {} });
}

function makeSlices(rows, cache) {
  return rows.flatMap((row) => {
    const suggestions = parseJson(row.suggestions, []);
    const tutorScores = parseJson(row.tutor_scores, {});
    const trace = parseJson(row.id_construction_trace, []);
    return suggestions.map((suggestion, turn) => {
      const traceTurn = trace.find((entry) => Number(entry.turn) === turn) || {};
      const cached = cache.scores?.[`${row.run_id}:${row.id}:${turn}`];
      const dims = Object.fromEntries(TUTOR_DIMS.map((dim) => [dim, dimScore(tutorScores, turn, dim)]));
      const group = profileGroup(row.profile_name);
      const expectedRegister = group === 'router_register_family' ? (turn === 0 ? 'brisk' : 'charismatic') : 'unrouted';
      const rawRegister = traceTurn.engagementState?.selected_register || traceTurn.engagementState?.selected_mode || 'unrouted';
      const register = resolveEngagementRegister(rawRegister)?.register || rawRegister;
      return {
        rowId: row.id,
        runId: row.run_id,
        profileName: row.profile_name,
        profileLabel: profileLabel(row.profile_name),
        profileGroup: group,
        turn,
        phase: turn === 0 ? 'pre_instruction' : 'post_adaptation',
        register,
        expectedRegister,
        registerHit: group === 'router_register_family' ? register === expectedRegister : null,
        learnerSignal: traceTurn.engagementState?.learner_signal || '',
        agencyReturnPasses:
          traceTurn.agencyReturnVerification?.passes === true
            ? true
            : traceTurn.agencyReturnVerification
              ? false
              : null,
        parseOk: traceTurn.construction?.parse_status === 'ok' ? true : traceTurn.construction ? false : null,
        v22TurnScore: overallScore(tutorScores, turn),
        sliceCharisma: cached?.overall ?? null,
        tutorMessage: suggestion?.message || '',
        dims,
      };
    });
  });
}

function groupRows(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function aggregateSlices(slices, keyFn) {
  const groups = groupRows(slices, keyFn);
  return [...groups.entries()]
    .map(([key, items]) => {
      const dimMeans = Object.fromEntries(TUTOR_DIMS.map((dim) => [dim, mean(items.map((item) => item.dims[dim]))]));
      return {
        key,
        n: items.length,
        v22: mean(items.map((item) => item.v22TurnScore)),
        v22Sd: sampleSd(items.map((item) => item.v22TurnScore)),
        charisma: mean(items.map((item) => item.sliceCharisma)),
        charismaSd: sampleSd(items.map((item) => item.sliceCharisma)),
        agencyPassRate: boolMean(items.map((item) => item.agencyReturnPasses)),
        registerHitRate: boolMean(items.map((item) => item.registerHit)),
        parseOkRate: boolMean(items.map((item) => item.parseOk)),
        dimMeans,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

function aggregateRows(rows, keyFn) {
  const groups = groupRows(rows, keyFn);
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      n: items.length,
      dialogueQuality: mean(items.map((item) => item.dialogue_quality_score)),
      dialogueQualitySd: sampleSd(items.map((item) => item.dialogue_quality_score)),
      tutorHolistic: mean(items.map((item) => item.tutor_holistic_overall_score)),
      learnerHolistic: mean(items.map((item) => item.learner_holistic_overall_score)),
      dialogueCharisma: mean(items.map((item) => item.tutor_charisma_overall_score)),
      passesRequiredRate: mean(
        items.map((item) => (item.passes_required === 1 ? 1 : item.passes_required === 0 ? 0 : null)),
      ),
      passesForbiddenRate: mean(
        items.map((item) => (item.passes_forbidden === 1 ? 1 : item.passes_forbidden === 0 ? 0 : null)),
      ),
      holisticDims: Object.fromEntries(
        TUTOR_HOLISTIC_DIMS.map((dim) => [dim, mean(items.map((item) => holisticDim(item, dim)))]),
      ),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function pairedDeltas(slices) {
  const byRow = groupRows(slices, (slice) => slice.rowId);
  return [...byRow.values()]
    .map((items) => {
      const pre = items.find((item) => item.turn === 0);
      const post = items.find((item) => item.turn === 1);
      if (!pre || !post) return null;
      return {
        rowId: post.rowId,
        runId: post.runId,
        profileLabel: post.profileLabel,
        profileGroup: post.profileGroup,
        postRegister: post.register,
        v22Delta: post.v22TurnScore - pre.v22TurnScore,
        charismaDelta:
          post.sliceCharisma != null && pre.sliceCharisma != null ? post.sliceCharisma - pre.sliceCharisma : null,
        dimDeltas: Object.fromEntries(
          TUTOR_DIMS.map((dim) => [
            dim,
            post.dims[dim] != null && pre.dims[dim] != null ? post.dims[dim] - pre.dims[dim] : null,
          ]),
        ),
      };
    })
    .filter(Boolean);
}

function aggregateDeltas(deltas, keyFn) {
  const groups = groupRows(deltas, keyFn);
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      n: items.length,
      v22Delta: mean(items.map((item) => item.v22Delta)),
      charismaDelta: mean(items.map((item) => item.charismaDelta)),
      dimDeltas: Object.fromEntries(TUTOR_DIMS.map((dim) => [dim, mean(items.map((item) => item.dimDeltas[dim]))])),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function groupAggMap(aggregates) {
  return Object.fromEntries(aggregates.map((row) => [row.key, row]));
}

function buildDimensionContrast({ phaseAgg, deltaAgg }) {
  const phase = groupAggMap(phaseAgg);
  const deltas = groupAggMap(deltaAgg);
  const budgetPost = phase['budget_floor:post_adaptation'];
  const controlPost = phase['non_router_charisma_control:post_adaptation'];
  const routerPost = phase['router_register_family:post_adaptation'];
  const controlDelta = deltas.non_router_charisma_control;
  const routerDelta = deltas.router_register_family;

  return TUTOR_DIMS.map((dim) => {
    const routerPostValue = routerPost?.dimMeans?.[dim] ?? null;
    const controlPostValue = controlPost?.dimMeans?.[dim] ?? null;
    const routerDeltaValue = routerDelta?.dimDeltas?.[dim] ?? null;
    const controlDeltaValue = controlDelta?.dimDeltas?.[dim] ?? null;
    return {
      dim,
      budgetPost: budgetPost?.dimMeans?.[dim] ?? null,
      controlPost: controlPostValue,
      routerPost: routerPostValue,
      postDiff: routerPostValue != null && controlPostValue != null ? routerPostValue - controlPostValue : null,
      controlDelta: controlDeltaValue,
      routerDelta: routerDeltaValue,
      deltaDiff: routerDeltaValue != null && controlDeltaValue != null ? routerDeltaValue - controlDeltaValue : null,
    };
  });
}

function buildClaimSummary({ phaseAgg, deltaAgg }) {
  const phase = groupAggMap(phaseAgg);
  const deltas = groupAggMap(deltaAgg);
  const routerPost = phase['router_register_family:post_adaptation'];
  const controlPost = phase['non_router_charisma_control:post_adaptation'];
  const budgetPost = phase['budget_floor:post_adaptation'];
  const routerDelta = deltas.router_register_family;
  const controlDelta = deltas.non_router_charisma_control;

  return {
    processRegisterHit:
      routerPost?.registerHitRate === 1 && phase['router_register_family:pre_instruction']?.registerHitRate === 1,
    routerPostRegisterHitRate: routerPost?.registerHitRate ?? null,
    routerPreRegisterHitRate: phase['router_register_family:pre_instruction']?.registerHitRate ?? null,
    routerPostAgency: routerPost?.agencyPassRate ?? null,
    controlPostAgency: controlPost?.agencyPassRate ?? null,
    routerPostV22: routerPost?.v22 ?? null,
    controlPostV22: controlPost?.v22 ?? null,
    budgetPostV22: budgetPost?.v22 ?? null,
    routerPostCharisma: routerPost?.charisma ?? null,
    controlPostCharisma: controlPost?.charisma ?? null,
    budgetPostCharisma: budgetPost?.charisma ?? null,
    routerV22Delta: routerDelta?.v22Delta ?? null,
    controlV22Delta: controlDelta?.v22Delta ?? null,
    routerCharismaDelta: routerDelta?.charismaDelta ?? null,
    controlCharismaDelta: controlDelta?.charismaDelta ?? null,
  };
}

function buildReport(data) {
  const { generatedAt, rows, slices, phaseAgg, profilePostAgg, rowAgg, deltaAgg, dimensionContrast, claimSummary } =
    data;

  const lines = [];
  lines.push('# Charisma Desire Register-Effect Decomposition');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- No new cells, no generation, and no new model calls.');
  lines.push(`- Scenario: \`${SWITCH_SCENARIO}\`.`);
  lines.push(
    '- Unit: the same 15 existing switch-scenario rows and 30 tutor-turn slices used by the adaptation-slice audit.',
  );
  lines.push(`- Slice-charisma source: \`${path.relative(ROOT, CACHE_PATH)}\`.`);
  lines.push(
    '- Question: if register routing did not create a unique charisma lift, did it change another observable?',
  );
  lines.push('');
  lines.push('## Short Answer');
  lines.push('');
  lines.push(
    `- Process effect: ${claimSummary.processRegisterHit ? 'yes' : 'no'} - router rows selected \`brisk\` on pre turns (${pct(
      claimSummary.routerPreRegisterHitRate,
    )}) and \`charismatic\` on post turns (${pct(claimSummary.routerPostRegisterHitRate)}).`,
  );
  lines.push(
    `- Charisma effect: no. Router post-slice charisma is ${fmt(
      claimSummary.routerPostCharisma,
    )}, below non-router charismatic controls at ${fmt(claimSummary.controlPostCharisma)}; router pre-to-post charisma delta is ${fmt(
      claimSummary.routerCharismaDelta,
    )}, below controls at ${fmt(claimSummary.controlCharismaDelta)}.`,
  );
  lines.push(
    `- General v2.2 quality effect: not meaningfully isolated. Router post-turn v2.2 is ${fmt(
      claimSummary.routerPostV22,
    )}, essentially tied with non-router controls at ${fmt(claimSummary.controlPostV22)}, and far above the budget floor at ${fmt(
      claimSummary.budgetPostV22,
    )}.`,
  );
  lines.push(
    `- Candidate effect: agency-return discipline. Router post-turn agency pass rate is ${pct(
      claimSummary.routerPostAgency,
    )} versus ${pct(claimSummary.controlPostAgency)} for the two non-router controls, but this is fragile because the sample is small and cells 181/183 still contain failures.`,
  );
  lines.push('');
  lines.push('## Row-Level Outcomes');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Group',
        'rows',
        'dialogue quality',
        'tutor holistic',
        'adaptive trajectory',
        'dialogue charisma',
        'required pass',
        'forbidden pass',
      ],
      rowAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.dialogueQuality),
        fmt(row.tutorHolistic),
        fmt(row.holisticDims.adaptive_trajectory, 2),
        fmt(row.dialogueCharisma),
        pct(row.passesRequiredRate),
        pct(row.passesForbiddenRate),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Turn-Slice Outcomes');
  lines.push('');
  lines.push(
    markdownTable(
      ['Group/Phase', 'n', 'v2.2 turn', 'slice charisma', 'agency pass', 'register hit', 'parse ok'],
      phaseAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.v22),
        fmt(row.charisma),
        pct(row.agencyPassRate),
        pct(row.registerHitRate),
        pct(row.parseOkRate),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Post-Turn Profile Detail');
  lines.push('');
  lines.push(
    markdownTable(
      ['Group/Profile/Register', 'n', 'v2.2 turn', 'slice charisma', 'agency pass', 'register hit'],
      profilePostAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.v22),
        fmt(row.charisma),
        pct(row.agencyPassRate),
        pct(row.registerHitRate),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Pre-To-Post Deltas');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Group',
        'pairs',
        'delta v2.2',
        'delta charisma',
        'delta adaptive responsiveness',
        'delta recognition',
        'delta elicitation',
      ],
      deltaAgg.map((row) => [
        row.key,
        String(row.n),
        fmt(row.v22Delta),
        fmt(row.charismaDelta),
        fmt(row.dimDeltas.adaptive_responsiveness, 2),
        fmt(row.dimDeltas.recognition_quality, 2),
        fmt(row.dimDeltas.elicitation_quality, 2),
      ]),
    ),
  );
  lines.push('');
  lines.push('## V2.2 Dimension Contrast');
  lines.push('');
  lines.push(
    markdownTable(
      [
        'Dimension',
        'budget post',
        'control post',
        'router post',
        'router-control post',
        'control delta',
        'router delta',
        'router-control delta',
      ],
      dimensionContrast.map((row) => [
        row.dim,
        fmt(row.budgetPost, 2),
        fmt(row.controlPost, 2),
        fmt(row.routerPost, 2),
        fmt(row.postDiff, 2),
        fmt(row.controlDelta, 2),
        fmt(row.routerDelta, 2),
        fmt(row.deltaDiff, 2),
      ]),
    ),
  );
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    'The register router visibly works as a process intervention: it turns the first response into brisk pacing and the second into a charismatic challenge register on every router-family row in this slice. That is not the same as proving an outcome gain.',
  );
  lines.push('');
  lines.push(
    'The outcome evidence says the wrong dependent variable was probably foregrounded. The router does not uniquely raise charisma and does not clearly beat strong non-router charismatic controls on v2.2 quality. Its plausible contribution is narrower: it stabilizes a defeasible, learner-returning challenge posture after the learner rejects worksheet-like instruction.',
  );
  lines.push('');
  lines.push(
    'That candidate effect should be treated as exploratory. The non-router comparator has only two rows, the router family mixes cells 180--184, and later repair attempts changed more than the register choice. The current evidence supports a revised design target: isolate agency-return and defeasible-authority outcomes on post-adaptation slices before optimizing for more Weberian charisma.',
  );
  lines.push('');
  lines.push(`Rows analyzed: ${rows.length}`);
  lines.push(`Slices analyzed: ${slices.length}`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const flags = parseArgs(process.argv);
  const checkOnly = flags.check === true;
  const runIds =
    typeof flags.runs === 'string'
      ? flags.runs
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : TARGET_RUN_IDS;

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  const placeholders = runIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT
         id,
         run_id,
         scenario_id,
         profile_name,
         suggestions,
         tutor_scores,
         tutor_holistic_scores,
         tutor_holistic_overall_score,
         learner_holistic_overall_score,
         dialogue_quality_score,
         tutor_charisma_overall_score,
         id_construction_trace,
         passes_required,
         passes_forbidden,
         success
       FROM evaluation_results
       WHERE run_id IN (${placeholders})
         AND scenario_id = ?
         AND success = 1
       ORDER BY profile_name, run_id, id`,
    )
    .all(...runIds, SWITCH_SCENARIO);

  const cache = loadCache();
  const slices = makeSlices(rows, cache);
  const phaseAgg = aggregateSlices(slices, (slice) => `${slice.profileGroup}:${slice.phase}`);
  const profilePostAgg = aggregateSlices(
    slices.filter((slice) => slice.phase === 'post_adaptation'),
    (slice) => `${slice.profileGroup}:${slice.profileLabel}:${slice.register}`,
  );
  const rowAgg = aggregateRows(rows, (row) => profileGroup(row.profile_name));
  const deltas = pairedDeltas(slices);
  const deltaAgg = aggregateDeltas(deltas, (row) => row.profileGroup);
  const dimensionContrast = buildDimensionContrast({ phaseAgg, deltaAgg });
  const claimSummary = buildClaimSummary({ phaseAgg, deltaAgg });
  const missingCharisma = slices.filter((slice) => slice.sliceCharisma == null);
  const missingScores = slices.filter((slice) => slice.v22TurnScore == null);

  const data = {
    generatedAt: new Date().toISOString(),
    scenario: SWITCH_SCENARIO,
    runIds,
    rows,
    slices,
    phaseAgg,
    profilePostAgg,
    rowAgg,
    deltaAgg,
    dimensionContrast,
    claimSummary,
    missing: {
      sliceCharisma: missingCharisma.length,
      v22TurnScore: missingScores.length,
    },
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  if (!checkOnly) {
    fs.writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`);
    fs.writeFileSync(REPORT_PATH, buildReport(data));
  }

  console.log(`Rows: ${rows.length}`);
  console.log(`Slices: ${slices.length}`);
  console.log(`Missing slice charisma: ${missingCharisma.length}`);
  console.log(`Missing v2.2 turn scores: ${missingScores.length}`);
  console.log(`Router post register hit: ${pct(claimSummary.routerPostRegisterHitRate)}`);
  console.log(`Router post agency pass: ${pct(claimSummary.routerPostAgency)}`);
  console.log(`Control post agency pass: ${pct(claimSummary.controlPostAgency)}`);
  console.log(`Router post charisma: ${fmt(claimSummary.routerPostCharisma)}`);
  console.log(`Control post charisma: ${fmt(claimSummary.controlPostCharisma)}`);
  console.log(`Router post v2.2: ${fmt(claimSummary.routerPostV22)}`);
  console.log(`Control post v2.2: ${fmt(claimSummary.controlPostV22)}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);

  if (rows.length !== 15 || slices.length !== 30 || missingCharisma.length > 0 || missingScores.length > 0) {
    process.exitCode = 1;
  }
}

main();
