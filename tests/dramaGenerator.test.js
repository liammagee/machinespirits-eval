import { strict as assert } from 'node:assert';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_ANSWERS,
  artifactPaths,
  buildDramaSpec,
  buildGeneratorCommand,
  collectAnswers,
  parseArgs,
  profilePair,
  runIdFor,
  slugify,
} from '../scripts/drama-generator.js';

describe('drama-generator', () => {
  it('maps condition to existing tutor and learner profiles', () => {
    assert.deepEqual(profilePair('recognition'), {
      tutorProfile: 'recognition',
      learnerProfile: 'ego_superego_recognition_authentic',
    });
    assert.deepEqual(profilePair('base'), {
      tutorProfile: 'baseline',
      learnerProfile: 'ego_superego_authentic',
    });
  });

  it('builds a single-drama spec with role personality constraints', () => {
    const answers = {
      ...DEFAULT_ANSWERS,
      discipline: 'statistics',
      tutorPersonality: 'skeptical and spare',
      learnerPersonality: 'proud, hurried, allergic to hedging',
      directorPersonality: 'interruptive but dry',
      misframing: 'statistical significance means practical importance',
      reframe: 'the learner re-reads the p-value as evidence against a null, not effect size',
    };
    const spec = buildDramaSpec(answers, { runId: 'unit-test', createdAt: '2026-05-23T00:00:00.000Z' });
    const drama = spec.dramas[0];

    assert.equal(spec.meta.artifact_id, 'unit-test');
    assert.equal(drama.id, 'DG1');
    assert.equal(drama.discipline, 'statistics');
    assert.equal(drama.tutor_profile, 'recognition');
    assert.equal(drama.learner_profile, 'ego_superego_recognition_authentic');
    assert.equal(drama.opening_speaker, 'learner');
    assert.equal(drama.ending_speaker, 'director');
    assert.match(drama.tutor_voice_constraint, /skeptical and spare/);
    assert.match(drama.tutor_voice_constraint, /do not quote the superego/i);
    assert.match(drama.learner_voice_constraint, /proud, hurried/);
    assert.match(drama.director_note, /interruptive but dry/);
    assert.equal(
      drama.dramatic_shape,
      'statistical significance means practical importance -> the learner re-reads the p-value as evidence against a null, not effect size',
    );
  });

  it('emits a generator command that delegates to the existing bilateral engine', () => {
    const args = parseArgs([
      '--non-interactive',
      '--mock',
      '--force',
      '--out-root',
      '/tmp/drama-generator-test',
      '--id',
      'smoke',
      '--generator',
      'codex',
      '--max-turns',
      '3',
      '--revisit-policy',
      'reframe',
    ]);
    const answers = collectAnswers(args);
    const paths = artifactPaths(args.outRoot, runIdFor(args, answers));
    const command = buildGeneratorCommand(args, answers, paths);

    assert.equal(path.basename(command[1]), 'generate-pedagogical-dramas.js');
    assert.ok(command.includes('--spec'));
    assert.ok(command.includes(paths.specPath));
    assert.ok(command.includes('--only'));
    assert.ok(command.includes('DG1'));
    assert.ok(command.includes('--director-revisit-policy'));
    assert.ok(command.includes('reframe'));
    assert.ok(command.includes('--mock'));
    assert.ok(command.includes('--force'));
  });

  it('slugifies scenario names for path-safe run ids', () => {
    assert.equal(slugify('Can an exact quote still mislead?'), 'can-an-exact-quote-still-mislead');
  });
});
