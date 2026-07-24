import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import pty from 'node-pty';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDALONE_CLI = path.join(ROOT, 'scripts', 'labelling-game.js');

function plainTerminalText(value) {
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, 'gu');
  return String(value || '')
    .replace(ansi, '')
    .replace(/\r/gu, '');
}

function fixtureWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'labelling-game-cli-'));
  const datasetPath = path.join(root, 'impasses.json');
  fs.writeFileSync(
    datasetPath,
    JSON.stringify({
      schema: 'test.impasse.v1',
      episodes: [
        {
          episode_id: 'E01',
          session_date: '2026-07-22 09:00:00',
          turn_range: [2, 3],
          signals_fired: ['h1_clarification'],
          excerpt_turns: [{ turn: 2, learner_text: 'Which record?', tutor_text: 'The ledger.' }],
          followup_turns: [],
        },
      ],
    }),
    'utf8',
  );
  return { root, datasetPath, outputDir: path.join(root, 'out') };
}

describe('labelling-game CLI integration', () => {
  it('advertises the tutor-stub launch flags', () => {
    const result = spawnSync(process.execPath, ['scripts/tutor-stub.js', '--help'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /--launch-mode <chat\|labelling-game>/);
    assert.match(result.stdout, /--labelling-game/);
    assert.match(result.stdout, /--label-dataset <id>/);
  });

  it('launches the shared impasse packet from tutor-stub without starting a model session', () => {
    const fixture = fixtureWorkspace();
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--launch-mode',
        'labelling-game',
        '--label-dataset',
        'tutor-stub-impasses',
        '--label-coder',
        'cli-test',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: 'q\n',
        env: {
          ...process.env,
          LABELLING_GAME_CODER: 'ignored-env-coder',
          LABELLING_GAME_IMPASSE_DATASET: fixture.datasetPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Machine Spirits · Labelling Game/);
    assert.match(result.stdout, /coder > cli-test/);
    assert.match(result.stdout, /tutor-stub-impasses · 0\/1 complete/);
    assert.match(result.stdout, /E01 · 1\/1 · open/);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });

  it('uses LABELLING_GAME_CODER as the local default without prompting', () => {
    const fixture = fixtureWorkspace();
    const result = spawnSync(
      process.execPath,
      ['scripts/tutor-stub.js', '--launch-mode', 'labelling-game', '--label-dataset', 'tutor-stub-impasses'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: 'q\n',
        env: {
          ...process.env,
          LABELLING_GAME_CODER: 'env-coder',
          LABELLING_GAME_IMPASSE_DATASET: fixture.datasetPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /coder > env-coder/);
    assert.doesNotMatch(result.stdout, /Coder ID \[rater-A\]:/);
    assert.match(result.stdout, /tutor-stub-impasses · 0\/1 complete/);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });

  it('treats standalone stdin EOF as a deterministic clean exit', () => {
    const fixture = fixtureWorkspace();
    const result = spawnSync(
      process.execPath,
      [STANDALONE_CLI, '--dataset', 'tutor-stub-impasses', '--coder', 'eof-rater'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '',
        env: {
          ...process.env,
          LABELLING_GAME_IMPASSE_DATASET: fixture.datasetPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Input closed; no incomplete label was saved\./u);
    assert.doesNotMatch(result.stderr, /unsettled top-level await|Warning:/u);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });

  it('reports standalone setup failures without a stack trace and exits one', () => {
    const fixture = fixtureWorkspace();
    const missingPath = path.join(fixture.root, 'missing-impasses.json');
    const result = spawnSync(
      process.execPath,
      [STANDALONE_CLI, '--dataset', 'tutor-stub-impasses', '--coder', 'setup-rater'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        input: '',
        env: {
          ...process.env,
          LABELLING_GAME_IMPASSE_DATASET: missingPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout.split('\n')[0], 'Machine Spirits · Labelling Game');
    assert.match(result.stderr, /^Labelling game failed: impasse dataset not found:/u);
    assert.doesNotMatch(result.stderr, /\n\s+at /u);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });

  it('offers labelling beside default chat and returns to the launcher on quit', async () => {
    const fixture = fixtureWorkspace();
    const result = await new Promise((resolve, reject) => {
      const terminal = pty.spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', '--silent', 'tutor:stub'], {
        cwd: ROOT,
        cols: 110,
        rows: 32,
        env: {
          ...process.env,
          LABELLING_GAME_IMPASSE_DATASET: fixture.datasetPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
          TUTOR_STUB_SETTINGS_FILE: path.join(fixture.root, 'settings.json'),
        },
      });
      let output = '';
      let stage = 'launcher';
      let settled = false;
      const timer = setTimeout(() => {
        terminal.kill();
        reject(new Error(`launch-mode picker timed out at ${stage}\n${plainTerminalText(output)}`));
      }, 10_000);

      terminal.onData((chunk) => {
        output += chunk;
        const plain = plainTerminalText(output);
        if (stage === 'launcher' && plain.includes('launches > Mixed tutor chat')) {
          stage = 'dataset';
          terminal.write('\u001b[B\r');
        } else if (stage === 'dataset' && plain.includes('Dataset [superego-taxonomy]:')) {
          stage = 'coder';
          terminal.write('2\r');
        } else if (stage === 'coder' && plain.includes('Coder ID [rater-A]:')) {
          stage = 'game';
          terminal.write('\r');
        } else if (stage === 'game' && plain.includes('E01 · 1/1 · open')) {
          stage = 'returning';
          terminal.write('q\r');
        } else if (stage === 'returning' && plain.split('launches > Mixed tutor chat').length - 1 >= 2) {
          stage = 'chat';
          terminal.write('\r');
        } else if (stage === 'chat' && plain.includes('mode > Mixed tutor chat')) {
          settled = true;
          clearTimeout(timer);
          terminal.kill();
          resolve(plain);
        }
      });
      terminal.onExit(({ exitCode }) => {
        if (settled) return;
        clearTimeout(timer);
        if (exitCode !== 0) {
          reject(new Error(`launch-mode picker exited ${exitCode}\n${plainTerminalText(output)}`));
          return;
        }
        resolve(plainTerminalText(output));
      });
    });

    assert.match(result, /Choose a mode/u);
    assert.match(result, /Mixed tutor chat/u);
    assert.match(result, /Labelling game/u);
    assert.match(result, /mode > Labelling game/u);
    assert.match(result, /mode > Mixed tutor chat/u);
    assert.ok(result.split('Choose a mode').length - 1 >= 2);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });
});
