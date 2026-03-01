#!/usr/bin/env node
/**
 * Test script for LMStudio provider integration.
 *
 * Tests the full path: provider resolution → model resolution → API call
 * to isolate where failures occur.
 *
 * Usage:
 *   node scripts/test-lmstudio.js                  # Run all tests
 *   node scripts/test-lmstudio.js --verbose         # Show request/response details
 *   node scripts/test-lmstudio.js --model qwen3-vl  # Test a specific model alias
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Change to project root so config loading works
process.chdir(join(__dirname, '..'));

const verbose = process.argv.includes('--verbose');
const modelArg = process.argv.find((a, i) => process.argv[i - 1] === '--model') || 'default';

let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  failed++;
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`    → ${detail}`);
}

// ─── Test 1: Raw curl-equivalent fetch ─────────────────────────────────────
async function testRawFetch() {
  console.log('\n1. Raw fetch to LMStudio (curl equivalent)');
  const url = 'http://10.0.0.174:1234/v1/chat/completions';
  const body = {
    model: 'qwen/qwen3-vl-4b',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello in one sentence.' },
    ],
    max_tokens: 50,
    temperature: 0.5,
  };

  if (verbose) {
    console.log(`  URL: ${url}`);
    console.log(`  Body: ${JSON.stringify(body, null, 2)}`);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      ok(`Status ${res.status} — "${text.slice(0, 60)}..."`);
    } else {
      const data = await res.json().catch(() => ({}));
      fail(`Status ${res.status}`, data?.error?.message || JSON.stringify(data));
    }
  } catch (e) {
    fail('Connection failed', e.message);
  }
}

// ─── Test 2: Raw fetch with stale auth header ──────────────────────────────
async function testRawFetchWithAuth() {
  console.log('\n2. Raw fetch with spurious Authorization header');
  const url = 'http://10.0.0.174:1234/v1/chat/completions';
  const body = {
    model: 'qwen/qwen3-vl-4b',
    messages: [{ role: 'user', content: 'Say hello.' }],
    max_tokens: 30,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-fake-stale-key-from-another-provider',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      ok(`Status ${res.status} — LMStudio ignores stale auth header`);
    } else {
      const data = await res.json().catch(() => ({}));
      fail(`Status ${res.status}`, data?.error?.message || JSON.stringify(data));
    }
  } catch (e) {
    fail('Connection failed', e.message);
  }
}

// ─── Test 3: Provider config resolution ────────────────────────────────────
async function testProviderConfig() {
  console.log('\n3. Provider config resolution');
  try {
    const { default: evalConfigLoader } = await import('../services/evalConfigLoader.js');

    const config = evalConfigLoader.getProviderConfig('lmstudio');
    if (!config) {
      fail('getProviderConfig returned null');
      return;
    }

    if (verbose) console.log(`  Config: ${JSON.stringify(config, null, 2)}`);

    if (config.base_url?.includes('10.0.0.174:1234')) {
      ok(`base_url: ${config.base_url}`);
    } else {
      fail('Wrong base_url', config.base_url);
    }

    if (config.isConfigured) {
      ok('isConfigured: true');
    } else {
      fail('isConfigured: false', 'Provider should be configured without API key');
    }

    // Check that apiKey is empty (no api_key_env for lmstudio)
    if (!config.apiKey || config.apiKey === '') {
      ok('apiKey: empty (no api_key_env — correct)');
    } else {
      fail('Unexpected apiKey', `"${config.apiKey.slice(0, 10)}..." — should be empty`);
    }

    // Check models mapping
    const defaultModel = config.models?.default;
    if (defaultModel === 'qwen3-14b') {
      ok(`models.default: ${defaultModel}`);
    } else {
      fail('Wrong models.default', defaultModel);
    }
  } catch (e) {
    fail('Import/config error', e.message);
  }
}

// ─── Test 4: Model resolution ──────────────────────────────────────────────
async function testModelResolution() {
  console.log('\n4. Model resolution (evalConfigLoader.resolveModel)');
  try {
    const { default: evalConfigLoader } = await import('../services/evalConfigLoader.js');

    const ref = `lmstudio.${modelArg}`;
    const r = evalConfigLoader.resolveModel(ref);

    if (verbose) console.log(`  resolveModel("${ref}"): ${JSON.stringify(r, null, 2)}`);

    if (r.provider === 'lmstudio') {
      ok(`provider: ${r.provider}`);
    } else {
      fail('Wrong provider', r.provider);
    }

    if (r.model && !r.model.includes('undefined')) {
      ok(`model: ${r.model}`);
    } else {
      fail('Bad model ID', r.model);
    }

    if (r.baseUrl?.includes('10.0.0.174:1234')) {
      ok(`baseUrl: ${r.baseUrl}`);
    } else {
      fail('Wrong baseUrl', r.baseUrl);
    }

    if (r.isConfigured) {
      ok('isConfigured: true');
    } else {
      fail('isConfigured: false');
    }

    // Critical: apiKey should be empty for lmstudio
    if (!r.apiKey) {
      ok('apiKey: empty (correct for keyless provider)');
    } else {
      fail('Unexpected apiKey in resolved model', `"${r.apiKey.slice(0, 10)}..."`);
    }
  } catch (e) {
    fail('Resolution error', e.message);
  }
}

// ─── Test 5: Object-format resolution (how eval runner passes it) ──────────
async function testObjectResolution() {
  console.log('\n5. Object-format model resolution (eval runner → tutor-core path)');
  try {
    // Import tutor-core's config loader (via symlink)
    const { tutorConfigLoader } = await import('@machinespirits/tutor-core');

    // This is what evalRunner passes to tutor-core
    const egoModelObj = { provider: 'lmstudio', model: 'qwen/qwen3-vl-4b' };
    const resolved = tutorConfigLoader.resolveModel(egoModelObj);

    if (verbose) console.log(`  resolveModel(object): ${JSON.stringify(resolved, null, 2)}`);

    if (resolved.provider === 'lmstudio') {
      ok(`provider: ${resolved.provider}`);
    } else {
      fail('Wrong provider', resolved.provider);
    }

    if (resolved.model === 'qwen/qwen3-vl-4b') {
      ok(`model: ${resolved.model}`);
    } else {
      fail('Wrong model', resolved.model);
    }

    if (resolved.baseUrl?.includes('10.0.0.174:1234')) {
      ok(`baseUrl: ${resolved.baseUrl}`);
    } else {
      fail('Wrong baseUrl from tutor-core', resolved.baseUrl);
    }

    // Simulate the providerConfig override (the fix we applied)
    const originalProviderConfig = {
      apiKey: 'sk-or-some-openrouter-key',
      base_url: 'https://openrouter.ai/api/v1/chat/completions',
      isConfigured: true,
    };

    const overriddenProviderConfig = {
      ...originalProviderConfig,
      apiKey: resolved.apiKey != null ? resolved.apiKey : originalProviderConfig.apiKey,
      base_url: resolved.baseUrl || originalProviderConfig.base_url,
      isConfigured: resolved.isConfigured ?? originalProviderConfig.isConfigured,
    };

    if (overriddenProviderConfig.base_url.includes('10.0.0.174:1234')) {
      ok(`Overridden base_url: ${overriddenProviderConfig.base_url}`);
    } else {
      fail('base_url NOT overridden!', overriddenProviderConfig.base_url);
    }

    // BUG CHECK: apiKey fallback
    if (overriddenProviderConfig.apiKey === 'sk-or-some-openrouter-key') {
      fail(
        'apiKey falls back to original provider key!',
        'Empty string is falsy, so || picks up the old key. ' +
          'This sends an OpenRouter API key to LMStudio.',
      );
    } else {
      ok('apiKey correctly empty after override');
    }
  } catch (e) {
    fail('Resolution error', e.message);
  }
}

// ─── Test 6: Full tutor-core API call (via _callAIOnce equivalent) ─────────
async function testTutorCorePath() {
  console.log('\n6. Full API call through tutor-core dispatch path');
  try {
    const { tutorConfigLoader } = await import('@machinespirits/tutor-core');

    // Get the lmstudio provider config directly
    const providerConfig = tutorConfigLoader.getProviderConfig('lmstudio');
    const model = providerConfig.models?.[modelArg] || modelArg;

    if (verbose) {
      console.log(`  providerConfig.base_url: ${providerConfig.base_url}`);
      console.log(`  providerConfig.apiKey: "${providerConfig.apiKey || ''}"`);
      console.log(`  model: ${model}`);
    }

    // Simulate what _callAIOnce does for local/lmstudio
    const localMessages = [
      { role: 'system', content: 'You are a helpful tutor.' },
      { role: 'user', content: 'Briefly describe photosynthesis.' },
    ];

    const localBody = {
      model,
      temperature: 0.5,
      max_tokens: 100,
      messages: localMessages,
    };

    const localHeaders = { 'Content-Type': 'application/json' };
    if (providerConfig.apiKey) {
      localHeaders['Authorization'] = `Bearer ${providerConfig.apiKey}`;
    }

    if (verbose) {
      console.log(`  Headers: ${JSON.stringify(localHeaders)}`);
      console.log(`  Body: ${JSON.stringify(localBody, null, 2)}`);
    }

    const res = await fetch(providerConfig.base_url, {
      method: 'POST',
      headers: localHeaders,
      body: JSON.stringify(localBody),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      ok(`Status ${res.status} — "${text.slice(0, 80)}..."`);
      if (verbose) {
        console.log(`  Usage: ${JSON.stringify(data?.usage)}`);
      }
    } else {
      const raw = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const errorMsg = parsed?.error?.message || raw.slice(0, 200);
      fail(`Status ${res.status}`, errorMsg);
    }
  } catch (e) {
    fail('API call error', e.message);
  }
}

// ─── Test 7: Simulate ego override with providerConfig fallback ────────────
async function testEgoOverrideSimulation() {
  console.log('\n7. Simulate ego model override (providerConfig merge)');
  try {
    const { tutorConfigLoader } = await import('@machinespirits/tutor-core');

    // Get the DEFAULT ego config (openrouter/nemotron for cell_1)
    const defaultEgoConfig = tutorConfigLoader.getAgentConfig('ego', 'base');
    if (!defaultEgoConfig) {
      fail('Could not load default ego config for "base" profile');
      return;
    }

    if (verbose) {
      console.log(`  Default ego provider: ${defaultEgoConfig.provider}`);
      console.log(`  Default ego providerConfig.base_url: ${defaultEgoConfig.providerConfig?.base_url}`);
      console.log(`  Default ego providerConfig.apiKey: ${defaultEgoConfig.providerConfig?.apiKey ? '***' : 'empty'}`);
    }

    // Resolve the lmstudio override
    const resolved = tutorConfigLoader.resolveModel({ provider: 'lmstudio', model: 'qwen/qwen3-vl-4b' });

    // Apply the CURRENT fix (must use != null, not ||, to preserve empty string for keyless providers)
    const overriddenEgoConfig = {
      ...defaultEgoConfig,
      provider: resolved.provider,
      model: resolved.model,
      providerConfig: {
        ...defaultEgoConfig.providerConfig,
        apiKey: resolved.apiKey != null ? resolved.apiKey : defaultEgoConfig.providerConfig?.apiKey,
        base_url: resolved.baseUrl || defaultEgoConfig.providerConfig?.base_url,
        isConfigured: resolved.isConfigured ?? defaultEgoConfig.providerConfig?.isConfigured,
      },
    };

    console.log(`  After override:`);
    console.log(`    provider: ${overriddenEgoConfig.provider}`);
    console.log(`    model: ${overriddenEgoConfig.model}`);
    console.log(`    providerConfig.base_url: ${overriddenEgoConfig.providerConfig.base_url}`);
    console.log(`    providerConfig.apiKey: "${overriddenEgoConfig.providerConfig.apiKey ? '***' : ''}"`);
    console.log(`    providerConfig.isConfigured: ${overriddenEgoConfig.providerConfig.isConfigured}`);

    // Check base_url
    if (overriddenEgoConfig.providerConfig.base_url.includes('10.0.0.174:1234')) {
      ok('base_url correctly points to LMStudio');
    } else {
      fail('base_url still points to original provider!', overriddenEgoConfig.providerConfig.base_url);
    }

    // Check apiKey leak
    const hasLeakedKey = overriddenEgoConfig.providerConfig.apiKey &&
      overriddenEgoConfig.providerConfig.apiKey !== '' &&
      overriddenEgoConfig.providerConfig.apiKey !== resolved.apiKey;
    if (hasLeakedKey) {
      fail(
        'API key leaked from original provider!',
        'resolved.apiKey is empty string (falsy), so || picks up the original key',
      );
    } else {
      ok('API key is clean (no leak from original provider)');
    }

    // Now actually make the call with the overridden config
    console.log('\n  Making actual API call with overridden config...');
    const localBody = {
      model: overriddenEgoConfig.model,
      temperature: 0.5,
      max_tokens: 80,
      messages: [
        { role: 'system', content: 'You are a helpful tutor.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
    };

    const localHeaders = { 'Content-Type': 'application/json' };
    if (overriddenEgoConfig.providerConfig.apiKey) {
      localHeaders['Authorization'] = `Bearer ${overriddenEgoConfig.providerConfig.apiKey}`;
    }

    if (verbose) {
      console.log(`  → URL: ${overriddenEgoConfig.providerConfig.base_url}`);
      console.log(`  → Headers: ${JSON.stringify(localHeaders)}`);
    }

    const res = await fetch(overriddenEgoConfig.providerConfig.base_url, {
      method: 'POST',
      headers: localHeaders,
      body: JSON.stringify(localBody),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      ok(`API call succeeded: "${text.slice(0, 60)}"`);
    } else {
      const raw = await res.text();
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      fail(`API call failed: ${res.status}`, parsed?.error?.message || raw.slice(0, 200));
    }
  } catch (e) {
    fail('Simulation error', e.message);
  }
}

// ─── Test 8: Full tutorApi.generateSuggestions with lmstudio override ──────
async function testFullGeneration() {
  console.log('\n8. Full tutorApi.generateSuggestions (production code path)');
  const originalFetch = globalThis.fetch;
  const interceptedRequests = [];
  try {
    const { tutorApiService: tutorApi } = await import('@machinespirits/tutor-core');

    const context = tutorApi.buildContext(
      'Student: I am struggling with photosynthesis. I keep mixing up the light and dark reactions.',
    );
    context.isNewUser = true;

    // Intercept fetch to log the actual request
    globalThis.fetch = async (url, opts) => {
      interceptedRequests.push({ url: String(url), method: opts?.method, body: opts?.body?.slice?.(0, 200) });
      if (verbose) {
        console.log(`  [FETCH] ${opts?.method || 'GET'} ${url}`);
        if (opts?.headers) console.log(`  [FETCH] Headers: ${JSON.stringify(opts.headers)}`);
        if (opts?.body) console.log(`  [FETCH] Body (first 200): ${String(opts.body).slice(0, 200)}`);
      }
      const res = await originalFetch(url, opts);
      if (!res.ok) {
        console.log(`  [FETCH] Response: ${res.status} ${res.statusText}`);
        // Clone to read body without consuming it
        const clone = res.clone();
        const text = await clone.text().catch(() => '');
        console.log(`  [FETCH] Response body (first 300): ${text.slice(0, 300)}`);
      }
      return res;
    };

    console.log('  Calling generateSuggestions with egoModel override...');
    const result = await tutorApi.generateSuggestions(context, {
      profileName: 'budget',
      egoModel: { provider: 'lmstudio', model: 'qwen/qwen3-vl-4b' },
      disableSuperego: true,
      useDialogue: false,
      maxRounds: 0,
      trace: false,
      hyperparameters: { max_tokens: 100, temperature: 0.5 },
    });

    // Restore original fetch
    globalThis.fetch = originalFetch;

    if (result.success) {
      const text = JSON.stringify(result.suggestions || result.response || '').slice(0, 100);
      ok(`Generation succeeded: ${text}...`);
      if (verbose && result.metadata) {
        console.log(`  Provider: ${result.metadata.provider}`);
        console.log(`  Model: ${result.metadata.model}`);
        console.log(`  Latency: ${result.metadata.latencyMs}ms`);
      }
    } else {
      fail('Generation failed', result.error || JSON.stringify(result));
      console.log(`  Intercepted requests:`);
      for (const r of interceptedRequests) {
        console.log(`    ${r.method} ${r.url}`);
        if (r.body) console.log(`      body: ${r.body}`);
      }
    }
  } catch (e) {
    // Restore fetch even on error
    if (typeof originalFetch === 'function') globalThis.fetch = originalFetch;
    fail('Generation error', e.message);
  }
}

// ─── Test 9: _fetchProvider is importable from tutor-core ────────────────
async function testFetchProviderImport() {
  console.log('\n9. _fetchProvider importable from tutor-core');
  try {
    const { _fetchProvider: fp, isContextOverflowError: isOF, truncateForContextOverflow: trunc, extractStructuredSummary: ess } =
      await import('@machinespirits/tutor-core');

    if (typeof fp === 'function') {
      ok('_fetchProvider is a function');
    } else {
      fail('_fetchProvider not a function', typeof fp);
    }

    if (typeof isOF === 'function') {
      ok('isContextOverflowError is a function');
    } else {
      fail('isContextOverflowError not a function', typeof isOF);
    }

    if (typeof trunc === 'function') {
      ok('truncateForContextOverflow is a function');
    } else {
      fail('truncateForContextOverflow not a function', typeof trunc);
    }

    if (typeof ess === 'function') {
      ok('extractStructuredSummary is a function');
    } else {
      fail('extractStructuredSummary not a function', typeof ess);
    }
  } catch (e) {
    fail('Import error', e.message);
  }
}

// ─── Test 10: Context overflow error detection ──────────────────────────────
async function testContextOverflowDetection() {
  console.log('\n10. Context overflow error detection');
  try {
    const { isContextOverflowError } = await import('@machinespirits/tutor-core');

    // Should detect overflow errors
    if (isContextOverflowError(400, 'tokens to keep from the initial prompt are exceeding the context window')) {
      ok('Detects "tokens to keep" error');
    } else {
      fail('Missed "tokens to keep" error');
    }

    if (isContextOverflowError(400, 'context length exceeded')) {
      ok('Detects "context length" error');
    } else {
      fail('Missed "context length" error');
    }

    if (isContextOverflowError(500, 'model has crashed')) {
      ok('Detects "model has crashed" error');
    } else {
      fail('Missed "model has crashed" error');
    }

    if (isContextOverflowError(400, 'The context window is too small')) {
      ok('Detects "context window" error');
    } else {
      fail('Missed "context window" error');
    }

    // Should NOT detect non-overflow errors
    if (!isContextOverflowError(401, 'unauthorized')) {
      ok('Does not detect 401 unauthorized');
    } else {
      fail('Falsely detected 401 as overflow');
    }

    if (!isContextOverflowError(400, 'invalid model name')) {
      ok('Does not detect "invalid model name"');
    } else {
      fail('Falsely detected "invalid model name" as overflow');
    }

    if (!isContextOverflowError(400, null)) {
      ok('Does not detect null error message');
    } else {
      fail('Falsely detected null error message');
    }
  } catch (e) {
    fail('Detection test error', e.message);
  }
}

// ─── Test 11: Truncation at each level ──────────────────────────────────────
async function testTruncationLevels() {
  console.log('\n11. Truncation produces smaller output at each level');
  try {
    const { truncateForContextOverflow } = await import('@machinespirits/tutor-core');

    const systemPrompt = 'You are a helpful tutor. '.repeat(200); // ~5000 chars
    const userPrompt = [
      '## Available Simulations',
      'Simulation 1: Photosynthesis Explorer — Interactive lab simulation.\n'.repeat(20),
      '## Available Curriculum',
      'Unit 1: Introduction to Biology\nUnit 2: Cell Structure\n'.repeat(20),
      '## Learner Context',
      'Student is struggling with the concept of photosynthesis.\n'.repeat(10),
    ].join('\n');

    const originalLen = systemPrompt.length + userPrompt.length;

    const level1 = truncateForContextOverflow(systemPrompt, userPrompt, 1);
    const level1Len = level1.systemPrompt.length + level1.userPrompt.length;

    const level2 = truncateForContextOverflow(systemPrompt, userPrompt, 2);
    const level2Len = level2.systemPrompt.length + level2.userPrompt.length;

    console.log(`  Original: ${originalLen} chars`);
    console.log(`  Level 1: ${level1Len} chars (${Math.round((1 - level1Len / originalLen) * 100)}% reduction)`);
    console.log(`  Level 2: ${level2Len} chars (${Math.round((1 - level2Len / originalLen) * 100)}% reduction)`);

    if (level1Len < originalLen) {
      ok(`Level 1 is smaller than original (${originalLen} → ${level1Len})`);
    } else {
      fail('Level 1 is NOT smaller', `${originalLen} → ${level1Len}`);
    }

    if (level2Len < level1Len) {
      ok(`Level 2 is smaller than level 1 (${level1Len} → ${level2Len})`);
    } else {
      fail('Level 2 is NOT smaller than level 1', `${level1Len} → ${level2Len}`);
    }

    // Level 1 should remove simulations section
    if (!level1.userPrompt.includes('## Available Simulations')) {
      ok('Level 1 removed simulations section');
    } else {
      fail('Level 1 did NOT remove simulations section');
    }

    // Level 2 should truncate system prompt
    if (level2.systemPrompt.length <= 1600) {
      ok(`Level 2 truncated system prompt (${level2.systemPrompt.length} chars)`);
    } else {
      fail('Level 2 did NOT truncate system prompt', `${level2.systemPrompt.length} chars`);
    }
  } catch (e) {
    fail('Truncation test error', e.message);
  }
}

// ─── Test 12: _fetchProvider via shared path with lmstudio ──────────────────
async function testFetchProviderWithLmstudio() {
  console.log('\n12. _fetchProvider with lmstudio provider (live call)');
  try {
    const { _fetchProvider: fp, tutorConfigLoader } = await import('@machinespirits/tutor-core');

    const providerConfig = tutorConfigLoader.getProviderConfig('lmstudio');
    const model = providerConfig.models?.[modelArg] || providerConfig.default_model || modelArg;

    const result = await fp({
      provider: 'lmstudio',
      providerConfig,
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "test passed" in one sentence.' },
      ],
      hyperparameters: { temperature: 0.5, max_tokens: 50 },
      onToken: null,
    });

    if (result.text && result.text.length > 0) {
      ok(`Got response: "${result.text.slice(0, 60)}..."`);
    } else if (result.contextOverflow) {
      ok(`Got context overflow signal (expected for small models): ${result.errorMessage}`);
    } else {
      fail('Empty response', JSON.stringify(result));
    }

    if (typeof result.inputTokens === 'number') {
      ok(`inputTokens: ${result.inputTokens}`);
    } else {
      fail('Missing inputTokens');
    }
  } catch (e) {
    fail('_fetchProvider call error', e.message);
  }
}

// ─── Run all tests ─────────────────────────────────────────────────────────
console.log('LMStudio Provider Integration Tests');
console.log('====================================');
console.log(`Target: http://10.0.0.174:1234`);
console.log(`Model alias: ${modelArg}`);

await testRawFetch();
await testRawFetchWithAuth();
await testProviderConfig();
await testModelResolution();
await testObjectResolution();
await testTutorCorePath();
await testEgoOverrideSimulation();
await testFullGeneration();
await testFetchProviderImport();
await testContextOverflowDetection();
await testTruncationLevels();
await testFetchProviderWithLmstudio();

console.log('\n────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed tests indicate where the LMStudio path breaks.');
  process.exit(1);
} else {
  console.log('\nAll tests passed — LMStudio path is working.');
}
