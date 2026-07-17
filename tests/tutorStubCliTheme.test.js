import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';

import {
  TUTOR_STUB_CLI_MOTION_IDS,
  TUTOR_STUB_CLI_THEME_IDS,
  createTutorStubCliPresentation,
  normalizeTutorStubCliMotion,
  normalizeTutorStubCliThemeId,
  stripTutorStubCliAnsi,
  tutorStubCliMasthead,
  tutorStubCliMotionInterval,
  tutorStubCliSpinnerFrames,
  tutorStubCliThemeOptions,
} from '../services/tutorStubCliTheme.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tty(columns = 100) {
  return { isTTY: true, columns };
}

test('CLI themes expose distinct, readable semantic palettes', () => {
  assert.deepEqual(TUTOR_STUB_CLI_THEME_IDS, ['nocturne', 'ember', 'parchment', 'high_contrast', 'mono']);
  assert.equal(tutorStubCliThemeOptions().length, TUTOR_STUB_CLI_THEME_IDS.length);

  const nocturne = createTutorStubCliPresentation({
    theme: 'nocturne',
    output: tty(),
    env: { TERM: 'xterm-256color' },
  });
  const ember = createTutorStubCliPresentation({
    theme: 'ember',
    output: tty(),
    env: { TERM: 'xterm-256color' },
  });

  assert.equal(nocturne.colorMode, 'truecolor');
  assert.ok(nocturne.colors.tutor.startsWith('\x1b[38;2;'));
  assert.notEqual(nocturne.colors.tutor, nocturne.colors.learner);
  assert.notEqual(nocturne.colors.tutor, ember.colors.tutor);
  assert.equal(normalizeTutorStubCliThemeId('high-contrast'), 'high_contrast');
  assert.equal(normalizeTutorStubCliThemeId('warm'), 'ember');
  assert.throws(() => normalizeTutorStubCliThemeId('laserdisc', { strict: true }), /theme must be one of/u);
});

test('color and motion capabilities fail gracefully outside an interactive terminal', () => {
  const piped = createTutorStubCliPresentation({
    theme: 'nocturne',
    motion: 'auto',
    output: { isTTY: false },
    env: { TERM: 'xterm-256color' },
  });
  assert.equal(piped.colorMode, 'none');
  assert.equal(piped.motion, 'off');
  assert.equal(piped.colors.tutor, '');

  const noColor = createTutorStubCliPresentation({
    theme: 'ember',
    motion: 'full',
    output: tty(),
    env: { TERM: 'xterm-256color', NO_COLOR: '' },
  });
  assert.equal(noColor.colorMode, 'none');
  assert.equal(noColor.motion, 'full');
  assert.equal(noColor.colors.reset, '');

  const reduced = createTutorStubCliPresentation({
    motion: 'auto',
    output: tty(),
    env: { TERM: 'xterm-256color', REDUCE_MOTION: '1' },
  });
  assert.equal(reduced.motion, 'off');
});

test('motion levels are deliberate and bounded to one lightweight progress glyph', () => {
  const full = createTutorStubCliPresentation({ motion: 'full', output: tty(), env: {} });
  const subtle = createTutorStubCliPresentation({ motion: 'subtle', output: tty(), env: {} });
  const off = createTutorStubCliPresentation({ motion: 'off', output: tty(), env: {} });
  const automatic = createTutorStubCliPresentation({ motion: 'auto', output: tty(), env: {} });

  assert.deepEqual(TUTOR_STUB_CLI_MOTION_IDS, ['auto', 'full', 'subtle', 'off']);
  assert.deepEqual(tutorStubCliSpinnerFrames(full), ['◐', '◓', '◑', '◒']);
  assert.deepEqual(tutorStubCliSpinnerFrames(subtle), ['◆', '◇']);
  assert.deepEqual(tutorStubCliSpinnerFrames(off), ['·']);
  assert.equal(tutorStubCliMotionInterval(full), 220);
  assert.equal(tutorStubCliMotionInterval(subtle), 650);
  assert.equal(tutorStubCliMotionInterval(off), 0);
  assert.equal(automatic.motion, 'subtle');
  assert.equal(normalizeTutorStubCliMotion('FULL'), 'full');
  assert.throws(() => normalizeTutorStubCliMotion('wobble', { strict: true }), /motion must be one of/u);
});

test('masthead remains aligned with and without ANSI styling', () => {
  const presentation = createTutorStubCliPresentation({
    theme: 'nocturne',
    output: tty(64),
    env: { TERM: 'xterm-256color' },
  });
  const rendered = tutorStubCliMasthead(
    {
      eyebrow: 'MACHINE SPIRITS · LIVE INQUIRY',
      title: 'The Recalled Edition',
      subtitle: 'dramatic-detective@v1 · subtle motion',
      width: 58,
    },
    presentation,
  );
  const lines = stripTutorStubCliAnsi(rendered).split('\n');
  assert.equal(lines.length, 5);
  assert.ok(lines.every((line) => line.length === 58));
  assert.match(lines[1], /MACHINE SPIRITS · LIVE INQUIRY/u);
  assert.match(lines[2], /The Recalled Edition/u);
});

test('interactive CLI switches theme and motion without restarting the dialogue', async () => {
  const env = { ...process.env, TERM: 'xterm-256color' };
  delete env.NO_COLOR;
  delete env.FORCE_COLOR;
  const child = pty.spawn(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--passthrough',
      '--no-trace',
      '--no-remember-settings',
      '--theme',
      'nocturne',
      '--motion',
      'subtle',
    ],
    {
      cwd: ROOT,
      cols: 92,
      rows: 32,
      env,
    },
  );
  let transcript = '';
  let stage = 0;
  const completed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`timed out waiting for themed CLI\n${stripTutorStubCliAnsi(transcript)}`));
    }, 8_000);
    child.onData((chunk) => {
      transcript += chunk;
      const plain = stripTutorStubCliAnsi(transcript);
      if (stage === 0 && plain.includes('learner >')) {
        stage = 1;
        child.write('/theme ember\r');
      } else if (stage === 1 && plain.includes('theme > Ember')) {
        stage = 2;
        child.write('/motion full\r');
      } else if (stage === 2 && plain.includes('motion > full')) {
        stage = 3;
        child.write('/status\r');
      } else if (stage === 3 && plain.includes('appearance: Ember · full motion')) {
        stage = 4;
        child.write('/quit\r');
      }
    });
    child.onExit(({ exitCode }) => {
      clearTimeout(timeout);
      if (exitCode === 0 && stage === 4) resolve();
      else reject(new Error(`themed CLI exited ${exitCode} at stage ${stage}`));
    });
  });

  await completed;
  const plain = stripTutorStubCliAnsi(transcript);
  assert.match(plain, /MACHINE SPIRITS · LIVE INQUIRY/u);
  assert.match(plain, /theme > Ember · Coral, amber, and rose/u);
  assert.match(plain, /motion > full/u);
  assert.match(plain, /appearance: Ember · full motion · truecolor/u);
});
