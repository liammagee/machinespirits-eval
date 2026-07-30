#!/usr/bin/env node
/**
 * Does the tuned mini disagree with the frontier's contract draft at all?
 *
 * The friction question is whether a separately trained model that can refuse
 * the frontier's turn adds anything the compiled stage directions do not
 * already give. Before testing whether refusal helps, check that there is
 * anything to refuse. If the mini would have asked what the frontier already
 * asked, the channel is empty and no amount of power to refuse changes an
 * outcome.
 *
 * Both sides are already on disk, so this calls no tutor model:
 *   - the frontier's contract-version draft comes from the length runs
 *   - the tuned mini's question is the protected span the committee run
 *     recorded for the same frozen turn, under the same version of the prompt
 * Pairing is by frozen turn id, and the two reports are required to name the
 * same fixture hash, so both sides answered the identical moment.
 *
 * The two sides can differ in two ways, and the second one only became visible
 * once the drafts were read: they can ask different questions, or they can
 * disagree about whether to ask at all. Turns are sorted into three buckets:
 *
 *   both_asked   - compare the two questions
 *   mini_only    - the frontier ended without a question and the mini wanted one
 *   neither      - agreement, no judge call needed
 *
 * A judge call goes out for the first two buckets. The judge is not told which
 * model wrote which; display order is fixed by a hash of the turn id so a rerun
 * asks the same way.
 *
 *   node scripts/probe-tutor-stub-ab-mini-disagreement.js <draft-run> <committee-run> [more pairs...]
 *
 *   --draft-model <id>      speaker whose draft is under test (default codex_medium)
 *   --mini-model <id>       committee whose mini span is the alternative (default committee_tuned)
 *   --arm <id>              version of the tutor on both sides (default contract_only)
 *   --judge <ref>           default claude-code.sonnet (claude-code refs only)
 *   --concurrency N         judge calls in flight (default 3)
 *   --dry-run               build every prompt, call nothing
 *   --out <path>            output basename (default exports/tutor-stub-ab/mini-disagreement)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PROGRAM2_WARRANT_CUE_RE, committeeQuestionSentences } from '../services/program2CommitteeEngine.js';
import { callClaudeCodeJudge, getAvailableJudge } from '../services/rubricEvaluator.js';
import { abFrozenPublicPrefix, abTurnObligations } from '../services/tutorStubAbPrBenchmarkScoring.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = 'machinespirits.tutor-stub.ab-mini-disagreement.v1';

/**
 * The mini sometimes protects a line it copied out of its own prompt header
 * rather than a question to the learner. The span picker takes any sentence
 * ending in a question mark, and a header line ending in one qualifies. Flag it
 * deterministically so the count does not rest on a judge noticing.
 */
const SCAFFOLD_RE = /\b(?:SOURCE|public question|world_\d|SYSTEM|CONTEXT)\b\s*:/u;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'draft-model': { type: 'string', default: 'codex_medium' },
    'mini-model': { type: 'string', default: 'committee_tuned' },
    arm: { type: 'string', default: 'contract_only' },
    judge: { type: 'string', default: 'claude-code.sonnet' },
    concurrency: { type: 'string', default: '3' },
    'dry-run': { type: 'boolean', default: false },
    out: { type: 'string', default: 'exports/tutor-stub-ab/mini-disagreement' },
  },
});

function reportPath(input) {
  const target = path.resolve(input);
  if (!fs.existsSync(target)) throw new Error(`no such report or run directory: ${target}`);
  if (!fs.statSync(target).isDirectory()) return target;
  const candidate = path.join(target, 'report.json');
  if (!fs.existsSync(candidate)) throw new Error(`no report.json in ${target}`);
  return candidate;
}

function resolveJudge(ref) {
  const resolved = getAvailableJudge({ judgeOverride: { model: ref } });
  if (resolved.provider !== 'claude-code') {
    throw new Error(`--judge ${ref} resolves to provider ${resolved.provider}; only claude-code refs are supported`);
  }
  return resolved;
}

/**
 * Reload the frozen fixture behind a report and index its turns by case id. A
 * changed fixture means the obligations we would show the judge are not the
 * ones either side wrote against, so refuse rather than compare the wrong thing.
 */
function loadBundles(scenario) {
  const source = fs.readFileSync(path.resolve(REPO_ROOT, scenario.fixture), 'utf8');
  const sha256 = crypto.createHash('sha256').update(source).digest('hex');
  if (scenario.fixtureSha256 && sha256 !== scenario.fixtureSha256) {
    throw new Error(`fixture ${scenario.fixture} changed since the run (${scenario.fixtureSha256} -> ${sha256})`);
  }
  const bundles = new Map();
  for (const row of JSON.parse(source).cases || []) {
    if (row?.bundle?.turnId) bundles.set(row.bundle.turnId, row.bundle);
  }
  return bundles;
}

/**
 * The question the committee would have protected, picked the way the committee
 * picks it: the question sentence carrying a warrant cue if there is one, else
 * the first question sentence.
 */
function protectedQuestion(text) {
  const questions = committeeQuestionSentences(text);
  return questions.find((question) => PROGRAM2_WARRANT_CUE_RE.test(question)) || questions[0] || null;
}

/** Stable coin from the turn id, so display order is the same on a rerun. */
function miniShownFirst(caseId) {
  return crypto.createHash('sha256').update(String(caseId)).digest()[0] % 2 === 1;
}

function obligationLines(obligations) {
  const lines = [];
  const push = (label, value) => {
    if (value) lines.push(`- ${label}: ${value}`);
  };
  push('Learner move', obligations.learnerMove);
  push('Opening', obligations.opening?.instruction);
  push('Development', obligations.development?.instruction);
  push('Support', obligations.development?.supportInstruction);
  push('Question answerability', obligations.questionSupport?.answerability);
  push('Question instruction', obligations.questionSupport?.instruction);
  push('Ending', obligations.ending?.instruction);
  if (obligations.ending?.closureRequired) lines.push('- This turn is required to close.');
  if (obligations.ending?.clarificationInvitationRequired) {
    lines.push('- This turn is required to invite a clarifying question.');
  }
  for (const entry of obligations.release?.entries || []) {
    push('Evidence due this turn', entry.surface);
  }
  return lines.join('\n') || '- (no authored obligations recorded for this turn)';
}

function sceneBlock({ scenarioId, publicPrefix, obligations, learnerText }) {
  return [
    `Scenario: ${scenarioId}`,
    '',
    'Public transcript so far:',
    publicPrefix || '(the dialogue starts here)',
    '',
    "Learner's latest message:",
    learnerText || '(none)',
    '',
    'What this turn was authored to do:',
    obligationLines(obligations),
  ].join('\n');
}

const JSON_ONLY = [
  'Reply with JSON only:',
  '{"relation": "same" | "different", "better": "1" | "2" | "equal", "reason": "<one sentence>"}',
].join('\n');

function buildBothAskedPrompt({ scene, first, second }) {
  return [
    'You are comparing two candidate questions for one moment in a tutoring dialogue.',
    '',
    scene,
    '',
    'Two tutors each wrote this turn. These are the questions they asked.',
    '',
    `Question 1: ${first}`,
    '',
    `Question 2: ${second}`,
    '',
    'Answer two things.',
    '',
    'First: do the two questions ask the learner for the same thing? Say "same" when a',
    'learner answering one would have answered the other, even if the wording differs.',
    'Say "different" when they ask for materially different work — a different object,',
    'a different step, or a different kind of answer.',
    '',
    'Second: which question better fits what this turn was authored to do? Answer "1",',
    '"2", or "equal". Judge only against the authored obligations above. Do not reward',
    'length, politeness, or fluency.',
    '',
    JSON_ONLY,
  ].join('\n');
}

/**
 * One tutor ended the turn without asking anything; the other wanted a question.
 * Asking "which is better" would be unfair to the silent one if the judge were
 * shown only a question, so the silent choice is stated as a choice.
 */
function buildMiniOnlyPrompt({ scene, first, second }) {
  return [
    'You are comparing two ways of ending one turn in a tutoring dialogue.',
    '',
    scene,
    '',
    'Two tutors each wrote this turn. These are how they ended it.',
    '',
    `Option 1: ${first}`,
    '',
    `Option 2: ${second}`,
    '',
    'Answer two things.',
    '',
    'First: do the two options leave the learner with the same work to do next?',
    'Answer "same" or "different".',
    '',
    'Second: which option better fits what this turn was authored to do? Answer "1",',
    '"2", or "equal". A turn authored to close, or to hand over without a prompt, is',
    'better served by ending without a question; a turn authored to put evidence in',
    'the scene and ask what it changes is not. Judge only against the authored',
    'obligations above.',
    '',
    JSON_ONLY,
  ].join('\n');
}

const SILENT_OPTION = 'This tutor ended the turn without asking the learner anything.';

function parseVerdict(text) {
  const raw = String(text || '');
  const match = raw.match(/\{[\s\S]*\}/u);
  if (!match) throw new Error(`judge reply carried no JSON object: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  const relation = String(parsed.relation || '').toLowerCase();
  const better = String(parsed.better || '').toLowerCase();
  if (relation !== 'same' && relation !== 'different') throw new Error(`bad relation: ${parsed.relation}`);
  if (!['1', '2', 'equal'].includes(better)) throw new Error(`bad better: ${parsed.better}`);
  return { relation, better, reason: String(parsed.reason || '').trim() };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

function buildMoments({ draftReportPath, committeeReportPath, draftModel, miniModel, armId }) {
  const draftReport = JSON.parse(fs.readFileSync(draftReportPath, 'utf8'));
  const committeeReport = JSON.parse(fs.readFileSync(committeeReportPath, 'utf8'));
  const scenarios = new Map((draftReport.plan?.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const committeeScenarios = new Map(
    (committeeReport.plan?.scenarios || []).map((scenario) => [scenario.id, scenario]),
  );

  const spans = new Map();
  for (const row of committeeReport.results || []) {
    if (row.modelId !== miniModel || row.armId !== armId || !row.called) continue;
    spans.set(row.caseId, row.committee?.span || null);
  }

  const bundlesByScenario = new Map();
  const moments = [];
  for (const row of draftReport.results || []) {
    if (row.modelId !== draftModel || row.armId !== armId || !row.called) continue;
    if (!String(row.candidate || '').trim()) continue;
    const scenario = scenarios.get(row.scenarioId);
    if (!scenario) throw new Error(`no plan entry for scenario ${row.scenarioId}`);
    const twin = committeeScenarios.get(row.scenarioId);
    if (!twin) continue;
    if (scenario.fixtureSha256 !== twin.fixtureSha256) {
      throw new Error(`scenario ${row.scenarioId} used different fixtures in the two runs`);
    }
    if (!spans.has(row.caseId)) continue;

    const miniQuestion = spans.get(row.caseId);
    const draftQuestion = protectedQuestion(row.candidate);
    const bucket = draftQuestion && miniQuestion ? 'both_asked' : miniQuestion ? 'mini_only' : 'neither';

    if (!bundlesByScenario.has(row.scenarioId)) bundlesByScenario.set(row.scenarioId, loadBundles(scenario));
    const bundle = bundlesByScenario.get(row.scenarioId).get(row.caseId);
    if (!bundle) throw new Error(`fixture ${scenario.fixture} has no frozen turn ${row.caseId}`);

    const minifirst = miniShownFirst(row.caseId);
    const scene = sceneBlock({
      scenarioId: row.scenarioId,
      publicPrefix: abFrozenPublicPrefix(bundle),
      obligations: abTurnObligations(bundle),
      learnerText: row.learnerText || bundle.learnerText || '',
    });
    const draftSide = bucket === 'mini_only' ? SILENT_OPTION : draftQuestion;
    const moment = {
      scenarioId: row.scenarioId,
      caseId: row.caseId,
      turn: row.turn,
      bucket,
      draftQuestion,
      miniQuestion,
      miniSpanIsScaffold: Boolean(miniQuestion && SCAFFOLD_RE.test(miniQuestion)),
      draftCarriesCue: Boolean(draftQuestion && PROGRAM2_WARRANT_CUE_RE.test(draftQuestion)),
      miniCarriesCue: Boolean(miniQuestion && PROGRAM2_WARRANT_CUE_RE.test(miniQuestion)),
      miniShownFirst: minifirst,
      prompt: null,
    };
    if (bucket === 'both_asked' || bucket === 'mini_only') {
      const build = bucket === 'both_asked' ? buildBothAskedPrompt : buildMiniOnlyPrompt;
      moment.prompt = build({
        scene,
        first: minifirst ? miniQuestion : draftSide,
        second: minifirst ? draftSide : miniQuestion,
      });
    }
    moments.push(moment);
  }
  return moments;
}

function census(rows, bucket) {
  const inBucket = rows.filter((row) => row.bucket === bucket);
  const judged = inBucket.filter((row) => row.verdict);
  const different = judged.filter((row) => row.verdict.relation === 'different');
  return {
    turns: inBucket.length,
    judged: judged.length,
    errored: inBucket.length - judged.length,
    same: judged.length - different.length,
    different: different.length,
    differentAndMiniBetter: different.filter((row) => row.betterAuthor === 'mini').length,
    differentAndDraftBetter: different.filter((row) => row.betterAuthor === 'draft').length,
    differentAndEqual: different.filter((row) => row.betterAuthor === 'equal').length,
  };
}

async function main() {
  if (positionals.length < 2 || positionals.length % 2 !== 0) {
    throw new Error('give run directories in pairs: <draft-run> <committee-run> [more pairs...]');
  }
  const judge = resolveJudge(args.judge);
  const concurrency = Math.max(1, Number.parseInt(args.concurrency, 10) || 3);

  const moments = [];
  for (let index = 0; index < positionals.length; index += 2) {
    moments.push(
      ...buildMoments({
        draftReportPath: reportPath(positionals[index]),
        committeeReportPath: reportPath(positionals[index + 1]),
        draftModel: args['draft-model'],
        miniModel: args['mini-model'],
        armId: args.arm,
      }),
    );
  }

  const counts = (bucket) => moments.filter((moment) => moment.bucket === bucket).length;
  console.log(`paired moments: ${moments.length}`);
  console.log(`  both asked a question:            ${counts('both_asked')}`);
  console.log(`  only the mini wanted a question:  ${counts('mini_only')}`);
  console.log(`  neither asked:                    ${counts('neither')}`);
  console.log(`  mini span was prompt scaffolding: ${moments.filter((moment) => moment.miniSpanIsScaffold).length}`);
  if (args['dry-run']) {
    for (const bucket of ['both_asked', 'mini_only']) {
      const sample = moments.find((moment) => moment.bucket === bucket);
      if (sample) console.log(`\n--- sample ${bucket} prompt ---\n${sample.prompt}`);
    }
    return;
  }

  const askable = moments.filter((moment) => moment.prompt);
  const judgedRows = await mapWithConcurrency(askable, concurrency, async (moment, index) => {
    const tag = `[${index + 1}/${askable.length}] ${moment.scenarioId} t${moment.turn} (${moment.bucket})`;
    try {
      const text = await callClaudeCodeJudge(moment.prompt, { model: judge.model });
      const verdict = parseVerdict(text);
      // The judge answered about display slots; map back to who wrote what.
      const betterAuthor =
        verdict.better === 'equal' ? 'equal' : (verdict.better === '1') === moment.miniShownFirst ? 'mini' : 'draft';
      console.log(`  ${tag}: ${verdict.relation}, better=${betterAuthor}`);
      return { caseId: moment.caseId, verdict, betterAuthor };
    } catch (error) {
      console.log(`  ${tag}: failed: ${error.message}`);
      return { caseId: moment.caseId, error: String(error.message || error) };
    }
  });

  const byCase = new Map(judgedRows.map((row) => [row.caseId, row]));
  const rows = moments.map((moment) => {
    const judged = byCase.get(moment.caseId) || {};
    return {
      ...moment,
      prompt: undefined,
      verdict: judged.verdict,
      betterAuthor: judged.betterAuthor,
      error: judged.error,
    };
  });

  const summary = {
    paired: moments.length,
    bothAsked: census(rows, 'both_asked'),
    miniOnly: census(rows, 'mini_only'),
    neither: { turns: counts('neither') },
    miniSpanScaffold: rows.filter((row) => row.miniSpanIsScaffold).length,
    draftCarriesCue: rows.filter((row) => row.draftCarriesCue).length,
    miniCarriesCue: rows.filter((row) => row.miniCarriesCue).length,
  };

  const outBase = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outBase), { recursive: true });
  fs.writeFileSync(
    `${outBase}.json`,
    `${JSON.stringify(
      {
        schema: SCHEMA,
        draftModel: args['draft-model'],
        miniModel: args['mini-model'],
        arm: args.arm,
        judge: `${judge.provider}.${judge.model}`,
        summary,
        rows,
      },
      null,
      2,
    )}\n`,
  );

  const line = (label, value) => console.log(`${label.padEnd(38)}${value}`);
  console.log('\n=== disagreement census ===');
  line('paired moments', summary.paired);
  console.log('\nboth asked a question:');
  line('  judged', summary.bothAsked.judged);
  line('  asked the same thing', summary.bothAsked.same);
  line('  asked something different', summary.bothAsked.different);
  line("  ... and the mini's fit better", summary.bothAsked.differentAndMiniBetter);
  line("  ... and the draft's fit better", summary.bothAsked.differentAndDraftBetter);
  line('  ... and neither clearly better', summary.bothAsked.differentAndEqual);
  console.log('\nonly the mini wanted a question:');
  line('  judged', summary.miniOnly.judged);
  line('  same work left to the learner', summary.miniOnly.same);
  line('  different', summary.miniOnly.different);
  line('  ... and asking was better', summary.miniOnly.differentAndMiniBetter);
  line('  ... and staying silent was better', summary.miniOnly.differentAndDraftBetter);
  line('  ... and neither clearly better', summary.miniOnly.differentAndEqual);
  console.log('\nneither asked (agreement):');
  line('  turns', summary.neither.turns);
  line('mini span was prompt scaffolding', summary.miniSpanScaffold);
  console.log(`\nlabels: ${path.relative(process.cwd(), `${outBase}.json`)}`);
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
