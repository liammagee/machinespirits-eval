#!/usr/bin/env node
/**
 * Plan 3 DAG-SFS audit: proof-grounded selective recovery.
 *
 * This is the proof-DAG analogue of Selective Flip Score. The learner sees a
 * public micro-proof with exactly one withheld edge. Targeted feedback releases
 * that edge; mismatched/generic/nonsense feedback does not. A row counts only
 * if the learner proves the conclusion by citing the released target edge ID.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  backendDetail,
  callBackend,
  canonicalBackend,
  createCallCounter,
  fmt,
  mean,
  parseJsonResponse,
} from './run-yoked-contingency-g0-paid-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CONDITIONS = Object.freeze(['targeted', 'mismatched', 'generic', 'nonsense']);

const DEFAULTS = {
  backend: 'codex',
  cases: 'all',
  replicates: 5,
  conditions: CONDITIONS.join(','),
  maxCalls: null,
  outJson: path.join(ROOT, 'exports', 'plan3-dag-sfs-audit', 'dag-sfs-matched-feedback.json'),
  outMd: path.join(ROOT, 'exports', 'plan3-dag-sfs-audit', 'dag-sfs-matched-feedback.md'),
};

export const DAG_CASES = Object.freeze([
  {
    id: 'gate_aven_stamp_noro',
    domain: 'formal gate ledger',
    targetConclusion: 'mira may pass gate aven',
    knownEdges: [
      { id: 'E1', text: 'mira has tag kall' },
      { id: 'E2', text: 'any record with tag kall has bridge fenn' },
      { id: 'E3', text: 'any record with bridge fenn and stamp noro may pass gate aven' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'mira has stamp noro',
      requiredTerms: ['mira', 'stamp noro'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'mira has ribbon pel',
      requiredTerms: ['ribbon pel'],
    },
    missingDescription: 'whether mira has stamp noro',
  },
  {
    id: 'archive_luma_seal_vecc',
    domain: 'archive rule ledger',
    targetConclusion: 'luma belongs in shelf vecc',
    knownEdges: [
      { id: 'E1', text: 'luma is a blue folio' },
      { id: 'E2', text: 'every blue folio with seal vecc belongs in shelf vecc' },
      { id: 'E3', text: 'blue folio status alone is insufficient for shelf vecc' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'luma has seal vecc',
      requiredTerms: ['luma', 'seal vecc'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'luma has clasp dorn',
      requiredTerms: ['clasp dorn'],
    },
    missingDescription: 'whether luma has seal vecc',
  },
  {
    id: 'garden_siva_key_renn',
    domain: 'garden permit ledger',
    targetConclusion: 'siva can open plot renn',
    knownEdges: [
      { id: 'E1', text: 'siva holds permit amber' },
      { id: 'E2', text: 'permit amber with key renn gives access to plot renn' },
      { id: 'E3', text: 'without key renn, permit amber does not open plot renn' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'siva holds key renn',
      requiredTerms: ['siva', 'key renn'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'siva holds token mar',
      requiredTerms: ['token mar'],
    },
    missingDescription: 'whether siva holds key renn',
  },
  {
    id: 'lab_nemi_phase_tor',
    domain: 'laboratory transition ledger',
    targetConclusion: 'nemi reaches phase tor',
    knownEdges: [
      { id: 'E1', text: 'nemi contains reagent sol' },
      { id: 'E2', text: 'a sample with reagent sol and buffer tor reaches phase tor' },
      { id: 'E3', text: 'reagent sol without buffer tor remains below phase tor' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'nemi contains buffer tor',
      requiredTerms: ['nemi', 'buffer tor'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'nemi contains dye hal',
      requiredTerms: ['dye hal'],
    },
    missingDescription: 'whether nemi contains buffer tor',
  },
  {
    id: 'route_orra_badge_senn',
    domain: 'route authorization ledger',
    targetConclusion: 'orra may use route senn',
    knownEdges: [
      { id: 'E1', text: 'orra is assigned convoy nine' },
      { id: 'E2', text: 'convoy nine with badge senn may use route senn' },
      { id: 'E3', text: 'convoy assignment is not itself route authorization' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'orra has badge senn',
      requiredTerms: ['orra', 'badge senn'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'orra has badge lusk',
      requiredTerms: ['badge lusk'],
    },
    missingDescription: 'whether orra has badge senn',
  },
  {
    id: 'clinic_pavo_clearance_mek',
    domain: 'clinic clearance ledger',
    targetConclusion: 'pavo is cleared for room mek',
    knownEdges: [
      { id: 'E1', text: 'pavo completed intake form' },
      { id: 'E2', text: 'intake completion plus signed check mek clears room mek' },
      { id: 'E3', text: 'intake completion without check mek is not room clearance' },
    ],
    targetEdge: {
      id: 'T1',
      text: 'check mek is signed for pavo',
      requiredTerms: ['check mek', 'pavo'],
    },
    mismatchedEdge: {
      id: 'M1',
      text: 'check nald is signed for pavo',
      requiredTerms: ['check nald'],
    },
    missingDescription: 'whether check mek is signed for pavo',
  },
]);

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--backend') args.backend = argv[++i];
    else if (token === '--cases') args.cases = argv[++i];
    else if (token === '--conditions') args.conditions = argv[++i];
    else if (token === '--replicates') args.replicates = Number(argv[++i]);
    else if (token === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (token === '--out-json') args.outJson = argv[++i];
    else if (token === '--out-md') args.outMd = argv[++i];
    else if (token === '--dry-run') args.backend = 'mock';
    else if (token === '--no-write') args.write = false;
    else if (token === '-h' || token === '--help') {
      console.log(`Usage: node scripts/run-plan3-dag-sfs-audit.js [options]

Options:
  --backend <codex|claude-code[:model]|openrouter[:model]|agy[:model]|mock>
                           Learner retry generator (default: codex)
  --cases <all|csv>        Micro-proof cases to include (default: all)
  --conditions <csv>       Conditions to include (default: targeted,mismatched,generic,nonsense)
  --replicates <n>         Matched condition sets per case (default: 5; all cases = 120 calls)
  --max-calls <n>          Hard model-call cap (default: cases * replicates * conditions)
  --out-json <path>        JSON artifact path
  --out-md <path>          Markdown report path
  --dry-run                Use deterministic mock responses
  --no-write               Run without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${token}`);
    }
  }
  if (!Number.isInteger(args.replicates) || args.replicates < 1) {
    throw new Error('--replicates must be a positive integer');
  }
  if (args.maxCalls != null && (!Number.isInteger(args.maxCalls) || args.maxCalls < 1)) {
    throw new Error('--max-calls must be a positive integer');
  }
  return args;
}

function selectedCases(raw) {
  if (!raw || raw === 'all') return [...DAG_CASES];
  const ids = String(raw)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const byId = new Map(DAG_CASES.map((c) => [c.id, c]));
  const invalid = ids.filter((id) => !byId.has(id));
  if (invalid.length) throw new Error(`unknown DAG-SFS cases: ${invalid.join(', ')}`);
  return ids.map((id) => byId.get(id));
}

function selectedConditions(raw) {
  const conditions = String(raw || DEFAULTS.conditions)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const invalid = conditions.filter((condition) => !CONDITIONS.includes(condition));
  if (invalid.length) throw new Error(`unknown DAG-SFS conditions: ${invalid.join(', ')}`);
  if (!conditions.includes('targeted')) throw new Error('--conditions must include targeted');
  return [...new Set(conditions)];
}

function feedbackFor(dagCase, condition) {
  if (condition === 'targeted') {
    return {
      releasedEdgeId: dagCase.targetEdge.id,
      text: `New public evidence ${dagCase.targetEdge.id}: ${dagCase.targetEdge.text}.`,
    };
  }
  if (condition === 'mismatched') {
    return {
      releasedEdgeId: dagCase.mismatchedEdge.id,
      text: `New public evidence ${dagCase.mismatchedEdge.id}: ${dagCase.mismatchedEdge.text}.`,
    };
  }
  if (condition === 'nonsense') {
    return {
      releasedEdgeId: null,
      text: 'Tutor comment: blue lanterns hum sideways under the paper moon. This is not a public proof edge.',
    };
  }
  return {
    releasedEdgeId: null,
    text: 'Tutor comment: slow down, check the ledger, and make only the claim that the public proof supports. No new proof edge is released.',
  };
}

function buildSpecs({ cases, replicates, conditions }) {
  const specs = [];
  for (const dagCase of cases) {
    for (let replicate = 1; replicate <= replicates; replicate += 1) {
      for (const condition of conditions) {
        const feedback = feedbackFor(dagCase, condition);
        specs.push({
          rowId: `dag-sfs-${dagCase.id}-r${String(replicate).padStart(2, '0')}-${condition}`,
          caseId: dagCase.id,
          domain: dagCase.domain,
          condition,
          replicate,
          dagCase,
          feedback,
        });
      }
    }
  }
  return specs;
}

function renderEdges(edges) {
  return edges.map((edge) => `- ${edge.id}: ${edge.text}`).join('\n');
}

function buildLearnerPrompt(spec) {
  const { dagCase, feedback } = spec;
  return `You are simulating one visible learner retry in a proof-DAG tutoring harness.

Important rule: use only the public proof ledger and the new tutor feedback below.
Do not infer hidden facts. Do not use common sense. These are invented formal tokens.
If the required edge is still not public, do not prove the target. Mark status "still_missing".

Domain:
${dagCase.domain}

Target conclusion:
${dagCase.targetConclusion}

Public proof ledger before tutor feedback:
${renderEdges(dagCase.knownEdges)}

The learner's prior state:
I cannot prove "${dagCase.targetConclusion}" yet because the public ledger has not established ${dagCase.missingDescription}.

Tutor feedback:
${feedback.text}

Return JSON only:
{
  "status": "proved | still_missing | unsupported_guess",
  "claim": "one sentence",
  "used_edge_ids": ["edge ids used, exact IDs only"],
  "derivation": ["short public derivation steps, each citing edge IDs"],
  "missing_edge_ids": ["edge ids still missing, exact IDs only"],
  "confidence": 0.0
}`;
}

function mockLearnerResponse(spec) {
  if (spec.condition === 'targeted') {
    return {
      status: 'proved',
      claim: spec.dagCase.targetConclusion,
      used_edge_ids: ['E1', 'E2', 'E3', spec.dagCase.targetEdge.id],
      derivation: [
        `E1 and E2 establish the intermediate condition.`,
        `E3 plus ${spec.dagCase.targetEdge.id} establish ${spec.dagCase.targetConclusion}.`,
      ],
      missing_edge_ids: [],
      confidence: 0.82,
    };
  }
  return {
    status: 'still_missing',
    claim: `I still cannot prove ${spec.dagCase.targetConclusion}.`,
    used_edge_ids: ['E1', 'E2', 'E3'].concat(spec.feedback.releasedEdgeId ? [spec.feedback.releasedEdgeId] : []),
    derivation: [`The public ledger still lacks ${spec.dagCase.targetEdge.id}.`],
    missing_edge_ids: [spec.dagCase.targetEdge.id],
    confidence: 0.34,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function normalizeId(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function includesAllTerms(text, terms) {
  const hay = String(text || '').toLowerCase();
  return terms.every((term) => hay.includes(String(term).toLowerCase()));
}

function responseText(parsed) {
  return [
    parsed.status,
    parsed.claim,
    ...asArray(parsed.used_edge_ids),
    ...asArray(parsed.derivation),
    ...asArray(parsed.missing_edge_ids),
  ].join('\n');
}

export function scoreDagSfsRow(spec, parsed) {
  const status = String(parsed.status || '').trim().toLowerCase();
  const validStatus = ['proved', 'still_missing', 'unsupported_guess'].includes(status);
  const usedEdgeIds = asArray(parsed.used_edge_ids).map(normalizeId).filter(Boolean);
  const missingEdgeIds = asArray(parsed.missing_edge_ids).map(normalizeId).filter(Boolean);
  const allText = responseText(parsed);
  const targetEdgeId = normalizeId(spec.dagCase.targetEdge.id);
  const targetEdgeUsed = usedEdgeIds.includes(targetEdgeId);
  const conclusionMentioned = includesAllTerms(allText, spec.dagCase.targetConclusion.split(/\s+/));
  const targetTermsMentioned = includesAllTerms(allText, spec.dagCase.targetEdge.requiredTerms);
  const proofGrounded = validStatus && status === 'proved' && targetEdgeUsed && conclusionMentioned;
  const unsupportedConclusion = validStatus && status === 'proved' && !targetEdgeUsed;
  const correctlyWithheld = validStatus && spec.condition !== 'targeted' && status === 'still_missing' && !targetEdgeUsed;
  return {
    validStatus,
    status,
    usedEdgeIds,
    missingEdgeIds,
    targetEdgeUsed,
    targetTermsMentioned,
    conclusionMentioned,
    proofGrounded,
    unsupportedConclusion,
    correctlyWithheld,
  };
}

async function generateRow({ spec, backend, callCounter }) {
  let parsed;
  let parseError = null;
  try {
    if (canonicalBackend(backend) === 'mock') {
      parsed = mockLearnerResponse(spec);
    } else {
      callCounter.increment('learner_retry');
      parsed = parseJsonResponse(await callBackend(buildLearnerPrompt(spec), backend));
    }
  } catch (error) {
    parsed = {
      status: 'parse_error',
      claim: '',
      used_edge_ids: [],
      derivation: [],
      missing_edge_ids: [],
      confidence: null,
    };
    parseError = error.message;
  }

  const score = scoreDagSfsRow(spec, parsed);
  return {
    rowId: spec.rowId,
    caseId: spec.caseId,
    domain: spec.domain,
    condition: spec.condition,
    replicate: spec.replicate,
    targetConclusion: spec.dagCase.targetConclusion,
    knownEdges: spec.dagCase.knownEdges,
    targetEdge: spec.dagCase.targetEdge,
    mismatchedEdge: spec.dagCase.mismatchedEdge,
    feedbackReleasedEdgeId: spec.feedback.releasedEdgeId,
    feedback: spec.feedback.text,
    parsed,
    parseError,
    score,
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : null,
  };
}

function sd(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function rate(rows, predicate) {
  return rows.length ? rows.filter(predicate).length / rows.length : null;
}

function summarizeRows(rows, conditions = CONDITIONS) {
  const byCondition = Object.fromEntries(
    conditions.map((condition) => {
      const subset = rows.filter((row) => row.condition === condition);
      return [
        condition,
        {
          n: subset.length,
          valid: subset.filter((row) => row.score.validStatus).length,
          proofGroundedRate: rate(subset, (row) => row.score.proofGrounded),
          correctlyWithheldRate: rate(subset, (row) => row.score.correctlyWithheld),
          unsupportedConclusionRate: rate(subset, (row) => row.score.unsupportedConclusion),
          targetEdgeUsedRate: rate(subset, (row) => row.score.targetEdgeUsed),
          meanConfidence: Number(mean(subset.map((row) => row.confidence).filter(Number.isFinite)).toFixed(3)),
        },
      ];
    }),
  );
  const negativeConditions = conditions.filter((condition) => condition !== 'targeted');
  const falseGroundedRate = mean(negativeConditions.map((condition) => byCondition[condition].proofGroundedRate || 0));
  const selectiveProofScore = (byCondition.targeted?.proofGroundedRate || 0) - falseGroundedRate;
  const matchedDeltas = [];
  const keys = new Set(rows.map((row) => `${row.caseId}:r${row.replicate}`));
  for (const key of keys) {
    const targeted = rows.find((row) => `${row.caseId}:r${row.replicate}` === key && row.condition === 'targeted');
    const negatives = negativeConditions
      .map((condition) => rows.find((row) => `${row.caseId}:r${row.replicate}` === key && row.condition === condition))
      .filter(Boolean);
    if (!targeted || negatives.length !== negativeConditions.length) continue;
    matchedDeltas.push(
      (targeted.score.proofGrounded ? 1 : 0) - mean(negatives.map((row) => (row.score.proofGrounded ? 1 : 0))),
    );
  }
  const pairedMean = mean(matchedDeltas);
  const pairedSe = matchedDeltas.length > 1 ? sd(matchedDeltas) / Math.sqrt(matchedDeltas.length) : 0;
  return {
    n: rows.length,
    validStatusRate: rate(rows, (row) => row.score.validStatus),
    byCondition,
    falseGroundedRate: Number(falseGroundedRate.toFixed(3)),
    selectiveProofScore: Number(selectiveProofScore.toFixed(3)),
    pairedSelectiveProof: {
      n: matchedDeltas.length,
      mean: Number(pairedMean.toFixed(3)),
      se: Number(pairedSe.toFixed(3)),
      ci95: [Number((pairedMean - 1.96 * pairedSe).toFixed(3)), Number((pairedMean + 1.96 * pairedSe).toFixed(3))],
      positive: matchedDeltas.filter((x) => x > 0).length,
      zero: matchedDeltas.filter((x) => x === 0).length,
      negative: matchedDeltas.filter((x) => x < 0).length,
    },
  };
}

function classifyBoundary(summary) {
  const targeted = summary.byCondition.targeted?.proofGroundedRate || 0;
  const falseGrounded = summary.falseGroundedRate;
  const dagSfs = summary.selectiveProofScore;
  if (targeted >= 0.8 && falseGrounded <= 0.2 && dagSfs >= 0.6) return 'proof_selective_harness_signal';
  if (dagSfs <= 0.1 && targeted >= 0.5 && falseGrounded >= 0.4) return 'near_zero_proof_selectivity';
  if (targeted <= 0.3 && falseGrounded <= 0.2) return 'overconstrained_nonresponsive';
  return 'mixed_proof_selectivity';
}

export async function runDagSfsAudit({
  backend = DEFAULTS.backend,
  cases = DEFAULTS.cases,
  replicates = DEFAULTS.replicates,
  conditions = DEFAULTS.conditions,
  maxCalls = DEFAULTS.maxCalls,
} = {}) {
  const selected = selectedCases(cases);
  const selectedConditionList = selectedConditions(conditions);
  const specs = buildSpecs({ cases: selected, replicates, conditions: selectedConditionList });
  const callCounter = createCallCounter(maxCalls || specs.length);
  const rows = [];
  for (const spec of specs) {
    console.log(`plan3 DAG-SFS: ${spec.rowId} via ${backend}`);
    rows.push(await generateRow({ spec, backend, callCounter }));
  }
  const summary = summarizeRows(rows, selectedConditionList);
  summary.byCase = Object.fromEntries(
    selected.map((dagCase) => [
      dagCase.id,
      summarizeRows(
        rows.filter((row) => row.caseId === dagCase.id),
        selectedConditionList,
      ),
    ]),
  );
  summary.modelCalls = callCounter.counts;
  summary.parseErrorCount = rows.filter((row) => row.parseError).length;
  summary.boundary = classifyBoundary(summary);
  return {
    schema: 'plan3_dag_sfs_matched_feedback_v0',
    generatedAt: new Date().toISOString(),
    status: summary.parseErrorCount === 0 ? 'complete_dag_sfs' : 'complete_dag_sfs_with_parse_errors',
    boundary:
      'Fresh matched proof-DAG targeted/mismatched/generic/nonsense feedback corpus for proof-grounded selective recovery.',
    backend: canonicalBackend(backend),
    backendDetail: backendDetail(backend),
    controls: {
      cases: selected.map((dagCase) => dagCase.id),
      replicates,
      conditions: selectedConditionList,
      expectedRows: specs.length,
      scoringRule:
        'proved rows count only when status is proved, target conclusion is stated, and the exact released target edge ID is cited',
    },
    summary,
    rows,
  };
}

function escapeCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function renderDagSfsReport(result) {
  const lines = [];
  lines.push('# Plan 3 DAG-SFS proof-grounded audit');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push(`Boundary: ${result.summary.boundary}`);
  lines.push(`Backend: ${result.backendDetail?.label || result.backend}`);
  lines.push(`Rows: ${result.rows.length}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Condition Summary');
  lines.push('');
  lines.push('| condition | n | valid | proof-grounded | correctly withheld | unsupported conclusion | target-edge used | mean confidence |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const condition of result.controls.conditions) {
    const row = result.summary.byCondition[condition];
    lines.push(
      `| ${condition} | ${row.n} | ${row.valid} | ${fmt(row.proofGroundedRate)} | ${fmt(
        row.correctlyWithheldRate,
      )} | ${fmt(row.unsupportedConclusionRate)} | ${fmt(row.targetEdgeUsedRate)} | ${fmt(row.meanConfidence)} |`,
    );
  }
  lines.push('');
  lines.push(`- DAG-SFS selective proof score: ${fmt(result.summary.selectiveProofScore)}`);
  lines.push(`- False-grounded rate (negative-condition mean): ${fmt(result.summary.falseGroundedRate)}`);
  lines.push(
    `- Paired DAG-SFS: ${fmt(result.summary.pairedSelectiveProof.mean)} ` +
      `(95% CI ${fmt(result.summary.pairedSelectiveProof.ci95[0])} to ${fmt(
        result.summary.pairedSelectiveProof.ci95[1],
      )}; positive ${result.summary.pairedSelectiveProof.positive}/${result.summary.pairedSelectiveProof.n})`,
  );
  lines.push(`- Boundary classification: ${result.summary.boundary}`);
  lines.push('');
  lines.push('## Case Summary');
  lines.push('');
  lines.push('| case | targeted proof-grounded | negative false-grounded | DAG-SFS |');
  lines.push('|---|---:|---:|---:|');
  for (const [caseId, row] of Object.entries(result.summary.byCase)) {
    lines.push(
      `| ${caseId} | ${fmt(row.byCondition.targeted.proofGroundedRate)} | ${fmt(row.falseGroundedRate)} | ${fmt(
        row.selectiveProofScore,
      )} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  lines.push(
    'DAG-SFS is positive when targeted feedback releases the withheld proof edge and produces proof-grounded recovery more often than wrong-edge, generic, or nonsense feedback. Rows count only when the learner cites the exact target edge ID, so final-answer guessing is not enough.',
  );
  lines.push('');
  lines.push('This remains a synthetic learner harness audit, not human learning evidence.');
  lines.push('');
  lines.push('## Example Rows');
  lines.push('');
  lines.push('| row | case | condition | status | proof-grounded | used edges | claim |');
  lines.push('|---|---|---|---|---:|---|---|');
  for (const row of result.rows.slice(0, 24)) {
    lines.push(
      `| ${row.rowId} | ${row.caseId} | ${row.condition} | ${row.score.status} | ${
        row.score.proofGrounded ? 'yes' : 'no'
      } | ${escapeCell(row.score.usedEdgeIds.join(', ') || 'none')} | ${escapeCell(row.parsed.claim)} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function writeArtifacts({ result, outJson, outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderDagSfsReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDagSfsAudit(args);
  if (args.write) {
    writeArtifacts({ result, outJson: path.resolve(args.outJson), outMd: path.resolve(args.outMd) });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: dag_sfs=${fmt(result.summary.selectiveProofScore)} targeted=${fmt(
      result.summary.byCondition.targeted.proofGroundedRate,
    )} false_grounded=${fmt(result.summary.falseGroundedRate)} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('FATAL:', error);
    process.exit(1);
  });
}
