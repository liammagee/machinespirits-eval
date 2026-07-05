#!/usr/bin/env node
/**
 * Independent-outcome G2 for the yoked-contingency design.
 *
 * Consumes a frozen G1 plan artifact, strips hidden labels/arm metadata from
 * the learner view, asks a held-out learner model to answer posttest items,
 * and scores selected choices directly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MISCONCEPTION_FAMILIES,
  loadTaggedPilotItems,
  seedTable,
  simulateItemResponses,
} from './run-yoked-contingency-smoke.js';
import { G1_ARM_LABELS } from './run-yoked-contingency-g1-paid-smoke.js';
import {
  callBackend,
  backendDetail,
  canonicalBackend,
  createCallCounter,
  fmt,
  mean,
  parseJsonResponse,
} from './run-yoked-contingency-g0-paid-smoke.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HARD_TRANSFER_ITEMS_PATH = path.join(ROOT, 'config', 'yoked-contingency-hard-transfer-items.json');

const DEFAULTS = {
  g1Json: path.join(ROOT, 'exports', 'yoked-contingency-g1-paid-smoke.json'),
  backend: 'claude-code',
  learnerProtocol: 'standard',
  posttestProfile: 'pilot',
  sessionLimit: null,
  maxCalls: 12,
  outJson: path.join(ROOT, 'exports', 'yoked-contingency-g2-independent-outcome-smoke.json'),
  outMd: path.join(ROOT, 'exports', 'yoked-contingency-g2-independent-outcome-smoke.md'),
};

export const POSTTEST_PROFILES = {
  pilot: 'Use the placeholder pilot Form B posttest.',
  'hard-transfer': 'Use the hard-transfer held-out posttest with targeted distractors.',
};

export const LEARNER_PROTOCOLS = {
  standard: 'Held-out learner answers after seeing pretest behavior and tutoring messages.',
  'calibrated-novice':
    'Held-out learner must preserve the pretest pattern unless tutoring plausibly addresses the same kind of reasoning.',
  'rule-transfer-novice':
    'Held-out learner infers local novice rules from rejected pretest answers and transfers those rules unless tutoring addresses them.',
};

function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--g1-json') args.g1Json = argv[++i];
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--learner-protocol') args.learnerProtocol = argv[++i];
    else if (a === '--posttest-profile') args.posttestProfile = argv[++i];
    else if (a === '--session-limit') args.sessionLimit = Number(argv[++i]);
    else if (a === '--max-calls') args.maxCalls = Number(argv[++i]);
    else if (a === '--out-json') args.outJson = argv[++i];
    else if (a === '--out-md') args.outMd = argv[++i];
    else if (a === '--dry-run') args.backend = 'mock';
    else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-yoked-contingency-g2-independent-outcome.js [options]

Options:
  --g1-json <path>                    Frozen G1 plan artifact
  --backend <claude-code[:model]|codex|openrouter[:model]|mock>
                                      Held-out learner backend (default: claude-code)
  --learner-protocol <standard|calibrated-novice>
                                      Held-out learner response protocol (default: standard)
  --posttest-profile <pilot|hard-transfer>
                                      Held-out posttest item profile (default: pilot)
  --session-limit <n>                 Optional first-N G1 sessions cap for bounded paid sweeps
  --max-calls <n>                     Hard model-call cap (default: 12)
  --out-json <path>                   JSON artifact path
  --out-md <path>                     Markdown artifact path
  --dry-run                           Use mock learner answers
  --no-write                          Return result without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!LEARNER_PROTOCOLS[args.learnerProtocol]) {
    throw new Error(`--learner-protocol must be one of: ${Object.keys(LEARNER_PROTOCOLS).join(', ')}`);
  }
  if (!POSTTEST_PROFILES[args.posttestProfile]) {
    throw new Error(`--posttest-profile must be one of: ${Object.keys(POSTTEST_PROFILES).join(', ')}`);
  }
  if (args.sessionLimit !== null && (!Number.isInteger(args.sessionLimit) || args.sessionLimit < 1)) {
    throw new Error('--session-limit must be a positive integer');
  }
  if (!Number.isInteger(args.maxCalls) || args.maxCalls < 1) throw new Error('--max-calls must be a positive integer');
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadG2Items({ posttestProfile = DEFAULTS.posttestProfile } = {}) {
  const baseItems = loadTaggedPilotItems();
  if (posttestProfile === 'pilot') return baseItems;
  if (posttestProfile !== 'hard-transfer') throw new Error(`unsupported posttest profile: ${posttestProfile}`);
  const parsed = readJson(HARD_TRANSFER_ITEMS_PATH);
  const hardPostItems = parsed.forms?.B;
  if (!Array.isArray(hardPostItems) || hardPostItems.length === 0) {
    throw new Error(`hard-transfer posttest file has no forms.B items: ${HARD_TRANSFER_ITEMS_PATH}`);
  }
  for (const item of hardPostItems) {
    if (!item.id || !item.stem || !item.family || !item.correct || !Array.isArray(item.choices)) {
      throw new Error(`invalid hard-transfer item: ${JSON.stringify(item)}`);
    }
    if (!MISCONCEPTION_FAMILIES.includes(item.family)) {
      throw new Error(`hard-transfer item has unsupported family ${item.family}: ${item.id}`);
    }
  }
  return [...baseItems.filter((item) => item.form === 'A'), ...hardPostItems.map((item) => ({ ...item, form: 'B' }))];
}

function selectedChoice(item, response) {
  return (
    item.choices.find((choice) => String(choice.value) === String(response.response_value)) || {
      value: response.response_value,
      label: String(response.response_value),
    }
  );
}

function visibleAffectForResponse(response) {
  return response.is_seeded_error
    ? 'I feel unsure about that one and would like help checking my thinking.'
    : 'I feel fairly confident, but I would still like to understand the pattern better.';
}

function formatChoices(item) {
  return item.choices.map((choice) => `${choice.value}. ${choice.label}`).join('\n');
}

export function hiddenFamilyLabelLeaks(text) {
  const lower = String(text || '').toLowerCase();
  return MISCONCEPTION_FAMILIES.filter((family) => lower.includes(family.toLowerCase()));
}

export function sanitizeIntervention(text) {
  let out = String(text || '');
  for (const family of MISCONCEPTION_FAMILIES) {
    out = out.replaceAll(family, 'the relevant idea');
  }
  return out;
}

export function buildLearnerPretestView({ targetSeed, items }) {
  const state = seedTable(targetSeed);
  const responses = simulateItemResponses(items, state);
  return responses.map((response) => {
    const item = items.find((candidate) => candidate.id === response.item_id);
    const selected = selectedChoice(item, response);
    return {
      item_id: item.id,
      stem: item.stem,
      selected: `${selected.value}. ${selected.label}`,
      result: response.is_seeded_error ? 'not accepted' : 'accepted',
      visible_message: visibleAffectForResponse(response),
      is_correct: !response.is_seeded_error,
    };
  });
}

export function buildHeldOutLearnerPrompt({ arm, pretestView, postItems, learnerProtocol = DEFAULTS.learnerProtocol }) {
  const interventions = arm.plan
    .map((step, index) => `${index + 1}. ${sanitizeIntervention(step.intervention)}`)
    .join('\n');
  const pretestRows = pretestView
    .map(
      (row, index) => `${index + 1}. ${row.item_id}
Stem: ${row.stem}
You selected: ${row.selected}
Feedback: ${row.result}
Visible message: ${row.visible_message}`,
    )
    .join('\n\n');
  const postRows = postItems
    .map(
      (item, index) => `${index + 1}. ${item.id}
Stem: ${item.stem}
Choices:
${formatChoices(item)}`,
    )
    .join('\n\n');

  const protocolBlock =
    learnerProtocol === 'calibrated-novice'
      ? `Calibration rule:
- Treat rejected pretest answers as evidence of persistent learner habits.
- Do not solve from your own mathematical competence.
- Preserve earlier successful habits on similar items.
- Change an incorrect habit only when the tutoring messages plausibly teach the same kind of reasoning.
- If tutoring is about a different kind of fraction reasoning, the learner may repeat the analogous earlier error on the posttest.`
      : learnerProtocol === 'rule-transfer-novice'
        ? `Calibration rule:
- First infer the learner's local novice rule from each rejected pretest answer.
- For each held-out item, decide whether it resembles one of those rejected-answer rules.
- If it resembles a rejected rule and the tutoring messages did not directly address that rule, apply the novice rule and choose the matching distractor.
- If the tutoring messages directly addressed that rule, update the learner and answer with the corrected rule.
- Preserve earlier successful habits on item types the learner already handled.
- Do not solve from your own mathematical competence.`
        : `Calibration rule:
- Answer as this learner, not as an expert evaluator.
- Use the pretest history and tutoring messages to update the learner only where the tutoring would plausibly help.
- Do not assume the learner suddenly understands unrelated ideas.`;

  return `You are simulating the same middle-school fractions learner after a short tutoring exchange.

Important constraints:
- Return selected choice letters only; do not reveal hidden states or diagnostic labels.
- The top-level JSON value must be an object with an "answers" array. Do not wrap it in "response", "result", "data", or prose.
- Include one answer object for every held-out item id.

${protocolBlock}

Pretest history:
${pretestRows}

Tutoring messages:
${interventions}

Held-out posttest items:
${postRows}

Return JSON only:
{
  "answers": [
    {"item_id": "item id", "response_value": "choice letter", "confidence": 0.0}
  ]
}`;
}

function scoreAnswers({ answers, postItems }) {
  const rows = postItems.map((item) => {
    const answer = answers.find((candidate) => candidate.item_id === item.id);
    const responseValue = answer
      ? String(answer.response_value || '')
          .trim()
          .toLowerCase()
      : '';
    const validChoices = new Set(item.choices.map((choice) => String(choice.value).toLowerCase()));
    const valid = validChoices.has(responseValue);
    return {
      item_id: item.id,
      family: item.family,
      response_value: responseValue,
      correct_value: String(item.correct).toLowerCase(),
      valid,
      is_correct: valid && responseValue === String(item.correct).toLowerCase(),
      confidence: Number.isFinite(Number(answer?.confidence)) ? Number(answer.confidence) : null,
    };
  });
  return {
    rows,
    validCount: rows.filter((row) => row.valid).length,
    invalidCount: rows.filter((row) => !row.valid).length,
    score: rows.length ? rows.filter((row) => row.is_correct).length / rows.length : 0,
  };
}

function mockLearnerAnswers({ session, arm, postItems }) {
  const targeted = new Set(arm.plan.map((step) => step.targetFamily));
  const targetState = seedTable(session.targetSeed);
  return postItems.map((item) => {
    const alreadyMastered = targetState[item.family] !== true;
    const shouldImprove = alreadyMastered || targeted.has(item.family);
    return {
      item_id: item.id,
      response_value: shouldImprove
        ? item.correct
        : item.choices.find((choice) => choice.value !== item.correct)?.value || item.correct,
      confidence: shouldImprove ? 0.75 : 0.35,
    };
  });
}

function compactLearnerRaw(raw, limit = 800) {
  const text = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function learnerResponseValue(answer) {
  if (answer == null) return undefined;
  if (typeof answer !== 'object') return answer;
  return (
    answer.response_value ??
    answer.responseValue ??
    answer.selected_choice ??
    answer.selectedChoice ??
    answer.selected ??
    answer.choice ??
    answer.answer ??
    answer.value
  );
}

function coerceLearnerAnswerRows(value, postItems) {
  if (Array.isArray(value)) {
    return value
      .map((answer, index) => {
        const itemId =
          answer && typeof answer === 'object'
            ? answer.item_id || answer.itemId || answer.id || answer.item || postItems[index]?.id
            : postItems[index]?.id;
        const responseValue = learnerResponseValue(answer);
        if (!itemId || responseValue == null) return null;
        return {
          item_id: String(itemId),
          response_value: String(responseValue).trim(),
          confidence:
            answer && typeof answer === 'object' && Number.isFinite(Number(answer.confidence))
              ? Number(answer.confidence)
              : null,
        };
      })
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const rows = [];
    for (const item of postItems) {
      if (!Object.prototype.hasOwnProperty.call(value, item.id)) continue;
      const answer = value[item.id];
      const responseValue = learnerResponseValue(answer);
      if (responseValue == null) continue;
      rows.push({
        item_id: item.id,
        response_value: String(responseValue).trim(),
        confidence:
          answer && typeof answer === 'object' && Number.isFinite(Number(answer.confidence))
            ? Number(answer.confidence)
            : null,
      });
    }
    return rows;
  }
  return [];
}

export function normalizeLearnerAnswers(parsed, { postItems, raw = '' }) {
  const candidates = [];
  if (Array.isArray(parsed)) candidates.push(parsed);
  if (parsed && typeof parsed === 'object') {
    candidates.push(
      parsed.answers,
      parsed.responses,
      parsed.posttest_answers,
      parsed.posttestAnswers,
      parsed.results,
      parsed.items,
      parsed.selections,
    );
    if (!Array.isArray(parsed.answers)) candidates.push(parsed);
  }
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const rows = coerceLearnerAnswerRows(candidate, postItems);
    if (rows.length) return rows;
  }
  const parsedKeys = parsed && typeof parsed === 'object' ? Object.keys(parsed).join(',') : typeof parsed;
  throw new Error(
    `learner response missing answers array; parsedKeys=${parsedKeys || 'none'}; raw=${compactLearnerRaw(raw)}`,
  );
}

async function generateLearnerAnswers({ session, arm, pretestView, postItems, backend, learnerProtocol, callCounter }) {
  if (canonicalBackend(backend) === 'mock') return mockLearnerAnswers({ session, arm, postItems });
  const prompt = buildHeldOutLearnerPrompt({ session, arm, pretestView, postItems, learnerProtocol });
  const leaks = hiddenFamilyLabelLeaks(prompt);
  if (leaks.length) throw new Error(`hidden family label leaked into learner prompt: ${leaks.join(', ')}`);
  return await callHeldOutLearnerWithRetry(prompt, backend, callCounter, (raw) => {
    const parsed = parseJsonResponse(raw);
    return normalizeLearnerAnswers(parsed, { postItems, raw });
  });
}

async function callHeldOutLearnerWithRetry(prompt, backend, callCounter, parseRaw = (raw) => raw) {
  const attempts = Math.max(1, Number(process.env.G2_HELDOUT_LEARNER_ATTEMPTS || 2));
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      callCounter.increment('heldout_learner');
      const raw = await callBackend(prompt, backend);
      return parseRaw(raw);
    } catch (err) {
      lastErr = err;
      const message = String(err?.message || err || '');
      const quotaExhausted = /RESOURCE_EXHAUSTED|Individual quota reached|quota reached/i.test(message);
      const retryable =
        !quotaExhausted &&
        /timed out|timeout|fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|network|OpenRouter response missing message content|produced no output|learner response missing answers array|JSON|Unexpected token|unterminated/i.test(
          message,
        );
      if (!retryable || attempt >= attempts) throw err;
      console.warn(`held-out learner call failed (${message}); retrying ${attempt + 1}/${attempts}`);
    }
  }
  throw lastErr;
}

function pretestScore(pretestView) {
  return pretestView.length ? pretestView.filter((row) => row.is_correct).length / pretestView.length : 0;
}

function signTestOneSidedP(successes, trials) {
  if (trials <= 0) return 1;
  let p = 0;
  for (let k = successes; k <= trials; k++) {
    p += combination(trials, k) * 0.5 ** trials;
  }
  return Number(p.toFixed(4));
}

function combination(n, k) {
  if (k < 0 || k > n) return 0;
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= n - (k - i);
    den *= i;
  }
  return num / den;
}

async function runG2Session({ session, items, backend, learnerProtocol, callCounter }) {
  const preItems = items.filter((item) => item.form === 'A');
  const postItems = items.filter((item) => item.form === 'B');
  const pretestView = buildLearnerPretestView({ targetSeed: session.targetSeed, items: preItems });
  const basePreScore = pretestScore(pretestView);
  const arms = [];
  for (const arm of session.arms) {
    console.log(`g2 independent outcome: ${session.sessionId} ${arm.arm} learner via ${backend}`);
    const prompt = buildHeldOutLearnerPrompt({ session, arm, pretestView, postItems, learnerProtocol });
    const promptLeaks = hiddenFamilyLabelLeaks(prompt);
    const answers = await generateLearnerAnswers({
      session,
      arm,
      pretestView,
      postItems,
      backend,
      learnerProtocol,
      callCounter,
    });
    const scored = scoreAnswers({ answers, postItems });
    arms.push({
      arm: arm.arm,
      label: G1_ARM_LABELS[arm.arm],
      promptFamilyLabelLeaks: promptLeaks,
      answers: scored.rows,
      invalidAnswerCount: scored.invalidCount,
      preScore: Number(basePreScore.toFixed(3)),
      postScore: Number(scored.score.toFixed(3)),
      gain: Number((scored.score - basePreScore).toFixed(3)),
    });
  }
  const byArm = Object.fromEntries(arms.map((arm) => [arm.arm, arm]));
  return {
    sessionId: session.sessionId,
    targetSeed: session.targetSeed,
    arms,
    contrasts: {
      delta1_responsiveness: Number((byArm.contingent.gain - byArm.same_seed_yoked.gain).toFixed(3)),
      delta2_diagnosis: Number((byArm.same_seed_yoked.gain - byArm.different_seed_yoked.gain).toFixed(3)),
    },
  };
}

export async function runG2IndependentOutcome({
  g1Json = DEFAULTS.g1Json,
  backend = DEFAULTS.backend,
  learnerProtocol = DEFAULTS.learnerProtocol,
  posttestProfile = DEFAULTS.posttestProfile,
  sessionLimit = DEFAULTS.sessionLimit,
  maxCalls = DEFAULTS.maxCalls,
  items = null,
} = {}) {
  const g1 = typeof g1Json === 'string' ? readJson(g1Json) : g1Json;
  const resolvedItems = items || loadG2Items({ posttestProfile });
  const callCounter = createCallCounter(maxCalls);
  const sessions = [];
  const sourceSessions = Array.isArray(g1.sessions) ? g1.sessions : [];
  const selectedSessions = sessionLimit ? sourceSessions.slice(0, sessionLimit) : sourceSessions;
  for (const session of selectedSessions) {
    sessions.push(await runG2Session({ session, items: resolvedItems, backend, learnerProtocol, callCounter }));
  }

  const flatArms = sessions.flatMap((session) => session.arms);
  const byArm = Object.fromEntries(
    ['contingent', 'same_seed_yoked', 'different_seed_yoked'].map((arm) => [
      arm,
      flatArms.filter((row) => row.arm === arm),
    ]),
  );
  const meanGainByArm = Object.fromEntries(
    Object.entries(byArm).map(([arm, rows]) => [arm, Number(mean(rows.map((row) => row.gain)).toFixed(3))]),
  );
  const delta1 = Number((meanGainByArm.contingent - meanGainByArm.same_seed_yoked).toFixed(3));
  const delta2 = Number((meanGainByArm.same_seed_yoked - meanGainByArm.different_seed_yoked).toFixed(3));
  const invalidAnswerCount = flatArms.reduce((sum, row) => sum + row.invalidAnswerCount, 0);
  const promptLeakCount = flatArms.reduce((sum, row) => sum + row.promptFamilyLabelLeaks.length, 0);
  const sameGreaterSessionCount = sessions.filter((session) => {
    const rows = Object.fromEntries(session.arms.map((arm) => [arm.arm, arm]));
    return rows.same_seed_yoked.gain > rows.different_seed_yoked.gain;
  }).length;
  const scaled = sessions.length >= 9;
  const signP = signTestOneSidedP(sameGreaterSessionCount, sessions.length);
  const requiredSameGreaterSessionCount = scaled ? 6 : Math.min(2, sessions.length);
  const pass =
    invalidAnswerCount === 0 &&
    promptLeakCount === 0 &&
    delta2 > 0 &&
    sameGreaterSessionCount >= requiredSameGreaterSessionCount &&
    (!scaled || signP <= 0.1);

  return {
    schema: 'yoked_contingency_g2_independent_outcome_v0_1',
    generatedAt: new Date().toISOString(),
    status: pass ? 'pass_g2_independent_outcome' : 'fail_g2_independent_outcome',
    boundary: scaled
      ? 'scaled independent learner-outcome follow-up; candidate evidence only until paper integration audit'
      : 'bounded independent learner-outcome smoke; not yet a paper claim',
    preregistration: scaled
      ? posttestProfile === 'hard-transfer'
        ? learnerProtocol === 'rule-transfer-novice'
          ? 'PLAN_2_0/yoked-contingency-g2-rule-transfer-scaled-preregistration.md'
          : 'PLAN_2_0/yoked-contingency-g2-hard-transfer-scaled-preregistration.md'
        : learnerProtocol === 'calibrated-novice'
          ? 'PLAN_2_0/yoked-contingency-g2-calibrated-novice-scaled-preregistration.md'
          : 'PLAN_2_0/yoked-contingency-g2-scaled-preregistration.md'
      : posttestProfile === 'hard-transfer'
        ? learnerProtocol === 'rule-transfer-novice'
          ? 'PLAN_2_0/yoked-contingency-g2-rule-transfer-preregistration.md'
          : 'PLAN_2_0/yoked-contingency-g2-hard-transfer-preregistration.md'
        : learnerProtocol === 'calibrated-novice'
          ? 'PLAN_2_0/yoked-contingency-g2-calibrated-novice-preregistration.md'
          : 'PLAN_2_0/yoked-contingency-g2-independent-outcome-preregistration.md',
    inputG1Artifact: typeof g1Json === 'string' ? path.relative(ROOT, path.resolve(g1Json)) : 'in_memory',
    plannerBackend: g1.backend,
    plannerBackendDetail: g1.backendDetail || null,
    learnerBackend: canonicalBackend(backend),
    learnerBackendDetail: backendDetail(backend),
    learnerProtocol,
    learnerProtocolDescription: LEARNER_PROTOCOLS[learnerProtocol],
    posttestProfile,
    posttestProfileDescription: POSTTEST_PROFILES[posttestProfile],
    sessions,
    thresholds: {
      requiredInvalidAnswerCount: 0,
      requiredPromptFamilyLabelLeaks: 0,
      requiredSameGreaterSessionCount,
      scaledSignTestPMax: scaled ? 0.1 : null,
    },
    summary: {
      sessionCount: sessions.length,
      sourceSessionCount: sourceSessions.length,
      modelCalls: callCounter.counts,
      meanGainByArm,
      delta1_responsiveness: delta1,
      delta2_diagnosis: delta2,
      sameGreaterSessionCount,
      signTestOneSidedP: signP,
      invalidAnswerCount,
      promptFamilyLabelLeakCount: promptLeakCount,
    },
  };
}

export function renderG2IndependentOutcomeReport(result) {
  const lines = [];
  lines.push('# Yoked-contingency G2 independent outcome');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(`Boundary: ${result.boundary}.`);
  lines.push('');
  lines.push(`Preregistration: ${result.preregistration}`);
  lines.push(`Input G1 artifact: ${result.inputG1Artifact}`);
  lines.push(`Planner backend: ${result.plannerBackend}`);
  if (result.plannerBackendDetail?.label && result.plannerBackendDetail.label !== result.plannerBackend) {
    lines.push(`Planner detail: ${result.plannerBackendDetail.label}`);
  }
  lines.push(`Held-out learner backend: ${result.learnerBackend}`);
  if (result.learnerBackendDetail?.model) {
    const effort = result.learnerBackendDetail.effort ? ` (${result.learnerBackendDetail.effort} effort)` : '';
    lines.push(`Held-out learner model: ${result.learnerBackendDetail.model}${effort}`);
  }
  lines.push(`Held-out learner protocol: ${result.learnerProtocol}`);
  lines.push(`Posttest profile: ${result.posttestProfile}`);
  lines.push(`Model calls: ${result.summary.modelCalls.total}`);
  lines.push('');
  lines.push('## Primary contrasts');
  lines.push('');
  lines.push(`- Δ1 responsiveness/coherence = ${fmt(result.summary.delta1_responsiveness)}`);
  lines.push(`- Δ2 diagnosis = ${fmt(result.summary.delta2_diagnosis)}`);
  lines.push(
    `- Same-seed gain > different-seed gain: ${result.summary.sameGreaterSessionCount}/${result.summary.sessionCount}`,
  );
  lines.push(`- One-sided sign-test p = ${fmt(result.summary.signTestOneSidedP, 4)}`);
  lines.push('');
  lines.push('## Validity checks');
  lines.push('');
  lines.push(`- Invalid posttest answers: ${result.summary.invalidAnswerCount}`);
  lines.push(`- Hidden family-label prompt leaks: ${result.summary.promptFamilyLabelLeakCount}`);
  lines.push('');
  lines.push('## Mean gains');
  lines.push('');
  lines.push('| Arm | Mean gain |');
  lines.push('|---|---:|');
  for (const arm of ['contingent', 'same_seed_yoked', 'different_seed_yoked']) {
    lines.push(`| ${G1_ARM_LABELS[arm]} | ${fmt(result.summary.meanGainByArm[arm])} |`);
  }
  lines.push('');
  lines.push('## Sessions');
  lines.push('');
  lines.push('| Session | Target seed | Contingent gain | Same-seed gain | Different-seed gain | Δ2 |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const session of result.sessions) {
    const rows = Object.fromEntries(session.arms.map((arm) => [arm.arm, arm]));
    lines.push(
      `| ${session.sessionId} | ${session.targetSeed} | ${fmt(rows.contingent.gain)} | ${fmt(
        rows.same_seed_yoked.gain,
      )} | ${fmt(rows.different_seed_yoked.gain)} | ${fmt(session.contrasts.delta2_diagnosis)} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (result.status === 'pass_g2_independent_outcome') {
    lines.push(
      'The independent learner-outcome check preserves the same-state yoking advantage under the frozen rule.',
    );
  } else {
    lines.push(
      'This does not yet support a main-paper outcome claim. Inspect ceiling, invalid answers, prompt leakage, and session-level same-vs-different failures before scaling or paper integration.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function writeG2IndependentOutcomeArtifacts({ result, outJson = DEFAULTS.outJson, outMd = DEFAULTS.outMd }) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(result, null, 2)}\n`);
  fs.mkdirSync(path.dirname(outMd), { recursive: true });
  fs.writeFileSync(outMd, renderG2IndependentOutcomeReport(result));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runG2IndependentOutcome(args);
  if (args.write) {
    writeG2IndependentOutcomeArtifacts({
      result,
      outJson: path.resolve(args.outJson),
      outMd: path.resolve(args.outMd),
    });
    console.log(`wrote ${args.outJson}`);
    console.log(`wrote ${args.outMd}`);
  }
  console.log(
    `${result.status}: Δ1=${fmt(result.summary.delta1_responsiveness)} Δ2=${fmt(
      result.summary.delta2_diagnosis,
    )} calls=${result.summary.modelCalls.total}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
