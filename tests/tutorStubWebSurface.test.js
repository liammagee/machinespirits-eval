import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import express from 'express';

import { TUTOR_STUB_PUBLIC_CATALOG_SCHEMA, buildTutorStubPublicCatalog } from '../services/tutorStubCatalog.js';
import { mountEvalSurfaces } from '../services/evalSurfaces.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fakeHost() {
  return {
    create() {},
    step() {},
    list() {
      return [];
    },
  };
}

async function listen(t, app) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('public tutor catalog is an explicit learner-safe projection', () => {
  const previousCanary = process.env.TUTOR_CATALOG_SECRET_CANARY;
  process.env.TUTOR_CATALOG_SECRET_CANARY = 'must-not-escape-to-browser';
  try {
    const catalog = buildTutorStubPublicCatalog({ root: ROOT });
    assert.equal(catalog.schema, TUTOR_STUB_PUBLIC_CATALOG_SCHEMA);
    assert.ok(catalog.labs.length >= 3);
    assert.ok(catalog.labs.every((lab) => lab.audience === 'learner_safe'));
    assert.ok(catalog.labs.some((lab) => lab.id === 'pure_chat' && lab.launch.available));
    assert.ok(catalog.labs.some((lab) => lab.id === 'human_scaffold' && lab.launch.requiresWorld));
    assert.ok(catalog.labs.some((lab) => lab.id === 'mixed_drafting' && !lab.launch.available));
    assert.ok(catalog.labs.every((lab) => lab.launch.engine === 'tutor_stub'));
    assert.deepEqual(
      catalog.labs.filter((lab) => lab.launch.available).map((lab) => lab.id),
      ['pure_chat', 'human_scaffold'],
    );
    assert.ok(!catalog.labs.some((lab) => ['feedback_tuning', 'automated_eval', 'research_controls'].includes(lab.id)));

    assert.ok(catalog.worlds.length > 0);
    assert.ok(
      catalog.worlds.every((world) =>
        Object.keys(world).every((key) => ['id', 'title', 'question', 'discipline', 'summary'].includes(key)),
      ),
    );
    assert.ok(
      !catalog.worlds.some((world) =>
        ['world_000_smoke', 'world_017_saintcloud', 'world_018_edmund'].includes(world.id),
      ),
    );

    assert.ok(catalog.tutors.some((tutor) => tutor.id === 'dramatic-detective'));
    assert.ok(
      catalog.tutors.every(
        (tutor) => !('rolePrompt' in tutor) && !('policyPack' in tutor) && !('registryPath' in tutor),
      ),
    );
    assert.ok(catalog.models.some((model) => model.ref === 'codex.gpt-5.6-terra'));
    assert.ok(catalog.models.every((model) => /^[a-z0-9-]+\..+/u.test(model.ref)));

    const json = JSON.stringify(catalog);
    for (const forbidden of [
      'must-not-escape-to-browser',
      'api_key_env',
      'base_url',
      'role_prompt',
      'policy_pack',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
    ]) {
      assert.doesNotMatch(json, new RegExp(forbidden, 'u'));
    }
  } finally {
    if (previousCanary === undefined) delete process.env.TUTOR_CATALOG_SECRET_CANARY;
    else process.env.TUTOR_CATALOG_SECRET_CANARY = previousCanary;
  }
});

test('shared eval surfaces serve the tutor shell and versioned public catalog', async (t) => {
  const app = express();
  app.use(express.json());
  mountEvalSurfaces(app, { root: ROOT, tutorStubSessionHost: fakeHost() });
  const base = await listen(t, app);

  const shell = await fetch(`${base}/tutor/`);
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('content-type') || '', /^text\/html/u);
  assert.match(await shell.text(), /Start from a safe lab, then teach in text\./u);

  const legacyChat = await fetch(`${base}/chat/`, { redirect: 'manual' });
  assert.equal(legacyChat.status, 302);
  assert.equal(legacyChat.headers.get('location'), '/tutor?mode=research');

  const [script, styles, contract, catalog] = await Promise.all([
    fetch(`${base}/tutor/app.js`),
    fetch(`${base}/tutor/styles.css`),
    fetch(`${base}/api/tutor-stub`),
    fetch(`${base}/api/tutor-stub/catalog`),
  ]);
  assert.equal(script.status, 200);
  assert.match(await script.text(), /const API = `\$\{APP_PREFIX\}\/api\/tutor-stub`/u);
  assert.equal(styles.status, 200);
  assert.match(await styles.text(), /prefers-reduced-motion/u);
  assert.equal(contract.status, 200);
  assert.ok((await contract.json()).endpoints.includes('GET /catalog'));
  assert.equal(catalog.status, 200);
  assert.match(catalog.headers.get('cache-control') || '', /no-store/u);
  assert.equal((await catalog.json()).catalog.schema, TUTOR_STUB_PUBLIC_CATALOG_SCHEMA);
});

test('tutor shell keeps text, keyboard, consent, caption, and visual fallback contracts visible', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'tutor', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(ROOT, 'public', 'tutor', 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(ROOT, 'public', 'tutor', 'styles.css'), 'utf8');

  assert.match(html, /class="skip-link" href="#session-main"/u);
  assert.match(html, /role="log"[\s\S]*aria-live="polite"/u);
  assert.match(html, /id="message-input"[\s\S]*id="send-button"/u);
  assert.match(html, /id="stop-button"[\s\S]*aria-describedby="stop-help"/u);
  assert.match(html, /Stops the local tutor process, cancels the current wait/u);
  assert.match(script, /\/sessions\/\$\{encodeURIComponent\(id\)\}\/interrupt/u);
  assert.match(html, /id="mic-consent" type="checkbox"/u);
  assert.match(html, /id="enable-mic-button"[^>]*disabled/u);
  assert.match(html, /id="caption-text" aria-live="polite"/u);
  assert.match(html, /Raw audio is not added to the public trace/u);

  assert.match(html, /id="safe-mode"[^>]*value="safe" checked/u);
  assert.match(html, /id="research-mode"[^>]*value="research"/u);
  assert.match(html, /id="research-setup"[^>]*hidden/u);
  assert.match(html, /id="research-panel"[^>]*hidden/u);
  assert.match(html, /Learner persona annotation/u);
  assert.match(html, /Research metadata only; the human learner remains in control/u);
  assert.match(html, /id="assistant-input"[\s\S]*id="resolve-cell-button"/u);
  assert.match(html, /id="research-summary"[\s\S]*id="research-turns"/u);

  assert.match(script, /new AbortController\(\)/u);
  assert.match(script, /engine: lab\.launch\?\.engine \|\| 'tutor_stub'/u);
  assert.match(script, /const engine = elements\.lab\.selectedOptions\[0\]\?\.dataset\.engine/u);
  assert.match(script, /elements\.micConsent\.checked/u);
  assert.match(
    script,
    /state\.micEnabled = false;[\s\S]{0,160}elements\.enableMic\.disabled = true/u,
    'revoking microphone consent must disable the permission-triggering control',
  );
  assert.match(script, /SpeechRecognition/u);
  assert.match(script, /event\.key === 'Enter' \|\| event\.key === ' '/u);
  assert.match(script, /role === 'learner' \? 'You' : role === 'tutor' \? 'Tutor' : 'Session'/u);
  assert.match(script, /let chatApiBase = `\$\{APP_PREFIX\}\/api\/chat`/u);
  assert.match(script, /payload\?\.adminPath/u);
  assert.match(script, /state\.surfaceMode = research \? 'research' : 'safe'/u);
  assert.match(script, /new URLSearchParams\(window\.location\.search\)[\s\S]{0,240}mode[\s\S]{0,240}research/u);
  assert.match(script, /chatApi\('\/resolve'/u);
  assert.match(script, /chatApi\('\/assist'/u);
  assert.match(script, /cell\.runner !== 'adaptive'/u);
  assert.match(script, /engine: 'cell_lab'[\s\S]*mode: 'cell_lab'/u);
  assert.match(script, /state\.surfaceMode !== 'research' \|\| !isResearchSession\(\)/u);
  assert.match(script, /content\.textContent = safeText\(entry\.content/u);
  assert.match(script, /machinespirits\.cell-lab\.research-export\.v1/u);
  assert.match(script, /privateModelTraceIncluded: false/u);
  assert.equal(fs.existsSync(path.join(ROOT, 'public', 'chat', 'index.html')), false);

  assert.match(styles, /:focus-visible/u);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(styles, /@media \(forced-colors: active\)/u);
  assert.match(styles, /border-(?:left|right): 4px/u);
  assert.match(styles, /\.research-panel/u);
});
