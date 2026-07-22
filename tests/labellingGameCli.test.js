import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
    assert.match(result.stdout, /--labelling-game/);
    assert.match(result.stdout, /--label-dataset <id>/);
  });

  it('launches the shared impasse packet from tutor-stub without starting a model session', () => {
    const fixture = fixtureWorkspace();
    const result = spawnSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--labelling-game',
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
          LABELLING_GAME_IMPASSE_DATASET: fixture.datasetPath,
          LABELLING_GAME_IMPASSE_OUTPUT_DIR: fixture.outputDir,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Machine Spirits · Labelling Game/);
    assert.match(result.stdout, /tutor-stub-impasses · 0\/1 complete/);
    assert.match(result.stdout, /E01 · 1\/1 · open/);
    assert.equal(fs.existsSync(fixture.outputDir), false);
  });
});
