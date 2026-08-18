// GO-note content checks for the three adaptive-warrant paid-run gates.
//
// The edged-register runner matched /\bGO\b/ anywhere in the note, so a note
// headed "DRAFT FOR HUMAN REVIEW — NOT SIGNED" passed its own gate (commit
// 22dbbc31). The same weak token sat in these three. Two of them pin one exact
// committed path, so the token was decoration there. The pilot pins only the
// relay directory, so the token was the gate — and eight committed notes
// satisfied it, five of them not GO notes at all.
//
// Zero model calls. The positive cases read the real committed notes.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkReviewerGoNoteContent,
  goNoteBody,
  goNoteTitleLine,
  hasBareGoToken,
  isReviewerGoNoteFilename,
  titleAnnouncesGoNote,
} from '../services/reviewerGoNoteContent.js';
import { validateOutcomePilotGoNote } from '../scripts/run-adaptive-warrant-outcome-pilot.js';
import { validateOutcomeMainBlockGoNote } from '../scripts/run-adaptive-warrant-outcome-main-block.js';
import { validateSteeringDecompositionGoNote } from '../scripts/run-adaptive-warrant-steering-decomposition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELAY = 'docs/adaptation-refinement/relay';

// Every signed reviewer GO note in the closed adaptive-warrant arc. The gates
// must keep accepting all six; the arc is cited provenance (paper §6.25).
const SIGNED_NOTES = [
  '063a-reviewer-go-note-outcome-pilot.md',
  '069b-reviewer-go-note-outcome-pilot-corrected.md',
  '073a-reviewer-go-note-outcome-pilot-v3.md',
  '083a-reviewer-go-note-outcome-pilot-v4.md',
  '097a-reviewer-go-note-main-block.md',
  '103-reviewer-go-note-steering-decomposition.md',
];

// Committed relay files that satisfied the old /\bGO\b/ token but are not
// signatures: three Codex reports, a reviewer direction that says the relaunch
// needs a fresh GO, and the status file whose matching line records a NO-GO.
const IMPOSTORS = [
  '070-codex-report.md',
  '071-codex-report.md',
  '072-reviewer-direction-prompt-audit-repair.md',
  '074-codex-report.md',
  'STATE.md',
];

const readNote = (name) => fs.readFileSync(path.join(ROOT, RELAY, name), 'utf8');

test('the six signed notes still pass the tightened content check', () => {
  for (const name of SIGNED_NOTES) {
    const result = checkReviewerGoNoteContent(readNote(name), { label: name });
    assert.equal(result.ok, true, `${name} must still pass: ${result.errors.join('; ')}`);
    assert.equal(isReviewerGoNoteFilename(`${RELAY}/${name}`), true, `${name} must read as a reviewer GO note`);
  }
});

test('the edged rule does not transfer — none of the signed notes writes GO on its own line', () => {
  // Documents why the fix here differs from commit 22dbbc31. Copying /^GO$/m
  // across would have refused all three live gates.
  for (const name of SIGNED_NOTES) {
    assert.equal(/^GO$/mu.test(readNote(name)), false, `${name} unexpectedly has a bare GO line`);
  }
});

test('reports, directions and the status file are refused', () => {
  for (const name of IMPOSTORS) {
    const text = readNote(name);
    // They all carried the old token, which is why the old gate let them in.
    assert.equal(/\bGO\b/u.test(text), true, `${name} should still match the old weak token`);
    const result = checkReviewerGoNoteContent(text, { label: name });
    assert.equal(result.ok, false, `${name} must not read as a signature`);
    assert.match(result.errors.join(' '), /title does not announce it as a GO note/u);
  }
});

test('the pilot gate no longer accepts a report in place of a signature', () => {
  // The pilot takes --go-note as a free argument inside the relay directory,
  // so this is the gate that was actually load-bearing.
  for (const name of IMPOSTORS) {
    assert.throws(
      () => validateOutcomePilotGoNote(`${RELAY}/${name}`),
      /must be a reviewer-go-note file/u,
      `${name} must be refused`,
    );
  }
});

test('the pilot gate still accepts the unconsumed signed pilot notes', () => {
  for (const name of [
    '069b-reviewer-go-note-outcome-pilot-corrected.md',
    '083a-reviewer-go-note-outcome-pilot-v4.md',
  ]) {
    const result = validateOutcomePilotGoNote(`${RELAY}/${name}`);
    assert.equal(result.relative_path, `${RELAY}/${name}`);
    assert.match(result.sha256, /^[a-f0-9]{64}$/u);
  }
  // 063a stays consumed, and that check runs before the new ones.
  assert.throws(() => validateOutcomePilotGoNote(`${RELAY}/${SIGNED_NOTES[0]}`), /063a is consumed/u);
});

test('the two pinned gates still accept their own signed notes', () => {
  const mainBlock = validateOutcomeMainBlockGoNote(`${RELAY}/097a-reviewer-go-note-main-block.md`);
  assert.equal(mainBlock.relative_path, `${RELAY}/097a-reviewer-go-note-main-block.md`);
  const steering = validateSteeringDecompositionGoNote(`${RELAY}/103-reviewer-go-note-steering-decomposition.md`);
  assert.equal(steering.relative_path, `${RELAY}/103-reviewer-go-note-steering-decomposition.md`);
});

test('a draft committed at a pinned path is refused', () => {
  // The residual risk the two pinned gates carry: the path check and the
  // HEAD-byte check both pass if the draft is what got committed there.
  const draft = [
    '# 097a — GO note: launch the outcome main block',
    '',
    '**DRAFT FOR HUMAN REVIEW — NOT SIGNED.**',
    '',
    'GO for seeds 524 to 535; 1,152 reads; 48 allowance.',
  ].join('\n');
  const result = checkReviewerGoNoteContent(draft, { label: 'reviewer note 097a' });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /draft banner/u);
});

test('a registered NO-GO is not a GO', () => {
  const noGo = '# 095 — GO note: outcome pilot\n\nThe pilot completed with a registered NO-GO. No launch.';
  assert.equal(/\bGO\b/u.test(noGo), true, 'the old token matched inside NO-GO');
  assert.equal(hasBareGoToken(goNoteBody(noGo)), false);
  const result = checkReviewerGoNoteContent(noGo);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /does not say GO below its title/u);
  // A note that says both still counts — the reviewer may explain a past NO-GO.
  assert.equal(hasBareGoToken('The v3 block was a NO-GO. This note is the reviewer GO.'), true);
});

test('the GO-token check reads the body, so it is not the title check twice', () => {
  // "GO note" in the title supplies a bare GO on its own. Testing the whole
  // text would make this a second name for titleAnnouncesGoNote.
  const titleOnly = '# 099 — Reviewer GO note: launch\n\nThe reviewer has not decided.';
  assert.equal(hasBareGoToken(titleOnly), true, 'the title alone carries the token');
  assert.equal(titleAnnouncesGoNote(titleOnly), true);
  assert.equal(checkReviewerGoNoteContent(titleOnly).ok, false, 'but the body says nothing');
  // Every signed note says GO below its title.
  for (const name of SIGNED_NOTES) {
    assert.equal(hasBareGoToken(goNoteBody(readNote(name))), true, `${name} must say GO below its title`);
  }
});

test('ALGO and GOAL are not a GO', () => {
  // The two block runners used text.includes('GO'), which matched both.
  const text = '# 099 — GO note: the ALGO change meets the GOAL';
  assert.equal(text.includes('GO'), true);
  assert.equal(hasBareGoToken('the ALGO change meets the GOAL'), false);
});

test('title and filename helpers read the right thing', () => {
  assert.equal(goNoteTitleLine('\n\n   # 103 — GO note: launch  \n\nbody'), '# 103 — GO note: launch');
  assert.equal(titleAnnouncesGoNote('# 070 — Codex report: pilot refused\n\nGO note 069b'), false);
  assert.equal(isReviewerGoNoteFilename(`${RELAY}/104-codex-report.md`), false);
  assert.equal(isReviewerGoNoteFilename(`${RELAY}/103-reviewer-go-note-steering-decomposition.md`), true);
  assert.equal(isReviewerGoNoteFilename(''), false);
});
