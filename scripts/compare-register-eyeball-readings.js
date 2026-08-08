#!/usr/bin/env node
/**
 * Lay three readings of the same 20 turns beside each other:
 *   1. hand marks   — a person's reading, recorded before any machine answer
 *   2. blind reader — claude-sonnet-5, asked the presence question plainly
 *   3. word list    — the marker component of the stance gate
 *
 * and beside the one fact that is not a reading: which condition wrote the turn.
 *
 * Two numbers matter for each reading, and the second is the one the old measure
 * never had to face. Hit rate: of the turns written in manner M, how many did
 * this reading find? False alarm rate: of the turns written some other way, how
 * many did it call M anyway? A reading that says yes to everything has a perfect
 * hit rate, which is why the plain control turns are in the set.
 *
 * Agreement with the hand marks is reported over all 60 judgments, because the
 * point of the exercise is that human reading is the standard and a measure
 * earns its place by matching it.
 *
 * Usage:
 *   node scripts/compare-register-eyeball-readings.js --set exports/register-eyeball-set
 */

import fs from 'node:fs';
import path from 'node:path';

const MANNERS = ['ironic', 'sarcastic', 'face_threat'];

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

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rate(hits, total) {
  return total === 0 ? null : hits / total;
}

function pct(value) {
  return value === null ? 'n/a' : `${Math.round(value * 100)}%`;
}

/** Hit rate and false-alarm rate for one reading of one manner. */
function detection(rows, manner, verdictOf) {
  let hit = 0;
  let target = 0;
  let falseAlarm = 0;
  let nonTarget = 0;
  for (const row of rows) {
    const said = verdictOf(row, manner);
    if (said === null) continue;
    if (row.condition === manner) {
      target += 1;
      if (said) hit += 1;
    } else {
      nonTarget += 1;
      if (said) falseAlarm += 1;
    }
  }
  return {
    hit,
    target,
    falseAlarm,
    nonTarget,
    hitRate: rate(hit, target),
    falseAlarmRate: rate(falseAlarm, nonTarget),
  };
}

function agreement(rows, aOf, bOf) {
  let agree = 0;
  let scored = 0;
  const disputes = [];
  for (const row of rows) {
    for (const manner of MANNERS) {
      const a = aOf(row, manner);
      const b = bOf(row, manner);
      if (a === null || b === null) continue;
      scored += 1;
      if (a === b) agree += 1;
      else disputes.push({ id: row.id, condition: row.condition, manner, hand: a, other: b });
    }
  }
  return { agree, scored, rate: rate(agree, scored), disputes };
}

function main() {
  const args = parseArgs(process.argv);
  const setDir = path.resolve(process.cwd(), args.set);
  const readings = readJson(path.join(setDir, 'readings.json'));
  const hand = readJson(path.join(setDir, 'hand-marks.json'));

  const rows = readings.rows.map((row) => ({
    ...row,
    hand: hand.marks[row.id] || null,
  }));

  const handOf = (row, manner) => (row.hand ? Boolean(row.hand[manner]) : null);
  const readerOf = (row, manner) => row.reader?.[manner]?.verdict ?? null;
  // The word list only ever answers about the gate it was pointed at, so it can
  // only speak to that one manner. Every other cell is a non-answer, not a "no".
  const listOf = (row, manner) => (row.wordList.gateManner === manner ? row.wordList.markerFound : null);

  const lines = [
    '# Register eyeball set — three readings compared',
    '',
    `Turns: ${rows.length}. Judgments per reading: up to ${rows.length * MANNERS.length}.`,
    `Written by: \`${hand.writerModel || 'codex.gpt-5.5'}\`. Blind reader: \`${readings.reader}\`. Marked by: ${hand.marker}.`,
    '',
    '## Did each reading find the manner that was written?',
    '',
    '| manner | reading | found | of written | called it anyway | of others |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const manner of MANNERS) {
    for (const [label, of] of [
      ['hand', handOf],
      ['blind reader', readerOf],
      ['word list', listOf],
    ]) {
      const d = detection(rows, manner, of);
      lines.push(
        `| ${manner} | ${label} | ${d.hit}/${d.target} (${pct(d.hitRate)}) | ${d.target} | ` +
          `${d.falseAlarm}/${d.nonTarget} (${pct(d.falseAlarmRate)}) | ${d.nonTarget} |`,
      );
    }
  }

  const readerAgreement = agreement(rows, handOf, readerOf);
  const listAgreement = agreement(rows, handOf, listOf);

  lines.push('');
  lines.push('## Agreement with the hand marks');
  lines.push('');
  lines.push('| reading | agrees | of judgments | rate |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(`| blind reader | ${readerAgreement.agree} | ${readerAgreement.scored} | ${pct(readerAgreement.rate)} |`);
  lines.push(`| word list | ${listAgreement.agree} | ${listAgreement.scored} | ${pct(listAgreement.rate)} |`);

  lines.push('');
  lines.push('## Where the blind reader and the hand marks part company');
  lines.push('');
  if (!readerAgreement.disputes.length) lines.push('_None._');
  for (const d of readerAgreement.disputes) {
    lines.push(
      `- **${d.id}** (written \`${d.condition}\`), ${d.manner}: hand said ${d.hand ? 'yes' : 'no'}, reader said ${d.other ? 'yes' : 'no'}`,
    );
  }

  lines.push('');
  lines.push('## Where the word list and the hand marks part company');
  lines.push('');
  if (!listAgreement.disputes.length) lines.push('_None._');
  for (const d of listAgreement.disputes) {
    lines.push(
      `- **${d.id}** (written \`${d.condition}\`), ${d.manner}: hand said ${d.hand ? 'yes' : 'no'}, word list said ${d.other ? 'marker present' : 'no marker'}`,
    );
  }

  lines.push('');
  lines.push('## Turn by turn');
  lines.push('');
  lines.push('| id | written | hand | blind reader | word list |');
  lines.push('| --- | --- | --- | --- | --- |');
  const brief = (of) => (row) =>
    MANNERS.filter((manner) => of(row, manner) === true)
      .map((manner) => manner.replace('face_threat', 'face'))
      .join(', ') || '—';
  for (const row of rows) {
    lines.push(
      `| ${row.id} | ${row.condition} | ${brief(handOf)(row)} | ${brief(readerOf)(row)} | ` +
        `${row.wordList.markerFound ? `${row.wordList.gateManner} marker` : 'no marker'} (${row.wordList.score}) |`,
    );
  }

  const report = `${lines.join('\n')}\n`;
  fs.writeFileSync(path.join(setDir, 'comparison.md'), report);
  console.log(report);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
