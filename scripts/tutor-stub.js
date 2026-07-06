#!/usr/bin/env node

/**
 * Tiny editable AI tutor stub.
 *
 * This is deliberately much smaller than the full evaluation/chat stack:
 * - no server
 * - no DB writes
 * - no cell registry
 * - no rubric scoring
 *
 * Edit the STUB defaults or buildSystemPrompt() below, then run:
 *   npm run tutor:stub -- --model openai.mini
 *   npm run tutor:stub -- --model openrouter.sonnet-5
 *   npm run tutor:stub -- --model codex.gpt-5.5
 *   npm run tutor:stub -- --model claude-code.sonnet
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { call as callAI, callStream as streamAI } from '../tutor-core/services/unifiedAIProviderService.js';
import { callAIWithCliBridge, isCliProvider } from '../services/cliProviderBridge.js';
import { getProviderConfig, resolveModel } from '../services/evalConfigLoader.js';
import { buildTutorDesireDag } from '../services/dramaticDerivation/beliefDesire.js';
import { closure, factKey, matchPattern } from '../services/dramaticDerivation/chainer.js';
import { buildLearnerDag, buildLearnerDagSnapshot } from '../services/dramaticDerivation/learnerDag.js';
import {
  buildLearnerProxyDagMemory,
  buildTutorLearnerDagModel,
} from '../services/dramaticDerivation/proxyDagMemory.js';
import {
  getEngagementRegisterDefinition,
  getEngagementRegisterDefinitions,
  getEngagementRegisterNames,
} from '../services/engagementRegisterRegistry.js';
import { loadWorld, plotLint } from '../services/dramaticDerivation/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = path.join(ROOT, 'config/drama-derivation');

const STUB = {
  model: process.env.TUTOR_STUB_MODEL || 'openai.mini',
  classifierModel: process.env.TUTOR_STUB_CLASSIFIER_MODEL || 'codex.gpt-5.5',
  learnerRecordModel: process.env.TUTOR_STUB_LEARNER_RECORD_MODEL || process.env.TUTOR_STUB_CLASSIFIER_MODEL || 'codex.gpt-5.5',
  topic: process.env.TUTOR_STUB_TOPIC || 'fractions',
  world: process.env.TUTOR_STUB_WORLD || 'world_005_marrick',
  learner: 'A curious learner who may be partly right, partly confused, and unsure how to explain their thinking.',
  goal: 'Help the learner make one small conceptual move. Prefer questions and concrete examples over explanation dumps.',
  style: 'Calm, concise, Socratic, and specific. Do not perform the whole solution unless the learner is truly stuck.',
  temperature: 0.35,
  maxTokens: 2000,
  historyTurns: 8,
  traceDir: process.env.TUTOR_STUB_TRACE_DIR || '.tutor-stub-traces',
  stream: process.env.TUTOR_STUB_STREAM !== '0',
};

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const CLASSIFIER_SYSTEM_PROMPT = [
  'You are a compact pedagogical discourse classifier for an experimental tutor.',
  'Classify only what is visible in the public learner/tutor exchange.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, or private DAG state.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_RECORD_SYSTEM_PROMPT = [
  'You are a conservative public-record extractor for a tutor-side learner-DAG model.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer private mental states, unstaged evidence, concealed answers, proof paths, or release schedules beyond the staged list.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const LEARNER_ANALYSIS_SYSTEM_PROMPT = [
  'You are a compact learner-analysis pass for an experimental tutor.',
  'Return a pedagogical discourse classification, a conservative public learner-record update, and, when requested, a tutor register selection.',
  'Use only the learner input, the public transcript, public rules, and staged public evidence supplied in the prompt.',
  'Do not infer hidden story facts, concealed answers, private tutor prompts, proof paths, or unstaged evidence.',
  'Return one JSON object only. No prose outside JSON.',
].join('\n');

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', default: STUB.model },
    'classifier-model': { type: 'string', default: STUB.classifierModel },
    'no-classifier': { type: 'boolean', default: false },
    'tutor-learner-dag': { type: 'boolean', default: false },
    'learner-record-model': { type: 'string', default: STUB.learnerRecordModel },
    'no-register-selection': { type: 'boolean', default: false },
    'register-palette': { type: 'string', default: 'all' },
    'safe-registers': { type: 'boolean', default: false },
    topic: { type: 'string', default: STUB.topic },
    world: { type: 'string', default: STUB.world },
    dag: { type: 'boolean', default: false },
    'list-worlds': { type: 'boolean', default: false },
    learner: { type: 'string', default: STUB.learner },
    goal: { type: 'string', default: STUB.goal },
    style: { type: 'string', default: STUB.style },
    system: { type: 'string' },
    once: { type: 'string' },
    save: { type: 'string' },
    'trace-dir': { type: 'string', default: STUB.traceDir },
    'no-trace': { type: 'boolean', default: false },
    'resume-last': { type: 'boolean', default: false },
    'no-stream': { type: 'boolean', default: false },
    temperature: { type: 'string', default: String(STUB.temperature) },
    'max-tokens': { type: 'string', default: String(STUB.maxTokens) },
    'history-turns': { type: 'string', default: String(STUB.historyTurns) },
    'show-prompt': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub -- [options]
  node scripts/tutor-stub.js [options] [first learner message]

Options:
  --model <ref>          provider alias from config/providers.yaml
                         examples: openai.mini, openrouter.sonnet-5,
                         codex.gpt-5.5, claude-code.sonnet
  --classifier-model <ref>
                         learner-input classifier model (default: ${STUB.classifierModel})
  --no-classifier        skip the upfront learner-input classifier
  --tutor-learner-dag    build/print a redacted tutor-side model of the learner DAG
  --learner-record-model <ref>
                         model for --tutor-learner-dag; when the classifier is
                         also on, this single call returns both outputs
                         (default: ${STUB.learnerRecordModel})
  --no-register-selection
                         skip tutor-register selection from the combined
                         learner analysis
  --register-palette <all|safe|negative|non-simulated|csv>
                         tutor-register palette for selection (default: all);
                         all includes every register in the registry
  --safe-registers       limit tutor-register selection to router-selectable
                         safe registers
  --world <id|path|none> detective-story world (default: ${STUB.world})
  --dag                  add hidden proof DAG + release schedule to tutor prompt;
                         also prints the tutor desire-DAG after each turn
  --list-worlds          list available detective-story worlds and exit
  --topic <text>         tutoring topic (default: ${STUB.topic})
  --learner <text>       learner sketch
  --goal <text>          tutor objective
  --style <text>         tutor style constraints
  --system <path>        replace generated system prompt with a file
  --once <text>          run one turn and exit
  --save <path>          write transcript JSON on exit
  --trace-dir <path>     write JSONL model-call traces here
                         (default: ${STUB.traceDir})
  --no-trace             disable automatic local tracing
  --resume-last          resume the newest completed dialogue found in trace-dir
  --no-stream            disable token streaming for API-backed model calls
  --temperature <n>      API temperature (default: ${STUB.temperature})
  --max-tokens <n>       response token cap for API providers (default: ${STUB.maxTokens})
  --history-turns <n>    turns kept in context (default: ${STUB.historyTurns})
  --show-prompt          print the system prompt before starting
  --dry-run              print resolved config and first payload, but do not call a model
  --help                 show this message

Interactive commands:
  /analysis              show the latest completed turn's internal analysis
  /a                     alias for /analysis
  /clear                 reset transcript and learner/register state
  /help                  show interactive commands
  /quit                  exit

Environment:
  OPENAI_API_KEY         required for openai.*
  OPENROUTER_API_KEY     required for openrouter.*
  TUTOR_STUB_MODEL       optional default model override
  TUTOR_STUB_CLASSIFIER_MODEL
                         optional default classifier model override
  TUTOR_STUB_LEARNER_RECORD_MODEL
                         optional default learner-record / combined-analysis model override
  TUTOR_STUB_TOPIC       optional default topic override
  TUTOR_STUB_WORLD       optional default detective-story world
  TUTOR_STUB_TRACE_DIR   optional default trace directory
  TUTOR_STUB_STREAM=0    disable token streaming by default
`);
}

function parseNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function resolveWorkspacePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function factText(fact) {
  if (!Array.isArray(fact) || fact.length === 0) return String(fact || '');
  const [rel, ...args] = fact;
  return `${rel}(${args.join(', ')})`;
}

function splitSymbolWords(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function textTokens(text) {
  return new Set(splitSymbolWords(text));
}

function tokenRegex(token) {
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu');
}

function textContainsToken(text, token) {
  return tokenRegex(token).test(String(text || ''));
}

function factMatches(a, b) {
  return factKey(a) === factKey(b);
}

function publicFactsAtTurn(world, tutorTurn) {
  if (!world) return [];
  const released = world.releaseSchedule
    .filter((entry) => entry.turn <= tutorTurn)
    .map((entry) => world.premiseById.get(entry.premise)?.fact)
    .filter(Boolean);
  return [...(world.background || []), ...released];
}

function entailedFactsAtTurn(world, tutorTurn) {
  return [...closure(publicFactsAtTurn(world, tutorTurn), world.rules || []).facts.values()];
}

function entailsFactAtTurn(world, tutorTurn, fact) {
  return entailedFactsAtTurn(world, tutorTurn).some((entailed) => factMatches(entailed, fact));
}

function answerTermForWorld(world) {
  const pattern = world?.questionPattern || [];
  const answerIndex = pattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  if (answerIndex < 0) return null;
  return world?.secret?.fact?.[answerIndex] || null;
}

function publicTextForTurn(world, tutorTurn, learnerText = '') {
  if (!world) return '';
  const releasedSurface = world.releaseSchedule
    .filter((entry) => entry.turn <= tutorTurn)
    .map((entry) => world.premiseById.get(entry.premise)?.surface || '')
    .join('\n');
  return [
    world.question,
    world.setting,
    world.learnerVoice,
    ...(world.rules || []).map((rule) => rule.gloss || ''),
    releasedSurface,
    learnerText,
  ].join('\n');
}

const PRIVATE_TOKEN_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'alone',
  'answer',
  'assay',
  'because',
  'before',
  'bench',
  'blank',
  'blanks',
  'came',
  'cast',
  'coin',
  'coins',
  'could',
  'down',
  'evidence',
  'false',
  'hand',
  'line',
  'make',
  'mark',
  'name',
  'only',
  'public',
  'rule',
  'says',
  'shilling',
  'shillings',
  'should',
  'single',
  'struck',
  'that',
  'their',
  'them',
  'these',
  'this',
  'trial',
  'turn',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText }) {
  const publicTokens = textTokens(publicTextForTurn(world, tutorTurn, learnerText));
  const rows = [];
  for (const premise of world?.premises || []) {
    const release = world.releaseSchedule.find((entry) => entry.premise === premise.id);
    if (!release || release.turn <= tutorTurn) continue;

    const factTokens = new Set(
      (premise.fact || [])
        .slice(1)
        .flatMap(splitSymbolWords)
        .filter((token) => token.length >= 4 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token)),
    );
    const surfaceTokens = new Set(
      splitSymbolWords(premise.surface)
        .filter((token) => token.length >= 5 && !PRIVATE_TOKEN_STOPWORDS.has(token) && !publicTokens.has(token)),
    );
    const factMatches = [...factTokens].filter((token) => textContainsToken(text, token));
    const surfaceMatches = [...surfaceTokens].filter((token) => textContainsToken(text, token));
    const strongMatches = [...new Set([...factMatches, ...surfaceMatches])].sort();
    if (factMatches.length || surfaceMatches.length >= 2) {
      rows.push({
        premise: premise.id,
        scheduledTurn: release.turn,
        matches: strongMatches,
      });
    }
  }
  return rows;
}

function auditTutorResponseLeak({ text, world, tutorTurn, learnerText }) {
  if (!world) return { ok: true, leaks: [] };
  const leaks = [];
  const answerTerm = answerTermForWorld(world);
  const answerTokens = splitSymbolWords(answerTerm);
  const mentionsAnswer = answerTokens.some((token) => textContainsToken(text, token));
  const finalEntailed = entailsFactAtTurn(world, tutorTurn, world.secret.fact);

  if (mentionsAnswer && !finalEntailed) {
    leaks.push({
      type: 'concealed_answer_name',
      reason: `mentions ${answerTerm} before the public record entails the answer`,
      matches: answerTokens,
    });
  }

  if (mentionsAnswer) {
    const lower = String(text || '').toLowerCase();
    const intermediateChecks = [
      {
        fact: ['castBlankFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/cast/u, /blank/u],
        label: 'private_blank_conclusion',
      },
      {
        fact: ['cutDieFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/\bcut\b/u, /\bdie\b/u],
        label: 'private_die_conclusion',
      },
      {
        fact: world.secret.fact,
        words: [/\bstruck\b/u, /\bstrike\b/u, /\bcoiner\b/u, /\bcoined\b/u, /\bmade\b/u],
        label: 'private_final_conclusion',
      },
    ];
    for (const check of intermediateChecks) {
      if (check.words.some((pattern) => pattern.test(lower)) && !entailsFactAtTurn(world, tutorTurn, check.fact)) {
        leaks.push({
          type: check.label,
          reason: `states a conclusion about ${answerTerm} before that conclusion is derivable from released evidence`,
          fact: factText(check.fact),
        });
      }
    }
  }

  for (const row of unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText })) {
    leaks.push({
      type: 'unreleased_premise_content',
      reason: `uses content from ${row.premise} before its scheduled release at turn ${row.scheduledTurn}`,
      premise: row.premise,
      matches: row.matches,
    });
  }

  return {
    ok: leaks.length === 0,
    leaks,
    finalEntailed,
  };
}

function tutorLeakRepairPrompt({ originalUserPrompt, unsafeDraft, audit }) {
  const leakRows = (audit.leaks || [])
    .map((leak, index) => `${index + 1}. ${leak.type}: ${leak.reason}`)
    .join('\n');
  return [
    originalUserPrompt,
    '',
    '[Tutor-only repair instruction]',
    'Your previous draft leaked hidden/private proof content and must not be shown to the learner.',
    'Rewrite the tutor reply from scratch.',
    'Use only public setup, already released evidence, and public rules.',
    'Do not name the concealed answer, any hidden actor, any unreleased object, or any intermediate conclusion involving them.',
    'Do not use predicate/function notation, premise ids, rule ids, or route labels.',
    'Do not use compressed technical labels such as "sole-caster", "blank-route", or "die-route"; translate them into ordinary evidence language.',
    'If the learner wants an answer, ask what public evidence would license the next step instead.',
    '',
    'Leak audit:',
    leakRows || '- unspecified private-content leak',
    '',
    'Unsafe draft to replace:',
    unsafeDraft,
    '[End tutor-only repair instruction]',
  ].join('\n');
}

function deterministicLeakFallback({ learnerText }) {
  const asksForChoice = /\b(choice|choose|which|what|next|write)\b/iu.test(learnerText || '');
  if (asksForChoice) {
    return [
      "I can't put a name or private conclusion in the trial-book yet.",
      'Choose one public test instead: the metal trail, the die-mark trail, or a witness/forge sighting.',
      'Which one do you want to examine first?',
    ].join(' ');
  }
  return [
    "I can't license that conclusion yet.",
    'Name the public evidence that would make the next step follow, or keep the verdict open.',
  ].join(' ');
}

function ruleText(rule, index) {
  const left = (rule.if || []).map(factText).join(' + ');
  const right = (rule.then || []).map(factText).join(' + ');
  return `${index + 1}. ${rule.id}: ${left} -> ${right}\n   ${String(rule.gloss || '').trim()}`;
}

function worldFiles() {
  return fs
    .readdirSync(WORLD_DIR)
    .filter((file) => /^world-.*\.yaml$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(WORLD_DIR, file));
}

function loadWorldSummaries() {
  return worldFiles().map((filePath) => {
    const world = loadWorld(filePath);
    return { filePath, world };
  });
}

function printWorlds() {
  for (const { filePath, world } of loadWorldSummaries()) {
    console.log(`${world.id.padEnd(38)} ${world.title}`);
    console.log(`  ${path.relative(ROOT, filePath)}`);
    console.log(`  ${world.question}`);
  }
}

function resolveWorldRef(ref) {
  if (!ref || ref === 'none' || ref === 'off' || ref === 'false') return null;

  const directPath = path.resolve(ROOT, ref);
  if (fs.existsSync(directPath)) {
    return { filePath: directPath, world: loadWorld(directPath) };
  }

  const byFileName = path.join(WORLD_DIR, ref.endsWith('.yaml') ? ref : `${ref}.yaml`);
  if (fs.existsSync(byFileName)) {
    return { filePath: byFileName, world: loadWorld(byFileName) };
  }

  const needle = ref.toLowerCase();
  const matches = loadWorldSummaries().filter(({ filePath, world }) => {
    const stem = path.basename(filePath, '.yaml').toLowerCase();
    return (
      world.id.toLowerCase() === needle ||
      stem === needle ||
      stem.startsWith(`world-${needle}-`) ||
      stem.endsWith(`-${needle}`) ||
      world.title.toLowerCase().includes(needle)
    );
  });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Ambiguous --world "${ref}". Matches: ${matches.map((m) => m.world.id).join(', ')}`);
  }
  throw new Error(`Unknown --world "${ref}". Use --list-worlds to see available IDs.`);
}

function worldPublicPrompt(world) {
  if (!world) return [];
  return [
    '',
    '# Detective-story world',
    '',
    `World: ${world.id} — ${world.title}`,
    world.discipline ? `Discipline: ${world.discipline}` : null,
    `Public question: ${world.question}`,
    '',
    'Opening situation visible to the learner:',
    String(world.setting || '').trim(),
    '',
    'Learner role:',
    String(world.learnerVoice || '').trim(),
    '',
    'Your task in story mode:',
    '- Play the tutor/investigator guiding the learner through the case.',
    '- Treat the learner as the investigator; do not solve the case for them.',
    '- Keep the public question alive and ask for grounded inferences from evidence.',
  ].filter(Boolean);
}

function buildDirectorInitialContext(world) {
  if (!world) return null;
  return {
    stageNotes: [
      `Before the first exchange, ${world.title} is set as a public inquiry: ${world.question}`,
      String(world.setting || '').trim(),
    ]
      .filter(Boolean)
      .join('\n'),
    tutorCharacter: 'The tutor enters as a patient dramaturg of evidence, careful not to outrun the learner.',
    learnerCharacter:
      String(world.learnerVoice || '').trim() ||
      'The learner enters as attentive but not yet committed, willing to test each claim aloud.',
    registerNote:
      'The register should follow the public characters and scene pressure; do not add hidden evidence or proof machinery.',
  };
}

function printDirectorInitialContext(context) {
  if (!context) return;
  const printField = (label, text) => {
    const lines = String(text || '').split('\n');
    console.log(`${C.dim}  ${label}:${C.reset} ${lines[0] || ''}`);
    for (const line of lines.slice(1)) {
      console.log(`    ${line}`);
    }
  };
  console.log(`${C.cyan}director context >${C.reset}`);
  printField('stage', context.stageNotes);
  printField('tutor', context.tutorCharacter);
  printField('learner', context.learnerCharacter);
  printField('register', context.registerNote);
  console.log();
}

function worldDagPrompt(world) {
  if (!world) return [];
  const lint = plotLint(world);
  const tutorDag = buildTutorDesireDag(world);
  const premiseLedger = world.premises
    .map((premise) => {
      const scheduled = world.releaseSchedule.find((entry) => entry.premise === premise.id);
      const cue = scheduled ? `turn ${scheduled.turn} via ${scheduled.via}` : 'unscheduled';
      return `- ${premise.id} (${cue}): ${String(premise.surface || '').trim()}\n  fact: ${factText(premise.fact)}`;
    })
    .join('\n');
  const proofPaths = world.proofPaths
    .map((proofPath, index) => `- path ${index + 1}: ${proofPath.premises.join(' -> ')}`)
    .join('\n');
  const schedule = world.releaseSchedule
    .map((entry) => `- turn ${entry.turn}: ${entry.premise} via ${entry.via}`)
    .join('\n');

  return [
    '',
    '# Optional DAG machinery for the tutor',
    '',
    'You hold the concealed answer, the public rules, the hidden premise ledger, the authored proof path, and the release schedule.',
    'This is tutor-only control information. The learner must get evidence through staged releases, not through your authority.',
    '',
    `Concealed answer (never state, confirm, or deny directly): ${world.secret.surface || factText(world.secret.fact)}`,
    world.mirror ? `Tempting public near-miss: ${factText(world.mirror.fact)}` : null,
    `Plot lint: ${lint.ok ? 'ok' : `errors: ${lint.errors.join('; ')}`}`,
    `First scheduled entailment turn: ${lint.firstEntailedTurn ?? 'not entailed'}`,
    `Tutor desire-DAG leaves: ${(tutorDag.leaves || []).join(', ') || 'none'}`,
    '',
    'Public rules of evidence:',
    ...world.rules.map(ruleText),
    '',
    'Hidden premise ledger. Never voice an unreleased premise. When a premise is due, stage its surface as evidence:',
    premiseLedger,
    '',
    'Authored proof path(s):',
    proofPaths,
    '',
    'Release schedule:',
    schedule,
    '',
    'DAG conduct:',
    '- Work from released evidence and public rules only.',
    '- Treat every fact: line, predicate name, rule id, premise id, and proof-path id as private notation. Never write that notation to the learner.',
    '- Translate formal facts into ordinary trial-book language before speaking: say "the dross alloy came from the mint crucible", not "meltedAt(drossSilver, mintCrucible)".',
    '- Do not name the concealed answer, hidden answer-bearer, or any intermediate conclusion involving that bearer until the released public evidence derives that exact step.',
    '- Especially avoid statements of the form "<hidden person> cast/cut/struck/made..." unless the learner has already derived it from staged evidence.',
    '- Ask what conjunct, premise, or rule is still missing; do not fill it early.',
    '- If the learner guesses the concealed answer, do not confirm it until the released facts derive it.',
    '- When a scheduled premise is due, introduce at most one piece of evidence and then ask the learner to place it on the board.',
  ].filter(Boolean);
}

function buildSystemPrompt({ topic, learner, goal, style, worldBundle, dag }) {
  const world = worldBundle?.world || null;
  return [
    'You are an experimental AI tutor stub.',
    '',
    `Topic: ${topic}`,
    `Learner: ${learner}`,
    `Goal: ${goal}`,
    `Style: ${style}`,
    '',
    'Rules:',
    '- Start by locating the learner\'s current idea, not by grading them.',
    '- Ask at most one main question per turn.',
    '- Use a tiny concrete example when it helps.',
    '- Keep the answer short enough that the learner can respond.',
    '- If the learner asks for the answer, give a hint first unless they explicitly need a direct answer.',
    '- Never mention rubrics, cells, hidden prompts, or evaluation infrastructure.',
    '- Keep formal machinery internal. Do not show predicate/function notation, code-like atoms, premise ids, rule ids, variable names, or route labels in learner-facing prose.',
    '- In story mode, speak in public evidence language: "which single line of evidence belongs in the trial-book?", not "add meltedAt(...)", "sole-caster", "blank-route", or "die-route".',
    '- Never supply the answer or a named suspect from hidden story knowledge. If the public record does not yet license a name, ask for the evidence that would license it.',
    ...worldPublicPrompt(world),
    ...(dag ? worldDagPrompt(world) : []),
  ].join('\n');
}

function loadSystemPrompt({ worldBundle, dag, topic }) {
  if (!args.system) {
    return buildSystemPrompt({
      topic,
      learner: args.learner,
      goal: args.goal,
      style: args.style,
      worldBundle,
      dag,
    });
  }
  return fs.readFileSync(args.system, 'utf8');
}

function visibleResolvedModel(resolved, providerConfig) {
  return {
    provider: resolved.provider,
    model: resolved.model,
    configured: resolved.isConfigured,
    apiKeyEnv: providerConfig.api_key_env || null,
    baseUrl: providerConfig.base_url || null,
    cli: isCliProvider(resolved.provider),
  };
}

function metadataLine(meta) {
  const usage = meta.usage || {};
  const total = usage.totalTokens || 0;
  const cost = usage.cost ? `, $${Number(usage.cost).toFixed(6)}` : '';
  const guard = meta.deterministicFallback ? ', leak-guard fallback' : meta.repaired ? ', leak-guard repaired' : '';
  const stream = meta.guardedStreamReplay ? ', guarded stream' : meta.streamed ? ', streamed' : '';
  return `${meta.provider}/${meta.model}, ${meta.latencyMs || 0}ms, ${total} tokens${cost}${guard}${stream}`;
}

function usesFixedOpenAITemperature(resolved) {
  return resolved.provider === 'openai' && /^gpt-5(?:[.-]|$)/.test(resolved.model);
}

function effectiveTemperatureForModel(resolved, requestedTemperature) {
  if (usesFixedOpenAITemperature(resolved)) {
    return 1;
  }
  return requestedTemperature;
}

function buildRegisterPalette(mode) {
  const definitions = getEngagementRegisterDefinitions();
  const allNames = Object.keys(definitions);
  const safeNames = getEngagementRegisterNames({ includeArmAssigned: false });
  const value = String(mode || 'all').trim().toLowerCase();

  let names;
  if (!value || value === 'safe' || value === 'router' || value === 'positive') {
    names = safeNames;
  } else if (value === 'negative') {
    names = [
      ...safeNames,
      ...allNames.filter((name) => {
        const def = definitions[name] || {};
        return def.router_selectable === false && def.simulated_only !== true && ['liminal', 'negative'].includes(def.valence);
      }),
    ];
  } else if (value === 'non-simulated') {
    names = allNames.filter((name) => definitions[name]?.simulated_only !== true);
  } else if (value === 'all' || value === 'simulated') {
    names = allNames;
  } else {
    names = value
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const unknown = names.filter((name) => !definitions[name]);
  if (unknown.length) {
    throw new Error(
      `Unknown --register-palette register(s): ${unknown.join(', ')}. Known: ${allNames.join(', ')}`,
    );
  }

  return [...new Set(names)];
}

function registerDefinitionSummary(name) {
  const def = getEngagementRegisterDefinition(name) || {};
  return {
    register: name,
    valence: def.valence || 'unknown',
    router_selectable: def.router_selectable === true,
    simulated_only: def.simulated_only === true,
    trigger: def.trigger || null,
    stance_contract: String(def.stance_contract || '').trim(),
    required_moves: Array.isArray(def.required_moves) ? def.required_moves : [],
    risk_flags: Array.isArray(def.risk_flags) ? def.risk_flags : [],
    forbidden_phrases: Array.isArray(def.forbidden_phrases) ? def.forbidden_phrases : [],
    recognition_guardrail: String(def.recognition_guardrail || '').trim() || null,
  };
}

function registerPalettePromptRows(palette) {
  return JSON.stringify(palette.map(registerDefinitionSummary), null, 2);
}

function learnerDagPromptSummary(model) {
  if (!model) return 'No prior tutor-side learner-DAG model is available yet.';
  const record = model.learnerRecord || {};
  return JSON.stringify(
    {
      turn: model.turn ?? null,
      metrics: model.metrics || {},
      assessment: model.assessment || {},
      learnerRecord: {
        grounded: (record.grounded || []).slice(-8),
        voicedDerived: (record.voicedDerived || []).slice(-8),
        hypotheses: (record.hypotheses || []).slice(-5),
        answerCandidates: record.answerCandidates || [],
      },
    },
    null,
    2,
  );
}

function registerHistoryPromptSummary(state) {
  const history = state.register?.history || [];
  if (!history.length) return 'No prior tutor-register choices.';
  return history
    .slice(-6)
    .map((entry) => {
      const efficacy = entry.efficacy
        ? `${entry.efficacy.label} (score ${entry.efficacy.progressScore}; ${entry.efficacy.summary})`
        : 'pending next learner turn';
      return `Turn ${entry.turn}: ${entry.selected_register} — ${entry.register_reason || 'no reason'}; efficacy: ${efficacy}`;
    })
    .join('\n');
}

function firstJsonObjectCandidate(text) {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function parseClassifierJson(rawText) {
  const text = String(rawText || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [text, fenced, firstJsonObjectCandidate(text)].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { parsed, parseError: null };
      }
    } catch (_) {
      // Try the next extraction strategy.
    }
  }

  return {
    parsed: {
      turn: {
        summary: 'Classifier returned non-JSON output.',
        discourse_move: 'unknown',
        evidence_use: 'unknown',
        epistemic_stance: 'unknown',
        affect: 'unknown',
        agency: 'unknown',
        scores: {},
        pedagogical_need: 'Inspect the raw classifier output before relying on this turn label.',
      },
      overall: {
        summary: 'No structured overall learner classification is available.',
        trajectory: 'unknown',
        recurring_pattern: 'unknown',
        current_state: 'unknown',
        next_best_tutor_move: 'Continue with a diagnostic question grounded in the learner input.',
      },
      raw: text,
    },
    parseError: 'Classifier output was not parseable JSON.',
  };
}

function classifierTranscript(turns, limit) {
  const recent = turns.slice(-limit);
  if (recent.length === 0) return 'No previous turns.';
  return recent
    .map((turn, index) => {
      const absoluteTurn = turns.length - recent.length + index + 1;
      return [`Turn ${absoluteTurn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`].join('\n');
    })
    .join('\n\n');
}

function classifierWorldContext(state) {
  if (!state.world) return 'No detective-story world is active.';
  return [
    `World: ${state.world.id} - ${state.world.title}`,
    state.world.discipline ? `Discipline: ${state.world.discipline}` : null,
    `Public question: ${state.world.question}`,
    `Opening situation: ${String(state.world.setting || '').trim()}`,
    `DAG mode: ${state.dag ? 'on, but hidden DAG state is intentionally withheld from this classifier' : 'off'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildLearnerClassifierPrompt({ learnerText, state }) {
  return [
    '# Task',
    '',
    'Classify the learner input before the tutor responds.',
    'Spell out exactly two headline judgments:',
    '1. What the learner has done in this turn.',
    '2. What the learner has done overall across the dialogue so far.',
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Previous public transcript',
    '',
    classifierTranscript(state.turns, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Conceptual engagement score:',
    '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
    '',
    'Epistemic readiness score:',
    '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
    '',
    'Use these controlled labels where possible:',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, links_evidence_to_rule, overleaps_evidence, revises_from_evidence',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        turn: {
          summary: 'plain-language sentence naming what the learner did in this turn',
          discourse_move: 'one controlled label',
          evidence_use: 'one controlled label',
          epistemic_stance: 'one controlled label',
          affect: 'brief affect/energy label',
          agency: 'one controlled label',
          scores: {
            conceptual_engagement: { score: 1, reason: 'brief reason' },
            epistemic_readiness: { score: 1, reason: 'brief reason' },
          },
          pedagogical_need: 'what the tutor should attend to immediately',
        },
        overall: {
          summary: 'plain-language sentence naming what the learner has done overall',
          trajectory: 'how their participation is changing or not changing',
          recurring_pattern: 'dominant pattern across turns, or none yet',
          current_state: 'where the learner seems to be now',
          next_best_tutor_move: 'best immediate tutor move based on public evidence only',
        },
      },
      null,
      2,
    ),
  ].join('\n');
}

async function callPromptModel({ prompt, resolved, systemPrompt, role, maxTokens = 700, trace = null, stream = null }) {
  const startedAt = new Date().toISOString();
  const shouldStream = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  try {
    let response;
    if (isCliProvider(resolved.provider)) {
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        systemPrompt,
        prompt,
        role,
        { messageHistory: [] },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
      };
    } else if (shouldStream) {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const sink = createConsoleTokenSink(role);
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink.finish();
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
      };
    } else {
      const temperature = effectiveTemperatureForModel(resolved, 0.1);
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      startedAt,
      provider: response.provider,
      model: response.model,
      request: {
        systemPrompt,
        prompt,
        maxTokens,
      },
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
      },
    });
    return response;
  } catch (err) {
    appendTraceEvent(trace, {
      type: 'model_call_error',
      role,
      startedAt,
      provider: resolved.provider,
      model: resolved.model,
      request: {
        systemPrompt,
        prompt,
        maxTokens,
      },
      error: err.message,
    });
    throw err;
  }
}

async function callClassifierModel({ prompt, resolved, trace = null, stream = null }) {
  return await callPromptModel({
    prompt,
    resolved,
    systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_classifier',
    maxTokens: 700,
    trace,
    stream,
  });
}

function failedClassification({ message, resolved, latencyMs = 0, usage = null }) {
  return {
    error: message,
    turn: {
      summary: 'Classifier failed before the tutor turn.',
      discourse_move: 'unknown',
      evidence_use: 'unknown',
      epistemic_stance: 'unknown',
      affect: 'unknown',
      agency: 'unknown',
      scores: {},
      pedagogical_need: 'Proceed cautiously and use the learner input directly.',
    },
    overall: {
      summary: 'Overall classification is unavailable because the classifier failed.',
      trajectory: 'unknown',
      recurring_pattern: 'unknown',
      current_state: 'unknown',
      next_best_tutor_move: 'Ask a focused diagnostic question.',
    },
    provider: resolved?.provider || null,
    model: resolved?.model || null,
    latencyMs,
    usage: usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
  };
}

async function classifyLearnerInput({ learnerText, state }) {
  const startedAt = Date.now();
  try {
    const prompt = buildLearnerClassifierPrompt({ learnerText, state });
    const raw = await callClassifierModel({
      prompt,
      resolved: state.classifier.resolved,
      trace: state.trace,
      stream: state.stream,
    });
    const { parsed, parseError } = parseClassifierJson(raw.text);
    return {
      ...parsed,
      parseError,
      provider: raw.provider,
      model: raw.model,
      latencyMs: raw.latencyMs,
      usage: raw.usage,
    };
  } catch (err) {
    return failedClassification({
      message: err.message,
      resolved: state.classifier.resolved,
      latencyMs: Date.now() - startedAt,
    });
  }
}

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function printClassification(classification) {
  if (!classification) return;
  const conceptual = scoreValue(classification.turn?.scores?.conceptual_engagement);
  const readiness = scoreValue(classification.turn?.scores?.epistemic_readiness);
  const move = classification.turn?.discourse_move || 'unknown';
  const stance = classification.turn?.epistemic_stance || 'unknown';
  const need = classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || '';
  const errorPrefix = classification.error || classification.parseError ? `${C.red} learner-classifier warning${C.reset}` : '';

  console.log(`${C.cyan}learner classifier >${C.reset} ${classification.turn?.summary || 'No turn summary.'}`);
  console.log(
    `${C.dim}  move: ${move}; stance: ${stance}; conceptual ${conceptual}/5, readiness ${readiness}/5${C.reset}`,
  );
  console.log(`${C.dim}  overall: ${classification.overall?.summary || 'No overall summary.'}${C.reset}`);
  if (need) console.log(`${C.dim}  tutor cue: ${need}${C.reset}`);
  if (errorPrefix) console.log(`${errorPrefix}${C.dim}: ${classification.error || classification.parseError}${C.reset}`);
}

function clearStatusLine() {
  process.stdout.write(`${' '.repeat(80)}\r`);
}

function createTraceState({ enabled, traceDir, metadata }) {
  if (!enabled) return { enabled: false };
  const dir = resolveWorkspacePath(traceDir);
  const runId = safeTimestampForFile();
  const filePath = path.join(dir, `${runId}.jsonl`);
  fs.mkdirSync(dir, { recursive: true });
  const trace = {
    enabled: true,
    dir,
    filePath,
    runId,
    seq: 0,
  };
  appendTraceEvent(trace, {
    type: 'run_start',
    metadata,
  });
  return trace;
}

function appendTraceEvent(trace, event) {
  if (!trace?.enabled) return;
  const entry = {
    ts: new Date().toISOString(),
    runId: trace.runId,
    seq: ++trace.seq,
    ...event,
  };
  fs.appendFileSync(trace.filePath, `${JSON.stringify(entry)}\n`);
}

function traceDisplayPath(trace) {
  if (!trace?.enabled) return null;
  return path.relative(ROOT, trace.filePath);
}

function jsonClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function readTraceEvents(filePath) {
  const events = [];
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') events.push(parsed);
    } catch (_) {
      // Ignore damaged trace lines; the next valid event may still be useful.
    }
  }
  return events;
}

function dialogueTurnsFromTraceEvents(events) {
  const turns = [];
  for (const event of events) {
    if (event?.type === 'history_clear') {
      turns.length = 0;
      continue;
    }
    if (event?.type !== 'turn_complete' || !event.turnRecord) continue;
    turns.push(jsonClone(event.turnRecord));
  }
  return turns;
}

function latestDialogueTrace(traceDir) {
  const dir = resolveWorkspacePath(traceDir);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(dir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .map((filePath) => ({ filePath, mtimeMs: fs.statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const { filePath } of files) {
    const events = readTraceEvents(filePath);
    const turns = dialogueTurnsFromTraceEvents(events);
    if (!turns.length) continue;
    const metadata = events.find((event) => event?.type === 'run_start')?.metadata || null;
    return { filePath, metadata, turns, events };
  }
  return null;
}

function restoreRegisterStateFromTurns(state, turns) {
  if (!state.register?.enabled) return { restored: 0 };
  const byTurn = new Map();
  for (const turn of turns) {
    if (!turn?.registerSelection) continue;
    const selection = jsonClone(turn.registerSelection);
    const key = Number(selection.turn || turn.turn);
    if (!Number.isFinite(key)) continue;
    byTurn.set(key, selection);
  }
  for (const turn of turns) {
    const efficacy = turn?.previousRegisterEfficacy;
    const key = Number(efficacy?.registerTurn);
    if (!Number.isFinite(key) || !byTurn.has(key)) continue;
    const selection = byTurn.get(key);
    if (!selection.efficacy) selection.efficacy = jsonClone(efficacy);
  }
  state.register.history = [...byTurn.values()].sort((a, b) => Number(a.turn || 0) - Number(b.turn || 0));
  state.register.current = state.register.history[state.register.history.length - 1] || null;
  return { restored: state.register.history.length };
}

function replayLearnerDagFromTurns(state, turns) {
  if (!state.learnerDag?.enabled || !state.world) return { replayed: 0, skipped: 0 };
  let replayed = 0;
  let skipped = 0;
  for (const turn of turns) {
    const accepted = turn?.tutorLearnerDagUpdate?.accepted;
    if (accepted) {
      const result = applyLearnerRecordUpdate({
        update: {
          adopt: accepted.adopt || [],
          retract: accepted.retract || [],
          derive: accepted.derive || [],
          hypothesis: accepted.hypothesis || null,
          assert_answer: accepted.assertAnswer || null,
        },
        state,
        tutorTurn: Number(turn.turn) || replayed + 1,
        learnerText: turn.learner || '',
      });
      state.learnerDag.lastModel = result.model;
      replayed += 1;
      continue;
    }
    if (turn?.tutorLearnerDagModel) {
      state.learnerDag.lastModel = jsonClone(turn.tutorLearnerDagModel);
      skipped += 1;
    }
  }
  return { replayed, skipped };
}

function restoreDialogueFromTrace(state, resume, { currentWorld }) {
  if (!resume?.turns?.length) return null;
  const turns = resume.turns.map((turn) => jsonClone(turn));
  state.turns = turns;
  state.history = [];
  for (const turn of turns) {
    if (turn.learner) state.history.push({ role: 'user', content: turn.learner });
    if (turn.tutor) state.history.push({ role: 'assistant', content: turn.tutor });
  }

  const register = restoreRegisterStateFromTurns(state, turns);
  const learnerDag = replayLearnerDagFromTurns(state, turns);
  const warnings = [];
  const resumedWorld = resume.metadata?.world?.id || null;
  if (resumedWorld && currentWorld?.id && resumedWorld !== currentWorld.id) {
    warnings.push(`trace world ${resumedWorld} differs from current world ${currentWorld.id}`);
  }
  return {
    source: resume.filePath,
    turns: turns.length,
    register,
    learnerDag,
    metadata: resume.metadata || null,
    warnings,
  };
}

function providerSupportsStreaming(resolved) {
  return Boolean(resolved?.provider && !isCliProvider(resolved.provider));
}

function streamEnabledFor(state, resolved) {
  return Boolean(state?.stream?.enabled && providerSupportsStreaming(resolved));
}

function streamLabel(role) {
  if (role === 'tutor_stub_tutor') return `${C.magenta}tutor >${C.reset} `;
  if (role === 'tutor_stub_learner_analysis') return `${C.cyan}learner analysis stream >${C.reset} `;
  if (role === 'tutor_stub_learner_record') return `${C.cyan}learner DAG stream >${C.reset} `;
  if (role === 'tutor_stub_learner_classifier') return `${C.cyan}learner classifier stream >${C.reset} `;
  return `${C.cyan}${role} >${C.reset} `;
}

function createConsoleTokenSink(role) {
  let started = false;
  return {
    write(token) {
      if (!started) {
        clearStatusLine();
        process.stdout.write(streamLabel(role));
        started = true;
      }
      process.stdout.write(token);
    },
    finish() {
      if (started) process.stdout.write('\n');
      return started;
    },
  };
}

function replayTextAsConsoleStream(role, text) {
  const sink = createConsoleTokenSink(role);
  const tokens = String(text || '').match(/\S+\s*/g) || [];
  for (const token of tokens) sink.write(token);
  return sink.finish();
}

async function classifyForTurn(learnerText, state) {
  if (!state.classifier.enabled) return null;
  process.stdout.write(`${C.dim}classifying learner...${C.reset}\r`);
  const classification = await classifyLearnerInput({ learnerText, state });
  clearStatusLine();
  printClassification(classification);
  return classification;
}

function releaseLedgerForTurn(world, turn) {
  if (!world) return [];
  return world.releaseSchedule
    .filter((entry) => entry.turn <= turn)
    .map((entry) => ({ turn: entry.turn, premiseId: entry.premise, via: entry.via }));
}

function factFromQuestionAnswer(world, answer) {
  const cleaned = String(answer || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .toLowerCase();
  if (!world || !cleaned) return null;
  return world.questionPattern.map((part) => (typeof part === 'string' && part.startsWith('?') ? cleaned : part));
}

function factSurface(world, fact) {
  if (!world || !Array.isArray(fact)) return factText(fact);
  const key = factKey(fact);
  for (const premise of world.premises || []) {
    if (factKey(premise.fact) === key) return String(premise.surface || factText(fact)).trim();
  }
  return factText(fact);
}

function stagedEvidenceRows(world, turn) {
  return releaseLedgerForTurn(world, turn).map((entry) => {
    const premise = world.premiseById.get(entry.premiseId);
    return {
      premise: entry.premiseId,
      turn: entry.turn,
      via: entry.via,
      surface: String(premise?.surface || '').trim(),
      fact: premise?.fact || null,
    };
  });
}

function learnerRecordTranscript(turns, limit) {
  const recent = turns.slice(-limit);
  if (recent.length === 0) return 'No previous turns.';
  return recent
    .map((turn, index) => {
      const absoluteTurn = turns.length - recent.length + index + 1;
      return [`Turn ${absoluteTurn}`, `Learner: ${turn.learner}`, `Tutor: ${turn.tutor}`].join('\n');
    })
    .join('\n\n');
}

function buildLearnerRecordPrompt({ learnerText, state, tutorTurn }) {
  const staged = stagedEvidenceRows(state.world, tutorTurn);
  return [
    '# Task',
    '',
    'Extract a conservative public learner-record update from the current learner turn.',
    'This update feeds a tutor-side model of the learner DAG. It is not the learner\'s private state.',
    '',
    '# Public question',
    state.world.question,
    '',
    '# Public rules',
    ...state.world.rules.map(ruleText),
    '',
    '# Staged public evidence available at or before this turn',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    learnerRecordTranscript(state.turns, state.historyTurns),
    '',
    '# Current learner turn',
    learnerText,
    '',
    '# Extraction rules',
    '',
    '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
    '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
    '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
    '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
    '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
    '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
    '',
    '# JSON schema',
    '',
    JSON.stringify(
      {
        adopt: ['premise_id'],
        retract: ['premise_id'],
        derive: [['predicate', 'arg1', 'arg2']],
        hypothesis: 'short hypothesis or null',
        assert_answer: 'candidate name or null',
        notes: 'brief reason for the extraction',
      },
      null,
      2,
    ),
  ].join('\n');
}

function learnerClassificationSchema() {
  return {
    turn: {
      summary: 'plain-language sentence naming what the learner did in this turn',
      discourse_move: 'one controlled label',
      evidence_use: 'one controlled label',
      epistemic_stance: 'one controlled label',
      affect: 'brief affect/energy label',
      agency: 'one controlled label',
      scores: {
        conceptual_engagement: { score: 1, reason: 'brief reason' },
        epistemic_readiness: { score: 1, reason: 'brief reason' },
      },
      pedagogical_need: 'what the tutor should attend to immediately',
    },
    overall: {
      summary: 'plain-language sentence naming what the learner has done overall',
      trajectory: 'how their participation is changing or not changing',
      recurring_pattern: 'dominant pattern across turns, or none yet',
      current_state: 'where the learner seems to be now',
      next_best_tutor_move: 'best immediate tutor move based on public evidence only',
    },
  };
}

function learnerRecordSchema() {
  return {
    adopt: ['premise_id'],
    retract: ['premise_id'],
    derive: [['predicate', 'arg1', 'arg2']],
    hypothesis: 'short hypothesis or null',
    assert_answer: 'candidate name or null',
    notes: 'brief reason for the extraction',
  };
}

function registerSelectionSchema() {
  return {
    selected_register: 'one available tutor register name',
    learner_signal: 'brief learner signal that licenses the register',
    register_reason: 'why this register fits the classifier result and learner-DAG state',
    evidence_span: 'short quote or public-state cue supporting the choice',
    risk_flags: ['guardrail flags, or empty array'],
    expected_dag_move: 'what learner-DAG progress this register is meant to produce next',
    expected_progress_marker: 'what the next learner turn should show if this register worked',
    confidence: 0.75,
  };
}

function buildCombinedLearnerAnalysisPrompt({ learnerText, state, tutorTurn }) {
  const staged = stagedEvidenceRows(state.world, tutorTurn);
  const includeRegisterSelection = Boolean(state.register?.enabled && state.register.palette?.length);
  const schema = {
    classification: learnerClassificationSchema(),
    learner_record: learnerRecordSchema(),
  };
  if (includeRegisterSelection) schema.register_selection = registerSelectionSchema();
  return [
    '# Task',
    '',
    'Analyze the learner input once before the tutor responds.',
    'Return both:',
    '1. A pedagogical discourse classification.',
    '2. A conservative public learner-record update for the tutor-side learner-DAG model.',
    includeRegisterSelection
      ? '3. A tutor-register selection driven by the classification plus the tutor-side learner-DAG state.'
      : null,
    '',
    '# Public tutoring context',
    '',
    `Topic: ${state.topic}`,
    classifierWorldContext(state),
    '',
    '# Public question',
    '',
    state.world.question,
    '',
    '# Public rules',
    '',
    ...state.world.rules.map(ruleText),
    '',
    '# Staged public evidence available at or before this turn',
    '',
    staged.length
      ? staged
          .map((row) => {
            return [
              `- ${row.premise} (staged turn ${row.turn} via ${row.via})`,
              `  surface: ${row.surface}`,
              `  fact: ${JSON.stringify(row.fact)}`,
            ].join('\n');
          })
          .join('\n')
      : '- none',
    '',
    '# Previous public transcript',
    '',
    learnerRecordTranscript(state.turns, state.historyTurns),
    '',
    '# Current learner turn',
    '',
    learnerText,
    '',
    '# Compact pedagogical discourse rubric',
    '',
    'Conceptual engagement score:',
    '1 = parrots or only asks for an answer; 2 = procedural or surface focus; 3 = some conceptual engagement but mostly paraphrase; 4 = substantive connections or reasoning; 5 = constructs, tests, or revises an interpretation.',
    '',
    'Epistemic readiness score:',
    '1 = pure information reception; 2 = minimal metacognition; 3 = generic awareness of confusion or strategy; 4 = distinguishes genuine understanding from performance and asks evidence-generating questions; 5 = actively monitors bias, uncertainty, evidence, and what would count as knowing.',
    '',
    'Use these controlled classifier labels where possible:',
    '- discourse_move: question, claim, hypothesis, inference, evidence_adoption, challenge, repair_request, affective_signal, answer_seeking, metacognitive_reflection, off_task',
    '- evidence_use: none, repeats_setup, cites_public_evidence, links_evidence_to_rule, overleaps_evidence, revises_from_evidence',
    '- epistemic_stance: receptive, confused, exploratory, overconfident, resistant, answer_seeking, reflective, grounded',
    '- agency: passive, complying, attempting, steering, self_correcting',
    '',
    '# Learner-record extraction rules',
    '',
    '- adopt: include only staged premise ids the learner explicitly accepts, uses, restates, or treats as evidence.',
    '- retract: include only staged premise ids the learner explicitly rejects or withdraws.',
    '- derive: include fact arrays only when the learner voices a conclusion supported by adopted/staged evidence and public rules.',
    '- hypothesis: one short sentence if the learner offers a conjecture, uncertainty, or provisional theory.',
    '- assert_answer: the named answer candidate if the learner directly answers the public question; otherwise null.',
    '- Be conservative. Do not mark staged evidence adopted merely because it exists.',
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Tutor-register selection' : null,
    includeRegisterSelection
      ? 'Select one tutor register for the upcoming tutor response. Treat learner signal and tutor register as separate axes.'
      : null,
    includeRegisterSelection
      ? 'The selected register should be appropriate to both the discourse classification and the learner-DAG state.'
      : null,
    includeRegisterSelection
      ? 'Never choose a register outside the available palette. Negative/liminal registers appear only when explicitly included in that palette.'
      : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Available tutor-register palette' : null,
    includeRegisterSelection ? registerPalettePromptRows(state.register.palette) : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior redacted tutor-side learner-DAG model' : null,
    includeRegisterSelection ? learnerDagPromptSummary(state.learnerDag.lastModel) : null,
    includeRegisterSelection ? '' : null,
    includeRegisterSelection ? '# Prior tutor-register choices and observed efficacy' : null,
    includeRegisterSelection ? registerHistoryPromptSummary(state) : null,
    '',
    '# JSON schema',
    '',
    JSON.stringify(schema, null, 2),
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function extractLearnerRecordUpdate({ learnerText, state, tutorTurn }) {
  const prompt = buildLearnerRecordPrompt({ learnerText, state, tutorTurn });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_RECORD_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_record',
    maxTokens: 700,
    trace: state.trace,
    stream: state.stream,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    ...parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

async function extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn }) {
  const prompt = buildCombinedLearnerAnalysisPrompt({ learnerText, state, tutorTurn });
  const raw = await callPromptModel({
    prompt,
    resolved: state.learnerDag.resolved,
    systemPrompt: LEARNER_ANALYSIS_SYSTEM_PROMPT,
    role: 'tutor_stub_learner_analysis',
    maxTokens: Math.max(2500, state.maxTokens || 0),
    trace: state.trace,
    stream: state.stream,
  });
  const { parsed, parseError } = parseClassifierJson(raw.text);
  return {
    parsed,
    parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
  };
}

function classificationFromCombinedAnalysis(raw, state) {
  const parsed = raw?.parsed || {};
  const source =
    parsed.classification ||
    parsed.learner_classification ||
    parsed.classifier ||
    (parsed.turn && parsed.overall ? parsed : null);

  if (!source) {
    return failedClassification({
      message: 'Combined learner analysis did not include a classification object.',
      resolved: state.learnerDag.resolved,
      latencyMs: raw?.latencyMs || 0,
      usage: raw?.usage,
    });
  }

  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function learnerRecordFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  const source = parsed.learner_record || parsed.learnerRecord || parsed.public_record || parsed.record || {};
  return {
    ...source,
    parseError: raw.parseError,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    usage: raw.usage,
    combined: true,
  };
}

function registerSelectionFromCombinedAnalysis(raw) {
  const parsed = raw?.parsed || {};
  return parsed.register_selection || parsed.registerSelection || parsed.tutor_register || parsed.register || null;
}

function dagProgressFeatures(model) {
  const metrics = model?.metrics || {};
  const assessment = model?.assessment || {};
  return {
    bestPathCoverage: Number(assessment.bestPathCoverage || 0),
    groundedCount: Number(metrics.groundedCount || 0),
    voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
    candidateConclusionCount: Number(metrics.candidateConclusionCount || 0),
    answerCandidateCount: Number(metrics.answerCandidateCount || 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
    finalSecretEntailed: assessment.finalSecretEntailed === true,
    assertedSecret: assessment.assertedSecret === true,
    assertedMirror: assessment.assertedMirror === true,
  };
}

function summarizeDagDeltas(delta) {
  const parts = [];
  if (delta.bestPathCoverage) parts.push(`coverage ${delta.bestPathCoverage > 0 ? '+' : ''}${delta.bestPathCoverage}`);
  if (delta.groundedCount) parts.push(`grounded ${delta.groundedCount > 0 ? '+' : ''}${delta.groundedCount}`);
  if (delta.voicedDerivedCount) parts.push(`voiced ${delta.voicedDerivedCount > 0 ? '+' : ''}${delta.voicedDerivedCount}`);
  if (delta.answerCandidateCount) parts.push(`answers ${delta.answerCandidateCount > 0 ? '+' : ''}${delta.answerCandidateCount}`);
  if (delta.missingPremiseCount) parts.push(`missing ${delta.missingPremiseCount > 0 ? '+' : ''}${delta.missingPremiseCount}`);
  if (delta.unsupportedAssertionCount) {
    parts.push(`unsupported ${delta.unsupportedAssertionCount > 0 ? '+' : ''}${delta.unsupportedAssertionCount}`);
  }
  return parts.join(', ') || 'no learner-DAG movement';
}

function registerEfficacyFromDagProgress({ selection, currentModel, accepted }) {
  const before = dagProgressFeatures(selection?.selectedAtDag);
  const after = dagProgressFeatures(currentModel);
  const delta = Object.fromEntries(Object.keys(after).map((key) => [key, Number(after[key]) - Number(before[key])]));
  const progressScore =
    delta.bestPathCoverage * 4 +
    delta.groundedCount +
    delta.voicedDerivedCount * 2 +
    delta.candidateConclusionCount +
    delta.answerCandidateCount * 3 -
    delta.missingPremiseCount -
    Math.max(0, delta.unsupportedAssertionCount);
  const label = progressScore > 0 ? 'positive_progress' : progressScore < 0 ? 'regression_or_overreach' : 'no_clear_progress';
  return {
    schema: 'machinespirits.tutor-stub.register-efficacy.v1',
    evaluatedAtTurn: currentModel?.turn ?? null,
    registerTurn: selection?.turn ?? null,
    selected_register: selection?.selected_register || null,
    label,
    progressScore,
    delta,
    acceptedUpdate: accepted
      ? {
          adopted: accepted.adopt?.length || 0,
          derived: accepted.derive?.length || 0,
          hypothesis: Boolean(accepted.hypothesis),
          assertedAnswer: accepted.assertAnswer || null,
        }
      : null,
    summary: summarizeDagDeltas(delta),
    caveat: 'Heuristic local association only: the next learner turn is compared with the DAG state when the register was selected.',
  };
}

function evaluatePendingRegisterEfficacy(state, currentDagResult) {
  if (!state.register?.enabled || !currentDagResult?.model) return null;
  const pending = [...state.register.history].reverse().find((entry) => !entry.efficacy && entry.turn < currentDagResult.model.turn);
  if (!pending) return null;
  pending.efficacy = registerEfficacyFromDagProgress({
    selection: pending,
    currentModel: currentDagResult.model,
    accepted: currentDagResult.accepted,
  });
  return pending.efficacy;
}

function fallbackRegisterSelection({ state, classification, tutorLearnerDag }) {
  const palette = new Set(state.register?.palette || []);
  const assessment = tutorLearnerDag?.model?.assessment || {};
  const move = classification?.turn?.discourse_move || 'unknown';
  const stance = classification?.turn?.epistemic_stance || 'unknown';
  const evidenceUse = classification?.turn?.evidence_use || 'unknown';
  let selected = 'clarity';

  if (palette.has('witnessing_restraint') && /vulnerable|affective/.test(`${move} ${stance}`)) {
    selected = 'witnessing_restraint';
  } else if (palette.has('charismatic_challenge') && /resistant|overconfident|answer_seeking/.test(`${stance} ${evidenceUse}`)) {
    selected = 'charismatic_challenge';
  } else if (palette.has('scaffolding') && /release_or_pacing_gap|inference_gap/.test(assessment.bottleneck || '')) {
    selected = 'scaffolding';
  } else if (palette.has('accountable_bid_authority') && /challenge|overleaps_evidence/.test(`${move} ${evidenceUse}`)) {
    selected = 'accountable_bid_authority';
  } else if (!palette.has(selected)) {
    selected = [...palette][0] || 'clarity';
  }

  return {
    selected_register: selected,
    learner_signal: move,
    register_reason: 'Fallback register selected after missing or invalid model register output.',
    evidence_span: classification?.turn?.summary || '',
    risk_flags: [],
    expected_dag_move: 'Elicit one public, checkable learner move that can update the learner-DAG record.',
    expected_progress_marker: 'Next learner turn adopts staged evidence, voices a derivable inference, or corrects an overreach.',
    confidence: 0.25,
    warning: 'fallback_register_selection',
  };
}

function normalizeRegisterSelection(rawSelection, { state, classification, tutorLearnerDag, raw }) {
  if (!state.register?.enabled) return null;
  const palette = new Set(state.register.palette || []);
  const normalizedRawSelection =
    typeof rawSelection === 'string' ? { selected_register: rawSelection } : rawSelection || {};
  const requested = String(normalizedRawSelection.selected_register || normalizedRawSelection.register || '').trim();
  const source =
    requested && palette.has(requested)
      ? normalizedRawSelection
      : fallbackRegisterSelection({ state, classification, tutorLearnerDag });
  const selected = String(source.selected_register || source.register || '').trim();
  const definition = getEngagementRegisterDefinition(selected) || {};
  const selection = {
    schema: 'machinespirits.tutor-stub.register-selection.v1',
    turn: tutorLearnerDag?.model?.turn ?? state.turns.length + 1,
    selected_register: selected,
    selected_mode: selected,
    valence: definition.valence || null,
    router_selectable: definition.router_selectable === true,
    simulated_only: definition.simulated_only === true,
    learner_signal: String(source.learner_signal || classification?.turn?.discourse_move || 'unknown'),
    register_reason: String(source.register_reason || source.reason || ''),
    evidence_span: String(source.evidence_span || source.evidence || ''),
    risk_flags: Array.isArray(source.risk_flags) ? source.risk_flags.map(String) : [],
    expected_dag_move: String(source.expected_dag_move || ''),
    expected_progress_marker: String(source.expected_progress_marker || ''),
    confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
    source: 'combined_learner_analysis',
    model: raw ? { provider: raw.provider, model: raw.model, latencyMs: raw.latencyMs, usage: raw.usage } : null,
    selectedAtDag: tutorLearnerDag?.model || null,
    efficacy: null,
  };
  if (!requested || !palette.has(requested)) {
    selection.warning = source.warning || `invalid_register_selection:${requested || 'missing'}`;
  }
  state.register.history.push(selection);
  state.register.current = selection;
  return selection;
}

function validFactArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((part) => typeof part === 'string');
}

function applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText }) {
  const record = state.learnerDag.record;
  const world = state.world;
  const released = new Map(stagedEvidenceRows(world, tutorTurn).map((row) => [row.premise, row]));
  const accepted = { adopt: [], retract: [], derive: [], hypothesis: null, assertAnswer: null };
  const rejected = [];

  for (const premiseId of Array.isArray(update?.retract) ? update.retract : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'retract', value: premiseId, reason: 'not staged' });
      continue;
    }
    record.board.delete(factKey(row.fact));
    accepted.retract.push(premiseId);
  }

  for (const premiseId of Array.isArray(update?.adopt) ? update.adopt : []) {
    const row = released.get(premiseId);
    if (!row?.fact) {
      rejected.push({ type: 'adopt', value: premiseId, reason: 'not staged' });
      continue;
    }
    record.board.set(factKey(row.fact), row.fact);
    accepted.adopt.push(premiseId);
  }

  const groundedFacts = [...record.board.values()];
  const closed = closure(groundedFacts, world.rules);
  for (const fact of Array.isArray(update?.derive) ? update.derive : []) {
    if (!validFactArray(fact)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not a fact array' });
      continue;
    }
    const key = factKey(fact);
    const canonical = closed.facts.get(key);
    if (!canonical || !closed.proofs.get(key)) {
      rejected.push({ type: 'derive', value: fact, reason: 'not derivable from accepted public record' });
      continue;
    }
    if (!record.voicedKeys.has(key)) {
      record.voicedKeys.add(key);
      record.voiced.push({ turn: tutorTurn, fact: canonical });
    }
    accepted.derive.push(canonical);
  }

  if (typeof update?.hypothesis === 'string' && update.hypothesis.trim()) {
    const hypothesis = update.hypothesis.trim();
    record.hypotheses.push({ turn: tutorTurn, text: hypothesis });
    accepted.hypothesis = hypothesis;
  }

  let assertion = null;
  if (typeof update?.assert_answer === 'string' && update.assert_answer.trim()) {
    assertion = factFromQuestionAnswer(world, update.assert_answer);
    accepted.assertAnswer = update.assert_answer.trim();
  } else if (validFactArray(update?.asserts)) {
    assertion = update.asserts;
  }
  if (assertion && !matchPattern(world.questionPattern, assertion)) {
    rejected.push({ type: 'assert', value: assertion, reason: 'does not match public question pattern' });
    assertion = null;
    accepted.assertAnswer = null;
  }

  const ledger = releaseLedgerForTurn(world, tutorTurn);
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    assertion,
    learnerText,
    ledger,
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  const model = buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });

  return {
    model,
    accepted,
    rejected,
    extractor: {
      provider: update?.provider || null,
      model: update?.model || null,
      latencyMs: update?.latencyMs || 0,
      usage: update?.usage || null,
      parseError: update?.parseError || null,
      notes: typeof update?.notes === 'string' ? update.notes : null,
    },
  };
}

function emptyTutorLearnerDagModel(state, tutorTurn) {
  const record = state.learnerDag.record;
  const world = state.world;
  const snapshot = buildLearnerDagSnapshot(world, {
    turn: tutorTurn,
    boardFacts: [...record.board.values()],
    validFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    ledger: releaseLedgerForTurn(world, tutorTurn),
    source: 'tutor_stub_tutor_learner_dag_model',
  });
  record.snapshots.push(snapshot);
  const learnerDag = buildLearnerDag(record.snapshots, world);
  const proxyDagMemory = buildLearnerProxyDagMemory({
    turn: tutorTurn,
    questionPattern: world.questionPattern,
    rules: world.rules,
    groundedFacts: [...record.board.values()],
    voiced: record.voiced,
    hypotheses: record.hypotheses,
    factSurface: (fact) => factSurface(world, fact),
  });
  return buildTutorLearnerDagModel({
    turn: tutorTurn,
    role: 'tutor',
    proxyDagMemory,
    assessment: learnerDag.assessment,
  });
}

async function buildTutorLearnerDagForTurn(learnerText, state) {
  if (!state.learnerDag.enabled || !state.world) return null;
  const tutorTurn = state.turns.length + 1;
  process.stdout.write(`${C.dim}modeling learner DAG...${C.reset}\r`);
  try {
    const update = await extractLearnerRecordUpdate({ learnerText, state, tutorTurn });
    const result = applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText });
    state.learnerDag.lastModel = result.model;
    clearStatusLine();
    printTutorLearnerDagModel(result);
    return result;
  } catch (err) {
    const model = emptyTutorLearnerDagModel(state, tutorTurn);
    const result = {
      model,
      accepted: { adopt: [], retract: [], derive: [], hypothesis: null, assertAnswer: null },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = result.model;
    clearStatusLine();
    printTutorLearnerDagModel(result);
    return result;
  }
}

async function analyzeLearnerTurnCombined(learnerText, state) {
  const tutorTurn = state.turns.length + 1;
  const startedAt = Date.now();
  process.stdout.write(`${C.dim}analyzing learner...${C.reset}\r`);

  try {
    const raw = await extractCombinedLearnerAnalysis({ learnerText, state, tutorTurn });
    const classification = classificationFromCombinedAnalysis(raw, state);
    const update = learnerRecordFromCombinedAnalysis(raw);
    const tutorLearnerDag = applyLearnerRecordUpdate({ update, state, tutorTurn, learnerText });
    state.learnerDag.lastModel = tutorLearnerDag.model;
    const previousRegisterEfficacy = evaluatePendingRegisterEfficacy(state, tutorLearnerDag);
    const registerSelection = normalizeRegisterSelection(registerSelectionFromCombinedAnalysis(raw), {
      state,
      classification,
      tutorLearnerDag,
      raw,
    });
    clearStatusLine();
    printClassification(classification);
    printTutorLearnerDagModel(tutorLearnerDag);
    printRegisterSelection(registerSelection, previousRegisterEfficacy);
    return { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy };
  } catch (err) {
    const classification = failedClassification({
      message: err.message,
      resolved: state.learnerDag.resolved,
      latencyMs: Date.now() - startedAt,
    });
    const model = emptyTutorLearnerDagModel(state, tutorTurn);
    const tutorLearnerDag = {
      model,
      accepted: { adopt: [], retract: [], derive: [], hypothesis: null, assertAnswer: null },
      rejected: [],
      extractor: {
        error: err.message,
        provider: state.learnerDag.resolved.provider,
        model: state.learnerDag.resolved.model,
      },
    };
    state.learnerDag.lastModel = tutorLearnerDag.model;
    clearStatusLine();
    printClassification(classification);
    printTutorLearnerDagModel(tutorLearnerDag);
    return { classification, tutorLearnerDag, registerSelection: null, previousRegisterEfficacy: null };
  }
}

async function analyzeLearnerTurn(learnerText, state) {
  if (state.classifier.enabled && state.learnerDag.enabled && state.world) {
    return await analyzeLearnerTurnCombined(learnerText, state);
  }

  const classification = await classifyForTurn(learnerText, state);
  const tutorLearnerDag = await buildTutorLearnerDagForTurn(learnerText, state);
  return { classification, tutorLearnerDag, registerSelection: null, previousRegisterEfficacy: null };
}

function printTutorLearnerDagModel(result) {
  if (!result?.model) return;
  const model = result.model;
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const buckets = Object.entries(assessment.missingPremiseBuckets || {})
    .map(([bucket, count]) => `${bucket}:${count}`)
    .join(', ');
  const warning = result.extractor?.error || result.extractor?.parseError;
  console.log(
    `${C.cyan}tutor learner-DAG model >${C.reset} coverage ${assessment.bestPathCoverage ?? 'n/a'}; bottleneck ${
      assessment.bottleneck || 'unknown'
    }`,
  );
  console.log(
    `${C.dim}  grounded ${metrics.groundedCount || 0}, voiced ${metrics.voicedDerivedCount || 0}, hypotheses ${
      metrics.hypothesisCount || 0
    }, answer candidates ${metrics.answerCandidateCount || 0}${buckets ? `; missing ${buckets}` : ''}${C.reset}`,
  );
  if (result.accepted?.adopt?.length || result.accepted?.derive?.length || result.accepted?.hypothesis) {
    console.log(
      `${C.dim}  update: adopted ${result.accepted.adopt.length}, derived ${result.accepted.derive.length}${
        result.accepted.hypothesis ? ', hypothesis noted' : ''
      }${C.reset}`,
    );
  }
  if (warning) console.log(`${C.red} learner-DAG model warning${C.reset}${C.dim}: ${warning}${C.reset}`);
}

function printRegisterSelection(selection, previousEfficacy = null) {
  if (previousEfficacy) {
    console.log(
      `${C.cyan}register efficacy >${C.reset} ${previousEfficacy.selected_register} ${previousEfficacy.label} (${previousEfficacy.summary})`,
    );
  }
  if (!selection) return;
  const warning = selection.warning ? ` ${C.red}${selection.warning}${C.reset}` : '';
  const confidence = selection.confidence !== null ? `; confidence ${selection.confidence}` : '';
  console.log(`${C.cyan}tutor register >${C.reset} ${selection.selected_register}${confidence}${warning}`);
  if (selection.register_reason) console.log(`${C.dim}  reason: ${selection.register_reason}${C.reset}`);
  if (selection.expected_dag_move) console.log(`${C.dim}  expected DAG move: ${selection.expected_dag_move}${C.reset}`);
}

function registerSelectionContext(selection) {
  if (!selection) return '';
  const definition = getEngagementRegisterDefinition(selection.selected_register) || {};
  const stanceContract = String(definition.stance_contract || '').trim();
  const guardrails = [
    ...(Array.isArray(definition.forbidden_phrases) && definition.forbidden_phrases.length
      ? [`Forbidden phrase families: ${definition.forbidden_phrases.join(', ')}`]
      : []),
    definition.recognition_guardrail ? `Recognition guardrail: ${definition.recognition_guardrail}` : null,
    selection.simulated_only ? 'This is a simulated-only register; do not use it unless the operator explicitly enabled it.' : null,
  ].filter(Boolean);
  return [
    '[Tutor-only selected register]',
    `Selected tutor register: ${selection.selected_register}`,
    `Valence: ${selection.valence || 'unknown'}`,
    `Learner signal: ${selection.learner_signal || 'unknown'}`,
    `Reason: ${selection.register_reason || 'No reason supplied.'}`,
    `Expected learner-DAG move: ${selection.expected_dag_move || 'No expected move supplied.'}`,
    stanceContract ? 'Stance contract:' : null,
    stanceContract || null,
    guardrails.length ? 'Guardrails:' : null,
    ...guardrails,
    'Write the next tutor message in this register without naming the register, the classifier, or the learner-DAG machinery.',
    '[End tutor-only selected register]',
  ]
    .filter(Boolean)
    .join('\n');
}

function tutorLearnerDagModelContext(result) {
  const model = result?.model || result;
  if (!model) return '';
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const record = model.learnerRecord || {};
  const grounded = (record.grounded || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  const hypotheses = (record.hypotheses || []).map((row) => `- ${row.text}`).join('\n') || '- none';
  const candidates = (record.answerCandidates || []).map((row) => `- ${row.surface}`).join('\n') || '- none';
  return [
    '[Tutor-only redacted learner-DAG model]',
    `Best-path coverage: ${assessment.bestPathCoverage ?? 'unavailable'}`,
    `Bottleneck: ${assessment.bottleneck || 'unavailable'}`,
    `Counts: grounded=${metrics.groundedCount || 0}, voiced=${metrics.voicedDerivedCount || 0}, hypotheses=${
      metrics.hypothesisCount || 0
    }, answerCandidates=${metrics.answerCandidateCount || 0}, missing=${metrics.missingPremiseCount || 0}`,
    'Grounded public record:',
    grounded,
    'Learner hypotheses:',
    hypotheses,
    'Answer candidates derivable from the tutor model of the learner record:',
    candidates,
    'Use this as advisory context only. Do not mention DAGs, coverage, missing counts, hidden paths, or internal state.',
    '[End tutor-only redacted learner-DAG model]',
  ].join('\n');
}

function createLearnerDagState({ enabled, resolved, world }) {
  const board = new Map();
  if (world) {
    for (const fact of world.background || []) board.set(factKey(fact), fact);
  }
  return {
    enabled,
    resolved,
    record: {
      board,
      voiced: [],
      voicedKeys: new Set(),
      hypotheses: [],
      snapshots: [],
    },
  };
}

function trimHistory(messages, turns) {
  return messages.slice(-(turns * 2));
}

function classifierTutorContext(classification) {
  if (!classification) return '';
  return [
    '[Tutor-only learner classifier]',
    `This turn: ${classification.turn?.summary || 'No turn summary.'}`,
    `Overall: ${classification.overall?.summary || 'No overall summary.'}`,
    `Discourse move: ${classification.turn?.discourse_move || 'unknown'}`,
    `Evidence use: ${classification.turn?.evidence_use || 'unknown'}`,
    `Epistemic stance: ${classification.turn?.epistemic_stance || 'unknown'}`,
    `Immediate pedagogical need: ${
      classification.turn?.pedagogical_need || classification.overall?.next_best_tutor_move || 'unknown'
    }`,
    'Use this as advisory context. Do not mention classifier labels, scores, rubrics, or hidden analysis to the learner.',
    '[End tutor-only learner classifier]',
  ].join('\n');
}

function dagNodeFact(node) {
  const content = node?.statement?.content || {};
  if (content.rel === 'holds_L') return content.fact;
  if (content.rel === 'grounded_L') return content.of;
  return node?.fact || null;
}

function dagNodeLabel(node) {
  if (!node) return 'unknown';
  const fact = dagNodeFact(node);
  const renderedFact = fact ? factText(fact) : node.id;
  if (node.leaf) return `hold:${node.premiseId || renderedFact}`;
  return `ground:${renderedFact}`;
}

function buildTutorDagSnapshot(state, tutorTurn) {
  if (!state.dag || !state.world || !state.tutorDag) return null;
  const world = state.world;
  const dag = state.tutorDag;
  const nodesById = new Map((dag.nodes || []).map((node) => [node.id, node]));
  const releaseByPremise = new Map(world.releaseSchedule.map((entry) => [entry.premise, entry]));
  const releasedPremises = new Set(
    world.releaseSchedule.filter((entry) => entry.turn <= tutorTurn).map((entry) => entry.premise),
  );
  const leaves = (dag.leaves || []).map((premiseId) => {
    const premise = world.premiseById.get(premiseId);
    const release = releaseByPremise.get(premiseId);
    return {
      premise: premiseId,
      fact: premise ? factText(premise.fact) : premiseId,
      released: releasedPremises.has(premiseId),
      scheduledTurn: release?.turn ?? null,
      via: release?.via || null,
    };
  });
  const nextRelease = world.releaseSchedule.find((entry) => entry.turn > tutorTurn) || null;
  const nodes = (dag.nodes || []).map((node) => ({
    id: node.id,
    label: dagNodeLabel(node),
    origin: node.origin,
    rule: node.rule || null,
    leaf: Boolean(node.leaf),
    premise: node.premiseId || null,
    fact: dagNodeFact(node) ? factText(dagNodeFact(node)) : null,
  }));
  const edges = (dag.edges || []).map((edge) => ({
    from: edge.from,
    to: edge.to,
    fromLabel: dagNodeLabel(nodesById.get(edge.from)),
    toLabel: dagNodeLabel(nodesById.get(edge.to)),
    rule: edge.rule || null,
  }));

  return {
    schema: dag.schema,
    turn: tutorTurn,
    derivable: Boolean(dag.derivable),
    root: dag.root,
    rootLabel: dagNodeLabel(nodesById.get(dag.root)),
    leavesReleased: leaves.filter((leaf) => leaf.released).length,
    leavesTotal: leaves.length,
    nextRelease: nextRelease
      ? {
          premise: nextRelease.premise,
          turn: nextRelease.turn,
          via: nextRelease.via,
        }
      : null,
    leaves,
    nodes,
    edges,
  };
}

function printTutorDagSnapshot(snapshot) {
  if (!snapshot) return;
  console.log(
    `${C.cyan}tutor DAG >${C.reset} turn ${snapshot.turn}: ${snapshot.leavesReleased}/${snapshot.leavesTotal} proof leaves released`,
  );
  if (!snapshot.derivable) {
    console.log(`${C.dim}  not derivable from this world's authored proof data${C.reset}\n`);
    return;
  }
  console.log(`${C.dim}  root: ${snapshot.rootLabel}${C.reset}`);
  if (snapshot.nextRelease) {
    console.log(
      `${C.dim}  next release: ${snapshot.nextRelease.premise} at turn ${snapshot.nextRelease.turn} via ${snapshot.nextRelease.via}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}  next release: none${C.reset}`);
  }

  console.log(`${C.dim}  edges:${C.reset}`);
  for (const edge of snapshot.edges) {
    console.log(`${C.dim}    ${edge.fromLabel} -> ${edge.toLabel}${edge.rule ? ` (${edge.rule})` : ''}${C.reset}`);
  }

  console.log(`${C.dim}  leaves:${C.reset}`);
  for (const leaf of snapshot.leaves) {
    const status = leaf.released ? 'x' : ' ';
    const schedule = leaf.scheduledTurn ? `t${leaf.scheduledTurn}/${leaf.via}` : 'unscheduled';
    console.log(`${C.dim}    [${status}] ${leaf.premise} ${schedule}: ${leaf.fact}${C.reset}`);
  }
  console.log();
}

function oneLine(value, { max = 220 } = {}) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function compactFactRow(row) {
  if (!row) return '';
  if (typeof row === 'string') return row;
  if (row.surface) return row.surface;
  if (row.text) return row.text;
  if (row.fact) return factText(row.fact);
  if (row.premise) return row.premise;
  return JSON.stringify(row);
}

function printAnalysisLine(label, value, { max = 220 } = {}) {
  const text = oneLine(value, { max });
  if (!text) return;
  console.log(`${C.dim}  ${label}: ${text}${C.reset}`);
}

function printAnalysisList(label, rows, { limit = 5 } = {}) {
  const visible = Array.isArray(rows) ? rows.map(compactFactRow).filter(Boolean).slice(-limit) : [];
  if (!visible.length) return;
  console.log(`${C.dim}  ${label}:${C.reset}`);
  for (const row of visible) {
    console.log(`${C.dim}    - ${oneLine(row)}${C.reset}`);
  }
}

function printInteractiveHelp() {
  console.log(`${C.cyan}slash commands >${C.reset} /analysis, /a, /clear, /help, /quit\n`);
}

function printCurrentTurnAnalysis(state) {
  const turn = state.turns[state.turns.length - 1] || null;
  if (!turn) {
    console.log(`${C.cyan}analysis >${C.reset} no completed turns yet`);
    console.log(`${C.dim}  enter a learner turn first, then use /analysis to inspect the stored classifier, learner-DAG, register, and tutor-DAG data${C.reset}\n`);
    return;
  }

  const classification = turn.classification || null;
  const turnAnalysis = classification?.turn || {};
  const overall = classification?.overall || {};
  const conceptual = scoreValue(turnAnalysis.scores?.conceptual_engagement);
  const readiness = scoreValue(turnAnalysis.scores?.epistemic_readiness);
  const learnerDagModel = turn.tutorLearnerDagModel || null;
  const metrics = learnerDagModel?.metrics || {};
  const assessment = learnerDagModel?.assessment || {};
  const learnerRecord = learnerDagModel?.learnerRecord || {};
  const update = turn.tutorLearnerDagUpdate || null;
  const accepted = update?.accepted || {};
  const rejected = update?.rejected || [];
  const extractor = update?.extractor || {};
  const registerSelection = turn.registerSelection || null;
  const selectedEfficacy = registerSelection?.efficacy || null;
  const previousEfficacy = turn.previousRegisterEfficacy || null;
  const tracePath = traceDisplayPath(state.trace);

  console.log(`${C.cyan}analysis >${C.reset} current completed turn ${turn.turn}`);
  printAnalysisLine('learner', turn.learner);

  if (classification) {
    printAnalysisLine('did this turn', turnAnalysis.summary || 'No turn summary.');
    printAnalysisLine('did overall', overall.summary || 'No overall summary.');
    printAnalysisLine(
      'rubric',
      `move=${turnAnalysis.discourse_move || 'unknown'}; stance=${turnAnalysis.epistemic_stance || 'unknown'}; evidence=${
        turnAnalysis.evidence_use || 'unknown'
      }; agency=${turnAnalysis.agency || 'unknown'}; conceptual=${conceptual}/5; readiness=${readiness}/5`,
    );
    printAnalysisLine('trajectory', overall.trajectory);
    printAnalysisLine('current state', overall.current_state);
    printAnalysisLine('next tutor move', overall.next_best_tutor_move || turnAnalysis.pedagogical_need);
    if (classification.error || classification.parseError) {
      printAnalysisLine('classifier warning', classification.error || classification.parseError);
    }
  } else {
    printAnalysisLine('classifier', state.classifier?.enabled ? 'no classifier output stored for this turn' : 'off');
  }

  if (learnerDagModel) {
    printAnalysisLine(
      'learner-DAG',
      `coverage=${assessment.bestPathCoverage ?? 'n/a'}; bottleneck=${assessment.bottleneck || 'unknown'}; grounded=${
        metrics.groundedCount || 0
      }; voiced=${metrics.voicedDerivedCount || 0}; hypotheses=${metrics.hypothesisCount || 0}; missing=${
        metrics.missingPremiseCount || 0
      }`,
    );
    if (update) {
      printAnalysisLine(
        'learner-record update',
        `adopted=${accepted.adopt?.length || 0}; derived=${accepted.derive?.length || 0}; retracted=${
          accepted.retract?.length || 0
        }; hypothesis=${accepted.hypothesis ? 'yes' : 'no'}; assertedAnswer=${accepted.assertAnswer || 'none'}`,
      );
      if (rejected.length) printAnalysisLine('learner-record rejected', `${rejected.length} extractor item(s) rejected`);
      if (extractor.error || extractor.parseError) printAnalysisLine('learner-record warning', extractor.error || extractor.parseError);
    }
    printAnalysisList('grounded public record', learnerRecord.grounded);
    printAnalysisList('learner hypotheses', learnerRecord.hypotheses);
    printAnalysisList('answer candidates', learnerRecord.answerCandidates);
  } else {
    printAnalysisLine('learner-DAG', state.learnerDag?.enabled ? 'no learner-DAG model stored for this turn' : 'off');
  }

  if (registerSelection) {
    const confidence =
      registerSelection.confidence === null || registerSelection.confidence === undefined
        ? ''
        : `; confidence=${registerSelection.confidence}`;
    printAnalysisLine(
      'selected register',
      `${registerSelection.selected_register}${confidence}`,
    );
    printAnalysisLine('register reason', registerSelection.register_reason);
    printAnalysisLine('expected DAG move', registerSelection.expected_dag_move);
    printAnalysisLine('expected progress marker', registerSelection.expected_progress_marker);
    if (selectedEfficacy) {
      printAnalysisLine(
        'selected register efficacy',
        `${selectedEfficacy.label}; score=${selectedEfficacy.progressScore}; ${selectedEfficacy.summary}`,
      );
    } else {
      printAnalysisLine('selected register efficacy', 'pending the next learner turn');
    }
  } else {
    printAnalysisLine('selected register', state.register?.enabled ? 'none stored for this turn' : 'off');
  }
  if (previousEfficacy) {
    printAnalysisLine(
      'previous register efficacy',
      `${previousEfficacy.selected_register}: ${previousEfficacy.label}; score=${previousEfficacy.progressScore}; ${previousEfficacy.summary}`,
    );
  }

  if (turn.tutorLeakAudit) {
    const leaks = turn.tutorLeakAudit.leaks || [];
    printAnalysisLine('leak guard', turn.tutorLeakAudit.ok ? 'ok' : `${leaks.length} leak(s) found after repair/audit`);
    for (const leak of leaks.slice(0, 3)) {
      printAnalysisLine(`leak ${leak.type || 'unknown'}`, leak.reason);
    }
  }

  if (turn.tutorDag) {
    printTutorDagSnapshot(turn.tutorDag);
  } else {
    printAnalysisLine('tutor DAG', state.dag ? 'no snapshot stored for this turn' : 'off');
  }

  printAnalysisLine('trace', tracePath);
  console.log();
}

function dagTurnContext(world, tutorTurn) {
  if (!world) return '';
  const released = world.releaseSchedule.filter((entry) => entry.turn <= tutorTurn);
  const next = world.releaseSchedule.find((entry) => entry.turn > tutorTurn);
  const releasedLines = released.length
    ? released
        .map((entry) => {
          const premise = world.premiseById.get(entry.premise);
          return `- ${entry.premise} (${entry.via}, scheduled turn ${entry.turn}): ${String(premise?.surface || '').trim()}`;
        })
        .join('\n')
    : '- none yet';
  return [
    '[Tutor-only DAG turn context]',
    `Current tutor turn in this lightweight stub: ${tutorTurn}`,
    'Evidence scheduled at or before this turn:',
    releasedLines,
    next ? `Next scheduled evidence: ${next.premise} at turn ${next.turn} via ${next.via}` : 'Next scheduled evidence: none',
    'Use this as pacing guidance; never state the concealed answer by authority.',
    '[End tutor-only DAG turn context]',
  ].join('\n');
}

async function callTutor({
  learnerText,
  history,
  systemPrompt,
  resolved,
  temperature,
  maxTokens,
  historyTurns,
  world,
  dag,
  classification,
  tutorLearnerDagModel,
  registerSelection,
  trace = null,
  stream = null,
}) {
  const context = trimHistory(history, historyTurns);
  const tutorTurn = Math.floor(history.length / 2) + 1;
  const advisory = classifierTutorContext(classification);
  const learnerDagAdvisory = tutorLearnerDagModelContext(tutorLearnerDagModel);
  const registerAdvisory = registerSelectionContext(registerSelection);
  const learnerPrompt = `Learner says:\n${learnerText}`;
  const promptParts = [
    dag && world ? dagTurnContext(world, tutorTurn) : null,
    advisory,
    learnerDagAdvisory,
    registerAdvisory,
    learnerPrompt,
  ].filter(Boolean);
  const userPrompt = promptParts.join('\n\n');
  const leakGuardEnabled = Boolean(dag && world);
  const canStreamTutor = Boolean(stream?.enabled && providerSupportsStreaming(resolved));
  const tutorStreamMode = canStreamTutor ? (leakGuardEnabled ? 'buffered' : 'live') : 'none';

  async function invokeTutorAttempt({ attemptUserPrompt, role, streamMode = 'none', repairAttempt = 0 }) {
    const startedAt = new Date().toISOString();
    const request = {
      systemPrompt,
      messages: [...context, { role: 'user', content: attemptUserPrompt }],
      config: { temperature, maxTokens, historyTurns, leakGuard: leakGuardEnabled, repairAttempt },
    };
    const useStreamingApi = streamMode === 'live' || streamMode === 'buffered';
    let response;
    if (isCliProvider(resolved.provider)) {
      const result = await callAIWithCliBridge(
        { provider: resolved.provider, model: resolved.model },
        systemPrompt,
        attemptUserPrompt,
        role,
        { messageHistory: context },
      );
      response = {
        text: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: {
          inputTokens: result.inputTokens || 0,
          outputTokens: result.outputTokens || 0,
          totalTokens: (result.inputTokens || 0) + (result.outputTokens || 0),
          cost: result.cost || 0,
        },
      };
    } else if (useStreamingApi) {
      const sink = streamMode === 'live' ? createConsoleTokenSink(role) : null;
      let final = null;
      for await (const chunk of streamAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      })) {
        if (chunk.type === 'text_delta') {
          if (sink) sink.write(chunk.content);
        } else if (chunk.type === 'done') {
          final = chunk;
        }
      }
      const streamed = sink ? sink.finish() : false;
      response = {
        text: final?.content || '',
        provider: final?.provider || resolved.provider,
        model: final?.model || resolved.model,
        latencyMs: final?.latencyMs || 0,
        usage: final?.usage || null,
        streamed,
        generatedWithStreaming: true,
        bufferedStream: streamMode === 'buffered',
      };
    } else {
      const result = await callAI({
        provider: resolved.provider,
        model: resolved.model,
        systemPrompt,
        messages: request.messages,
        preset: 'socratic',
        config: { temperature, maxTokens },
      });
      response = {
        text: result.content,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        usage: result.usage,
      };
    }

    appendTraceEvent(trace, {
      type: 'model_call',
      role,
      startedAt,
      provider: response.provider,
      model: response.model,
      request,
      response: {
        text: response.text,
        latencyMs: response.latencyMs,
        usage: response.usage,
        streamed: Boolean(response.streamed),
      },
    });
    return response;
  }

  try {
    let response = await invokeTutorAttempt({
      attemptUserPrompt: userPrompt,
      role: 'tutor_stub_tutor',
      streamMode: tutorStreamMode,
      repairAttempt: 0,
    });

    if (!leakGuardEnabled) return response;

    let audit = auditTutorResponseLeak({ text: response.text, world, tutorTurn, learnerText });
    appendTraceEvent(trace, {
      type: 'tutor_response_audit',
      turn: tutorTurn,
      attempt: 0,
      ok: audit.ok,
      leaks: audit.leaks,
    });
    if (audit.ok) {
      response.leakAudit = audit;
      if (response.bufferedStream) {
        response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text);
        response.guardedStreamReplay = true;
      }
      return response;
    }

    response = await invokeTutorAttempt({
      attemptUserPrompt: tutorLeakRepairPrompt({ originalUserPrompt: userPrompt, unsafeDraft: response.text, audit }),
      role: 'tutor_stub_tutor_repair',
      streamMode: canStreamTutor ? 'buffered' : 'none',
      repairAttempt: 1,
    });
    audit = auditTutorResponseLeak({ text: response.text, world, tutorTurn, learnerText });
    appendTraceEvent(trace, {
      type: 'tutor_response_audit',
      turn: tutorTurn,
      attempt: 1,
      ok: audit.ok,
      leaks: audit.leaks,
    });
    if (audit.ok) {
      response.leakAudit = audit;
      response.repaired = true;
      if (response.bufferedStream) {
        response.streamed = replayTextAsConsoleStream('tutor_stub_tutor', response.text);
        response.guardedStreamReplay = true;
      }
      return response;
    }

    const fallbackText = deterministicLeakFallback({ learnerText, audit });
    const fallback = {
      text: fallbackText,
      provider: resolved.provider,
      model: resolved.model,
      latencyMs: response.latencyMs || 0,
      usage: response.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0 },
      leakAudit: audit,
      repaired: true,
      deterministicFallback: true,
    };
    if (canStreamTutor) {
      fallback.streamed = replayTextAsConsoleStream('tutor_stub_tutor', fallback.text);
      fallback.guardedStreamReplay = true;
    }
    appendTraceEvent(trace, {
      type: 'tutor_response_fallback',
      turn: tutorTurn,
      leaks: audit.leaks,
      text: fallbackText,
    });
    return fallback;
  } catch (err) {
    appendTraceEvent(trace, {
      type: 'model_call_error',
      role: 'tutor_stub_tutor',
      provider: resolved.provider,
      model: resolved.model,
      error: err.message,
    });
    throw err;
  }
}

function saveTranscript(filePath, transcript) {
  fs.writeFileSync(filePath, `${JSON.stringify(transcript, null, 2)}\n`);
}

async function runOneTurn(
  inputText,
  state,
  classification = null,
  tutorLearnerDag = null,
  registerSelection = null,
  previousRegisterEfficacy = null,
) {
  const learnerText = inputText.trim();
  if (!learnerText) return null;
  const tutorTurn = state.turns.length + 1;

  const response = await callTutor({
    learnerText,
    history: state.history,
    systemPrompt: state.systemPrompt,
    resolved: state.resolved,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    historyTurns: state.historyTurns,
    world: state.world,
    dag: state.dag,
    classification,
    tutorLearnerDagModel: tutorLearnerDag,
    registerSelection,
    trace: state.trace,
    stream: state.stream,
  });
  const dagSnapshot = buildTutorDagSnapshot(state, tutorTurn);

  state.history.push({ role: 'user', content: learnerText });
  state.history.push({ role: 'assistant', content: response.text });
  const turnRecord = {
    turn: tutorTurn,
    learner: learnerText,
    classification,
    tutorLearnerDagModel: tutorLearnerDag?.model || null,
    tutorLearnerDagUpdate: tutorLearnerDag
      ? {
          accepted: tutorLearnerDag.accepted || null,
          rejected: tutorLearnerDag.rejected || [],
          extractor: tutorLearnerDag.extractor || null,
        }
      : null,
    registerSelection,
    previousRegisterEfficacy,
    tutor: response.text,
    tutorDag: dagSnapshot,
    tutorLeakAudit: response.leakAudit || null,
    tutorResponseRepaired: Boolean(response.repaired),
    tutorDeterministicFallback: Boolean(response.deterministicFallback),
    provider: response.provider,
    model: response.model,
    latencyMs: response.latencyMs,
    usage: response.usage,
  };
  state.turns.push(turnRecord);
  appendTraceEvent(state.trace, {
    type: 'turn_complete',
    turn: tutorTurn,
    turnRecord,
  });
  return { ...response, dagSnapshot };
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-worlds']) {
    printWorlds();
    return;
  }

  const temperature = parseNumber(args.temperature, '--temperature', { min: 0, max: 2 });
  const maxTokens = parsePositiveInt(args['max-tokens'], '--max-tokens');
  const historyTurns = parsePositiveInt(args['history-turns'], '--history-turns');
  const worldBundle = resolveWorldRef(args.world);
  const directorContext = buildDirectorInitialContext(worldBundle?.world || null);
  const effectiveTopic = worldBundle && args.topic === STUB.topic ? worldBundle.world.title : args.topic;
  const systemPrompt = loadSystemPrompt({ worldBundle, dag: args.dag, topic: effectiveTopic });
  const tutorDag = args.dag && worldBundle ? buildTutorDesireDag(worldBundle.world) : null;
  const resolved = resolveModel(args.model);
  const providerConfig = getProviderConfig(resolved.provider);
  const classifierEnabled = !args['no-classifier'];
  const tutorLearnerDagEnabled = Boolean(args['tutor-learner-dag'] && worldBundle);
  const combinedLearnerAnalysisEnabled = Boolean(classifierEnabled && tutorLearnerDagEnabled);
  const registerPalette = buildRegisterPalette(args['safe-registers'] ? 'safe' : args['register-palette']);
  const registerSelectionEnabled = Boolean(!args['no-register-selection'] && combinedLearnerAnalysisEnabled);
  const classifierResolved = classifierEnabled && !combinedLearnerAnalysisEnabled ? resolveModel(args['classifier-model']) : null;
  const classifierProviderConfig = classifierResolved ? getProviderConfig(classifierResolved.provider) : null;
  const learnerRecordResolved = tutorLearnerDagEnabled ? resolveModel(args['learner-record-model']) : null;
  const learnerRecordProviderConfig = learnerRecordResolved ? getProviderConfig(learnerRecordResolved.provider) : null;
  const firstMessage = args.once || positionals.join(' ').trim() || '';
  const visibleModel = visibleResolvedModel(resolved, providerConfig);
  const visibleClassifierModel = classifierResolved ? visibleResolvedModel(classifierResolved, classifierProviderConfig) : null;
  const visibleLearnerRecordModel = learnerRecordResolved
    ? visibleResolvedModel(learnerRecordResolved, learnerRecordProviderConfig)
    : null;
  const visibleClassifierConfig = classifierEnabled
    ? combinedLearnerAnalysisEnabled
      ? {
          combined: true,
          classifierModelRef: args['classifier-model'],
          modelRef: args['learner-record-model'],
          resolved: visibleLearnerRecordModel,
        }
      : {
          modelRef: args['classifier-model'],
          resolved: visibleClassifierModel,
        }
    : { enabled: false };
  const effectiveTemperature = effectiveTemperatureForModel(resolved, temperature);
  const traceEnabled = !args['no-trace'];
  const traceDir = resolveWorkspacePath(args['trace-dir']);
  const streamEnabled = Boolean(STUB.stream && !args['no-stream']);
  const tutorStreamState = !streamEnabled
    ? 'off'
    : !providerSupportsStreaming(resolved)
      ? 'unavailable_cli_buffered'
      : args.dag && worldBundle
        ? 'guarded_after_audit'
        : 'live';
  const resumeCandidate = args['resume-last'] ? latestDialogueTrace(args['trace-dir']) : null;

  if (args['show-prompt']) {
    console.log(`${C.dim}--- system prompt ---${C.reset}`);
    console.log(systemPrompt);
    console.log(`${C.dim}--- end system prompt ---${C.reset}\n`);
  }

  if (args['dry-run']) {
    console.log(
      JSON.stringify(
        {
          modelRef: args.model,
          resolved: visibleModel,
          topic: effectiveTopic,
          world: worldBundle
            ? {
                id: worldBundle.world.id,
                title: worldBundle.world.title,
                file: path.relative(ROOT, worldBundle.filePath),
                dag: args.dag,
              }
            : null,
          directorContext,
          temperature: effectiveTemperature,
          requestedTemperature: temperature,
          classifier: visibleClassifierConfig,
          tutorLearnerDag: tutorLearnerDagEnabled
            ? {
                modelRef: args['learner-record-model'],
                resolved: visibleLearnerRecordModel,
                combinedClassifier: combinedLearnerAnalysisEnabled,
              }
            : { enabled: false, requested: Boolean(args['tutor-learner-dag']) },
          registerSelection: registerSelectionEnabled
            ? {
                enabled: true,
                palette: registerPalette,
                combinedLearnerAnalysis: true,
              }
            : { enabled: false },
          maxTokens,
          historyTurns,
          trace: traceEnabled
            ? {
                enabled: true,
                dir: path.relative(ROOT, traceDir),
              }
            : { enabled: false },
          stream: {
            enabled: streamEnabled,
            tutor: tutorStreamState,
            tutorLive: tutorStreamState === 'live',
            tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
            classifier: streamEnabled && classifierResolved ? providerSupportsStreaming(classifierResolved) : false,
            learnerAnalysis: streamEnabled && learnerRecordResolved ? providerSupportsStreaming(learnerRecordResolved) : false,
          },
          resumeLast: args['resume-last']
            ? resumeCandidate
              ? {
                  source: path.relative(ROOT, resumeCandidate.filePath),
                  turns: resumeCandidate.turns.length,
                  world: resumeCandidate.metadata?.world || null,
                }
              : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
            : { requested: false },
          systemPrompt,
          firstMessage: firstMessage || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!resolved.isConfigured && !isCliProvider(resolved.provider)) {
    const envName = providerConfig.api_key_env || 'provider API key';
    throw new Error(`${args.model} is not configured. Set ${envName} or choose a CLI-backed model.`);
  }
  if (
    classifierEnabled &&
    !combinedLearnerAnalysisEnabled &&
    !classifierResolved.isConfigured &&
    !isCliProvider(classifierResolved.provider)
  ) {
    const envName = classifierProviderConfig.api_key_env || 'provider API key';
    throw new Error(`${args['classifier-model']} is not configured. Set ${envName} or choose a CLI-backed classifier.`);
  }
  if (tutorLearnerDagEnabled && !learnerRecordResolved.isConfigured && !isCliProvider(learnerRecordResolved.provider)) {
    const envName = learnerRecordProviderConfig.api_key_env || 'provider API key';
    throw new Error(
      `${args['learner-record-model']} is not configured. Set ${envName} or choose a CLI-backed learner-record model.`,
    );
  }

  const trace = createTraceState({
    enabled: traceEnabled,
    traceDir: args['trace-dir'],
    metadata: {
      modelRef: args.model,
      resolved: visibleModel,
      classifier: visibleClassifierConfig,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      registerSelection: registerSelectionEnabled ? { enabled: true, palette: registerPalette } : { enabled: false },
      stream: {
        enabled: streamEnabled,
        tutor: tutorStreamState,
        tutorLive: tutorStreamState === 'live',
        tutorGuardedAfterAudit: tutorStreamState === 'guarded_after_audit',
        classifier: streamEnabled && classifierResolved ? providerSupportsStreaming(classifierResolved) : false,
        learnerAnalysis: streamEnabled && learnerRecordResolved ? providerSupportsStreaming(learnerRecordResolved) : false,
      },
      resumeLast: args['resume-last']
        ? resumeCandidate
          ? {
              source: path.relative(ROOT, resumeCandidate.filePath),
              turns: resumeCandidate.turns.length,
              world: resumeCandidate.metadata?.world || null,
            }
          : { requested: true, found: false, traceDir: path.relative(ROOT, traceDir) }
        : { requested: false },
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      firstMessage: firstMessage || null,
    },
  });

  const state = {
    topic: effectiveTopic,
    systemPrompt,
    resolved,
    temperature: effectiveTemperature,
    maxTokens,
    historyTurns,
    world: worldBundle?.world || null,
    directorContext,
    dag: args.dag,
    tutorDag,
    classifier: {
      enabled: classifierEnabled,
      resolved: classifierResolved,
      combined: combinedLearnerAnalysisEnabled,
    },
    learnerDag: createLearnerDagState({
      enabled: tutorLearnerDagEnabled,
      resolved: learnerRecordResolved,
      world: worldBundle?.world || null,
    }),
    register: {
      enabled: registerSelectionEnabled,
      palette: registerPalette,
      current: null,
      history: [],
    },
    trace,
    stream: {
      enabled: streamEnabled,
    },
    history: [],
    turns: [],
  };

  const resumedDialogue = args['resume-last']
    ? restoreDialogueFromTrace(state, resumeCandidate, { currentWorld: worldBundle?.world || null })
    : null;
  if (resumedDialogue) {
    appendTraceEvent(state.trace, {
      type: 'resume_loaded',
      source: path.relative(ROOT, resumedDialogue.source),
      turns: resumedDialogue.turns,
      register: resumedDialogue.register,
      learnerDag: resumedDialogue.learnerDag,
      warnings: resumedDialogue.warnings,
    });
  } else if (args['resume-last']) {
    appendTraceEvent(state.trace, {
      type: 'resume_empty',
      traceDir: path.relative(ROOT, traceDir),
    });
  }

  console.log(`\n${C.cyan}tutor-stub${C.reset} ${C.dim}${args.model} -> ${visibleModel.provider}/${visibleModel.model}${C.reset}`);
  if (classifierEnabled && combinedLearnerAnalysisEnabled) {
    console.log(
      `${C.dim}classifier: combined into learner-DAG analysis via ${args['learner-record-model']} -> ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (classifierEnabled) {
    console.log(
      `${C.dim}classifier: ${args['classifier-model']} -> ${visibleClassifierModel.provider}/${visibleClassifierModel.model}${C.reset}`,
    );
  } else {
    console.log(`${C.dim}classifier: off${C.reset}`);
  }
  if (tutorLearnerDagEnabled) {
    console.log(
      `${C.dim}tutor learner-DAG: on via ${args['learner-record-model']} -> ${visibleLearnerRecordModel.provider}/${visibleLearnerRecordModel.model}${C.reset}`,
    );
  } else if (args['tutor-learner-dag'] && !worldBundle) {
    console.log(`${C.dim}tutor learner-DAG: requested, but off because no detective world is active${C.reset}`);
  } else {
    console.log(`${C.dim}tutor learner-DAG: off${C.reset}`);
  }
  if (registerSelectionEnabled) {
    console.log(`${C.dim}register selection: on [${registerPalette.join(', ')}]${C.reset}`);
  } else {
    console.log(`${C.dim}register selection: off${C.reset}`);
  }
  if (trace.enabled) {
    console.log(`${C.dim}trace: ${traceDisplayPath(trace)}${C.reset}`);
  } else {
    console.log(`${C.dim}trace: off${C.reset}`);
  }
  if (streamEnabled) {
    const streamBits = [
      tutorStreamState === 'live' ? 'tutor live' : null,
      tutorStreamState === 'guarded_after_audit' ? 'tutor guarded-after-audit' : null,
      classifierResolved && providerSupportsStreaming(classifierResolved) ? 'classifier' : null,
      learnerRecordResolved && providerSupportsStreaming(learnerRecordResolved) ? 'learner-DAG/analysis' : null,
    ].filter(Boolean);
    const streamSummary = streamBits.length
      ? `on for ${streamBits.join(', ')}`
      : tutorStreamState === 'unavailable_cli_buffered'
        ? 'requested, but tutor provider is CLI-buffered'
        : 'requested, but selected providers are CLI-buffered';
    console.log(`${C.dim}stream: ${streamSummary}${C.reset}`);
  } else {
    console.log(`${C.dim}stream: off${C.reset}`);
  }
  if (resumedDialogue) {
    console.log(
      `${C.dim}resume: loaded ${resumedDialogue.turns} turn(s) from ${path.relative(ROOT, resumedDialogue.source)}${C.reset}`,
    );
    if (resumedDialogue.learnerDag.skipped) {
      console.log(
        `${C.dim}resume: learner-DAG replayed ${resumedDialogue.learnerDag.replayed}, reused ${resumedDialogue.learnerDag.skipped} stored model snapshot(s)${C.reset}`,
      );
    }
    for (const warning of resumedDialogue.warnings) {
      console.log(`${C.red}resume warning${C.reset}${C.dim}: ${warning}${C.reset}`);
    }
  } else if (args['resume-last']) {
    console.log(`${C.dim}resume: no completed dialogue found in ${path.relative(ROOT, traceDir)}${C.reset}`);
  }
  if (temperature !== effectiveTemperature) {
    console.log(
      `${C.dim}temperature: requested ${temperature}; using ${effectiveTemperature} because ${visibleModel.model} only supports the default${C.reset}`,
    );
  }
  if (worldBundle) {
    console.log(
      `${C.dim}world: ${worldBundle.world.id} — ${worldBundle.world.title}${args.dag ? ' | DAG on' : ' | DAG off'}${C.reset}`,
    );
  }
  printDirectorInitialContext(directorContext);
  console.log(`${C.dim}topic: ${effectiveTopic} | /analysis for current turn | /help for commands | /quit to exit${C.reset}\n`);

  if (firstMessage) {
    const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
      firstMessage,
      state,
    );
    process.stdout.write(`${C.dim}calling tutor...${C.reset}\r`);
    const response = await runOneTurn(
      firstMessage,
      state,
      classification,
      tutorLearnerDag,
      registerSelection,
      previousRegisterEfficacy,
    );
    clearStatusLine();
    if (!response.streamed) {
      console.log(`${C.magenta}tutor >${C.reset} ${response.text.trim()}`);
    }
    console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
    printTutorDagSnapshot(response.dagSnapshot);
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'once', turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        registerSelection: registerSelectionEnabled
          ? { enabled: true, palette: registerPalette, history: state.register.history }
          : null,
        directorContext,
        trace: traceDisplayPath(state.trace),
        world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
        turns: state.turns,
      });
    }
    return;
  }

  const rl = readline.createInterface({ input, output });
  rl.on('SIGINT', () => {
    console.log();
    appendTraceEvent(state.trace, { type: 'run_end', reason: 'sigint', turns: state.turns.length });
    if (args.save) {
      saveTranscript(args.save, {
        ...visibleModel,
        classifier: classifierEnabled ? visibleClassifierConfig : null,
        tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
        registerSelection: registerSelectionEnabled
          ? { enabled: true, palette: registerPalette, history: state.register.history }
          : null,
        directorContext,
        trace: traceDisplayPath(state.trace),
        turns: state.turns,
      });
    }
    process.exit(0);
  });

  while (true) {
    let line;
    try {
      line = await rl.question(`${C.bold}learner >${C.reset} `);
    } catch (err) {
      if (/readline was closed/i.test(err.message)) break;
      throw err;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === '/quit' || trimmed === '/exit') break;
    if (trimmed === '/help') {
      printInteractiveHelp();
      appendTraceEvent(state.trace, { type: 'interactive_help', turns: state.turns.length });
      continue;
    }
    if (trimmed === '/analysis' || trimmed === '/a') {
      printCurrentTurnAnalysis(state);
      appendTraceEvent(state.trace, {
        type: 'analysis_popup',
        turn: state.turns[state.turns.length - 1]?.turn || null,
      });
      continue;
    }
    if (trimmed === '/clear') {
      state.history = [];
      state.turns = [];
      state.learnerDag = createLearnerDagState({
        enabled: tutorLearnerDagEnabled,
        resolved: learnerRecordResolved,
        world: worldBundle?.world || null,
      });
      state.register = {
        enabled: registerSelectionEnabled,
        palette: registerPalette,
        current: null,
        history: [],
      };
      appendTraceEvent(state.trace, { type: 'history_clear' });
      console.log(`${C.dim}history cleared${C.reset}\n`);
      continue;
    }

    try {
      const { classification, tutorLearnerDag, registerSelection, previousRegisterEfficacy } = await analyzeLearnerTurn(
        trimmed,
        state,
      );
      process.stdout.write(`${C.dim}calling tutor...${C.reset}\r`);
      const response = await runOneTurn(
        trimmed,
        state,
        classification,
        tutorLearnerDag,
        registerSelection,
        previousRegisterEfficacy,
      );
      clearStatusLine();
      if (!response.streamed) {
        console.log(`${C.magenta}tutor >${C.reset} ${response.text.trim()}`);
      }
      console.log(`${C.dim}${metadataLine(response)}${C.reset}\n`);
      printTutorDagSnapshot(response.dagSnapshot);
    } catch (err) {
      clearStatusLine();
      console.error(`${C.red}error:${C.reset} ${err.message}\n`);
    }
  }

  rl.close();
  appendTraceEvent(state.trace, { type: 'run_end', reason: 'exit', turns: state.turns.length });
  if (args.save) {
    saveTranscript(args.save, {
      ...visibleModel,
      classifier: classifierEnabled ? visibleClassifierConfig : null,
      tutorLearnerDag: tutorLearnerDagEnabled ? visibleLearnerRecordModel : null,
      registerSelection: registerSelectionEnabled
        ? { enabled: true, palette: registerPalette, history: state.register.history }
        : null,
      directorContext,
      trace: traceDisplayPath(state.trace),
      world: worldBundle ? { id: worldBundle.world.id, title: worldBundle.world.title, dag: args.dag } : null,
      turns: state.turns,
    });
  }
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
