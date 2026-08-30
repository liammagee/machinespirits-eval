#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  renderDramaticDialogueFragment,
  renderDramaticDialogueStyles,
  validateDramaticDialogueInterchange,
} from '../services/dramaticDialogueRenderer.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(ROOT, 'notes', 'poetics', '2026-08-29-adaptive-tutor-from-null-to-control.html');
const DATA_PATH = path.join(ROOT, 'notes', 'poetics', 'fixtures', 'adaptive-tutor-crossed-dialogue.json');

function replaceManaged(source, name, body, { comment = 'html' } = {}) {
  const markers =
    comment === 'css'
      ? [`/* DRAMATIC_DIALOGUE:${name}:START */`, `/* DRAMATIC_DIALOGUE:${name}:END */`]
      : [`<!-- DRAMATIC_DIALOGUE:${name}:START -->`, `<!-- DRAMATIC_DIALOGUE:${name}:END -->`];
  const start = source.indexOf(markers[0]);
  const end = source.indexOf(markers[1]);
  if (start < 0 || end < start) throw new Error(`missing managed ${name} markers in ${REPORT_PATH}`);
  return `${source.slice(0, start)}${markers[0]}\n${body}\n${source.slice(end)}`;
}

function expectedReport() {
  const dialogue = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  validateDramaticDialogueInterchange(dialogue);
  let html = fs.readFileSync(REPORT_PATH, 'utf8');
  html = replaceManaged(html, 'CROSSED', renderDramaticDialogueFragment(dialogue));
  html = replaceManaged(html, 'STYLES', renderDramaticDialogueStyles().trim(), { comment: 'css' });
  return html;
}

const write = process.argv.includes('--write');
const check = process.argv.includes('--check') || !write;
const unknown = process.argv.slice(2).filter((arg) => !['--check', '--write'].includes(arg));
if (unknown.length) throw new Error(`unknown flag(s): ${unknown.join(', ')}`);

const before = fs.readFileSync(REPORT_PATH, 'utf8');
const after = expectedReport();
if (write) {
  if (before !== after) fs.writeFileSync(REPORT_PATH, after, 'utf8');
  console.log(
    before === after ? 'dramatic dialogue fixtures already current' : `updated ${path.relative(ROOT, REPORT_PATH)}`,
  );
} else if (check) {
  if (before !== after) {
    console.error('dramatic dialogue fixtures are stale; run node scripts/sync-dramatic-dialogue-fixtures.js --write');
    process.exitCode = 1;
  } else console.log('dramatic dialogue fixtures are current');
}
