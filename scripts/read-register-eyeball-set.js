#!/usr/bin/env node
/**
 * Ask a blind reader the presence question, plainly, about every turn in the
 * eyeball set — and run the old word list over the same turns, so the two
 * answers can be laid beside a person's reading.
 *
 * The reader is not told a manner was assigned, not told which condition wrote
 * the turn, and not shown the other turns. It is asked one question at a time:
 * is this ironic, yes or no, and which words decide it. That is the question the
 * register rubric never asked — the rubric is handed the register name and asked
 * how *well* it was done, which presumes the answer.
 *
 * Reader runs on a different model family from the writer, so agreement is not
 * a model marking its own work.
 *
 * Usage:
 *   node scripts/read-register-eyeball-set.js --set exports/register-eyeball-set
 */

import fs from 'node:fs';
import path from 'node:path';
import { callModelCliText } from '../services/cliProviderBridge.js';
import { evaluateRegisterStanceFidelity } from '../services/registerStanceFidelity.js';
import { blindOrder } from '../services/registerEyeballSet.js';

const READER_PROVIDER = 'claude-code';
const READER_MODEL = 'claude-sonnet-5';
const CONCURRENCY = 4;

/**
 * One plain sentence per manner — what a person marking the set would be told,
 * and nothing more. Definitions describe the move, never the wording, so a
 * reader has to read rather than match.
 */
const QUESTIONS = Object.freeze({
  ironic: {
    question: 'Is this reply ironic?',
    gloss:
      'A reply is ironic when its surface meaning is not what is meant — it understates, feigns puzzlement, or lets a mismatch show, so the reader has to see through it.',
  },
  sarcastic: {
    question: 'Is this reply sarcastic?',
    gloss:
      'A reply is sarcastic when it says the opposite of what it means with evident edge, so the mismatch lands as a verdict rather than a puzzle.',
  },
  face_threat: {
    question: 'Does this reply threaten the student’s face?',
    gloss:
      'A reply threatens face when it names what the student is avoiding and closes off the escape, instead of accommodating the student’s move.',
  },
});

function buildReaderPrompt({ learnerText, reply, manner }) {
  const { question, gloss } = QUESTIONS[manner];
  return [
    'Read this exchange from a philosophy tutorial.',
    '',
    'STUDENT:',
    learnerText,
    '',
    'TUTOR:',
    reply,
    '',
    `QUESTION: ${question}`,
    '',
    gloss,
    '',
    'Answer in exactly two lines and nothing else:',
    'VERDICT: yes',
    'EVIDENCE: <the exact words from the tutor reply that decide it>',
    '',
    'or',
    '',
    'VERDICT: no',
    'EVIDENCE: none',
  ].join('\n');
}

function parseReaderAnswer(text) {
  const verdictMatch = /VERDICT:\s*(yes|no)/i.exec(text || '');
  const evidenceMatch = /EVIDENCE:\s*([\s\S]*)/i.exec(text || '');
  return {
    verdict: verdictMatch ? verdictMatch[1].toLowerCase() === 'yes' : null,
    evidence: evidenceMatch ? evidenceMatch[1].trim().slice(0, 400) : '',
    raw: (text || '').trim().slice(0, 600),
  };
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function pump() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump));
  return results;
}

function parseArgs(argv) {
  const args = { set: 'exports/register-eyeball-set' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--set') args.set = argv[++i];
    else if (arg.startsWith('--set=')) args.set = arg.slice('--set='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function renderReport(rows) {
  const parts = [
    '# Register eyeball set — machine readings',
    '',
    `Reader: \`${READER_PROVIDER}/${READER_MODEL}\`, blind to the condition, one question at a time.`,
    'Word list: `evaluateRegisterStanceFidelity`, the marker component only.',
    '',
    '| id | wrote | reader: ironic | reader: sarcastic | reader: face threat | word list | gate score |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  const yn = (value) => (value === null ? '?' : value ? 'yes' : 'no');
  for (const row of rows) {
    parts.push(
      `| ${row.id} | ${row.condition} | ${yn(row.reader.ironic.verdict)} | ${yn(row.reader.sarcastic.verdict)} | ` +
        `${yn(row.reader.face_threat.verdict)} | ${row.wordList.markerFound ? 'marker' : 'none'} | ${row.wordList.score} |`,
    );
  }
  parts.push('');
  parts.push('## Evidence quoted by the reader');
  parts.push('');
  for (const row of rows) {
    parts.push(`### ${row.id} — written as \`${row.condition}\``);
    parts.push('');
    for (const manner of Object.keys(QUESTIONS)) {
      const answer = row.reader[manner];
      parts.push(`- **${manner}: ${yn(answer.verdict)}** — ${answer.evidence || '_(no evidence given)_'}`);
    }
    parts.push('');
  }
  return parts.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const setDir = path.resolve(process.cwd(), args.set);
  const setPath = path.join(setDir, 'set.json');
  if (!fs.existsSync(setPath)) throw new Error(`No set at ${setPath} — generate it first.`);
  const { cells } = JSON.parse(fs.readFileSync(setPath, 'utf8'));

  const jobs = [];
  for (const cell of blindOrder(cells)) {
    if (!cell.reply) continue;
    for (const manner of Object.keys(QUESTIONS)) {
      jobs.push({ cell, manner });
    }
  }

  console.log(`Asking ${jobs.length} presence questions on ${READER_MODEL}, ${CONCURRENCY} at a time...`);
  const byId = new Map();
  await runPool(
    jobs,
    async ({ cell, manner }) => {
      const prompt = buildReaderPrompt({ learnerText: cell.learnerText, reply: cell.reply, manner });
      let answer;
      try {
        const text = await callModelCliText({
          provider: READER_PROVIDER,
          model: READER_MODEL,
          prompt,
          role: 'register-presence-reader',
        });
        answer = parseReaderAnswer(text);
      } catch (error) {
        answer = { verdict: null, evidence: '', raw: `ERROR: ${error.message}` };
      }
      if (!byId.has(cell.id)) byId.set(cell.id, { id: cell.id, condition: cell.condition, reader: {} });
      byId.get(cell.id).reader[manner] = answer;
      console.log(`  ${cell.id} ${manner} — ${answer.verdict === null ? '?' : answer.verdict ? 'yes' : 'no'}`);
    },
    CONCURRENCY,
  );

  const rows = blindOrder(cells)
    .filter((cell) => cell.reply)
    .map((cell) => {
      const row = byId.get(cell.id);
      const gateManner = cell.condition === 'plain' ? 'ironic' : cell.condition;
      const verdict = evaluateRegisterStanceFidelity({
        registerName: gateManner,
        tutorMessage: cell.reply,
        learnerMessage: cell.learnerText,
        postLearnerMessage: '',
      });
      return {
        ...row,
        wordList: {
          gateManner,
          markerFound: !(verdict.missing || []).includes('register_marker'),
          score: verdict.score,
          passed: verdict.passed,
        },
      };
    });

  fs.writeFileSync(
    path.join(setDir, 'readings.json'),
    `${JSON.stringify({ reader: `${READER_PROVIDER}/${READER_MODEL}`, rows }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(setDir, 'readings.md'), renderReport(rows));
  console.log(`\nWrote ${setDir}/{readings.json,readings.md}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
