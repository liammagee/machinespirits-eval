#!/usr/bin/env node
/**
 * Render a tutor-stub saved run (--save JSON) into a readable markdown
 * transcript for green-room coaching and compliance judging.
 *
 * Usage: node scripts/greenroom-render-transcript.js <run.json> [--out <file.md>]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export function renderStubRun(run, label = 'performance') {
  const lines = [`# Performance ${label}`, ''];
  const worldId = run?.world?.id || run?.world || 'unknown-world';
  lines.push(`World: ${typeof worldId === 'string' ? worldId : JSON.stringify(worldId).slice(0, 80)}`);
  lines.push(`Register policy: ${run?.registerSelection?.policy || 'unknown'} · Turns: ${(run?.turns || []).length}`);
  lines.push('');
  for (const turn of run?.turns || []) {
    const stance = turn?.registerSelection?.register || turn?.registerSelection?.stance || null;
    lines.push(`## Turn ${turn.turn ?? '?'}`);
    lines.push(`LEARNER: ${String(turn.learner || '').trim()}`);
    lines.push('');
    lines.push(`TUTOR${stance ? ` [register: ${stance}]` : ''}: ${String(turn.tutor || '').trim()}`);
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: greenroom-render-transcript.js <run.json> [--out <file.md>]');
    process.exit(1);
  }
  const outIdx = args.indexOf('--out');
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  const label = path.basename(file).replace(/\.[^.]+$/, '');
  const md = renderStubRun(run, label);
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], md);
    console.log(`rendered → ${args[outIdx + 1]} (${(run.turns || []).length} turns)`);
  } else {
    console.log(md);
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) main();
