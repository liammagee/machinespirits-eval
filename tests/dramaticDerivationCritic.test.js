/**
 * The post-run critic + proof-in-prose layer (operator decision 2026-06-10:
 * every run gets a critic's commentary, with Fable as critic):
 *
 *   - renderProofProse tells the extracted proof in plain terms — premise
 *     surfaces as numbered evidence, rule glosses inline, the closing line
 *     tying the root fact to the world's secret;
 *   - the critic role is PINNED to claude/claude-fable-5: the shared
 *     DERIVATION_PROVIDER/_MODEL pair never reaches it, only its own
 *     DERIVATION_CRITIC_* env moves it (and the pinned model does not ride
 *     along onto a different provider);
 *   - runCritic's mock path produces the deterministic notice with no client
 *     and no CLI spawn, so zero-cost smokes exercise the commentary plumbing;
 *   - renderTranscript embeds the notice at the foot when given one;
 *   - buildCriticPrompt hands the critic the play, the verdict (glossed),
 *     the instrument panel, the proof in prose, and the annotated transcript.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadWorld,
  runDrama,
  makeLlmClient,
  makeLlmDirector,
  makeLlmTutor,
  makeLlmLearner,
  resolveTarget,
  diagnose,
  renderTranscript,
  renderProofProse,
  runCritic,
  mockCriticCommentary,
  buildCriticPrompt,
  commentaryFileMd,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-001-nocturne.yaml'));
const script = fs.readFileSync(path.join(ROOT, 'config/drama-derivation/tutor-scripts/nocturne-v001.md'), 'utf8');

// One mock drama, staged lazily and shared — the critic tests read artifacts,
// they do not need fresh performances.
let staged = null;
async function stagedDrama() {
  if (staged) return staged;
  const client = makeLlmClient({ mode: 'mock' });
  const roles = {
    director: makeLlmDirector(world, client),
    tutor: makeLlmTutor(world, client, { script }),
    learner: makeLlmLearner({ setting: world.setting, voice: world.learnerVoice, client }),
  };
  const result = await runDrama({ world, roles });
  const diagnosis = {
    label: 'test-run',
    note: null,
    backend: { mode: 'mock', roles: { director: { provider: 'mock', model: 'mock' } } },
    ...diagnose(result, world),
  };
  staged = { result, diagnosis };
  return staged;
}

function withEnv(vars, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const NO_CRITIC_ENV = { DERIVATION_CRITIC_PROVIDER: undefined, DERIVATION_CRITIC_MODEL: undefined };

// ---------------------------------------------------------------------------
// the proof, in prose
// ---------------------------------------------------------------------------

test('renderProofProse tells the world-001 proof with surfaces, glosses and the secret', async () => {
  const { result } = await stagedDrama();
  assert.ok(result.proof, 'mock drama extracted a proof');
  const prose = renderProofProse(result.proof, world);
  // numbered evidence carries the premises' authored surfaces
  assert.match(prose, /\(1\) /);
  assert.ok(prose.includes('Held to the lamp'), 'premise surface (watermark) appears as evidence');
  // rule applications quote the authored glosses
  assert.ok(prose.includes('copyists copy fair'), 'attribution-rule gloss is quoted');
  // facts are humanized into «…» phrases
  assert.ok(prose.includes('«liane composed nocturne»'), 'root fact humanized');
  // and the close ties the root to the secret's surface
  assert.ok(prose.includes(world.secret.surface), 'closing line states the secret surface');
});

// ---------------------------------------------------------------------------
// the pinned critic target
// ---------------------------------------------------------------------------

test('the critic is pinned to Fable; the shared drama pair never reaches it', () => {
  withEnv({ ...NO_CRITIC_ENV, DERIVATION_PROVIDER: undefined, DERIVATION_MODEL: undefined }, () => {
    assert.deepEqual(resolveTarget('critic'), { provider: 'claude', model: 'claude-fable-5', cli: true });
  });
  withEnv({ ...NO_CRITIC_ENV, DERIVATION_PROVIDER: 'codex', DERIVATION_MODEL: 'some-model' }, () => {
    const target = resolveTarget('critic');
    assert.equal(target.provider, 'claude');
    assert.equal(target.model, 'claude-fable-5');
    // …while the same shared pair still governs a non-pinned role
    assert.equal(resolveTarget('tutor').provider, 'codex');
  });
});

test('only DERIVATION_CRITIC_* moves the critic, and the pinned model does not ride along', () => {
  withEnv({ ...NO_CRITIC_ENV, DERIVATION_CRITIC_MODEL: 'claude-opus-4-8' }, () => {
    const target = resolveTarget('critic');
    assert.equal(target.provider, 'claude');
    assert.equal(target.model, 'claude-opus-4-8');
  });
  withEnv({ ...NO_CRITIC_ENV, DERIVATION_CRITIC_PROVIDER: 'openrouter' }, () => {
    const target = resolveTarget('critic');
    assert.equal(target.provider, 'openrouter');
    assert.ok(target.model, 'provider override falls back to that provider’s own default model');
    assert.notEqual(target.model, 'claude-fable-5', 'pinned model must not follow a different provider');
  });
});

// ---------------------------------------------------------------------------
// the mock notice + runCritic's mock path
// ---------------------------------------------------------------------------

test('mockCriticCommentary states the checker’s findings and names itself', async () => {
  const { result, diagnosis } = await stagedDrama();
  const notice = mockCriticCommentary({ result, diagnosis, label: 'test-run' });
  assert.ok(notice.includes('deterministic mock notice'), 'self-identifies as the mock');
  assert.ok(notice.includes('«grounded_anagnorisis»'), 'cites the verdict');
  assert.ok(notice.includes('npm run derivation:critic -- --label test-run'), 'points at the backfill command');
});

test('runCritic in mock mode needs no client and returns the mock target', async () => {
  const { result, diagnosis } = await stagedDrama();
  const notice = await runCritic({ result, diagnosis, world, label: 'test-run', mode: 'mock' });
  assert.deepEqual(notice.target, { provider: 'mock', model: 'mock' });
  assert.ok(notice.commentary.length > 0);
});

test('commentaryFileMd carries the heading, the byline and the prose', () => {
  const md = commentaryFileMd({
    label: 'test-run',
    commentary: 'The performance held.',
    target: { provider: 'claude', model: 'claude-fable-5' },
    generatedAt: '2026-06-10T00:00:00.000Z',
  });
  assert.ok(md.startsWith("# Critic's commentary — test-run"));
  assert.ok(md.includes('> critic claude/claude-fable-5 · written 2026-06-10'));
  assert.ok(md.includes('The performance held.'));
});

// ---------------------------------------------------------------------------
// embedding + the critic's brief
// ---------------------------------------------------------------------------

test('renderTranscript embeds the notice at the foot when given one', async () => {
  const { result, diagnosis } = await stagedDrama();
  const md = renderTranscript(result, world, { diagnosis, commentary: '*— notice by test*\n\nIt held.' });
  assert.ok(md.includes("## Critic's commentary"));
  assert.ok(md.includes('It held.'));
  const without = renderTranscript(result, world, { diagnosis });
  assert.ok(!without.includes("## Critic's commentary"), 'no section when no notice');
});

test('buildCriticPrompt hands the critic the play, the glossed verdict, the panel and the transcript', async () => {
  const { result, diagnosis } = await stagedDrama();
  const { system, user } = buildCriticPrompt({ result, diagnosis, world, label: 'test-run' });
  assert.ok(system.includes('derivation drama'), 'charter explains the form');
  assert.ok(user.includes(world.title), 'the play is named');
  assert.ok(user.includes('recognition earned, not guessed'), 'verdict arrives glossed for the lay reader');
  assert.ok(user.includes('INSTRUMENT PANEL'), 'panel included');
  assert.ok(user.includes('THE EXTRACTED PROOF, IN PROSE'), 'proof prose included');
  assert.ok(user.includes('[turn 1] director:'), 'annotated transcript included');
  assert.ok(
    user.includes(world.secret.surface),
    'the concealed truth is named to the critic (it judges staging, not the secret)',
  );
});
