import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PREFERRED_TUTOR_MODEL_REFS,
  assertTutorStubSupportedModelRefs,
  buildTutorStubModelChoiceEntries,
  createTutorStubModelSelection,
  projectTutorStubModelChoiceLines,
} from '../services/tutorStubModelChoicePresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = Object.freeze({
  brightCyan: '<bright-cyan>',
  cyan: '<cyan>',
  dim: '<dim>',
  reset: '<reset>',
});

function terminalBytes(lines) {
  return lines.map((line) => `${line}\n`).join('');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function modelEntry(index, { current = false } = {}) {
  return {
    current,
    ref: `provider.model-${index}`,
    model: `model-${index}`,
    access: index % 2 ? 'API key' : 'CLI login',
  };
}

test('model-choice catalogue preserves admission, access labels, exclusions, fallback, and ordering', () => {
  const providers = {
    codex: { models: { 'gpt-5.6-sol': 'gpt-5.6-sol', mini: 'gpt-mini' } },
    openai: { api_key_env: 'OPENAI_API_KEY', models: { mini: 'gpt-5-mini' } },
    local: { models: { beta: 'local-beta', alpha: 'local-alpha' } },
    broken: { models: { ignored: 'ignored' } },
  };
  const configured = new Set(['codex', 'local']);
  const entries = buildTutorStubModelChoiceEntries({
    currentRef: 'external.current',
    providers,
    getProviderConfig(provider) {
      if (provider === 'broken') throw new Error('broken provider');
      return { isConfigured: configured.has(provider) };
    },
    isCliProvider: (provider) => provider === 'codex',
    resolveModel: () => ({ provider: 'external', model: 'external-model' }),
    unsupportedRefs: new Set(['codex.mini']),
  });

  assert.equal(Object.isFrozen(PREFERRED_TUTOR_MODEL_REFS), true);
  assert.deepEqual(entries, [
    {
      ref: 'external.current',
      provider: 'external',
      alias: 'current',
      model: 'external-model',
      access: 'current launch model',
      current: true,
    },
    {
      ref: 'codex.gpt-5.6-sol',
      provider: 'codex',
      alias: 'gpt-5.6-sol',
      model: 'gpt-5.6-sol',
      access: 'CLI login',
      current: false,
    },
    {
      ref: 'local.alpha',
      provider: 'local',
      alias: 'alpha',
      model: 'local-alpha',
      access: 'local endpoint',
      current: false,
    },
    {
      ref: 'local.beta',
      provider: 'local',
      alias: 'beta',
      model: 'local-beta',
      access: 'local endpoint',
      current: false,
    },
  ]);
});

test('model-choice catalogue admits an unconfigured current provider and tolerates unresolved current refs', () => {
  const entries = buildTutorStubModelChoiceEntries({
    currentRef: 'openai.mini',
    providers: { openai: { api_key_env: 'OPENAI_API_KEY', models: { mini: 'gpt-5-mini' } } },
    getProviderConfig: () => ({ isConfigured: false }),
    isCliProvider: () => false,
    resolveModel: () => {
      throw new Error('must not resolve an already listed current ref');
    },
  });
  assert.deepEqual(entries, [
    {
      ref: 'openai.mini',
      provider: 'openai',
      alias: 'mini',
      model: 'gpt-5-mini',
      access: 'OPENAI_API_KEY configured',
      current: true,
    },
  ]);

  assert.deepEqual(
    buildTutorStubModelChoiceEntries({
      currentRef: 'missing.ref',
      getProviderConfig: () => ({ isConfigured: false }),
      isCliProvider: () => false,
      resolveModel: () => {
        throw new Error('unknown');
      },
    }),
    [],
  );
});

test('model selection rejects unsupported local Codex aliases with the existing actionable error', () => {
  const unsupportedRefs = new Set(['codex.mini']);
  assert.doesNotThrow(() => assertTutorStubSupportedModelRefs({ model: 'codex.gpt-5.6-terra' }, { unsupportedRefs }));
  assert.throws(
    () => assertTutorStubSupportedModelRefs({ model: ' CODEX.MINI ' }, { unsupportedRefs }),
    /model=\s+CODEX\.MINI\s+is not supported.*Use codex\.gpt-5\.6-terra/u,
  );
});

test('model selection binds catalogue inputs and fails unavailable routes with the same requirement', () => {
  const calls = [];
  const selection = createTutorStubModelSelection({
    loadProviders: () => ({ providers: { codex: { models: { sol: 'gpt-5.6-sol' } } } }),
    getProviderConfig: (provider) => {
      calls.push(`config:${provider}`);
      return provider === 'codex' ? { isConfigured: true } : { isConfigured: false, api_key_env: 'OPENAI_API_KEY' };
    },
    isCliProvider: (provider) => provider === 'codex',
    resolveModel: (ref) =>
      ref.startsWith('codex.')
        ? { provider: 'codex', model: 'gpt-5.6-sol' }
        : { provider: 'openai', model: 'gpt-5-mini' },
    unsupportedRefs: new Set(['codex.mini']),
  });

  assert.equal(selection.tutorModelChoiceEntries('codex.sol')[0].ref, 'codex.sol');
  assert.throws(() => selection.assertSupportedModelRefs({ classifier: 'CODEX.MINI' }), /classifier=CODEX\.MINI/u);
  assert.equal(selection.resolveTutorModelSelection(' codex.sol ').modelRef, 'codex.sol');
  assert.throws(() => selection.resolveTutorModelSelection('openai.mini'), /configure OPENAI_API_KEY first/u);
  assert.deepEqual(calls, ['config:codex', 'config:codex', 'config:openai']);
  assert.equal(Object.isFrozen(selection), true);
});

test('model-choice projection pins current marker, padding, exact bytes, and input immutability', () => {
  const input = {
    definition: { label: 'Tutor voice', setting: 'tutor', defaultRef: 'provider.model-1' },
    currentRef: 'provider.model-2',
    entries: [modelEntry(1), modelEntry(2, { current: true }), modelEntry(3)],
    colors: COLORS,
  };
  const before = structuredClone(input);
  const lines = projectTutorStubModelChoiceLines(input);
  const output = terminalBytes(lines);

  assert.equal(lines.length, 5);
  assert.equal(sha256(output), 'eaaba06fb6b9d6b4c905721e5b726b571b57cff3f126c9b66e00db8bf9ec9727');
  assert.match(output, /<bright-cyan>› provider\.model-2/u);
  assert.match(output, /<dim> {2}provider\.model-1/u);
  assert.match(output, /default restores provider\.model-1<reset>\n\n$/u);
  assert.equal(Object.isFrozen(lines), true);
  assert.deepEqual(input, before, 'projection must not mutate its input');
});

test('model-choice projection limits visible aliases and reports the exact hidden count', () => {
  const entries = Array.from({ length: 18 }, (_, index) => modelEntry(index + 1, { current: index === 0 }));
  const lines = projectTutorStubModelChoiceLines({
    definition: { label: 'Learner voice', setting: 'learner', defaultRef: 'provider.model-1' },
    currentRef: 'provider.model-1',
    entries,
    visibleLimit: 4,
    colors: COLORS,
  });
  const output = terminalBytes(lines);

  assert.equal(lines.length, 7);
  assert.match(output, /… 14 more configured aliases/u);
  assert.doesNotMatch(output, /provider\.model-5/u);
  assert.match(output, /settings models learner/u);
});

test('empty model catalog retains the header and actionable default footer', () => {
  const lines = projectTutorStubModelChoiceLines({
    definition: { label: 'Learner reasoning tracker', setting: 'reasoning', defaultRef: 'codex.sol' },
    currentRef: 'codex.sol',
    entries: [],
    colors: COLORS,
  });

  assert.deepEqual(lines, [
    '<cyan>learner reasoning tracker models ><reset> current codex.sol',
    '<dim>  choose with /settings models reasoning <provider.alias>; default restores codex.sol<reset>\n',
  ]);
});

test('real tutor and classifier model-choice commands preserve exact no-model terminal blocks', () => {
  const commonArgs = [
    'scripts/tutor-stub.js',
    '--no-opening',
    '--no-closeout-report',
    '--no-interim-animation',
    '--no-stream',
    '--no-trace',
    '--no-remember-settings',
    '--world',
    'world_005_marrick',
  ];
  const variants = [
    {
      name: 'tutor',
      input: '/settings model\n/quit\n',
      pattern: /tutor voice models >[\s\S]*?\n\n/u,
      bytes: 1292,
      hash: 'dcea4ec3ba403c33674654b5c85d20caf6cce9fa4aa62f3b1497efc9ce1b0e87',
    },
    {
      name: 'classifier',
      input: '/settings models classifier\n/quit\n',
      pattern: /learner interpretation models >[\s\S]*?\n\n/u,
      bytes: 1304,
      hash: '453d9508f0d74796a94a14438c0915719dd11db4434ce5e1a6f3c5276ce33d2b',
    },
  ];

  for (const variant of variants) {
    const result = spawnSync(process.execPath, commonArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      input: variant.input,
      timeout: 15_000,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TUTOR_STUB_OPENING_REALIZER: 'deterministic',
        TUTOR_STUB_SUMMARY_OPEN: '0',
        TUTOR_STUB_REMEMBER_SETTINGS: '0',
      },
    });
    const block = result.stdout.match(variant.pattern)?.[0] || '';

    assert.equal(result.status, 0, `${variant.name}: ${result.stderr}`);
    assert.equal(block.split('\n').length - 2, 19, variant.name);
    assert.equal(Buffer.byteLength(block), variant.bytes, variant.name);
    assert.equal(sha256(block), variant.hash, variant.name);
  }
});

test('the CLI retains role and entry resolution, slash dispatch, picker behavior, and terminal ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubModelChoicePresentation.js'), 'utf8');
  const choiceSlice = cliSource.slice(
    cliSource.indexOf('function printModelChoices'),
    cliSource.indexOf('function pickLiveNumericSettingValue'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubModelChoicePresentation\.js';/u);
  assert.match(cliSource, /createTutorStubModelSelection/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:assertSupportedModelRefs|tutorModelChoiceEntries|resolveTutorModelSelection)\(/u,
  );
  assert.match(choiceSlice, /liveModelRoleDefinitions\[role\]/u);
  assert.match(choiceSlice, /liveModelRoleRef\(role\)/u);
  assert.match(choiceSlice, /tutorModelChoiceEntries\(currentRef\)/u);
  assert.match(choiceSlice, /projectTutorStubModelChoiceLines/u);
  assert.match(choiceSlice, /console\.log\(line\)/u);
  assert.match(choiceSlice, /pickInitialTutorModelWithKeyboard/u);
  assert.match(choiceSlice, /handleDialogueSettings/u);
  assert.match(cliSource, /if \(setting === 'models'\)/u);
  assert.doesNotMatch(choiceSlice, /more configured aliases/u);
  assert.doesNotMatch(choiceSlice, /default restores/u);
  assert.match(serviceSource, /export function projectTutorStubModelChoiceLines/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
